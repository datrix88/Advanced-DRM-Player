let player;
let ui;
const DEBUG_MODE = false;

function debugLog(...args) {
    if (DEBUG_MODE) console.debug("[ShakaDebug]", ...args);
}

async function resolveFinalUrl(originalUrl, requestHeaders = {}) {
    debugLog(`Resolviendo URL final para: ${originalUrl}`);
    try {
        const response = await fetch(originalUrl, {
            method: 'GET',
            headers: requestHeaders,
            redirect: 'follow'
        });

        const finalUrl = response.url;
        debugLog(`URL resuelta a: ${finalUrl}`);
        
        const contentType = response.headers.get("content-type") || "";
        const isStreamContentType = contentType.includes("application/dash+xml") || contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("octet-stream");

        if (!isStreamContentType && !detectMimeType(finalUrl)) {
             debugLog(`URL resuelta ${finalUrl} no parece ser un stream (Content-Type: ${contentType}). Se usará de todas formas.`);
        }
        
        return finalUrl;
    } catch (error) {
        console.error("Error al resolver URL final:", error);
        return originalUrl;
    }
}

function formatShakaError(error, channelName = 'el canal') {
    let message = `Error en "${escapeHtml(channelName)}": `;
    if (error.code) message += `(Cód: ${error.code}) `;
    if (error.message) message += error.message;
    if (error.data && error.data.length > 0) message += ` Detalles: ${error.data.join(', ')}`;
    if (error.category) message += ` (Categoría: ${error.category})`;

    switch (error.code) {
        case shaka.util.Error.Code.LOAD_FAILED:
        case shaka.util.Error.Code.HTTP_ERROR:
            message += " Posibles causas: URL incorrecta, red, CORS, o servidor no responde.";
            break;
        default:
            if (error.category === shaka.util.Error.Category.DRM) {
                message += " Problema DRM: licencia inválida, servidor inaccesible o contenido protegido.";
            }
    }
    return message.length > 300 ? message.slice(0, 300) + '...' : message;
}

function validateShakaConfig(config) {
    if (!config || !config.streaming || !config.manifest) {
        throw new Error("Configuración de Shaka inválida: faltan claves esenciales (streaming, manifest).");
    }
    return true;
}

async function applyHttpHeaders(headersObject, urlFilter = null, initiatorDomain = null) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const dnrHeaders = [];
        for (const key in headersObject) {
            if (Object.hasOwnProperty.call(headersObject, key)) {
                dnrHeaders.push({ header: key, operation: 'set', value: String(headersObject[key]) });
            }
        }
        try {
            await new Promise((resolve, reject) => {
                const messagePayload = {
                    cmd: "updateHeadersRules",
                    requestHeaders: dnrHeaders
                };
                if (urlFilter) {
                    messagePayload.urlFilter = urlFilter;
                }
                if (initiatorDomain) {
                    messagePayload.initiatorDomain = initiatorDomain;
                }
                chrome.runtime.sendMessage(messagePayload, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(response ? response.error : 'Respuesta desconocida o fallida del background script');
                    }
                });
            });
            debugLog("Cabeceras DNR aplicadas:", dnrHeaders);
        } catch (error) {
            console.error("[Shaka ApplyHeaders] Error al actualizar las reglas de cabecera:", error);
            if (typeof showNotification === 'function') showNotification("Error al aplicar cabeceras de red: " + (error.message || error), "error");
        }
    } else {
        console.warn("[Shaka ApplyHeaders] API de Chrome runtime no disponible. Las cabeceras no serán aplicadas por la extensión.");
    }
}

