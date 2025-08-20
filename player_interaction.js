class ChannelListButton extends shaka.ui.Element {
    constructor(parent, controls, windowId) {
        super(parent, controls);
        this.windowId = windowId;

        this.button_ = document.createElement('button');
        this.button_.classList.add('shaka-channel-list-button');
        this.button_.classList.add('shaka-tooltip');
        this.button_.setAttribute('aria-label', 'Lista de Canales');
        this.button_.setAttribute('data-tooltip-text', 'Lista de Canales');
        
        const icon = document.createElement('i');
        icon.classList.add('material-icons-round');
        icon.textContent = 'video_library';

        this.button_.appendChild(icon);
        this.parent.appendChild(this.button_);

        this.eventManager.listen(this.button_, 'click', () => {
            togglePlayerChannelList(this.windowId);
        });
    }

    destroy() {
        this.eventManager.release();
        super.destroy();
    }
}

class ChannelListButtonFactory {
    constructor(windowId) {
        this.windowId = windowId;
    }
    create(rootElement, controls) {
        return new ChannelListButton(rootElement, controls, this.windowId);
    }
}

class EQButton extends shaka.ui.Element {
    constructor(parent, controls, windowId) {
        super(parent, controls);
        this.windowId = windowId;

        this.button_ = document.createElement('button');
        this.button_.classList.add('shaka-eq-button');
        this.button_.classList.add('shaka-tooltip');
        this.button_.setAttribute('aria-label', 'Ecualizador');
        this.button_.setAttribute('data-tooltip-text', 'Ecualizador');
        
        const icon = document.createElement('i');
        icon.classList.add('material-icons-round');
        icon.textContent = 'equalizer';

        this.button_.appendChild(icon);
        this.parent.appendChild(this.button_);

        this.eventManager.listen(this.button_, 'click', () => {
            toggleEQPanel(this.windowId);
        });
    }

    destroy() {
        this.eventManager.release();
        super.destroy();
    }
}

class EQButtonFactory {
    constructor(windowId) {
        this.windowId = windowId;
    }
    create(rootElement, controls) {
        return new EQButton(rootElement, controls, this.windowId);
    }
}

