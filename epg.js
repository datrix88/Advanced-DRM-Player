let epgPrograms = [];
let epgChannelIcons = {};
let epgDataByChannelId = {};
let epgChannelDisplayNames = {};
let epgLastLoadTime = null;
let orderedEpgChannelIds = [];
let epgMatchInProgress = false;

let epgMinTimeMs = 0;
let epgMaxTimeMs = 0;
let epgCurrentTimeLineInterval = null;
let infobarHideTimeout = null;
let epgProgressUpdateIntervalId = null;
let dynamicMovistarEpgUpdateIntervalId = null;

function bindEpgEvents() {
    $('#openEpgModalBtn').on('click', () => $('#epgModal').modal('show'));
    
    $('#epgModal').on('shown.bs.modal', () => {
        $('#epgUrlInputModal').val(userSettings.lastEpgUrl || userSettings.defaultEpgUrl);
        const now = new Date().getTime();
        if (orderedEpgChannelIds.length === 0 || !epgLastLoadTime || (epgLastLoadTime && now - epgLastLoadTime > 60 * 60 * 1000)) {
        }
        populateEPGChannelsModal(); renderEPGTimeBar(); renderEPGProgramsLazy(); startCurrentTimeLineUpdater();
    });

    $('#loadEpgBtnModal').on('click', () => {
        const url = $('#epgUrlInputModal').val().trim();
        if (url) loadEpgFromUrl(url); else showNotification('Introduce una URL EPG válida.', 'error');
    });

    let isSyncingScrollEPG = false;
    const epgChannelListEl = $('#epgChannelsList')[0];
    const epgProgramContainerEl = $('#epgProgramsContainer')[0];
    const epgTimeBarHeaderElParent = $('#epgTimeBar').parent()[0];

    function syncEpgScroll(source, target1, target2, isVertical) {
        if (isSyncingScrollEPG) return;
        isSyncingScrollEPG = true;
        if (isVertical) {
            if(target1) target1.scrollTop = source.scrollTop;
            if (target2) target2.scrollTop = source.scrollTop;
        } else {
            if(target1) target1.scrollLeft = source.scrollLeft;
            if (target2) target2.scrollLeft = source.scrollLeft;
        }
        requestAnimationFrame(() => isSyncingScrollEPG = false);
    }

    if (epgChannelListEl && epgProgramContainerEl && epgTimeBarHeaderElParent) {
        $(epgChannelListEl).on('scroll', function () { syncEpgScroll(this, epgProgramContainerEl, null, true); });
        $(epgProgramContainerEl).on('scroll', function () {
            syncEpgScroll(this, epgChannelListEl, null, true);
            syncEpgScroll(this, epgTimeBarHeaderElParent, null, false);
        });
        $(epgTimeBarHeaderElParent).on('scroll', function () { syncEpgScroll(this, epgProgramContainerEl, null, false); });
    }

     $('#forceEpgRematchBtn').on('click', () => {
        if (channels.length > 0 && (Object.keys(epgDataByChannelId).length > 0 || userSettings.useMovistarVodAsEpg)) {
                matchChannelsWithEpg(true)
                .then(async () => {
                    if (userSettings.useMovistarVodAsEpg) {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        await updateEpgWithMovistarVodData(`${yyyy}-${mm}-${dd}`);
                    }
                })
                .catch(error => {
                    console.error("Error durante el re-emparejamiento forzado desde botón:", error);
                    showNotification("Error durante el re-emparejamiento EPG.", "error");
                    showLoading(false);
                });
        } else {
            showNotification('Carga una lista M3U y un EPG (o activa VOD EPG en ajustes) primero.', 'info');
        }
    });
}

function getEpgChannelIcon(epgId) {
    if (epgId && epgId.startsWith('movistar.')) {
        const m3uChannel = channels.find(ch => ch.effectiveEpgId === epgId);
        return m3uChannel ? m3uChannel['tvg-logo'] : null;
    }
    return epgChannelIcons[epgId] || null;
}

function getEpgDataForChannel(epgId) {
    return epgDataByChannelId[epgId] || [];
}

function getEpgLastLoadTimestamp() {
    return epgLastLoadTime;
}

