function switchFilter(filterType) {
    if (currentFilter === filterType) return;
    currentFilter = filterType;
    currentPage = 1;

    $('#groupFilterSidebar').val("").trigger('change');

    if (userSettings.persistFilters) {
        userSettings.lastSelectedFilterTab = currentFilter;
        localStorage.setItem('zenithUserSettings', JSON.stringify(userSettings));
    }
    updateActiveFilterButton();
    filterAndRenderChannels();
}

function updateActiveFilterButton() {
    $('.filter-tab-btn').removeClass('active');
    if (currentFilter === 'all') $('#showAllChannels').addClass('active');
    else if (currentFilter === 'favorites') $('#showFavorites').addClass('active');
    else if (currentFilter === 'history') $('#showHistory').addClass('active');
}

function getFilteredChannels() {
    const search = $('#searchInput').val().toLowerCase().trim();
    const selectedGroup = $('#groupFilterSidebar').val() || "";

    let baseChannels;
    if (currentFilter === 'favorites') {
        baseChannels = favorites.map(url => channels.find(c => c.url === url)).filter(Boolean);
    } else if (currentFilter === 'history') {
        baseChannels = appHistory.map(url => channels.find(c => c.url === url)).filter(Boolean);
    } else {
        baseChannels = channels;
    }

    const filtered = baseChannels.filter(c =>
        c && typeof c.name === 'string' && typeof c.url === 'string' &&
        c.name.toLowerCase().includes(search) &&
        (selectedGroup === "" || c['group-title'] === selectedGroup)
    );
    return filtered;
}

function getPaginatedChannels() {
    const filtered = getFilteredChannels();
    const totalItems = filtered.length;
    const itemsPerPage = userSettings.channelsPerPage;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    currentPage = Math.min(Math.max(1, currentPage), totalPages === 0 ? 1 : totalPages);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginated = filtered.slice(startIndex, endIndex);
    return paginated;
}

function filterAndRenderChannels() {
    renderChannels();
    updatePaginationControls();
    updateGroupSelectors();
    checkIfChannelsExist();
    if (typeof updateEPGProgressBarOnCards === 'function') {
        updateEPGProgressBarOnCards();
    }
}