function setupEQPanel(windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.eqPanel || !instance.audioEnhancer) return;

    const enhancer = instance.audioEnhancer;
    const panel = instance.eqPanel;

    const onOffSwitch = panel.querySelector('.eq-on-off');
    const resetBtn = panel.querySelector('.eq-reset-btn');
    const savePresetBtn = panel.querySelector('.eq-save-preset-btn');
    const customPresetSelect = panel.querySelector('.eq-custom-preset-select');
    const deletePresetBtn = panel.querySelector('.eq-delete-preset-btn');
    const bandContainer = panel.querySelector('.eq-band-container');
    
    bandContainer.innerHTML = '';

    const updateUIFromSettings = (settings) => {
        onOffSwitch.checked = settings.enabled;
        
        const preampSlider = panel.querySelector('.eq-slider.preamp');
        const preampValueLabel = panel.querySelector('.preamp-band .eq-value');
        if (preampSlider && preampValueLabel) {
            preampSlider.value = settings.preamp;
            preampValueLabel.textContent = `${Math.round(settings.preamp)}dB`;
        }

        const bandSliders = panel.querySelectorAll('.eq-band:not(.preamp-band) .eq-slider');
        const bandValueLabels = panel.querySelectorAll('.eq-band:not(.preamp-band) .eq-value');
        bandSliders.forEach((slider, i) => {
            if (settings.bands[i] !== undefined) {
                slider.value = settings.bands[i];
                if (bandValueLabels[i]) {
                    bandValueLabels[i].textContent = `${settings.bands[i]}dB`;
                }
            }
        });
    };

    onOffSwitch.addEventListener('change', () => {
        const isEnabled = onOffSwitch.checked;
        enhancer.toggle(isEnabled);
        userSettings.eqSettings.enabled = isEnabled;
        saveAppConfigValue('userSettings', userSettings);
    });

    resetBtn.addEventListener('click', () => {
        const flatSettings = { enabled: true, preamp: 0, bands: new Array(10).fill(0), compressor: {} };
        userSettings.eqSettings = { ...userSettings.eqSettings, ...flatSettings };
        enhancer.applySettings(flatSettings);
        updateUIFromSettings(flatSettings);
        customPresetSelect.value = '';
        saveAppConfigValue('userSettings', userSettings);
    });
    
    const preampBand = document.createElement('div');
    preampBand.className = 'eq-band preamp-band';
    preampBand.innerHTML = `
        <div class="eq-slider-wrapper">
            <input type="range" class="eq-slider preamp" min="-15" max="15" step="1" value="0" orient="vertical">
        </div>
        <label>Pre</label>
        <span class="eq-value">0dB</span>`;
    bandContainer.appendChild(preampBand);

    const preampSlider = preampBand.querySelector('.eq-slider');
    const preampValueLabel = preampBand.querySelector('.eq-value');
    
    preampSlider.addEventListener('input', () => {
        const gain = parseFloat(preampSlider.value);
        enhancer.changePreamp(gain);
        preampValueLabel.textContent = `${Math.round(gain)}dB`;
        userSettings.eqSettings.preamp = gain;
        customPresetSelect.value = '';
    });
    preampSlider.addEventListener('change', () => saveAppConfigValue('userSettings', userSettings));
    
    enhancer.bandFrequencies.forEach((freq, i) => {
        const bandDiv = document.createElement('div');
        bandDiv.className = 'eq-band';
        const labelText = freq >= 1000 ? `${freq / 1000}k` : freq;
        bandDiv.innerHTML = `
            <div class="eq-slider-wrapper">
                <input type="range" class="eq-slider" min="-15" max="15" step="1" value="0" orient="vertical">
            </div>
            <label>${labelText}</label>
            <span class="eq-value">0dB</span>`;
        bandContainer.appendChild(bandDiv);
        
        const slider = bandDiv.querySelector('.eq-slider');
        const valueLabel = bandDiv.querySelector('.eq-value');

        slider.addEventListener('input', () => {
            const gain = parseFloat(slider.value);
            enhancer.changeGain(i, gain);
            valueLabel.textContent = `${gain}dB`;
            userSettings.eqSettings.bands[i] = gain;
            customPresetSelect.value = '';
        });
        slider.addEventListener('change', () => saveAppConfigValue('userSettings', userSettings));
    });

    const staticPresets = {
        'dialogue': { enabled: true, preamp: 0, bands: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2], compressor: {} },
        'movie':    { enabled: true, preamp: 2, bands: [3, 2, 1, 0, -1, 0, 1, 3, 4, 3], compressor: {} },
        'night':    { enabled: true, preamp: 0, bands: [4, 3, 2, 0, -2, -4, -5, -6, -7, -8], compressor: { threshold: -40, knee: 30, ratio: 12 } }
    };

    panel.querySelectorAll('.eq-static-presets button[data-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const presetName = button.dataset.preset;
            if (staticPresets[presetName]) {
                const settings = staticPresets[presetName];
                userSettings.eqSettings = { ...userSettings.eqSettings, ...settings };
                enhancer.applySettings(settings);
                updateUIFromSettings(settings);
                customPresetSelect.value = '';
                saveAppConfigValue('userSettings', userSettings);
            }
        });
    });
    
    const populateCustomPresets = () => {
        customPresetSelect.innerHTML = '<option value="">-- Presets Guardados --</option>';
        (userSettings.eqSettings.customPresets || []).forEach((preset, index) => {
            customPresetSelect.innerHTML += `<option value="${index}">${escapeHtml(preset.name)}</option>`;
        });
    };

    savePresetBtn.addEventListener('click', () => {
        const presetName = prompt("Nombre para el preset:", "Mi Sonido");
        if (presetName) {
            const newPreset = {
                name: presetName,
                settings: {
                    enabled: userSettings.eqSettings.enabled,
                    preamp: userSettings.eqSettings.preamp,
                    bands: [...userSettings.eqSettings.bands]
                }
            };
            if (!userSettings.eqSettings.customPresets) userSettings.eqSettings.customPresets = [];
            userSettings.eqSettings.customPresets.push(newPreset);
            populateCustomPresets();
            customPresetSelect.value = userSettings.eqSettings.customPresets.length - 1;
            saveAppConfigValue('userSettings', userSettings);
        }
    });

    customPresetSelect.addEventListener('change', () => {
        const index = customPresetSelect.value;
        if (index !== '') {
            const preset = userSettings.eqSettings.customPresets[index];
            if (preset) {
                const settings = { ...preset.settings, compressor: {} };
                userSettings.eqSettings = { ...userSettings.eqSettings, ...settings };
                enhancer.applySettings(settings);
                updateUIFromSettings(settings);
                saveAppConfigValue('userSettings', userSettings);
            }
        }
    });

    deletePresetBtn.addEventListener('click', () => {
        const index = customPresetSelect.value;
        if (index !== '' && userSettings.eqSettings.customPresets[index]) {
            if (confirm(`¿Seguro que quieres eliminar el preset "${userSettings.eqSettings.customPresets[index].name}"?`)) {
                userSettings.eqSettings.customPresets.splice(index, 1);
                populateCustomPresets();
                saveAppConfigValue('userSettings', userSettings);
            }
        }
    });

    updateUIFromSettings(userSettings.eqSettings);
    populateCustomPresets();
}

