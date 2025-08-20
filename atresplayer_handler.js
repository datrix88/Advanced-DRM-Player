const ATRESPLAYER_USER_AGENT = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 4.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.1 Chrome/56.0.2924.0 TV Safari/537.36';
const ATRESPLAYER_INITIAL_URL = "https://api.atresplayer.com/client/v1/row/live/5a6b32667ed1a834493ec03b";
const ATRESPLAYER_API_HOST = "api.atresplayer.com";

async function setGlobalAtresplayerHeaders() {
    if (!chrome.runtime?.id) return false;
    const headersToSet = [{ header: 'User-Agent', value: ATRESPLAYER_USER_AGENT }];
    try {
        await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                cmd: "updateHeadersRules",
                requestHeaders: headersToSet,
                urlFilter: `*://${ATRESPLAYER_API_HOST}/*`,
                initiatorDomain: chrome.runtime.id
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(response ? response.error : 'Fallo al actualizar reglas DNR para Atresplayer.');
                }
            });
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        return true;
    } catch (error) {
        console.error("[Atresplayer] Error estableciendo cabeceras dinámicas globales:", error);
        if (typeof showNotification === 'function') showNotification("Error configurando cabeceras de red para Atresplayer.", "error");
        return false;
    }
}

async function clearGlobalAtresplayerHeaders() {
    if (!chrome.runtime?.id) return;
    try {
        await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ cmd: "clearAllDnrHeaders" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(response ? response.error : 'Fallo al limpiar reglas DNR tras Atresplayer.');
                }
            });
        });
    } catch (error) {
        console.error("[Atresplayer] Error limpiando cabeceras dinámicas globales:", error);
    }
}

async function fetchAtresplayerJSON(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            let errorBody = '';
            try { errorBody = await response.text(); } catch (e) {}
            console.error(`Error fetch Atresplayer JSON (${url}): ${response.status} ${response.statusText}`, errorBody.substring(0,200));
            throw new Error(`Error HTTP ${response.status} para ${url}. ${errorBody.substring(0,100)}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Excepción fetch/parse Atresplayer JSON (${url}):`, error);
        throw error;
    }
}

async function getChannelDetails(item) {
    try {
        const channelDetail = await fetchAtresplayerJSON(item.link.href);
        if (channelDetail && channelDetail.urlVideo) {
            const urlParts = item.link.url.split('/');
            const extractedChannelId = urlParts.length > 2 ? urlParts[urlParts.length - 2] : null;
            let logoUrl = item.logoURL || '';
            if (!logoUrl && item.image && item.image.images) {
                if (item.image.images.VERTICAL && item.image.images.VERTICAL.path) {
                    logoUrl = item.image.images.VERTICAL.path + "ws_275_403.png";
                } else if (item.image.images.HORIZONTAL && item.image.images.HORIZONTAL.path) {
                     logoUrl = item.image.images.HORIZONTAL.path + "ws_378_213.png";
                }
            }
            return {
                title: item.title || 'Desconocido',
                tvgId: item.mainChannel || item.contentId || (extractedChannelId ? `atres.${extractedChannelId}` : `atres.${item.title.replace(/\s+/g, '_').toLowerCase()}`),
                logo: logoUrl,
                description: item.description || '',
                urlVideoPage: channelDetail.urlVideo,
                channelKey: extractedChannelId || item.title.toLowerCase().replace(/[^a-z0-9]/g,'')
            };
        }
    } catch (e) {
        console.warn(`Error obteniendo detalles para el canal "${item.title || 'Desconocido'}":`, e.message);
    }
    return null;
}

async function getM3u8Source(channelInfo) {
    if (!channelInfo || !channelInfo.urlVideoPage) return null;
    try {
        const videoSourceData = await fetchAtresplayerJSON(channelInfo.urlVideoPage);
        if (videoSourceData && videoSourceData.sourcesLive && Array.isArray(videoSourceData.sourcesLive)) {
            const hlsSource = videoSourceData.sourcesLive.find(
                source => source.type === 'application/hls+legacy' && source.src
            );
            if (hlsSource) {
                return { ...channelInfo, m3u8Url: hlsSource.src };
            }
        }
    } catch (e) {
        console.warn(`Error obteniendo fuente M3U8 para "${channelInfo.title}":`, e.message);
    }
    return null;
}


async function generateM3UAtresplayer() {
    if (typeof showLoading === 'function') showLoading(true, "Cargando canales de Atresplayer...");
    const m3uLines = ["#EXTM3U"];
    let headersSetSuccessfully = false;
    const atresSourceName = "Atresplayer";

    try {
        headersSetSuccessfully = await setGlobalAtresplayerHeaders();
        if (!headersSetSuccessfully) {
            throw new Error("No se pudieron establecer las cabeceras globales para Atresplayer.");
        }

        const initialData = await fetchAtresplayerJSON(ATRESPLAYER_INITIAL_URL);
        if (!initialData || !initialData.itemRows || !Array.isArray(initialData.itemRows)) {
            throw new Error("Respuesta inicial de Atresplayer inválida o vacía.");
        }

        const liveChannelItems = initialData.itemRows.filter(
            item => item.link && item.link.pageType === 'LIVE_CHANNEL' && item.link.href
        );

        if (liveChannelItems.length === 0) {
            throw new Error("No se encontraron items de canal en vivo en la respuesta inicial.");
        }

        if (typeof showLoading === 'function') showLoading(true, `Obteniendo detalles de ${liveChannelItems.length} canales...`);

        const channelDetailsPromises = liveChannelItems.map(item => getChannelDetails(item));
        const channelsWithDetails = (await Promise.all(channelDetailsPromises)).filter(Boolean);

        if (channelsWithDetails.length === 0) {
            throw new Error("No se pudieron obtener detalles para ningún canal.");
        }
        if (typeof showLoading === 'function') showLoading(true, `Obteniendo URLs M3U8 para ${channelsWithDetails.length} canales...`);

        const m3u8SrcPromises = channelsWithDetails.map(channelInfo => getM3u8Source(channelInfo));
        const finalChannelData = (await Promise.all(m3u8SrcPromises)).filter(Boolean);

        if (finalChannelData.length === 0) {
            throw new Error("No se pudieron obtener URLs M3U8 para ningún canal.");
        }

        finalChannelData.forEach(ch => {
            m3uLines.push(`#EXTINF:-1 tvg-id="${ch.tvgId}" tvg-logo="${ch.logo}" group-title="Atresplayer",${ch.title}`);
            m3uLines.push(ch.m3u8Url);
        });

        const m3uString = m3uLines.join("\n") + "\n";

        if (typeof removeChannelsBySourceOrigin === 'function') {
             removeChannelsBySourceOrigin(atresSourceName);
        }

        if (typeof appendM3UContent === 'function') {
            appendM3UContent(m3uString, atresSourceName);
        } else {
            console.error("appendM3UContent no encontrada. Usando fallback processM3UContent.");
            processM3UContent(m3uString, atresSourceName, true);
        }

    } catch (error) {
        console.error("Error generando M3U de Atresplayer:", error);
        if (typeof showNotification === 'function') showNotification(`Error cargando Atresplayer: ${error.message}`, 'error');
    } finally {
        if (headersSetSuccessfully) {
            await clearGlobalAtresplayerHeaders();
        }
        if (typeof showLoading === 'function') showLoading(false);
    }
}