function getMovistarServiceUidFromM3UChannel(m3uChannel) {
    if (!m3uChannel) return null;

    if (m3uChannel['tvg-id']) {
        const tvgId = String(m3uChannel['tvg-id']);
        let match = tvgId.match(/^(?:CVXCH)?(\d{3,6})(?:\.MS)?$/i);
        if (match && match[1]) return match[1];
        match = tvgId.match(/\.(\d{3,6})$/);
        if (match && match[1]) return match[1];
    }

    if (m3uChannel.attributes && m3uChannel.attributes['ch-number'] && /^\d{3,6}$/.test(m3uChannel.attributes['ch-number'])) {
        return m3uChannel.attributes['ch-number'];
    }
    
    if (m3uChannel.url) {
        const url = m3uChannel.url;
        let match = url.match(/\/CVXCH(\d{3,6})\//i);
        if (match && match[1]) return match[1];
        match = url.match(/\/(\d{3,6})\/vxfmt=dp\//i);
        if (match && match[1]) return match[1];
         match = url.match(/\/(?:deliverty)\/([A-Za-z0-9_-]+?)(?:\.MS)?\//i);
        if (match && match[1] && /^\d{3,6}$/.test(match[1].replace('.MS',''))) return match[1].replace('.MS','');
    }
    return null;
}

async function matchChannelsWithEpg(forceRematch = false) {
    if (epgMatchInProgress && !forceRematch) return;
     if (channels.length === 0 || (Object.keys(epgDataByChannelId).length === 0 && !userSettings.useMovistarVodAsEpg)) {
        channels.forEach(ch => { ch.effectiveEpgId = null; });
        if (typeof filterAndRenderChannels === 'function') {
             if (currentFilter !== 'all') { filterAndRenderChannels(); } else { renderChannels(); }
        }
        return;
    }

    epgMatchInProgress = true;
    if (forceRematch) {
        showLoading(true, 'Re-emparejando EPG, esto puede tardar...');
    }

    let matchesFoundByTvgId = 0;
    let matchesFoundByName = 0;
    let matchesFoundByMovistarId = 0;
    const batchSize = 200;

    for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        for (const m3uChannel of batch) {
            m3uChannel.effectiveEpgId = null;
            const tvgId = (m3uChannel['tvg-id'] || '').toLowerCase().trim();

            if (tvgId && epgDataByChannelId[tvgId]) {
                m3uChannel.effectiveEpgId = tvgId;
                matchesFoundByTvgId++;
                continue;
            }

            if (userSettings.useMovistarVodAsEpg && !m3uChannel.effectiveEpgId) {
                const serviceUid = getMovistarServiceUidFromM3UChannel(m3uChannel);
                if (serviceUid) {
                    const movistarEpgId = `movistar.${serviceUid}`;
                    m3uChannel.effectiveEpgId = movistarEpgId;
                    matchesFoundByMovistarId++;
                    continue;
                }
            }
        }
        if (forceRematch) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    if (userSettings.enableEpgNameMatching && Object.keys(epgChannelDisplayNames).length > 0) {
        const epgChannelIds = Object.keys(epgChannelDisplayNames);
        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);
            for (const m3uChannel of batch) {
                if (m3uChannel.effectiveEpgId) continue;
                let bestMatch = { id: null, score: 0 };
                const m3uName = m3uChannel.name;

                for (const epgId of epgChannelIds) {
                    const epgName = epgChannelDisplayNames[epgId];
                    if (epgName) {
                        const similarity = getStringSimilarity(m3uName, epgName);
                        if (similarity > bestMatch.score) {
                            bestMatch = { id: epgId, score: similarity };
                        }
                    }
                }

                if (bestMatch.id && bestMatch.score >= userSettings.epgNameMatchThreshold) {
                    m3uChannel.effectiveEpgId = bestMatch.id;
                    matchesFoundByName++;
                }
            }
            if (forceRematch) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
    
    if (forceRematch) {
        showLoading(false);
    }
    epgMatchInProgress = false;

    let notificationMsg = `EPG Re-emparejado: ${matchesFoundByTvgId} por ID (XMLTV), ${matchesFoundByName} por nombre (XMLTV).`;
    if (userSettings.useMovistarVodAsEpg) {
        notificationMsg += ` ${matchesFoundByMovistarId} canales Movistar identificados para VOD EPG.`;
    }

    if (forceRematch) {
        if (matchesFoundByTvgId > 0 || matchesFoundByName > 0 || matchesFoundByMovistarId > 0) {
            showNotification(notificationMsg, 'success');
        } else {
            showNotification('No se encontraron nuevas coincidencias EPG.', 'info');
        }
    }
    
    if (typeof filterAndRenderChannels === 'function') {
        if (currentFilter !== 'all') { filterAndRenderChannels(); } else { renderChannels(); }
    }
    if (typeof updateEPGProgressBarOnCards === 'function') {
        updateEPGProgressBarOnCards();
    }
}

function transformMovistarVodProgram(vodProgram) {
    if (!vodProgram || !vodProgram.FechaHoraInicio || !vodProgram.FechaHoraFin || !vodProgram.CanalServiceUid2) return null;
    return {
        channel: `movistar.${vodProgram.CanalServiceUid2}`,
        startDt: new Date(parseInt(vodProgram.FechaHoraInicio)),
        stopDt: new Date(parseInt(vodProgram.FechaHoraFin)),
        title: vodProgram.Titulo || 'Programa sin título',
        desc: vodProgram.Ficha?.Descripcion || vodProgram.Ficha?.SinopsisLarga || vodProgram.Ficha?.Sinopsis || '',
        category: vodProgram.GeneroComAntena || '',
        icon: vodProgram.ImagenMiniatura || vodProgram.Ficha?.Imagen || '',
        date: vodProgram.Ficha?.Anno || '',
        isMovistarVod: true,
        CanalServiceUid2: vodProgram.CanalServiceUid2
    };
}

async function updateEpgWithMovistarVodData(dateString, vodProgramsForDate = null) {
    if (!userSettings.useMovistarVodAsEpg || channels.length === 0) return;

    let programsToProcess = vodProgramsForDate;
    if (!programsToProcess) {
        try {
            const cachedRecord = await getMovistarVodData(dateString);
            if (cachedRecord && cachedRecord.data) {
                programsToProcess = cachedRecord.data;
            } else {
                return;
            }
        } catch (e) {
            console.error(`Error obteniendo VOD de caché para EPG (${dateString}):`, e);
            return;
        }
    }
    
    if (!programsToProcess || programsToProcess.length === 0) {
        return;
    }

    let updatedChannelCount = 0;
    channels.forEach(m3uChannel => {
        if (m3uChannel.effectiveEpgId && m3uChannel.effectiveEpgId.startsWith('movistar.')) {
            const serviceUid2 = m3uChannel.effectiveEpgId.split('.')[1];
            if (serviceUid2) {
                const channelVodPrograms = programsToProcess.filter(p => p.CanalServiceUid2 === serviceUid2);
                if (channelVodPrograms.length > 0) {
                    const transformedPrograms = channelVodPrograms.map(transformMovistarVodProgram).filter(Boolean);
                    transformedPrograms.sort((a, b) => a.startDt - b.startDt);
                    epgDataByChannelId[m3uChannel.effectiveEpgId] = transformedPrograms;
                    
                    if (!epgChannelDisplayNames[m3uChannel.effectiveEpgId]) {
                        epgChannelDisplayNames[m3uChannel.effectiveEpgId] = m3uChannel.name || `Movistar ${serviceUid2}`;
                    }
                     if (!orderedEpgChannelIds.includes(m3uChannel.effectiveEpgId)) {
                        orderedEpgChannelIds.push(m3uChannel.effectiveEpgId); 
                    }
                    updatedChannelCount++;
                }
            }
        }
    });
    
    if (updatedChannelCount > 0) {
        if (typeof filterAndRenderChannels === 'function') filterAndRenderChannels();
        if (typeof updateEPGProgressBarOnCards === 'function') updateEPGProgressBarOnCards();
        if ($('#epgModal').is(':visible')) {
            populateEPGChannelsModal();
            renderEPGProgramsLazy();
        }
    }
}

function startDynamicEpgUpdaters() {
    if (epgProgressUpdateIntervalId) clearInterval(epgProgressUpdateIntervalId);
    updateEPGProgressBarOnCards();
    epgProgressUpdateIntervalId = setInterval(updateEPGProgressBarOnCards, 60000);

    if (dynamicMovistarEpgUpdateIntervalId) clearInterval(dynamicMovistarEpgUpdateIntervalId);
    
    let lastCheckedDateForVodEpg = new Date().toDateString();

    dynamicMovistarEpgUpdateIntervalId = setInterval(async () => {
        const now = new Date();
        if (userSettings.useMovistarVodAsEpg && now.toDateString() !== lastCheckedDateForVodEpg) {
            lastCheckedDateForVodEpg = now.toDateString();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            showNotification("Cargando EPG de Movistar VOD para el nuevo día...", "info");
            await updateEpgWithMovistarVodData(`${yyyy}-${mm}-${dd}`);
        }

        updateEPGProgressBarOnCards();

        Object.values(playerInstances).forEach(instance => {
            if (instance && instance.container && $(instance.container).is(':visible')) {
                updatePlayerInfobar(instance.channel, instance.container.querySelector('.player-infobar'));
            }
        });

    }, 60000);
}

function stopDynamicEpgUpdaters() {
    if (epgProgressUpdateIntervalId) clearInterval(epgProgressUpdateIntervalId);
    if (dynamicMovistarEpgUpdateIntervalId) clearInterval(dynamicMovistarEpgUpdateIntervalId);
    epgProgressUpdateIntervalId = null;
    dynamicMovistarEpgUpdateIntervalId = null;
}

function updateEPGProgressBarOnCards() {
    $('.channel-card').each(function() {
        const card = $(this);
        const channelUrl = card.data('url');
        const channel = channels.find(c => c.url === channelUrl);
        const progressBarContainer = card.find('.epg-progress-bar-container');
        const progressBar = card.find('.epg-progress-bar');
        
        if (userSettings.cardShowEpg && channel && channel.effectiveEpgId && epgDataByChannelId[channel.effectiveEpgId] && progressBarContainer.length) {
            const programsForChannel = epgDataByChannelId[channel.effectiveEpgId];
            const now = new Date();
            const currentProgram = programsForChannel.find(p => now >= p.startDt && now < p.stopDt);

            if (currentProgram) {
                const programDuration = currentProgram.stopDt.getTime() - currentProgram.startDt.getTime();
                const elapsed = now.getTime() - currentProgram.startDt.getTime();
                let progressPercent = 0;
                if (programDuration > 0) {
                    progressPercent = Math.min(100, (elapsed / programDuration) * 100);
                }
                progressBar.css('width', progressPercent + '%');
                progressBarContainer.show();
            } else {
                progressBar.css('width', '0%');
                progressBarContainer.hide();
            }
        } else if (progressBarContainer.length) {
            progressBar.css('width', '0%');
            progressBarContainer.hide();
        }
    });
}

async function loadEpgFromUrl(url) {
    if (!url) {
        showNotification('URL EPG inválida o vacía.', 'error');
        $('#epgChannelsList, #epgPrograms, #epgTimeBar').empty().html('<p class="p-3 text-warning text-center">Introduce una URL EPG válida o usa la predeterminada.</p>');
        epgPrograms = []; 
        epgLastLoadTime = null;
        matchChannelsWithEpg();
        return;
    }
    showLoading(true, 'Cargando y procesando EPG XMLTV...');
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Error HTTP ${response.status} - ${response.statusText}${errorBody ? ': ' + errorBody.substring(0, 100) + '...' : ''}`);
        }
        const xmlText = await response.text();
        if (!xmlText || xmlText.trim() === '') throw new Error('Archivo EPG XMLTV vacío o inaccesible.');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const parseErrorNode = xmlDoc.querySelector('parsererror');
        if (parseErrorNode) {
            const errorText = parseErrorNode.textContent || 'Error de parseo XMLTV desconocido.';
            throw new Error('XMLTV mal formado: ' + errorText.substring(0, 200) + (errorText.length > 200 ? '...' : ''));
        }
        
        const existingMovistarEpgData = {};
        Object.keys(epgDataByChannelId).forEach(key => {
            if (key.startsWith('movistar.')) {
                existingMovistarEpgData[key] = epgDataByChannelId[key];
            }
        });
        epgDataByChannelId = {...existingMovistarEpgData};
        epgPrograms = [];
        epgChannelIcons = {};
        
        const newChannelDisplayNames = {};
        const existingMovistarDisplayNames = {};
        Object.keys(epgChannelDisplayNames).forEach(key => {
            if (key.startsWith('movistar.')) {
                existingMovistarDisplayNames[key] = epgChannelDisplayNames[key];
            }
        });
        epgChannelDisplayNames = existingMovistarDisplayNames;

        const parsedData = parseXMLTV(xmlDoc);
        
        epgPrograms.push(...parsedData.programs);
        Object.assign(epgChannelIcons, parsedData.channelIcons);
        Object.assign(epgChannelDisplayNames, parsedData.channelDisplayNames);
        
        for (const chId in parsedData.dataByChannelId) {
            epgDataByChannelId[chId] = parsedData.dataByChannelId[chId];
        }

        const existingMovistarIds = orderedEpgChannelIds.filter(id => id.startsWith('movistar.'));
        const newIdsFromXml = parsedData.orderedEpgIds;
        const newIdsSet = new Set(newIdsFromXml);
        const finalCombinedIds = [...newIdsFromXml];
        existingMovistarIds.forEach(moviId => {
            if (!newIdsSet.has(moviId)) {
                finalCombinedIds.push(moviId);
            }
        });
        orderedEpgChannelIds = finalCombinedIds;
        
        epgMinTimeMs = parsedData.minTimeMs;
        epgMaxTimeMs = parsedData.maxTimeMs;

        epgLastLoadTime = new Date().getTime();
        userSettings.lastEpgUrl = url;
        localStorage.setItem('zenithUserSettings', JSON.stringify(userSettings));

        $('#epgChannelsList, #epgPrograms, #epgTimeBar').empty();
        await matchChannelsWithEpg();
        
        if (userSettings.useMovistarVodAsEpg) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            await updateEpgWithMovistarVodData(`${yyyy}-${mm}-${dd}`);
        }

        if (orderedEpgChannelIds.length > 0) {
            populateEPGChannelsModal(); renderEPGTimeBar(); renderEPGProgramsLazy(); startCurrentTimeLineUpdater();
            showNotification(`EPG XMLTV cargado (${parsedData.programs.length} programas para ${parsedData.orderedEpgIds.length} canales XMLTV).`, 'success');
        } else {
            $('#epgChannelsList').html('<p class="p-3 text-secondary text-center">No se encontraron canales en el EPG XMLTV.</p>');
            $('#epgPrograms').html('<p class="p-3 text-secondary text-center">No hay programas para mostrar.</p>').css('min-height', '200px');
            showNotification('EPG XMLTV cargado, pero sin canales o programas válidos para mostrar.', 'warning');
        }
    } catch (err) {
        showNotification(`Error cargando EPG XMLTV desde "${escapeHtml(url)}": ${err.message}`, 'error');
        console.error("EPG XMLTV Load Error:", err);
        $('#epgChannelsList').html('<p class="p-3 text-danger text-center">Error cargando canales EPG XMLTV.</p>');
        $('#epgPrograms').html('<p class="p-3 text-danger text-center">Error cargando programas EPG XMLTV.</p>');
        epgLastLoadTime = null; 
        matchChannelsWithEpg();
    } finally { showLoading(false); }
}

function parseXMLTV(xmlDoc) {
    const channelIcons = {};
    const channelDisplayNames = {};
    const programs = [];
    const dataByChannelId = {};
    const orderedIdsFromXml = [];
    const seenChannelIds = new Set();

    const now = new Date();
    const startTimeLimit = new Date(now.getTime() - 6 * 3600 * 1000); 
    const endTimeLimit = new Date(now.getTime() + 48 * 3600 * 1000); 

    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;

    xmlDoc.querySelectorAll('channel').forEach(node => {
        const id = (node.getAttribute('id') || '').toLowerCase().trim();
        if (id && !seenChannelIds.has(id)) {
            seenChannelIds.add(id);
            orderedIdsFromXml.push(id);
            const iconNode = node.querySelector('icon[src]');
            if (iconNode) {
                const iconSrc = iconNode.getAttribute('src');
                if (iconSrc && !/blank|tv-icon|placeholder|no-logo|noimage|default/i.test(iconSrc)) {
                    channelIcons[id] = iconSrc;
                }
            }
            
            const displayNameNode = node.querySelector('display-name');
            if (displayNameNode && displayNameNode.textContent) {
                channelDisplayNames[id] = displayNameNode.textContent.trim();
            } else if (id) {
                channelDisplayNames[id] = id; 
            }
            dataByChannelId[id] = [];
        }
    });

    xmlDoc.querySelectorAll('programme').forEach(node => {
        const startAttr = node.getAttribute('start'); const stopAttr = node.getAttribute('stop');
        const channelId = (node.getAttribute('channel') || '').toLowerCase().trim();
        if (!startAttr || !stopAttr || !channelId) return;

        const startDt = parseEPGDate(startAttr); const stopDt = parseEPGDate(stopAttr);
        if (!startDt || !stopDt) { console.warn("Invalid date in EPG program:", startAttr, stopAttr); return; }
        if (stopDt <= startDt) { console.warn("EPG program end time is before start time:", startAttr, stopAttr); return; }

        if (stopDt < startTimeLimit || startDt > endTimeLimit) { return; }

        minTimestamp = Math.min(minTimestamp, startDt.getTime());
        maxTimestamp = Math.max(maxTimestamp, stopDt.getTime());

        const programData = {
            channel: channelId, start: startAttr, stop: stopAttr, startDt: startDt, stopDt: stopDt,
            title: node.querySelector('title')?.textContent?.trim() || 'Programa sin título',
            desc: node.querySelector('desc')?.textContent?.trim() || '',
            category: node.querySelector('category')?.textContent?.trim() || '',
            icon: node.querySelector('icon[src]')?.getAttribute('src') || '',
            date: node.querySelector('date')?.textContent?.trim() || '',
        };
        programs.push(programData);
        if (dataByChannelId[channelId]) {
            dataByChannelId[channelId].push(programData);
        } else {
            dataByChannelId[channelId] = [programData];
            if(!seenChannelIds.has(channelId)) { 
                seenChannelIds.add(channelId);
                orderedIdsFromXml.push(channelId);
                if(!channelDisplayNames[channelId]) channelDisplayNames[channelId] = channelId;
            }
        }
    });

    for (const chId in dataByChannelId) {
        dataByChannelId[chId].sort((a, b) => a.startDt - b.bstartDt);
    }

    if (minTimestamp === Infinity) minTimestamp = startTimeLimit.getTime();
    if (maxTimestamp === -Infinity) maxTimestamp = endTimeLimit.getTime();
    
    return { programs, channelIcons, channelDisplayNames, dataByChannelId, orderedEpgIds: orderedIdsFromXml, minTimeMs: minTimestamp, maxTimeMs: maxTimestamp };
}

function parseEPGDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.length < 12) return null;
    dateString = dateString.trim();
    try {
        const Y = parseInt(dateString.substring(0, 4), 10);
        const M = parseInt(dateString.substring(4, 6), 10) - 1; 
        const D = parseInt(dateString.substring(6, 8), 10);
        const h = parseInt(dateString.substring(8, 10), 10);
        const m = parseInt(dateString.substring(10, 12), 10);
        const s = parseInt(dateString.substring(12, 14), 10) || 0;

        if ([Y, M, D, h, m, s].some(isNaN)) return null;

        let date;
        const isoBase = `${String(Y).padStart(4, '0')}-${String(M + 1).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        if (dateString.length > 14) { 
            const offsetPart = dateString.substring(14).trim();
            if (offsetPart.toUpperCase() === 'Z') {
                date = new Date(`${isoBase}Z`);
            } else {
                const offsetMatch = offsetPart.match(/^([+-])(\d{2})(\d{2})?$/);
                if (offsetMatch) {
                    const offsetMinutes = parseInt(offsetMatch[3] || '00', 10);
                    date = new Date(`${isoBase}${offsetMatch[1]}${offsetMatch[2]}:${String(offsetMinutes).padStart(2,'0')}`);
                } else {
                    date = new Date(Date.UTC(Y, M, D, h, m, s)); 
                }
            }
        } else {
            date = new Date(Y, M, D, h, m, s);
        }
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (e) { console.warn("Error parsing EPG date string:", dateString, e); return null; }
}

function formatEPGTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) { return '??:??'; }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function populateEPGChannelsModal() {
    const channelsList = $('#epgChannelsList').empty();
    if (!orderedEpgChannelIds || orderedEpgChannelIds.length === 0) {
        channelsList.append('<p class="p-3 text-secondary text-center">No hay canales EPG disponibles.</p>'); return;
    }
    
    const fragment = document.createDocumentFragment();
    orderedEpgChannelIds.forEach(id => {
        const m3uChannelForEpgId = channels.find(chM3U => chM3U.effectiveEpgId === id);
        
        let name = epgChannelDisplayNames[id];
        if (!name && m3uChannelForEpgId) name = m3uChannelForEpgId.name;
        if (!name) name = id;

        let icon = getEpgChannelIcon(id);
        if (!icon && m3uChannelForEpgId) icon = m3uChannelForEpgId['tvg-logo'];

        const item = document.createElement('div');
        item.className = 'epg-channel-item'; item.dataset.channelId = id;
        
        const richTitle = `${escapeHtml(name)}\n${m3uChannelForEpgId ? 'Click para reproducir' : 'ID EPG: '+id}`;
        item.title = richTitle;

        let iconHtml = '';
        if (icon) { iconHtml = `<img src="${escapeHtml(icon)}" alt="" onerror="this.style.display='none'; if(this.parentElement && this.parentElement.querySelector('.epg-icon-placeholder')) this.parentElement.querySelector('.epg-icon-placeholder').style.display=''">`; }
        const placeholderHtml = `<span class="epg-icon-placeholder" ${icon ? 'style="display:none;"' : ''}></span>`;
        const playButtonHtml = m3uChannelForEpgId ? '<button class="play-channel-epg-btn" title="Reproducir"></button>' : '';
        item.innerHTML = `${iconHtml}${placeholderHtml}<span style="flex-grow: 1; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</span>${playButtonHtml}`;
        const playButton = item.querySelector('.play-channel-epg-btn');
        if (playButton) {
            playButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof createPlayerWindow === 'function') {
                    createPlayerWindow(m3uChannelForEpgId);
                }
            });
        }
        item.addEventListener('click', () => {
            const programsContainer = $('#epgProgramsContainer')[0];
            if (programsContainer) {
                const channelIndex = orderedEpgChannelIds.indexOf(id);
                const itemHeight = $('.epg-channel-item').first().outerHeight() || 60;
                const programsContainerHeight = $(programsContainer).height() || 500;
                const scrollTo = (channelIndex * itemHeight) - (programsContainerHeight / 2) + (itemHeight / 2);
                $(programsContainer).animate({ scrollTop: Math.max(0, scrollTo) }, 300);
            }
        });
        fragment.appendChild(item);
    });
    channelsList.append(fragment);
}

