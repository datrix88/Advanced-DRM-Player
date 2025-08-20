let channels = [];
let favorites = [];
let appHistory = [];
let currentFilter = 'all';
let currentPage = 1;
let currentM3UContent = null;
let currentM3UName = null;
let notificationTimeout = null;
let currentGroupOrder = [];
let selectedMovistarLongTokenIdForSettings = null;
let currentView = { type: 'main' };
let navigationHistory = [];

let playerInstances = {};
let activePlayerId = null;
let highestZIndex = 1950;

let hoverPlayTimeout = null;
const HOVER_PLAY_DELAY = 700;
let activeCardPreviewPlayer = null;
let activeCardPreviewElement = null;

let currentTranslations = {};

async function loadLanguage(lang) {
    try {
        const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
        if (!response.ok) throw new Error(`Could not load ${lang}.json`);
        const messages = await response.json();
        currentTranslations = {};
        for (const key in messages) {
            if (Object.hasOwnProperty.call(messages, key)) {
                currentTranslations[key] = messages[key].message;
            }
        }
        document.documentElement.lang = lang;
    } catch (error) {
        console.error("Error loading language file:", error);
        if (lang !== 'es') {
            await loadLanguage('es');
        }
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        const message = currentTranslations[key];

        if (message) {
            let finalMessage = message;
            if (element.hasAttribute('data-lang-vars')) {
                try {
                    const varsAttr = element.getAttribute('data-lang-vars');
                    const vars = JSON.parse(varsAttr);
                    for (const varKey in vars) {
                        const selector = vars[varKey];
                        const varElement = document.querySelector(selector);
                        if (varElement) {
                            finalMessage = finalMessage.replace(`{${varKey}}`, varElement.innerHTML);
                        }
                    }
                } catch(e) { console.error(`Error parsing data-lang-vars for key ${key}:`, e)}
            }
            
            const attr = element.getAttribute('data-lang-attr');
            if (attr) {
                element.setAttribute(attr, finalMessage);
            } else {
                element.innerHTML = finalMessage;
            }
        }
    });
}

