const DAZN_API_PLAYBACK = 'https://api.playback.indazn.com/v5/Playback';
const DAZN_API_REFRESH_TOKEN = 'https://ott-authz-bff-prod.ar.indazn.com/v5/RefreshAccessToken';
const DAZN_API_RAIL = 'https://rail-router.discovery.indazn.com/eu/v7/Rail';
const DAZN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let daznTokenPromiseResolver = null;

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadBase64 = parts[1];
        if (!payloadBase64) return null;
        const decoded = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

function showDaznTokenModal() {
    return new Promise((resolve) => {
        daznTokenPromiseResolver = resolve;
        try {
            const daznModalEl = document.getElementById('daznTokenModal');
            if (!daznModalEl) {
                resolve({ token: null, remember: false });
                daznTokenPromiseResolver = null;
                return;
            }
            const daznModal = bootstrap.Modal.getOrCreateInstance(daznModalEl, { backdrop: 'static', keyboard: false });
            $('#daznTokenModalInput').val('');
            $('#daznRememberTokenCheck').prop('checked', true);
            daznModal.show();
        } catch (e) {
            resolve({ token: null, remember: false });
            daznTokenPromiseResolver = null;
        }
    });
}

$(document).on('click', '#submitDaznTokenBtn', async () => {
    const tokenInput = $('#daznTokenModalInput').val();
    const rememberToken = $('#daznRememberTokenCheck').is(':checked');
    const currentResolver = daznTokenPromiseResolver;
    daznTokenPromiseResolver = null;
    if (currentResolver) {
        currentResolver({ token: tokenInput, remember: rememberToken });
    }
    const daznModalEl = document.getElementById('daznTokenModal');
    if (daznModalEl) {
        const daznModalInstance = bootstrap.Modal.getInstance(daznModalEl);
        if (daznModalInstance) {
            daznModalInstance.hide();
        }
    }
});

$(document).on('click', '#cancelDaznTokenBtn', () => {
    const currentResolver = daznTokenPromiseResolver;
    daznTokenPromiseResolver = null;
     if (currentResolver) {
        currentResolver({ token: null, remember: false });
    }
    const daznModalEl = document.getElementById('daznTokenModal');
    if (daznModalEl) {
        const daznModalInstance = bootstrap.Modal.getInstance(daznModalEl);
        if (daznModalInstance) {
            daznModalInstance.hide();
        }
    }
});


async function getDaznTokenFromUserInputOrSettings() {
    let token = daznAuthTokenState;
    if (!token) {
        if (typeof showLoading === 'function') showLoading(true, 'Esperando token DAZN...');
        const modalResult = await showDaznTokenModal();
        if (typeof showLoading === 'function') showLoading(false);

        const userInputToken = modalResult.token;
        const remember = modalResult.remember;

        if (userInputToken && userInputToken.trim() !== '') {
            daznAuthTokenState = userInputToken.trim();
            if (remember && typeof saveAppConfigValue === 'function' && typeof DAZN_TOKEN_DB_KEY !== 'undefined') {
                try {
                    await saveAppConfigValue(DAZN_TOKEN_DB_KEY, daznAuthTokenState);
                    if (typeof showNotification === 'function') showNotification('DAZN: Token guardado.', 'success');
                    if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
                } catch (e) {
                     if(typeof showNotification === 'function') showNotification('DAZN: Error al guardar token en BD.', 'error');
                }
            } else if (!remember && typeof deleteAppConfigValue === 'function' && typeof DAZN_TOKEN_DB_KEY !== 'undefined') {
                 try {
                    const existingToken = await getAppConfigValue(DAZN_TOKEN_DB_KEY);
                    if (existingToken) {
                        await deleteAppConfigValue(DAZN_TOKEN_DB_KEY);
                    }
                } catch (e) { console.warn("DAZN: Error revisando/borrando token de BD al no recordar", e); }
                if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
            }
            return daznAuthTokenState;
        }
        if (typeof showNotification === 'function' && !userInputToken) showNotification('DAZN: Operación de token cancelada o token vacío.', 'info');
        return null;
    }
    return token;
}