function getEffectiveEpgTimeRange() {
    let finalMinMs = Infinity;
    let finalMaxMs = -Infinity;

    if (epgMinTimeMs > 0 && epgMinTimeMs !== Infinity) {
        finalMinMs = epgMinTimeMs;
        finalMaxMs = epgMaxTimeMs;
    }

    if (userSettings.useMovistarVodAsEpg) {
        let vodMin = Infinity, vodMax = -Infinity;
        Object.values(epgDataByChannelId).forEach(programsArr => {
            if (programsArr && programsArr.length > 0 && programsArr.some(p => p.isMovistarVod)) {
                programsArr.forEach(p => {
                    if (p.isMovistarVod) {
                        vodMin = Math.min(vodMin, p.startDt.getTime());
                        vodMax = Math.max(vodMax, p.stopDt.getTime());
                    }
                });
            }
        });
        if (vodMin !== Infinity) finalMinMs = Math.min(finalMinMs, vodMin);
        if (vodMax !== -Infinity) finalMaxMs = Math.max(finalMaxMs, vodMax);
    }
    
    if (finalMinMs === Infinity || finalMaxMs === -Infinity) {
        finalMinMs = new Date().setHours(0,0,0,0);
        finalMaxMs = new Date().setHours(23,59,59,999);
    }

    return { min: finalMinMs, max: finalMaxMs };
}

