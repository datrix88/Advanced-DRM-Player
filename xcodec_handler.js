const PRESET_XCODEC_PANELS = [
    { name: "Orange", serverUrl: "http://213.220.3.165/", apiToken: "iM4iIpjCWwNiOoL4EPEZV1xD" },
];

let xcodecUi = {
    manageModal: null,
    panelNameInput: null,
    panelServerUrlInput: null,
    panelApiTokenInput: null,
    editingPanelIdInput: null,
    savePanelBtn: null,
    clearFormBtn: null,
    processPanelBtn: null,
    processAllPanelsBtn: null,
    importPresetBtn: null,
    savedPanelsList: null,
    status: null,
    progressContainer: null,
    progressBar: null,
    previewModal: null,
    previewModalLabel: null,
    previewStats: null,
    previewGroupList: null,
    previewChannelList: null,
    previewSelectAllGroupsBtn: null,
    previewSelectAllChannelsInGroupBtn: null,
    addSelectedBtn: null,
    addAllValidBtn: null
};

let xcodecTotalApiCallsExpected = 0;
let xcodecApiCallsCompleted = 0;
let currentXCodecPanelDataForPreview = null;
let xcodecProcessedStreamsForPreview = [];

function initXCodecPanelManagement() {
    xcodecUi.manageModal = document.getElementById('manageXCodecPanelsModal');
    xcodecUi.panelNameInput = document.getElementById('xcodecPanelNameInput');
    xcodecUi.panelServerUrlInput = document.getElementById('xcodecPanelServerUrlInput');
    xcodecUi.panelApiTokenInput = document.getElementById('xcodecPanelApiTokenInput');
    xcodecUi.editingPanelIdInput = document.getElementById('xcodecEditingPanelIdInput');
    xcodecUi.savePanelBtn = document.getElementById('xcodecSavePanelBtn');
    xcodecUi.clearFormBtn = document.getElementById('xcodecClearFormBtn');
    xcodecUi.processPanelBtn = document.getElementById('xcodecProcessPanelBtn');
    xcodecUi.processAllPanelsBtn = document.getElementById('xcodecProcessAllPanelsBtn');
    xcodecUi.importPresetBtn = document.getElementById('xcodecImportPresetPanelsBtn');
    xcodecUi.savedPanelsList = document.getElementById('savedXCodecPanelsList');
    xcodecUi.status = document.getElementById('xcodecStatus');
    xcodecUi.progressContainer = document.getElementById('xcodecProgressContainer');
    xcodecUi.progressBar = document.getElementById('xcodecProgressBar');

    xcodecUi.previewModal = document.getElementById('xcodecPreviewModal');
    xcodecUi.previewModalLabel = document.getElementById('xcodecPreviewModalLabel');
    xcodecUi.previewStats = document.getElementById('xcodecPreviewStats');
    xcodecUi.previewGroupList = document.getElementById('xcodecPreviewGroupList');
    xcodecUi.previewChannelList = document.getElementById('xcodecPreviewChannelList');
    xcodecUi.previewSelectAllGroupsBtn = document.getElementById('xcodecPreviewSelectAllGroupsBtn');
    xcodecUi.previewSelectAllChannelsInGroupBtn = document.getElementById('xcodecPreviewSelectAllChannelsInGroupBtn');
    xcodecUi.addSelectedBtn = document.getElementById('xcodecAddSelectedBtn');
    xcodecUi.addAllValidBtn = document.getElementById('xcodecAddAllValidBtn');

    if (xcodecUi.savePanelBtn) xcodecUi.savePanelBtn.addEventListener('click', handleSaveXCodecPanel);
    if (xcodecUi.clearFormBtn) xcodecUi.clearFormBtn.addEventListener('click', clearXCodecPanelForm);
    if (xcodecUi.processPanelBtn) xcodecUi.processPanelBtn.addEventListener('click', () => processPanelFromForm(false));
    if (xcodecUi.processAllPanelsBtn) xcodecUi.processAllPanelsBtn.addEventListener('click', processAllSavedXCodecPanels);
    if (xcodecUi.importPresetBtn) xcodecUi.importPresetBtn.addEventListener('click', importPresetXCodecPanels);
    
    if (xcodecUi.previewSelectAllGroupsBtn) xcodecUi.previewSelectAllGroupsBtn.addEventListener('click', toggleAllGroupsInPreview);
    if (xcodecUi.previewSelectAllChannelsInGroupBtn) xcodecUi.previewSelectAllChannelsInGroupBtn.addEventListener('click', toggleAllChannelsInCurrentPreviewGroup);
    if (xcodecUi.addSelectedBtn) xcodecUi.addSelectedBtn.addEventListener('click', addSelectedXCodecStreamsToM3U);
    if (xcodecUi.addAllValidBtn) xcodecUi.addAllValidBtn.addEventListener('click', addAllValidXCodecStreamsToM3U);

    if (xcodecUi.savedPanelsList) {
        xcodecUi.savedPanelsList.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const panelId = parseInt(target.dataset.id, 10);
            if (target.classList.contains('load-xcodec-panel-btn')) {
                loadXCodecPanelToForm(panelId);
            } else if (target.classList.contains('delete-xcodec-panel-btn')) {
                handleDeleteXCodecPanel(panelId);
            } else if (target.classList.contains('process-xcodec-panel-direct-btn')) {
                loadXCodecPanelToForm(panelId).then(() => processPanelFromForm(true));
            }
        });
    }
    if (xcodecUi.previewGroupList) {
        xcodecUi.previewGroupList.addEventListener('click', (event) => {
            const groupItem = event.target.closest('.list-group-item');
            if (groupItem && groupItem.dataset.groupName) {
                const groupName = groupItem.dataset.groupName;
                renderXCodecPreviewChannels(groupName);
                xcodecUi.previewGroupList.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
                groupItem.classList.add('active');
                 xcodecUi.previewSelectAllChannelsInGroupBtn.disabled = false;
            }
        });
    }
    loadSavedXCodecPanels();
}

