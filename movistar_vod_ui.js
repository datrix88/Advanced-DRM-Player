const MOVISTAR_VOD_API_BASE_URL = 'https://ottcache.dof6.com/movistarplus/webplayer/OTT/epg';
const MOVISTAR_VOD_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MOVISTAR_VOD_ITEMS_PER_PAGE = 48;

let movistarVodData = [];
let movistarVodSelectedDate = new Date();
let movistarVodChannelMap = {};
let movistarVodOrderedChannels = [];
let movistarVodGenreMap = {};
let movistarVodSelectedChannelId = '';
let movistarVodSelectedGenre = '';
let movistarVodSearchTerm = '';
let movistarVodCurrentPage = 1;
let movistarVodFilteredPrograms = [];

function openMovistarVODModal() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    $('#movistarVODDateInput').val(`${yyyy}-${mm}-${dd}`);
    movistarVodSelectedDate = today;
    $('#movistarVODModal-search-input').val('');
    movistarVodSearchTerm = '';
    movistarVodCurrentPage = 1;

    $('#movistarVODModal').modal('show');
    loadMovistarVODData();
}

async function loadMovistarVODData() {
    showLoading(true, "Cargando EPG de Movistar VOD...");
    const programsContainer = $('#movistarVODModal-programs').empty();
    const noResultsP = $('#movistarVODModal-no-results');

    noResultsP.addClass('d-none');
    programsContainer.html('<div class="w-100 text-center p-3"><i class="fas fa-spinner fa-spin fa-2x"></i></div>');

    const yyyy = movistarVodSelectedDate.getFullYear();
    const mm = String(movistarVodSelectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(movistarVodSelectedDate.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    let jsonDataFromCache = null;
    try {
        const cachedRecord = await getMovistarVodData(dateString);
        if (cachedRecord && cachedRecord.data && cachedRecord.timestamp) {
            if ((new Date().getTime() - cachedRecord.timestamp) < MOVISTAR_VOD_CACHE_MAX_AGE_MS) {
                jsonDataFromCache = cachedRecord.data;
                showNotification("Datos VOD cargados desde caché local.", "info");
            } else {
                 showNotification("Datos VOD en caché expirados, obteniendo nuevos...", "info");
            }
        }
    } catch (e) {
        console.warn("Error al cargar VOD desde caché:", e);
    }

    try {
        let processedDataForDisplay;
        if (jsonDataFromCache) {
            processedDataForDisplay = jsonDataFromCache;
        } else {
            const apiUrl = `${MOVISTAR_VOD_API_BASE_URL}?from=${dateString}T06:00:00&span=1&channel=&network=movistarplus&version=8.2&mdrm=true&tlsstream=true&demarcation=1`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status} al cargar VOD.`);
            }
            const rawJsonData = await response.json();
            
            let processedProgramsToCache = [];
            if (Array.isArray(rawJsonData)) {
                rawJsonData.forEach(channelProgramArray => {
                    if (Array.isArray(channelProgramArray)) {
                        channelProgramArray.forEach(prog => {
                            processedProgramsToCache.push({
                                Titulo: prog.Titulo,
                                CanalNombre: prog.Canal?.Nombre,
                                CanalServiceUid2: prog.Canal?.ServiceUid2,
                                FechaHoraInicio: prog.FechaHoraInicio,
                                FechaHoraFin: prog.FechaHoraFin,
                                Duracion: prog.Duracion,
                                GeneroComAntena: prog.GeneroComAntena,
                                Ficha: prog.Ficha,
                                IdPrograma: prog.IdPrograma,
                                ImagenMiniatura: prog.ImagenMiniatura
                            });
                        });
                    }
                });
            }
            processedDataForDisplay = processedProgramsToCache;
            
            try {
                await saveMovistarVodData(dateString, { data: processedProgramsToCache, timestamp: new Date().getTime() });
                const deletedOldCount = await deleteOldMovistarVodData(userSettings.movistarVodCacheDaysToKeep);
                if (deletedOldCount > 0) {
                    console.log(`Se eliminaron ${deletedOldCount} registros VOD antiguos de la caché.`);
                     if (typeof updateMovistarVodCacheStatsUI === 'function') {
                         updateMovistarVodCacheStatsUI();
                    }
                }
            } catch(dbError) {
                console.warn("Error guardando/limpiando VOD en DB:", dbError);
                showNotification("Error guardando datos VOD en caché local.", "warning");
            }
        }

        movistarVodData = Array.isArray(processedDataForDisplay) ? processedDataForDisplay : [];

        movistarVodChannelMap = {};
        movistarVodGenreMap = {};
        const seenChannelIds = new Set();
        movistarVodOrderedChannels = [];
        
        if (movistarVodData.length === 0) {
            noResultsP.removeClass('d-none');
            programsContainer.empty();
        } else {
             movistarVodData.forEach(prog => {
                if (prog.CanalServiceUid2 && prog.CanalNombre) {
                    if (!seenChannelIds.has(prog.CanalServiceUid2)) {
                        movistarVodOrderedChannels.push({ id: prog.CanalServiceUid2, name: prog.CanalNombre });
                        seenChannelIds.add(prog.CanalServiceUid2);
                    }
                    movistarVodChannelMap[prog.CanalServiceUid2] = prog.CanalNombre;
                }
                if (prog.GeneroComAntena && !movistarVodGenreMap[prog.GeneroComAntena]) {
                    movistarVodGenreMap[prog.GeneroComAntena] = prog.GeneroComAntena;
                }
            });
        }

        if (userSettings.useMovistarVodAsEpg && typeof updateEpgWithMovistarVodData === 'function') {
            await updateEpgWithMovistarVodData(dateString, movistarVodData);
        }

        movistarVodCurrentPage = 1;
        populateMovistarVODFilters();
        renderMovistarVODPrograms();

    } catch (error) {
        console.error("Error al cargar Movistar VOD data:", error);
        showNotification(`Error cargando EPG VOD: ${error.message}`, 'error');
        programsContainer.empty();
        noResultsP.removeClass('d-none');
        movistarVodData = [];
        movistarVodChannelMap = {};
        movistarVodGenreMap = {};
        populateMovistarVODFilters();
    } finally {
        showLoading(false);
    }
}

function populateMovistarVODFilters() {
    const channelFilter = $('#movistarVODModal-channel-filter').empty().append('<option value="">Todos los canales</option>');
    const genreFilter = $('#movistarVODModal-genre-filter').empty().append('<option value="">Todos los géneros</option>');

    movistarVodOrderedChannels.forEach(ch => {
        channelFilter.append(`<option value="${escapeHtml(ch.id)}">${escapeHtml(ch.name)}</option>`);
    });

    if (movistarVodSelectedChannelId && movistarVodChannelMap[movistarVodSelectedChannelId]) {
        channelFilter.val(movistarVodSelectedChannelId);
    }

    const sortedGenres = Object.keys(movistarVodGenreMap).sort((a,b) => a.localeCompare(b));
    sortedGenres.forEach(genre => {
        genreFilter.append(`<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`);
    });
     if (movistarVodSelectedGenre && movistarVodGenreMap[movistarVodSelectedGenre]) {
        genreFilter.val(movistarVodSelectedGenre);
    }
}

function renderMovistarVODPrograms() {
    movistarVodSelectedChannelId = $('#movistarVODModal-channel-filter').val();
    movistarVodSelectedGenre = $('#movistarVODModal-genre-filter').val();
    movistarVodSearchTerm = $('#movistarVODModal-search-input').val().toLowerCase().trim();

    movistarVodFilteredPrograms = movistarVodData.filter(prog => {
        if (movistarVodSelectedChannelId && prog.CanalServiceUid2 !== movistarVodSelectedChannelId) return false;
        if (movistarVodSelectedGenre && prog.GeneroComAntena !== movistarVodSelectedGenre) return false;
        if (movistarVodSearchTerm && !prog.Titulo?.toLowerCase().includes(movistarVodSearchTerm)) return false;
        return true;
    });
    
    movistarVodCurrentPage = 1;
    displayCurrentMovistarVODPage();
    updateMovistarVODPaginationControls();
}

async function displayCurrentMovistarVODPage() {
    const programsContainer = $('#movistarVODModal-programs').empty();
    const noResultsP = $('#movistarVODModal-no-results');

    const startIndex = (movistarVodCurrentPage - 1) * MOVISTAR_VOD_ITEMS_PER_PAGE;
    const endIndex = startIndex + MOVISTAR_VOD_ITEMS_PER_PAGE;
    const programsToDisplay = movistarVodFilteredPrograms.slice(startIndex, endIndex);

    if (programsToDisplay.length > 0) {
        noResultsP.addClass('d-none');
        const fragment = document.createDocumentFragment();

        const imageFetchPromises = programsToDisplay.map(async (prog) => {
            let finalImageUrl = prog.ImagenMiniatura || 'icons/icon128.png';
            if (prog.Ficha) {
                try {
                    const response = await fetch(prog.Ficha);
                    if (response.ok) {
                        const fichaData = await response.json();
                        if (fichaData && fichaData.Imagen) {
                            finalImageUrl = fichaData.Imagen;
                        }
                    }
                } catch (e) {
                    console.error(`Error en fetch a ${prog.Ficha} para ${prog.Titulo}: ${e}`);
                }
            }
            return finalImageUrl;
        });

        const imageUrls = await Promise.all(imageFetchPromises);

        programsToDisplay.forEach((prog, index) => {
            const imageUrl = imageUrls[index];
            const card = document.createElement('div');
            card.className = 'movistar-vod-card';
            card.dataset.programArrayIndex = startIndex + index;

            const startTime = new Date(parseInt(prog.FechaHoraInicio)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(parseInt(prog.FechaHoraFin)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div class="movistar-vod-card-img-container">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(prog.Titulo || '')}" loading="lazy" onerror="this.onerror=null;this.src='icons/icon128.png';">
                </div>
                <div class="movistar-vod-card-body">
                    <h5 class="movistar-vod-card-title" title="${escapeHtml(prog.Titulo || '')}">${escapeHtml(prog.Titulo || 'Sin título')}</h5>
                    <p class="movistar-vod-card-channel">${escapeHtml(prog.CanalNombre || 'Desconocido')}</p>
                    <p class="movistar-vod-card-time">${startTime} - ${endTime} (${prog.Duracion} min)</p>
                    ${prog.GeneroComAntena ? `<p class="movistar-vod-card-genre">${escapeHtml(prog.GeneroComAntena)}</p>` : ''}
                </div>
            `;
            fragment.appendChild(card);
        });
        programsContainer.append(fragment);
    } else {
        noResultsP.removeClass('d-none');
    }
}

