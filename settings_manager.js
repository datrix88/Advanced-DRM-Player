let userSettings = {
    language: 'en',
    enableEpgNameMatching: false,
    epgNameMatchThreshold: 0.80,
    sidebarCollapsed: window.innerWidth < 992,
    persistFilters: true,
    lastSelectedGroup: "",
    lastSelectedFilterTab: "all",
    playerBuffer: 30,
    preferredAudioLanguage: 'es',
    preferredTextLanguage: 'off',
    lowLatencyMode: true,
    liveCatchUpMode: false,
    globalUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    globalReferrer: '',
    additionalGlobalHeaders: '{}',
    channelCardSize: 180,
    persistentControls: false,
    maxVideoHeight: 0,
    autoSaveM3U: true,
    defaultEpgUrl: 'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/refs/heads/master/EPG_dobleM.xml',
    lastEpgUrl: '',
    abrEnabled: true,
    abrDefaultBandwidthEstimate: 1000,
    streamingJumpLargeGaps: false,
    manifestRetryMaxAttempts: 2,
    manifestRetryTimeout: 15000,
    segmentRetryMaxAttempts: 2,
    segmentRetryTimeout: 15000,
    shakaDefaultPresentationDelay: 5,
    shakaAudioVideoSyncThreshold: 0.25,
    appTheme: 'default-green',
    appFont: 'system',
    particlesEnabled: true,
    particleOpacity: 0.02,
    channelsPerPage: 48,
    epgDensity: 200,
    cardShowGroup: true,
    cardShowEpg: true,
    cardShowFavButton: true,
    cardShowChannelNumber: false,
    cardLogoAspectRatio: "16/9",
    m3uUploadServerUrl: "",
    orangeTvUsername: "",
    orangeTvPassword: "",
    orangeTvSelectedGroups: [],
    barTvEmail: "",
    barTvPassword: "",
    movistarVodCacheDaysToKeep: 15,
    useMovistarVodAsEpg: true,
    xcodecCorsProxyUrl: "",
    xcodecIgnorePanelsOverStreams: 0,
    xcodecDefaultBatchSize: 15,
    xcodecDefaultTimeout: 8000,
    playerWindowOpacity: 1,
    compactCardView: false,
    enableHoverPreview: true,
    eqSettings: {
        enabled: true,
        preamp: 0,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        compressor: { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 },
        customPresets: []
    }
};

let daznAuthTokenState = null;
const DAZN_TOKEN_DB_KEY = 'daznAuthTokenKey';

const ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS = [
    "Generalista", "Series", "Cine", "Documentales", "Lifestyle", "Juvenil",
    "Infantil", "Deportes", "Motor", "Anime", "Música", "Información",
    "Autonómicos", "Internacionales", "Adulto"
];


const availableLanguages = [
    {code: 'es', name: 'Español'}, {code: 'en', name: 'Inglés'},
    {code: 'pt', name: 'Portugués'}, {code: 'fr', name: 'Francés'},
    {code: 'de', name: 'Alemán'}, {code: 'it', name: 'Italiano'},
    {code: 'ja', name: 'Japonés'}, {code: 'qaa', name: 'Original'},
    {code: 'und', name: 'Indefinido (und)'}
];
const availableTextLanguages = [
    {code: 'off', name: 'Desactivado'}, ...availableLanguages
];

async function loadUserSettings() {
    const storedSettings = await getAppConfigValue('userSettings');
    const defaultSettingsCopy = JSON.parse(JSON.stringify(userSettings));
    
    if (!defaultSettingsCopy.orangeTvSelectedGroups || defaultSettingsCopy.orangeTvSelectedGroups.length === 0) {
        defaultSettingsCopy.orangeTvSelectedGroups = ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS.slice();
    }

    if (storedSettings) {
        Object.assign(userSettings, defaultSettingsCopy, storedSettings);
        if(typeof userSettings.additionalGlobalHeaders !== 'string'){
            userSettings.additionalGlobalHeaders = JSON.stringify(userSettings.additionalGlobalHeaders || {});
        }
        if (!userSettings.orangeTvSelectedGroups || !Array.isArray(userSettings.orangeTvSelectedGroups)) {
            userSettings.orangeTvSelectedGroups = defaultSettingsCopy.orangeTvSelectedGroups;
        }
    } else {
        userSettings.orangeTvSelectedGroups = defaultSettingsCopy.orangeTvSelectedGroups;
    }
    
    favorites = await getAppConfigValue('favorites') || [];
    appHistory = await getAppConfigValue('history') || [];
    daznAuthTokenState = await getAppConfigValue(DAZN_TOKEN_DB_KEY) || null;
}

