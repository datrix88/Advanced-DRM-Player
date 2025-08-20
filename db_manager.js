const dbName = 'ZenithIPTV_DB';
let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 5); // Incrementar versión para nuevo objectStore
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('xtream_servers')) {
                const xtreamStore = db.createObjectStore('xtream_servers', { keyPath: 'id', autoIncrement: true });
                xtreamStore.createIndex('name', 'name', { unique: false });
            }
            if (!db.objectStoreNames.contains('app_config')) {
                db.createObjectStore('app_config', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('movistar_vod_cache')) {
                const vodCacheStore = db.createObjectStore('movistar_vod_cache', { keyPath: 'dateString' });
                vodCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains('xcodec_panels')) {
                const xcodecStore = db.createObjectStore('xcodec_panels', { keyPath: 'id', autoIncrement: true });
                xcodecStore.createIndex('name', 'name', { unique: false });
                xcodecStore.createIndex('serverUrl', 'serverUrl', { unique: false });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject('Error al abrir IndexedDB: ' + event.target.error);
    });
    return dbPromise;
}

async function saveFileToDB(name, content) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const getRequest = store.get(name);
        getRequest.onsuccess = () => {
            if (getRequest.result && !confirm(`La lista "${name}" ya existe. ¿Quieres reemplazarla?`)) {
                reject(new Error('Operación de guardado cancelada por el usuario.'));
                return;
            }
            const putRequest = store.put({ name, content, timestamp: new Date().toISOString(), channelCount: countChannels(content) });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = (event) => reject('Error al guardar archivo en IndexedDB: ' + event.target.error);
        };
        getRequest.onerror = (event) => reject('Error al verificar archivo existente en IndexedDB: ' + event.target.error);
    });
}

async function getAllFilesFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar archivos de IndexedDB: ' + event.target.error);
    });
}

async function getFileFromDB(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar archivo de IndexedDB: ' + event.target.error);
    });
}

async function deleteFileFromDB(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.delete(name);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al eliminar archivo de IndexedDB: ' + event.target.error);
    });
}

async function clearAllFilesFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al limpiar IndexedDB: ' + event.target.error);
    });
}

function countChannels(content) {
    if (!content) return 0;
    const lines = content.split(/\r\n?|\n/);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
            for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j].trim();
                if (nextLine && !nextLine.startsWith('#')) {
                    count++;
                    i = j;
                    break;
                }
                if (nextLine.startsWith('#EXTINF:') || nextLine.startsWith('#EXTM3U')) {
                    break;
                }
            }
        }
    }
    return count;
}

async function saveXtreamServerToDB(serverData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xtream_servers'], 'readwrite');
        const store = transaction.objectStore('xtream_servers');
        const dataToSave = { ...serverData };
        if (!dataToSave.timestamp) {
            dataToSave.timestamp = new Date().toISOString();
        }
        const request = serverData.id ? store.put(dataToSave) : store.add(dataToSave);
        request.onsuccess = () => resolve(request.result || serverData.id);
        request.onerror = (event) => reject('Error al guardar servidor Xtream: ' + event.target.error);
    });
}

async function getAllXtreamServersFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xtream_servers'], 'readonly');
        const store = transaction.objectStore('xtream_servers');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar servidores Xtream: ' + event.target.error);
    });
}

async function getXtreamServerFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xtream_servers'], 'readonly');
        const store = transaction.objectStore('xtream_servers');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar servidor Xtream: ' + event.target.error);
    });
}

async function deleteXtreamServerFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xtream_servers'], 'readwrite');
        const store = transaction.objectStore('xtream_servers');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al eliminar servidor Xtream: ' + event.target.error);
    });
}

async function clearAllXtreamServersFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xtream_servers'], 'readwrite');
        const store = transaction.objectStore('xtream_servers');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al limpiar servidores Xtream: ' + event.target.error);
    });
}

async function saveXCodecPanelToDB(panelData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xcodec_panels'], 'readwrite');
        const store = transaction.objectStore('xcodec_panels');
        const request = panelData.id ? store.put(panelData) : store.add({ ...panelData, timestamp: new Date().toISOString() });
        request.onsuccess = () => resolve(request.result || panelData.id);
        request.onerror = (event) => reject('Error al guardar panel XCodec: ' + event.target.error);
    });
}

