const BARTV_API_HOST = "core.bartv.es";
const BARTV_USER_AGENT = "Mozilla/5.0 (SMART-TV; Linux; Tizen 4.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.1 Chrome/56.0.2924.0 TV Safari/537.36";
const BARTV_ORIGIN = "https://samsung.bartv.es";
const BARTV_REFERER = "https://samsung.bartv.es/";
const BARTV_LOGIN_URL = "https://core.bartv.es/v1/auth/login?partner=bares";
const BARTV_MEDIA_URL_TEMPLATE = "https://core.bartv.es/v1/media/{mediaId}?drm=widevine&token={token}&device=tv&appv=311&ll=true&partner=bares";

const CHANNEL_NAMES_BARTV = {
    "24h-live": {"nombre": "LaLiga TV BAR", "logo": "https://www.movistarplus.es/recorte/m-NEO/canal/LIGBAR.png"},
    "ppv-02": {"nombre": "LaLiga TV BAR 2", "logo": "https://www.movistarplus.es/recorte/m-NEO/canal/LIGBA1.png"},
    "ppv-03": {"nombre": "LaLiga TV BAR 3", "logo": "https://www.movistarplus.es/recorte/m-NEO/canal/LIGBA2.png"},
    "ppv-04": {"nombre": "LALIGA +", "logo": "https://ver.clictv.es/RTEFacade/images/attachments/LALIGA_PLUS_BARES.png"},
    "24h-live-golstadium": {"nombre": "GOLSTADIUM", "logo": "https://pbs.twimg.com/profile_images/1814029026840793088/GPf672XK_400x400.jpg"},
    "24h-live-gol": {"nombre": "GOLPLAY", "logo": "https://storage.googleapis.com/laligatvbar/assets/img/taquillas/bg-gol-black.jpg"},
    "smb-24h": {"nombre": "LALIGA TV HYPERMOTION", "logo": "https://estatico.emisiondof6.com/recorte/m-NEONEGR/canal/MLIGS"},
    "smb-02": {"nombre": "LALIGA TV HYPERMOTION 2", "logo": "https://estatico.emisiondof6.com/recorte/m-NEONEGR/canal/MLIGS2"},
    "smb-03": {"nombre": "LALIGA TV HYPERMOTION 3", "logo": "https://estatico.emisiondof6.com/recorte/m-NEONEGR/canal/MLIGS3"},
    "dazn-00": {"nombre": "DAZN F1", "logo": "https://ver.clictv.es/RTEFacade/images/attachments/DAZN F1.png"},
    "dazn-01": {"nombre": "DAZN 1", "logo": "https://ver.clictv.es/RTEFacade/images/attachments/DAZN1.png"},
    "dazn-02": {"nombre": "DAZN 2", "logo": "https://ver.clictv.es/RTEFacade/images/attachments/DAZN2.png"},
    "euro-01": {"nombre": "EUROSPORT 1", "logo": "https://storage.googleapis.com/laligatvbar/assets/img/taquillas/eurosport-1.jpg"},
    "euro-02": {"nombre": "EUROSPORT 2", "logo": "https://storage.googleapis.com/laligatvbar/assets/img/taquillas/eurosport-2.jpg"},
};

async function setDynamicHeadersBarTv(specificHeadersArray) {
    if (!chrome.runtime?.id) return false;
    try {
        await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                cmd: "updateHeadersRules",
                requestHeaders: specificHeadersArray,
                urlFilter: `*://${BARTV_API_HOST}/*`,
                initiatorDomain: chrome.runtime.id
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(response ? response.error : 'Fallo al actualizar reglas DNR para BarTV.');
                }
            });
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        return true;
    } catch (error) {
        console.error("[BarTV] Error estableciendo cabeceras dinámicas globales:", error);
        if (typeof showNotification === 'function') showNotification("Error configurando cabeceras de red para BarTV.", "error");
        return false;
    }
}

async function clearDynamicHeadersBarTv() {
    if (!chrome.runtime?.id) return;
    try {
        await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ cmd: "clearAllDnrHeaders" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(response ? response.error : 'Fallo al limpiar reglas DNR tras BarTV.');
                }
            });
        });
    } catch (error) {
        console.error("[BarTV] Error limpiando cabeceras dinámicas globales:", error);
    }
}

