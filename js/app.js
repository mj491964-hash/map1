/**
 * App - Application Entry Point & State Coordinator
 * 실시간 상점 검색 및 단독/필터링 표시 기능 포함
 */
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');

  try {
    // 1. Initialize Map Manager
    const mapManager = new MapManager('map');

    // 2. Load Store Data (Hybrid: window.STORES_DATA or fetch('data/stores.json'))
    let stores = [];
    if (window.STORES_DATA && Array.isArray(window.STORES_DATA)) {
      stores = window.STORES_DATA;
    } else {
      if (loadingText) loadingText.textContent = '데이터 파일(stores.json) 로딩 중...';
      const res = await fetch('data/stores.json');
      if (!res.ok) throw new Error(`데이터 로드 실패: ${res.statusText}`);
      stores = await res.json();
    }

    if (loadingText) loadingText.textContent = `${stores.length.toLocaleString()}개 상점 마커 렌더링 중...`;

    // 3. Render Store Statistics in Header
    updateStatsDisplay(stores);

    // 4. Render Markers into Map
    mapManager.loadStores(stores);

    // 5. Setup Floating Controls & Realtime Search
    setupEventListeners(mapManager);
    setupSearch(mapManager, stores);

    // 6. Dismiss Loading Overlay
    setTimeout(() => {
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
      }
    }, 400);

  } catch (err) {
    console.error('App initialization error:', err);
    if (loadingText) {
      loadingText.textContent = `초기화 오류: ${err.message}`;
      loadingText.style.color = '#ef4444';
    }
  }
});

/**
 * Calculate and display summary statistics in header
 */
function updateStatsDisplay(stores) {
  const totalCountEl = document.getElementById('stat-total-count');
  const martCountEl = document.getElementById('stat-mart-count');
  const deptCountEl = document.getElementById('stat-dept-count');
  const gymCountEl = document.getElementById('stat-gym-count');
  const cvsCountEl = document.getElementById('stat-cvs-count');

  let mart = 0, dept = 0, gym = 0, cvs = 0;
  for (let i = 0; i < stores.length; i++) {
    switch (stores[i].category) {
      case 'mart': mart++; break;
      case 'department': dept++; break;
      case 'gym': gym++; break;
      case 'cvs': cvs++; break;
    }
  }

  if (totalCountEl) totalCountEl.textContent = stores.length.toLocaleString();
  if (martCountEl) martCountEl.textContent = mart.toLocaleString();
  if (deptCountEl) deptCountEl.textContent = dept.toLocaleString();
  if (gymCountEl) gymCountEl.textContent = gym.toLocaleString();
  if (cvsCountEl) cvsCountEl.textContent = cvs.toLocaleString();
}

/**
 * Bind interactive controls to MapManager actions
 */
function setupEventListeners(mapManager) {
  // Hotspot Heatmap Mode Toggle
  const hotspotBtn = document.getElementById('hotspot-toggle-btn');
  if (hotspotBtn) {
    hotspotBtn.addEventListener('click', () => {
      const isActive = mapManager.toggleHotspotMode();
      hotspotBtn.classList.toggle('active', isActive);
      const textSpan = hotspotBtn.querySelector('.btn-label');
      if (textSpan) {
        textSpan.textContent = isActive ? '핫스팟 모드 켜짐' : '밀집도(핫스팟) 보기';
      }
    });
  }

  // Reset View to Busan
  const resetBtn = document.getElementById('btn-reset-view');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      mapManager.resetView();
    });
  }

  // Locate User GPS
  const locateBtn = document.getElementById('btn-locate-user');
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      mapManager.locateUser();
    });
  }

  // Tile Layer Switcher
  const layerButtons = document.querySelectorAll('.layer-btn');
  layerButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const targetLayer = e.currentTarget.dataset.layer;
      layerButtons.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      mapManager.switchTileLayer(targetLayer);
    });
  });
}

/**
 * Search Engine - Realtime Autocomplete & Exact Store Filtering
 * "해당 상점을 검색하면 해당 상점만 확인할 수 있는 기능"
 */