function createPlayerWindow(channel) {
    const template = document.getElementById('playerWindowTemplate');
    if (!template) {
        showNotification("Error: No se encuentra la plantilla del reproductor.", "error");
        return;
    }
    const newWindow = template.content.firstElementChild.cloneNode(true);
    const uniqueId = `player-window-${Date.now()}`;
    newWindow.id = uniqueId;

    const titleEl = newWindow.querySelector('.player-window-title');
    titleEl.textContent = channel.name || 'Reproductor';
    titleEl.title = channel.name || 'Reproductor';

    const videoElement = newWindow.querySelector('.player-video');
    const containerElement = newWindow.querySelector('.player-container');
    const channelListPanel = newWindow.querySelector('.player-channel-list-panel');

    containerElement.appendChild(channelListPanel);

    const numWindows = Object.keys(playerInstances).length;
    const baseTop = 50;
    const baseLeft = 50;
    const offset = (numWindows % 10) * 30;
    newWindow.style.top = `${baseTop + offset}px`;
    newWindow.style.left = `${baseLeft + offset}px`;

    document.getElementById('player-windows-container').appendChild(newWindow);
    
    const playerInstance = new shaka.Player();
    const uiInstance = new shaka.ui.Overlay(playerInstance, containerElement, videoElement);

    const channelListFactory = new ChannelListButtonFactory(uniqueId);
    shaka.ui.Controls.registerElement('channel_list', channelListFactory);

    const eqButtonFactory = new EQButtonFactory(uniqueId);
    shaka.ui.Controls.registerElement('eq_button', eqButtonFactory);
    
    uiInstance.configure({
        controlPanelElements: ['play_pause', 'time_and_duration', 'volume', 'spacer', 'channel_list', 'eq_button', 'quality', 'language', 'captions', 'fullscreen'],
        overflowMenuButtons: ['cast', 'picture_in_picture', 'playback_rate'],
        addSeekBar: true,
        addBigPlayButton: true,
        enableTooltips: true,
        fadeDelay: userSettings.persistentControls ? Infinity : 0,
        seekBarColors: { base: 'rgba(255, 255, 255, 0.3)', played: 'var(--accent-primary)', buffered: 'rgba(200, 200, 200, 0.6)' },
        volumeBarColors: { base: 'rgba(255, 255, 255, 0.3)', level: 'var(--accent-primary)' },
        customContextMenu: true
    });
    
    const eqPanelTemplate = document.getElementById('eqPanelTemplate');
    const eqPanel = eqPanelTemplate.content.firstElementChild.cloneNode(true);
    containerElement.appendChild(eqPanel);

    const audioEnhancer = new AudioEnhancer(videoElement);
    if (userSettings.eqSettings) {
        audioEnhancer.applySettings(userSettings.eqSettings);
    }
    
    playerInstances[uniqueId] = {
        player: playerInstance,
        ui: uiInstance,
        videoElement: videoElement,
        container: newWindow,
        channel: channel,
        infobarInterval: null,
        isChannelListVisible: false, 
        channelListPanelElement: channelListPanel,
        audioEnhancer: audioEnhancer,
        eqPanel: eqPanel
    };
    
    setupEQPanel(uniqueId);

    setActivePlayer(uniqueId);
    
    playerInstance.attach(videoElement).then(() => {
        playChannelInShaka(channel, uniqueId);
    }).catch(e => {
        console.error("Error al adjuntar Shaka Player a la nueva ventana:", e);
        showNotification("Error al crear la ventana del reproductor.", "error");
        destroyPlayerWindow(uniqueId);
    });

    createTaskbarItem(uniqueId, channel);

    newWindow.querySelector('.player-window-close-btn').addEventListener('click', () => destroyPlayerWindow(uniqueId));
    newWindow.querySelector('.player-window-minimize-btn').addEventListener('click', () => minimizePlayerWindow(uniqueId));

    startPlayerInfobarUpdate(uniqueId);
}