function xcodecUpdateStatus(message, type = 'info', modal = 'manage') {
    const statusEl = modal === 'manage' ? xcodecUi.status : xcodecUi.previewStats;
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'alert mt-2';
    statusEl.style.display = 'block';
    if (type) statusEl.classList.add(`alert-${type}`);
}

function xcodecResetProgress(expectedCalls = 0) {
    if (!xcodecUi) return;
    xcodecApiCallsCompleted = 0;
    xcodecTotalApiCallsExpected = expectedCalls;
    xcodecUi.progressBar.style.width = '0%';
    xcodecUi.progressBar.textContent = '0%';
    xcodecUi.progressContainer.style.display = expectedCalls > 0 ? 'block' : 'none';
}

function xcodecUpdateProgress() {
    if (!xcodecUi || xcodecTotalApiCallsExpected === 0) return;
    xcodecApiCallsCompleted++;
    const percentage = Math.min(100, Math.max(0, (xcodecApiCallsCompleted / xcodecTotalApiCallsExpected) * 100));
    xcodecUi.progressBar.style.width = percentage + '%';
    xcodecUi.progressBar.textContent = Math.round(percentage) + '%';
    if (percentage >= 100 && xcodecUi.progressContainer) {
         setTimeout(() => { if (xcodecUi.progressContainer) xcodecUi.progressContainer.style.display = 'none'; }, 1500);
    }
}

function xcodecSetControlsDisabled(disabled, modal = 'manage') {
    if (!xcodecUi) return;
    if (modal === 'manage') {
        xcodecUi.processPanelBtn.disabled = disabled;
        if (xcodecUi.processAllPanelsBtn) xcodecUi.processAllPanelsBtn.disabled = disabled;
        xcodecUi.panelServerUrlInput.disabled = disabled;
        xcodecUi.panelApiTokenInput.disabled = disabled;
        xcodecUi.savePanelBtn.disabled = disabled;
        xcodecUi.clearFormBtn.disabled = disabled;
        xcodecUi.importPresetBtn.disabled = disabled;

        const processBtnIcon = xcodecUi.processPanelBtn.querySelector('i');
        if (processBtnIcon) processBtnIcon.className = disabled ? 'fas fa-spinner fa-spin me-1' : 'fas fa-cogs me-1';
        
        const processAllBtnIcon = xcodecUi.processAllPanelsBtn ? xcodecUi.processAllPanelsBtn.querySelector('i') : null;
        if (processAllBtnIcon) processAllBtnIcon.className = disabled ? 'fas fa-spinner fa-spin me-1' : 'fas fa-tasks me-1';

    } else if (modal === 'preview') {
        xcodecUi.addSelectedBtn.disabled = disabled;
        xcodecUi.addAllValidBtn.disabled = disabled;
    }
}

function xcodecCleanUrl(url) {
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('decryption_key');
        return urlObj.toString();
    } catch (e) {
        return url.replace(/[?&]decryption_key=[^&]+/gi, '');
    }
}

function getXCodecProxiedApiEndpoint(targetServerBaseUrl, apiPath) {
    let base = targetServerBaseUrl.trim();
    if (!base.endsWith('/')) base += '/';
    let path = apiPath.trim();
    if (path.startsWith('/')) path = path.substring(1);
    const proxy = userSettings.xcodecCorsProxyUrl ? userSettings.xcodecCorsProxyUrl.trim() : '';
    if (proxy) {
        return proxy + base + path;
    }
    return base + path;
}

async function fetchXCodecWithTimeout(resource, options = {}, timeout) {
    const effectiveTimeout = timeout || userSettings.xcodecDefaultTimeout || 8000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), effectiveTimeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

