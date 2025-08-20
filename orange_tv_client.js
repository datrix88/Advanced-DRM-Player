const ORANGE_IDENTITY_KEY = "orangeTvIdentityCookie";

const URL_BASE_API_MOB_JS = 'https://android.orangetv.orange.es/mob/api/rtv/v1';
const URL_BASE_API_PC_JS = 'https://pc.orangetv.orange.es/pc/api/rtv/v1';
const URL_BASE_IMAGES_PC_JS = `${URL_BASE_API_PC_JS}/images`;

const MODEL_EXTERNAL_IDS_FOR_TERMINALS_JS = ['AKS19', 'HUM18', 'SAG22'];
const BOUQUET_ID_FOR_CHANNELS_PC_JS = '1';
const MODEL_ID_FOR_CHANNELS_PC_JS = 'PC';

const MAX_WORKERS_CHANNELS_JS = 10;

const ORANGE_TV_API_HOST_MOB = "android.orangetv.orange.es";
const ORANGE_TV_API_HOST_PC = "pc.orangetv.orange.es";


const CHANNEL_SPECIFIC_CLEARKEYS_JS = {
    "r11_la1": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_la2": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_antena3": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_cuatro": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_telecinco": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_lasexta": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_selekt": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_starchannel": {"kid": "MD7N7urJAQtF5oTryeF1lA", "k": "BxIdiu1Rx7vYBGGUUXw/Eg"},
    "r11_amc": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_tnt": {"kid": "VypQBxqrMWM4PmRW+hcBdQ", "k": "hj7H6C6K0HjZ4ICxwLpi0g"},
    "r11_axn": {"kid": "DhwwYB1i4nchlODT7uz1Xw", "k": "D314t8hAHWaGkMSTCwhh+Q"},
    "r11_comedy": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r11_calle13": {"kid": "MW3cMBCG06kSHBrb1nIXyA", "k": "J6EXwkkHdU+L1+iTe3IQxg"},
    "r11_xtrm": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_scifi": {"kid": "MW3cMBCG06kSHBrb1nIXyA", "k": "J6EXwkkHdU+L1+iTe3IQxg"},
    "r11_cosmo": {"kid": "6XvuzxKLh3MNzpOFl2+PAQ", "k": "loe9Tcqr+hlepdH88g7nKg"},
    "r13_enfamilia": {"kid": "F2gY9e6GDV4KP0kErIgBKg", "k": "BZEt/FNCoTx8YSZS72Tgig"},
    "r13_fdf": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_neox": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_energy": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_atreseries": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_divinity": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_nova": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_hollywood": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_axnwhite": {"kid": "DhwwYB1i4nchlODT7uz1Xw", "k": "D314t8hAHWaGkMSTCwhh+Q"},
    "r11_somos": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r13_bomcine": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_squirrel": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r11_tcm": {"kid": "VypQBxqrMWM4PmRW+hcBdQ", "k": "hj7H6C6K0HjZ4ICxwLpi0g"},
    "r11_sundance": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_dark": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_paramount": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r11_bemad": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_historia": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_nat_geo": {"kid": "MD7N7urJAQtF5oTryeF1lA", "k": "BxIdiu1Rx7vYBGGUUXw/Eg"},
    "r11_blaze": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_odisea": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_discovery": {"kid": "vB3XOgolNBAnPnx3RaJhCQ", "k": "jkxJcB1cWDLDKMmdIoLdqQ"},
    "r11_natgeowild": {"kid": "MD7N7urJAQtF5oTryeF1lA", "k": "BxIdiu1Rx7vYBGGUUXw/Eg"},
    "r11_crimeninvestigacion": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_cocina": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_decasahd": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r13_solmusica": {"kid": "27o7zoN8t7LH7Jq5VycTMg", "k": "+fxpwwObxHptQxQms4C+LA"},
    "r11_mega": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_dmax": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_ten": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_disneychan": {"kid": "j1CZ9MDi/2+moKofzwo2TA", "k": "ImOtSX+6rDn7Ca1RSCS3GA"},
    "r11_disney_jr": {"kid": "j1CZ9MDi/2+moKofzwo2TA", "k": "ImOtSX+6rDn7Ca1RSCS3GA"},
    "r11_nick": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r11_nickjr": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r11_dreamworks": {"kid": "MW3cMBCG06kSHBrb1nIXyA", "k": "J6EXwkkHdU+L1+iTe3IQxg"},
    "r11_boing": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r11_clanhd": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r12_eurosport": {"kid": "vB3XOgolNBAnPnx3RaJhCQ", "k": "jkxJcB1cWDLDKMmdIoLdqQ"},
    "r12_eurosport2": {"kid": "vB3XOgolNBAnPnx3RaJhCQ", "k": "jkxJcB1cWDLDKMmdIoLdqQ"},
    "r11_tdphd": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r12_daznlaliga": {"kid": "Yemhb9f6RnnLUcgfyqhynw", "k": "kpmfl/9O5uxSpg1JD7PxTA"},
    "r14ll_mlaliga": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mlaliga": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_daznlaliga2": {"kid": "Yemhb9f6RnnLUcgfyqhynw", "k": "kpmfl/9O5uxSpg1JD7PxTA"},
    "r12_mlaliga2": {"kid": "Yemhb9f6RnnLUcgfyqhynw", "k": "kpmfl/9O5uxSpg1JD7PxTA"},
    "r12_mlaliga3": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mlaliga4": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones7": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mlaliga6": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones5": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones6": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones4": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r14ll_mcampeones": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones-hdr": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones2-hdr": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones2": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones3": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_laligasmartbank": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_laligasmartbank2": {"kid": "AiSxNfL5UCr/+cszVRwIgQ", "k": "URcFiCvQispOGhKKfZuoEw"},
    "r12_laligasmartbank3": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_laligaplus": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r13_nautical": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r12_gol": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r13_realmadridconti": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r12_betis": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_motoadv": {"kid": "iukRwhaDykixDta5JRJyGA", "k": "IPzNiyCJIrIMclkEWZCKVg"},
    "r11_mtv": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r13_ubeat": {"kid": "JjJYKDacD2UbHQKAMWcWeA", "k": "2oVeLpuI43GyrGj4W5VgaQ"},
    "r13_gametoon": {"kid": "JjJYKDacD2UbHQKAMWcWeA", "k": "2oVeLpuI43GyrGj4W5VgaQ"},
    "r13_dkiss": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_myzen": {"kid": "3J1au8Je3Q/LRcXw3k/p5A", "k": "tVbv93kAFfDl+F8zk+zOqg"},
    "r13_outtv": {"kid": "3J1au8Je3Q/LRcXw3k/p5A", "k": "tVbv93kAFfDl+F8zk+zOqg"},
    "r11_mtvlive": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r11_vh1": {"kid": "Z8AqZy5+h+KXz6dQPeew4g", "k": "YK2xLXIvkk7cGhow+MNJ1Q"},
    "r13_mezzo": {"kid": "6di3sjutuhXFL8S3Uqiw8Q", "k": "1sFtN5OtzTjtxLuRRc4gIA"},
    "r13_tr3ce": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_intereconomia": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r13_ewtn": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_andalucia": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r12_realmadrid": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_tv3i": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r13_tvgi": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r13_eitb": {"kid": "IsjmUI4McB6wmNGYoR8rEA", "k": "Mzk+KGJVxi5ho9Xtk40vHg"},
    "r11_24h": {"kid": "9nV6vfcUs6Qjf/R3niFDXA", "k": "+Hf9yEn6OF2o4ornglSp0g"},
    "r13_euronews": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_bbc": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_11internacional": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_aljazeera": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_caracoltv": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_protv": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r13_tv5": {"kid": "WwxMD+1K/NItX7qazKZ4ig", "k": "NmFTcN1vRo26EkWPoOOq/Q"},
    "r12_daznlaliga3": {"kid": "Yemhb9f6RnnLUcgfyqhynw", "k": "kpmfl/9O5uxSpg1JD7PxTA"},
    "r12_mcampeones8": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones9": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones10": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones11": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones12": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones13": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones14": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones15": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones16": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones17": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones18": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"},
    "r12_mcampeones19": {"kid": "hQwaQwOWzkJV85Ar8fTolw", "k": "KVsduXf5Tfu6ASBzkBoBmw"}
};