async function refreshDaznToken(currentToken, specificUserAgent = null) {
    if (!currentToken) return null;
    if (typeof showLoading === 'function') showLoading(true, 'Refrescando token DAZN...');
    const userAgentToUse = specificUserAgent || DAZN_USER_AGENT;

    try {
        const decoded = decodeJwtPayload(currentToken);
        if (!decoded || !decoded.deviceId) {
            if (typeof showNotification === 'function') showNotification('DAZN: Token inválido o no se pudo decodificar deviceId para refrescar.', 'error');
            daznAuthTokenState = null;
            if (typeof deleteAppConfigValue === 'function' && typeof DAZN_TOKEN_DB_KEY !== 'undefined') {
                try { await deleteAppConfigValue(DAZN_TOKEN_DB_KEY); } catch (e) { }
            }
            if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
            return null;
        }

        const device_id_suffix = decoded.deviceId.split('-').pop();
        if (!device_id_suffix) {
            if (typeof showNotification === 'function') showNotification('DAZN: DeviceId con formato inesperado.', 'error');
            return null;
        }

        const response = await fetch(DAZN_API_REFRESH_TOKEN, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json',
                'User-Agent': userAgentToUse
            },
            body: JSON.stringify({ DeviceId: device_id_suffix })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => `HTTP ${response.status}`);
            if (response.status === 401 || response.status === 403) {
                daznAuthTokenState = null;
                 if (typeof deleteAppConfigValue === 'function' && typeof DAZN_TOKEN_DB_KEY !== 'undefined') {
                    try { await deleteAppConfigValue(DAZN_TOKEN_DB_KEY); } catch (e) { }
                }
                if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
                if (typeof showNotification === 'function') showNotification('DAZN: Token inválido/expirado. Se solicitará uno nuevo al intentar la operación.', 'warning');
                return null;
            }
            throw new Error(`Error ${response.status} al refrescar token: ${errorText.substring(0,100)}`);
        }

        const data = await response.json();
        const newToken = data?.AuthToken?.Token;

        if (newToken) {
            daznAuthTokenState = newToken;
            const storedTokenShouldBeRemembered = await getAppConfigValue(DAZN_TOKEN_DB_KEY);

            if (storedTokenShouldBeRemembered && typeof saveAppConfigValue === 'function' && typeof DAZN_TOKEN_DB_KEY !== 'undefined') {
                try {
                    await saveAppConfigValue(DAZN_TOKEN_DB_KEY, daznAuthTokenState);
                    if (typeof showNotification === 'function') showNotification('DAZN: Token refrescado y guardado exitosamente.', 'success');
                } catch (e) {
                    if (typeof showNotification === 'function') showNotification('DAZN: Token refrescado, pero error al guardar en BD.', 'warning');
                }
            } else if (storedTokenShouldBeRemembered === null) {
                if (typeof showNotification === 'function') showNotification('DAZN: Token refrescado (sesión actual).', 'info');
            }
            if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
            return newToken;
        } else {
            throw new Error('Respuesta de refresco de token no contenía un nuevo token.');
        }
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`DAZN: Error refrescando token: ${error.message}`, 'error');
        return null;
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function getActiveDaznToken(forceUserInputIfInvalid = false, specificUserAgent = null) {
    let currentToken = daznAuthTokenState;

    if (!currentToken) {
        currentToken = await getDaznTokenFromUserInputOrSettings();
        if (!currentToken) {
            return null;
        }
        return currentToken;
    }

    const refreshedToken = await refreshDaznToken(currentToken, specificUserAgent);
    if (refreshedToken) {
        return refreshedToken;
    } else {
        if (forceUserInputIfInvalid) {
            if (typeof showNotification === 'function') showNotification('DAZN: El token actual no pudo ser refrescado. Se solicitará uno nuevo.', 'warning');
            daznAuthTokenState = null;
            currentToken = await getDaznTokenFromUserInputOrSettings();
             if (!currentToken) {
                return null;
            }
            return currentToken;
        } else {
            if (typeof showNotification === 'function') showNotification('DAZN: El token actual no pudo ser refrescado y no se forzó la entrada de uno nuevo. Usando token anterior si existe.', 'warning');
            return currentToken;
        }
    }
}