async function saveUserSettings() {
    userSettings.language = $('#appLanguageSelect').val();
    userSettings.enableEpgNameMatching = $('#enableEpgNameMatchingCheck').is(':checked');
    userSettings.epgNameMatchThreshold = parseFloat($('#epgNameMatchThreshold').val()) / 100;
    userSettings.sidebarCollapsed = $('#sidebar').hasClass('collapsed');
    userSettings.persistFilters = $('#persistFiltersCheck').is(':checked');
    userSettings.playerBuffer = parseInt($('#playerBufferInput').val(), 10);
    userSettings.preferredAudioLanguage = $('#preferredAudioLanguageInput').val();
    userSettings.preferredTextLanguage = $('#preferredTextLanguageInput').val();
    userSettings.lowLatencyMode = $('#lowLatencyModeCheck').is(':checked');
    userSettings.liveCatchUpMode = $('#liveCatchUpModeCheck').is(':checked');
    userSettings.abrEnabled = $('#abrEnabledCheck').is(':checked');
    userSettings.abrDefaultBandwidthEstimate = parseInt($('#abrDefaultBandwidthEstimateInput').val(), 10);
    userSettings.streamingJumpLargeGaps = $('#streamingJumpLargeGapsCheck').is(':checked');
    userSettings.shakaDefaultPresentationDelay = parseFloat($('#shakaDefaultPresentationDelayInput').val());
    userSettings.shakaAudioVideoSyncThreshold = parseFloat($('#shakaAudioVideoSyncThresholdInput').val());
    userSettings.manifestRetryMaxAttempts = parseInt($('#manifestRetryMaxAttemptsInput').val(), 10);
    userSettings.manifestRetryTimeout = parseInt($('#manifestRetryTimeoutInput').val(), 10);
    userSettings.segmentRetryMaxAttempts = parseInt($('#segmentRetryMaxAttemptsInput').val(), 10);
    userSettings.segmentRetryTimeout = parseInt($('#segmentRetryTimeoutInput').val(), 10);
    userSettings.globalUserAgent = $('#globalUserAgentInput').val().trim();
    userSettings.globalReferrer = $('#globalReferrerInput').val().trim();
    try {
        JSON.parse($('#additionalGlobalHeadersInput').val());
        userSettings.additionalGlobalHeaders = $('#additionalGlobalHeadersInput').val();
    } catch(e) {
        userSettings.additionalGlobalHeaders = '{}';
        if (typeof showNotification === 'function') showNotification('Cabeceras Globales Adicionales no es un JSON válido. No se guardó.', 'warning');
    }
    userSettings.channelCardSize = parseInt($('#channelCardSizeInput').val(), 10);
    userSettings.channelsPerPage = parseInt($('#channelsPerPageInput').val(), 10);
    userSettings.persistentControls = $('#persistentControlsCheck').is(':checked');
    userSettings.maxVideoHeight = parseInt($('#maxVideoHeight').val(), 10);
    userSettings.autoSaveM3U = $('#autoSaveM3UCheck').is(':checked');
    userSettings.defaultEpgUrl = $('#defaultEpgUrlInput').val().trim();
    userSettings.appTheme = $('#appThemeSelect').val();
    userSettings.appFont = $('#appFontSelect').val();
    userSettings.particlesEnabled = $('#particlesEnabledCheck').is(':checked');
    userSettings.particleOpacity = parseFloat($('#particleOpacityInput').val()) / 100;
    userSettings.epgDensity = parseInt($('#epgDensityInput').val(), 10);
    userSettings.cardShowGroup = $('#cardShowGroupCheck').is(':checked');
    userSettings.cardShowEpg = $('#cardShowEpgCheck').is(':checked');
    userSettings.cardShowFavButton = $('#cardShowFavButtonCheck').is(':checked');
    userSettings.cardShowChannelNumber = $('#cardShowChannelNumberCheck').is(':checked');
    userSettings.cardLogoAspectRatio = $('#cardLogoAspectRatioSelect').val();
    userSettings.m3uUploadServerUrl = $('#m3uUploadServerUrlInput').val().trim();

    userSettings.orangeTvUsername = $('#orangeTvUsernameInput').val().trim() || "";
    userSettings.orangeTvPassword = $('#orangeTvPasswordInput').val() || "";
    userSettings.orangeTvSelectedGroups = [];
    $('#orangeTvGroupSelectionContainer .form-check-input:checked').each(function() {
        userSettings.orangeTvSelectedGroups.push($(this).val());
    });
    userSettings.barTvEmail = $('#barTvEmailInput').val().trim();
    userSettings.barTvPassword = $('#barTvPasswordInput').val();

    const oldUseMovistarVodAsEpg = userSettings.useMovistarVodAsEpg;
    userSettings.useMovistarVodAsEpg = $('#useMovistarVodAsEpgCheck').is(':checked');


    const oldMovistarVodCacheDays = userSettings.movistarVodCacheDaysToKeep;
    userSettings.movistarVodCacheDaysToKeep = parseInt($('#movistarVodCacheDaysToKeepInput').val(), 10) || 15;
    if (userSettings.movistarVodCacheDaysToKeep < 1) userSettings.movistarVodCacheDaysToKeep = 1;
    if (userSettings.movistarVodCacheDaysToKeep > 90) userSettings.movistarVodCacheDaysToKeep = 90;

    userSettings.xcodecCorsProxyUrl = $('#xcodecCorsProxyUrlInput').val().trim();
    userSettings.xcodecIgnorePanelsOverStreams = parseInt($('#xcodecIgnorePanelsOverStreamsInput').val(), 10) || 0;
    userSettings.xcodecDefaultBatchSize = parseInt($('#xcodecDefaultBatchSizeInput').val(), 10) || 15;
    userSettings.xcodecDefaultTimeout = parseInt($('#xcodecDefaultTimeoutInput').val(), 10) || 8000;

    userSettings.playerWindowOpacity = parseFloat($('#playerWindowOpacityInput').val());
    userSettings.compactCardView = $('#compactCardViewCheck').is(':checked');
    userSettings.enableHoverPreview = $('#enableHoverPreviewCheck').is(':checked');


    await saveAppConfigValue('userSettings', userSettings);

    const daznTokenFromInput = $('#daznAuthTokenSettingsInput').val().trim();
    const currentTokenInDb = daznAuthTokenState;

    if (daznTokenFromInput && daznTokenFromInput !== currentTokenInDb) {
        daznAuthTokenState = daznTokenFromInput;
        await saveAppConfigValue(DAZN_TOKEN_DB_KEY, daznAuthTokenState);
        if (typeof showNotification === 'function') showNotification('Token DAZN guardado.', 'success');
    } else if (!daznTokenFromInput && currentTokenInDb) {
        daznAuthTokenState = null;
        await deleteAppConfigValue(DAZN_TOKEN_DB_KEY);
        if (typeof showNotification === 'function') showNotification('Token DAZN eliminado.', 'info');
    }

    if (oldMovistarVodCacheDays !== userSettings.movistarVodCacheDaysToKeep) {
        if (typeof deleteOldMovistarVodData === 'function') {
            try {
                const deletedCount = await deleteOldMovistarVodData(userSettings.movistarVodCacheDaysToKeep);
                if (typeof showNotification === 'function') showNotification(`Política de caché VOD actualizada. ${deletedCount} registros antiguos eliminados.`, 'info');
                updateMovistarVodCacheStatsUI();
            } catch (e) {
                if (typeof showNotification === 'function') showNotification(`Error aplicando nueva política de caché VOD: ${e.message}`, 'warning');
            }
        }
    }
    
    if (oldUseMovistarVodAsEpg !== userSettings.useMovistarVodAsEpg) {
        if (typeof matchChannelsWithEpg === 'function') await matchChannelsWithEpg(true);
        if (userSettings.useMovistarVodAsEpg && typeof updateEpgWithMovistarVodData === 'function') {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            await updateEpgWithMovistarVodData(`${yyyy}-${mm}-${dd}`);
        } else if (!userSettings.useMovistarVodAsEpg && typeof epgDataByChannelId !== 'undefined') {
            for (const key in epgDataByChannelId) {
                if (key.startsWith('movistar.')) {
                    delete epgDataByChannelId[key];
                }
            }
             if (typeof filterAndRenderChannels === 'function') filterAndRenderChannels();
             if (typeof updateEPGProgressBarOnCards === 'function') updateEPGProgressBarOnCards();
        }
    }


    if (typeof applyUISettings === 'function') applyUISettings();
    if (typeof showNotification === 'function' && !daznTokenFromInput && !currentTokenInDb) {
         showNotification('Ajustes guardados y aplicados.', 'success');
    } else if (typeof showNotification === 'function' && daznTokenFromInput && daznTokenFromInput === currentTokenInDb) {
         showNotification('Ajustes guardados y aplicados (Token DAZN sin cambios).', 'success');
    }

}