class NotAuthenticatedError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotAuthenticatedError";
    }
}

async function setDynamicHeaders(headersArray, targetHost = null) {
    if (!chrome.runtime?.id) {
        return;
    }
    try {
        const message = {
            cmd: "updateHeadersRules",
            requestHeaders: headersArray
        };
        if (targetHost) {
            message.urlFilter = `*://${targetHost}/*`;
        } else {
             message.urlFilter = `*://${ORANGE_TV_API_HOST_MOB}/*,*://${ORANGE_TV_API_HOST_PC}/*`;
        }

        const response = await chrome.runtime.sendMessage(message);
        if (!response || !response.success) {
            console.error("Error al configurar cabeceras dinámicas:", response?.error || "Respuesta no exitosa.");
            showNotification("Error crítico configurando cabeceras de red.", "error");
        }
    } catch (e) {
        console.error("Excepción al enviar mensaje para configurar cabeceras dinámicas:", e);
        showNotification("Excepción configurando cabeceras de red.", "error");
    }
}

async function clearAllDynamicHeaders() {
     if (!chrome.runtime?.id) return;
    try {
        await chrome.runtime.sendMessage({ cmd: "clearAllDnrHeaders" });
    } catch (e) {
        console.error("Excepción al limpiar cabeceras dinámicas:", e);
    }
}