async function fetchSingleDaznAssetDetails(authToken, assetId, specificUserAgent = null) {
    const decodedToken = decodeJwtPayload(authToken);
    if (!decodedToken || !decodedToken.deviceId) {
        if (typeof showNotification === 'function') showNotification('DAZN: No se pudo decodificar deviceId del token activo.', 'error');
        return null;
    }

    const userAgentToUse = specificUserAgent || DAZN_USER_AGENT;

    const params = new URLSearchParams({
        'AppVersion': '0.60.0',
        'DrmType': 'WIDEVINE',
        'Format': 'MPEG-DASH',
        'PlayerId': '@dazn/peng-html5-core/web/web',
        'Platform': 'web',
        'LanguageCode': 'es',
        'Model': 'unknown',
        'Secure': 'true',
        'Manufacturer': 'microsoft',
        'PlayReadyInitiator': 'false',
        'Capabilities': 'mta',
        'AssetId': assetId
    });

    try {
        const response = await fetch(`${DAZN_API_PLAYBACK}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'User-Agent': userAgentToUse,
                'x-dazn-device': decodedToken.deviceId
            }
        });
        if (!response.ok) {
             const errorText = await response.text().catch(() => `HTTP ${response.status}`);
             throw new Error(`HTTP ${response.status} para AssetId ${assetId}`);
        }
        const data = await response.json();

        const playbackDetails = data?.PlaybackDetails?.[0];
        if (!playbackDetails || !playbackDetails.ManifestUrl || !playbackDetails.CdnToken) {
            return null;
        }

        const manifestUrl = playbackDetails.ManifestUrl;
        const cdnToken = playbackDetails.CdnToken;

        const linearIdMatch = manifestUrl.match(/dazn-linear-(\d+)/);
        const daznLinearId = linearIdMatch ? linearIdMatch[1] : null;

        return {
            assetId: assetId,
            title: null,
            baseUrl: manifestUrl,
            cdnTokenName: cdnToken.Name,
            cdnTokenValue: cdnToken.Value,
            daznLinearId: daznLinearId,
            streamUserAgent: userAgentToUse
        };

    } catch (error) {
        return null;
    }
}

async function fetchDaznRailDataAndChannelDetails(authToken, specificUserAgent = null) {
    if (typeof showLoading === 'function') showLoading(true, 'Obteniendo canales DAZN...');
    const userAgentToUse = specificUserAgent || DAZN_USER_AGENT;
    const params = new URLSearchParams({
        'id': 'LiveAndNextNew',
        'params': 'PageType:Home;ContentType:None',
        'languageCode': 'es',
        'country': 'es',
        'platform': 'web'
    });

    try {
        const response = await fetch(`${DAZN_API_RAIL}?${params.toString()}`, {
            headers: { 'User-Agent': userAgentToUse }
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => `HTTP ${response.status}`);
            throw new Error(`HTTP ${response.status} al obtener Rail data`);
        }
        const railData = await response.json();

        const daznChannelsInfo = [];
        const assetPromises = [];

        if (railData && railData.Tiles) {
            for (const tile of railData.Tiles) {
                if (tile.Type === 'Live' && tile.Label === 'Canal en directo' && tile.AssetId) {
                    assetPromises.push(
                        fetchSingleDaznAssetDetails(authToken, tile.AssetId, userAgentToUse)
                        .then(details => {
                            if (details) {
                                details.title = tile.Title;
                                return details;
                            }
                            return null;
                        })
                    );
                }
            }
        }

        const resolvedAssets = await Promise.all(assetPromises);
        resolvedAssets.forEach(asset => {
            if (asset) {
                daznChannelsInfo.push(asset);
            }
        });

        if (daznChannelsInfo.length === 0 && typeof showNotification === 'function') {
             showNotification('DAZN: No se encontraron canales en directo desde la API.', 'warning');
        }
        return daznChannelsInfo;

    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`DAZN: Error obteniendo lista de canales: ${error.message}`, 'error');
        return [];
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}

async function orchestrateDaznUpdate(specificUserAgent = null) {
    if (typeof showLoading === 'function') showLoading(true, 'Iniciando actualización DAZN...');
    try {
        const authToken = await getActiveDaznToken(true, specificUserAgent);

        if (!authToken) {
            if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();
            return;
        }

        const daznChannelDetailsList = await fetchDaznRailDataAndChannelDetails(authToken, specificUserAgent);

        if (daznChannelDetailsList && daznChannelDetailsList.length > 0) {
            if (typeof window.updateM3UWithDaznData === 'function') {
                window.updateM3UWithDaznData(daznChannelDetailsList);
            } else {
                if (typeof showNotification === 'function') showNotification('DAZN: Error interno, no se pudo actualizar M3U.', 'error');
            }
        } else if (daznChannelDetailsList) {
             if (typeof showNotification === 'function') showNotification('DAZN: No se obtuvieron detalles de canales para actualizar.', 'info');
        }
    } catch (error) {
        if (typeof showNotification === 'function') showNotification(`DAZN: Error general durante la actualización: ${error.message}`, 'error');
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
    }
}