async function getXCodecStreamStats(targetServerUrl, apiToken) {
    const apiUrl = getXCodecProxiedApiEndpoint(targetServerUrl, 'api/stream/stats');
    xcodecUpdateProgress();
    const headers = {};
    if (apiToken) headers['Authorization'] = `Token ${apiToken}`;
    try {
        const response = await fetchXCodecWithTimeout(apiUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const stats = await response.json();
        if (!Array.isArray(stats)) throw new Error("La respuesta de estadísticas no es un array.");
        return stats;
    } catch (error) {
        throw error;
    }
}

async function processXCodecStreamConfig(targetServerUrl, apiToken, streamId, streamNameFallback, serverHostForGroupTitle) {
    const apiUrl = getXCodecProxiedApiEndpoint(targetServerUrl, `api/stream/${streamId}/config`);
    const headers = {};
    if (apiToken) headers['Authorization'] = `Token ${apiToken}`;
    const DEFAULT_KID_FOR_JSON_SINGLE_KEY = "00000000000000000000000000000000";
    try {
        const response = await fetchXCodecWithTimeout(apiUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status} para config ${streamId}`);
        const config = await response.json();
        const streamName = config?.name || streamNameFallback || `Stream ${streamId}`;

        if (!config?.input_urls?.length) {
            return { error: `Stream ${streamId} (${streamName}) sin input_urls.` };
        }

        let kodiProps = {
            'inputstreamaddon': 'inputstream.adaptive',
            'inputstream.adaptive.manifest_type': 'mpd'
        };
        let vlcOpts = {};

        const urlWithKey = config.input_urls.find(u => /[?&]decryption_key=([^&]+)/i.test(u));
        if (urlWithKey) {
            const keyMatch = urlWithKey.match(/[?&]decryption_key=([^&]+)/i);
            if (keyMatch && keyMatch[1]) {
                const allKeyEntriesString = keyMatch[1];
                const keyEntriesArray = allKeyEntriesString.split(',');
                let licenseKeyStringForKodi = '';

                if (keyEntriesArray.length === 1) {
                    const singleEntry = keyEntriesArray[0].trim();
                    if (singleEntry.indexOf(':') === -1 && singleEntry.length === 32 && /^[0-9a-fA-F]{32}$/.test(singleEntry)) {
                        licenseKeyStringForKodi = singleEntry;
                    }
                }
                if (!licenseKeyStringForKodi) {
                    const licenseKeysObject = {};
                    let foundValidKeysForJson = false;
                    for (const entryStr of keyEntriesArray) {
                        const trimmedEntry = entryStr.trim();
                        if (!trimmedEntry) continue;
                        const parts = trimmedEntry.split(':');
                        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                            const kid = parts[0].trim();
                            const key = parts[1].trim();
                            if (kid.length === 32 && key.length === 32 && /^[0-9a-fA-F]+$/.test(kid) && /^[0-9a-fA-F]+$/.test(key)) {
                                licenseKeysObject[kid] = key;
                                foundValidKeysForJson = true;
                            }
                        } else if (parts.length === 1 && parts[0].trim()) {
                            const potentialKey = parts[0].trim();
                            if (potentialKey.length === 32 && /^[0-9a-fA-F]{32}$/.test(potentialKey)) {
                                licenseKeysObject[DEFAULT_KID_FOR_JSON_SINGLE_KEY] = potentialKey;
                                foundValidKeysForJson = true;
                            }
                        }
                    }
                    if (foundValidKeysForJson) {
                        licenseKeyStringForKodi = JSON.stringify(licenseKeysObject);
                    }
                }
                if (licenseKeyStringForKodi) {
                    kodiProps['inputstream.adaptive.license_type'] = 'clearkey';
                    kodiProps['inputstream.adaptive.license_key'] = licenseKeyStringForKodi;
                }
            }
        }

        if (config.headers) {
            try {
                const formattedHeaders = config.headers.split('&').map(p => {
                    const eq = p.indexOf('=');
                    return eq > -1 ? `${p.substring(0, eq).trim()}=${encodeURIComponent(p.substring(eq + 1).trim())}` : p.trim();
                }).join('&');
                kodiProps['inputstream.adaptive.stream_headers'] = formattedHeaders;
            } catch (e) {
            }
        }
        
        return {
            name: streamName,
            url: xcodecCleanUrl(config.input_urls[0]),
            'tvg-id': config.epg_id || `xcodec.${streamId}`,
            'tvg-logo': config.logo || '',
            'group-title': config.category_name || serverHostForGroupTitle || 'XCodec Streams',
            attributes: { duration: -1 },
            kodiProps: kodiProps,
            vlcOptions: vlcOpts,
            sourceOrigin: `XCodec: ${serverHostForGroupTitle}`
        };

    } catch (error) {
        return { error: `Fallo config Stream ${streamId} de ${targetServerUrl}: ${error.message}` };
    }
}

async function processSingleXCodecPanelLogic(panelData, directAdd, isPartOfBatchOperation) {
    let serverHostForGroupTitle;
    try {
        const urlObj = new URL(panelData.serverUrl);
        serverHostForGroupTitle = panelData.name || urlObj.hostname;
    } catch(e) {
        serverHostForGroupTitle = panelData.name || panelData.serverUrl;
    }
    const serverBaseUrl = panelData.serverUrl.endsWith('/') ? panelData.serverUrl : panelData.serverUrl + '/';
    
    if (!isPartOfBatchOperation) {
        xcodecUpdateStatus(`Iniciando panel: ${escapeHtml(panelData.name || panelData.serverUrl)}...`, 'info', 'manage');
    }
    
    xcodecResetProgress(1); 
    let streamStats;
    try {
        streamStats = await getXCodecStreamStats(serverBaseUrl, panelData.apiToken);
    } catch (error) {
        const errorMsg = `Error obteniendo estadísticas de ${serverHostForGroupTitle}: ${error.message}`;
        if (!isPartOfBatchOperation) {
            xcodecUpdateStatus(errorMsg, 'danger', 'manage');
            xcodecSetControlsDisabled(false, 'manage');
            xcodecResetProgress();
        }
        return { success: false, name: serverHostForGroupTitle, error: errorMsg, added: 0, errors: 1 };
    }
    
    if (!streamStats) { 
        if (!isPartOfBatchOperation) {
             xcodecUpdateStatus(`No se obtuvieron estadísticas de ${serverHostForGroupTitle}.`, 'warning', 'manage');
             xcodecSetControlsDisabled(false, 'manage');
             xcodecResetProgress();
        }
        return { success: false, name: serverHostForGroupTitle, error: "No stats returned", added: 0, errors: 1 };
    }

    if (streamStats.length === 0) {
        if (!isPartOfBatchOperation) {
            xcodecUpdateStatus(`No se encontraron streams activos en ${serverHostForGroupTitle}.`, 'info', 'manage');
            xcodecSetControlsDisabled(false, 'manage');
            xcodecResetProgress();
        }
        return { success: true, name: serverHostForGroupTitle, added: 0, errors: 0, message: "No active streams" };
    }
    
    if (directAdd && userSettings.xcodecIgnorePanelsOverStreams > 0 && streamStats.length > userSettings.xcodecIgnorePanelsOverStreams) {
        const ignoreMsg = `Panel ${serverHostForGroupTitle} ignorado: ${streamStats.length} streams (límite ${userSettings.xcodecIgnorePanelsOverStreams}).`;
        if (!isPartOfBatchOperation) {
            xcodecUpdateStatus(ignoreMsg, 'warning', 'manage');
            xcodecSetControlsDisabled(false, 'manage');
            xcodecResetProgress();
        }
        return { success: true, name: serverHostForGroupTitle, added: 0, errors: 0, message: ignoreMsg };
    }

    xcodecTotalApiCallsExpected = 1 + streamStats.length;
    if (!isPartOfBatchOperation) {
        xcodecUi.progressBar.textContent = Math.round((1 / xcodecTotalApiCallsExpected) * 100) + '%';
    }

    if (!isPartOfBatchOperation) {
        xcodecUpdateStatus(`Procesando ${streamStats.length} streams de ${serverHostForGroupTitle}...`, 'info', 'manage');
    }
    if (streamStats.length > 0) xcodecUi.progressContainer.style.display = 'block';

    const batchSize = userSettings.xcodecDefaultBatchSize || 15;
    let processedStreams = [];
    let streamsWithErrors = 0;

    for (let j = 0; j < streamStats.length; j += batchSize) {
        const batch = streamStats.slice(j, j + batchSize);
        const configPromises = batch.map(s =>
            processXCodecStreamConfig(serverBaseUrl, panelData.apiToken, s.id, s.name, serverHostForGroupTitle)
            .finally(() => xcodecUpdateProgress())
        );
        const batchResults = await Promise.allSettled(configPromises);

        batchResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value && !r.value.error) {
                processedStreams.push(r.value);
            } else {
                streamsWithErrors++;
            }
        });
    }
    
    currentXCodecPanelDataForPreview = panelData;
    xcodecProcessedStreamsForPreview = processedStreams;

    if (directAdd) {
        if (processedStreams.length > 0) {
            const m3uString = streamsToM3U(processedStreams, serverHostForGroupTitle);
            const sourceName = `XCodec: ${serverHostForGroupTitle}`;
            if (typeof removeChannelsBySourceOrigin === 'function') removeChannelsBySourceOrigin(sourceName);
            appendM3UContent(m3uString, sourceName);
            if (!isPartOfBatchOperation) {
                 showNotification(`${processedStreams.length} canales de "${escapeHtml(serverHostForGroupTitle)}" añadidos/actualizados.`, 'success');
            }
        }
        
        if (!isPartOfBatchOperation) {
            xcodecUpdateStatus(`Proceso completado. Streams OK: ${processedStreams.length}. Errores: ${streamsWithErrors}.`, 'success', 'manage');
            const manageModalInstance = bootstrap.Modal.getInstance(xcodecUi.manageModal);
            if (manageModalInstance) manageModalInstance.hide();
        }

    } else { 
        if (!isPartOfBatchOperation) {
            openXCodecPreviewModal(serverHostForGroupTitle, processedStreams.length, streamsWithErrors);
        }
    }
    
    if (!isPartOfBatchOperation) {
        xcodecSetControlsDisabled(false, 'manage');
    }
    return { success: true, name: serverHostForGroupTitle, added: processedStreams.length, errors: streamsWithErrors };
}

async function processPanelFromForm(directAdd = false) {
    if (!xcodecUi) return;
    const panelData = {
        id: xcodecUi.editingPanelIdInput.value ? parseInt(xcodecUi.editingPanelIdInput.value, 10) : null,
        name: xcodecUi.panelNameInput.value.trim(),
        serverUrl: xcodecUi.panelServerUrlInput.value.trim(),
        apiToken: xcodecUi.panelApiTokenInput.value.trim()
    };

    if (!panelData.serverUrl) {
        xcodecUpdateStatus('Por favor, introduce la URL del servidor X-UI/XC.', 'warning', 'manage');
        return;
    }
    try {
        new URL(panelData.serverUrl);
    } catch(e){
        xcodecUpdateStatus('La URL del servidor no es válida.', 'warning', 'manage');
        return;
    }
    if (!panelData.name) panelData.name = new URL(panelData.serverUrl).hostname;

    xcodecSetControlsDisabled(true, 'manage');
    try {
        await processSingleXCodecPanelLogic(panelData, directAdd, false);
    } catch (error) { 
        xcodecUpdateStatus(`Error procesando el panel ${escapeHtml(panelData.name)}: ${error.message}`, 'danger', 'manage');
        xcodecSetControlsDisabled(false, 'manage');
        xcodecResetProgress();
    }
}

async function processAllSavedXCodecPanels() {
    if (!xcodecUi) return;

    const userConfirmed = await showConfirmationModal(
        "Esto procesará TODOS los paneles XCodec guardados y añadirá sus streams directamente a la lista M3U actual. Esta operación puede tardar y añadir muchos canales. ¿Continuar?",
        "Confirmar Procesamiento Masivo de Paneles",
        "Sí, Procesar Todos",
        "btn-primary"
    );

    if (!userConfirmed) {
        xcodecUpdateStatus('Procesamiento masivo cancelado por el usuario.', 'info', 'manage');
        return;
    }

    xcodecSetControlsDisabled(true, 'manage');
    xcodecUpdateStatus('Iniciando procesamiento de todos los paneles guardados...', 'info', 'manage');
    
    let savedPanels;
    try {
        savedPanels = await getAllXCodecPanelsFromDB();
    } catch (error) {
        xcodecUpdateStatus(`Error al obtener paneles guardados: ${error.message}`, 'danger', 'manage');
        xcodecSetControlsDisabled(false, 'manage');
        return;
    }

    if (!savedPanels || savedPanels.length === 0) {
        xcodecUpdateStatus('No hay paneles guardados para procesar.', 'info', 'manage');
        xcodecSetControlsDisabled(false, 'manage');
        return;
    }

    let totalPanels = savedPanels.length;
    let panelsProcessedCount = 0;
    let totalStreamsAdded = 0;
    let totalErrorsAcrossPanels = 0;
    let panelsWithErrorsCount = 0;
    
    xcodecUi.progressContainer.style.display = 'block';

    for (const panel of savedPanels) {
        panelsProcessedCount++;
        const panelDisplayName = panel.name || panel.serverUrl;
        
        const overallPercentage = (panelsProcessedCount / totalPanels) * 100;
        xcodecUi.progressBar.style.width = overallPercentage + '%';
        xcodecUi.progressBar.textContent = `Panel ${panelsProcessedCount}/${totalPanels}`;
        
        xcodecUpdateStatus(`Procesando panel ${panelsProcessedCount} de ${totalPanels}: "${escapeHtml(panelDisplayName)}"`, 'info', 'manage');
        
        try {
            const result = await processSingleXCodecPanelLogic(panel, true, true); 
            if (result) {
                totalStreamsAdded += result.added || 0;
                if (!result.success || (result.errors || 0) > 0) {
                    panelsWithErrorsCount++;
                    totalErrorsAcrossPanels += result.errors || 0;
                }
            }
        } catch (error) { 
            xcodecUpdateStatus(`Error crítico procesando panel "${escapeHtml(panelDisplayName)}": ${error.message}. Saltando al siguiente.`, 'warning', 'manage');
            panelsWithErrorsCount++;
            totalErrorsAcrossPanels++; 
        }
    }

    xcodecUi.progressBar.style.width = '100%';
    xcodecUi.progressBar.textContent = `Completado ${totalPanels}/${totalPanels}`;
    setTimeout(() => {
        if (xcodecUi.progressContainer) xcodecUi.progressContainer.style.display = 'none';
        xcodecUi.progressBar.style.width = '0%';
        xcodecUi.progressBar.textContent = '0%';
    }, 3000);

    const summaryMessage = `Procesamiento masivo completado. ${panelsProcessedCount} paneles procesados. Total streams añadidos: ${totalStreamsAdded}. Paneles con errores: ${panelsWithErrorsCount}. Total errores individuales: ${totalErrorsAcrossPanels}.`;
    xcodecUpdateStatus(summaryMessage, 'success', 'manage');
    showNotification(summaryMessage, 'success', 10000);

    xcodecSetControlsDisabled(false, 'manage');
}


function streamsToM3U(streamsArray, panelName) {
    let m3u = '#EXTM3U\n';
    m3u += `# ----- Inicio Panel: ${panelName} -----\n\n`;
    streamsArray.forEach(ch => {
        m3u += `#EXTINF:-1 tvg-id="${ch['tvg-id']}" tvg-logo="${ch['tvg-logo']}" group-title="${ch['group-title']}",${ch.name}\n`;
        if (ch.kodiProps) {
            for (const key in ch.kodiProps) {
                m3u += `#KODIPROP:${key}=${ch.kodiProps[key]}\n`;
            }
        }
        m3u += `${ch.url}\n\n`;
    });
    m3u += `# ----- Fin Panel: ${panelName} -----\n\n`;
    return m3u;
}

function openXCodecPreviewModal(panelName, validCount, errorCount) {
    xcodecUi.previewModalLabel.textContent = `Previsualización Panel: ${escapeHtml(panelName)}`;
    xcodecUpdateStatus(`Streams válidos: ${validCount}. Con errores: ${errorCount}.`, 'info', 'preview');

    const groups = {};
    xcodecProcessedStreamsForPreview.forEach(stream => {
        const group = stream['group-title'] || 'Sin Grupo';
        if (!groups[group]) groups[group] = [];
        groups[group].push(stream);
    });

    xcodecUi.previewGroupList.innerHTML = '';
    const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    sortedGroupNames.forEach(groupName => {
        const groupItem = document.createElement('li');
        groupItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        groupItem.dataset.groupName = groupName;
        groupItem.style.cursor = 'pointer';
        groupItem.innerHTML = `
            <div class="form-check">
                <input class="form-check-input xcodec-group-checkbox" type="checkbox" value="${escapeHtml(groupName)}" id="groupCheck_${escapeHtml(groupName.replace(/\s+/g, ''))}" checked>
                <label class="form-check-label" for="groupCheck_${escapeHtml(groupName.replace(/\s+/g, ''))}">
                    ${escapeHtml(groupName)}
                </label>
            </div>
            <span class="badge bg-secondary rounded-pill">${groups[groupName].length}</span>
        `;
        xcodecUi.previewGroupList.appendChild(groupItem);
    });
    
    xcodecUi.previewChannelList.innerHTML = '<li class="list-group-item text-secondary text-center">Selecciona un grupo para ver los canales.</li>';
    xcodecUi.addSelectedBtn.disabled = false;
    xcodecUi.addAllValidBtn.disabled = validCount === 0;
    xcodecUi.previewSelectAllChannelsInGroupBtn.disabled = true;


    const previewModalInstance = bootstrap.Modal.getOrCreateInstance(xcodecUi.previewModal);
    previewModalInstance.show();
    const manageModalInstance = bootstrap.Modal.getInstance(xcodecUi.manageModal);
    if (manageModalInstance) manageModalInstance.hide();
}

function renderXCodecPreviewChannels(groupName) {
    xcodecUi.previewChannelList.innerHTML = '';
    const streamsInGroup = xcodecProcessedStreamsForPreview.filter(s => (s['group-title'] || 'Sin Grupo') === groupName);
    if (streamsInGroup.length === 0) {
        xcodecUi.previewChannelList.innerHTML = '<li class="list-group-item text-secondary text-center">No hay canales en este grupo.</li>';
        return;
    }
    streamsInGroup.forEach(stream => {
        const channelItem = document.createElement('li');
        channelItem.className = 'list-group-item';
        channelItem.innerHTML = `
            <div class="form-check">
                <input class="form-check-input xcodec-channel-checkbox" type="checkbox" value="${escapeHtml(stream.url)}" id="channelCheck_${escapeHtml(stream['tvg-id'].replace(/[^a-zA-Z0-9]/g, ''))}" checked data-group="${escapeHtml(groupName)}">
                <label class="form-check-label" for="channelCheck_${escapeHtml(stream['tvg-id'].replace(/[^a-zA-Z0-9]/g, ''))}" title="${escapeHtml(stream.name)} - ${escapeHtml(stream.url)}">
                    ${escapeHtml(stream.name)}
                </label>
            </div>
        `;
        xcodecUi.previewChannelList.appendChild(channelItem);
    });
}

function toggleAllGroupsInPreview() {
    const firstCheckbox = xcodecUi.previewGroupList.querySelector('.xcodec-group-checkbox');
    if (!firstCheckbox) return;
    const currentlyChecked = firstCheckbox.checked;
    xcodecUi.previewGroupList.querySelectorAll('.xcodec-group-checkbox').forEach(cb => cb.checked = !currentlyChecked);
    
    xcodecUi.previewChannelList.querySelectorAll('.xcodec-channel-checkbox').forEach(cb => cb.checked = !currentlyChecked);
}

function toggleAllChannelsInCurrentPreviewGroup() {
    const activeGroupItem = xcodecUi.previewGroupList.querySelector('.list-group-item.active');
    if (!activeGroupItem) return;
    const groupName = activeGroupItem.dataset.groupName;
    
    const firstChannelCheckboxInGroup = xcodecUi.previewChannelList.querySelector(`.xcodec-channel-checkbox[data-group="${escapeHtml(groupName)}"]`);
    if (!firstChannelCheckboxInGroup) return;
    const currentlyChecked = firstChannelCheckboxInGroup.checked;

    xcodecUi.previewChannelList.querySelectorAll(`.xcodec-channel-checkbox[data-group="${escapeHtml(groupName)}"]`).forEach(cb => {
        cb.checked = !currentlyChecked;
    });
}


function addSelectedXCodecStreamsToM3U() {
    const selectedStreams = [];
    const selectedGroupCheckboxes = xcodecUi.previewGroupList.querySelectorAll('.xcodec-group-checkbox:checked');
    const selectedGroups = Array.from(selectedGroupCheckboxes).map(cb => cb.value);

    xcodecUi.previewChannelList.querySelectorAll('.xcodec-channel-checkbox:checked').forEach(cb => {
        const streamUrl = cb.value;
        const streamGroup = cb.dataset.group;
        if (selectedGroups.includes(streamGroup)) {
             const streamData = xcodecProcessedStreamsForPreview.find(s => s.url === streamUrl && (s['group-title'] || 'Sin Grupo') === streamGroup);
            if (streamData) selectedStreams.push(streamData);
        }
    });
    
    if (selectedStreams.length > 0) {
        const panelName = currentXCodecPanelDataForPreview.name || new URL(currentXCodecPanelDataForPreview.serverUrl).hostname;
        const m3uString = streamsToM3U(selectedStreams, panelName);
        const sourceName = `XCodec: ${panelName}`;
        if (typeof removeChannelsBySourceOrigin === 'function') removeChannelsBySourceOrigin(sourceName);
        appendM3UContent(m3uString, sourceName);
        showNotification(`${selectedStreams.length} canales de "${escapeHtml(panelName)}" seleccionados y añadidos.`, 'success');
    } else {
        showNotification('No se seleccionaron canales para añadir.', 'info');
    }
    const previewModalInstance = bootstrap.Modal.getInstance(xcodecUi.previewModal);
    if (previewModalInstance) previewModalInstance.hide();
}

function addAllValidXCodecStreamsToM3U() {
     if (xcodecProcessedStreamsForPreview.length > 0) {
        const panelName = currentXCodecPanelDataForPreview.name || new URL(currentXCodecPanelDataForPreview.serverUrl).hostname;
        const m3uString = streamsToM3U(xcodecProcessedStreamsForPreview, panelName);
        const sourceName = `XCodec: ${panelName}`;
        if (typeof removeChannelsBySourceOrigin === 'function') removeChannelsBySourceOrigin(sourceName);
        appendM3UContent(m3uString, sourceName);
        showNotification(`${xcodecProcessedStreamsForPreview.length} canales válidos de "${escapeHtml(panelName)}" añadidos.`, 'success');
    } else {
        showNotification('No hay canales válidos para añadir.', 'info');
    }
    const previewModalInstance = bootstrap.Modal.getInstance(xcodecUi.previewModal);
    if (previewModalInstance) previewModalInstance.hide();
}

async function loadSavedXCodecPanels() {
    if (typeof showLoading === 'function') showLoading(true, 'Cargando paneles XCodec...');
    try {
        const panels = typeof getAllXCodecPanelsFromDB === 'function' ? await getAllXCodecPanelsFromDB() : [];
        xcodecUi.savedPanelsList.innerHTML = '';
        if (!panels || panels.length === 0) {
            xcodecUi.savedPanelsList.innerHTML = '<li class="list-group-item text-secondary text-center">No hay paneles guardados.</li>';
        } else {
            panels.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            panels.forEach(panel => {
                const panelDisplayName = panel.name || panel.serverUrl;
                const item = document.createElement('li');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                item.innerHTML = `
                    <div style="flex-grow: 1; margin-right: 0.5rem; overflow: hidden;">
                        <strong title="${escapeHtml(panelDisplayName)}">${escapeHtml(panelDisplayName)}</strong>
                        <small class="text-secondary d-block" style="font-size:0.75rem;">${escapeHtml(panel.serverUrl)}</small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary load-xcodec-panel-btn" data-id="${panel.id}" title="Cargar en formulario"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-primary process-xcodec-panel-direct-btn" data-id="${panel.id}" title="Procesar y Añadir Todo Directamente"><i class="fas fa-bolt"></i></button>
                        <button class="btn btn-outline-danger delete-xcodec-panel-btn" data-id="${panel.id}" title="Eliminar panel"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                xcodecUi.savedPanelsList.appendChild(item);
            });
        }
    } catch (error) {
        showNotification(`Error cargando paneles XCodec: ${error.message}`, 'error');
        xcodecUi.savedPanelsList.innerHTML = '<li class="list-group-item text-danger text-center">Error al cargar paneles.</li>';
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function handleSaveXCodecPanel() {
    const panelData = {
        id: xcodecUi.editingPanelIdInput.value ? parseInt(xcodecUi.editingPanelIdInput.value, 10) : null,
        name: xcodecUi.panelNameInput.value.trim(),
        serverUrl: xcodecUi.panelServerUrlInput.value.trim(),
        apiToken: xcodecUi.panelApiTokenInput.value.trim()
    };

    if (!panelData.serverUrl) {
        showNotification('La URL del Servidor es obligatoria.', 'warning');
        return;
    }
    try {
        new URL(panelData.serverUrl);
    } catch(e){
        showNotification('La URL del servidor no es válida.', 'warning');
        return;
    }
    if (!panelData.name) panelData.name = new URL(panelData.serverUrl).hostname;


    if (typeof showLoading === 'function') showLoading(true, `Guardando panel XCodec: ${escapeHtml(panelData.name)}...`);
    try {
        await saveXCodecPanelToDB(panelData);
        showNotification(`Panel XCodec "${escapeHtml(panelData.name)}" guardado.`, 'success');
        loadSavedXCodecPanels();
        clearXCodecPanelForm();
    } catch (error) {
        showNotification(`Error al guardar panel: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

function clearXCodecPanelForm() {
    xcodecUi.editingPanelIdInput.value = '';
    xcodecUi.panelNameInput.value = '';
    xcodecUi.panelServerUrlInput.value = '';
    xcodecUi.panelApiTokenInput.value = '';
    xcodecUi.panelNameInput.focus();
}

async function loadXCodecPanelToForm(id) {
    if (typeof showLoading === 'function') showLoading(true, "Cargando datos del panel...");
    try {
        const panel = await getXCodecPanelFromDB(id);
        if (panel) {
            xcodecUi.editingPanelIdInput.value = panel.id;
            xcodecUi.panelNameInput.value = panel.name || '';
            xcodecUi.panelServerUrlInput.value = panel.serverUrl || '';
            xcodecUi.panelApiTokenInput.value = panel.apiToken || '';
            showNotification(`Datos del panel "${escapeHtml(panel.name || panel.serverUrl)}" cargados.`, 'info');
        } else {
            showNotification('Panel no encontrado.', 'error');
        }
    } catch (error) {
        showNotification(`Error al cargar panel: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function handleDeleteXCodecPanel(id) {
    const panelToDelete = await getXCodecPanelFromDB(id);
    const panelName = panelToDelete ? (panelToDelete.name || panelToDelete.serverUrl) : 'este panel';

    if (!confirm(`¿Seguro que quieres eliminar el panel XCodec "${escapeHtml(panelName)}"?`)) return;
    if (typeof showLoading === 'function') showLoading(true, `Eliminando panel "${escapeHtml(panelName)}"...`);
    try {
        await deleteXCodecPanelFromDB(id);
        showNotification(`Panel XCodec "${escapeHtml(panelName)}" eliminado.`, 'success');
        loadSavedXCodecPanels();
        if (xcodecUi.editingPanelIdInput.value === String(id)) {
            clearXCodecPanelForm();
        }
    } catch (error) {
        showNotification(`Error al eliminar panel: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function importPresetXCodecPanels() {
    if (!confirm(`¿Quieres importar ${PRESET_XCODEC_PANELS.length} paneles predefinidos a tu lista? Esto no sobrescribirá los existentes con la misma URL.`)) return;
    if (typeof showLoading === 'function') showLoading(true, "Importando paneles predefinidos...");
    let importedCount = 0;
    let skippedCount = 0;
    try {
        const existingPanels = await getAllXCodecPanelsFromDB();
        const existingUrls = new Set(existingPanels.map(p => p.serverUrl));

        for (const preset of PRESET_XCODEC_PANELS) {
            if (!existingUrls.has(preset.serverUrl)) {
                await saveXCodecPanelToDB(preset);
                importedCount++;
            } else {
                skippedCount++;
            }
        }
        showNotification(`Importación completada: ${importedCount} paneles añadidos, ${skippedCount} omitidos (ya existían).`, 'success');
        loadSavedXCodecPanels();
    } catch (error) {
        showNotification(`Error importando paneles: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}