function populateUserSettingsForm() {
    populateLanguageSelects();
    $('#appLanguageSelect').val(userSettings.language);
    $('#enableEpgNameMatchingCheck').prop('checked', userSettings.enableEpgNameMatching);
    $('#epgNameMatchThreshold').val(userSettings.epgNameMatchThreshold * 100);
    $('#epgNameMatchThresholdValue').text((userSettings.epgNameMatchThreshold * 100).toFixed(0) + '%');
    $('#persistFiltersCheck').prop('checked', userSettings.persistFilters);
    $('#playerBufferInput').val(userSettings.playerBuffer);
    $('#playerBufferValue').text(userSettings.playerBuffer + 's');
    $('#preferredAudioLanguageInput').val(userSettings.preferredAudioLanguage);
    $('#preferredTextLanguageInput').val(userSettings.preferredTextLanguage);
    $('#lowLatencyModeCheck').prop('checked', userSettings.lowLatencyMode);
    $('#liveCatchUpModeCheck').prop('checked', userSettings.liveCatchUpMode);
    $('#abrEnabledCheck').prop('checked', userSettings.abrEnabled);
    $('#abrDefaultBandwidthEstimateInput').val(userSettings.abrDefaultBandwidthEstimate);
    $('#abrDefaultBandwidthEstimateValue').text(userSettings.abrDefaultBandwidthEstimate + ' Kbps');
    $('#streamingJumpLargeGapsCheck').prop('checked', userSettings.streamingJumpLargeGaps);
    $('#shakaDefaultPresentationDelayInput').val(userSettings.shakaDefaultPresentationDelay);
    $('#shakaDefaultPresentationDelayValue').text(userSettings.shakaDefaultPresentationDelay.toFixed(userSettings.shakaDefaultPresentationDelay % 1 === 0 ? 0 : 1) + 's');
    $('#shakaAudioVideoSyncThresholdInput').val(userSettings.shakaAudioVideoSyncThreshold);
    $('#shakaAudioVideoSyncThresholdValue').text(userSettings.shakaAudioVideoSyncThreshold.toFixed(userSettings.shakaAudioVideoSyncThreshold % 1 === 0 ? 0 : 2) + 's');
    $('#manifestRetryMaxAttemptsInput').val(userSettings.manifestRetryMaxAttempts);
    $('#manifestRetryMaxAttemptsValue').text(userSettings.manifestRetryMaxAttempts);
    $('#manifestRetryTimeoutInput').val(userSettings.manifestRetryTimeout);
    $('#manifestRetryTimeoutValue').text(userSettings.manifestRetryTimeout);
    $('#segmentRetryMaxAttemptsInput').val(userSettings.segmentRetryMaxAttempts);
    $('#segmentRetryMaxAttemptsValue').text(userSettings.segmentRetryMaxAttempts);
    $('#segmentRetryTimeoutInput').val(userSettings.segmentRetryTimeout);
    $('#segmentRetryTimeoutValue').text(userSettings.segmentRetryTimeout);
    $('#globalUserAgentInput').val(userSettings.globalUserAgent);
    $('#globalReferrerInput').val(userSettings.globalReferrer);
    try {
        const parsedHeaders = JSON.parse(userSettings.additionalGlobalHeaders || '{}');
        $('#additionalGlobalHeadersInput').val(JSON.stringify(parsedHeaders, null, 2));
    } catch (e) {
        $('#additionalGlobalHeadersInput').val('{}');
    }
    $('#channelCardSizeInput').val(userSettings.channelCardSize);
    $('#channelCardSizeValue').text(userSettings.channelCardSize + 'px');
    $('#channelsPerPageInput').val(userSettings.channelsPerPage);
    $('#channelsPerPageValue').text(userSettings.channelsPerPage);
    $('#persistentControlsCheck').prop('checked', userSettings.persistentControls);
    $('#maxVideoHeight').val(userSettings.maxVideoHeight);
    $('#autoSaveM3UCheck').prop('checked', userSettings.autoSaveM3U);
    $('#defaultEpgUrlInput').val(userSettings.defaultEpgUrl);
    $('#appThemeSelect').val(userSettings.appTheme);
    $('#appFontSelect').val(userSettings.appFont);
    $('#particlesEnabledCheck').prop('checked', userSettings.particlesEnabled);
    $('#particleOpacityInput').val(userSettings.particleOpacity * 100);
    $('#particleOpacityValue').text((userSettings.particleOpacity * 100).toFixed(0) + '%');
    $('#epgDensityInput').val(userSettings.epgDensity);
    $('#epgDensityValue').text(userSettings.epgDensity + 'px/h');
    $('#cardShowGroupCheck').prop('checked', userSettings.cardShowGroup);
    $('#cardShowEpgCheck').prop('checked', userSettings.cardShowEpg);
    $('#cardShowFavButtonCheck').prop('checked', userSettings.cardShowFavButton);
    $('#cardShowChannelNumberCheck').prop('checked', userSettings.cardShowChannelNumber);
    $('#cardLogoAspectRatioSelect').val(userSettings.cardLogoAspectRatio);
    $('#m3uUploadServerUrlInput').val(userSettings.m3uUploadServerUrl);

    $('#orangeTvUsernameInput').val(userSettings.orangeTvUsername);
    $('#orangeTvPasswordInput').val(userSettings.orangeTvPassword);
    const orangeTvGroupContainer = $('#orangeTvGroupSelectionContainer');
    orangeTvGroupContainer.empty();
    const currentSelectedOrangeGroups = Array.isArray(userSettings.orangeTvSelectedGroups) ? userSettings.orangeTvSelectedGroups : ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS.slice();
    ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS.forEach(group => {
        const isChecked = currentSelectedOrangeGroups.includes(group);
        const checkboxHtml = `
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="orangeTvGroup_${group.replace(/\s+/g, '')}" value="${group}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="orangeTvGroup_${group.replace(/\s+/g, '')}">${group}</label>
            </div>`;
        orangeTvGroupContainer.append(checkboxHtml);
    });

    $('#barTvEmailInput').val(userSettings.barTvEmail);
    $('#barTvPasswordInput').val(userSettings.barTvPassword);

    $('#daznAuthTokenSettingsInput').val(daznAuthTokenState || '');
    $('#movistarVodCacheDaysToKeepInput').val(userSettings.movistarVodCacheDaysToKeep);
    $('#useMovistarVodAsEpgCheck').prop('checked', userSettings.useMovistarVodAsEpg);


    $('#xcodecCorsProxyUrlInput').val(userSettings.xcodecCorsProxyUrl);
    $('#xcodecIgnorePanelsOverStreamsInput').val(userSettings.xcodecIgnorePanelsOverStreams);
    $('#xcodecDefaultBatchSizeInput').val(userSettings.xcodecDefaultBatchSize);
    $('#xcodecDefaultTimeoutInput').val(userSettings.xcodecDefaultTimeout);

    $('#playerWindowOpacityInput').val(userSettings.playerWindowOpacity);
    $('#playerWindowOpacityValue').text((userSettings.playerWindowOpacity * 100).toFixed(0) + '%');
    $('#compactCardViewCheck').prop('checked', userSettings.compactCardView);
    $('#enableHoverPreviewCheck').prop('checked', userSettings.enableHoverPreview);


    updateMovistarVodCacheStatsUI();
}

