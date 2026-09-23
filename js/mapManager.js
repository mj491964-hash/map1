/**
 * MapManager - Leaflet Interactive Map & High Performance Clustering Controller
 * 한국어 국토교통부 VWorld 배경지도 기본 적용
 */
class MapManager {
  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.clusterGroup = null;
    this.heatLayer = null;
    this.isHeatmapActive = false;
    this.tileLayers = {};
    this.currentTile = 'vworld-base';
    this.busanCenter = [35.1795543, 129.0756416];
    this.initialZoom = 11;
    this.userLocationMarker = null;
    this.markersMap = new Map();

    this.initMap();
  }

  /**
   * Initialize Leaflet map and tile layers with Korean VWorld basemap
   */
  initMap() {
    this.map = L.map(this.containerId, {
      center: this.busanCenter,
      zoom: this.initialZoom,
      zoomControl: true,
      minZoom: 8,
      maxZoom: 18,
      preferCanvas: true
    });

    // Remove English "Leaflet" prefix from bottom attribution
    if (this.map.attributionControl) {
      this.map.attributionControl.setPrefix('국토교통부 공간정보 플랫폼');
    }

    // 100% Korean VWorld Basemap Layers & Fallback
    this.tileLayers = {
      'vworld-base': L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
        attribution: '&copy; 브이월드 (국토교통부)',
        minZoom: 6,
        maxZoom: 19
      }),
      'vworld-white': L.tileLayer('https://xdworld.vworld.kr/2d/white/service/{z}/{x}/{y}.png', {
        attribution: '&copy; 브이월드 (국토교통부)',
        minZoom: 6,
        maxZoom: 19
      }),
      'vworld-midnight': L.tileLayer('https://xdworld.vworld.kr/2d/midnight/service/{z}/{x}/{y}.png', {
        attribution: '&copy; 브이월드 (국토교통부)',
        minZoom: 6,
        maxZoom: 19
      })
    };

    // Default to Korean VWorld Base Map
    this.tileLayers['vworld-base'].addTo(this.map);

    // Initialize Cluster Group with Custom Density-Based Icons
    this.initClusterGroup();
  }

  /**
   * Set up MarkerClusterGroup with custom density-tier colors (Red for high-density clusters)
   */
  initClusterGroup() {
    this.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 25,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let clusterClass = 'cluster-low';
        let size = 34;

        // 🔴 고밀도 (50개 이상 밀집): 선명한 빨간색 뱃지 + 외곽 붉은 글로우 + 펄스 애니메이션
        if (count >= 50) {
          clusterClass = 'cluster-high';
          size = 46;
        } 
        // 🟠 중밀도 (20~49개): 주황색
        else if (count >= 20) {
          clusterClass = 'cluster-mid';
          size = 40;
        } 
        // 🟢 저밀도 (20개 미만): 에메랄드 그린
        else {
          clusterClass = 'cluster-low';
          size = 34;
        }

        // 한국어 천 단위 쉼표 표기 (영문 k 제거)
        const countLabel = count.toLocaleString();

        return L.divIcon({
          html: `<div class="cluster-bubble">${countLabel}</div>`,
          className: `marker-cluster-custom ${clusterClass}`,
          iconSize: L.point(size, size)
        });
      }
    });

    this.map.addLayer(this.clusterGroup);
  }

  /**
   * Switch Map Tile Style (vworld-base, vworld-white, vworld-midnight)
   */
  switchTileLayer(layerKey) {
    if (!this.tileLayers[layerKey] || this.currentTile === layerKey) return;
    this.map.removeLayer(this.tileLayers[this.currentTile]);
    this.tileLayers[layerKey].addTo(this.map);
    this.currentTile = layerKey;
  }

  /**
   * Create SVG Custom Marker Pin for a Store
   */
  createMarker(store) {
    const iconSvg = this.getCategoryIconSvg(store.category);
    const customIcon = L.divIcon({
      className: `custom-pin-marker pin-${store.category}`,
      html: `
        <div class="pin-bubble">
          <div class="pin-bubble-inner">
            ${iconSvg}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });

    const marker = L.marker([store.lat, store.lng], { icon: customIcon });
    marker.bindPopup(() => this.createPopupContent(store), {
      maxWidth: 320,
      className: 'custom-popup-container'
    });

    return marker;
  }

  /**
   * Render Store Array into MarkerClusterGroup
   */
  loadStores(stores) {
    if (!this.clusterGroup) return;
    this.clusterGroup.clearLayers();
    this.markersMap.clear();

    const markers = [];
    const heatPoints = [];

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      const marker = this.createMarker(store);
      markers.push(marker);
      heatPoints.push([store.lat, store.lng, 0.7]);
      this.markersMap.set(store.id, { marker, store });
    }

    this.clusterGroup.addLayers(markers);

    // Prepare Heatmap Layer
    if (typeof L.heatLayer === 'function') {
      if (this.heatLayer) {
        this.map.removeLayer(this.heatLayer);
      }
      this.heatLayer = L.heatLayer(heatPoints, {
        radius: 24,
        blur: 18,
        maxZoom: 16,
        gradient: {
          0.2: '#10b981',
          0.45: '#f59e0b',
          0.7: '#ef4444',
          1.0: '#b91c1c'
        }
      });
    }
  }

  /**
   * Focus a specific store and open its popup
   */
  focusStore(storeId) {
    const entry = this.markersMap.get(storeId);
    if (!entry) return;

    const { marker, store } = entry;
    this.clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
  }

  /**
   * Automatically fit map bounds to a list of stores
   */
  fitToStores(stores) {
    if (!stores || stores.length === 0) return;

    if (stores.length === 1) {
      this.focusStore(stores[0].id);
      return;
    }

    const bounds = L.latLngBounds(stores.map(s => [s.lat, s.lng]));
    this.map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 16
    });
  }

  /**
   * Toggle Hotspot Heatmap Overlay Mode
   */
  toggleHotspotMode(enable = null) {
    if (!this.heatLayer) return false;

    this.isHeatmapActive = (enable !== null) ? enable : !this.isHeatmapActive;

    if (this.isHeatmapActive) {
      this.map.addLayer(this.heatLayer);
    } else {
      this.map.removeLayer(this.heatLayer);
    }

    return this.isHeatmapActive;
  }

  /**
   * Reset Map View to default Busan Center
   */
  resetView() {
    this.map.flyTo(this.busanCenter, this.initialZoom, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }

  /**
   * Locate User via Geolocation API
   */
  locateUser() {
    if (!navigator.geolocation) {
      alert('현재 브라우저에서는 위치 정보(GPS)를 지원하지 않습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (this.userLocationMarker) {
          this.map.removeLayer(this.userLocationMarker);
        }

        const userIcon = L.divIcon({
          className: 'user-gps-marker',
          html: '<div style="width:16px;height:16px;background:#38bdf8;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 12px #38bdf8;"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        this.userLocationMarker = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(this.map)
          .bindPopup('<b>내 현재 위치</b>')
          .openPopup();

        this.map.flyTo([latitude, longitude], 15, { duration: 1.2 });
      },
      (err) => {
        alert('위치 정보를 가져올 수 없습니다. 브라우저 위치 접근 권한을 확인해주세요.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  /**
   * Generate InfoWindow Popup HTML (모든 텍스트 한국어 적용)
   */
  createPopupContent(store) {
    const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(store.name)},${store.lat},${store.lng}`;
    const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(store.roadAddress || store.name)}`;

    const brandHtml = store.brand 
      ? `<span class="popup-brand-badge">${store.brand}</span>`
      : '';

    const subCategoryText = store.subCategoryName || store.categoryName || '';

    return `
      <div class="popup-card">
        <div class="popup-card-header">
          <div class="popup-tags-row">
            <span class="popup-category-badge ${store.category}">${store.categoryLabel}</span>
            ${brandHtml}
          </div>
          <div class="popup-title">
            <span>${store.name}</span>
            ${store.branch ? `<span class="popup-branch">${store.branch}</span>` : ''}
          </div>
        </div>
        <div class="popup-card-body">
          <div class="popup-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>${store.roadAddress || '주소 정보 없음'} ${store.buildingName ? `(${store.buildingName})` : ''} ${store.floor ? store.floor : ''}</span>
          </div>
          ${subCategoryText ? `
          <div class="popup-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>업종: ${subCategoryText}</span>
          </div>` : ''}
          <div class="popup-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>지역: 부산광역시 ${store.gu || ''} ${store.dong || ''}</span>
          </div>
        </div>
        <div class="popup-card-footer">
          <a href="${kakaoMapUrl}" target="_blank" rel="noopener noreferrer" class="popup-link-btn kakao">
            카카오 길찾기
          </a>
          <a href="${naverMapUrl}" target="_blank" rel="noopener noreferrer" class="popup-link-btn naver">
            네이버 지도
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Helper SVG icons for categories
   */
  getCategoryIconSvg(category) {
    switch (category) {
      case 'mart':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
      case 'department':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>';
      case 'gym':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12"></path></svg>';
      case 'cvs':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"></circle></svg>';
    }
  }
}

window.MapManager = MapManager;