async function getAllXCodecPanelsFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xcodec_panels'], 'readonly');
        const store = transaction.objectStore('xcodec_panels');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar paneles XCodec: ' + event.target.error);
    });
}

async function getXCodecPanelFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xcodec_panels'], 'readonly');
        const store = transaction.objectStore('xcodec_panels');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al recuperar panel XCodec: ' + event.target.error);
    });
}

async function deleteXCodecPanelFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xcodec_panels'], 'readwrite');
        const store = transaction.objectStore('xcodec_panels');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al eliminar panel XCodec: ' + event.target.error);
    });
}

async function clearAllXCodecPanelsFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['xcodec_panels'], 'readwrite');
        const store = transaction.objectStore('xcodec_panels');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error al limpiar paneles XCodec: ' + event.target.error);
    });
}


async function saveAppConfigValue(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['app_config'], 'readwrite');
        const store = transaction.objectStore('app_config');
        const request = store.put({ key, value });
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(`Error guardando ${key} en IndexedDB: ${event.target.error}`);
    });
}

async function getAppConfigValue(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['app_config'], 'readonly');
        const store = transaction.objectStore('app_config');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = (event) => reject(`Error obteniendo ${key} de IndexedDB: ${event.target.error}`);
    });
}

async function deleteAppConfigValue(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['app_config'], 'readwrite');
        const store = transaction.objectStore('app_config');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(`Error eliminando ${key} de IndexedDB: ${event.target.error}`);
    });
}

async function clearAppConfigFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['app_config'], 'readwrite');
        const store = transaction.objectStore('app_config');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error limpiando app_config de IndexedDB: ' + event.target.error);
    });
}

async function getAllAppConfigValues() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['app_config'], 'readonly');
        const store = transaction.objectStore('app_config');
        const request = store.getAll();
        request.onsuccess = () => {
            const configObject = {};
            if (request.result && Array.isArray(request.result)) {
                request.result.forEach(item => {
                    if (item && typeof item.key === 'string') {
                        configObject[item.key] = item.value;
                    }
                });
            }
            resolve(configObject);
        };
        request.onerror = (event) => reject(`Error obteniendo todos los valores de app_config: ${event.target.error}`);
    });
}

async function saveMovistarVodData(dateString, recordData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movistar_vod_cache'], 'readwrite');
        const store = transaction.objectStore('movistar_vod_cache');
        const recordToStore = { dateString: dateString, data: recordData.data, timestamp: recordData.timestamp };
        const request = store.put(recordToStore);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error guardando datos VOD de Movistar: ' + event.target.error);
    });
}

async function getMovistarVodData(dateString) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movistar_vod_cache'], 'readonly');
        const store = transaction.objectStore('movistar_vod_cache');
        const request = store.get(dateString);
        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = (event) => reject('Error obteniendo datos VOD de Movistar: ' + event.target.error);
    });
}

async function deleteOldMovistarVodData(daysToKeep = 15) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movistar_vod_cache'], 'readwrite');
        const store = transaction.objectStore('movistar_vod_cache');
        const threshold = new Date().getTime() - (daysToKeep * 24 * 60 * 60 * 1000);
        const index = store.index('timestamp');
        const request = index.openCursor(IDBKeyRange.upperBound(threshold));
        
        let deletedCount = 0;
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                deletedCount++;
                cursor.continue();
            } else {
                resolve(deletedCount);
            }
        };
        request.onerror = (event) => reject('Error eliminando datos VOD antiguos de Movistar: ' + event.target.error);
    });
}

async function clearMovistarVodCacheFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movistar_vod_cache'], 'readwrite');
        const store = transaction.objectStore('movistar_vod_cache');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error limpiando caché VOD de Movistar de IndexedDB: ' + event.target.error);
    });
}

async function getMovistarVodCacheStats() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movistar_vod_cache'], 'readonly');
        const store = transaction.objectStore('movistar_vod_cache');
        const request = store.getAll();
        request.onsuccess = () => {
            const records = request.result || [];
            let totalSizeBytes = 0;
            records.forEach(record => {
                if (record && record.data) {
                    totalSizeBytes += JSON.stringify(record.data).length;
                }
            });
            resolve({
                count: records.length,
                totalSizeBytes: totalSizeBytes
            });
        };
        request.onerror = (event) => reject('Error obteniendo estadísticas de caché VOD Movistar: ' + event.target.error);
    });
}