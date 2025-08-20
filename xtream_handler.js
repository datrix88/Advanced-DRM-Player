const XTREAM_USER_AGENT = 'VLC/3.0.20 (Linux; x86_64)';
let currentXtreamServerInfo = null;
let xtreamData = { live: [], vod: [], series: [] };
let xtreamGroupSelectionResolver = null;

function isXtreamUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname.endsWith('/get.php') &&
               parsedUrl.searchParams.has('username') &&
               parsedUrl.searchParams.has('password');
    } catch (e) {
        return false;
    }
}

function handleXtreamUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const host = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;
        const username = parsedUrl.searchParams.get('username');
        const password = parsedUrl.searchParams.get('password');
        let outputType = 'm3u_plus';
        if (parsedUrl.searchParams.has('type')) {
            const typeParam = parsedUrl.searchParams.get('type');
            if (typeParam === 'm3u_plus') outputType = 'm3u_plus';
        }
        if (parsedUrl.searchParams.has('output')) {
             const outputParam = parsedUrl.searchParams.get('output');
             if (outputParam === 'ts') outputType = 'ts';
             else if (outputParam === 'hls' || outputParam === 'm3u8') outputType = 'hls';
        }

        $('#xtreamHostInput').val(host);
        $('#xtreamUsernameInput').val(username);
        $('#xtreamPasswordInput').val(password);
        $('#xtreamOutputTypeSelect').val(outputType);
        $('#xtreamServerNameInput').val('');
        $('#xtreamFetchEpgCheck').prop('checked', true);
        
        showXtreamConnectionModal();
        if (typeof showNotification === 'function') showNotification("Datos de URL Xtream precargados en el modal.", "info");

    } catch (e) {
        if (typeof showNotification === 'function') showNotification("URL Xtream inválida.", "error");
        console.error("Error parsing Xtream URL:", e);
    }
}

async function showXtreamConnectionModal() {
    if (typeof dbPromise === 'undefined' || !dbPromise) {
        if (typeof showLoading === 'function') showLoading(true, 'Iniciando base de datos local...');
        try { if (typeof openDB === 'function') await openDB(); } catch (error) { if (typeof showNotification === 'function') showNotification(`Error DB: ${error.message}`, 'error'); if (typeof showLoading === 'function') showLoading(false); return; }
        finally { if (typeof showLoading === 'function') showLoading(false); }
    }
    
    $('#xtreamConnectionModal').modal('show');
    loadSavedXtreamServers();
}