function renderEPGTimeBar() {
    const timeBar = $('#epgTimeBar').empty();
    const programsContainerEl = $('#epgProgramsContainer')[0];
    if (!programsContainerEl) return;

    const epgPixelsPerHour = userSettings.epgDensity || 200;
    
    const timeRange = getEffectiveEpgTimeRange();
    const overallMinTimeMs = timeRange.min;
    const overallMaxTimeMs = timeRange.max;
    
    if(overallMaxTimeMs <= overallMinTimeMs) {
         timeBar.html('<p class="p-2 text-secondary">Rango de tiempo EPG no disponible.</p>');
         return;
    }

    const totalTimebarWidth = (overallMaxTimeMs - overallMinTimeMs) / (3600 * 1000) * epgPixelsPerHour;

    const fragment = document.createDocumentFragment();
    let currentTime = new Date(overallMinTimeMs);
    currentTime.setMinutes(0, 0, 0); 

    while (currentTime.getTime() < overallMaxTimeMs) {
        const slotEl = document.createElement('div');
        slotEl.className = 'epg-time-slot';
        slotEl.style.minWidth = `${epgPixelsPerHour}px`;
        slotEl.style.width = `${epgPixelsPerHour}px`;
        slotEl.textContent = formatEPGTime(currentTime);
        fragment.appendChild(slotEl);
        currentTime.setTime(currentTime.getTime() + 3600 * 1000); 
    }
    timeBar.append(fragment).css('width', `${totalTimebarWidth}px`);
    $('#epgTimeBar').parent()[0].scrollLeft = programsContainerEl.scrollLeft || 0;
}

