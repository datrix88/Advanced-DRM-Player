async function loadUrl(url, sourceOrigin = null) {
    showLoading(true, 'Cargando lista desde URL...');
    if (typeof hideXtreamInfoBar === 'function') hideXtreamInfoBar();
    if (!sourceOrigin) {
        channels = [];
        currentGroupOrder = [];
        currentM3UName = null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} - ${response.statusText}${errorBody ? ': ' + errorBody.substring(0,100)+'...' : ''}`);
        }
        const content = await response.text();
        if (!content || content.trim() === '') throw new Error('Lista vacía o inaccesible.');

        const effectiveSourceName = sourceOrigin || url;
        processM3UContent(content, effectiveSourceName, !sourceOrigin);

        if(userSettings.autoSaveM3U && !sourceOrigin) {
            await saveAppConfigValue('lastM3UUrl', url);
            await deleteAppConfigValue('lastM3UFileContent');
            await deleteAppConfigValue('lastM3UFileName');
            await deleteAppConfigValue('currentXtreamServerInfo');
        }
        showNotification(`Lista cargada desde URL (${channels.length} canales).`, 'success');
    } catch (err) {
        showNotification(`Error cargando URL: ${err.message}`, 'error');
        if (!sourceOrigin) {
            channels = []; currentM3UContent = null; currentM3UName = null; currentGroupOrder = [];
            filterAndRenderChannels();
        }
    } finally { showLoading(false); }
}

function loadFile(event) {
    const file = event.target.files[0]; if (!file) return;
    showLoading(true, `Leyendo archivo "${escapeHtml(file.name)}"...`);

    if (typeof hideXtreamInfoBar === 'function') hideXtreamInfoBar();
    channels = [];
    currentGroupOrder = [];
    currentM3UName = null;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target.result;
            if (!content || content.trim() === '') throw new Error('Archivo vacío.');

            processM3UContent(content, file.name, true);

            if (userSettings.autoSaveM3U) {
                if (content.length < 4 * 1024 * 1024) {
                    await saveAppConfigValue('lastM3UFileContent', content);
                    await saveAppConfigValue('lastM3UFileName', currentM3UName);
                    await deleteAppConfigValue('lastM3UUrl');
                    await deleteAppConfigValue('currentXtreamServerInfo');
                } else {
                    showNotification('Archivo local grande (>4MB), no se guardará para recarga automática.', 'info');
                    await deleteAppConfigValue('lastM3UFileContent');
                    await deleteAppConfigValue('lastM3UFileName');
                    await deleteAppConfigValue('lastM3UUrl');
                    await deleteAppConfigValue('currentXtreamServerInfo');
                }
            }
            showNotification(`Lista "${escapeHtml(file.name)}" cargada (${channels.length} canales).`, 'success');
        } catch (err) {
            showNotification(`Error procesando archivo: ${err.message}`, 'error');
            channels = []; currentM3UContent = null; currentM3UName = null; currentGroupOrder = [];
            filterAndRenderChannels();
        } finally { showLoading(false); $('#fileInput').val('');  }
    };
    reader.onerror = (e) => {
        showNotification('Error al leer archivo: ' + e.target.error, 'error');
        showLoading(false); $('#fileInput').val('');
    };
    reader.readAsText(file);
}

function processM3UContent(content, sourceName, isFullLoad = false) {
    currentM3UContent = content;

    if (isFullLoad) {
        if (sourceName.startsWith('http')) {
            try {
                const url = new URL(sourceName);
                currentM3UName = url.pathname.split('/').pop() || url.search.substring(1) || url.hostname || 'lista_url';
                currentM3UName = decodeURIComponent(currentM3UName).replace(/\.(m3u8?|txt|pls|m3uplus)$/i, '').replace(/[\/\\]/g,'_');
                if (!currentM3UName || currentM3UName.length > 50) currentM3UName = currentM3UName.substring(0, 47) + '...';
                if(currentM3UName.length === 0) currentM3UName = 'lista_remota';
            } catch(e) { currentM3UName = 'lista_url_malformada'; }
        } else {
            currentM3UName = sourceName.replace(/\.(m3u8?|txt|pls|m3uplus)$/i, '').replace(/[\/\\]/g,'_');
            if (!currentM3UName || currentM3UName.length > 50) currentM3UName = currentM3UName.substring(0, 47) + '...';
            if(currentM3UName.length === 0) currentM3UName = 'lista_local';
        }
        if (channels.length > 0 || currentGroupOrder.length > 0) {
             channels = [];
             currentGroupOrder = [];
        }
    }

    const parseResult = typeof parseM3U === 'function' ? parseM3U(content, sourceName) : { channels: [], groupOrder: [] };

    channels.push(...parseResult.channels);

    const existingGroupsSet = new Set(currentGroupOrder);
    parseResult.groupOrder.forEach(group => {
        if (!existingGroupsSet.has(group)) {
            currentGroupOrder.push(group);
        }
    });
    const allCurrentGroups = new Set(channels.map(c => c['group-title']).filter(Boolean));
    currentGroupOrder = currentGroupOrder.filter(g => allCurrentGroups.has(g));
    allCurrentGroups.forEach(g => {
        if (!currentGroupOrder.includes(g)) currentGroupOrder.push(g);
    });


    currentPage = 1;
    if (typeof matchChannelsWithEpg === 'function') {
        matchChannelsWithEpg();
    }

    let initialGroupToSelect = "";
    if (userSettings.persistFilters && userSettings.lastSelectedGroup && currentGroupOrder.includes(userSettings.lastSelectedGroup)) {
        initialGroupToSelect = userSettings.lastSelectedGroup;
    }
    $('#groupFilterSidebar').val(initialGroupToSelect);
    filterAndRenderChannels();

    if (channels.length === 0) {
        showNotification(`No se encontraron canales válidos en "${escapeHtml(currentM3UName || sourceName)}". Revisa el formato del M3U.`, 'warning');
    }
}

function removeChannelsBySourceOrigin(originToRemove) {
    if (!originToRemove) return;

    const originalChannelCount = channels.length;
    channels = channels.filter(channel => channel.sourceOrigin !== originToRemove);
    const channelsRemovedCount = originalChannelCount - channels.length;

    if (channelsRemovedCount > 0) {
        if (channels.length > 0) {
            regenerateCurrentM3UContentFromString();
        } else {
            currentM3UContent = null;
            currentM3UName = null;
        }
        const activeGroups = new Set(channels.map(ch => ch['group-title']));
        currentGroupOrder = currentGroupOrder.filter(group => activeGroups.has(group));
    }
}

async function appendM3UContent(newM3UString, sourceNameForAppend) {
    showLoading(true, `Agregando canales de ${escapeHtml(sourceNameForAppend)}...`);
    const parseResult = typeof parseM3U === 'function' ? parseM3U(newM3UString, sourceNameForAppend) : { channels: [], groupOrder: [] };
    const newChannelsFromAppend = parseResult.channels;
    const newGroupOrderFromAppend = parseResult.groupOrder;
    const wasChannelsEmpty = channels.length === 0;

    if (newChannelsFromAppend.length === 0) {
        showNotification(`No se encontraron canales válidos en ${escapeHtml(sourceNameForAppend)} para agregar.`, 'warning');
        showLoading(false);
        if (wasChannelsEmpty) {
            currentM3UName = null;
            currentM3UContent = null;
            currentGroupOrder = [];
            if (typeof filterAndRenderChannels === 'function') filterAndRenderChannels();
        }
        return;
    }

    if (wasChannelsEmpty) {
        channels = newChannelsFromAppend;
        currentGroupOrder = newGroupOrderFromAppend;
        currentM3UContent = newM3UString;
        currentM3UName = sourceNameForAppend;
    } else {
        channels.push(...newChannelsFromAppend);

        const existingGroupsSet = new Set(currentGroupOrder);
        newGroupOrderFromAppend.forEach(group => {
            if (!existingGroupsSet.has(group)) {
                currentGroupOrder.push(group);
            }
        });
        const allCurrentGroups = new Set(channels.map(c => c['group-title']).filter(Boolean));
        currentGroupOrder = currentGroupOrder.filter(g => allCurrentGroups.has(g));
        allCurrentGroups.forEach(g => {
            if (!currentGroupOrder.includes(g)) currentGroupOrder.push(g);
        });

        await regenerateCurrentM3UContentFromString();
    }

    currentPage = 1;
    if (typeof matchChannelsWithEpg === 'function') {
        matchChannelsWithEpg();
    }
    filterAndRenderChannels();

    let notificationMessage;
    const addedOrLoaded = wasChannelsEmpty ? 'cargados' : 'agregados/actualizados';
    notificationMessage = `${newChannelsFromAppend.length} canales de ${escapeHtml(sourceNameForAppend)} ${addedOrLoaded}.`;

    if (userSettings.autoSaveM3U) {
        if (currentM3UContent && currentM3UContent.length < 4 * 1024 * 1024) {
            await saveAppConfigValue('lastM3UFileContent', currentM3UContent);
            await saveAppConfigValue('lastM3UFileName', currentM3UName);
            await deleteAppConfigValue('lastM3UUrl');

            if (currentM3UName && !currentM3UName.startsWith('Xtream:')) {
                await deleteAppConfigValue('currentXtreamServerInfo');
            }
            else if (!sourceNameForAppend.startsWith('Xtream:') && await getAppConfigValue('currentXtreamServerInfo')) {
                 await deleteAppConfigValue('currentXtreamServerInfo');
            }
            notificationMessage += " Lista actual guardada para recarga automática.";
        } else if (currentM3UContent) {
            await deleteAppConfigValue('lastM3UFileContent');
            await deleteAppConfigValue('lastM3UFileName');
            await deleteAppConfigValue('lastM3UUrl');
            await deleteAppConfigValue('currentXtreamServerInfo');
            notificationMessage += " Lista actual demasiado grande, no se guardó para recarga automática.";
        }
    }
    showNotification(notificationMessage, 'success');
    showLoading(false);
}

async function regenerateCurrentM3UContentFromString() {
    if (!channels || channels.length === 0) {
        currentM3UContent = null;
        return;
    }
    let newM3U = "#EXTM3U\n";
    channels.forEach(ch => {
        let extinfLine = `#EXTINF:${ch.attributes?.duration || -1}`;

        const tempAttrs = {...ch.attributes};
        delete tempAttrs.duration;

        if (ch['tvg-id']) tempAttrs['tvg-id'] = ch['tvg-id'];
        if (ch['tvg-name']) tempAttrs['tvg-name'] = ch['tvg-name'];
        if (ch['tvg-logo']) tempAttrs['tvg-logo'] = ch['tvg-logo'];
        if (ch['group-title']) tempAttrs['group-title'] = ch['group-title'];
        if (ch.attributes && ch.attributes['ch-number']) tempAttrs['ch-number'] = ch.attributes['ch-number'];
        if (ch.sourceOrigin) tempAttrs['source-origin'] = ch.sourceOrigin;


        for (const key in tempAttrs) {
            if (tempAttrs[key] || typeof tempAttrs[key] === 'number') {
                extinfLine += ` ${key}="${tempAttrs[key]}"`;
            }
        }
        extinfLine += `,${ch.name}\n`;
        newM3U += extinfLine;

        if (ch.kodiProps) {
            Object.entries(ch.kodiProps).forEach(([key, value]) => {
                newM3U += `#KODIPROP:${key}=${value}\n`;
            });
        }
        if (ch.vlcOptions) {
            Object.entries(ch.vlcOptions).forEach(([key, value]) => {
                if (key === 'description' && value) {
                    newM3U += `#EXTVLCOPT:description=${value.replace(/[\n\r]+/g, ' ').replace(/"/g, "'")}\n`;
                } else {
                    newM3U += `#EXTVLCOPT:${key}=${value}\n`;
                }
            });
        }
        if (ch.extHttp && Object.keys(ch.extHttp).length > 0) {
            newM3U += `#EXTHTTP:${JSON.stringify(ch.extHttp)}\n`;
        }
        newM3U += `${ch.url}\n`;
    });
    currentM3UContent = newM3U;

    if (userSettings.autoSaveM3U && currentM3UContent && currentM3UName) {
         if (currentM3UContent.length < 4 * 1024 * 1024) {
            await saveAppConfigValue('lastM3UFileContent', currentM3UContent);
            await saveAppConfigValue('lastM3UFileName', currentM3UName);
            await deleteAppConfigValue('lastM3UUrl');
            if (currentM3UName && !currentM3UName.startsWith('Xtream:')) {
                await deleteAppConfigValue('currentXtreamServerInfo');
            }
         } else {
             showNotification("Lista M3U actualizada es muy grande (>4MB), no se guardará para recarga automática.", "warning");
             await deleteAppConfigValue('lastM3UFileContent');
             await deleteAppConfigValue('lastM3UFileName');
             await deleteAppConfigValue('lastM3UUrl');
             await deleteAppConfigValue('currentXtreamServerInfo');
         }
    }
}

function downloadCurrentM3U() {
    if (!currentM3UContent) {
        showNotification('No hay lista M3U cargada para descargar.', 'info');
        return;
    }
    const fileName = (currentM3UName ? currentM3UName.replace(/\.\.\.$/, '') : 'lista_player') + '.m3u';
    const blob = new Blob([currentM3UContent], { type: 'audio/mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Descargando lista como "${escapeHtml(fileName)}"`, 'success');
}