async function showLoadFromDBModal() {
    if (typeof dbPromise === 'undefined' || !dbPromise) {
        showLoading(true, currentTranslations['loading'] || 'Iniciando base de datos local...');
        try { if (typeof openDB === 'function') await openDB(); } catch (error) { showNotification(`Error DB: ${error.message}`, 'error'); showLoading(false); return; }
        finally { showLoading(false); }
    }
    showLoading(true, currentTranslations['loadingLists'] || 'Cargando listas guardadas...');
    try {
        const files = typeof getAllFilesFromDB === 'function' ? await getAllFilesFromDB() : [];
        const $list = $('#dbFilesList').empty();
        if (!files || files.length === 0) {
            $list.append(`<li class="list-group-item text-secondary text-center">${currentTranslations['noFileLoaded'] || "No hay listas guardadas."}</li>`);
        } else {
            files.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            files.forEach(file => {
                const date = file.timestamp ? new Date(file.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Fecha desconocida';
                const time = file.timestamp ? new Date(file.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit'}) : '';
                const count = typeof file.channelCount === 'number' ? file.channelCount : (typeof countChannels === 'function' ? countChannels(file.content) : 0);
                $list.append(`
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div style="flex-grow: 1; margin-right: 1rem; overflow: hidden;">
                        <strong title="${escapeHtml(file.name)}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(file.name)}</strong>
                        <small class="text-secondary">${count} canales | ${date} ${time}</small>
                    </div>
                    <div>
                        <button class="btn-control btn-sm load-file-btn me-2" data-name="${escapeHtml(file.name)}">${currentTranslations['loadButton'] || "Cargar"}</button>
                        <button class="btn-control btn-sm delete-file-btn" data-name="${escapeHtml(file.name)}"></button>
                    </div>
                </li>`);
            });
            $list.off('click', '.load-file-btn').on('click', '.load-file-btn', function () { loadFileToPlayer($(this).data('name')); $('#loadFromDBModal').modal('hide'); });
            $list.off('click', '.delete-file-btn').on('click', '.delete-file-btn', function () { handleDeleteFromDB($(this).data('name')); });
        }
        $('#loadFromDBModal').modal('show');
    } catch (error) {
        showNotification(`Error cargando listas guardadas: ${error.message}`, 'error');
        $('#dbFilesList').empty().append('<li class="list-group-item text-danger text-center">Error al cargar listas.</li>');
    }
    finally { showLoading(false); }
}

async function loadFileToPlayer(name) {
    showLoading(true, `Cargando "${escapeHtml(name)}" desde BD...`);
    currentGroupOrder = [];
    try {
        const file = typeof getFileFromDB === 'function' ? await getFileFromDB(name) : null;
        if (!file || !file.content) throw new Error('Lista no encontrada en la base de datos.');
        processM3UContent(file.content, file.name, true);

        if (userSettings.autoSaveM3U) {
            if (file.content.length < 4 * 1024 * 1024) {
                await saveAppConfigValue('lastM3UFileContent', file.content);
                await saveAppConfigValue('lastM3UFileName', file.name);
                await deleteAppConfigValue('lastM3UUrl');
                await deleteAppConfigValue('currentXtreamServerInfo');
            } else {
                await deleteAppConfigValue('lastM3UFileContent');
                await deleteAppConfigValue('lastM3UFileName');
                await deleteAppConfigValue('lastM3UUrl');
                await deleteAppConfigValue('currentXtreamServerInfo');
                showNotification('Lista cargada pero demasiado grande para guardado automático futuro.', 'info');
            }
        }
        showNotification(`Lista "${escapeHtml(name)}" cargada (${channels.length} canales).`, 'success');
    } catch (error) {
        showNotification(`Error cargando "${escapeHtml(name)}": ${error.message}`, 'error');
        channels = []; currentM3UContent = null; currentM3UName = null; currentGroupOrder = [];
        filterAndRenderChannels();
    } finally { showLoading(false); }
}

async function handleDeleteFromDB(name) {
    const confirmed = await showConfirmationModal(`¿Estás seguro de eliminar la lista "${escapeHtml(name)}" de forma permanente?`, "Confirmar Eliminación", "Sí, Eliminar", "btn-danger");
    if (!confirmed) return;
    
    showLoading(true, `Eliminando "${escapeHtml(name)}"...`);
    try {
        if (typeof deleteFileFromDB === 'function') await deleteFileFromDB(name); else throw new Error("deleteFileFromDB no definido");
        showNotification(`Lista "${escapeHtml(name)}" eliminada.`, 'success');
        $(`#dbFilesList li button[data-name="${escapeHtml(name)}"]`).closest('li').fadeOut(300, function() {
            $(this).remove();
            if ($('#dbFilesList li').length === 0) {
                $('#dbFilesList').append(`<li class="list-group-item text-secondary text-center">${currentTranslations['noFileLoaded'] || "No hay listas guardadas."}</li>`);
            }
        });

        const lastM3UFileName = await getAppConfigValue('lastM3UFileName');
        if (lastM3UFileName === name) {
            channels = []; currentM3UContent = null; currentM3UName = null; currentGroupOrder = [];
            filterAndRenderChannels();
            await deleteAppConfigValue('lastM3UFileContent');
            await deleteAppConfigValue('lastM3UFileName');
            showNotification('La lista actualmente cargada fue eliminada.', 'info');
        }
    } catch (error) {
        showNotification(`Error al eliminar "${escapeHtml(name)}": ${error.message}`, 'error');
    }
    finally { showLoading(false); }
}

$(document).ready(async function () {
    shaka.polyfill.installAll();
    if (typeof loadUserSettings === 'function') {
        await loadUserSettings();
    }
    if (typeof applyUISettings === 'function') {
        await applyUISettings();
    }
    
    makeWindowsDraggableAndResizable();
    bindEvents();
    if (typeof bindEpgEvents === 'function') {
        bindEpgEvents();
    }
     if (typeof MovistarTokenHandler !== 'undefined' && typeof MovistarTokenHandler.setLogCallback === 'function') {
        MovistarTokenHandler.setLogCallback(logToMovistarSettingsUI);
        loadAndDisplayInitialMovistarStatus();
        setInterval(async () => {
            const status = await window.MovistarTokenHandler.getShortTokenStatus();
            updateMovistarTokenStatusButton(status.expiry);
        }, 60000); // Update every minute
    }
    if (typeof initXCodecPanelManagement === 'function') {
        initXCodecPanelManagement();
    }
    if (typeof phpGenerator !== 'undefined' && typeof phpGenerator.init === 'function') {
        phpGenerator.init();
    }


    if (userSettings.persistFilters && userSettings.lastSelectedFilterTab) {
        currentFilter = userSettings.lastSelectedFilterTab;
    }
    updateActiveFilterButton();
    checkIfChannelsExist();

    const urlParams = new URLSearchParams(window.location.search);
    const channelNameFromUrl = urlParams.get('name');
    const channelStreamUrl = urlParams.get('url');
    const autoPlayFromUrl = (channelNameFromUrl && channelStreamUrl);

    if (autoPlayFromUrl) {
        showNotification(`Cargando ${escapeHtml(channelNameFromUrl)} desde editor...`, 'info');
        const channelDataForPlayer = {
            name: channelNameFromUrl,
            url: channelStreamUrl,
            'tvg-logo': urlParams.get('logo') || '',
            'tvg-id': urlParams.get('tvgid') || '',
            'group-title': urlParams.get('group') || 'Externo',
            attributes: {
                'tvg-id': urlParams.get('tvgid') || '',
                'tvg-logo': urlParams.get('logo') || '',
                'group-title': urlParams.get('group') || 'Externo',
                'ch-number': urlParams.get('chnumber') || '',
                ...(urlParams.has('player-buffer') && { 'player-buffer': urlParams.get('player-buffer') })
            },
            kodiProps: {}, vlcOptions: {}, extHttp: {}
        };

        const licenseType = urlParams.get('licenseType');
        const licenseKey = urlParams.get('licenseKey');
        const serverCertBase64 = urlParams.get('serverCert');

        if (licenseType) channelDataForPlayer.kodiProps['inputstream.adaptive.license_type'] = licenseType;
        if (licenseKey) channelDataForPlayer.kodiProps['inputstream.adaptive.license_key'] = licenseKey;
        if (serverCertBase64) channelDataForPlayer.kodiProps['inputstream.adaptive.server_certificate'] = serverCertBase64;

        const streamHeaders = urlParams.get('streamHeaders');
        if (streamHeaders) channelDataForPlayer.kodiProps['inputstream.adaptive.stream_headers'] = streamHeaders;

        const userAgent = urlParams.get('userAgent');
        const referrer = urlParams.get('referrer');
        const origin = urlParams.get('origin');
        if (userAgent) channelDataForPlayer.vlcOptions['http-user-agent'] = userAgent;
        if (referrer) channelDataForPlayer.vlcOptions['http-referrer'] = referrer;
        if (origin) channelDataForPlayer.vlcOptions['http-origin'] = origin;

        const extHttpJson = urlParams.get('extHttp');
        if (extHttpJson) {
            try { channelDataForPlayer.extHttp = JSON.parse(extHttpJson); } catch (e) { }
        }

        if (typeof createPlayerWindow === 'function') {
            createPlayerWindow(channelDataForPlayer);
        }

    } else {
        await loadLastM3U(); 
         if (userSettings.useMovistarVodAsEpg && typeof updateEpgWithMovistarVodData === 'function') {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            await updateEpgWithMovistarVodData(`${yyyy}-${mm}-${dd}`);
        }
        if (typeof startDynamicEpgUpdaters === 'function') {
            startDynamicEpgUpdaters();
        }
        setTimeout(() => {
            $(window).one('scroll mousemove touchstart', initParticles);
            setTimeout(initParticles, 5000);
        }, 100);
    }
});

function launchEditor() {
    if (!channels || channels.length === 0) {
        showNotification("No hay ninguna lista M3U cargada para editar.", "warning");
        return;
    }
    if (typeof editorHandler === 'undefined' || typeof editorHandler.init !== 'function') {
        showNotification("El módulo del editor no está disponible.", "error");
        return;
    }
    
    editorHandler.init(channels, currentM3UName);
    
    const editorModal = new bootstrap.Modal(document.getElementById('editorModal'));
    editorModal.show();
}

async function handleChannelCardClick(event) {
    if ($(event.target).closest('.favorite-btn').length && userSettings.cardShowFavButton) {
        return;
    }

    clearTimeout(hoverPlayTimeout);
    if (typeof destroyActiveCardPreviewPlayer === 'function' && typeof activeCardPreviewPlayer !== 'undefined' && activeCardPreviewPlayer) {
        await destroyActiveCardPreviewPlayer();
    }

    const card = $(this);
    let channelUrl, seriesChannel, seasonData, episodeData;

    try {
        const seasonDataAttr = card.data('season-data');
        if (seasonDataAttr) {
            seasonData = (typeof seasonDataAttr === 'string') ? JSON.parse(seasonDataAttr) : seasonDataAttr;
            const episodes = await loadXtreamSeasonEpisodes(seasonData.series_id, seasonData.season_number);
            if (episodes && episodes.length > 0) {
                pushNavigationState();
                currentView = { type: 'episode_list', data: episodes, title: `${seasonData['group-title']} - ${seasonData.name}` };
                renderCurrentView();
            } else {
                showNotification('No se encontraron episodios para esta temporada.', 'info');
            }
            return;
        }

        const episodeDataAttr = card.data('episode-data');
        if (episodeDataAttr) {
            episodeData = (typeof episodeDataAttr === 'string') ? JSON.parse(episodeDataAttr) : episodeDataAttr;
            createPlayerWindow(episodeData);
            return;
        }

        channelUrl = card.data('url');
        seriesChannel = channels.find(c => c.url === channelUrl);
        if (seriesChannel && seriesChannel.attributes && seriesChannel.attributes['xtream-type'] === 'series') {
            const seriesId = seriesChannel.attributes['xtream-series-id'];
            const seasons = await loadXtreamSeasons(seriesId, seriesChannel.name);
            if (seasons && seasons.length > 0) {
                pushNavigationState();
                currentView = { type: 'season_list', data: seasons, title: seriesChannel.name };
                renderCurrentView();
            } else {
                showNotification('No se encontraron temporadas para esta serie.', 'info');
            }
            return;
        }

        if (seriesChannel) {
            const isMovistarStream = seriesChannel.url && (seriesChannel.url.toLowerCase().includes('telefonica.com') || seriesChannel.url.toLowerCase().includes('movistarplus.es'));
            const existingMovistarWindow = isMovistarStream 
                ? Object.values(playerInstances).find(inst => 
                    inst.channel && 
                    (inst.channel.url.toLowerCase().includes('telefonica.com') || inst.channel.url.toLowerCase().includes('movistarplus.es'))
                  )
                : null;

            if (existingMovistarWindow) {
                const existingId = Object.keys(playerInstances).find(key => playerInstances[key] === existingMovistarWindow);
                if (existingId) {
                    showNotification("Reutilizando la ventana de Movistar+ para el nuevo canal.", "info");
                    playChannelInShaka(seriesChannel, existingId);
                    const instance = playerInstances[existingId];
                    instance.container.querySelector('.player-window-title').textContent = seriesChannel.name;
                    setActivePlayer(existingId);
                }
            } else {
                createPlayerWindow(seriesChannel);
            }
        } else {
            showNotification('Error: Canal no encontrado para reproducir.', 'error');
        }

    } catch (e) {
        showNotification('Error al procesar la acción: ' + e.message, 'error');
    }
}

function handleGlobalKeyPress(e) {
    if (!activePlayerId || !playerInstances[activePlayerId]) return;

    const instance = playerInstances[activePlayerId];
    if (instance.container.style.display === 'none') return;
    
    const player = instance.player;
    const ui = instance.ui;
    const video = instance.videoElement;

    if (!video) return;

    if ($(e.target).is('input, textarea, [contenteditable="true"], .shaka-text-input')) return;
    
    let currentChannelIndex = -1;
    const currentFilteredChannels = getFilteredChannels(); 
    if (instance.channel && instance.channel.url) {
        currentChannelIndex = currentFilteredChannels.findIndex(ch => ch.url === instance.channel.url);
    }


    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            video.paused ? video.play() : video.pause();
            break;
        case 'f':
            e.preventDefault();
            if (ui) ui.toggleFullScreen();
            break;
        case 'i':
            e.preventDefault();
            showPlayerInfobar(instance.channel, instance.container.querySelector('.player-infobar'));
            break;
        case 'm':
            e.preventDefault();
            video.muted = !video.muted;
            break;
        case 'arrowleft':
            e.preventDefault();
            if (video.duration && video.currentTime > 0) {
                video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 15 : 5));
            }
            break;
        case 'arrowright':
            e.preventDefault();
            if (video.duration && video.currentTime < video.duration) {
                video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? 15 : 5));
            }
            break;
        case 'arrowup':
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.05);
            break;
        case 'arrowdown':
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.05);
            break;
        case 'pageup':
            e.preventDefault();
            if (currentChannelIndex > 0 && currentFilteredChannels.length > 0) {
                const prevChannel = currentFilteredChannels[currentChannelIndex - 1];
                playChannelInShaka(prevChannel, activePlayerId);
            }
            break;
        case 'pagedown':
            e.preventDefault();
            if (currentChannelIndex !== -1 && currentChannelIndex < currentFilteredChannels.length - 1) {
                const nextChannel = currentFilteredChannels[currentChannelIndex + 1];
                playChannelInShaka(nextChannel, activePlayerId);
            }
            break;
        case 'escape':
            if (ui && ui.isFullScreen()) {
                e.preventDefault();
                ui.toggleFullScreen();
            }
            break;
    }
}