function renderEPGProgramsLazy() {
    const programsEl = $('#epgPrograms').empty()[0];
    const scrollContainer = $('#epgProgramsContainer')[0];
    if (!scrollContainer || !programsEl) return;

    if (orderedEpgChannelIds.length === 0) {
        $(programsEl).append('<p class="p-3 text-secondary">No hay datos EPG para mostrar.</p>').css('min-height', '200px');
        return;
    }
    
    const epgPixelsPerHour = userSettings.epgDensity || 200;
    const timeRange = getEffectiveEpgTimeRange();
    const overallMinTimeMs = timeRange.min;
    const overallMaxTimeMs = timeRange.max;

    if(overallMaxTimeMs <= overallMinTimeMs) {
         $(programsEl).append('<p class="p-3 text-secondary">Rango de tiempo EPG no disponible para programas.</p>').css('min-height', '200px');
        return;
    }

    const totalEpgDurationMs = overallMaxTimeMs - overallMinTimeMs;
    const totalEPGWidth = totalEpgDurationMs / (3600 * 1000) * epgPixelsPerHour;

    $(programsEl).css('width', `${totalEPGWidth}px`).css('--pixelsPerHour', `${epgPixelsPerHour}px`);

    const rowFragment = document.createDocumentFragment();
    orderedEpgChannelIds.forEach(channelId => {
        const row = document.createElement('div');
        row.className = 'epg-program-row'; row.dataset.channelId = channelId;
        rowFragment.appendChild(row);
    });
    $(programsEl).append(rowFragment);

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const row = entry.target; const channelId = row.dataset.channelId;
                if (row.dataset.rendered) return; row.dataset.rendered = true;
                const channelPrograms = epgDataByChannelId[channelId];
                if (channelPrograms && channelPrograms.length > 0) {
                    const progsFrag = document.createDocumentFragment();
                    const now = new Date();
                    channelPrograms.forEach(p => {
                        const startMs = p.startDt.getTime();
                        const stopMs = p.stopDt.getTime();
                        const durationMs = stopMs - startMs;
                        if (durationMs <= 0) return;

                        const offsetMsFromEPGStart = startMs - overallMinTimeMs;
                        const scaledPixelsPerMs = epgPixelsPerHour / 3600000; 
                        const offsetPx = offsetMsFromEPGStart * scaledPixelsPerMs;
                        const widthPx = Math.max(2, durationMs * scaledPixelsPerMs);

                        const isCurrent = now >= p.startDt && now < p.stopDt;
                        const progEl = document.createElement('div');
                        progEl.className = `epg-program-item ${isCurrent ? 'current' : ''}`;
                        progEl.style.cssText = `left:${offsetPx}px; width:${widthPx}px;`;
                        
                        let richTitle = `${escapeHtml(p.title)}\n${formatEPGTime(p.startDt)} - ${formatEPGTime(p.stopDt)}`;
                        if (p.desc) richTitle += `\n\n${escapeHtml(p.desc.substring(0,200))}${p.desc.length > 200 ? '...' : ''}`;
                        progEl.title = richTitle;
                        
                        progEl.textContent = escapeHtml(p.title);
                        progEl.addEventListener('click', () => showProgramDetails(p));
                        progsFrag.appendChild(progEl);
                    });
                    requestAnimationFrame(() => { if (row.parentElement) { $(row).append(progsFrag); } });
                }
                obs.unobserve(row);
            }
        });
    }, { root: scrollContainer, rootMargin: '300px 0px', threshold: 0.01 });

    $(programsEl).children('.epg-program-row').each((_, el) => observer.observe(el));
    $(programsEl).css('min-height', `${Math.max(200, orderedEpgChannelIds.length * 60)}px`);

    requestAnimationFrame(() => {
        const now = new Date().getTime();
        const offsetNowFromEPGStartMs = now - overallMinTimeMs;
        const scaledPixelsPerMs = epgPixelsPerHour / 3600000;
        const nowPositionPx = offsetNowFromEPGStartMs * scaledPixelsPerMs;
        const containerWidth = scrollContainer.clientWidth;
        const targetScrollLeft = nowPositionPx - (containerWidth / 3); 
        scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
        $('#epgTimeBar').parent()[0].scrollLeft = scrollContainer.scrollLeft;
    });
}