function destroyPlayerWindow(id) {
    const instance = playerInstances[id];
    if (instance) {
        if (instance.infobarInterval) clearInterval(instance.infobarInterval);
        
        if (instance.audioEnhancer) {
            instance.audioEnhancer.destroy();
        }

        if (instance.player) {
            instance.player.destroy().catch(e => {});
        }
        if (instance.container) {
            instance.container.remove();
        }
        delete playerInstances[id];
        
        const taskbarItem = document.getElementById(`taskbar-item-${id}`);
        if (taskbarItem) taskbarItem.remove();

        if (activePlayerId === id) {
            const remainingIds = Object.keys(playerInstances);
            setActivePlayer(remainingIds.length > 0 ? remainingIds[0] : null);
        }
    }
    if (Object.keys(playerInstances).length === 0) {
        applyHttpHeaders([]);
    }
}

function handleFavoriteButtonClick(event) {
    event.stopPropagation();
    const url = $(this).data('url');
    if (!url) { return; }
    toggleFavorite(url);
}

function showPlayerInfobar(channel, infobarElement) {
    if (!infobarElement || !channel) return;
    
    if (infobarElement.hideTimeout) clearTimeout(infobarElement.hideTimeout);

    updatePlayerInfobar(channel, infobarElement);
    $(infobarElement).addClass('show');

    infobarElement.hideTimeout = setTimeout(() => {
        $(infobarElement).removeClass('show');
    }, 7000);
}

function createTaskbarItem(windowId, channel) {
    const taskbar = document.getElementById('player-taskbar');
    const item = document.createElement('button');
    item.className = 'taskbar-item';
    item.id = `taskbar-item-${windowId}`;
    item.title = channel.name;
    item.dataset.windowId = windowId;

    const logoSrc = channel['tvg-logo'] || '';
    
    let iconHtml;
    if (logoSrc) {
        iconHtml = `<img src="${escapeHtml(logoSrc)}" class="taskbar-item-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                    <span class="taskbar-item-logo-placeholder" style="display: none;">${escapeHtml(channel.name.charAt(0))}</span>`;
    } else {
        iconHtml = `<span class="taskbar-item-logo-placeholder">${escapeHtml(channel.name.charAt(0))}</span>`;
    }

    item.innerHTML = `
        <div class="taskbar-item-icon-container">${iconHtml}</div>
        <span class="taskbar-item-text">${escapeHtml(channel.name)}</span>
    `;
    taskbar.appendChild(item);
}

function minimizePlayerWindow(windowId) {
    const instance = playerInstances[windowId];
    if (instance) {
        instance.container.style.display = 'none';
        $(`#taskbar-item-${windowId}`).removeClass('active');
        if (activePlayerId === windowId) {
            activePlayerId = null; 
        }
    }
}

function togglePlayerChannelList(windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.channelListPanelElement) return;

    instance.isChannelListVisible = !instance.isChannelListVisible;
    instance.channelListPanelElement.classList.toggle('open', instance.isChannelListVisible);

    if (instance.isChannelListVisible) {
        populatePlayerChannelList(windowId);
    }
}