async function loginBarTv(email, password) {
    const loginHeaders = {
        "Content-Type": "application/json; charset=UTF-8",
        "Host": BARTV_API_HOST,
        "Origin": BARTV_ORIGIN,
        "Referer": BARTV_REFERER,
        "User-Agent": BARTV_USER_AGENT
    };
    const dnrHeaders = Object.entries(loginHeaders).map(([key, value]) => ({ header: key, value: value }));
    if (!await setDynamicHeadersBarTv(dnrHeaders)) {
        throw new Error("No se pudieron establecer cabeceras para login BarTV.");
    }

    try {
        const response = await fetch(BARTV_LOGIN_URL, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
            throw new Error(`HTTP error en login BarTV: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.success && data.success.token) {
            return data.success.token;
        } else {
            throw new Error("Login BarTV fallido o formato de respuesta inesperado.");
        }
    } finally {
    }
}

async function fetchBarTvChannelDetails(mediaId, token) {
    const url = BARTV_MEDIA_URL_TEMPLATE.replace("{mediaId}", mediaId).replace("{token}", token);
    const fetchHeaders = {
        "Host": BARTV_API_HOST,
        "Origin": BARTV_ORIGIN,
        "Referer": BARTV_REFERER,
        "User-Agent": BARTV_USER_AGENT
    };
    const dnrHeaders = Object.entries(fetchHeaders).map(([key, value]) => ({ header: key, value: value }));

    if (!await setDynamicHeadersBarTv(dnrHeaders)) {
        throw new Error(`No se pudieron establecer cabeceras para obtener detalles del canal ${mediaId}.`);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status} para ${mediaId}`);
        }
        const data = await response.json();
        if (data.manifestUrl && data.protData && data.protData.licenseUrl) {
            return {
                manifestUrl: data.manifestUrl,
                licenseUrl: data.protData.licenseUrl
            };
        } else {
            throw new Error(`Datos incompletos para ${mediaId}`);
        }
    } finally {
    }
}


async function generateM3uBarTv() {
    if (typeof showLoading === 'function') showLoading(true, "Cargando canales de BarTV...");
    const barTvSourceName = "BarTV";
    let headersSetSuccessfully = false;

    try {
        const email = userSettings.barTvEmail;
        const password = userSettings.barTvPassword;

        if (!email || !password) {
            if (typeof showNotification === 'function') showNotification("Credenciales de BarTV no configuradas en Ajustes.", "warning");
            throw new Error("Credenciales BarTV no configuradas.");
        }

        const token = await loginBarTv(email, password);
        headersSetSuccessfully = true;
        if (typeof showNotification === 'function') showNotification("Login en BarTV exitoso.", "success");

        const channelDetailsPromises = [];
        for (const mediaId in CHANNEL_NAMES_BARTV) {
            channelDetailsPromises.push(
                fetchBarTvChannelDetails(mediaId, token)
                .then(details => ({ ...details, mediaId, ...CHANNEL_NAMES_BARTV[mediaId] }))
                .catch(e => {
                    console.warn(`Error obteniendo detalles para ${CHANNEL_NAMES_BARTV[mediaId].nombre}: ${e.message}`);
                    return null;
                })
            );
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const allChannelData = (await Promise.all(channelDetailsPromises)).filter(Boolean);

        if (allChannelData.length === 0) {
            throw new Error("No se pudieron obtener detalles para ningún canal de BarTV.");
        }
        if (typeof showNotification === 'function') showNotification(`Obtenidos ${allChannelData.length} canales de BarTV.`, "info");


        let globalLicenseJwt = null;
        if (allChannelData.length > 0) {
            try {
                const lastLicenseUrl = allChannelData[allChannelData.length - 1].licenseUrl;
                const parsedUrl = new URL(lastLicenseUrl);
                globalLicenseJwt = parsedUrl.searchParams.get("license");
            } catch (e) {
                console.warn("No se pudo extraer JWT global de la última licencia:", e);
            }
        }

        if (!globalLicenseJwt) {
            console.warn("No se pudo obtener un JWT de licencia global. Las licencias podrían no funcionar.");
        }


        const m3uLines = ["#EXTM3U"];
        allChannelData.forEach(ch => {
            m3uLines.push(`#EXTINF:-1 tvg-logo="${ch.logo}" group-title="BAR TV",${ch.nombre}`);
            m3uLines.push(`#EXTVLCOPT:http-user-agent=${BARTV_USER_AGENT}`);
            m3uLines.push("#KODIPROP:inputstream.adaptive.manifest_type=mpd");
            m3uLines.push("#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha");
            
            let finalLicenseUrl = ch.licenseUrl;
            if (globalLicenseJwt) {
                 try {
                    const parsedOriginalLicense = new URL(ch.licenseUrl);
                    parsedOriginalLicense.searchParams.set("license", globalLicenseJwt);
                    finalLicenseUrl = parsedOriginalLicense.toString();
                } catch (e) {
                   console.warn(`Error reemplazando JWT en licencia para ${ch.nombre}, usando original: ${e}`);
                }
            }
            m3uLines.push(`#KODIPROP:inputstream.adaptive.license_key=${finalLicenseUrl}`);
            m3uLines.push(ch.manifestUrl);
        });

        const m3uString = m3uLines.join("\n") + "\n\n";

        if (typeof removeChannelsBySourceOrigin === 'function') {
             removeChannelsBySourceOrigin(barTvSourceName);
        }

        if (typeof appendM3UContent === 'function') {
            appendM3UContent(m3uString, barTvSourceName);
        } else {
            console.error("appendM3UContent no encontrada. Usando fallback processM3UContent.");
            processM3UContent(m3uString, barTvSourceName, true);
        }

    } catch (error) {
        console.error("Error generando M3U de BarTV:", error);
        if (typeof showNotification === 'function') showNotification(`Error cargando BarTV: ${error.message}`, 'error');
    } finally {
        if (headersSetSuccessfully) {
            await clearDynamicHeadersBarTv();
        }
        if (typeof showLoading === 'function') showLoading(false);
    }
}