function bindEvents() {
    $('#sidebarToggleBtn').on('click', async () => {
        const sidebar = $('#sidebar');
        const appContainer = $('#app-container');
        sidebar.toggleClass('collapsed expanded');
        appContainer.toggleClass('sidebar-collapsed');
        userSettings.sidebarCollapsed = sidebar.hasClass('collapsed');
        if(userSettings.persistFilters) await saveAppConfigValue('userSettings', userSettings);
    });

    $('#loadUrl').on('click', () => {
        const url = $('#urlInput').val().trim();
        if (url) {
            if (typeof isXtreamUrl === 'function' && isXtreamUrl(url)) {
                if (typeof handleXtreamUrl === 'function') handleXtreamUrl(url);
            } else {
                loadUrl(url);
            }
        } else {
            showNotification('Introduce una URL válida.', 'info');
        }
    });
    $('#fileInput').on('change', loadFile);

    $('#loadFromDBBtnHeader').on('click', showLoadFromDBModal);
    $('#saveToDBBtnHeader').on('click', () => {
        if (!currentM3UContent) {
            showNotification('No hay lista cargada para guardar.', 'info');
            return;
        }
        let defaultName = currentM3UName || 'mi_lista';
        defaultName = defaultName.replace(/\.(m3u8?|txt|pls|m3uplus)$/i, '').replace(/^\/|\/$/g, '');
        if(defaultName.includes('/')) { defaultName = defaultName.substring(defaultName.lastIndexOf('/') + 1); }
        defaultName = defaultName.replace(/[^\w\s._-]/g, '_').replace(/\s+/g, '_');
        if (!defaultName || defaultName === '_') defaultName = 'lista_guardada';

        $('#saveM3UNameInput').val(defaultName);
        const saveModal = new bootstrap.Modal(document.getElementById('saveM3UModal'));
        saveModal.show();
    });
    $('#confirmSaveM3UBtn').on('click', handleSaveToDB);

    $('#openEditorBtn').on('click', launchEditor);
    $('#applyEditorChangesBtn').on('click', () => {
        if (typeof editorHandler !== 'undefined' && typeof editorHandler.getFinalData === 'function') {
            const editorResult = editorHandler.getFinalData();
            channels = editorResult.channels;
            currentGroupOrder = editorResult.groupOrder;
            
            regenerateCurrentM3UContentFromString();
            filterAndRenderChannels();
            
            showNotification("Cambios del editor aplicados y guardados.", "success");
            const editorModalInstance = bootstrap.Modal.getInstance(document.getElementById('editorModal'));
            if (editorModalInstance) {
                editorModalInstance.hide();
            }
        } else {
            showNotification("Error: No se pudieron aplicar los cambios del editor.", "error");
        }
    });
    
    $('#downloadM3UBtnHeader').on('click', downloadCurrentM3U);
    $('#loadOrangeTvBtnHeader').on('click', async () => {
        if (typeof generateM3uOrangeTv === 'function') {
            const orangeTvSourceName = "OrangeTV";
            if (typeof removeChannelsBySourceOrigin === 'function') {
                 removeChannelsBySourceOrigin(orangeTvSourceName);
            }

            const m3uString = await generateM3uOrangeTv();
            if (m3uString && !m3uString.includes("Error general en el proceso") && !m3uString.includes("No se pudieron obtener canales")) {
                if (typeof appendM3UContent === 'function') {
                    appendM3UContent(m3uString, orangeTvSourceName);
                }
            } else {
                showNotification('No se generaron canales de OrangeTV o hubo un error durante el proceso.', 'warning');
                if (channels.length === 0) {
                   if (typeof filterAndRenderChannels === 'function') filterAndRenderChannels();
                }
            }
        } else {
            showNotification("Función para cargar OrangeTV no encontrada.", "error");
        }
    });
    $('#loadAtresplayerBtnHeader').on('click', async () => {
        if (typeof generateM3UAtresplayer === 'function') {
            await generateM3UAtresplayer();
        } else {
            if (typeof showNotification === 'function') showNotification("Funcionalidad Atresplayer no cargada.", "error");
        }
    });
     $('#loadBarTvBtnHeader').on('click', async () => {
        if (typeof generateM3uBarTv === 'function') {
            await generateM3uBarTv();
        } else {
            if (typeof showNotification === 'function') showNotification("Funcionalidad BarTV no cargada.", "error");
        }
    });


    $('#searchInput').on('input', debounce(filterAndRenderChannels, 300));

    $('#groupFilterSidebar').on('change', async function() {
        const selectedGroup = $(this).val();
        currentPage = 1;
        filterAndRenderChannels();
        if (userSettings.persistFilters) {
            userSettings.lastSelectedGroup = selectedGroup;
            await saveAppConfigValue('userSettings', userSettings);
        }
    });

    $('#sidebarGroupList').on('click', '.list-group-item', function () {
        const groupName = $(this).data('group-name');
        $('#groupFilterSidebar').val(groupName).trigger('change');
    });

    $('#showAllChannels').on('click', () => switchFilter('all'));
    $('#showFavorites').on('click', () => switchFilter('favorites'));
    $('#showHistory').on('click', () => switchFilter('history'));

    $('#openEpgModalBtn').on('click', () => $('#epgModal').modal('show'));
    $('#openMovistarVODModalBtn').on('click', openMovistarVODModal);
    $('#xtreamBackButton').on('click', popNavigationState);

    $('#updateDaznBtn').on('click', async () => {
        if (typeof orchestrateDaznUpdate === 'function') {
            if (!channels || channels.length === 0) {
                showNotification('Carga una lista M3U que contenga canales de DAZN primero.', 'info');
                return;
            }
            let daznM3uUserAgent = null;
            const daznChannelInM3U = channels.find(ch =>
                (ch.sourceOrigin && ch.sourceOrigin.toLowerCase() === 'dazn') ||
                (ch.url && ch.url.toLowerCase().includes('dazn')) ||
                (ch['tvg-id'] && ch['tvg-id'].toLowerCase().includes('dazn'))
            );
            if (daznChannelInM3U && daznChannelInM3U.vlcOptions && daznChannelInM3U.vlcOptions['http-user-agent']) {
                daznM3uUserAgent = daznChannelInM3U.vlcOptions['http-user-agent'];
            }
            await orchestrateDaznUpdate(daznM3uUserAgent);
        } else {
            showNotification('Error: Funcionalidad DAZN no cargada.', 'error');
        }
    });
    $('#openXtreamModalBtn').on('click', () => {
        if (typeof showXtreamConnectionModal === 'function') showXtreamConnectionModal();
    });
    $('#openManageXCodecPanelsModalBtn').on('click', () => {
        if (typeof bootstrap !== 'undefined' && typeof bootstrap.Modal !== 'undefined') {
            const xcodecModalEl = document.getElementById('manageXCodecPanelsModal');
            if (xcodecModalEl) {
                const xcodecModalInstance = bootstrap.Modal.getOrCreateInstance(xcodecModalEl);
                xcodecModalInstance.show();
                 if (typeof loadSavedXCodecPanels === 'function') loadSavedXCodecPanels();
            } else {
                showNotification("Error: Modal XCodec no encontrado.", "error");
            }
        } else {
             showNotification("Error: Bootstrap no cargado, no se puede abrir modal XCodec.", "error");
        }
    });

    $('#openSettingsModalBtn').on('click', () => {
        $('#settingsModal').modal('show');
        if (typeof updateMovistarVodCacheStatsUI === 'function') {
            updateMovistarVodCacheStatsUI();
        }
    });

    $(document).on('keydown', handleGlobalKeyPress);

    $('#player-taskbar').on('click', '.taskbar-item', function() {
        const windowId = $(this).data('windowId');
        if (windowId) {
            setActivePlayer(windowId);
        }
    });

    $('#prevPage').on('click', () => changePage(currentPage - 1));
    $('#nextPage').on('click', () => changePage(currentPage + 1));
    $('#channelGrid').on('click', '.channel-card', handleChannelCardClick);

    $('#channelGrid').on('mouseenter', '.channel-card', function() {
        if (!userSettings.enableHoverPreview) return;
        const card = $(this);
        if (Object.keys(playerInstances).length > 0) return;

        if (activeCardPreviewPlayer && activeCardPreviewElement && activeCardPreviewElement[0] !== card[0]) {
             if (typeof destroyActiveCardPreviewPlayer === 'function') destroyActiveCardPreviewPlayer();
        }

        clearTimeout(hoverPlayTimeout);

        hoverPlayTimeout = setTimeout(async () => {
            const channelUrl = card.data('url');
            if (!channelUrl) return; 

            const channel = channels.find(c => c.url === channelUrl);
            if (channel) {
                if (channel.attributes && channel.attributes['xtream-type'] === 'series') {
                    return;
                }
                if (typeof playChannelInCardPreview === 'function') {
                    activeCardPreviewElement = card;
                    card.addClass('is-playing-preview');
                    await playChannelInCardPreview(channel, card.find('.card-video-preview-container')[0]);
                }
            }
        }, HOVER_PLAY_DELAY);
    });

    $('#channelGrid').on('mouseleave', '.channel-card', function() {
        clearTimeout(hoverPlayTimeout);
        if (activeCardPreviewElement && activeCardPreviewElement[0] === $(this)[0]) {
            if (typeof destroyActiveCardPreviewPlayer === 'function') destroyActiveCardPreviewPlayer();
        }
    });


    $('#channelGrid').on('click', '.favorite-btn', handleFavoriteButtonClick);
    $('#channelGrid').on('error', '.channel-logo', function () {
        this.classList.add('error');
        this.style.display = 'none';
        const placeholder = $(this).siblings('.epg-icon-placeholder');
        if (placeholder.length) { placeholder.show(); }
        else { $(this).parent().addClass('no-logo-fallback'); }
    });

    $('#saveSettingsBtn').on('click', () => { if(typeof saveUserSettings === 'function') saveUserSettings(); });

    const rangeInputsSelector = '#epgNameMatchThreshold, #playerBufferInput, #channelCardSizeInput, #abrDefaultBandwidthEstimateInput, #manifestRetryMaxAttemptsInput, #manifestRetryTimeoutInput, #segmentRetryMaxAttemptsInput, #segmentRetryTimeoutInput, #epgDensityInput, #channelsPerPageInput, #particleOpacityInput, #shakaDefaultPresentationDelayInput, #shakaAudioVideoSyncThresholdInput, #playerWindowOpacityInput';
    $(rangeInputsSelector).on('input', function () {
        const id = this.id;
        const value = $(this).val();
        if(id === 'epgNameMatchThreshold') $('#epgNameMatchThresholdValue').text(value + '%');
        if(id === 'playerBufferInput') $('#playerBufferValue').text(value + 's');
        if(id === 'channelCardSizeInput') {
            const size = value + 'px';
            $('#channelCardSizeValue').text(size);
            document.documentElement.style.setProperty('--m3u-grid-minmax-size', size);
        }
         if(id === 'channelsPerPageInput') $('#channelsPerPageValue').text(value);
        if(id === 'abrDefaultBandwidthEstimateInput') $('#abrDefaultBandwidthEstimateValue').text(value + ' Kbps');
        if(id === 'manifestRetryMaxAttemptsInput') $('#manifestRetryMaxAttemptsValue').text(value);
        if(id === 'manifestRetryTimeoutInput') $('#manifestRetryTimeoutValue').text(value);
        if(id === 'segmentRetryMaxAttemptsInput') $('#segmentRetryMaxAttemptsValue').text(value);
        if(id === 'segmentRetryTimeoutInput') $('#segmentRetryTimeoutValue').text(value);
        if(id === 'epgDensityInput') $('#epgDensityValue').text(value + 'px/h');
        if(id === 'particleOpacityInput') $('#particleOpacityValue').text(value + '%');
        if(id === 'shakaDefaultPresentationDelayInput') $('#shakaDefaultPresentationDelayValue').text(parseFloat(value).toFixed(parseFloat(value) % 1 === 0 ? 0 : 1) + 's');
        if(id === 'shakaAudioVideoSyncThresholdInput') $('#shakaAudioVideoSyncThresholdValue').text(parseFloat(value).toFixed(parseFloat(value) % 1 === 0 ? 0 : 2) + 's');
        if(id === 'playerWindowOpacityInput') {
            $('#playerWindowOpacityValue').text(Math.round(value * 100) + '%');
            Object.values(playerInstances).forEach(instance => {
                if (instance.container) {
                    instance.container.style.setProperty('--player-window-opacity', value);
                }
            });
        }
    });

    $('#exportSettingsBtn').on('click', () => { if(typeof exportSettings === 'function') exportSettings(); });
    $('#importSettingsInput').on('change', (event) => { if(typeof importSettings === 'function') importSettings(event); });
    $('#clearCacheBtn').on('click', clearCacheAndReload);

    $('#connectXtreamServerBtn').on('click', () => {
        if (typeof handleConnectXtreamServer === 'function') handleConnectXtreamServer();
    });
     $('#xtreamConfirmGroupSelectionBtn').on('click', () => {
        if (typeof handleXtreamGroupSelection === 'function') handleXtreamGroupSelection();
    });
    $('#saveXtreamServerBtn').on('click', () => {
        if (typeof handleSaveXtreamServer === 'function') handleSaveXtreamServer();
    });
    $('#savedXtreamServersList').on('click', '.load-xtream-server-btn', function() {
        const serverId = parseInt($(this).data('id'), 10);
        if (typeof loadXtreamServerToForm === 'function') loadXtreamServerToForm(serverId);
    });
    $('#savedXtreamServersList').on('click', '.delete-xtream-server-btn', function() {
        const serverId = parseInt($(this).data('id'), 10);
        if (typeof handleDeleteXtreamServer === 'function') handleDeleteXtreamServer(serverId);
    });

    $('#sendM3UToServerBtn').on('click', () => {
        const urlFromInput = $('#m3uUploadServerUrlInput').val()?.trim();
        if (typeof sendM3UToServer === 'function') {
            sendM3UToServer(urlFromInput);
        } else {
            showNotification("Error: Función para enviar M3U no encontrada.", "error");
        }
    });

    $('#movistarLoginBtnSettings').on('click', handleMovistarLogin);
    $('#movistarValidateAllBtnSettings').on('click', handleMovistarValidateAllTokens);
    $('#movistarDeleteExpiredBtnSettings').on('click', handleMovistarDeleteExpiredTokens);
    $('#movistarAddManualTokenBtnSettings').on('click', handleMovistarAddManualToken);
    $('#movistarLongTokensTableBodySettings').on('click', '.delete-long-token-btn-settings', function() {
        const tokenId = $(this).closest('tr').data('tokenid');
        if (tokenId) handleMovistarDeleteSingleLongToken(tokenId);
    });
    $('#movistarLongTokensTableBodySettings').on('click', '.validate-long-token-btn-settings', function() {
        const tokenId = $(this).closest('tr').data('tokenid');
         if (tokenId) handleMovistarValidateSingleLongToken(tokenId);
    });
    $('#movistarLongTokensTableBodySettings').on('click', 'tr', function(event) {
        const tokenId = $(this).data('tokenid');
        if (tokenId && !$(event.target).closest('button').length) {
            selectedMovistarLongTokenIdForSettings = tokenId;
            $('#movistarLongTokensTableBodySettings tr').removeClass('table-active');
            $(this).addClass('table-active');
            $('#selectedLongTokenIdDisplaySettings').text(`...${tokenId.slice(-12)}`);
            $('#movistarDeviceManagementSectionSettings').show();
            $('#movistarLoadDevicesForSettingsBtn').prop('disabled', false);
            $('#movistarDevicesListForSettings').html('<div class="list-group-item text-muted text-center">Carga los dispositivos para el token seleccionado arriba.</div>');
            $('#movistarAssociateDeviceForSettingsBtn').prop('disabled', true);
            $('#movistarRegisterNewDeviceForSettingsBtn').prop('disabled', false);
        }
    });
    $('#movistarLoadDevicesForSettingsBtn').on('click', handleMovistarLoadDevicesForSettings);
    $('#movistarAssociateDeviceForSettingsBtn').on('click', handleMovistarAssociateDeviceForSettings);
    $('#movistarRegisterNewDeviceForSettingsBtn').on('click', handleMovistarRegisterNewDeviceForSettings);
    $('#movistarRefreshCdnBtnSettings').on('click', handleMovistarRefreshCdnToken);
    $('#movistarCopyCdnBtnSettings').on('click', handleMovistarCopyCdnToken);
    $('#movistarApplyCdnToChannelsBtnSettings').on('click', handleMovistarApplyCdnToChannels);
    $('#clearMovistarVodCacheBtnSettings').on('click', handleClearMovistarVodCache);
    $('#movistarTokenStatusBtn').on('click', handleMovistarTokenStatusButtonClick);


    $('#loadMovistarVODBtn').on('click', loadMovistarVODData);
    $('#movistarVODDateInput').on('change', function() {
        movistarVodSelectedDate = new Date($(this).val() + 'T00:00:00');
        loadMovistarVODData();
    });
    $('#movistarVODModal-channel-filter, #movistarVODModal-genre-filter').on('change', renderMovistarVODPrograms);
    $('#movistarVODModal-search-input').on('input', debounce(renderMovistarVODPrograms, 300));

    $('#movistarVODModal-programs').on('click', '.movistar-vod-card', function() {
        const programArrayIndex = parseInt($(this).data('program-array-index'), 10);
        if (!isNaN(programArrayIndex) && movistarVodFilteredPrograms[programArrayIndex]) {
            const program = movistarVodFilteredPrograms[programArrayIndex];
            if (program && typeof handleMovistarVODProgramClick === 'function') {
                handleMovistarVODProgramClick(program);
            }
        } else {
            showNotification("Error al seleccionar el programa VOD.", "error");
        }
    });

    $('#movistarVODModal-prev-page').on('click', function() {
        if (movistarVodCurrentPage > 1) {
            movistarVodCurrentPage--;
            displayCurrentMovistarVODPage();
            updateMovistarVODPaginationControls();
        }
    });
    $('#movistarVODModal-next-page').on('click', function() {
        const totalPages = Math.ceil(movistarVodFilteredPrograms.length / MOVISTAR_VOD_ITEMS_PER_PAGE);
        if (movistarVodCurrentPage < totalPages) {
            movistarVodCurrentPage++;
            displayCurrentMovistarVODPage();
            updateMovistarVODPaginationControls();
        }
    });
}

