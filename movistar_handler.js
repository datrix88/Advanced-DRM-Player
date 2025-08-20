const MOVISTAR_API_BASE = 'https://auth.dof6.com';
const MOVISTAR_API_CLIENTSERVICES = 'https://clientservices.dof6.com';
const MOVISTAR_API_IDSERVER = 'https://idserver.dof6.com';
const MOVISTAR_UI_VERSION = '2.45.20';
const MOVISTAR_API_DEVICES_ENDPOINT = `${MOVISTAR_API_CLIENTSERVICES}/movistarplus/accounts/{ACCOUNTNUMBER}/devices?qspVersion=ssp`;
const MOVISTAR_API_REGISTER_DEVICE_ENDPOINT = `${MOVISTAR_API_BASE}/movistarplus/android.tv/accounts/{ACCOUNTNUMBER}/devices/?qspVersion=ssp`;

const M_SHORT_TOKEN_KEY = 'movistar_shortToken';
const M_SHORT_TOKEN_EXPIRY_KEY = 'movistar_shortTokenExpiry';
const M_LONG_TOKEN_PREFIX = 'movistar_longToken_';
const M_LAST_USED_TOKEN_ID_KEY = 'movistar_lastUsedLongTokenId';
const M_LAST_ROTATION_DATE_KEY = 'movistar_lastRotationDate';
const M_REFRESH_LONG_TOKEN_WITHIN_DAYS = 2;

let movistarLogCallback = (message, type = 'info') => { console.log(`[MovistarHandler Log|${type}]: ${message}`); };

function setMovistarLogCallback(callback) {
    if (typeof callback === 'function') {
        movistarLogCallback = callback;
    }
}

function _log(message, type = 'info') {
    movistarLogCallback(message, type);
}

function _parseJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const paddedBase64 = base64 + '==='.slice((base64.length + 3) % 4);
        const jsonPayload = decodeURIComponent(atob(paddedBase64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        _log(`Error decodificando JWT: ${e.message}`, 'error');
        return null;
    }
}

async function _getAllLongTokensFromDB() {
    _log('Obteniendo todos los tokens largos de la DB...');
    if (typeof getAllAppConfigValues !== 'function') {
        _log('Función getAllAppConfigValues no disponible en db_manager.js. No se pueden listar tokens largos.', 'error');
        return [];
    }
    try {
        const allConfig = await getAllAppConfigValues();
        const longTokens = [];
        for (const key in allConfig) {
            if (key.startsWith(M_LONG_TOKEN_PREFIX) && allConfig[key] && typeof allConfig[key] === 'object') {
                longTokens.push(allConfig[key]);
            }
        }
        _log(`Se encontraron ${longTokens.length} tokens largos en la DB.`);
        return longTokens;
    } catch (error) {
        _log(`Error cargando todos los tokens largos: ${error.message}`, 'error');
        return [];
    }
}

async function _saveLongTokenToDB(tokenData) {
    if (!tokenData || !tokenData.id || !tokenData.id.startsWith(M_LONG_TOKEN_PREFIX)) {
        _log(`Intento de guardar token largo con ID inválido o faltante: ${JSON.stringify(tokenData)}`, 'error');
        throw new Error("ID de token largo inválido o faltante.");
    }
    _log(`Guardando token largo ID: ${tokenData.id.slice(-12)}`);
    return saveAppConfigValue(tokenData.id, tokenData);
}

async function _deleteLongTokenFromDB(tokenId) {
    _log(`Eliminando token largo ID: ${tokenId.slice(-12)}`);
    return deleteAppConfigValue(tokenId);
}