function populatePlayerChannelList(windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.channelListPanelElement || !instance.channel) return;

    const listContentElement = instance.channelListPanelElement.querySelector('.player-channel-list-content');
    if (!listContentElement) return;

    listContentElement.innerHTML = ''; 

    const currentPlayingChannel = instance.channel;
    const currentGroup = currentPlayingChannel['group-title'] || 'Sin Grupo';

    const channelsInGroup = channels.filter(ch => (ch['group-title'] || 'Sin Grupo') === currentGroup);

    const fragment = document.createDocumentFragment();

    if (channelsInGroup.length > 0) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'player-channel-list-group-header';
        groupHeader.textContent = escapeHtml(currentGroup);
        fragment.appendChild(groupHeader);

        channelsInGroup.forEach(channel => {
            fragment.appendChild(createPlayerChannelListItem(channel, windowId));
        });
    } else {
        const noChannelsMessage = document.createElement('p');
        noChannelsMessage.className = 'p-2 text-secondary text-center';
        noChannelsMessage.textContent = 'No hay canales en este grupo.';
        fragment.appendChild(noChannelsMessage);
    }

    listContentElement.appendChild(fragment);
    highlightCurrentChannelInList(windowId);
}

function createPlayerChannelListItem(channel, windowId) {
    const itemElement = document.createElement('div');
    itemElement.className = 'player-channel-list-item';
    itemElement.dataset.channelUrl = channel.url; 
    
    let logoSrc = channel['tvg-logo'];
    if (!logoSrc && typeof getEpgChannelIcon === 'function' && channel.effectiveEpgId) {
        logoSrc = getEpgChannelIcon(channel.effectiveEpgId);
    }
    
    let logoHtml;
    if (logoSrc) {
        logoHtml = `<img src="${escapeHtml(logoSrc)}" class="player-channel-list-logo" alt="${escapeHtml(channel.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="player-channel-list-logo-placeholder" style="display: none;"></div>`;
    } else {
        logoHtml = `<div class="player-channel-list-logo-placeholder"></div>`;
    }

    let epgText = 'EPG no disponible';
    let epgClass = 'no-epg';
    if (channel.effectiveEpgId && typeof getEpgDataForChannel === 'function') {
        const programs = getEpgDataForChannel(channel.effectiveEpgId);
        const now = new Date();
        const currentProgram = programs.find(p => now >= p.startDt && now < p.stopDt);
        if (currentProgram) {
            epgText = `Ahora: ${currentProgram.title}`;
            epgClass = '';
        }
    }
    
    itemElement.innerHTML = `
        ${logoHtml}
        <div class="player-channel-list-info">
            <span class="player-channel-list-name">${escapeHtml(channel.name)}</span>
            <span class="player-channel-list-epg ${epgClass}">${escapeHtml(epgText)}</span>
        </div>
    `;

    itemElement.addEventListener('click', () => {
        const targetChannel = channels.find(ch => ch.url === channel.url);
        if (targetChannel) {
            const instance = playerInstances[windowId];
            if (instance) {
                playChannelInShaka(targetChannel, windowId); 
                const titleEl = instance.container.querySelector('.player-window-title');
                if (titleEl) {
                    titleEl.textContent = targetChannel.name;
                    titleEl.title = targetChannel.name;
                }
                highlightCurrentChannelInList(windowId); 
            }
        }
    });
    return itemElement;
}

function highlightCurrentChannelInList(windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.channelListPanelElement || !instance.channel) return;

    const listContentElement = instance.channelListPanelElement.querySelector('.player-channel-list-content');
    if (!listContentElement) return;

    listContentElement.querySelectorAll('.player-channel-list-item.active').forEach(activeItem => {
        activeItem.classList.remove('active');
    });

    const currentChannelUrl = instance.channel.url;
    const currentItemInList = listContentElement.querySelector(`.player-channel-list-item[data-channel-url="${CSS.escape(currentChannelUrl)}"]`);
    
    if (currentItemInList) {
        currentItemInList.classList.add('active');
        
        requestAnimationFrame(() => {
            if (currentItemInList.offsetParent) { 
                currentItemInList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
}

function toggleEQPanel(windowId) {
    const instance = playerInstances[windowId];
    if (!instance || !instance.eqPanel) return;
    instance.eqPanel.classList.toggle('open');
}