async function applyUISettings() {
    await loadLanguage(userSettings.language);
    applyTranslations();

    if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
    if (typeof applyThemeAndFont === 'function') applyThemeAndFont();

    const sidebar = $('#sidebar');
    const appContainer = $('#app-container');
    if (userSettings.sidebarCollapsed && window.innerWidth >= 992) {
        sidebar.removeClass('expanded').addClass('collapsed');
        appContainer.addClass('sidebar-collapsed');
    } else if(window.innerWidth >= 992) {
        sidebar.removeClass('collapsed').addClass('expanded');
        appContainer.removeClass('sidebar-collapsed');
    } else {
        sidebar.removeClass('expanded').addClass('collapsed');
        appContainer.addClass('sidebar-collapsed');
    }

    document.documentElement.style.setProperty('--m3u-grid-minmax-size', userSettings.channelCardSize + 'px');
    document.documentElement.style.setProperty('--card-logo-aspect-ratio', userSettings.cardLogoAspectRatio === 'auto' ? '16/9' : userSettings.cardLogoAspectRatio);
    Object.values(playerInstances).forEach(instance => {
        if (typeof updatePlayerConfigFromSettings === 'function') {
            updatePlayerConfigFromSettings(instance.player);
        }
        if (instance.container) {
            instance.container.style.setProperty('--player-window-opacity', userSettings.playerWindowOpacity);
        }
    });
    if (typeof initParticles === 'function') initParticles();
    if (userSettings.persistFilters) {
        if(userSettings.lastSelectedFilterTab) currentFilter = userSettings.lastSelectedFilterTab;
    }

    if (channels.length > 0) filterAndRenderChannels();
}