async function _getOrCreateFunctionalDeviceId(longTokenData) {
    _log("Buscando/Creando Device ID funcional...", 'info');
    if (!longTokenData || !longTokenData.login_token || !longTokenData.account_nbr) {
        throw new Error("Datos de token insuficientes para buscar/crear Device ID.");
    }
    const url = MOVISTAR_API_DEVICES_ENDPOINT.replace('{ACCOUNTNUMBER}', longTokenData.account_nbr);
    const headers = {
        'Authorization': `Bearer ${longTokenData.login_token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01', 'x-movistarplus-ui': MOVISTAR_UI_VERSION,
        'x-movistarplus-os': 'Windows10', 'Origin': 'https://ver.movistarplus.es', 'Referer': 'https://ver.movistarplus.es/'
    };

    try {
        _log("Consultando /devices...", 'info');
        const response = await fetch(url, { method: 'GET', headers: headers });
        const responseText = await response.text();
        _log(`Respuesta /devices: ${response.status}`, 'debug');
        if (!response.ok) { throw new Error(`Fallo consulta /devices: ${response.status} ${responseText.substring(0,100)}`); }

        const devices = JSON.parse(responseText);
        if (!Array.isArray(devices)) throw new Error("Respuesta /devices no es array.");

        const validDevices = devices.filter(d => d && d.Id && d.Id !== '-');
        _log(`Encontrados ${validDevices.length} dispositivos válidos.`, 'info');

        const preferredTypes = ["WP_DASH", "ANTV"];
        for (const type of preferredTypes) {
            const device = validDevices.find(d => d.DeviceTypeCode === type);
            if (device) { _log(`Reutilizando device tipo ${type}: ...${device.Id.slice(-6)}`, 'info'); return device.Id; }
        }
        if (validDevices.length > 0) { _log(`Reutilizando primer device válido (tipo ${validDevices[0].DeviceTypeCode}): ...${validDevices[0].Id.slice(-6)}`, 'info'); return validDevices[0].Id; }

        _log("No hay devices válidos, registrando nuevo...", 'info');
        const registerUrl = MOVISTAR_API_REGISTER_DEVICE_ENDPOINT.replace('{ACCOUNTNUMBER}', longTokenData.account_nbr);
        const registerHeaders = { ...headers, 'Content-Type': 'application/json' };
        delete registerHeaders.Origin; delete registerHeaders.Referer;

        const registerResponse = await fetch(registerUrl, { method: 'POST', headers: registerHeaders });
        const newDeviceIdText = await registerResponse.text();
        const newDeviceId = newDeviceIdText.trim().replace(/^"|"$/g, '');
        _log(`Respuesta registro: ${registerResponse.status}`, 'debug');

        if (!registerResponse.ok || !newDeviceId || newDeviceId.length < 10) {
             let errorMsg = `Fallo registro: ${registerResponse.status}`;
             if (newDeviceIdText.length < 200 && !newDeviceIdText.includes('<')) errorMsg += ` - ${newDeviceIdText}`;
             if (registerResponse.status === 403 || newDeviceIdText.toLowerCase().includes('limit')) errorMsg = "Límite de dispositivos alcanzado.";
             throw new Error(errorMsg);
        }
        _log(`Nuevo device registrado: ...${newDeviceId.slice(-6)}`, 'success');
        return newDeviceId;

    } catch (error) {
        _log(`Error en flujo Device ID: ${error.message}`, 'error'); throw error;
    }
}

async function _refreshMovistarLongToken(currentTokenData) {
    _log(`Intentando renovar token largo ID: ${currentTokenData?.id?.slice(-12)}`, 'info');
    if (!currentTokenData?.login_token || !currentTokenData?.account_nbr || !currentTokenData?.device_id) {
        _log("Datos insuficientes para renovación.", 'error'); return null;
    }
    const { login_token, account_nbr, device_id } = currentTokenData;
    try {
        const sdpUrl = `${MOVISTAR_API_CLIENTSERVICES}/movistarplus/android.tv/sdp/mediaPlayers/${device_id}/initData?qspVersion=ssp&version=8&status=login`;
        const sdpHeaders = {
            'x-movistarplus-ui': MOVISTAR_UI_VERSION, 'Authorization': `Bearer ${login_token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36', 'Content-Type': 'application/json', 'Accept': 'application/json, text/javascript, */*; q=0.01',
            'x-movistarplus-deviceid': device_id, 'x-movistarplus-os': 'Windows10'
        };
        const sdpPayload = { 'accountNumber': account_nbr, 'sessionUserProfile': 0, 'streamMiscellanea': 'HTTPS', 'deviceType': 'WP_OTT', 'deviceManufacturerProduct': 'Chrome', 'streamDRM': 'Widevine', 'streamFormat': 'DASH' };

        _log("Solicitando initData para refrescar token largo...", 'info');
        const sdpResponse = await fetch(sdpUrl, { method: 'POST', headers: sdpHeaders, body: JSON.stringify(sdpPayload) });
        const sdpRespJson = await sdpResponse.json();
        if (!sdpResponse.ok || !sdpRespJson.accessToken) { throw new Error(`Fallo SDP (refresh long): ${sdpRespJson.message || sdpResponse.status}`); }

        const refreshed_login_token = sdpRespJson.accessToken;
        const newJwtPayload = _parseJwtPayload(refreshed_login_token);
        if (!newJwtPayload || !newJwtPayload.exp) { throw new Error("Token largo refrescado inválido."); }

        _log("Token largo renovado con éxito.", 'success');
        return { ...currentTokenData, login_token: refreshed_login_token, expiry_tstamp: newJwtPayload.exp };
    } catch (error) {
        _log(`Error renovando token largo: ${error.message}`, 'error'); return null;
    }
}

async function _getValidLongTokenForCdnGeneration() {
     _log("Buscando token largo válido para generar CDN...", 'info');
     const now = Math.floor(Date.now() / 1000);
     const currentDateStr = new Date().toISOString().slice(0, 10);

     const allLongTokens = await _getAllLongTokensFromDB();
     const validFunctionalTokens = allLongTokens.filter(t => t.expiry_tstamp > now && t.device_id);

     if (validFunctionalTokens.length === 0) {
         _log("No se encontraron tokens largos válidos CON Device ID.", 'error');
         return null;
     }
     _log(`Encontrados ${validFunctionalTokens.length} tokens largos funcionales.`, 'info');

     const lastUsedId = await getAppConfigValue(M_LAST_USED_TOKEN_ID_KEY);
     const lastRotationDate = await getAppConfigValue(M_LAST_ROTATION_DATE_KEY);
     let selectedToken = null;
     let needsRotation = false;

     if (!lastRotationDate || currentDateStr > lastRotationDate || !lastUsedId) {
         needsRotation = true;
         _log("Necesita rotación (fecha o último ID no encontrado).", 'info');
     } else {
         selectedToken = validFunctionalTokens.find(t => t.id === lastUsedId);
         if (!selectedToken) {
             needsRotation = true;
             _log("Necesita rotación (último ID usado ya no es válido/funcional).", 'info');
         }
     }

     if (needsRotation) {
         let nextTokenIndex = 0;
         if (lastUsedId) {
             const lastOriginalIndex = allLongTokens.findIndex(t => t.id === lastUsedId);
             if (lastOriginalIndex !== -1) {
                  let foundNextValid = false;
                  for (let i = 1; i <= allLongTokens.length; i++) {
                       const potentialNextOriginalIndex = (lastOriginalIndex + i) % allLongTokens.length;
                       const potentialTokenId = allLongTokens[potentialNextOriginalIndex]?.id;
                       if(potentialTokenId) {
                            const validIndex = validFunctionalTokens.findIndex(vt => vt.id === potentialTokenId);
                            if (validIndex !== -1) {
                                 nextTokenIndex = validIndex;
                                 foundNextValid = true;
                                 break;
                            }
                       }
                  }
                  if (!foundNextValid) nextTokenIndex = 0;
             }
         }
          selectedToken = validFunctionalTokens[nextTokenIndex % validFunctionalTokens.length];
          _log(`Token rotado a: ${selectedToken.id.slice(-12)}`, 'info');
          await saveAppConfigValue(M_LAST_USED_TOKEN_ID_KEY, selectedToken.id);
          await saveAppConfigValue(M_LAST_ROTATION_DATE_KEY, currentDateStr);
     } else {
         _log(`Reutilizando último token largo usado: ${selectedToken.id.slice(-12)}`, 'info');
     }

     const refreshThreshold = now + (M_REFRESH_LONG_TOKEN_WITHIN_DAYS * 24 * 60 * 60);
     if (selectedToken.expiry_tstamp < refreshThreshold) {
         _log(`Token ${selectedToken.id.slice(-12)} cerca de expirar, intentando refresco...`, 'info');
         try {
             const refreshedData = await _refreshMovistarLongToken(selectedToken);
             if (refreshedData) {
                 _log(`Refresco de token largo ${selectedToken.id.slice(-12)} exitoso.`, 'success');
                 await _saveLongTokenToDB(refreshedData);
                 selectedToken = refreshedData;
             } else {
                  _log(`Refresco de token largo ${selectedToken.id.slice(-12)} fallido. Usando el actual.`, 'warning');
             }
         } catch (refreshError) {
              _log(`Error durante el refresco oportunista: ${refreshError.message}`, 'error');
         }
     }
     return selectedToken;
}

async function doMovistarLoginAndGetTokens(username, password) {
    _log(`LOGIN: Iniciando para usuario ${username}...`, 'info');
    let result = { success: false, message: "Error desconocido", shortToken: null, shortTokenExpiry: 0, longTokenData: null };

    if (!username || !password) {
        result.message = "Usuario o contraseña vacíos.";
        _log(result.message, 'error');
        return result;
    }

    try {
        _log(`Realizando login para usuario: ${username}...`, 'info');
        const loginUrl = `${MOVISTAR_API_BASE}/auth/oauth2/token?deviceClass=android.tv`;
        const loginHeaders = {
            'x-movistarplus-ui': MOVISTAR_UI_VERSION, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json, text/javascript, */*; q=0.01',
            'x-movistarplus-os': 'Windows10'
        };
        const loginBody = new URLSearchParams({'grant_type': 'password', 'deviceClass': 'android.tv', 'username': username, 'password': password });
        const response = await fetch(loginUrl, { method: 'POST', headers: loginHeaders, body: loginBody.toString() });
        const respJson = await response.json();

        if (!response.ok || !respJson.access_token) {
            throw new Error(`Fallo en login: ${respJson.error_description || respJson.message || `Error ${response.status}`}`);
        }

        const new_login_token = respJson.access_token;
        const jwtPayload = _parseJwtPayload(new_login_token);
        if (!jwtPayload || !jwtPayload.accountNumber || !jwtPayload.exp) {
            throw new Error('Token de login inválido o incompleto.');
        }
        const loggedInAccountNumber = jwtPayload.accountNumber;
        const loggedInExpiry = jwtPayload.exp;
        _log(`Login OK para cuenta: ${loggedInAccountNumber}`, 'success');

        const functional_device_id = await _getOrCreateFunctionalDeviceId({ login_token: new_login_token, account_nbr: loggedInAccountNumber });
        if (!functional_device_id) throw new Error("No se pudo obtener/registrar Device ID funcional.");
        _log(`Device ID funcional: ...${functional_device_id.slice(-6)}`, 'info');

        let existingTokenId = `${M_LONG_TOKEN_PREFIX}${Date.now()}_login_${Math.random().toString(16).slice(2,8)}`;
        const allExistingTokens = await _getAllLongTokensFromDB();
        const existingTokenForAccount = allExistingTokens.find(t => t.account_nbr === loggedInAccountNumber);
        if (existingTokenForAccount) {
            existingTokenId = existingTokenForAccount.id;
            _log(`Token existente encontrado para ${loggedInAccountNumber} (ID: ...${existingTokenId.slice(-12)}). Se actualizará.`, 'info');
        } else {
            _log(`Creando nuevo token para ${loggedInAccountNumber} (ID: ...${existingTokenId.slice(-12)}).`, 'info');
        }

        result.longTokenData = {
            id: existingTokenId, login_token: new_login_token, account_nbr: loggedInAccountNumber,
            expiry_tstamp: loggedInExpiry, device_id: functional_device_id
        };
        await _saveLongTokenToDB(result.longTokenData);
        await saveAppConfigValue(M_LAST_USED_TOKEN_ID_KEY, result.longTokenData.id);
        await saveAppConfigValue(M_LAST_ROTATION_DATE_KEY, new Date().toISOString().slice(0, 10));
        _log(`Token largo ${existingTokenForAccount ? 'actualizado' : 'guardado'} en DB.`, 'info');

        _log('Generando token CDN...', 'info');
        const sdpUrl = `${MOVISTAR_API_CLIENTSERVICES}/movistarplus/android.tv/sdp/mediaPlayers/${result.longTokenData.device_id}/initData?qspVersion=ssp&version=8&status=login`;
        const sdpHeaders = {
            'x-movistarplus-ui': MOVISTAR_UI_VERSION, 'Authorization': `Bearer ${result.longTokenData.login_token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36', 'Content-Type': 'application/json', 'Accept': 'application/json, text/javascript, */*; q=0.01',
            'x-movistarplus-deviceid': result.longTokenData.device_id, 'x-movistarplus-os': 'Windows10'
        };
        const sdpPayload = {
            'accountNumber': result.longTokenData.account_nbr, 'sessionUserProfile': 0, 'streamMiscellanea': 'HTTPS', 'deviceType': 'WP_OTT',
            'deviceManufacturerProduct': 'Chrome', 'streamDRM': 'Widevine', 'streamFormat': 'DASH'
        };
        const responseSDP = await fetch(sdpUrl, { method: 'POST', headers: sdpHeaders, body: JSON.stringify(sdpPayload) });
        const respJsonSDP = await responseSDP.json();
        if (!responseSDP.ok || !respJsonSDP.accessToken || !respJsonSDP.token) { throw new Error(`Fallo al obtener SDP init data: ${respJsonSDP.message || `Error ${responseSDP.status}`}.`); }

        const sdp_access_token = respJsonSDP.accessToken;
        const hzid_token = respJsonSDP.token;

        const cdnTokenUrl = `${MOVISTAR_API_IDSERVER}/${result.longTokenData.account_nbr}/devices/android.tv/cdn/token/refresh`;
        const cdnHeaders = {
            'Authorization': `Bearer ${sdp_access_token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Content-Type': 'application/json', 'Accept': 'application/vnd.miviewtv.v1+json', 'X-HZId': hzid_token
        };
        const responseCdn = await fetch(cdnTokenUrl, { method: 'POST', headers: cdnHeaders });
        const responseCdnText = await responseCdn.text();
        if (!responseCdn.ok) { throw new Error(`Fallo al obtener Token CDN: Error ${responseCdn.status} - ${responseCdnText.substring(0, 100)}`); }
        let respJsonCdn;
        try { respJsonCdn = JSON.parse(responseCdnText); } catch (e) { throw new Error("Respuesta CDN OK pero no JSON."); }
        if (!respJsonCdn || !respJsonCdn.access_token) { throw new Error(`Fallo al obtener Token CDN: ${respJsonCdn?.message || 'No access_token'}`); }

        result.shortToken = respJsonCdn.access_token;
        const cdnPayload = _parseJwtPayload(result.shortToken);
        result.shortTokenExpiry = (cdnPayload && cdnPayload.exp) ? cdnPayload.exp : 0;

        await saveAppConfigValue(M_SHORT_TOKEN_KEY, result.shortToken);
        await saveAppConfigValue(M_SHORT_TOKEN_EXPIRY_KEY, result.shortTokenExpiry);
        _log(`Nuevo Token CDN obtenido (expira: ${new Date(result.shortTokenExpiry * 1000).toLocaleString()}) y guardado.`, 'success');

        result.success = true;
        result.message = "Login y obtención de tokens completados con éxito.";

    } catch (error) {
        result.message = error.message;
        _log(`Error en Login Movistar: ${error.message}`, 'error');
    }
    return result;
}

async function refreshMovistarCdnToken(forceNew = false) {
    _log("REFRESH CDN: Iniciando...", 'info');
    let result = { success: false, message: "Error desconocido al refrescar CDN", shortToken: null, shortTokenExpiry: 0 };
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = 60; // 1 minuto de buffer

    if (!forceNew) {
        try {
            const cachedToken = await getAppConfigValue(M_SHORT_TOKEN_KEY);
            let cachedExpiry = await getAppConfigValue(M_SHORT_TOKEN_EXPIRY_KEY) || 0;
            if (typeof cachedExpiry !== 'number') cachedExpiry = 0;

            if (cachedToken && cachedExpiry > (nowSeconds + bufferSeconds)) {
                _log(`Usando token CDN cacheado (expira: ${new Date(cachedExpiry * 1000).toLocaleString()})`, 'info');
                result.shortToken = cachedToken;
                result.shortTokenExpiry = cachedExpiry;
                result.success = true;
                result.message = "Token CDN obtenido de la caché.";
                return result;
            } else {
                _log("Token CDN cacheado no válido o expirado. Procediendo a generar uno nuevo.", 'info');
                 await deleteAppConfigValue(M_SHORT_TOKEN_KEY);
                 await deleteAppConfigValue(M_SHORT_TOKEN_EXPIRY_KEY);
            }
        } catch (cacheError) {
            _log(`Error leyendo caché de token CDN: ${cacheError.message}. Generando nuevo.`, 'warning');
        }
    } else {
        _log("Forzando generación de nuevo token CDN.", 'info');
    }

    try {
        const longTokenToUse = await _getValidLongTokenForCdnGeneration();
        if (!longTokenToUse) {
            throw new Error("No se encontró token largo válido y funcional para generar CDN.");
        }
        _log(`Usando Token Largo ID: ...${longTokenToUse.id.slice(-12)} (Exp: ${new Date(longTokenToUse.expiry_tstamp * 1000).toLocaleDateString()})`, 'info');
        _log(`Con Device ID: ...${longTokenToUse.device_id.slice(-6)}`, 'info');

        _log('Generando nuevo token CDN...', 'info');
        const sdpUrl = `${MOVISTAR_API_CLIENTSERVICES}/movistarplus/android.tv/sdp/mediaPlayers/${longTokenToUse.device_id}/initData?qspVersion=ssp&version=8&status=login`;
        const sdpHeaders = {
            'x-movistarplus-ui': MOVISTAR_UI_VERSION, 'Authorization': `Bearer ${longTokenToUse.login_token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36', 'Content-Type': 'application/json', 'Accept': 'application/json, text/javascript, */*; q=0.01',
            'x-movistarplus-deviceid': longTokenToUse.device_id, 'x-movistarplus-os': 'Windows10'
        };
        const sdpPayload = {
            'accountNumber': longTokenToUse.account_nbr, 'sessionUserProfile': 0, 'streamMiscellanea': 'HTTPS', 'deviceType': 'WP_OTT',
            'deviceManufacturerProduct': 'Chrome', 'streamDRM': 'Widevine', 'streamFormat': 'DASH'
        };
        const responseSDP = await fetch(sdpUrl, { method: 'POST', headers: sdpHeaders, body: JSON.stringify(sdpPayload) });
        const respJsonSDP = await responseSDP.json();
        if (!responseSDP.ok || !respJsonSDP.accessToken || !respJsonSDP.token) { throw new Error(`Fallo al obtener SDP init data (refresh): ${respJsonSDP.message || `Error ${responseSDP.status}`}.`); }

        const sdp_access_token = respJsonSDP.accessToken;
        const hzid_token = respJsonSDP.token;

        const cdnTokenUrl = `${MOVISTAR_API_IDSERVER}/${longTokenToUse.account_nbr}/devices/android.tv/cdn/token/refresh`;
        const cdnHeaders = {
            'Authorization': `Bearer ${sdp_access_token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Content-Type': 'application/json', 'Accept': 'application/vnd.miviewtv.v1+json', 'X-HZId': hzid_token
        };
        const responseCdn = await fetch(cdnTokenUrl, { method: 'POST', headers: cdnHeaders });
        const responseCdnText = await responseCdn.text();
        if (!responseCdn.ok) { throw new Error(`Fallo al obtener Token CDN (refresh): Error ${responseCdn.status} - ${responseCdnText.substring(0, 100)}`); }
        let respJsonCdn;
        try { respJsonCdn = JSON.parse(responseCdnText); } catch (e) { throw new Error("Respuesta CDN OK pero no JSON (refresh)."); }
        if (!respJsonCdn || !respJsonCdn.access_token) { throw new Error(`Fallo al obtener Token CDN (refresh): ${respJsonCdn?.message || 'No access_token'}`); }

        result.shortToken = respJsonCdn.access_token;
        const cdnPayload = _parseJwtPayload(result.shortToken);
        result.shortTokenExpiry = (cdnPayload && cdnPayload.exp) ? cdnPayload.exp : 0;

        if (result.shortTokenExpiry <= Math.floor(Date.now() / 1000)) {
            throw new Error("Token CDN generado (refresh) ya ha expirado.");
        }

        await saveAppConfigValue(M_SHORT_TOKEN_KEY, result.shortToken);
        await saveAppConfigValue(M_SHORT_TOKEN_EXPIRY_KEY, result.shortTokenExpiry);
        _log(`Nuevo Token CDN obtenido vía refresh (expira: ${new Date(result.shortTokenExpiry * 1000).toLocaleString()}) y guardado.`, 'success');

        result.success = true;
        result.message = "Token CDN refrescado y guardado con éxito.";

    } catch (error) {
        result.message = error.message;
        _log(`Error refrescando token CDN: ${error.message}`, 'error');
    }
    return result;
}

async function getAllLongTokens() {
    return _getAllLongTokensFromDB();
}

async function deleteLongToken(tokenId) {
     _log(`Eliminando token largo (handler): ${tokenId.slice(-12)}`, 'info');
    await _deleteLongTokenFromDB(tokenId);
    const lastUsedId = await getAppConfigValue(M_LAST_USED_TOKEN_ID_KEY);
    if (lastUsedId === tokenId) {
        await deleteAppConfigValue(M_LAST_USED_TOKEN_ID_KEY);
        _log("Referencia a último token usado eliminada.", 'info');
    }
}

async function validateAllLongTokens() {
    _log("Validando todos los tokens largos...", 'info');
    const nowSeconds = Math.floor(Date.now() / 1000);
    const refreshThresholdSeconds = M_REFRESH_LONG_TOKEN_WITHIN_DAYS * 24 * 60 * 60;
    let report = { validated: 0, functional: 0, expired: 0, refreshed: 0, refreshErrors: 0, noDeviceId: 0 };

    const tokens = await _getAllLongTokensFromDB();
    report.validated = tokens.length;

    for (const token of tokens) {
        if (!token || !token.expiry_tstamp) continue;

        if (token.expiry_tstamp < nowSeconds) {
            report.expired++;
        } else {
            if (!token.device_id) {
                report.noDeviceId++;
            } else {
                report.functional++;
                if (token.expiry_tstamp < (nowSeconds + refreshThresholdSeconds)) {
                    _log(`Token ${token.id.slice(-12)} cerca de expirar. Intentando refresco...`, 'info');
                    try {
                        const refreshedData = await _refreshMovistarLongToken(token);
                        if (refreshedData) {
                            await _saveLongTokenToDB(refreshedData);
                            report.refreshed++;
                            _log(`Token ${token.id.slice(-12)} refrescado.`, 'success');
                        } else {
                            report.refreshErrors++;
                            _log(`Fallo al refrescar token ${token.id.slice(-12)}.`, 'warning');
                        }
                    } catch (e) {
                        report.refreshErrors++;
                        _log(`Error crítico al refrescar ${token.id.slice(-12)}: ${e.message}`, 'error');
                    }
                }
            }
        }
    }
    _log(`Validación completa: ${JSON.stringify(report)}`, 'info');
    return report;
}

async function deleteExpiredLongTokens() {
    _log("Eliminando tokens largos expirados...", 'info');
    const tokens = await _getAllLongTokensFromDB();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredTokens = tokens.filter(t => !t || !t.expiry_tstamp || t.expiry_tstamp < nowSeconds);
    let deletedCount = 0;

    if (expiredTokens.length === 0) {
        _log("No hay tokens expirados para eliminar.", 'info');
        return 0;
    }

    for (const token of expiredTokens) {
        if (token && token.id) {
            try {
                await _deleteLongTokenFromDB(token.id);
                 const lastUsedId = await getAppConfigValue(M_LAST_USED_TOKEN_ID_KEY);
                 if(lastUsedId === token.id) await deleteAppConfigValue(M_LAST_USED_TOKEN_ID_KEY);
                deletedCount++;
            } catch (e) {
                _log(`Error eliminando token expirado ${token.id.slice(-12)}: ${e.message}`, 'error');
            }
        }
    }
    _log(`${deletedCount} tokens expirados eliminados.`, 'info');
    return deletedCount;
}

async function addLongTokenManually(jwtTokenString, deviceId = null) {
    _log(`Añadiendo token manualmente: ${jwtTokenString.substring(0,20)}...`, 'info');
    const payload = _parseJwtPayload(jwtTokenString);
    if (!payload || !payload.accountNumber || !payload.exp) {
        throw new Error('Token JWT inválido o no contiene accountNumber/exp.');
    }

    let deviceIdToUse = deviceId;
    if (!deviceIdToUse) {
        _log("No se proveyó Device ID, intentando obtener/registrar uno...", 'info');
        deviceIdToUse = await _getOrCreateFunctionalDeviceId({
            login_token: jwtTokenString,
            account_nbr: payload.accountNumber
        });
        if (!deviceIdToUse) throw new Error("Fallo al obtener/registrar Device ID automáticamente.");
        _log(`Device ID obtenido/registrado: ...${deviceIdToUse.slice(-6)}`, 'info');
    }

    const newTokenData = {
        id: `${M_LONG_TOKEN_PREFIX}${Date.now()}_manual_${Math.random().toString(16).slice(2)}`,
        login_token: jwtTokenString,
        account_nbr: payload.accountNumber,
        expiry_tstamp: payload.exp,
        device_id: deviceIdToUse
    };
    await _saveLongTokenToDB(newTokenData);
    _log(`Token manual guardado con ID: ${newTokenData.id.slice(-12)}`, 'success');
    return newTokenData;
}

async function getMovistarDevicesForToken(longTokenId) {
    _log(`Obteniendo dispositivos para token ID ${longTokenId.slice(-12)}...`, 'info');
    const tokenData = await getAppConfigValue(longTokenId);
    if (!tokenData || !tokenData.login_token || !tokenData.account_nbr) {
        throw new Error("Token largo no encontrado o inválido para obtener dispositivos.");
    }

    const url = MOVISTAR_API_DEVICES_ENDPOINT.replace('{ACCOUNTNUMBER}', tokenData.account_nbr);
    const headers = {
        'Authorization': `Bearer ${tokenData.login_token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01', 'x-movistarplus-ui': MOVISTAR_UI_VERSION,
        'x-movistarplus-os': 'Windows10', 'Origin': 'https://ver.movistarplus.es', 'Referer': 'https://ver.movistarplus.es/'
    };
    const response = await fetch(url, { method: 'GET', headers: headers });
    const responseText = await response.text();
    if (!response.ok) { throw new Error(`Fallo al obtener dispositivos: ${response.status} ${responseText.substring(0,100)}`); }
    const devicesApi = JSON.parse(responseText);
    if (!Array.isArray(devicesApi)) { throw new Error("Respuesta de API de dispositivos inesperada."); }

    return devicesApi.filter(d => d && d.Id && d.Id !== '-').map(d => ({
        id: d.Id,
        name: d.Name || `Dispositivo ${d.DeviceTypeCode || '?'}`,
        type: d.DeviceTypeCode || '?',
        reg_date: d.RegistrationDate ? new Date(d.RegistrationDate).toLocaleDateString() : 'N/D',
        is_associated: d.Id === tokenData.device_id
    }));
}

async function associateDeviceToLongToken(longTokenId, deviceIdToAssociate) {
    _log(`Asociando Device ID ${deviceIdToAssociate.slice(-6)} a Token ID ${longTokenId.slice(-12)}...`, 'info');
    const tokenData = await getAppConfigValue(longTokenId);
    if (!tokenData) throw new Error("Token largo no encontrado para asociar dispositivo.");
    if (tokenData.device_id === deviceIdToAssociate) {
        _log("El dispositivo ya está asociado a este token.", 'info');
        return tokenData;
    }
    tokenData.device_id = deviceIdToAssociate;
    await _saveLongTokenToDB(tokenData);
    _log("Device ID asociado y token guardado.", 'success');
    return tokenData;
}

async function registerAndAssociateNewDevice(longTokenId) {
    _log(`Registrando nuevo dispositivo para Token ID ${longTokenId.slice(-12)}...`, 'info');
    const tokenData = await getAppConfigValue(longTokenId);
    if (!tokenData || !tokenData.login_token || !tokenData.account_nbr) {
        throw new Error("Token largo no encontrado o inválido para registrar nuevo dispositivo.");
    }

    const url = MOVISTAR_API_REGISTER_DEVICE_ENDPOINT.replace('{ACCOUNTNUMBER}', tokenData.account_nbr);
    const headers = {
        'Authorization': `Bearer ${tokenData.login_token}`, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01', 'x-movistarplus-ui': MOVISTAR_UI_VERSION,
        'x-movistarplus-os': 'Windows10', 'Content-Type': 'application/json'
    };
    const response = await fetch(url, { method: 'POST', headers: headers });
    const newDeviceIdText = await response.text();
    const newDeviceId = newDeviceIdText.trim().replace(/^"|"$/g, '');
    if (!response.ok || !newDeviceId || newDeviceId.length < 10) {
        let errorMsg = `Fallo registro: ${response.status}`;
        if (newDeviceIdText.length < 200 && !newDeviceIdText.includes('<html')) errorMsg += ` - ${newDeviceIdText}`;
        if (response.status === 403 || newDeviceIdText.toLowerCase().includes('limit')) errorMsg = "Límite de dispositivos alcanzado.";
        throw new Error(errorMsg);
    }

    _log(`Nuevo Device ID registrado: ...${newDeviceId.slice(-6)}`, 'success');
    tokenData.device_id = newDeviceId;
    await _saveLongTokenToDB(tokenData);
    _log("Nuevo Device ID asociado y token guardado.", 'success');
    return tokenData;
}

async function getMovistarShortTokenStatus() {
    const token = await getAppConfigValue(M_SHORT_TOKEN_KEY);
    const expiry = await getAppConfigValue(M_SHORT_TOKEN_EXPIRY_KEY) || 0;
    return { token, expiry: Number(expiry) || 0 };
}

window.MovistarTokenHandler = {
    setLogCallback: setMovistarLogCallback,
    loginAndGetTokens: doMovistarLoginAndGetTokens,
    refreshCdnToken: refreshMovistarCdnToken,
    getAllLongTokens: getAllLongTokens,
    deleteLongToken: deleteLongToken,
    validateAllLongTokens: validateAllLongTokens,
    deleteExpiredLongTokens: deleteExpiredLongTokens,
    addLongTokenManually: addLongTokenManually,
    getDevicesForToken: getMovistarDevicesForToken,
    associateDeviceToToken: associateDeviceToLongToken,
    registerAndAssociateNewDeviceToToken: registerAndAssociateNewDevice,
    getShortTokenStatus: getMovistarShortTokenStatus,
};

_log("Movistar Handler (para Extensión v1.0) inicializado.", 'info');