function applyThemeAndFont() {
    document.body.className = '';
    document.body.classList.add(`theme-${userSettings.appTheme.replace('default-','')}`);
    document.body.classList.add(`font-type-${userSettings.appFont.replace('system','apple-system')}`);
    $('#particles-js').toggleClass('disabled', !userSettings.particlesEnabled);
    document.documentElement.style.setProperty('--particle-opacity', userSettings.particlesEnabled ? String(userSettings.particleOpacity) : '0');

    if(typeof particlesJS !== 'undefined' && document.getElementById('particles-js').dataset.initialized === 'true' && userSettings.particlesEnabled) {
       const pJS = pJSDom[0]?.pJS;
       if (pJS) {
            const particleColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-secondary').trim();
            const particleLineColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim();
            pJS.particles.color.value = particleColor;
            pJS.particles.line_linked.color = particleLineColor;
            pJS.fn.particlesRefresh();
       }
    } else if (typeof initParticles === 'function') {
        initParticles();
    }
}

function populateLanguageSelects() {
    const audioSelect = $('#preferredAudioLanguageInput');
    const textSelect = $('#preferredTextLanguageInput');
    audioSelect.empty(); textSelect.empty();

    availableLanguages.forEach(lang => {
        audioSelect.append(new Option(lang.name + ` (${lang.code})`, lang.code));
    });
     availableTextLanguages.forEach(lang => {
        textSelect.append(new Option(lang.name + (lang.code !== 'off' ? ` (${lang.code})` : ''), lang.code));
    });
}