function initParticles() {
    if (typeof particlesJS === 'function' && document.getElementById('particles-js') && !document.getElementById('particles-js').dataset.initialized && userSettings.particlesEnabled) {
        document.getElementById('particles-js').dataset.initialized = 'true';
        const particleColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-secondary').trim();
        const particleLineColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim();
        document.documentElement.style.setProperty('--particle-opacity', userSettings.particleOpacity);


        particlesJS('particles-js', {
            "particles": {
                "number": { "value": 30, "density": { "enable": true, "value_area": 1200 } },
                "color": { "value": particleColor },
                "shape": { "type": "circle" },
                "opacity": { "value": 1, "random": true, "anim": { "enable": true, "speed": 0.15, "opacity_min": 0.3, "sync": false } },
                "size": { "value": 1.5, "random": true },
                "line_linked": { "enable": true, "distance": 160, "color": particleLineColor, "opacity": 0.5, "width": 1 },
                "move": { "enable": true, "speed": 0.8, "direction": "none", "random": true, "straight": false, "out_mode": "out" }
            },
            "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": false }, "onclick": { "enable": false }, "resize": true } },
            "retina_detect": true
        });
         const particlesCanvas = document.querySelector('#particles-js canvas');
         if(particlesCanvas && particlesCanvas.style) {
            particlesCanvas.style.setProperty('opacity', '1', 'important');
         }
         $('#particles-js').removeClass('disabled');
    } else if (!userSettings.particlesEnabled && document.getElementById('particles-js')) {
         $('#particles-js').addClass('disabled');
         if(typeof pJSDom !== 'undefined' && pJSDom.length > 0 && pJSDom[0].pJS) {
             pJSDom[0].pJS.fn.vendors.destroypJS();
             pJSDom = [];
             if (document.getElementById('particles-js')) document.getElementById('particles-js').dataset.initialized = 'false';
         }
    }
}