function renderChannels() {
    const grid = $('#channelGrid').empty();
    const channelsToShow = getPaginatedChannels();
    const noChannelsMessageEl = $('#noChannelsMessage');
    document.documentElement.style.setProperty('--card-logo-aspect-ratio', userSettings.cardLogoAspectRatio === 'auto' ? '16/9' : userSettings.cardLogoAspectRatio);
    $('#channelGridTitle').text("Canales Disponibles");

    if (channelsToShow.length > 0) {
        noChannelsMessageEl.hide();
        grid.show();
        const fragment = document.createDocumentFragment();
        channelsToShow.forEach(channel => {
            const isFavorite = favorites.includes(channel.url);
            const card = document.createElement('div');
            card.className = 'channel-card';
            if (userSettings.compactCardView) {
                card.classList.add('compact');
            }
            card.dataset.url = channel.url;

            let logoSrc = '';
            const epgIdForLogo = channel.effectiveEpgId || (channel['tvg-id'] || '').toLowerCase().trim();

            if (typeof getEpgChannelIcon === 'function' && getEpgChannelIcon(epgIdForLogo)) {
                logoSrc = getEpgChannelIcon(epgIdForLogo);
            } else if (channel['tvg-logo']) {
                logoSrc = channel['tvg-logo'];
            }

            let epgInfoHtml = '';
            let hasCurrentProgramForProgressBar = false;

            if (userSettings.cardShowEpg && channel.effectiveEpgId && typeof getEpgDataForChannel === 'function') {
                const programsForChannel = getEpgDataForChannel(channel.effectiveEpgId);
                const now = new Date();
                const currentProgram = programsForChannel.find(p => now >= p.startDt && now < p.stopDt);
                const nextProgramIndex = currentProgram ? programsForChannel.indexOf(currentProgram) + 1 : programsForChannel.findIndex(p => p.startDt > now);
                const nextProgram = (nextProgramIndex !== -1 && nextProgramIndex < programsForChannel.length) ? programsForChannel[nextProgramIndex] : null;

                if (currentProgram) {
                    hasCurrentProgramForProgressBar = true;
                    epgInfoHtml += `<div class="epg-current" title="${escapeHtml(currentProgram.title)}">${escapeHtml(currentProgram.title)}</div>`;
                }
                if (nextProgram && typeof formatEPGTime === 'function') {
                    epgInfoHtml += `<div class="epg-next" title="${escapeHtml(nextProgram.title)}">Sig: ${escapeHtml(nextProgram.title)} (${formatEPGTime(nextProgram.startDt)})</div>`;
                }
            }

            let progressBarHtml = '';
            if (userSettings.cardShowEpg && hasCurrentProgramForProgressBar) {
                progressBarHtml = `
                <div class="epg-progress-bar-container" style="display: none;">
                    <div class="epg-progress-bar"></div>
                </div>`;
            }

            const channelNumber = channel.attributes['ch-number'];
            const channelNumberHtml = userSettings.cardShowChannelNumber && channelNumber ?
                                      `<span class="channel-number" title="Número ${escapeHtml(channelNumber)}">${escapeHtml(channelNumber)}</span>` : '';

            card.innerHTML = `
            <div class="channel-logo-container">
                <div class="card-video-preview-container"></div>
                ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" class="channel-logo" alt="${escapeHtml(channel.name)}" loading="lazy">` : ''}
                <span class="epg-icon-placeholder"${logoSrc ? ' style="display: none;"' : ''}></span>
                ${channelNumberHtml}
            </div>
            <div class="channel-info">
                <h3 class="channel-name" title="${escapeHtml(channel.name)}">${escapeHtml(channel.name)}</h3>
                ${epgInfoHtml ? `<div class="channel-epg-info">${epgInfoHtml}${progressBarHtml}</div>` : ''}
                ${userSettings.cardShowGroup ? `<p class="channel-group" title="${escapeHtml(channel['group-title'] || 'Sin Grupo')}">${escapeHtml(channel['group-title'] || 'Sin Grupo')}</p>` : ''}
                ${userSettings.cardShowFavButton ? `<button class="favorite-btn ${isFavorite ? 'favorite' : ''}" data-url="${escapeHtml(channel.url)}" title="${isFavorite ? 'Quitar favorito' : 'Añadir favorito'}"></button>` : ''}
            </div>`;
            fragment.appendChild(card);
        });
        grid.append(fragment);
    } else {
        grid.hide();
        noChannelsMessageEl.show();
    }
}

function renderXtreamContent(items, title) {
    const grid = $('#channelGrid').empty();
    const noChannelsMessageEl = $('#noChannelsMessage');
    grid.show();
    noChannelsMessageEl.hide();
    $('#channelGridTitle').text(title);
    
    if (!items || items.length === 0) {
        noChannelsMessageEl.text("No se encontraron elementos para mostrar.").show();
        grid.hide();
        return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        
        if (item.season_number !== undefined) {
            card.dataset.seasonData = JSON.stringify(item);
        } else {
            card.dataset.episodeData = JSON.stringify(item);
        }
        
        card.innerHTML = `
            <div class="channel-logo-container">
                <img src="${escapeHtml(item['tvg-logo'] || 'icons/icon128.png')}" class="channel-logo" alt="${escapeHtml(item.name)}" loading="lazy">
            </div>
            <div class="channel-info">
                <h3 class="channel-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
                <p class="channel-group" title="${escapeHtml(item['group-title'] || '')}">${escapeHtml(item['group-title'] || '')}</p>
            </div>`;
        fragment.appendChild(card);
    });
    grid.append(fragment);
    $('#paginationControls').hide();
    checkIfChannelsExist();
}

function updateGroupSelectors() {
    const baseOrder = currentGroupOrder.filter(group => group && group.trim() !== '');

    let relevantChannels;
    if (currentFilter === 'favorites') {
        relevantChannels = channels.filter(c => favorites.includes(c.url));
    } else if (currentFilter === 'history') {
        relevantChannels = appHistory.map(url => channels.find(c => c.url === url)).filter(Boolean);
    } else {
        relevantChannels = channels;
    }

    const groupCounts = {};
    relevantChannels.forEach(c => {
        const group = c['group-title'] || '';
        groupCounts[group] = (groupCounts[group] || 0) + 1;
    });

    const availableGroupsRaw = relevantChannels.map(c => c['group-title'] || '');
    const uniqueSortedGroupsInView = getOrderedUniqueGroups(baseOrder, availableGroupsRaw);

    const currentSelectedGroup = $('#groupFilterSidebar').val();

    populateGroupFilterDropdown('#groupFilterSidebar', uniqueSortedGroupsInView, '📂 Todos los grupos', groupCounts, currentSelectedGroup);
    populateSidebarGroupList('#sidebarGroupList', uniqueSortedGroupsInView, groupCounts, currentSelectedGroup);
}

function getOrderedUniqueGroups(preferredOrder, availableGroups) {
    const availableSet = new Set(availableGroups);
    const ordered = preferredOrder.filter(group => availableSet.has(group));
    const unordered = Array.from(availableSet)
        .filter(group => !preferredOrder.includes(group))
        .sort((a, b) => {
            const aNorm = a === '' ? 'Sin Grupo' : a;
            const bNorm = b === '' ? 'Sin Grupo' : b;
            return aNorm.localeCompare(bNorm, undefined, { sensitivity: 'base' });
        });
    return [...new Set([...ordered, ...unordered])];
}

function populateGroupFilterDropdown(selectorId, groups, defaultOptionText, groupCounts = {}, valueToSelect) {
    const selector = $(selectorId);
    selector.empty().append(`<option value="">${escapeHtml(defaultOptionText)}</option>`);
    groups.forEach(group => {
        const count = groupCounts[group] || 0;
        const displayName = group === '' ? 'Sin Grupo' : group;
        selector.append(`<option value="${escapeHtml(group)}">${escapeHtml(displayName)} (${count})</option>`);
    });

    if (groups.includes(valueToSelect) || valueToSelect === "") {
        selector.val(valueToSelect);
    } else {
        selector.val("");
    }
}

function populateSidebarGroupList(listId, groups, groupCounts = {}, valueToSelect) {
    const list = $(listId).empty();
    const fragment = document.createDocumentFragment();

    const allGroupsItem = document.createElement('li');
    allGroupsItem.className = 'list-group-item';
    allGroupsItem.dataset.groupName = "";

    let totalChannelsInView = 0;
    if (currentFilter === 'favorites') {
        totalChannelsInView = favorites.map(url => channels.find(c => c.url === url)).filter(Boolean).length;
    } else if (currentFilter === 'history') {
        totalChannelsInView = appHistory.map(url => channels.find(c => c.url === url)).filter(Boolean).length;
    } else {
        totalChannelsInView = channels.length;
    }
    if (Object.keys(groupCounts).length > 0 && (currentFilter === 'all' || currentFilter === '')) {
        totalChannelsInView = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
    }

    allGroupsItem.textContent = `Todos los Grupos (${totalChannelsInView})`;
    if (valueToSelect === "") $(allGroupsItem).addClass('active');
    fragment.appendChild(allGroupsItem);

    groups.forEach(group => {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        item.dataset.groupName = group;
        const count = groupCounts[group] || 0;
        const displayName = group === '' ? 'Sin Grupo' : group;
        item.textContent = `${escapeHtml(displayName)} (${count})`;
        if (valueToSelect === group) $(item).addClass('active');
        fragment.appendChild(item);
    });
    list.append(fragment);
}

function updatePaginationControls() {
    const filtered = getFilteredChannels();
    const totalItems = filtered.length;
    const itemsPerPage = userSettings.channelsPerPage;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    currentPage = Math.min(Math.max(1, currentPage), totalPages === 0 ? 1 : totalPages);

    $('#pageInfo').text(`Pág ${currentPage} de ${totalPages} (${totalItems})`);
    $('#prevPage').prop('disabled', currentPage <= 1);
    $('#nextPage').prop('disabled', currentPage >= totalPages || totalPages === 0);
    $('#paginationControls').toggle(totalItems > itemsPerPage);
}

function changePage(newPage) {
    const filtered = getFilteredChannels();
    const itemsPerPage = userSettings.channelsPerPage;
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const targetPage = Math.min(Math.max(1, newPage), totalPages === 0 ? 1 : totalPages);

    if (targetPage !== currentPage) {
        currentPage = targetPage;
        renderChannels();
        updatePaginationControls();

        const mainContentEl = $('#main-content');
        const channelGridEl = $('#channelGrid');

        if (channelGridEl.length && mainContentEl.length && channelGridEl.is(":visible")) {
            const gridRect = channelGridEl[0].getBoundingClientRect();
            const mainContentRect = mainContentEl[0].getBoundingClientRect();

            let targetScrollPosition = mainContentEl.scrollTop() + gridRect.top - mainContentRect.top - (parseFloat(mainContentEl.css('padding-top')) || 0);
            targetScrollPosition = Math.max(0, targetScrollPosition);

            if (currentPage > 1 && (Math.abs(mainContentEl.scrollTop() - targetScrollPosition) > 20 || mainContentEl.scrollTop() > targetScrollPosition) ) {
                mainContentEl.animate({ scrollTop: targetScrollPosition }, 300);
            } else if (currentPage === 1 && mainContentEl.scrollTop() > 0) {
                mainContentEl.animate({ scrollTop: 0 }, 300);
            }
        }
    }
}

function checkIfChannelsExist() {
    const hasAnyChannelLoaded = channels.length > 0;
    const isMainView = currentView.type === 'main';
    const filteredChannelsCount = isMainView ? getFilteredChannels().length : currentView.data?.length || 0;
    const noChannelsMsg = $('#noChannelsMessage');
    const paginationControls = $('#paginationControls');
    const channelGrid = $('#channelGrid');
    const channelGridTitleContainer = $('#channelGridTitle').parent();
    const filterTabs = $('.filter-tabs-container');
    const downloadBtn = $('#downloadM3UBtnHeader');

    if (!hasAnyChannelLoaded) {
        noChannelsMsg.text(currentM3UContent ? `No se encontraron canales válidos en "${escapeHtml(currentM3UName)}".` : 'Carga una lista M3U (URL o archivo)...').show();
        channelGrid.hide();
        paginationControls.hide();
        channelGridTitleContainer.hide();
        filterTabs.hide();
        downloadBtn.prop('disabled', true).parent().addClass('disabled');
        $('#groupFilterSidebar').prop('disabled', true).val('');
        $('#sidebarGroupList').empty().append('<li class="list-group-item text-secondary">Carga una lista M3U</li>');
    } else {
        filterTabs.toggle(isMainView);
        downloadBtn.prop('disabled', false).parent().removeClass('disabled');
        $('#groupFilterSidebar').prop('disabled', !isMainView);

        if (filteredChannelsCount === 0) {
            let message = 'No hay canales que coincidan con los filtros/búsqueda.';
            if (isMainView) {
                if (currentFilter === 'favorites' && favorites.length === 0) message = 'No tienes canales favoritos. Haz clic en ★ en una tarjeta para añadir.';
                if (currentFilter === 'history' && appHistory.length === 0) message = 'El historial de reproducción está vacío.';
            } else {
                message = "No se encontraron episodios para esta serie.";
            }

            noChannelsMsg.text(message).show();
            channelGrid.hide();
            paginationControls.hide();
            channelGridTitleContainer.show();
        } else {
            noChannelsMsg.hide();
            channelGrid.show();
            channelGridTitleContainer.show();
        }
    }
}