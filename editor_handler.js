const editorHandler = (() => {
    let editorChannels = [];
    let selectedChannelId = null;
    let selectedRowIds = new Set();
    let currentGroupFilter = '';
    let currentSort = { column: null, direction: 'asc' };
    let sortableInstance = null;
    let groupOrder = [];

    const dom = {};

    function cacheDom() {
        const modal = document.getElementById('editorModal');
        if (!modal) return false;
        dom.modal = modal;
        dom.tableContainer = modal.querySelector('#editor-table-container');
        dom.tableBody = modal.querySelector('#editor-table-body');
        dom.selectAllCheckbox = modal.querySelector('#editor-select-all');
        dom.searchInput = modal.querySelector('#editor-search-input');
        dom.groupFilterSelect = modal.querySelector('#editor-group-filter');
        dom.fileNameDisplay = modal.querySelector('#file-name-display');
        dom.editorPanel = modal.querySelector('#editor-panel');
        dom.editorPlaceholder = modal.querySelector('#editor-placeholder');
        dom.editorFormContent = modal.querySelector('#editor-form-content');
        dom.editorChannelNameInput = modal.querySelector('#editor-channel-name');
        dom.editorChannelTvgIdInput = modal.querySelector('#editor-channel-tvg-id');
        dom.editorChannelChNumInput = modal.querySelector('#editor-channel-ch-num');
        dom.editorChannelLogoInput = modal.querySelector('#editor-channel-logo');
        dom.editorLogoPreview = modal.querySelector('#editor-logo-preview');
        dom.editorChannelUrlInput = modal.querySelector('#editor-channel-url');
        dom.editorChannelGroupInput = modal.querySelector('#editor-channel-group');
        dom.groupSuggestionsDatalist = modal.querySelector('#group-suggestions');
        dom.editorFavCheckbox = modal.querySelector('#editor-fav-channel');
        dom.editorHideChannelCheckbox = modal.querySelector('#editor-hide-channel');
        dom.editorKodiLicenseTypeInput = modal.querySelector('#editor-kodi-license-type');
        dom.editorKodiLicenseKeyInput = modal.querySelector('#editor-kodi-license-key');
        dom.editorKodiStreamHeadersInput = modal.querySelector('#editor-kodi-stream-headers');
        dom.editorVlcUserAgentInput = modal.querySelector('#editor-vlc-user-agent');
        dom.editorSaveBtn = modal.querySelector('#editor-save-btn');
        dom.editorPlayBtn = modal.querySelector('#editor-play-btn');
        dom.editorDeleteBtn = modal.querySelector('#editor-delete-btn');
        dom.closeEditorBtn = modal.querySelector('#close-editor-btn');
        dom.multiEditBtn = modal.querySelector('#multi-edit-btn');
        dom.deleteSelectedBtn = modal.querySelector('#delete-selected-btn');
        dom.clearSelectionBtn = modal.querySelector('#clear-selection-btn');
        
        const multiEditModal = document.getElementById('multiEditModal');
        dom.multiEditModal = multiEditModal;
        dom.multiEditChannelCount = multiEditModal.querySelector('#multiEditChannelCount');
        dom.multiEditEnableGroup = multiEditModal.querySelector('#multiEditEnableGroup');
        dom.multiEditGroupInput = multiEditModal.querySelector('#multiEditGroupInput');
        dom.multiEditEnableFavorite = multiEditModal.querySelector('#multiEditEnableFavorite');
        dom.multiEditFavoriteSelect = multiEditModal.querySelector('#multiEditFavoriteSelect');
        dom.multiEditEnableHidden = multiEditModal.querySelector('#multiEditEnableHidden');
        dom.multiEditHiddenSelect = multiEditModal.querySelector('#multiEditHiddenSelect');
        dom.multiEditEnableUserAgent = multiEditModal.querySelector('#multiEditEnableUserAgent');
        dom.multiEditUserAgentInput = multiEditModal.querySelector('#multiEditUserAgentInput');
        dom.multiEditEnableStreamHeaders = multiEditModal.querySelector('#multiEditEnableStreamHeaders');
        dom.multiEditStreamHeadersInput = multiEditModal.querySelector('#multiEditStreamHeadersInput');
        dom.multiEditStreamHeadersMode = multiEditModal.querySelector('#multiEditStreamHeadersMode');
        dom.applyMultiEditBtn = multiEditModal.querySelector('#applyMultiEditBtn');

        return true;
    }

    function init(channelsData, fileName) {
        if (!cacheDom()) {
            console.error("Editor DOM not found. Cannot initialize.");
            return;
        }
        
        editorChannels = JSON.parse(JSON.stringify(channelsData));
        editorChannels.forEach((ch, idx) => {
            if (ch) {
                ch.editorId = `editor-ch-${idx}-${Date.now()}`;
            }
        });
        
        dom.fileNameDisplay.textContent = fileName || "Lista Actual";
        dom.fileNameDisplay.classList.add('loaded');
        
        updateGroupOrder();
        
        renderTable();
        bindEvents();
        showEditorPlaceholder();
        clearMultiSelection();
    }
    
    function bindEvents() {
        if (dom.editorSaveBtn.dataset.initialized) return;

        dom.editorSaveBtn.addEventListener('click', handleEditorSave);
        dom.editorPlayBtn.addEventListener('click', handleEditorPlay);
        dom.editorDeleteBtn.addEventListener('click', handleEditorDelete);
        dom.closeEditorBtn.addEventListener('click', showEditorPlaceholder);

        dom.tableBody.addEventListener('click', handleTableBodyClick);
        dom.selectAllCheckbox.addEventListener('change', handleSelectAllVisible);
        dom.tableBody.addEventListener('change', handleRowCheckboxChange);
        
        dom.searchInput.addEventListener('input', debounce(() => { currentSort.column = null; renderTable(); }, 300));
        dom.groupFilterSelect.addEventListener('change', (e) => { currentGroupFilter = e.target.value; renderTable(); });
        
        dom.deleteSelectedBtn.addEventListener('click', deleteSelectedChannels);
        dom.clearSelectionBtn.addEventListener('click', clearMultiSelection);
        dom.multiEditBtn.addEventListener('click', openMultiEditModal);

        dom.modal.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.sort));
        });
        
        bindMultiEditEvents();
        dom.editorSaveBtn.dataset.initialized = 'true';
    }
    
    function bindMultiEditEvents() {
        dom.applyMultiEditBtn.addEventListener('click', handleApplyMultiEdit);
        const multiEditToggles = [
            { check: dom.multiEditEnableGroup, input: dom.multiEditGroupInput },
            { check: dom.multiEditEnableFavorite, input: dom.multiEditFavoriteSelect },
            { check: dom.multiEditEnableHidden, input: dom.multiEditHiddenSelect },
            { check: dom.multiEditEnableUserAgent, input: dom.multiEditUserAgentInput },
            { check: dom.multiEditEnableStreamHeaders, input: dom.multiEditStreamHeadersInput, extra: dom.multiEditStreamHeadersMode },
        ];
        multiEditToggles.forEach(({check, input, extra}) => {
            check.addEventListener('change', (e) => {
                input.disabled = !e.target.checked;
                if (extra) extra.disabled = !e.target.checked;
            });
        });
    }

    function updateGroupOrder() {
        const currentGroups = [...new Set(editorChannels.filter(ch => ch).map(ch => ch['group-title'] || ''))];
        const newGroupOrder = (groupOrder.length > 0 ? groupOrder : []).filter(group => currentGroups.includes(group));
        currentGroups.forEach(group => { if (!newGroupOrder.includes(group)) newGroupOrder.push(group); });
        groupOrder = newGroupOrder;
        updateGroupFilter();
        updateGroupSuggestions();
    }

    function renderTable() {
        const fragment = document.createDocumentFragment();
        dom.tableBody.innerHTML = '';
        const searchTerm = dom.searchInput.value.toLowerCase().trim();
    
        if (currentGroupFilter === '' && !searchTerm && !currentSort.column) {
            const groupCounts = editorChannels.reduce((acc, channel) => {
                if (!channel || channel.attributes?.hidden === 'true') return acc;
                const groupKey = channel['group-title'] || '';
                acc[groupKey] = (acc[groupKey] || 0) + 1;
                return acc;
            }, {});
    
            groupOrder.forEach(groupKey => {
                const count = groupCounts[groupKey] || 0;
                if (count > 0) {
                    fragment.appendChild(createGroupHeaderRow(groupKey, count));
                }
            });
        } else {
            const filteredChannels = getFilteredAndSortedChannels();
            if (currentGroupFilter) {
                 if (filteredChannels.length > 0) {
                    const groupKey = filteredChannels[0]['group-title'] || '';
                    fragment.appendChild(createGroupHeaderRow(groupKey, filteredChannels.length));
                    filteredChannels.forEach(channel => fragment.appendChild(createRow(channel)));
                }
            } else {
                 filteredChannels.forEach(channel => fragment.appendChild(createRow(channel)));
            }
        }
        
        dom.tableBody.appendChild(fragment);
        updateSortableForCurrentView();
        updateSelectAllCheckboxState();
        updateSortIcons();
    }
    
    function getFilteredAndSortedChannels() {
        const searchTerm = dom.searchInput.value.toLowerCase().trim();
        let channelsToProcess = editorChannels.filter(ch => {
            if (!ch || ch.attributes?.hidden === 'true') {
                return false;
            }
            if (currentGroupFilter && (ch['group-title'] || '') !== currentGroupFilter) {
                return false;
            }
            if (searchTerm) {
                if (!(
                    ch.name?.toLowerCase().includes(searchTerm) ||
                    ch.url?.toLowerCase().includes(searchTerm) ||
                    ch['group-title']?.toLowerCase().includes(searchTerm) ||
                    ch['tvg-id']?.toLowerCase().includes(searchTerm)
                )) {
                    return false;
                }
            }
            return true;
        });

        if (currentSort.column) {
            channelsToProcess.sort((a, b) => {
                let valA, valB;
                switch (currentSort.column) {
                    case 'ch-number':
                        valA = parseInt(a.attributes?.['ch-number'], 10) || Infinity;
                        valB = parseInt(b.attributes?.['ch-number'], 10) || Infinity;
                        break;
                    default:
                        valA = (a[currentSort.column] || '').toLowerCase();
                        valB = (b[currentSort.column] || '').toLowerCase();
                        break;
                }
                let comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
                return comparison * (currentSort.direction === 'asc' ? 1 : -1);
            });
        }
        
        return channelsToProcess;
    }

    function createRow(channel) {
        const row = document.createElement('tr');
        row.dataset.editorId = channel.editorId;
        row.dataset.groupParent = channel['group-title'] || '';
        row.className = `channel-row ${channel.editorId === selectedChannelId ? 'selected-row' : ''}`;
        
        const logoHtml = channel['tvg-logo'] ? `<img src="${escapeHtml(channel['tvg-logo'])}" class="logo-preview" loading="lazy" onerror="this.style.opacity=0">` : `<span>-</span>`;
        const nameHtml = `${channel.favorite ? '<i class="fas fa-star" style="color:orange;font-size:0.8em;margin-right:4px;"></i>' : ''}${escapeHtml(channel.name || '')}`;

        row.innerHTML = `
            <td class="checkbox-cell"><input type="checkbox" class="row-checkbox" data-editor-id="${channel.editorId}" ${selectedRowIds.has(channel.editorId) ? 'checked' : ''}></td>
            <td class="handle-cell"><i class="fas fa-grip-lines drag-handle"></i></td>
            <td class="logo-cell">${logoHtml}</td>
            <td class="name-cell" title="${escapeHtml(channel.name || '')}">${nameHtml}</td>
            <td class="url-cell" title="${escapeHtml(channel.url || '')}">${escapeHtml(channel.url || '')}</td>
            <td class="epg-cell" title="${escapeHtml(channel['tvg-id'] || '')}">${escapeHtml(channel['tvg-id'] || '-')}</td>
            <td class="ch-num-cell">${escapeHtml(channel.attributes?.['ch-number'] || '-')}</td>
            <td class="actions-cell">
                <button class="btn-action play" title="Probar Canal"><i class="fas fa-play"></i></button>
            </td>
        `;
        return row;
    }
    
    function createGroupHeaderRow(group, count) {
        const headerRow = document.createElement('tr');
        headerRow.className = `group-header-row`;
        headerRow.dataset.group = group;
        const displayName = group === '' ? '(Sin Grupo)' : group;
        headerRow.innerHTML = `
            <td class="checkbox-cell"></td>
            <td class="handle-cell"><i class="fas fa-grip-lines drag-handle"></i></td>
            <td colspan="5">
                <span class="group-name-text">${escapeHtml(displayName)}</span> 
                <span class="group-channel-count">(${count})</span>
                <button class="btn-action rename" title="Renombrar Grupo"><i class="fas fa-pencil-alt"></i></button>
            </td>
            <td class="actions-cell"></td>
        `;
        return headerRow;
    }
    
    function handleTableBodyClick(e) {
        const btn = e.target.closest('.btn-action');
        if (btn) {
            const row = e.target.closest('tr');
            if (btn.classList.contains('play')) {
                handleEditorPlay(row.dataset.editorId);
            } else if (btn.classList.contains('rename')) {
                handleRenameGroup(row.dataset.group);
            }
            return;
        }

        if (e.target.closest('.row-checkbox, .drag-handle, .group-header-row')) return;
        
        const row = e.target.closest('tr.channel-row');
        if (row && row.dataset.editorId) {
            displayChannelInEditor(row.dataset.editorId);
        }
    }

    function displayChannelInEditor(editorId) {
        const channel = editorChannels.find(ch => ch && ch.editorId === editorId);
        if (!channel) { showEditorPlaceholder(); return; }
        
        selectedChannelId = editorId;
        
        dom.editorFormContent.classList.remove('hidden');
        dom.editorPlaceholder.classList.add('hidden');
        dom.modal.classList.add('editor-visible');

        if (!dom.editorChannelIdInput) {
            dom.editorChannelIdInput = document.createElement('input');
            dom.editorChannelIdInput.type = 'hidden';
            dom.editorChannelIdInput.id = 'editor-channel-id';
            dom.editorFormContent.insertBefore(dom.editorChannelIdInput, dom.editorFormContent.firstChild);
        }

        dom.editorChannelIdInput.value = editorId;
        dom.editorChannelNameInput.value = channel.name || '';
        dom.editorChannelTvgIdInput.value = channel['tvg-id'] || '';
        dom.editorChannelChNumInput.value = channel.attributes?.['ch-number'] || '';
        dom.editorChannelLogoInput.value = channel['tvg-logo'] || '';
        dom.editorLogoPreview.src = channel['tvg-logo'] || '';
        dom.editorLogoPreview.style.display = channel['tvg-logo'] ? 'block' : 'none';
        dom.editorChannelUrlInput.value = channel.url || '';
        dom.editorChannelGroupInput.value = channel['group-title'] || '';
        dom.editorFavCheckbox.checked = channel.favorite || false;
        dom.editorHideChannelCheckbox.checked = channel.attributes?.hidden === 'true';
        
        const kodiProps = channel.kodiProps || {};
        dom.editorKodiLicenseTypeInput.value = kodiProps['inputstream.adaptive.license_type'] || '';
        dom.editorKodiLicenseKeyInput.value = kodiProps['inputstream.adaptive.license_key'] || '';
        dom.editorKodiStreamHeadersInput.value = kodiProps['inputstream.adaptive.stream_headers'] || '';
        
        dom.editorVlcUserAgentInput.value = (channel.vlcOptions || {})['http-user-agent'] || '';
        
        renderTable();
    }

    function showEditorPlaceholder() {
        selectedChannelId = null;
        dom.editorFormContent.classList.add('hidden');
        dom.editorPlaceholder.classList.remove('hidden');
        dom.modal.classList.remove('editor-visible');
        if (dom.tableBody) dom.tableBody.querySelectorAll('.selected-row').forEach(r => r.classList.remove('selected-row'));
    }

    function handleEditorSave() {
        if (!selectedChannelId) return;
        const index = editorChannels.findIndex(ch => ch && ch.editorId === selectedChannelId);
        if (index === -1) return;
        
        const channelData = editorChannels[index];
        const oldGroup = channelData['group-title'];

        channelData.name = dom.editorChannelNameInput.value.trim();
        channelData.url = dom.editorChannelUrlInput.value.trim();
        channelData['group-title'] = dom.editorChannelGroupInput.value.trim();
        channelData['tvg-logo'] = dom.editorChannelLogoInput.value.trim();
        channelData['tvg-id'] = dom.editorChannelTvgIdInput.value.trim();
        
        if (!channelData.attributes) channelData.attributes = {};
        channelData.attributes['ch-number'] = dom.editorChannelChNumInput.value.trim();
        channelData.favorite = dom.editorFavCheckbox.checked;
        channelData.attributes['hidden'] = dom.editorHideChannelCheckbox.checked ? 'true' : 'false';
        
        channelData.kodiProps = channelData.kodiProps || {};
        channelData.kodiProps['inputstream.adaptive.license_type'] = dom.editorKodiLicenseTypeInput.value.trim();
        channelData.kodiProps['inputstream.adaptive.license_key'] = dom.editorKodiLicenseKeyInput.value.trim();
        channelData.kodiProps['inputstream.adaptive.stream_headers'] = dom.editorKodiStreamHeadersInput.value.trim();
        
        channelData.vlcOptions = channelData.vlcOptions || {};
        channelData.vlcOptions['http-user-agent'] = dom.editorVlcUserAgentInput.value.trim();
        
        if (oldGroup !== channelData['group-title']) {
            updateGroupOrder();
        }
        renderTable();
        showToast('Canal guardado.', 'success');
    }

    function handleEditorPlay(id) {
        const editorId = id || selectedChannelId;
        if (!editorId) return;
        const channel = editorChannels.find(ch => ch.editorId === editorId);
        if (channel && typeof createPlayerWindow === 'function') {
            createPlayerWindow(channel);
        }
    }

    function handleEditorDelete() {
        if(!selectedChannelId) return;
        const index = editorChannels.findIndex(ch => ch && ch.editorId === selectedChannelId);
        if (index > -1) {
            editorChannels.splice(index, 1);
            showEditorPlaceholder();
            renderTable();
        }
    }
    
    function deleteSelectedChannels() {
        if (selectedRowIds.size === 0) return;
        editorChannels = editorChannels.filter(ch => !selectedRowIds.has(ch.editorId));
        selectedRowIds.clear();
        showEditorPlaceholder();
        renderTable();
        updateGroupOrder();
    }

    function handleRenameGroup(oldGroupName) {
        const newGroupName = prompt(`Renombrar grupo "${escapeHtml(oldGroupName || '(Sin Grupo)')}":`, oldGroupName);
        if (newGroupName === null || newGroupName === oldGroupName) return;

        editorChannels.forEach(ch => {
            if ((ch['group-title'] || '') === oldGroupName) {
                ch['group-title'] = newGroupName;
            }
        });
        
        const groupIndex = groupOrder.indexOf(oldGroupName);
        if (groupIndex > -1) {
            groupOrder[groupIndex] = newGroupName;
        }

        updateGroupOrder();
        renderTable();
        showToast('Grupo renombrado.', 'success');
    }

    function updateGroupFilter() {
        const currentFilterValue = dom.groupFilterSelect.value;
        dom.groupFilterSelect.innerHTML = '<option value="">Todos los Grupos</option>';
        groupOrder.forEach(group => {
            const displayName = group === '' ? '(Sin Grupo)' : group;
            dom.groupFilterSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(group)}">${escapeHtml(displayName)}</option>`);
        });
        dom.groupFilterSelect.value = currentFilterValue;
    }
    
    function updateSortableForCurrentView() {
        if (sortableInstance) {
            sortableInstance.destroy();
        }

        sortableInstance = new Sortable(dom.tableBody, {
            animation: 150,
            handle: '.drag-handle',
            draggable: currentGroupFilter === '' ? '.group-header-row' : '.channel-row',
            forceFallback: true,
            ghostClass: 'sortable-ghost',
            fallbackClass: 'sortable-fallback',
            scroll: true, 
            scrollSensitivity: 100,
            scrollSpeed: 15,
            onStart: () => {
                document.body.classList.add('editor-is-dragging');
            },
            onEnd: (evt) => {
                document.body.classList.remove('editor-is-dragging');
                const { oldIndex, newIndex, item } = evt;

                if (oldIndex === newIndex) return;

                if (item.classList.contains('group-header-row')) {
                    const [movedGroup] = groupOrder.splice(oldIndex, 1);
                    groupOrder.splice(newIndex, 0, movedGroup);
                    renderTable(); // Re-render for group order changes
                } 
                else if (item.classList.contains('channel-row') && currentGroupFilter !== '') {
                    const movedItemId = item.dataset.editorId;
                    const fromIndex = editorChannels.findIndex(ch => ch.editorId === movedItemId);
                    const [movedItem] = editorChannels.splice(fromIndex, 1);
                    
                    const allVisibleIdsInOrder = Array.from(dom.tableBody.querySelectorAll('.channel-row')).map(row => row.dataset.editorId);
                    const toVisibleIndex = allVisibleIdsInOrder.indexOf(movedItemId);

                    let targetIndexInFullArray = -1;
                    if (toVisibleIndex === 0) {
                        const firstVisibleChannelId = allVisibleIdsInOrder[1];
                        targetIndexInFullArray = editorChannels.findIndex(ch => ch.editorId === firstVisibleChannelId);
                    } else {
                        const previousVisibleChannelId = allVisibleIdsInOrder[toVisibleIndex -1];
                        targetIndexInFullArray = editorChannels.findIndex(ch => ch.editorId === previousVisibleChannelId) + 1;
                    }

                    editorChannels.splice(targetIndexInFullArray, 0, movedItem);
                    
                    // No re-render, just move the element in DOM which Sortable does automatically
                }

                currentSort.column = null;
            }
        });
    }

    function handleSelectAllVisible(e) {
        const isChecked = e.target.checked;
        dom.tableBody.querySelectorAll('tr:not(.hidden) .row-checkbox').forEach(cb => {
            const editorId = cb.dataset.editorId;
            if (isChecked) selectedRowIds.add(editorId); else selectedRowIds.delete(editorId);
            cb.checked = isChecked;
        });
        updateMultiEditButtonState();
    }
    
    function handleRowCheckboxChange(e) {
        if (!e.target.classList.contains('row-checkbox')) return;
        const editorId = e.target.dataset.editorId;
        if (e.target.checked) selectedRowIds.add(editorId); else selectedRowIds.delete(editorId);
        updateSelectAllCheckboxState();
        updateMultiEditButtonState();
    }
    
    function updateSelectAllCheckboxState() {
        const visibleCheckboxes = Array.from(dom.tableBody.querySelectorAll('tr:not(.hidden) .row-checkbox'));
        if (visibleCheckboxes.length === 0) {
            dom.selectAllCheckbox.checked = false; dom.selectAllCheckbox.indeterminate = false; return;
        }
        const numSelectedVisible = visibleCheckboxes.filter(cb => cb.checked).length;
        dom.selectAllCheckbox.checked = numSelectedVisible > 0 && numSelectedVisible === visibleCheckboxes.length;
        dom.selectAllCheckbox.indeterminate = numSelectedVisible > 0 && numSelectedVisible < visibleCheckboxes.length;
    }

    function updateMultiEditButtonState() {
        const hasSelection = selectedRowIds.size > 0;
        dom.multiEditBtn.disabled = !hasSelection;
        dom.deleteSelectedBtn.disabled = !hasSelection;
    }

    function clearMultiSelection() {
        selectedRowIds.clear();
        if (dom.tableBody) {
             dom.tableBody.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
        }
        updateSelectAllCheckboxState();
        updateMultiEditButtonState();
    }
    
    function showToast(message, type = 'info', duration = 3000) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type, duration);
        }
    }
    
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    function updateGroupSuggestions() {
        if (!dom.groupSuggestionsDatalist) return;
        dom.groupSuggestionsDatalist.innerHTML = '';
        groupOrder.forEach(group => {
            if (group) {
                dom.groupSuggestionsDatalist.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(group)}"></option>`);
            }
        });
    }

    function handleSort(column) {
         if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        renderTable();
    }

    function updateSortIcons() {
        dom.modal.querySelectorAll('th.sortable i').forEach(icon => icon.className = 'fas fa-sort');
        if (currentSort.column) {
            const th = dom.modal.querySelector(`th[data-sort="${currentSort.column}"]`);
            if (th) th.querySelector('i').className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'}`;
        }
    }
    
    function openMultiEditModal() {
        dom.multiEditChannelCount.textContent = selectedRowIds.size;
        const modal = new bootstrap.Modal(dom.multiEditModal);
        modal.show();
    }

    function handleApplyMultiEdit() {
        const changes = {};
        if (dom.multiEditEnableGroup.checked) changes.group = dom.multiEditGroupInput.value.trim();
        if (dom.multiEditEnableFavorite.checked) changes.favorite = dom.multiEditFavoriteSelect.value;
        if (dom.multiEditEnableHidden.checked) changes.hidden = dom.multiEditHiddenSelect.value;
        if (dom.multiEditEnableUserAgent.checked) changes.userAgent = dom.multiEditUserAgentInput.value.trim();
        if (dom.multiEditEnableStreamHeaders.checked) {
            changes.streamHeaders = dom.multiEditStreamHeadersInput.value.trim();
            changes.streamHeadersMode = dom.multiEditStreamHeadersMode.value;
        }

        selectedRowIds.forEach(id => {
            const channel = editorChannels.find(ch => ch.editorId === id);
            if (!channel) return;

            if (changes.group !== undefined) channel['group-title'] = changes.group;
            if (changes.favorite !== undefined) channel.favorite = changes.favorite === 'add';
            if (changes.hidden !== undefined) {
                if (!channel.attributes) channel.attributes = {};
                channel.attributes.hidden = changes.hidden === 'hide' ? 'true' : 'false';
            }
            if (changes.userAgent !== undefined) {
                if (!channel.vlcOptions) channel.vlcOptions = {};
                channel.vlcOptions['http-user-agent'] = changes.userAgent;
            }
            if (changes.streamHeaders !== undefined) {
                if (!channel.kodiProps) channel.kodiProps = {};
                if (changes.streamHeadersMode === 'replace' || !channel.kodiProps['inputstream.adaptive.stream_headers']) {
                    channel.kodiProps['inputstream.adaptive.stream_headers'] = changes.streamHeaders;
                } else {
                    const existingHeaders = new Map(channel.kodiProps['inputstream.adaptive.stream_headers'].split('|').map(h => { const p = h.split('='); return [p[0], p.slice(1).join('=')]; }));
                    changes.streamHeaders.split('|').forEach(h => { const p = h.split('='); if(p[0]) existingHeaders.set(p[0], p.slice(1).join('=')); });
                    channel.kodiProps['inputstream.adaptive.stream_headers'] = Array.from(existingHeaders).map(([k,v]) => `${k}=${v}`).join('|');
                }
            }
        });

        updateGroupOrder();
        renderTable();
        showToast(`${selectedRowIds.size} canales actualizados.`, 'success');
        const modal = bootstrap.Modal.getInstance(dom.multiEditModal);
        modal.hide();
    }

    function getFinalData() {
        const groupIndexMap = new Map(groupOrder.map((group, index) => [group, index]));
        
        const channelsByGroup = {};
        editorChannels.forEach(ch => {
            const group = ch['group-title'] || '';
            if (!channelsByGroup[group]) channelsByGroup[group] = [];
            channelsByGroup[group].push(ch);
        });

        const finalOrderedChannels = [];
        groupOrder.forEach(group => {
            if (channelsByGroup[group]) {
                finalOrderedChannels.push(...channelsByGroup[group]);
            }
        });
        
        const remainingChannels = editorChannels.filter(ch => !groupIndexMap.has(ch['group-title'] || ''));
        finalOrderedChannels.push(...remainingChannels);

        return {
            channels: finalOrderedChannels,
            groupOrder: groupOrder
        };
    }

    return {
        init: init,
        getFinalData: getFinalData
    };
})();