function parseM3U(content, sourceOrigin = null) {
    const lines = content.split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);
    const parsedChannels = [];
    let currentChannel = null;
    const seenGroups = new Set();
    const orderedGroups = [];

    if (lines.length > 0 && !lines[0].startsWith('#EXTM3U')) {
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF:')) {
            if (currentChannel && !currentChannel.url) {
            }
            currentChannel = {
                name: `Canal ${parsedChannels.length + 1}`,
                url: null,
                attributes: {},
                kodiProps: {},
                vlcOptions: {},
                extHttp: {},
                effectiveEpgId: null,
                sourceOrigin: sourceOrigin
            };
            try {
                const extinfMatch = line.match(/^#EXTINF:(-?\d*(?:\.\d+)?)([^,]*),(.*)$/);
                if (extinfMatch) {
                    currentChannel.attributes.duration = extinfMatch[1];

                    const attrString = extinfMatch[2].trim();
                    const channelName = extinfMatch[3].trim();
                    currentChannel.name = channelName || `Canal ${parsedChannels.length + 1}`;

                    const attributeMatchRegex = /([a-zA-Z0-9_-]+)=("([^"]*)"|'([^']*)'|([^"\s',]+))/g;
                    let attrMatch;
                    while ((attrMatch = attributeMatchRegex.exec(attrString)) !== null) {
                        const attrName = attrMatch[1].toLowerCase();
                        const attrValue = attrMatch[3] || attrMatch[4] || attrMatch[5] || '';
                        currentChannel.attributes[attrName] = attrValue.trim();
                    }
                    currentChannel['tvg-id'] = currentChannel.attributes['tvg-id'] || '';
                    currentChannel['tvg-name'] = currentChannel.attributes['tvg-name'] || '';
                    currentChannel['tvg-logo'] = currentChannel.attributes['tvg-logo'] || '';
                    currentChannel['group-title'] = currentChannel.attributes['group-title'] || '';
                    currentChannel.attributes['ch-number'] = currentChannel.attributes['ch-number'] || currentChannel.attributes['tvg-chno'] || '';

                    if (currentChannel.attributes['source-origin']) {
                        currentChannel.sourceOrigin = currentChannel.attributes['source-origin'];
                    }

                    const groupTitle = currentChannel['group-title'];
                    if (groupTitle && groupTitle.trim() !== '' && !seenGroups.has(groupTitle)) {
                        seenGroups.add(groupTitle); orderedGroups.push(groupTitle);
                    }

                } else {
                    const commaIndex = line.indexOf(',');
                    if (commaIndex !== -1) {
                        currentChannel.name = line.substring(commaIndex + 1).trim() || `Canal ${parsedChannels.length + 1}`;
                        currentChannel.attributes.duration = line.substring("#EXTINF:".length, commaIndex).trim();
                    } else { currentChannel = null; }
                }
            } catch (e) { console.warn("Error parsing #EXTINF line:", line, e); currentChannel = null; }

        } else if (currentChannel && line.startsWith('#KODIPROP:')) {
            const propMatch = line.match(/^#KODIPROP:([^=]+)=(.*)$/);
            if (propMatch && propMatch[1] && typeof propMatch[2] === 'string') {
                currentChannel.kodiProps[propMatch[1].trim()] = propMatch[2].trim();
            }
        } else if (currentChannel && line.startsWith('#EXTVLCOPT:')) {
            const propMatch = line.match(/^#EXTVLCOPT:([^=]+)=(.*)$/);
            if (propMatch && propMatch[1] && typeof propMatch[2] === 'string') {
                const key = propMatch[1].trim();
                let value = propMatch[2].trim();
                if (key === 'http-user-agent' && value.includes('&Referer=')) {
                    const parts = value.split('&Referer=');
                    currentChannel.vlcOptions['http-user-agent'] = parts[0];
                    if (parts.length > 1 && parts[1]) {
                        currentChannel.vlcOptions['http-referrer'] = parts[1];
                    }
                } else if (key === 'http-user-agent' && value.includes('&referer=')) {
                    const parts = value.split('&referer=');
                    currentChannel.vlcOptions['http-user-agent'] = parts[0];
                    if (parts.length > 1 && parts[1]) {
                        currentChannel.vlcOptions['http-referrer'] = parts[1];
                    }
                }
                else {
                    currentChannel.vlcOptions[key] = value;
                }
            }
        } else if (currentChannel && line.startsWith('#EXTHTTP:')) {
            try {
                const httpJson = line.substring('#EXTHTTP:'.length).trim();
                if (httpJson) { currentChannel.extHttp = JSON.parse(httpJson); }
            } catch (e) { console.warn("Error parsing #EXTHTTP JSON:", line, e); }
        } else if (currentChannel && line.startsWith('#EXTGRP:')) {
            const groupName = line.substring('#EXTGRP:'.length).trim();
            if (!currentChannel['group-title'] && groupName) {
                currentChannel['group-title'] = groupName;
                if (!seenGroups.has(groupName)) { seenGroups.add(groupName); orderedGroups.push(groupName); }
            } else if (groupName && groupName.trim() !== '' && !seenGroups.has(groupName)) {
                 seenGroups.add(groupName); orderedGroups.push(groupName);
            }
        } else if (!line.startsWith('#') && currentChannel && !currentChannel.url) {
            const url = line.trim();
            if (url) {
                currentChannel.url = url;

                if (!currentChannel.attributes['source-origin']) {
                    if (url.includes('atres-live.atresmedia.com')) {
                        currentChannel.sourceOrigin = 'Atresplayer';
                    } else if (url.includes('orangetv.orange.es')) {
                        currentChannel.sourceOrigin = 'OrangeTV';
                    } else if (url.toLowerCase().includes('dazn')) { 
                        currentChannel.sourceOrigin = 'DAZN';
                    } else if (url.toLowerCase().includes('telefonica.com') || url.toLowerCase().includes('movistarplus.es')) {
                        currentChannel.sourceOrigin = 'Movistar+';
                    }
                }
                if (currentChannel.attributes['source-origin']) {
                     currentChannel.sourceOrigin = currentChannel.attributes['source-origin'];
                }


                parsedChannels.push(currentChannel);
                currentChannel = null;
            } else {
                currentChannel = null;
            }
        } else if (!line.startsWith('#') && !currentChannel) {
        }
    }
    if (currentChannel && !currentChannel.url) {
    }

    const finalOrderedGroups = Array.from(new Set(orderedGroups));
    return { channels: parsedChannels, groupOrder: finalOrderedGroups };
}