function updateMovistarVODPaginationControls() {
    const totalItems = movistarVodFilteredPrograms.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / MOVISTAR_VOD_ITEMS_PER_PAGE));
    const controlsContainer = $('#movistarVODModal-pagination-controls');
    const pageInfoSpan = $('#movistarVODModal-page-info');
    const prevButton = $('#movistarVODModal-prev-page');
    const nextButton = $('#movistarVODModal-next-page');

    if (totalPages <= 1) {
        controlsContainer.hide();
        return;
    }

    controlsContainer.show();
    pageInfoSpan.text(`Página ${movistarVodCurrentPage} de ${totalPages} (${totalItems} resultados)`);
    prevButton.prop('disabled', movistarVodCurrentPage === 1);
    nextButton.prop('disabled', movistarVodCurrentPage === totalPages);
}

function handleMovistarVODProgramClick(programData) {
    showMovistarVODProgramDetailsModal(programData);
}

async function showMovistarVODProgramDetailsModal(programData) {
    const modalBody = $('#movistarVODProgramDetailsBody').empty();
    const modalLabel = $('#movistarVODProgramDetailsModalLabel');
    const playButton = $('#playMovistarVODProgramFromDetailsBtn').off('click');
    const addButton = $('#addMovistarVODToM3UFromDetailsBtn').off('click');

    modalLabel.text(escapeHtml(programData.Titulo || 'Detalles del Programa'));

    let imageUrl = programData.ImagenMiniatura || 'icons/icon128.png';
    let fichaData = null;

    if (programData.Ficha) {
        try {
            showLoading(true, "Cargando detalles...");
            const response = await fetch(programData.Ficha);
            if (response.ok) {
                fichaData = await response.json();
                if (fichaData && fichaData.Imagen) {
                    imageUrl = fichaData.Imagen;
                }
            }
        } catch (e) {
            console.error(`Error obteniendo ficha para ${programData.Titulo}: ${e}`);
            showNotification("Error cargando detalles adicionales del programa.", "warning");
        } finally {
            showLoading(false);
        }
    }

    let detailsHtml = `<div class="row"><div class="col-md-4 text-center"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(programData.Titulo)}" class="img-fluid rounded mb-3" style="max-height: 300px; object-fit: contain; background-color: var(--bg-tertiary);"></div><div class="col-md-8">`;

    detailsHtml += `<h5>${escapeHtml(programData.Titulo || 'Sin título')}</h5>`;
    detailsHtml += `<p><strong>Canal:</strong> ${escapeHtml(programData.CanalNombre || 'Desconocido')}</p>`;
    detailsHtml += `<p><strong>Duración:</strong> ${escapeHtml(formatVodDuration(programData.Duracion))}</p>`;
    if (fichaData?.Anno) detailsHtml += `<p><strong>Año:</strong> ${escapeHtml(fichaData.Anno)}</p>`;
    if (fichaData?.Nacionalidad) detailsHtml += `<p><strong>Nacionalidad:</strong> ${escapeHtml(fichaData.Nacionalidad)}</p>`;

    const description = fichaData?.Descripcion || fichaData?.Sinopsis;
    if (description) detailsHtml += `<p class="text-break"><strong>Descripción:</strong> ${escapeHtml(description)}</p>`;
    if (fichaData?.Actores) detailsHtml += `<p class="text-break"><strong>Actores:</strong> ${escapeHtml(fichaData.Actores)}</p>`;
    if (fichaData?.Directores) detailsHtml += `<p class="text-break"><strong>Directores:</strong> ${escapeHtml(fichaData.Directores)}</p>`;
    if (fichaData?.Valoracion?.Valoracion) {
        detailsHtml += `<p><strong>Valoración:</strong> ${escapeHtml(fichaData.Valoracion.Valoracion.toFixed(1))}⭐ (${escapeHtml(fichaData.Valoracion.Valoraciones)} votos)</p>`;
    }
    detailsHtml += `</div></div>`;
    modalBody.html(detailsHtml);

    playButton.on('click', () => {
        handlePlayCatchup(null, programData);
        $('#movistarVODProgramDetailsModal').modal('hide');
    });

    addButton.on('click', () => {
        addMovistarVODToM3U(programData, fichaData);
    });

    $('#movistarVODProgramDetailsModal').modal('show');
}