async function loginOrangeMob() {
    console.log("Paso 1: Intentando iniciar sesión (Mob API)...");
    showNotification("Iniciando sesión en OrangeTV (Mob API)...", "info");

    await clearAllDynamicHeaders();

    const orangeUsername = userSettings.orangeTvUsername;
    const orangePassword = userSettings.orangeTvPassword;

    const fetchHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'okhttp/4.10.0'
    };
    const loginUrl = `${URL_BASE_API_MOB_JS}/Login?username=${orangeUsername}`;
    const loginDataStr = `client=json&username=${orangeUsername}&password=${orangePassword}`;

    try {
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: fetchHeaders,
            body: loginDataStr,
            credentials: 'omit'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Paso 1: HTTP error en Login (Mob API): ${response.status}`, errorText.substring(0,500));
            showNotification(`Error en login (Mob): ${response.status}`, "error");
            return null;
        }

        const responseJson = await response.json();
        if (responseJson?.response?.status === 'SUCCESS' && responseJson?.response?.message?.startsWith('identity=')) {
            const identityCookieStr = responseJson.response.message;
            console.log(`Paso 1: ¡Login (Mob API) exitoso! Cookie: ${identityCookieStr.substring(0, 20)}...`);
            showNotification("Login (Mob API) exitoso.", "success");
            await saveAppConfigValue(ORANGE_IDENTITY_KEY, identityCookieStr);
            return identityCookieStr;
        } else {
            console.error("Paso 1: Login (Mob API) fallido o formato inesperado.", responseJson);
            showNotification("Login (Mob API) fallido. Revisa las credenciales.", "error");
            return null;
        }
    } catch (e) {
        console.error("Error de red o JSON en Login (Mob API):", e);
        showNotification("Error de red en login (Mob).", "error");
        return null;
    }
}

async function loadIdentityFromDB() {
    try {
        const identityStr = await getAppConfigValue(ORANGE_IDENTITY_KEY);
        if (identityStr && identityStr.startsWith("identity=")) {
            console.log(`Cookie '${identityStr.substring(0,20)}...' cargada desde IndexedDB.`);
            return identityStr;
        }
    } catch (e) {
        console.error("Error al cargar cookie desde IndexedDB:", e);
    }
    return null;
}

async function getIdentityCookie() {
    let identity = await loadIdentityFromDB();
    if (identity) {
        return identity;
    }

    console.warn("Cookie no válida/inexistente. Iniciando sesión (Mob API)...");
    showNotification("Cookie de OrangeTV no encontrada, intentando nuevo login...", "info");
    return await loginOrangeMob();
}

async function apiRequestMob(method, endpoint, identityCookieStr, params = null, bodyData = null, includeHouseholdId = false) {
    let url = `${URL_BASE_API_MOB_JS}${endpoint}`;
    if (params) {
        url += `?${new URLSearchParams(params).toString()}`;
    }

    const dnrHeadersToSet = [
        { header: 'User-Agent', value: 'okhttp/4.10.0' },
        { header: 'Cookie', value: identityCookieStr }
    ];
    if (includeHouseholdId) {
        dnrHeadersToSet.push({ header: 'HouseholdID', value: '1' });
    }
    await setDynamicHeaders(dnrHeadersToSet, ORANGE_TV_API_HOST_MOB);

    const fetchOptions = {
        method: method,
        headers: {},
        credentials: 'omit'
    };

    if (bodyData && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = bodyData;
        if (typeof bodyData === 'string' && bodyData.includes('=')) {
             fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const response = await fetch(url, fetchOptions);

        if (response.status === 401) {
            throw new NotAuthenticatedError("401 Auth Error (Mob API). Cookie expirada?");
        }
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error en API Mob (${endpoint}): ${response.status}`, errorText.substring(0,200));
            return null;
        }
        
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return { success_no_content: true, status: response.status };
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else {
            console.warn(`Respuesta de API Mob (${endpoint}) no es JSON. Tipo: ${contentType}`);
            return { raw_text: await response.text(), status_code: response.status };
        }

    } catch (e) {
        if (e instanceof NotAuthenticatedError) throw e;
        console.error(`Excepción en API Mob (${endpoint}):`, e);
        return null;
    }
}