async function loadSavedXtreamServers() {
    if (typeof showLoading === 'function') showLoading(true, 'Cargando servidores Xtream guardados...');
    try {
        const servers = typeof getAllXtreamServersFromDB === 'function' ? await getAllXtreamServersFromDB() : [];
        const $list = $('#savedXtreamServersList').empty();
        if (!servers || servers.length === 0) {
            $list.append('<li class="list-group-item text-secondary text-center">No hay servidores guardados.</li>');
        } else {
            servers.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
            servers.forEach(server => {
                const serverDisplayName = server.name || server.host;
                $list.append(`
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div style="flex-grow: 1; margin-right: 1rem; overflow: hidden; cursor:pointer;" class="load-xtream-server-btn" data-id="${server.id}">
                        <strong title="${escapeHtml(serverDisplayName)}">${escapeHtml(serverDisplayName)}</strong>
                        <small class="text-secondary d-block">${escapeHtml(server.host)}</small>
                    </div>
                    <button class="btn-control btn-sm delete-xtream-server-btn" data-id="${server.id}" title="Eliminar servidor"></button>
                </li>`);
            });
        }
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`Error cargando servidores Xtream: ${error.message}`, 'error');
        $('#savedXtreamServersList').empty().append('<li class="list-group-item text-danger text-center">Error al cargar servidores.</li>');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function fetchXtreamData(action = null, params = {}, currentServer = null) {
    const serverToUse = currentServer || currentXtreamServerInfo;
    if (!serverToUse || !serverToUse.host || !serverToUse.username || !serverToUse.password) {
        throw new Error("Datos del servidor Xtream no configurados.");
    }

    let url = `${serverToUse.host.replace(/\/$/, '')}/player_api.php?username=${encodeURIComponent(serverToUse.username)}&password=${encodeURIComponent(serverToUse.password)}`;
    if (action) {
        url += `&action=${action}`;
    }
    if (params) {
        for (const key in params) {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        }
    }
    const response = await fetch(url, { headers: { 'User-Agent': XTREAM_USER_AGENT }});
    if (!response.ok) {
        throw new Error(`Error API Xtream (${action || 'base'}): ${response.status}`);
    }
    const data = await response.json();
    if (data && data.user_info && data.user_info.auth === 0) {
        throw new Error(`Autenticación fallida con el servidor Xtream: ${data.user_info.status || 'Error desconocido'}`);
    }
    return data;
}

function buildM3UFromString(items) {
    let m3uString = "#EXTM3U\n";
    items.forEach(ch => {
        let attributesString = `tvg-id="${ch['tvg-id'] || ''}" tvg-logo="${ch['tvg-logo'] || ''}" group-title="${ch['group-title'] || ''}"`;
        if (ch.attributes) {
            for (const key in ch.attributes) {
                 attributesString += ` ${key}="${ch.attributes[key]}"`;
            }
        }
        m3uString += `#EXTINF:-1 ${attributesString},${ch.name || ''}\n${ch.url || ''}\n`;
    });
    return m3uString;
}

function showXtreamGroupSelectionModal(categories) {
    return new Promise((resolve) => {
        xtreamGroupSelectionResolver = resolve;

        const { live, vod, series } = categories;
        const liveCol = $('#xtreamLiveGroupsCol').hide();
        const vodCol = $('#xtreamVodGroupsCol').hide();
        const seriesCol = $('#xtreamSeriesGroupsCol').hide();

        const setupGroup = (col, listEl, btnSelect, btnDeselect, cats, type) => {
            listEl.empty();
            if (cats && cats.length > 0) {
                cats.forEach(cat => listEl.append(`<li class="list-group-item"><div class="form-check"><input class="form-check-input" type="checkbox" value="${cat.category_id}" id="xtream_${type}_${cat.category_id}" checked><label class="form-check-label" for="xtream_${type}_${cat.category_id}">${escapeHtml(cat.category_name)}</label></div></li>`));
                btnSelect.off('click').on('click', () => listEl.find('input[type="checkbox"]').prop('checked', true));
                btnDeselect.off('click').on('click', () => listEl.find('input[type="checkbox"]').prop('checked', false));
                col.show();
            } else {
                 listEl.append('<li class="list-group-item text-secondary">No disponible</li>');
                 if(cats) col.show();
            }
        };

        setupGroup(liveCol, $('#xtreamLiveGroupList'), $('#xtreamSelectAllLive'), $('#xtreamDeselectAllLive'), live, 'live');
        setupGroup(vodCol, $('#xtreamVodGroupList'), $('#xtreamSelectAllVod'), $('#xtreamDeselectAllVod'), vod, 'vod');
        setupGroup(seriesCol, $('#xtreamSeriesGroupList'), $('#xtreamSelectAllSeries'), $('#xtreamDeselectAllSeries'), series, 'series');

        const groupSelectionModal = new bootstrap.Modal(document.getElementById('xtreamGroupSelectionModal'));
        groupSelectionModal.show();
    });
}

function handleXtreamGroupSelection() {
    const selectedGroups = { live: [], vod: [], series: [] };

    $('#xtreamLiveGroupList input:checked').each(function() { selectedGroups.live.push($(this).val()); });
    $('#xtreamVodGroupList input:checked').each(function() { selectedGroups.vod.push($(this).val()); });
    $('#xtreamSeriesGroupList input:checked').each(function() { selectedGroups.series.push($(this).val()); });

    if (xtreamGroupSelectionResolver) {
        xtreamGroupSelectionResolver(selectedGroups);
        xtreamGroupSelectionResolver = null;
    }

    const groupSelectionModal = bootstrap.Modal.getInstance(document.getElementById('xtreamGroupSelectionModal'));
    if (groupSelectionModal) {
        groupSelectionModal.hide();
    }
}

async function handleConnectXtreamServer() {
    const host = $('#xtreamHostInput').val().trim();
    const username = $('#xtreamUsernameInput').val().trim();
    const password = $('#xtreamPasswordInput').val();
    const outputType = $('#xtreamOutputTypeSelect').val();
    const fetchEpgFlag = $('#xtreamFetchEpgCheck').is(':checked');
    const forceGroupSelection = $('#xtreamForceGroupSelectionCheck').is(':checked');
    const loadLive = $('#xtreamLoadLive').is(':checked');
    const loadVod = $('#xtreamLoadVod').is(':checked');
    const loadSeries = $('#xtreamLoadSeries').is(':checked');
    const serverName = $('#xtreamServerNameInput').val().trim() || host;

    if (!host || !username || !password) {
        showNotification('Host, usuario y contraseña son obligatorios.', 'warning');
        return;
    }
     if (!loadLive && !loadVod && !loadSeries) {
        showNotification('Debes seleccionar al menos un tipo de contenido para cargar.', 'warning');
        return;
    }

    currentXtreamServerInfo = { host, username, password, outputType, name: serverName, fetchEpg: fetchEpgFlag };
    
    showLoading(true, `Conectando a Xtream: ${escapeHtml(serverName)}...`);

    try {
        const playerApiData = await fetchXtreamData();
        displayXtreamInfoBar(playerApiData);

        const existingServer = (await getAllXtreamServersFromDB()).find(s => s.host === host && s.username === username);
        let selectedGroupIds;

        if (existingServer && existingServer.id) {
            currentXtreamServerInfo.id = existingServer.id;
        }

        if (existingServer && existingServer.selectedGroups && !forceGroupSelection) {
            selectedGroupIds = existingServer.selectedGroups;
            showNotification('Usando selección de grupos guardada para este servidor.', 'info');
        } else {
            showLoading(true, 'Obteniendo categorías...');
            let categoryPromises = [];
            if (loadLive) categoryPromises.push(fetchXtreamData('get_live_categories').catch(e => { console.error("Error fetching live categories:", e); return null; }));
            else categoryPromises.push(Promise.resolve(null));

            if (loadVod) categoryPromises.push(fetchXtreamData('get_vod_categories').catch(e => { console.error("Error fetching vod categories:", e); return null; }));
            else categoryPromises.push(Promise.resolve(null));

            if (loadSeries) categoryPromises.push(fetchXtreamData('get_series_categories').catch(e => { console.error("Error fetching series categories:", e); return null; }));
            else categoryPromises.push(Promise.resolve(null));
            
            const [liveCategories, vodCategories, seriesCategories] = await Promise.all(categoryPromises);
            
            $('#xtreamConnectionModal').modal('hide');
            showLoading(false);
            selectedGroupIds = await showXtreamGroupSelectionModal({ live: liveCategories, vod: vodCategories, series: seriesCategories });
            currentXtreamServerInfo.selectedGroups = selectedGroupIds;
            await saveXtreamServerToDB(currentXtreamServerInfo); 
        }

        showLoading(true, `Cargando streams seleccionados de Xtream...`);
        let streamPromises = [];
        if (loadLive && selectedGroupIds.live.length > 0) streamPromises.push(fetchXtreamData('get_live_streams').catch(e => [])); else streamPromises.push(Promise.resolve([]));
        if (loadVod && selectedGroupIds.vod.length > 0) streamPromises.push(fetchXtreamData('get_vod_streams').catch(e => [])); else streamPromises.push(Promise.resolve([]));
        if (loadSeries && selectedGroupIds.series.length > 0) streamPromises.push(fetchXtreamData('get_series').catch(e => [])); else streamPromises.push(Promise.resolve([]));

        let [liveStreams, vodStreams, seriesStreams] = await Promise.all(streamPromises);

        const allCategories = await Promise.all([
            loadLive ? fetchXtreamData('get_live_categories') : Promise.resolve([]),
            loadVod ? fetchXtreamData('get_vod_categories') : Promise.resolve([]),
            loadSeries ? fetchXtreamData('get_series_categories') : Promise.resolve([])
        ]).then(([live, vod, series]) => [...(live||[]), ...(vod||[]), ...(series||[])]);
        
        const categoryMap = {};
        allCategories.forEach(cat => categoryMap[cat.category_id] = cat.category_name);

        xtreamData.live = transformXtreamItems(liveStreams, 'live', currentXtreamServerInfo, categoryMap).filter(item => selectedGroupIds.live.includes(item.attributes['category_id']));
        xtreamData.vod = transformXtreamItems(vodStreams, 'vod', currentXtreamServerInfo, categoryMap).filter(item => selectedGroupIds.vod.includes(item.attributes['category_id']));
        xtreamData.series = transformXtreamItems(seriesStreams, 'series', currentXtreamServerInfo, categoryMap).filter(item => selectedGroupIds.series.includes(item.attributes['category_id']));
        
        channels = [...xtreamData.live, ...xtreamData.vod, ...xtreamData.series];
        currentM3UContent = buildM3UFromString(channels);
        currentM3UName = `Xtream: ${serverName}`;
        currentGroupOrder = [...new Set(channels.map(c => c['group-title']))].sort();
        
        if(userSettings.autoSaveM3U) {
            localStorage.setItem('currentXtreamServerInfo', JSON.stringify(currentXtreamServerInfo));
             localStorage.removeItem('lastM3UUrl');
             localStorage.removeItem('lastM3UFileContent');
             localStorage.removeItem('lastM3UFileName');
        }
        $('#xtreamConnectionModal').modal('hide');
        displayXtreamRootView();

        if (fetchEpgFlag) {
            const epgUrl = `${currentXtreamServerInfo.host.replace(/\/$/, '')}/xmltv.php?username=${encodeURIComponent(currentXtreamServerInfo.username)}&password=${encodeURIComponent(currentXtreamServerInfo.password)}`;
            if (typeof loadEpgFromUrl === 'function') {
                loadEpgFromUrl(epgUrl).catch(err => {
                    console.error("Error cargando EPG de Xtream en segundo plano:", err);
                    if (typeof showNotification === 'function') {
                        showNotification('Fallo al cargar EPG de Xtream: ' + err.message, 'error');
                    }
                });
            }
        }

    } catch (error) {
        showNotification(`Error conectando a Xtream: ${error.message}`, 'error');
        hideXtreamInfoBar();
    } finally {
        showLoading(false);
    }
}

function displayXtreamRootView() {
    navigationHistory = [];
    currentView = { type: 'main' };
    renderCurrentView();
    showNotification(`Xtream: Canales cargados. Live: ${xtreamData.live.length}, VOD: ${xtreamData.vod.length}, Series: ${xtreamData.series.length}`, "success");
}

function transformXtreamItems(items, type, serverInfo, categoryMap) {
    if (!Array.isArray(items)) return [];
    
    return items.map(item => {
        let baseObject = {
            'group-title': categoryMap[item.category_id] || `Xtream ${type}`,
            attributes: {'category_id': item.category_id},
            kodiProps: {}, vlcOptions: {}, extHttp: {},
            sourceOrigin: `xtream-${serverInfo.name || serverInfo.host}`
        };

        if (type === 'live') {
            let streamUrl;
            const serverHost = serverInfo.host.replace(/\/$/, '');
            const ds = item.direct_source ? item.direct_source.trim() : '';

            if (ds) {
                try {
                    new URL(ds); 
                    streamUrl = ds;
                } catch (e) {
                    streamUrl = `${serverHost}${ds.startsWith('/') ? '' : '/'}${ds}`;
                }
            } else {
                let extension;
                switch (serverInfo.outputType) {
                    case 'ts':
                        extension = 'ts';
                        break;
                    case 'hls':
                    case 'm3u_plus':
                    default:
                        extension = 'm3u8';
                        break;
                }
                streamUrl = `${serverHost}/live/${serverInfo.username}/${serverInfo.password}/${item.stream_id}.${extension}`;
            }

            return {
                ...baseObject,
                name: item.name,
                url: streamUrl,
                'tvg-id': item.epg_channel_id || `xtream.${item.stream_id}`,
                'tvg-logo': item.stream_icon || '',
                attributes: { ...baseObject.attributes, 'xtream-type': 'live', 'stream-id': item.stream_id }
            };
        }
        if (type === 'vod') {
            const vodInfo = item.info || {};
            return {
                ...baseObject,
                name: item.name,
                url: `${serverInfo.host.replace(/\/$/, '')}/movie/${serverInfo.username}/${serverInfo.password}/${item.stream_id}.${item.container_extension || 'mp4'}`,
                'tvg-id': `vod.${item.stream_id}`,
                'tvg-logo': item.stream_icon || vodInfo.movie_image || '',
                attributes: { ...baseObject.attributes, 'xtream-type': 'vod', 'stream-id': item.stream_id, 'xtream-info': JSON.stringify(vodInfo) }
            };
        }
        if (type === 'series') {
            return {
                ...baseObject,
                name: item.name,
                url: `#xtream-series-${item.series_id}`,
                'tvg-id': `series.${item.series_id}`,
                'tvg-logo': item.cover || (item.backdrop_path && item.backdrop_path[0]) || '',
                attributes: { ...baseObject.attributes, 'xtream-type': 'series', 'xtream-series-id': item.series_id, 'xtream-info': JSON.stringify(item) }
            };
        }
        return null;
    }).filter(Boolean);
}

async function loadXtreamSeasons(seriesId, seriesName) {
    if (!currentXtreamServerInfo) {
        showNotification("No hay servidor Xtream activo para cargar las temporadas.", "warning");
        return null;
    }
    showLoading(true, `Cargando temporadas para: ${escapeHtml(seriesName)}`);
    try {
        const seriesData = await fetchXtreamData('get_series_info', { series_id: seriesId });
        const seasons = [];
        if (seriesData && seriesData.episodes) {
            const seriesInfo = seriesData.info || {};
            const sortedSeasonKeys = Object.keys(seriesData.episodes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

            for (const seasonNumber of sortedSeasonKeys) {
                seasons.push({
                    name: `Temporada ${seasonNumber}`,
                    'tvg-logo': seriesInfo.cover || '',
                    'group-title': seriesName,
                    season_number: seasonNumber,
                    series_id: seriesId
                });
            }
        }
        return seasons;
    } catch (error) {
        showNotification(`Error cargando temporadas: ${error.message}`, 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

async function loadXtreamSeasonEpisodes(seriesId, seasonNumber) {
    if (!currentXtreamServerInfo) {
        showNotification("No hay servidor Xtream activo para cargar los episodios.", "warning");
        return null;
    }
    showLoading(true, `Cargando episodios para la temporada ${seasonNumber}...`);
    try {
        const seriesData = await fetchXtreamData('get_series_info', { series_id: seriesId });
        const episodes = [];
        const seriesInfo = seriesData.info || {};

        if (seriesData && seriesData.episodes && seriesData.episodes[seasonNumber]) {
            const episodesInSeason = seriesData.episodes[seasonNumber];
            episodesInSeason.sort((a,b) => (a.episode_num || 0) - (b.episode_num || 0));

            episodesInSeason.forEach(ep => {
                const episodeNum = ep.episode_num || 0;
                const episodeInfo = ep.info || {};
                const containerExtension = ep.container_extension || 'mp4';

                episodes.push({
                    name: `${ep.title || 'Episodio ' + episodeNum} (T${seasonNumber}E${episodeNum})`,
                    url: `${currentXtreamServerInfo.host.replace(/\/$/, '')}/series/${currentXtreamServerInfo.username}/${currentXtreamServerInfo.password}/${ep.id}.${containerExtension}`,
                    'tvg-id': `series.ep.${ep.id}`,
                    'tvg-logo': episodeInfo.movie_image || seriesInfo.cover || '',
                    'group-title': `${seriesInfo.name} - Temporada ${seasonNumber}`,
                    attributes: { 'xtream-type': 'episode', 'stream-id': ep.id },
                    kodiProps: {}, vlcOptions: {}, extHttp: {},
                    sourceOrigin: `xtream-${currentXtreamServerInfo.name || currentXtreamServerInfo.host}`
                });
            });
        }
        return episodes;
    } catch (error) {
        showNotification(`Error cargando episodios: ${error.message}`, 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

async function loadXtreamSeriesEpisodes(seriesId, seriesName) {
    if (!currentXtreamServerInfo) {
        showNotification("No hay servidor Xtream activo para cargar episodios.", "warning");
        return;
    }
    showLoading(true, `Cargando episodios para: ${escapeHtml(seriesName)}`);
    try {
        const seriesData = await fetchXtreamData('get_series_info', { series_id: seriesId });
        let episodesForGrid = [];
        const seriesInfo = seriesData.info || {};

        if (seriesData && seriesData.episodes && typeof seriesData.episodes === 'object') {
            const seasons = seriesData.episodes;
            const sortedSeasonKeys = Object.keys(seasons).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

            for (const seasonNumber of sortedSeasonKeys) {
                const episodesInSeason = seasons[seasonNumber];
                if (Array.isArray(episodesInSeason)) {
                    episodesInSeason.sort((a,b) => (a.episode_num || a.episode_number || 0) - (b.episode_num || b.episode_number || 0));

                    episodesInSeason.forEach(ep => {
                        const episodeNum = ep.episode_num || ep.episode_number;
                        const episodeInfo = ep.info || {};
                        const containerExtension = ep.container_extension || 'mp4';

                        episodesForGrid.push({
                            name: `${ep.title || 'Episodio ' + episodeNum} (T${ep.season || seasonNumber}E${episodeNum})`,
                            url: `${currentXtreamServerInfo.host.replace(/\/$/, '')}/series/${currentXtreamServerInfo.username}/${currentXtreamServerInfo.password}/${ep.id}.${containerExtension}`,
                            'tvg-id': `series.ep.${ep.id}`,
                            'tvg-logo': episodeInfo.movie_image || seriesInfo.cover || '',
                            'group-title': `${seriesName} - Temporada ${ep.season || seasonNumber}`,
                            attributes: { 'xtream-type': 'episode', 'stream-id': ep.id },
                            kodiProps: {}, vlcOptions: {}, extHttp: {},
                            sourceOrigin: `xtream-${currentXtreamServerInfo.name || currentXtreamServerInfo.host}`
                        });
                    });
                }
            }
        }
        
        if (episodesForGrid.length > 0) {
            pushNavigationState();
            currentView = { type: 'episode_list', data: episodesForGrid, title: seriesName };
            renderCurrentView();
            showNotification(`${episodesForGrid.length} episodios cargados.`, 'success');
        } else {
            showNotification(`No se encontraron episodios para ${escapeHtml(seriesName)}.`, 'info');
        }

    } catch (error) {
        showNotification(`Error cargando episodios: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}


async function handleSaveXtreamServer() {
    const serverName = $('#xtreamServerNameInput').val().trim();
    const host = $('#xtreamHostInput').val().trim();
    const username = $('#xtreamUsernameInput').val().trim();
    const password = $('#xtreamPasswordInput').val();
    const outputType = $('#xtreamOutputTypeSelect').val();
    const fetchEpg = $('#xtreamFetchEpgCheck').is(':checked');

    if (!host || !username || !password) {
        if (typeof showNotification === 'function') showNotification('Host, usuario y contraseña son obligatorios para guardar.', 'warning');
        return;
    }

    const serverData = { name: serverName || host, host, username, password, outputType, fetchEpg };

    if (typeof showLoading === 'function') showLoading(true, `Guardando servidor Xtream: ${escapeHtml(serverData.name)}...`);
    try {
        await saveXtreamServerToDB(serverData);
        if (typeof showNotification === 'function') showNotification(`Servidor Xtream "${escapeHtml(serverData.name)}" guardado.`, 'success');
        loadSavedXtreamServers();
        $('#xtreamServerNameInput, #xtreamHostInput, #xtreamUsernameInput, #xtreamPasswordInput').val('');
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`Error al guardar servidor: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function loadXtreamServerToForm(id) {
    if (typeof showLoading === 'function') showLoading(true, "Cargando datos del servidor...");
    try {
        const server = await getXtreamServerFromDB(id);
        if (server) {
            $('#xtreamServerNameInput').val(server.name || '');
            $('#xtreamHostInput').val(server.host || '');
            $('#xtreamUsernameInput').val(server.username || '');
            $('#xtreamPasswordInput').val(server.password || '');
            $('#xtreamOutputTypeSelect').val(server.outputType || 'm3u_plus');
            $('#xtreamFetchEpgCheck').prop('checked', typeof server.fetchEpg === 'boolean' ? server.fetchEpg : true);
            if (typeof showNotification === 'function') showNotification(`Datos del servidor "${escapeHtml(server.name || server.host)}" cargados.`, 'info');
        } else {
            if (typeof showNotification === 'function') showNotification('Servidor no encontrado.', 'error');
        }
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`Error al cargar servidor: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function handleDeleteXtreamServer(id) {
    const serverToDelete = await getXtreamServerFromDB(id);
    const serverName = serverToDelete ? (serverToDelete.name || serverToDelete.host) : 'este servidor';

    if (!confirm(`¿Estás seguro de eliminar el servidor Xtream "${escapeHtml(serverName)}"?`)) return;

    if (typeof showLoading === 'function') showLoading(true, `Eliminando servidor "${escapeHtml(serverName)}"...`);
    try {
        await deleteXtreamServerFromDB(id);
        if (typeof showNotification === 'function') showNotification(`Servidor Xtream "${escapeHtml(serverName)}" eliminado.`, 'success');
        loadSavedXtreamServers();
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`Error al eliminar servidor: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}