function normalizeStringForComparison(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[hd|sd|fhd|uhd|4k|8k|(\(\d+p\))|[,.:;\-_\s()\[\]&+'!¡¿?]/g, '')
        .replace(/\s+/g, '');
}

function getStringSimilarity(str1, str2) {
    const s1 = normalizeStringForComparison(str1);
    const s2 = normalizeStringForComparison(str2);
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;

    const profile1 = {};
    for (let i = 0; i < s1.length - 1; i++) {
        const bigram = s1.substring(i, i + 2);
        profile1[bigram] = (profile1[bigram] || 0) + 1;
    }
    const profile2 = {};
    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.substring(i, i + 2);
        profile2[bigram] = (profile2[bigram] || 0) + 1;
    }
    const union = new Set([...Object.keys(profile1), ...Object.keys(profile2)]);
    let intersectionSize = 0;
    for (const bigram of union) {
        if (profile1[bigram] && profile2[bigram]) {
            intersectionSize += Math.min(profile1[bigram], profile2[bigram]);
        }
    }
    return (2.0 * intersectionSize) / (s1.length - 1 + s2.length - 1);
}

function base64ToHex(base64) {
    try {
        const b64Str = String(base64 || '');
        const binary = atob(b64Str.replace(/-/g, '+').replace(/_/g, '/'));
        let hex = '';
        for (let i = 0; i < binary.length; i++) {
            const byte = binary.charCodeAt(i).toString(16).padStart(2, '0');
            hex += byte;
        }
        return hex.toLowerCase();
    } catch (e) {
        return null;
    }
}

function parseClearKey(keyString) {
    if (!keyString || typeof keyString !== 'string') {
        return null;
    }
    keyString = keyString.trim();
    const clearKeys = {};
    try {
        if (keyString.startsWith('{') && keyString.endsWith('}')) {
            try {
                const parsed = JSON.parse(keyString);
                if (parsed.keys && Array.isArray(parsed.keys)) {
                    for (const keyObj of parsed.keys) {
                        if (keyObj.kty !== 'oct') { continue; }
                        if (!keyObj.k || !keyObj.kid) { continue; }
                        const kidHex = base64ToHex(keyObj.kid);
                        const keyHex = base64ToHex(keyObj.k);
                        if (kidHex && keyHex && /^[0-9a-f]{32}$/.test(kidHex) && /^[0-9a-f]{32}$/.test(keyHex)) {
                            clearKeys[kidHex] = keyHex;
                        }
                    }
                } else {
                    for (const kid_orig in parsed) {
                        if (Object.prototype.hasOwnProperty.call(parsed, kid_orig)) {
                            const key_orig = parsed[kid_orig];
                            if (typeof kid_orig !== 'string' || typeof key_orig !== 'string') {
                                continue;
                            }
                            let kidHexStr, keyHexStr;

                            if (!/^[0-9a-fA-F]{32}$/.test(kid_orig)) {
                                const converted = base64ToHex(kid_orig);
                                kidHexStr = converted ? converted : '';
                            } else {
                                kidHexStr = kid_orig.toLowerCase();
                            }
                            if (!/^[0-9a-fA-F]{32}$/.test(key_orig)) {
                                const converted = base64ToHex(key_orig);
                                keyHexStr = converted ? converted : '';
                            } else {
                                keyHexStr = key_orig.toLowerCase();
                            }

                            if (/^[0-9a-f]{32}$/.test(kidHexStr) && /^[0-9a-f]{32}$/.test(keyHexStr)) {
                                clearKeys[kidHexStr] = keyHexStr;
                            }
                        }
                    }
                }
            } catch (jsonParseError) {
                const compactObjectMatch = keyString.match(/^\{([0-9a-fA-F]{32}):([0-9a-fA-F]{32})\}$/);
                if (compactObjectMatch) {
                    clearKeys[compactObjectMatch[1].toLowerCase()] = compactObjectMatch[2].toLowerCase();
                }
            }
        }

        if (Object.keys(clearKeys).length === 0) {
            const simpleHexMatch = keyString.match(/^([0-9a-fA-F]{32}):([0-9a-fA-F]{32})$/);
            if (simpleHexMatch) {
                clearKeys[simpleHexMatch[1].toLowerCase()] = simpleHexMatch[2].toLowerCase();
                return clearKeys;
            }
            const simpleBase64Match = keyString.match(/^([A-Za-z0-9+/_-]+={0,2}):([A-Za-z0-9+/_-]+={0,2})$/);
            if (simpleBase64Match) {
                const kidHex = base64ToHex(simpleBase64Match[1]);
                const keyHex = base64ToHex(simpleBase64Match[2]);
                if (kidHex && keyHex && /^[0-9a-f]{32}$/.test(kidHex) && /^[0-9a-f]{32}$/.test(keyHex)) {
                    clearKeys[kidHex] = keyHex;
                    return clearKeys;
                }
            }
        }

        if (Object.keys(clearKeys).length === 0) {
            return null;
        }
        return clearKeys;
    } catch (e) {
        console.error("Error parsing clearkey string:", e, keyString);
        return null;
    }
}

function safeParseInt(value, defaultValue = 0) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

function detectMimeType(url) {
    if (typeof url !== 'string') return '';
    const u = url.toLowerCase();
    const urlWithoutQuery = u.split('?')[0];
    if (urlWithoutQuery.endsWith('.m3u8')) return 'application/x-mpegURL';
    if (urlWithoutQuery.endsWith('.mpd')) return 'application/dash+xml';
    return '';
}