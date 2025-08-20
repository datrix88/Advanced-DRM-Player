async function loadLastM3U() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('url') || urlParams.has('name')) { return; }

    if (!userSettings.autoSaveM3U) {
        checkIfChannelsExist();
        return;
    }

    const lastUrl = await getAppConfigValue('lastM3UUrl');
    const lastFileContent = await getAppConfigValue('lastM3UFileContent');
    const lastXtreamInfoStr = await getAppConfigValue('currentXtreamServerInfo');

    if (lastXtreamInfoStr) {
        try {
            const lastXtreamInfo = JSON.parse(lastXtreamInfoStr);
            if (lastXtreamInfo && lastXtreamInfo.host && lastXtreamInfo.username && lastXtreamInfo.password) {
                showNotification(`Recargando última conexión Xtream: ${escapeHtml(lastXtreamInfo.name || lastXtreamInfo.host)}...`, 'info');
                if(typeof handleConnectXtreamServer === 'function') {
                     $('#xtreamServerNameInput').val(lastXtreamInfo.name || '');
                     $('#xtreamHostInput').val(lastXtreamInfo.host);
                     $('#xtreamUsernameInput').val(lastXtreamInfo.username);
                     $('#xtreamPasswordInput').val(lastXtreamInfo.password);
                     $('#xtreamOutputTypeSelect').val(lastXtreamInfo.outputType || 'm3u_plus');
                     $('#xtreamFetchEpgCheck').prop('checked', typeof lastXtreamInfo.fetchEpg === 'boolean' ? lastXtreamInfo.fetchEpg : true);
                     handleConnectXtreamServer();
                } else {
                    checkIfChannelsExist();
                }
                return;
            } else {
                await deleteAppConfigValue('currentXtreamServerInfo');
            }
        } catch (e) {
            await deleteAppConfigValue('currentXtreamServerInfo');
        }
    }

    if (lastUrl) {
        showNotification('Cargando última lista URL...', 'info');
        loadUrl(lastUrl)
            .catch(async () => {
                await deleteAppConfigValue('lastM3UUrl');
                const lastFileContentAfterFail = await getAppConfigValue('lastM3UFileContent');
                if (lastFileContentAfterFail) loadLastM3U();
                else checkIfChannelsExist();
            });
    } else if (lastFileContent) {
        showNotification('Cargando última lista local guardada...', 'info');
        try {
            const m3uName = await getAppConfigValue('lastM3UFileName') || 'lista_local_guardada.m3u';
            processM3UContent(lastFileContent, m3uName, true);
        } catch (err) {
            showNotification(`Error recargando lista local: ${err.message}`, 'error');
            await deleteAppConfigValue('lastM3UFileContent');
            await deleteAppConfigValue('lastM3UFileName');
            channels = []; currentM3UContent = null; currentM3UName = null; currentGroupOrder = [];
            filterAndRenderChannels();
        }
    } else {
        checkIfChannelsExist();
        let initialGroupToSelect = "";
        if (userSettings.persistFilters && userSettings.lastSelectedGroup) {
            initialGroupToSelect = userSettings.lastSelectedGroup;
        }
        $('#groupFilterSidebar').val(initialGroupToSelect);
        filterAndRenderChannels();
    }
}

async function toggleFavorite(url) {
    const index = favorites.indexOf(url);
    const $button = $(`.favorite-btn[data-url="${escapeHtml(url)}"]`);
    if (index > -1) {
        favorites.splice(index, 1);
        $button.removeClass('favorite').attr('title', 'Añadir favorito');
        showNotification('Quitado de favoritos.', 'info');
    } else {
        favorites.push(url);
        $button.addClass('favorite').attr('title', 'Quitar favorito');
        showNotification('Añadido a favoritos.', 'success');
    }
    await saveAppConfigValue('favorites', favorites);

    if (currentFilter === 'favorites') {
        currentPage = 1;
        filterAndRenderChannels();
    } else {
        updateGroupSelectors();
    }
}

async function addToHistory(channel) {
    if (!channel || !channel.url) { return; }
    appHistory = appHistory.filter(hUrl => hUrl !== channel.url);
    appHistory.unshift(channel.url);
    appHistory = appHistory.slice(0, 50);
    await saveAppConfigValue('history', appHistory);

    if (currentFilter === 'history') {
        currentPage = 1;
        filterAndRenderChannels();
    } else {
        updateGroupSelectors();
    }
}

async function clearCacheAndReload() {
    const confirmed = await showConfirmationModal(
        "¿Estás seguro de que quieres borrar TODOS los datos locales (historial, favoritos, listas guardadas, servidores Xtream, EPG, ajustes y tokens)? La página se recargará.",
        "Confirmar Limpieza Completa",
        "Sí, Borrar Todo",
        "btn-danger"
    );

    if (!confirmed) {
        showNotification("Operación cancelada.", "info");
        return;
    }

    showLoading(true, "Limpiando datos...");
    try {
        if (typeof dbPromise !== 'undefined' && dbPromise) {
            const db = await dbPromise;
            if (db) {
                db.close();
                dbPromise = null;
            }
        }

        await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            deleteRequest.onsuccess = () => {
                showNotification("Base de datos eliminada. La página se recargará.", "success");
                setTimeout(() => window.location.reload(), 1500);
                resolve();
            };
            deleteRequest.onerror = (event) => {
                reject(event.target.error);
            };
            deleteRequest.onblocked = () => {
                showNotification("Borrado de BD bloqueado. Cierra otras pestañas de la extensión y reintenta.", "warning");
                reject(new Error("Database deletion blocked"));
            };
        });

    } catch (error) {
        showLoading(false);
        showNotification("Error limpiando datos: " + error.message, "error");
    }
}

function handleSaveToDB() {
    const nameInput = $('#saveM3UNameInput').val();
    if (!nameInput || !nameInput.trim()) {
        showNotification('Nombre de lista inválido o vacío. Guardado cancelado.', 'info');
        return;
    }
    const finalName = nameInput.trim();
    const saveModalInstance = bootstrap.Modal.getInstance(document.getElementById('saveM3UModal'));
    if(saveModalInstance) saveModalInstance.hide();

    showLoading(true, `Guardando "${escapeHtml(finalName)}"...`);
    if (typeof saveFileToDB === 'function') {
        saveFileToDB(finalName, currentM3UContent)
            .then(() => showNotification(`Lista "${escapeHtml(finalName)}" guardada (${typeof countChannels === 'function' ? countChannels(currentM3UContent) : 0} canales).`, 'success'))
            .catch(err => {
                if (err.message.includes('cancelada')) {
                    showNotification('Guardado cancelado por el usuario.', 'info');
                } else {
                    showNotification(`Error al guardar "${escapeHtml(finalName)}": ${err.message}`, 'error');
                }
            })
            .finally(() => showLoading(false));
    } else {
        showLoading(false);
    }
}