window.updateM3UWithDaznData = function(daznChannelDetailsList) {
    if (!channels || channels.length === 0) {
        if(typeof showNotification === 'function') showNotification('DAZN: No hay lista M3U cargada para actualizar.', 'info');
        return;
    }
    if (!daznChannelDetailsList || daznChannelDetailsList.length === 0) {
        if(typeof showNotification === 'function') showNotification('DAZN: No se recibieron datos de canales para la actualización.', 'info');
        return;
    }

    let updatedCount = 0;
    const daznDataMapByLinearId = new Map();
    daznChannelDetailsList.forEach(daznChannel => {
        if (daznChannel.daznLinearId) {
            daznDataMapByLinearId.set(daznChannel.daznLinearId, daznChannel);
        }
    });

    channels.forEach(m3uChannel => {
        let currentChannelLinearId = null;
        if (m3uChannel.url) {
            const urlMatch = m3uChannel.url.match(/dazn-linear-(\d+)/);
            if (urlMatch && urlMatch[1]) {
                currentChannelLinearId = urlMatch[1];
            }
        }

        if (!currentChannelLinearId && m3uChannel['tvg-id']) {
            const tvgIdMatch = String(m3uChannel['tvg-id']).match(/dazn-linear-(\d+)/i);
            if (tvgIdMatch && tvgIdMatch[1]) {
                currentChannelLinearId = tvgIdMatch[1];
            }
        }

        if (currentChannelLinearId && daznDataMapByLinearId.has(currentChannelLinearId)) {
            const daznUpdate = daznDataMapByLinearId.get(currentChannelLinearId);

            m3uChannel.url = daznUpdate.baseUrl;

            if (!m3uChannel.kodiProps) {
                m3uChannel.kodiProps = {};
            }
            if (!m3uChannel.vlcOptions) {
                m3uChannel.vlcOptions = {};
            }

            if (daznUpdate.cdnTokenName && daznUpdate.cdnTokenValue) {
                m3uChannel.kodiProps['inputstream.adaptive.stream_headers'] = `${daznUpdate.cdnTokenName}=${daznUpdate.cdnTokenValue}`;
            } else {
                delete m3uChannel.kodiProps['inputstream.adaptive.stream_headers'];
            }

            if (daznUpdate.streamUserAgent) {
                m3uChannel.vlcOptions['http-user-agent'] = daznUpdate.streamUserAgent;
            }
            m3uChannel.sourceOrigin = "DAZN";

            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        if(typeof showNotification === 'function') showNotification(`DAZN: ${updatedCount} canales actualizados en tu lista M3U.`, 'success');
        regenerateCurrentM3UContentFromString();
        filterAndRenderChannels();
    } else {
        if(typeof showNotification === 'function') showNotification('DAZN: No se encontraron canales en tu M3U que coincidieran con los datos de DAZN para actualizar.', 'info');
    }
};

function logToMovistarSettingsUI(message, type = 'info') {
    const logArea = $('#movistarLogAreaSettings');
    if (logArea.length) {
        const timestamp = new Date().toLocaleTimeString();
        const existingLog = logArea.val();
        const newLog = `[${timestamp}] ${message}\n`;
        logArea.val(existingLog + newLog);
        logArea.scrollTop(logArea[0].scrollHeight);
    }
}

async function loadAndDisplayInitialMovistarStatus() {
    if (!window.MovistarTokenHandler) return;
    logToMovistarSettingsUI("Cargando estado inicial de Movistar+...", "info");
    try {
        const status = await window.MovistarTokenHandler.getShortTokenStatus();
        updateMovistarCdnTokenUI(status.token, status.expiry);
        await loadAndRenderLongTokensListSettings();
    } catch (error) {
        logToMovistarSettingsUI(`Error cargando estado inicial: ${error.message}`, "error");
    }
}

function updateMovistarCdnTokenUI(token, expiryTimestamp) {
    $('#movistarCdnTokenDisplaySettings').val(token || "");
    const expiryDate = expiryTimestamp ? new Date(expiryTimestamp * 1000) : null;
    if (expiryDate && expiryTimestamp > Math.floor(Date.now() / 1000)) {
        $('#movistarCdnTokenExpirySettings').text(`${chrome.i18n.getMessage("movistarExpiresHeader") || "Expira"}: ${expiryDate.toLocaleString()}`);
        $('#movistarCdnTokenExpirySettings').removeClass('text-danger').addClass('text-success');
    } else if (expiryDate) {
        $('#movistarCdnTokenExpirySettings').text(`Expirado: ${expiryDate.toLocaleString()}`);
        $('#movistarCdnTokenExpirySettings').removeClass('text-success').addClass('text-danger');
    } else {
        $('#movistarCdnTokenExpirySettings').text(`${chrome.i18n.getMessage("movistarExpiresHeader") || "Expira"}: -`);
        $('#movistarCdnTokenExpirySettings').removeClass('text-success text-danger');
    }
    $('#movistarCopyCdnBtnSettings').prop('disabled', !token);
    $('#movistarApplyCdnToChannelsBtnSettings').prop('disabled', !token || (expiryTimestamp <= Math.floor(Date.now()/1000)));

    updateMovistarTokenStatusButton(expiryTimestamp);
}

async function loadAndRenderLongTokensListSettings() {
    if (!window.MovistarTokenHandler) return;
    const tbody = $('#movistarLongTokensTableBodySettings');
    tbody.html(`<tr><td colspan="6" class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> ${chrome.i18n.getMessage("movistarLoading") || "Cargando..."}</td></tr>`);
    selectedMovistarLongTokenIdForSettings = null;
    $('#movistarDeviceManagementSectionSettings').hide();
    $('#movistarLoadDevicesForSettingsBtn').prop('disabled', true);

    try {
        const tokens = await window.MovistarTokenHandler.getAllLongTokens();
        if (tokens.length === 0) {
            tbody.html(`<tr><td colspan="6" class="text-center p-3 text-muted">${chrome.i18n.getMessage("xtreamNoSavedServers") || "No hay tokens largos guardados."}</td></tr>`);
            return;
        }
        tokens.sort((a, b) => (b.expiry_tstamp || 0) - (a.expiry_tstamp || 0));
        tbody.empty();
        const nowSeconds = Math.floor(Date.now() / 1000);

        tokens.forEach(token => {
            const isExpired = (token.expiry_tstamp || 0) < nowSeconds;
            const expiryDate = token.expiry_tstamp ? new Date(token.expiry_tstamp * 1000) : null;
            const expiryString = expiryDate ? expiryDate.toLocaleDateString() : 'N/D';
            let statusText = isExpired ? 'Expirado' : (token.device_id ? 'Válido' : 'Sin DeviceID');
            let statusClass = isExpired ? 'text-danger' : (token.device_id ? 'text-success' : 'text-warning');

            const tr = $('<tr>').data('tokenid', token.id).css('cursor', 'pointer');
            tr.append($('<td>').text(`...${token.id.slice(-12)}`).attr('title', token.id));
            tr.append($('<td>').text(token.account_nbr || 'N/A'));
            tr.append($('<td>').text(token.device_id ? `...${token.device_id.slice(-6)}` : 'NULO').attr('title', token.device_id || 'Sin Device ID'));
            tr.append($('<td>').text(expiryString));
            tr.append($('<td>').addClass(statusClass).text(statusText));
            tr.append($('<td>')
                .append($('<button>').addClass('btn btn-outline-danger btn-sm delete-long-token-btn-settings me-1').attr('title', 'Eliminar').html('<i class="fas fa-trash"></i>'))
                .append($('<button>').addClass('btn btn-outline-info btn-sm validate-long-token-btn-settings').attr('title', 'Validar').html('<i class="fas fa-check"></i>'))
            );
            tbody.append(tr);
        });
    } catch (error) {
        logToMovistarSettingsUI(`Error cargando lista de tokens largos: ${error.message}`, "error");
        tbody.html(`<tr><td colspan="6" class="text-center p-3 text-danger">Error: ${escapeHtml(error.message)}</td></tr>`);
    }
}

async function handleMovistarLogin() {
    const username = $('#movistarUsernameSettingsInput').val();
    const password = $('#movistarPasswordSettingsInput').val();
    logToMovistarSettingsUI("Iniciando login...", "info");
    showLoading(true, "Iniciando sesión Movistar+...");

    const result = await window.MovistarTokenHandler.loginAndGetTokens(username, password);

    showLoading(false);
    logToMovistarSettingsUI(result.message, result.success ? "success" : "error");
    showNotification(result.message, result.success ? "success" : "error");

    if (result.success) {
        updateMovistarCdnTokenUI(result.shortToken, result.shortTokenExpiry);
        await loadAndRenderLongTokensListSettings();
        $('#movistarUsernameSettingsInput').val('');
        $('#movistarPasswordSettingsInput').val('');
    }
}

async function handleMovistarValidateAllTokens() {
    logToMovistarSettingsUI("Validando todos los tokens largos...", "info");
    showLoading(true, "Validando tokens...");
    const result = await window.MovistarTokenHandler.validateAllLongTokens();
    showLoading(false);
    let summary = `Validación completa: ${result.validated} validados, ${result.functional} funcionales, ${result.expired} expirados, ${result.noDeviceId} sin Device ID.`;
    if(result.refreshed > 0 || result.refreshErrors > 0) {
        summary += ` Refrescos: ${result.refreshed} éxitos, ${result.refreshErrors} fallos.`;
    }
    logToMovistarSettingsUI(summary, "info");
    showNotification(summary, "info", 6000);
    await loadAndRenderLongTokensListSettings();
}

async function handleMovistarDeleteExpiredTokens() {
    logToMovistarSettingsUI("Eliminando tokens largos expirados...", "info");
    const userConfirmed = await showConfirmationModal(
        "¿Seguro que quieres eliminar todos los tokens largos expirados?",
        "Confirmar Eliminación", "Sí, Eliminar Expirados", "btn-warning"
    );
    if (!userConfirmed) {
        logToMovistarSettingsUI("Eliminación de expirados cancelada.", "info");
        return;
    }
    showLoading(true, "Eliminando tokens expirados...");
    const deletedCount = await window.MovistarTokenHandler.deleteExpiredLongTokens();
    showLoading(false);
    logToMovistarSettingsUI(`${deletedCount} tokens expirados eliminados.`, "info");
    showNotification(`${deletedCount} tokens expirados eliminados.`, "success");
    await loadAndRenderLongTokensListSettings();
}

async function handleMovistarAddManualToken() {
    const jwt = $('#movistarAddManualTokenJwtInputSettings').val().trim();
    const deviceId = $('#movistarAddManualTokenDeviceIdInputSettings').val().trim() || null;
    if (!jwt) {
        showNotification("Por favor, pega el token JWT largo.", "warning");
        return;
    }
    logToMovistarSettingsUI(`Intentando añadir token manual: ${jwt.substring(0,20)}...`, "info");
    showLoading(true, "Añadiendo token...");
    try {
        await window.MovistarTokenHandler.addLongTokenManually(jwt, deviceId);
        logToMovistarSettingsUI("Token manual añadido con éxito.", "success");
        showNotification("Token manual añadido con éxito.", "success");
        $('#movistarAddManualTokenJwtInputSettings').val('');
        $('#movistarAddManualTokenDeviceIdInputSettings').val('');
        await loadAndRenderLongTokensListSettings();
    } catch (error) {
        logToMovistarSettingsUI(`Error añadiendo token manual: ${error.message}`, "error");
        showNotification(`Error añadiendo token: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

async function handleMovistarDeleteSingleLongToken(tokenId) {
    logToMovistarSettingsUI(`Intentando eliminar token ${tokenId.slice(-12)}...`, "info");
    const userConfirmed = await showConfirmationModal(
        `¿Seguro que quieres eliminar el token largo con ID ...${tokenId.slice(-12)}?`,
        "Confirmar Eliminación", "Sí, Eliminar Token", "btn-danger"
    );
    if (!userConfirmed) {
        logToMovistarSettingsUI("Eliminación cancelada.", "info");
        return;
    }
    showLoading(true, "Eliminando token...");
    try {
        await window.MovistarTokenHandler.deleteLongToken(tokenId);
        logToMovistarSettingsUI(`Token ${tokenId.slice(-12)} eliminado.`, "success");
        showNotification(`Token ${tokenId.slice(-12)} eliminado.`, "success");
        await loadAndRenderLongTokensListSettings();
        if (selectedMovistarLongTokenIdForSettings === tokenId) {
            selectedMovistarLongTokenIdForSettings = null;
            $('#movistarDeviceManagementSectionSettings').hide();
             $('#movistarLoadDevicesForSettingsBtn').prop('disabled', true);
        }
    } catch (error) {
        logToMovistarSettingsUI(`Error eliminando token: ${error.message}`, "error");
        showNotification(`Error eliminando token: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

async function handleMovistarValidateSingleLongToken(tokenId) {
    logToMovistarSettingsUI(`Validando token ${tokenId.slice(-12)}...`, "info");
    showLoading(true, `Validando token ...${tokenId.slice(-12)}`);
    const tokens = await MovistarTokenHandler.getAllLongTokens();
    const token = tokens.find(t => t.id === tokenId);
    showLoading(false);
    if (token) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const isExpired = (token.expiry_tstamp || 0) < nowSeconds;
        let msg = `Token ...${tokenId.slice(-12)}: `;
        if (isExpired) msg += "Expirado.";
        else if (!token.device_id) msg += "Válido pero SIN Device ID.";
        else msg += "Válido y funcional.";
        logToMovistarSettingsUI(msg, "info");
        showNotification(msg, "info");
    } else {
         logToMovistarSettingsUI(`Token ...${tokenId.slice(-12)} no encontrado para validar.`, "warning");
         showNotification(`Token ...${tokenId.slice(-12)} no encontrado.`, "warning");
    }
    await loadAndRenderLongTokensListSettings();
}

async function handleMovistarLoadDevicesForSettings() {
    if (!selectedMovistarLongTokenIdForSettings) {
        showNotification("Selecciona un token largo de la lista primero.", "warning");
        return;
    }
    logToMovistarSettingsUI(`Cargando dispositivos para token ${selectedMovistarLongTokenIdForSettings.slice(-12)}...`, "info");
    showLoading(true, "Cargando dispositivos...");
    $('#movistarDevicesListForSettings').html('<div class="list-group-item text-muted text-center"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>');
    $('#movistarAssociateDeviceForSettingsBtn').prop('disabled', true);

    try {
        const devices = await window.MovistarTokenHandler.getDevicesForToken(selectedMovistarLongTokenIdForSettings);
        $('#movistarDevicesListForSettings').empty();
        if (devices.length === 0) {
            $('#movistarDevicesListForSettings').html('<div class="list-group-item text-muted text-center">No se encontraron dispositivos para esta cuenta.</div>');
        } else {
            devices.forEach(dev => {
                const item = $(`
                    <label class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                        <div>
                            <input class="form-check-input me-2" type="radio" name="movistarDeviceForSettings" value="${escapeHtml(dev.id)}" id="devRadioSettings_${dev.id.replace(/[^a-zA-Z0-9]/g, '')}">
                            <strong>${escapeHtml(dev.name)}</strong> <small class="text-muted">(...${escapeHtml(dev.id.slice(-6))}, ${escapeHtml(dev.type)})</small>
                        </div>
                        ${dev.is_associated ? '<span class="badge bg-success rounded-pill">Asociado</span>' : ''}
                    </label>
                `);
                item.find('input').on('change', function() {
                    $('#movistarAssociateDeviceForSettingsBtn').prop('disabled', !this.checked);
                });
                $('#movistarDevicesListForSettings').append(item);
            });
        }
    } catch (error) {
        logToMovistarSettingsUI(`Error cargando dispositivos: ${error.message}`, "error");
        showNotification(`Error cargando dispositivos: ${error.message}`, "error");
        $('#movistarDevicesListForSettings').html(`<div class="list-group-item text-danger text-center">Error: ${escapeHtml(error.message)}</div>`);
    } finally {
        showLoading(false);
    }
}

async function handleMovistarAssociateDeviceForSettings() {
    const selectedDeviceId = $('input[name="movistarDeviceForSettings"]:checked').val();
    if (!selectedMovistarLongTokenIdForSettings || !selectedDeviceId) {
        showNotification("Selecciona un token largo y un dispositivo para asociar.", "warning");
        return;
    }
    logToMovistarSettingsUI(`Asociando dispositivo ${selectedDeviceId.slice(-6)} a token ${selectedMovistarLongTokenIdForSettings.slice(-12)}...`, "info");
    showLoading(true, "Asociando dispositivo...");
    try {
        await window.MovistarTokenHandler.associateDeviceToToken(selectedMovistarLongTokenIdForSettings, selectedDeviceId);
        logToMovistarSettingsUI("Dispositivo asociado con éxito.", "success");
        showNotification("Dispositivo asociado con éxito.", "success");
        await loadAndRenderLongTokensListSettings();
        await handleMovistarLoadDevicesForSettings();
    } catch (error) {
        logToMovistarSettingsUI(`Error asociando dispositivo: ${error.message}`, "error");
        showNotification(`Error asociando dispositivo: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

async function handleMovistarRegisterNewDeviceForSettings() {
     if (!selectedMovistarLongTokenIdForSettings) {
        showNotification("Selecciona un token largo de la lista primero.", "warning");
        return;
    }
    logToMovistarSettingsUI(`Registrando nuevo dispositivo para token ${selectedMovistarLongTokenIdForSettings.slice(-12)}...`, "info");
    const userConfirmed = await showConfirmationModal(
        "Esto intentará registrar un NUEVO dispositivo en tu cuenta Movistar+ y asociarlo a este token largo. Puede fallar si has alcanzado el límite de dispositivos. ¿Continuar?",
        "Confirmar Registro de Nuevo Dispositivo", "Sí, Registrar Nuevo", "btn-warning"
    );
    if (!userConfirmed) {
        logToMovistarSettingsUI("Registro de nuevo dispositivo cancelado.", "info");
        return;
    }
    showLoading(true, "Registrando nuevo dispositivo...");
    try {
        await window.MovistarTokenHandler.registerAndAssociateNewDeviceToToken(selectedMovistarLongTokenIdForSettings);
        logToMovistarSettingsUI("Nuevo dispositivo registrado y asociado con éxito.", "success");
        showNotification("Nuevo dispositivo registrado y asociado.", "success");
        await loadAndRenderLongTokensListSettings();
        await handleMovistarLoadDevicesForSettings();
    } catch (error) {
        logToMovistarSettingsUI(`Error registrando nuevo dispositivo: ${error.message}`, "error");
        showNotification(`Error registrando dispositivo: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

async function handleMovistarRefreshCdnToken() {
    logToMovistarSettingsUI("Refrescando token CDN...", "info");
    showLoading(true, "Refrescando Token CDN...");
    const result = await window.MovistarTokenHandler.refreshCdnToken(true);
    showLoading(false);
    logToMovistarSettingsUI(result.message, result.success ? "success" : "error");
    showNotification(result.message, result.success ? "success" : "error");
    if (result.success) {
        updateMovistarCdnTokenUI(result.shortToken, result.shortTokenExpiry);
    }
}

async function handleMovistarCopyCdnToken() {
    const tokenToCopy = $('#movistarCdnTokenDisplaySettings').val();
    if (!tokenToCopy) {
        showNotification("No hay token CDN para copiar.", "warning");
        return;
    }
    try {
        await navigator.clipboard.writeText(tokenToCopy);
        showNotification("Token CDN copiado al portapapeles.", "success");
        logToMovistarSettingsUI("Token CDN copiado.", "info");
    } catch (err) {
        showNotification("Error al copiar. Revisa la consola.", "error");
        logToMovistarSettingsUI(`Error al copiar token: ${err.message}`, "error");
    }
}

async function handleMovistarApplyCdnToChannels(confirmed = false) {
    if (!confirmed) {
        const userConfirmed = await showConfirmationModal(
            "Esto aplicará el token CDN actual a todos los canales de Movistar+ en la lista. ¿Continuar?",
            "Confirmar Aplicación de Token", "Sí, Aplicar", "btn-success"
        );
        if (!userConfirmed) {
            logToMovistarSettingsUI("Aplicación de token a canales cancelada por el usuario.", "info");
            return { updatedCount: 0, success: false };
        }
    }

    logToMovistarSettingsUI("Aplicando token CDN a canales Movistar+...", "info");
    const status = await window.MovistarTokenHandler.getShortTokenStatus();
    if (!status.token || status.expiry <= Math.floor(Date.now()/1000)) {
        showNotification("El token CDN actual no es válido o ha expirado. Refréscalo primero.", "warning");
        logToMovistarSettingsUI("Aplicación cancelada: token CDN no válido/expirado.", "warning");
        return { updatedCount: 0, success: false };
    }
    if (!channels || channels.length === 0) {
        showNotification("No hay lista M3U cargada para aplicar el token.", "info");
        logToMovistarSettingsUI("Aplicación cancelada: no hay canales cargados.", "info");
        return { updatedCount: 0, success: false };
    }

    showLoading(true, "Aplicando token a canales...");
    let updatedCount = 0;
    const tokenHeaderString = `X-TCDN-Token=${status.token}`;

    channels.forEach(channel => {
        if (channel && channel.url && (channel.url.toLowerCase().includes('telefonica.com') || channel.url.toLowerCase().includes('movistarplus.es')) ) {
            channel.kodiProps = channel.kodiProps || {};
            let headers = channel.kodiProps['inputstream.adaptive.stream_headers'] || '';
            let headerParts = headers.split('&').filter(part => part && !part.toLowerCase().startsWith('x-tcdn-token='));
            headerParts.push(tokenHeaderString);
            channel.kodiProps['inputstream.adaptive.stream_headers'] = headerParts.join('&');
            channel.sourceOrigin = "Movistar+";
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        logToMovistarSettingsUI(`Token aplicado a ${updatedCount} canales.`, "success");
        regenerateCurrentM3UContentFromString();
        filterAndRenderChannels();
    } else {
        logToMovistarSettingsUI("No se encontraron canales Movistar+.", "info");
    }
    showLoading(false);
    return { updatedCount, success: true };
}

async function handleClearMovistarVodCache() {
    logToMovistarSettingsUI("Limpiando caché VOD Movistar+...", "info");
    const userConfirmed = await showConfirmationModal(
        "¿Seguro que quieres eliminar TODOS los datos de caché de Movistar VOD guardados localmente?",
        "Confirmar Limpieza de Caché VOD", "Sí, Limpiar Caché", "btn-danger"
    );
    if (!userConfirmed) {
        logToMovistarSettingsUI("Limpieza de caché VOD cancelada.", "info");
        return;
    }
    showLoading(true, "Limpiando caché VOD...");
    try {
        if (typeof clearMovistarVodCacheFromDB === 'function') {
            await clearMovistarVodCacheFromDB();
            logToMovistarSettingsUI("Caché VOD Movistar+ limpiada con éxito.", "success");
            showNotification("Caché VOD Movistar+ limpiada.", "success");
            if (typeof updateMovistarVodCacheStatsUI === 'function') {
                updateMovistarVodCacheStatsUI();
            }
        } else {
            throw new Error("Función de limpieza de caché no encontrada.");
        }
    } catch (error) {
        logToMovistarSettingsUI(`Error limpiando caché VOD: ${error.message}`, "error");
        showNotification(`Error limpiando caché VOD: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

function renderCurrentView() {
    const mainContentEl = $('#main-content');
    if (mainContentEl.length) mainContentEl.scrollTop(0);

    $('#xtreamBackButton').toggle(navigationHistory.length > 0);

    if (currentView.type === 'main') {
        filterAndRenderChannels();
    } else if (currentView.type === 'season_list' || currentView.type === 'episode_list') {
        renderXtreamContent(currentView.data, currentView.title);
    }
}

function pushNavigationState() {
    navigationHistory.push(JSON.parse(JSON.stringify(currentView)));
}

function popNavigationState() {
    if (navigationHistory.length > 0) {
        currentView = navigationHistory.pop();
        renderCurrentView();
    }
}

function displayXtreamInfoBar(data) {
    const infoBar = $('#xtream-info-bar');
    if (!data || !data.user_info || !data.server_info) {
        infoBar.hide();
        return;
    }
    
    const userInfo = data.user_info;
    const serverInfo = data.server_info;
    
    let expDate = 'Permanente';
    if (userInfo.exp_date && userInfo.exp_date !== 'null') {
        expDate = new Date(parseInt(userInfo.exp_date, 10) * 1000).toLocaleDateString();
    }
    
    const html = `
        <span title="Usuario"><i class="fas fa-user"></i> ${escapeHtml(userInfo.username)}</span>
        <span title="Estado"><i class="fas fa-check-circle"></i> ${escapeHtml(userInfo.status)}</span>
        <span title="Expira"><i class="fas fa-calendar-alt"></i> ${escapeHtml(expDate)}</span>
        <span title="Conexiones Activas/Máximas"><i class="fas fa-network-wired"></i> ${escapeHtml(userInfo.active_cons)} / ${escapeHtml(userInfo.max_connections)}</span>
        <span title="Servidor"><i class="fas fa-server"></i> ${escapeHtml(serverInfo.url)}:${escapeHtml(serverInfo.port)}</span>
    `;
    
    infoBar.html(html).show();
}

function hideXtreamInfoBar() {
     $('#xtream-info-bar').hide().empty();
}

function setActivePlayer(id) {
    if (activePlayerId === id) {
        const instanceToToggle = playerInstances[id];
        if (instanceToToggle && instanceToToggle.container.style.display === 'none') {
            instanceToToggle.container.style.display = 'flex';
            highestZIndex++;
            instanceToToggle.container.style.zIndex = highestZIndex;
        }
        return;
    }

    activePlayerId = id;

    Object.keys(playerInstances).forEach(instanceId => {
        const instance = playerInstances[instanceId];
        if (!instance) return;

        const isNowActive = instanceId === activePlayerId;
        const taskbarItem = document.getElementById(`taskbar-item-${instanceId}`);
        
        if (isNowActive) {
            highestZIndex++;
            instance.container.style.zIndex = highestZIndex;
            instance.container.classList.add('active');
            if (instance.container.style.display === 'none') {
                instance.container.style.display = 'flex';
            }
        } else {
            instance.container.classList.remove('active');
        }

        if (instance.videoElement) {
            instance.videoElement.muted = !isNowActive;
        }
        if (taskbarItem) {
            taskbarItem.classList.toggle('active', isNowActive);
        }
    });
}

function updateMovistarTokenStatusButton(expiryTimestamp) {
    const $statusBtn = $('#movistarTokenStatusBtn');
    if (!expiryTimestamp) {
        $statusBtn.hide();
        return;
    }

    $statusBtn.show();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingSeconds = expiryTimestamp - nowSeconds;
    const $statusText = $('#movistarTokenStatusText');

    if (remainingSeconds <= 0) {
        $statusText.text('M+ Expirado');
        $statusBtn.removeClass('btn-ok btn-warning').addClass('btn-danger');
    } else {
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        $statusText.text(`M+ ${hours}h ${minutes}m`);

        if (remainingSeconds < 3600) { // Less than 1 hour
            $statusBtn.removeClass('btn-ok btn-danger').addClass('btn-warning');
        } else {
            $statusBtn.removeClass('btn-warning btn-danger').addClass('btn-ok');
        }
    }
}

async function handleMovistarTokenStatusButtonClick() {
    const confirmed = await showConfirmationModal(
        "¿Quieres forzar la actualización del token de Movistar+ y aplicarlo a los canales de la lista actual?",
        "Actualizar Token Movistar+",
        "Sí, Actualizar y Aplicar",
        "btn-primary"
    );

    if (!confirmed) return;

    showLoading(true, "Actualizando y aplicando token de Movistar+...");
    try {
        const refreshResult = await window.MovistarTokenHandler.refreshCdnToken(true);
        if (!refreshResult.success) {
            throw new Error(refreshResult.message);
        }
        
        showNotification("Token CDN refrescado con éxito. Aplicando a canales...", "info");
        
        const applyResult = await handleMovistarApplyCdnToChannels(true); // Pass true to avoid double confirmation

        if (applyResult.updatedCount > 0) {
             showNotification(`Token aplicado a ${applyResult.updatedCount} canales de Movistar+.`, "success");
        } else {
             showNotification("No se encontraron canales de Movistar+ para actualizar en la lista.", "info");
        }
        
        // Update UI for both settings and header button
        updateMovistarCdnTokenUI(refreshResult.shortToken, refreshResult.shortTokenExpiry);

    } catch (error) {
        showNotification(`Error al actualizar token: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}