function buildShakaConfig(channel, isPreview = false) {
    const kodiProps = channel.kodiProps || {};

    let config = {
        drm: {
            servers: {},
            clearKeys: {},
            advanced: {
                'com.widevine.alpha': { videoRobustness: ['SW_SECURE_CRYPTO'], audioRobustness: ['SW_SECURE_CRYPTO'] },
                'com.microsoft.playready': { videoRobustness: ['SW'], audioRobustness: ['SW'] }
            }
        },
        manifest: {
            retryParameters: {
                maxAttempts: isPreview ? 1 : safeParseInt(userSettings.manifestRetryMaxAttempts, 2),
                timeout: isPreview ? 5000 : safeParseInt(userSettings.manifestRetryTimeout, 15000)
            },
            defaultPresentationDelay: parseFloat(userSettings.shakaDefaultPresentationDelay),
            dash: {},
            hls: { ignoreTextStreamFailures: true }
        },
        streaming: {
            retryParameters: {
                maxAttempts: isPreview ? 1 : safeParseInt(userSettings.segmentRetryMaxAttempts, 2),
                timeout: isPreview ? 5000 : safeParseInt(userSettings.segmentRetryTimeout, 15000)
            },
            lowLatencyMode: userSettings.lowLatencyMode,
            liveSync: { enabled: userSettings.liveCatchUpMode },
            ignoreTextStreamFailures: true
        },
        abr: {
            enabled: !isPreview && userSettings.abrEnabled,
            defaultBandwidthEstimate: isPreview ? 500000 : safeParseInt(userSettings.abrDefaultBandwidthEstimate, 1000) * 1000,
            restrictions: {}
        },
        preferredAudioLanguage: userSettings.preferredAudioLanguage,
        preferredTextLanguage: userSettings.preferredTextLanguage,
    };

    if (isPreview) {
        config.abr.restrictions.maxHeight = 480;
        config.streaming.bufferingGoal = 5;
    } else {
        const channelBuffer = channel.attributes ? parseFloat(channel.attributes['player-buffer']) : NaN;
        config.streaming.bufferingGoal = !isNaN(channelBuffer) && channelBuffer >= 0 ? channelBuffer : safeParseInt(userSettings.playerBuffer, 30);
        const maxVideoHeight = safeParseInt(userSettings.maxVideoHeight, 0);
        if (maxVideoHeight > 0) {
            config.abr.restrictions.maxHeight = maxVideoHeight;
        }
    }
     if(Object.keys(config.abr.restrictions).length === 0) {
         delete config.abr.restrictions;
    }

    const licenseType = kodiProps['inputstream.adaptive.license_type']?.toLowerCase().trim();
    const licenseKey = kodiProps['inputstream.adaptive.license_key']?.trim();
    const serverCertB64 = kodiProps['inputstream.adaptive.server_certificate']?.trim();

    if (licenseType && licenseKey) {
        if (licenseType.includes('clearkey')) {
            const parsedClearKeys = parseClearKey(licenseKey);
            if (parsedClearKeys) config.drm.clearKeys = parsedClearKeys;
        } else if (licenseType.includes('widevine') || licenseType.includes('playready')) {
            const drmSystem = licenseType.includes('widevine') ? 'com.widevine.alpha' : 'com.microsoft.playready';
            if (licenseKey.match(/^https?:\/\//)) {
                config.drm.servers[drmSystem] = licenseKey;
                if (serverCertB64 && config.drm.advanced[drmSystem]) {
                    try {
                        config.drm.advanced[drmSystem].serverCertificate = shaka.util.Uint8ArrayUtils.fromBase64(serverCertB64);
                    } catch (e) { console.error(`[Shaka Play] Error parseando certificado ${drmSystem} (Base64): ${e.message}`); }
                }
            }
        }
    }

    if (Object.keys(config.drm.servers).length === 0 && Object.keys(config.drm.clearKeys).length === 0) {
        delete config.drm;
    }

    debugLog("Configuración de Shaka generada:", config);
    return config;
}

function updatePlayerConfigFromSettings(playerInstance) {
    if (!playerInstance) return;
    const channel = playerInstances[activePlayerId]?.channel || {};
    const config = buildShakaConfig(channel, false);
    validateShakaConfig(config);
    playerInstance.configure(config);

    const ui = playerInstances[activePlayerId]?.ui;
    if (ui) {
        ui.configure({
            fadeDelay: userSettings.persistentControls ? Infinity : 0
        });
    }
}

function getChannelHeaders(channel) {
    const requestHeaders = {};
    const kodiProps = channel.kodiProps || {};
    const vlcOpts = channel.vlcOptions || {};
    const extHttpHeaders = channel.extHttp || {};

    if (channel.sourceOrigin && channel.sourceOrigin.toLowerCase().startsWith('xtream')) {
        requestHeaders['User-Agent'] = 'VLC/3.0.20 (Linux; x86_64)';
    }

    if (vlcOpts['http-user-agent']) requestHeaders['User-Agent'] = vlcOpts['http-user-agent'];
    else if (userSettings.globalUserAgent && !requestHeaders['User-Agent']) requestHeaders['User-Agent'] = userSettings.globalUserAgent;

    if (vlcOpts['http-referrer']) requestHeaders['Referer'] = vlcOpts['http-referrer'];
    else if (userSettings.globalReferrer) requestHeaders['Referer'] = userSettings.globalReferrer;
    
    if (vlcOpts['http-origin']) requestHeaders['Origin'] = vlcOpts['http-origin'];

    try {
        const globalExtra = JSON.parse(userSettings.additionalGlobalHeaders || '{}');
        Object.assign(requestHeaders, globalExtra);
    } catch (e) { console.warn("Error parsing global headers", e); }
    
    Object.assign(requestHeaders, extHttpHeaders);
    
    const kodiStreamHeadersRaw = kodiProps['inputstream.adaptive.stream_headers'];
    if (kodiStreamHeadersRaw) {
        kodiStreamHeadersRaw.split('|').forEach(part => {
            const eqIndex = part.indexOf('=');
            if (eqIndex > 0) requestHeaders[part.substring(0, eqIndex).trim()] = part.substring(eqIndex + 1).trim();
        });
    }
    
    return requestHeaders;
}

async function playChannelInShaka(channel, windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.player) {
        if (typeof showNotification === 'function') showNotification('Instancia de reproductor no encontrada.', 'error');
        return;
    }
    if (!channel || typeof channel.url !== 'string') {
        console.warn("Canal inválido o sin URL:", channel);
        if (typeof showNotification === 'function') showNotification('Datos del canal inválidos.', 'error');
        return;
    }

    instance.channel = channel;
    
    const newTitle = channel.name || 'Advanced DRM Player';
    const titleElement = instance.container.querySelector('.player-window-title');
    if (titleElement) {
        titleElement.textContent = newTitle;
    }
    const taskbarItem = document.getElementById(`taskbar-item-${windowId}`);
    if (taskbarItem) {
        taskbarItem.title = newTitle;
        const taskbarText = taskbarItem.querySelector('.taskbar-item-text');
        if (taskbarText) {
            taskbarText.textContent = newTitle;
        }

        const iconContainer = taskbarItem.querySelector('.taskbar-item-icon-container');
        if (iconContainer) {
            const logoSrc = channel['tvg-logo'] || '';
            let iconHtml;
            if (logoSrc) {
                iconHtml = `<img src="${logoSrc}" class="taskbar-item-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                            <span class="taskbar-item-logo-placeholder" style="display: none;">${newTitle.charAt(0)}</span>`;
            } else {
                iconHtml = `<span class="taskbar-item-logo-placeholder">${newTitle.charAt(0)}</span>`;
            }
            iconContainer.innerHTML = iconHtml;
        }
    }
    if (document.title.includes("Advanced DRM Player")) {
       document.title = newTitle;
    }


    const player = instance.player;
    const videoElement = instance.videoElement;
    videoElement.poster = channel['tvg-logo'] || '';

    if (typeof showLoading === 'function') showLoading(true, `Cargando ${escapeHtml(channel.name)}...`);
    
    try {
        if (player.getMediaElement()) {
            await player.unload(true);
        }
        
        const requestHeadersForDNR = getChannelHeaders(channel);
        await applyHttpHeaders(requestHeadersForDNR, "*://*/*", chrome.runtime.id);
        
        const playerConfig = buildShakaConfig(channel, false);
        validateShakaConfig(playerConfig);
        player.configure(playerConfig);

        if (instance.errorHandler) {
            player.removeEventListener('error', instance.errorHandler);
        }
        const newErrorHandler = (e) => onShakaPlayerError(e, windowId);
        player.addEventListener('error', newErrorHandler);
        instance.errorHandler = newErrorHandler;

        const resolvedUrl = await resolveFinalUrl(channel.url, requestHeadersForDNR);
        if (!resolvedUrl) {
            throw new Error("No se pudo resolver la URL final del stream.");
        }
        channel.resolvedUrl = resolvedUrl;

        const mimeType = detectMimeType(resolvedUrl);
        await player.load(resolvedUrl, null, mimeType);
        
        if (typeof showPlayerInfobar === 'function') {
            showPlayerInfobar(channel, instance.container.querySelector('.player-infobar'));
        }
        
        if (typeof highlightCurrentChannelInList === 'function' && instance.isChannelListVisible) {
            highlightCurrentChannelInList(windowId);
        }

        if (typeof addToHistory === 'function') {
            addToHistory(channel);
        }

    } catch (e) {
        onShakaPlayerError({ detail: e, channelName: channel.name }, windowId);
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

function onShakaPlayerError(event, windowId) {
    const instance = playerInstances[windowId];
    const channelName = instance ? instance.channel.name : 'el canal';
    const error = event.detail;

    const finalMessage = formatShakaError(error, channelName);
    
    console.error("Player Error Event:", finalMessage, "Full error object:", event.detail);
    if (typeof showNotification === 'function') showNotification(finalMessage, 'error');
    if (typeof showLoading === 'function') showLoading(false);
}

async function playChannelInCardPreview(channel, videoContainerElement) {
    if (activeCardPreviewPlayer) {
        await destroyActiveCardPreviewPlayer();
    }
    if (!channel || !channel.url || !videoContainerElement) {
        return;
    }

    const videoElement = document.createElement('video');
    videoElement.className = 'card-preview-video';
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoContainerElement.innerHTML = '';
    videoContainerElement.appendChild(videoElement);
    
    activeCardPreviewPlayer = new shaka.Player();
    try {
        await activeCardPreviewPlayer.attach(videoElement);

        const requestHeadersForDNR = getChannelHeaders(channel);
        await applyHttpHeaders(requestHeadersForDNR, "*://*/*", chrome.runtime.id);
        
        const previewConfig = buildShakaConfig(channel, true);
        validateShakaConfig(previewConfig);
        await activeCardPreviewPlayer.configure(previewConfig);

        const resolvedUrl = await resolveFinalUrl(channel.url, requestHeadersForDNR);
        if (!resolvedUrl) {
            throw new Error("No se pudo resolver la URL final del stream para la previsualización.");
        }
        
        const mimeType = detectMimeType(resolvedUrl);
        await activeCardPreviewPlayer.load(resolvedUrl, null, mimeType);

        videoElement.play().catch(e => {
            if (e.name !== 'AbortError') {
                console.warn("Error al iniciar previsualización automática:", e);
            }
            destroyActiveCardPreviewPlayer();
        });

    } catch (error) {
        console.error("Error al cargar previsualización:", error);
        if (activeCardPreviewElement) activeCardPreviewElement.removeClass('is-playing-preview');
        activeCardPreviewElement = null;
        destroyActiveCardPreviewPlayer();
    }
}

async function destroyActiveCardPreviewPlayer() {
    if (activeCardPreviewPlayer) {
        try {
            await activeCardPreviewPlayer.destroy();
        } catch (e) {
            console.warn("Error destruyendo reproductor de previsualización:", e);
        }
        activeCardPreviewPlayer = null;
    }
    if (activeCardPreviewElement) {
        activeCardPreviewElement.removeClass('is-playing-preview');
        const previewContainer = activeCardPreviewElement.find('.card-video-preview-container');
        if(previewContainer.length) previewContainer.empty();
        activeCardPreviewElement = null;
    }
     await applyHttpHeaders([], "*://*/*", null);
}