async function getSerialAndModelMob(identityCookieStr) {
    if (!identityCookieStr) return { serial: null, model: null };
    console.log("Paso 2: Obteniendo terminales (Mob API)...");
    showNotification("Obteniendo información de terminales (Mob)...", "info");

    const responseData = await apiRequestMob('GET', '/GetTerminalList?client=json', identityCookieStr, null, null, false);

    if (responseData?.response?.terminals) {
        const terminals = responseData.response.terminals;
        if (terminals && terminals.length > 0) {
            for (const modelIdFilter of MODEL_EXTERNAL_IDS_FOR_TERMINALS_JS) {
                for (const t of terminals) {
                    if (t?.model?.externalId === modelIdFilter) {
                        const serial = t.serialNumber;
                        console.log(`Paso 2: ¡Terminal encontrado! Modelo: ${modelIdFilter}, Serial: ${serial}`);
                        showNotification("Terminal (Mob) encontrado.", "success");
                        return { serial: serial, model: modelIdFilter };
                    }
                }
            }
            console.warn(`Paso 2: No se encontró descodificador con modelos: ${MODEL_EXTERNAL_IDS_FOR_TERMINALS_JS.join(', ')}`);
            showNotification("No se encontró terminal compatible (Mob).", "warning");
        } else {
            console.warn("Paso 2: No se encontraron terminales.");
            showNotification("No hay terminales registrados (Mob).", "warning");
        }
    } else {
        console.error("Paso 2: Fallo al obtener terminales (Mob API) o formato inesperado.");
        if (responseData) console.error("Respuesta GetTerminalList:", responseData);
        showNotification("Error obteniendo terminales (Mob).", "error");
    }
    return { serial: null, model: null };
}