function startCurrentTimeLineUpdater() {
    if (epgCurrentTimeLineInterval) clearInterval(epgCurrentTimeLineInterval);
    const currentTimeLine = $('#epgCurrentTimeLine');
    
    const timeRange = getEffectiveEpgTimeRange();
    const overallMinTimeMs = timeRange.min;
    const overallMaxTimeMs = timeRange.max;

    if (!currentTimeLine.length || overallMaxTimeMs <= overallMinTimeMs) {
        currentTimeLine.hide();
        return;
    }

    const update = () => {
        const now = new Date().getTime();
        if (now < overallMinTimeMs || now > overallMaxTimeMs) {
            currentTimeLine.hide();
            return;
        }
        const epgPixelsPerHour = userSettings.epgDensity || 200;
        const offsetNowFromEPGStartMs = now - overallMinTimeMs;
        const scaledPixelsPerMs = epgPixelsPerHour / 3600000;
        const linePositionPx = offsetNowFromEPGStartMs * scaledPixelsPerMs;
        currentTimeLine.css('transform', `translateX(${linePositionPx}px)`).show();
    };
    update();
    epgCurrentTimeLineInterval = setInterval(update, 60000); 
    $('#epgModal').one('hidden.bs.modal', () => {
        if(epgCurrentTimeLineInterval) clearInterval(epgCurrentTimeLineInterval);
        epgCurrentTimeLineInterval = null;
        currentTimeLine.hide();
    });
}