function formatVodDuration(minutes) {
    if (isNaN(minutes) || minutes <= 0) return 'N/D';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let str = '';
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}min`;
    return str.trim() || `${minutes} min`;
}

async function addMovistarVODToM3U(programData, fichaData) {
    if (!channels || channels.length === 0) {
        showNotification("Debes tener una lista M3U de Movistar+ cargada para añadir contenido VOD/Catchup.", "warning");
        return;
    }
    const serviceUid2 = programData.CanalServiceUid2;
    if (!serviceUid2) {
        showNotification("El programa seleccionado no tiene un ServiceUid2 válido para buscar el canal M3U base.", "error");
        return;
    }
    const m3uChannelBase = channels.find(ch => {
        if (ch.url && (ch.url.includes(`/${serviceUid2}/`) || ch.url.includes(`/CVXCH${serviceUid2}/`))) return true;
        const tvgIdServiceUid = ch['tvg-id'] ? ch['tvg-id'].split('.').pop() : null;
        if (tvgIdServiceUid === serviceUid2) return true;
        if (ch.attributes && ch.attributes['ch-number'] && ch.attributes['ch-number'] === serviceUid2) return true;
        return false;
    });
    if (!m3uChannelBase) {
        showNotification(`No se encontró el canal M3U base (${programData.CanalNombre || serviceUid2}) en tu lista actual para añadir el VOD.`, "warning");
        return;
    }

    const programStartTime = new Date(parseInt(programData.FechaHoraInicio));
    const programEndTime = new Date(parseInt(programData.FechaHoraFin));
    const catchupUrl = buildMovistarCatchupUrl(m3uChannelBase, programStartTime, programEndTime);

    if (!catchupUrl) {
        showNotification("No se pudo generar la URL de catchup para este programa/canal.", "error");
        return;
    }

    const newVodChannelObject = {
        name: `${programData.Titulo || 'Programa VOD'} (${m3uChannelBase.name})`,
        url: catchupUrl,
        'tvg-id': `vod.${programData.IdPrograma}_${serviceUid2}`,
        'tvg-logo': fichaData?.Imagen || programData.ImagenMiniatura || m3uChannelBase['tvg-logo'] || '',
        'group-title': `VOD - ${m3uChannelBase['group-title'] || programData.CanalNombre || 'Movistar'}`,
        attributes: {
            'tvg-id': `vod.${programData.IdPrograma}_${serviceUid2}`,
            'tvg-logo': fichaData?.Imagen || programData.ImagenMiniatura || m3uChannelBase['tvg-logo'] || '',
            'group-title': `VOD - ${m3uChannelBase['group-title'] || programData.CanalNombre || 'Movistar'}`,
            duration: programData.Duracion || -1,
        },
        kodiProps: { ...m3uChannelBase.kodiProps, 'inputstream.adaptive.play_timeshift_buffer': 'true' },
        vlcOptions: { ...m3uChannelBase.vlcOptions },
        extHttp: { ...m3uChannelBase.extHttp },
        sourceOrigin: m3uChannelBase.sourceOrigin || `movistar-vod-${serviceUid2}`
    };

    channels.push(newVodChannelObject);
    const newGroup = newVodChannelObject['group-title'];
    if (currentGroupOrder && !currentGroupOrder.includes(newGroup)) {
        currentGroupOrder.push(newGroup);
    }
    if (typeof regenerateCurrentM3UContentFromString === 'function') regenerateCurrentM3UContentFromString();
    if (typeof filterAndRenderChannels === 'function') filterAndRenderChannels();

    showNotification(`"${escapeHtml(programData.Titulo)}" añadido a la lista M3U.`, "success");
    $('#movistarVODProgramDetailsModal').modal('hide');
}

function toISOUTCString(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function buildMovistarCatchupUrl(originalM3UChannel, programStartDt, programEndDt) {
    if (!originalM3UChannel || !originalM3UChannel.url || !programStartDt || !programEndDt) {
        console.error("buildMovistarCatchupUrl: Parámetros inválidos.");
        return null;
    }

    const originalUrlStr = originalM3UChannel.url;
    if (!originalUrlStr.toLowerCase().includes('.cdn.telefonica.com/') && !originalUrlStr.toLowerCase().includes('.movistarplus.es/')) {
        console.warn("buildMovistarCatchupUrl: La URL no parece ser de Movistar CDN:", originalUrlStr);
        return null;
    }

    let serviceIdFromM3U = null;
    const serviceIdRegexes = [
        /\/(\d{3,6})\/vxfmt=dp\//i,
        /\/CVXCH(\d{3,6})\//i,
        /\/([A-Za-z0-9_-]+)\.MS\/vxfmt=dp/i
    ];

    let serviceIdFromUrl = null;
    for (const regex of serviceIdRegexes) {
        const match = originalUrlStr.match(regex);
        if (match && match[1]) {
            serviceIdFromUrl = match[1];
            break;
        }
    }

    if (originalM3UChannel['tvg-id']) {
        const tvgId = String(originalM3UChannel['tvg-id']);
        const idParts = tvgId.split('.');
        const potentialIdFromTvg = idParts[idParts.length - 1];
        if (/^\d+$/.test(potentialIdFromTvg) || potentialIdFromTvg.includes('.MS')) {
            serviceIdFromM3U = potentialIdFromTvg;
        } else if (originalM3UChannel.attributes && originalM3UChannel.attributes['ch-number'] && /^\d+$/.test(originalM3UChannel.attributes['ch-number'])) {
             serviceIdFromM3U = originalM3UChannel.attributes['ch-number'];
        }
    } else if (originalM3UChannel.attributes && originalM3UChannel.attributes['ch-number'] && /^\d+$/.test(originalM3UChannel.attributes['ch-number'])) {
        serviceIdFromM3U = originalM3UChannel.attributes['ch-number'];
    }

    const effectiveServiceIdForPath = serviceIdFromUrl || serviceIdFromM3U;

    if (!effectiveServiceIdForPath) {
        console.warn("buildMovistarCatchupUrl: No se pudo extraer un Service ID válido de la URL del canal o del M3U:", originalUrlStr, "tvg-id:", originalM3UChannel['tvg-id']);
        return null;
    }

    const domainMatch = originalUrlStr.match(/https?:\/\/([^/]+)/);
    if (!domainMatch || !domainMatch[1]) {
        console.warn("buildMovistarCatchupUrl: No se pudo extraer el dominio de la URL del canal:", originalUrlStr);
        return null;
    }
    const domain = domainMatch[1];

    const startTimeStr = toISOUTCString(programStartDt);
    const endTimeStr = toISOUTCString(programEndDt);

    if (!startTimeStr || !endTimeStr) {
        console.warn("buildMovistarCatchupUrl: Fechas de inicio o fin del programa inválidas para catchup.");
        return null;
    }

    let originalUrlObj;
    try {
      originalUrlObj = new URL(originalUrlStr);
    } catch (e) {
        console.error("buildMovistarCatchupUrl: URL original inválida:", originalUrlStr, e);
        return null;
    }

    let basePathForCatchup;
    const originalPath = originalUrlObj.pathname;
    const liveStreamSuffix = "/vxfmt=dp/Manifest.mpd";
    const indexOfLiveSuffix = originalPath.lastIndexOf(liveStreamSuffix);

    if (indexOfLiveSuffix !== -1) {
        const channelPathPrefix = originalPath.substring(0, indexOfLiveSuffix);
        basePathForCatchup = `${channelPathPrefix}${liveStreamSuffix}`;
    } else {
        basePathForCatchup = `/${effectiveServiceIdForPath}${liveStreamSuffix}`;
    }

    basePathForCatchup = basePathForCatchup.replace(/\/\//g, '/');
    if (!basePathForCatchup.startsWith('/')) {
        basePathForCatchup = '/' + basePathForCatchup;
    }

    const queryParamsToEncode = new URLSearchParams();
    originalUrlObj.searchParams.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'start_time' && lowerKey !== 'end_time' && lowerKey !== 'token') {
            queryParamsToEncode.set(key, value);
        }
    });

    if (!queryParamsToEncode.has('device_profile')) {
        queryParamsToEncode.set('device_profile', 'DASH_TV_WIDEVINE');
    }

    let encodedQueryPart = queryParamsToEncode.toString();
    let timeParamsStringPart = `start_time=${startTimeStr}&end_time=${endTimeStr}`;

    let finalQueryString;
    if (encodedQueryPart) {
        finalQueryString = `${encodedQueryPart}&${timeParamsStringPart}`;
    } else {
        finalQueryString = timeParamsStringPart;
    }

    const finalCatchupUrl = `https://${domain}${basePathForCatchup}?${finalQueryString}`;
    return finalCatchupUrl;
}