async function getChannelListPc(identityCookieMobStr) {
    if (!identityCookieMobStr) return null;
    console.log(`Paso 3.1: Obteniendo canales (PC API) para modelo ${MODEL_ID_FOR_CHANNELS_PC_JS}...`);
    showNotification("Obteniendo lista de canales (PC API)...", "info");

    const dnrHeadersForPc = [
        { header: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36' },
        { header: 'Cookie', value: identityCookieMobStr },
        { header: 'Accept', value: 'application/json, text/plain, */*'}
    ];
    await setDynamicHeaders(dnrHeadersForPc, ORANGE_TV_API_HOST_PC);


    const params = {
        'bouquet_id': BOUQUET_ID_FOR_CHANNELS_PC_JS,
        'model_external_id': MODEL_ID_FOR_CHANNELS_PC_JS,
        'filter_unsupported_channels': 'false',
        'client': 'json'
    };
    const urlPcChannelList = `${URL_BASE_API_PC_JS}/GetChannelList?${new URLSearchParams(params).toString()}`;

    try {
        await new Promise(resolve => setTimeout(resolve, 150));
        const response = await fetch(urlPcChannelList, {
            method: 'GET',
            headers: {},
            credentials: 'omit'
        });

        if (response.status === 401) {
             console.error(`Paso 3.1: Error de autenticación (401) en GetChannelList (PC API).`);
             showNotification("Autenticación fallida para PC API (canales).", "error");
             return null;
        }
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Paso 3.1: HTTP error en GetChannelList (PC API): ${response.status}`, errorText.substring(0,500));
            showNotification(`Error obteniendo canales (PC API): ${response.status}`, "error");
            return null;
        }
        
        const responseJson = await response.json();
        if (responseJson && Array.isArray(responseJson.response)) {
            const channelsData = responseJson.response;
            console.log(`Paso 3.1: ¡${channelsData.length} canales (PC API) obtenidos!`);
            showNotification(`${channelsData.length} canales (PC API) obtenidos.`, "success");
            return channelsData;
        } else {
            console.error("Paso 3.1: Fallo al obtener canales (PC API) o formato inesperado.", responseJson);
            showNotification("Formato de respuesta de canales (PC API) inesperado.", "error");
            return null;
        }
    } catch (e) {
        console.error("Error de red o JSON en GetChannelList (PC API):", e);
        showNotification("Error de red obteniendo canales (PC API).", "error");
        return null;
    }
}

async function getLivePlayingInfoMob(identityCookieStr, serialNumber, channelExternalId) {
    if (!identityCookieStr || !serialNumber || !channelExternalId) return null;

    const params = {
        'client': 'json',
        'serial_number': serialNumber,
        'include_cas_token': 'true',
        'channel_external_id': channelExternalId
    };
    const responseData = await apiRequestMob('GET', '/GetLivePlayingInfo', identityCookieStr, params, null, true);

    if (responseData?.response?.playingUrl) {
        return responseData.response;
    }
    console.warn(`No se obtuvo playingUrl para ${channelExternalId}. Respuesta:`, responseData);
    return null;
}

function extractStreamIdentifier(mpdUrl) {
    if (!mpdUrl || typeof mpdUrl !== 'string') return null;
    const regex = /\/([a-zA-Z0-9_.-]+)\/dash_(?:high|medium|low)\.mpd/i;
    let match = mpdUrl.match(regex);
    if (match && match[1]) {
        const candidate = match[1];
        if (/^r\d{1,2}_/i.test(candidate)) return candidate;
    }

    const pathParts = mpdUrl.split('/');
    for (let i = pathParts.length - 2; i >= 0; i--) {
        const part = pathParts[i];
        if (part.toLowerCase() === 'cmaf' || part.toLowerCase() === 'std' || part.includes('.')) continue;
        if (part && /^r\d{1,2}_/i.test(part)) return part;
    }
    if (match && match[1] && (match[1].toLowerCase() !== 'cmaf' && match[1].toLowerCase() !== 'std')) return match[1];

    return null;
}


async function processSingleChannel(channelDataPc, serialNumberMob, identityCookieMob) {
    const name = channelDataPc.name || 'Nombre Desconocido';
    const externalId = channelDataPc.externalChannelId;
    const category = channelDataPc.category || 'Desconocido';
    const number = channelDataPc.number || '';
    const attachments = channelDataPc.attachments || [];
    const encodingType = channelDataPc.encoding;
    const sourceType = channelDataPc.sourceType;
    const channelUrlField = channelDataPc.url;

    if (!externalId) {
        console.warn("Canal sin externalChannelId:", channelDataPc);
        return null;
    }
    
    if (userSettings.orangeTvSelectedGroups && userSettings.orangeTvSelectedGroups.length > 0) {
        const normalizedCategoryApi = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const selectedGroupsNormalized = userSettings.orangeTvSelectedGroups.map(g => g.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
        
        let groupMatch = selectedGroupsNormalized.includes(normalizedCategoryApi);
        if (!groupMatch) {
            if ((normalizedCategoryApi === "general" || normalizedCategoryApi === "generalistas") && selectedGroupsNormalized.includes("generalista")) {
                groupMatch = true;
            } else if ((normalizedCategoryApi === "noticias") && selectedGroupsNormalized.includes("informacion")) {
                groupMatch = true;
            } else if ((normalizedCategoryApi === "infanti") && selectedGroupsNormalized.includes("infantil")) {
                 groupMatch = true;
            }
        }
        if (!groupMatch) {
            return null;
        }
    }


    let streamUrl = null;
    let isExternalHls = false;
    let kodiPropsArray = [];

    if (encodingType === "EXTERNAL" && sourceType === "HLS" && channelUrlField === "externalURL") {
        const extrafields = channelDataPc.extrafields || [];
        const extStreamField = extrafields.find(ef => ef.name === "externalStreamingUrl");
        if (extStreamField && extStreamField.value) {
            try {
                const externalStreamingData = JSON.parse(extStreamField.value);
                const hlsUrl = externalStreamingData.externalURL;
                if (hlsUrl) {
                    streamUrl = hlsUrl;
                    isExternalHls = true;
                }
            } catch (e) {
                console.warn(`Error parseando externalStreamingUrl para ${name}: ${e}`);
            }
        }
        if (!streamUrl) isExternalHls = false;
    }

    if (!isExternalHls) {
        const playingInfoMob = await getLivePlayingInfoMob(identityCookieMob, serialNumberMob, externalId);
        if (playingInfoMob && playingInfoMob.playingUrl) {
            let tempUrl = playingInfoMob.playingUrl;
             if (!tempUrl.endsWith('/externalURL')) {
                streamUrl = tempUrl;
                if (streamUrl.toLowerCase().endsWith(".mpd")) {
                    streamUrl = streamUrl.replace(/dash_medium\.mpd/i, "dash_high.mpd").replace(/dash_low\.mpd/i, "dash_high.mpd");
                    kodiPropsArray.push("inputstream.adaptive.manifest_type=mpd");

                    const streamIdForClearkey = extractStreamIdentifier(streamUrl);
                    if (streamIdForClearkey && CHANNEL_SPECIFIC_CLEARKEYS_JS[streamIdForClearkey]) {
                        const keys = CHANNEL_SPECIFIC_CLEARKEYS_JS[streamIdForClearkey];
                        if (keys.k && keys.kid) {
                            const licenseKeyJsonObj = { keys: [{ kty: "oct", k: keys.k, kid: keys.kid }], type: "temporary" };
                            const licenseKeyJsonStr = JSON.stringify(licenseKeyJsonObj);
                            kodiPropsArray.push(`inputstream.adaptive.license_type=clearkey`);
                            kodiPropsArray.push(`inputstream.adaptive.license_key=${licenseKeyJsonStr}`);
                        }
                    }
                }
            }
        }
    }

    if (streamUrl) {
        let m3uEntry = "";
        const logoAttachment = attachments.find(att => att.name === "LOGO" && att.value);
        const logoPath = logoAttachment ? `${URL_BASE_IMAGES_PC_JS}${logoAttachment.value}` : "";

        m3uEntry += `#EXTINF:-1 tvg-id="${externalId}" ch-number="${number}" tvg-name="${name}" tvg-logo="${logoPath}" group-title="OrangeTV | ${category}",${name}\n`;
        
        kodiPropsArray.forEach(prop => {
             m3uEntry += `#KODIPROP:${prop}\n`;
        });
        
        m3uEntry += `${streamUrl}\n`;
        return m3uEntry;
    }
    return null;
}


async function generateM3uOrangeTv() {
    showLoading(true, "Iniciando proceso OrangeTV...");
    console.log("--- Iniciando generación M3U OrangeTV (JS) ---");
    const orangeTvSourceName = "OrangeTV";

    let identityCookieMob = null;
    let serialNumberMob = null;

    try {
        identityCookieMob = await getIdentityCookie();
        if (!identityCookieMob) {
            throw new Error("CRÍTICO: No se pudo obtener cookie (Mob API).");
        }

        const terminalInfo = await getSerialAndModelMob(identityCookieMob);
        serialNumberMob = terminalInfo.serial;

        if (!serialNumberMob) {
            console.warn("Fallo al obtener terminales (Mob API). La cookie podría haber expirado. Re-intentando login...");
            showNotification("Información de terminal no obtenida, reintentando login...", "warning");
            await deleteAppConfigValue(ORANGE_IDENTITY_KEY);
            
            identityCookieMob = await loginOrangeMob();
            if (!identityCookieMob) {
                throw new Error("CRÍTICO: No se pudo obtener cookie (Mob API) tras re-login.");
            }
            const newTerminalInfo = await getSerialAndModelMob(identityCookieMob);
            serialNumberMob = newTerminalInfo.serial;
            if (!serialNumberMob) {
                throw new Error("CRÍTICO: No se pudo obtener serial (Mob API) tras re-login.");
            }
        }
        
        const listaCanalesPcApi = await getChannelListPc(identityCookieMob);
        if (!listaCanalesPcApi || listaCanalesPcApi.length === 0) {
            throw new Error("CRÍTICO: No se pudo obtener la lista de canales (PC API).");
        }

        showNotification(`Procesando ${listaCanalesPcApi.length} canales... Esto puede tardar.`, "info", 10000);
        
        let m3uLinesForFile = ["#EXTM3U"];
        let canalesExitosos = 0;
        let canalesConError = 0;
        const resultsInOrder = new Array(listaCanalesPcApi.length).fill(null);
        let processedCount = 0;

        for (let i = 0; i < listaCanalesPcApi.length; i += MAX_WORKERS_CHANNELS_JS) {
            const batch = listaCanalesPcApi.slice(i, i + MAX_WORKERS_CHANNELS_JS);
            const promises = batch.map((channelPc, indexInBatch) =>
                processSingleChannel(channelPc, serialNumberMob, identityCookieMob)
                    .then(result => ({ status: 'fulfilled', value: result, originalIndex: i + indexInBatch }))
                    .catch(error => ({ status: 'rejected', reason: error, originalIndex: i + indexInBatch }))
            );

            const settledResults = await Promise.all(promises);

            for (const result of settledResults) {
                if (result.status === 'fulfilled' && result.value) {
                    resultsInOrder[result.originalIndex] = result.value;
                    canalesExitosos++;
                } else {
                    canalesConError++;
                    if (result.status === 'rejected') {
                        const channelNameForError = listaCanalesPcApi[result.originalIndex]?.name || `Índice ${result.originalIndex}`;
                        console.error(`Error procesando canal '${channelNameForError}':`, result.reason);
                    }
                }
                processedCount++;
                 if (processedCount % 10 === 0 || processedCount === listaCanalesPcApi.length) {
                    showNotification(`Procesados ${processedCount}/${listaCanalesPcApi.length} canales...`, "info", 3000);
                }
            }
            if (i + MAX_WORKERS_CHANNELS_JS < listaCanalesPcApi.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        resultsInOrder.forEach(entry => {
            if (entry) {
                m3uLinesForFile.push(entry);
            }
        });

        console.log("Proceso de URLs (concurrente) finalizado.");
        console.log(`Canales con URL exitosa: ${canalesExitosos}`);
        console.log(`Canales con error/omitidos: ${canalesConError}`);
        showNotification(`Proceso completado. Éxito: ${canalesExitosos}, Fallos/Omitidos: ${canalesConError}`, "info");

        if (canalesExitosos > 0) {
            let finalM3uContent = m3uLinesForFile.join("\n");
            if (!finalM3uContent.endsWith("\n\n") && finalM3uContent.split('\n').length > 1) {
                finalM3uContent += "\n";
            }
            console.log("M3U Generado (primeros 500 caracteres):", finalM3uContent.substring(0,500));

            if (typeof removeChannelsBySourceOrigin === 'function') {
                 removeChannelsBySourceOrigin(orangeTvSourceName);
            }
            if (typeof appendM3UContent === 'function') {
                 appendM3UContent(finalM3uContent, orangeTvSourceName);
            } else {
                 console.error("appendM3UContent no disponible. Usando fallback processM3UContent.");
                 processM3UContent(finalM3uContent, orangeTvSourceName, channels.length === 0);
            }
            return finalM3uContent;
        } else {
            showNotification("No se generó M3U (no se obtuvieron URLs o no coincidieron con grupos seleccionados).", "warning");
            return "#EXTM3U\n#EXTINF:-1,No se pudieron obtener canales\nerror.ts";
        }

    } catch (e) {
        console.error("Error en generateM3uOrangeTv:", e.message, e);
        if (e instanceof NotAuthenticatedError || e.message.toLowerCase().includes("cookie")) {
            showNotification("Error de autenticación con OrangeTV. Intenta de nuevo.", "error");
            await deleteAppConfigValue(ORANGE_IDENTITY_KEY);
        } else {
            showNotification(`Error generando lista OrangeTV: ${e.message.substring(0,100)}`, "error");
        }
        return "#EXTM3U\n#EXTINF:-1,Error general en el proceso\nerror.ts";
    } finally {
        showLoading(false);
        await clearAllDynamicHeaders();
        console.log("--- Proceso OrangeTV (JS) Finalizado ---");
    }
}