function showProgramDetails(program) {
    const details = $('#epgProgramDetails').empty();
    const m3uChannelForEpgId = channels.find(chM3U => chM3U.effectiveEpgId === program.channel);
    const playButton = $('#playEpgProgramBtn').off('click');
    const now = new Date();
    const isPastProgram = program.stopDt < now;
    
    let isCatchupChannel = false;
    if (program.isMovistarVod && m3uChannelForEpgId) {
        isCatchupChannel = true; 
    } else if (m3uChannelForEpgId && m3uChannelForEpgId.url && 
        (m3uChannelForEpgId.url.includes('.cdn.telefonica.com/') || m3uChannelForEpgId.url.includes('.movistarplus.es/'))) {
        isCatchupChannel = true; 
    }

    if (m3uChannelForEpgId) {
        playButton.show();
        if (isPastProgram && isCatchupChannel) {
            playButton.html('<span class="icon-placeholder" style="font-family:sans-serif;">⏪</span> Ver Programa (Catchup/VOD)');
            playButton.on('click', () => {
                handlePlayCatchup(m3uChannelForEpgId, program);
                $('#epgProgramModal').modal('hide'); 
            });
        } else {
            playButton.html('<span class="icon-placeholder"></span> Reproducir Canal (Directo)');
            playButton.on('click', () => {
                 if (typeof createPlayerWindow === 'function') {
                    createPlayerWindow(m3uChannelForEpgId);
                }
                $('#epgProgramModal').modal('hide'); 
            });
        }
    } else {
        playButton.hide();
    }

    if (program.icon) { details.append($(`<img src="${escapeHtml(program.icon)}" alt="${escapeHtml(program.title)}" onerror="this.style.display='none';">`)); }
    details.append(
        $('<h5>').text(escapeHtml(program.title)),
        $('<p>').html(`<strong>Canal:</strong> ${escapeHtml(m3uChannelForEpgId ? m3uChannelForEpgId.name : (epgChannelDisplayNames[program.channel] || program.channel))}`),
        $('<p>').html(`<strong>Horario:</strong> ${formatEPGTime(program.startDt)} - ${formatEPGTime(program.stopDt)}`),
        program.desc ? $('<p>').html(`<strong>Descripción:</strong> ${escapeHtml(program.desc)}`) : null,
        program.category ? $('<p>').html(`<strong>Categoría:</strong> ${escapeHtml(program.category)}`) : null,
        program.date ? $('<p>').html(`<strong>Año:</strong> ${escapeHtml(program.date)}`) : null
    ).append('<div style="clear: both;"></div>');

    $('#epgProgramModalLabel').text('Detalles del Programa');
    $('#epgProgramModal').modal('show');
}