function setupSearch(mapManager, allStores) {
  const searchInput = document.getElementById('store-search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('search-results-dropdown');
  if (!searchInput || !clearBtn || !dropdown) return;

  let debounceTimer = null;

  // Real-time input listener with debouncing
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query) {
      clearBtn.classList.add('hidden');
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      // Reset map to all stores
      mapManager.loadStores(allStores);
      updateStatsDisplay(allStores);
      return;
    }

    clearBtn.classList.remove('hidden');

    debounceTimer = setTimeout(() => {
      const filtered = filterStores(allStores, query);
      renderDropdown(filtered, query);
    }, 160);
  });

  // Handle Enter key for direct search submission
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (!query) return;

      const filtered = filterStores(allStores, query);
      dropdown.classList.add('hidden');

      if (filtered.length > 0) {
        // 해당 상점들만 지도에 로드하여 확인
        mapManager.loadStores(filtered);
        mapManager.fitToStores(filtered);
        updateStatsDisplay(filtered);

        if (filtered.length === 1) {
          mapManager.focusStore(filtered[0].id);
        }
      } else {
        alert(`'${query}'에 대한 검색 결과가 없습니다.`);
      }
    }
  });

  // Clear Button click listener
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    // Restore all stores
    mapManager.loadStores(allStores);
    updateStatsDisplay(allStores);
    mapManager.resetView();
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Re-open dropdown if input has value on focus
  searchInput.addEventListener('focus', () => {
    const query = searchInput.value.trim();
    if (query) {
      const filtered = filterStores(allStores, query);
      renderDropdown(filtered, query);
    }
  });

  /**
   * Filter store array based on query
   */
  function filterStores(stores, query) {
    const q = query.toLowerCase();
    return stores.filter((s) => {
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.branch && s.branch.toLowerCase().includes(q)) ||
        (s.roadAddress && s.roadAddress.toLowerCase().includes(q)) ||
        (s.gu && s.gu.toLowerCase().includes(q)) ||
        (s.dong && s.dong.toLowerCase().includes(q)) ||
        (s.brand && s.brand.toLowerCase().includes(q)) ||
        (s.subCategoryName && s.subCategoryName.toLowerCase().includes(q))
      );
    });
  }

  /**
   * Render Search Results Dropdown List
   */
  function renderDropdown(filtered, query) {
    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div class="search-no-result">
          '${escapeHtml(query)}' 검색 결과가 없습니다.
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    const displayCount = Math.min(filtered.length, 12);
    const topStores = filtered.slice(0, displayCount);

    let html = `
      <div class="search-dropdown-header">
        <span>검색 결과 ${filtered.length.toLocaleString()}건 중 상위 ${displayCount}건</span>
        <span style="color:#38bdf8;">엔터(Enter): 전체 ${filtered.length.toLocaleString()}건 보기</span>
      </div>
    `;

    for (let i = 0; i < topStores.length; i++) {
      const s = topStores[i];
      const branchHtml = s.branch ? `<span class="search-item-branch">${escapeHtml(s.branch)}</span>` : '';
      const brandHtml = s.brand ? `<span class="popup-brand-badge" style="font-size:0.65rem;">${escapeHtml(s.brand)}</span>` : '';
      
      html += `
        <div class="search-item" data-store-id="${s.id}">
          <div class="search-item-top">
            <div class="search-item-title">
              <span>${highlightMatch(s.name, query)}</span>
              ${branchHtml}
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <span class="popup-category-badge ${s.category}" style="font-size:0.62rem;padding:1px 6px;">${s.categoryLabel}</span>
              ${brandHtml}
            </div>
          </div>
          <div class="search-item-address">
            📍 ${s.roadAddress || (s.gu + ' ' + (s.dong || ''))} ${s.buildingName ? `(${s.buildingName})` : ''}
          </div>
        </div>
      `;
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    // Bind click events on dropdown items
    const items = dropdown.querySelectorAll('.search-item');
    items.forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        const storeId = e.currentTarget.dataset.storeId;
        const selectedStore = allStores.find((s) => s.id === storeId);
        if (!selectedStore) return;

        searchInput.value = selectedStore.name + (selectedStore.branch ? ` ${selectedStore.branch}` : '');
        dropdown.classList.add('hidden');

        // 🔥 핵심: 검색한 해당 상점만 지도에 단독 표시
        mapManager.loadStores([selectedStore]);
        updateStatsDisplay([selectedStore]);
        mapManager.focusStore(selectedStore.id);
      });
    });
  }

  function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || '');
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<span style="color:#38bdf8;font-weight:700;">$1</span>');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