function exportSettings() {
    const settingsToExport = { ...userSettings };

    const settingsString = JSON.stringify(settingsToExport, null, 2);
    const blob = new Blob([settingsString], {type: "application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zenith_player_settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showNotification === 'function') showNotification('Ajustes (sin token DAZN) exportados.', 'success');
}

async function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            const defaultSettingsCopy = JSON.parse(JSON.stringify(userSettings));

            Object.keys(defaultSettingsCopy).forEach(key => {
                if (imported[key] !== undefined && (typeof imported[key] === typeof defaultSettingsCopy[key] || defaultSettingsCopy[key] === null)) {
                    userSettings[key] = imported[key];
                }
            });

            if(typeof userSettings.additionalGlobalHeaders !== 'string'){
                userSettings.additionalGlobalHeaders = JSON.stringify(userSettings.additionalGlobalHeaders || '{}');
            }
            if (!Number.isInteger(userSettings.channelsPerPage) || userSettings.channelsPerPage < 12 || userSettings.channelsPerPage > 120) {
                 userSettings.channelsPerPage = defaultSettingsCopy.channelsPerPage;
            }
             if (!Number.isInteger(userSettings.movistarVodCacheDaysToKeep) || userSettings.movistarVodCacheDaysToKeep < 1 || userSettings.movistarVodCacheDaysToKeep > 90) {
                userSettings.movistarVodCacheDaysToKeep = defaultSettingsCopy.movistarVodCacheDaysToKeep;
            }
            if (!Array.isArray(userSettings.orangeTvSelectedGroups) || userSettings.orangeTvSelectedGroups.some(g => !ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS.includes(g))) {
                 userSettings.orangeTvSelectedGroups = ORANGE_TV_AVAILABLE_GROUPS_FOR_SETTINGS.slice();
            }

            let importedDaznToken = imported.daznAuthToken || imported.daznAuthTokenState;
            if (importedDaznToken && typeof importedDaznToken === 'string') {
                 daznAuthTokenState = importedDaznToken;
                 await saveAppConfigValue(DAZN_TOKEN_DB_KEY, daznAuthTokenState);
            }
            
            await saveAppConfigValue('userSettings', userSettings);
            
            if (typeof applyUISettings === 'function') applyUISettings();

            if (typeof showNotification === 'function') showNotification('Ajustes importados y aplicados correctamente.', 'success');
            $('#settingsModal').modal('hide');
             if (typeof populateUserSettingsForm === 'function') populateUserSettingsForm();

        } catch (err) {
            if (typeof showNotification === 'function') showNotification('Error importando ajustes: Archivo JSON inválido o corrupto. ' + err.message, 'error');
        } finally {
            $('#importSettingsInput').val('');
        }
    };
    reader.readAsText(file);
}

async function updateMovistarVodCacheStatsUI() {
    const daysSpan = $('#movistarVodCacheCurrentDaysSpan');
    const sizeSpan = $('#movistarVodCacheSizeSpan');
    daysSpan.text('Calculando...');
    sizeSpan.text('Calculando...');

    if (typeof getMovistarVodCacheStats === 'function') {
        try {
            const stats = await getMovistarVodCacheStats();
            daysSpan.text(`${stats.count} día(s)`);
            const sizeMB = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);
            sizeSpan.text(`${sizeMB} MB`);
        } catch (e) {
            daysSpan.text('Error');
            sizeSpan.text('Error');
            if (typeof showNotification === 'function') showNotification(`Error al obtener info de caché VOD: ${e.message}`, 'warning');
        }
    } else {
        daysSpan.text('N/A');
        sizeSpan.text('N/A');
    }
}