function updatePlayerInfobar(channel, infobarElement) {
    if (!channel || !infobarElement) return;

    const logoEl = $(infobarElement).find('.infobar-logo');
    const nameEl = $(infobarElement).find('.infobar-channel-name');
    const currentEl = $(infobarElement).find('.infobar-epg-current');
    const nextEl = $(infobarElement).find('.infobar-epg-next');
    const progressContainerEl = $(infobarElement).find('.infobar-epg-progress-container');
    const progressEl = $(infobarElement).find('.infobar-epg-progress');
    const timeEl = $(infobarElement).find('.infobar-time');

    const logoUrl = channel['tvg-logo'] || '';
    logoEl.attr('src', logoUrl).toggle(!!logoUrl);
    nameEl.text(channel.name || 'Canal Desconocido');
    timeEl.text(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    let hasEpg = false;
    if (channel.effectiveEpgId && epgDataByChannelId[channel.effectiveEpgId]) {
        const programs = epgDataByChannelId[channel.effectiveEpgId];
        const now = new Date();
        const currentProgram = programs.find(p => now >= p.startDt && now < p.stopDt);

        if (currentProgram) {
            hasEpg = true;
            const programDuration = currentProgram.stopDt.getTime() - currentProgram.startDt.getTime();
            const elapsed = now.getTime() - currentProgram.startDt.getTime();
            const progressPercent = programDuration > 0 ? Math.min(100, (elapsed / programDuration) * 100) : 0;

            currentEl.text(`Ahora: ${currentProgram.title}`).show();
            progressEl.css('width', `${progressPercent}%`);
            progressContainerEl.show();
            
            const nextProgramIndex = programs.indexOf(currentProgram) + 1;
            if (nextProgramIndex < programs.length) {
                const nextProgram = programs[nextProgramIndex];
                nextEl.text(`Siguiente: ${nextProgram.title} (${formatEPGTime(nextProgram.startDt)})`).show();
            } else {
                nextEl.hide();
            }
        }
    }

    if (!hasEpg) {
        currentEl.hide();
        nextEl.hide();
        progressContainerEl.hide();
    }
}

function startPlayerInfobarUpdate(windowId) {
    const instance = playerInstances[windowId];
    if (!instance) return;
    
    if (instance.infobarInterval) clearInterval(instance.infobarInterval);
    
    const infobarElement = instance.container.querySelector('.player-infobar');
    updatePlayerInfobar(instance.channel, infobarElement);
    
    instance.infobarInterval = setInterval(() => {
        if (playerInstances[windowId] && $(instance.container).is(':visible')) {
            updatePlayerInfobar(instance.channel, infobarElement);
        }
    }, 30000);
}

async function handlePlayCatchup(originalM3UChannelFromEpg, rawOrTransformedProgramData) {
    let normalizedProgramData;
    
    if (rawOrTransformedProgramData.startDt instanceof Date && rawOrTransformedProgramData.stopDt instanceof Date) {
        normalizedProgramData = {
            startDt: rawOrTransformedProgramData.startDt,
            stopDt: rawOrTransformedProgramData.stopDt,
            title: rawOrTransformedProgramData.title,
            serviceUid2: rawOrTransformedProgramData.CanalServiceUid2,
            channelName: originalM3UChannelFromEpg?.name
        };
    } else {
        normalizedProgramData = {
            startDt: new Date(parseInt(rawOrTransformedProgramData.FechaHoraInicio)),
            stopDt: new Date(parseInt(rawOrTransformedProgramData.FechaHoraFin)),
            title: rawOrTransformedProgramData.Titulo,
            serviceUid2: rawOrTransformedProgramData.CanalServiceUid2,
            channelName: rawOrTransformedProgramData.CanalNombre
        };
    }
    
    let effectiveOriginalM3UChannel = originalM3UChannelFromEpg;
    if (!effectiveOriginalM3UChannel && normalizedProgramData.serviceUid2) {
        effectiveOriginalM3UChannel = channels.find(ch => {
            if (ch.url && (ch.url.includes(`/${normalizedProgramData.serviceUid2}/`) || ch.url.includes(`/CVXCH${normalizedProgramData.serviceUid2}/`))) return true;
            const tvgIdServiceUid = ch['tvg-id'] ? ch['tvg-id'].split('.').pop() : null;
            if (tvgIdServiceUid === normalizedProgramData.serviceUid2) return true;
            if (ch.attributes && ch.attributes['ch-number'] && ch.attributes['ch-number'] === normalizedProgramData.serviceUid2) return true;
            return false;
        });
    }

    if (!effectiveOriginalM3UChannel) {
        showNotification(`No se encontró canal M3U base (${normalizedProgramData.channelName || normalizedProgramData.serviceUid2}) para reproducir VOD.`, "warning");
        return;
    }
    
    if (!(normalizedProgramData.startDt instanceof Date) || !(normalizedProgramData.stopDt instanceof Date) || isNaN(normalizedProgramData.startDt) || isNaN(normalizedProgramData.stopDt)) {
        showNotification("Faltan datos o fechas inválidas para reproducir el programa en catchup/VOD.", "error");
        return;
    }

    if (normalizedProgramData.stopDt.getTime() <= normalizedProgramData.startDt.getTime()) {
        showNotification("El programa seleccionado tiene una duración inválida y no se puede reproducir.", "warning");
        return;
    }

    const catchupUrl = buildMovistarCatchupUrl(effectiveOriginalM3UChannel, normalizedProgramData.startDt, normalizedProgramData.stopDt);
    if (!catchupUrl) {
        showNotification("No se pudo generar la URL de catchup/VOD para este programa/canal.", "error");
        return;
    }

    const catchupChannelObject = JSON.parse(JSON.stringify(effectiveOriginalM3UChannel));
    catchupChannelObject.url = catchupUrl;
    catchupChannelObject.name = `${effectiveOriginalM3UChannel.name} (Catchup: ${normalizedProgramData.title.substring(0, 20)}...)`;
    if (!catchupChannelObject.kodiProps) catchupChannelObject.kodiProps = {};
    catchupChannelObject.kodiProps['inputstream.adaptive.play_timeshift_buffer'] = 'true';

    const existingTelefonicaWindow = Object.values(playerInstances).find(inst => inst.channel && (inst.channel.url.toLowerCase().includes('telefonica.com') || inst.channel.url.toLowerCase().includes('movistarplus.es')));

    if (existingTelefonicaWindow) {
        const existingId = Object.keys(playerInstances).find(key => playerInstances[key] === existingTelefonicaWindow);
        if (existingId) {
            showNotification("Reutilizando la ventana de Movistar+ para el programa VOD.", "info");
            playChannelInShaka(catchupChannelObject, existingId);
            const instance = playerInstances[existingId];
            if(instance.container) {
                instance.container.querySelector('.player-window-title').textContent = catchupChannelObject.name;
                instance.container.querySelector('.player-window-title').title = catchupChannelObject.name;
            }
            setActivePlayer(existingId);
        } else {
             
            if (typeof createPlayerWindow === 'function') createPlayerWindow(catchupChannelObject);
        }
    } else {
        if (typeof createPlayerWindow === 'function') {
            createPlayerWindow(catchupChannelObject);
        }
    }
}