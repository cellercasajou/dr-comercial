// ==========================================================
// MAPA INTERACTIU (Leaflet + CARTO Positron, sense API key)
// Llegeix lat/lng dels distribuïdors (state.distributors, que ve
// de Firebase en temps real) i els pinta amb clústers.
// ==========================================================

const MAP_STATUS = {
  'Actiu':         { color: '#059669', badge: 'background:#ecfdf5;color:#065f46;border-color:#a7f3d0' },
  'En negociació': { color: '#0284c7', badge: 'background:#f0f9ff;color:#075985;border-color:#bae6fd' },
  'Potencial':     { color: '#d97706', badge: 'background:#fffbeb;color:#78350f;border-color:#fde68a' },
  'Inactiu':       { color: '#78716c', badge: 'background:#f5f5f4;color:#44403c;border-color:#e7e5e4' }
};

const MAP_PRECISION_LABEL = {
  address: '',
  city: 'Ubicació aproximada · ciutat',
  region: 'Ubicació aproximada · regió',
  country: 'Ubicació aproximada · país'
};

const MAP_COUNTRY_CODES = {
  'Espanya': 'es', 'Estats Units': 'us', 'Alemanya': 'de', 'Països Baixos': 'nl', 'Regne Unit': 'gb',
  'Canadà': 'ca', 'Dinamarca': 'dk', 'Suècia': 'se', 'Japó': 'jp', 'Suïssa': 'ch', 'Bèlgica': 'be',
  'Noruega': 'no', 'Hong Kong': 'hk', 'Mèxic': 'mx', 'França': 'fr', 'Finlàndia': 'fi',
  'Corea del Sud': 'kr', 'Austràlia': 'au', 'Irlanda': 'ie', 'Andorra': 'ad', 'Àustria': 'at',
  'Perú': 'pe', 'Xina': 'cn', 'Puerto Rico': 'pr', 'Filipines': 'ph', 'Itàlia': 'it'
};

let mapInstance = null;
let mapCluster = null;
let mapMarkers = new Map();
let mapActiveId = null;
let mapDataSig = '';
let mapIdsSig = '';

function mapEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mapSafeUrl(url) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

function mapStatus(d) {
  return MAP_STATUS[d.status] || MAP_STATUS['Inactiu'];
}

function googleMapsUrl(d) {
  const query = [d.name, d.address || formatDistributorLocation(d), d.country].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

function buildMapPopup(d) {
  const st = mapStatus(d);
  const loc = formatDistributorLocation(d);
  const flag = typeof getCountryFlag === 'function' ? getCountryFlag(d.country) : '';
  const web = mapSafeUrl(d.website);
  const ig = mapSafeUrl(d.instagram);
  const igHandle = ig ? '@' + ig.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') : '';
  const precision = MAP_PRECISION_LABEL[d.geo_precision] || '';

  const addressBlock = d.address
    ? `📍 ${mapEsc(d.address)}${precision ? `<small>${precision}</small>` : ''}`
    : `📍 ${mapEsc(loc || d.country || '')}${precision ? `<small>${precision}</small>` : ''}`;

  return `
    <div class="dr-popup">
      <div class="dr-popup-title">${mapEsc(d.name)}</div>
      <div class="dr-popup-sub">${flag} ${mapEsc(d.country)}${loc ? ' · ' + mapEsc(loc) : ''}</div>
      <span class="dr-popup-badge" style="${st.badge}">${mapEsc(d.status || 'Sense estat')}</span>
      <div class="dr-popup-addr">${addressBlock}</div>
      ${(web || ig) ? `
        <div class="dr-popup-links">
          ${web ? `<a class="dr-chip" href="${mapEsc(web)}" target="_blank" rel="noopener">🌐 Web</a>` : ''}
          ${ig ? `<a class="dr-chip ig" href="${mapEsc(ig)}" target="_blank" rel="noopener">📸 ${mapEsc(igHandle)}</a>` : ''}
        </div>` : ''}
      <div class="dr-actions">
        <a class="dr-btn primary" href="${mapEsc(googleMapsUrl(d))}" target="_blank" rel="noopener">🗺️ Google Maps</a>
        <button type="button" class="dr-btn ghost" onclick="openDetailModal('${mapEsc(d.id)}')">Fitxa</button>
        <button type="button" class="dr-btn danger" onclick="deleteDistributor('${mapEsc(d.id)}')" title="Eliminar distribuïdor">🗑️</button>
      </div>
    </div>`;
}

function buildMapPinIcon(d) {
  const color = mapStatus(d).color;
  return L.divIcon({
    className: '',
    html: `<div class="dr-pin" style="--c:${color}"><span></span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32]
  });
}

function destroyMap() {
  if (mapInstance) {
    try { mapInstance.remove(); } catch (e) {}
  }
  mapInstance = null;
  mapCluster = null;
  mapMarkers = new Map();
  mapActiveId = null;
  mapDataSig = '';
  mapIdsSig = '';
}

function buildMapLayout(container) {
  destroyMap();
  container.className = '';
  container.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-4">
      <aside class="order-2 lg:order-1 lg:w-80 xl:w-96 shrink-0 bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div class="px-4 py-3 border-b border-stone-100 bg-stone-50/70">
          <div id="map-list-count" class="text-xs font-extrabold text-stone-800"></div>
          <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-stone-500">
            ${Object.entries(MAP_STATUS).map(([name, s]) =>
              `<span class="inline-flex items-center gap-1"><span class="map-dot" style="--c:${s.color};width:8px;height:8px"></span>${name}</span>`
            ).join('')}
          </div>
        </div>
        <div id="map-list" class="overflow-y-auto max-h-[38vh] lg:max-h-[72vh]"></div>
      </aside>
      <div class="order-1 lg:order-2 flex-1 min-w-0">
        <div id="dist-map" class="rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden h-[52vh] lg:h-[72vh]"></div>
      </div>
    </div>`;

  mapInstance = L.map('dist-map', { zoomControl: true, worldCopyJump: true, minZoom: 2 }).setView([42, 8], 4);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(mapInstance);

  mapCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    disableClusteringAtZoom: 11,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (cluster) => {
      const n = cluster.getChildCount();
      const size = n < 10 ? '' : (n < 50 ? 'md' : 'lg');
      const px = n < 10 ? 40 : (n < 50 ? 46 : 54);
      return L.divIcon({
        className: '',
        html: `<div class="dr-cluster ${size}">${n}</div>`,
        iconSize: L.point(px, px)
      });
    }
  });
  mapInstance.addLayer(mapCluster);

  document.getElementById('map-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-map-id]');
    if (btn) focusDistributorOnMap(btn.getAttribute('data-map-id'));
  });

  setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 60);
}

function updateMapList(list) {
  const el = document.getElementById('map-list');
  const countEl = document.getElementById('map-list-count');
  if (!el) return;

  const located = list.filter(hasValidCoords).length;
  if (countEl) {
    countEl.textContent = located === list.length
      ? `${list.length} distribuïdors al mapa`
      : `${located} de ${list.length} amb ubicació al mapa`;
  }

  el.innerHTML = list.map(d => {
    const ok = hasValidCoords(d);
    const loc = formatDistributorLocation(d);
    const flag = typeof getCountryFlag === 'function' ? getCountryFlag(d.country) : '';
    return `
      <button type="button" data-map-id="${mapEsc(d.id)}"
              class="map-list-item ${ok ? '' : 'no-coords'} ${d.id === mapActiveId ? 'is-active' : ''}">
        <span class="map-dot" style="--c:${mapStatus(d).color}"></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-extrabold text-stone-900 truncate">${mapEsc(d.name)}</span>
          <span class="block text-[11px] font-medium text-stone-500 truncate">${flag} ${mapEsc(d.country)}${loc ? ' · ' + mapEsc(loc) : ''}${ok ? '' : ' · sense ubicació'}</span>
        </span>
      </button>`;
  }).join('');
}

function updateMapMarkers(list) {
  if (!mapInstance || !mapCluster) return;

  const dataSig = list.map(d => [d.id, d.lat, d.lng, d.status, d.name, d.website, d.instagram, d.address].join(':')).join('|');
  if (dataSig === mapDataSig) return; // res no ha canviat: no tanquem el popup obert
  mapDataSig = dataSig;

  mapCluster.clearLayers();
  mapMarkers = new Map();

  // Agrupem distribuïdors que comparteixen coordenades idèntiques per separar-los en cercle/espiral suau en fer zoom
  const coordGroups = new Map();
  list.forEach(d => {
    if (!hasValidCoords(d)) return;
    const key = Number(d.lat).toFixed(4) + ',' + Number(d.lng).toFixed(4);
    if (!coordGroups.has(key)) coordGroups.set(key, []);
    coordGroups.get(key).push(d);
  });

  const markers = [];
  coordGroups.forEach(group => {
    const count = group.length;
    group.forEach((d, idx) => {
      let lat = Number(d.lat);
      let lng = Number(d.lng);
      if (count > 1) {
        const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
        if (count <= 8) {
          const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
          const radius = 0.015; // ~1.6 km al voltant del centre de la ciutat
          lat += Math.sin(angle) * radius;
          lng += (Math.cos(angle) * radius) / cosLat;
        } else {
          // Espiral daurada per ciutats amb molts distribuïdors (Barcelona, Madrid, NY...)
          const angle = idx * 2.399963;
          const radius = 0.0075 * Math.sqrt(idx + 1);
          lat += Math.sin(angle) * radius;
          lng += (Math.cos(angle) * radius) / cosLat;
        }
      }
      const marker = L.marker([lat, lng], { icon: buildMapPinIcon(d) });
      marker.bindTooltip(mapEsc(d.name), { direction: 'top', offset: [0, -32], className: 'dr-tooltip', opacity: 1 });
      marker.bindPopup(() => buildMapPopup(d), { maxWidth: 300, minWidth: 280, autoPanPadding: [30, 30] });
      marker.on('click', () => setMapActive(d.id, { scrollList: true }));
      mapMarkers.set(d.id, marker);
      markers.push(marker);
    });
  });
  mapCluster.addLayers(markers);

  // Només reajustem l'enquadrament si ha canviat el conjunt (filtres/cerca), no a cada sincronització
  const idsSig = list.map(d => d.id).join(',');
  if (idsSig !== mapIdsSig) {
    mapIdsSig = idsSig;
    const bounds = mapCluster.getBounds();
    if (bounds.isValid()) mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }
}

function setMapActive(id, opts = {}) {
  mapActiveId = id;

  document.querySelectorAll('.map-list-item').forEach(btn => {
    const active = btn.getAttribute('data-map-id') === id;
    btn.classList.toggle('is-active', active);
    if (active && opts.scrollList) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  mapMarkers.forEach((marker, mid) => {
    const pin = marker._icon && marker._icon.querySelector('.dr-pin');
    if (pin) pin.classList.toggle('is-active', mid === id);
  });
}

function focusDistributorOnMap(id) {
  const d = (state.distributors || []).find(x => x.id === id);
  if (!d || !mapInstance) return;

  if (!hasValidCoords(d)) {
    showToast(`Cercant la ubicació de "${d.name}"...`, 'info');
    ensureDistributorCoords(d, true);
    return;
  }

  const marker = mapMarkers.get(id);
  if (!marker) {
    showToast('Aquest distribuïdor no és dins dels filtres actuals', 'info');
    return;
  }

  setMapActive(id);
  const zoom = d.geo_precision === 'country' ? 6 : (d.geo_precision === 'region' ? 9 : 13);

  const mapEl = document.getElementById('dist-map');
  if (mapEl && window.innerWidth < 1024) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  mapInstance.flyTo(marker.getLatLng(), zoom, { duration: 0.8 });
  setTimeout(() => {
    if (!mapCluster || !mapMarkers.get(id)) return;
    mapCluster.zoomToShowLayer(marker, () => {
      marker.openPopup();
      setMapActive(id);
    });
  }, 900);
}

function renderMapView(list, container) {
  if (typeof L === 'undefined' || typeof L.markerClusterGroup !== 'function') {
    container.className = '';
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 text-center border border-dashed border-stone-300 text-sm text-stone-600">
        No s'ha pogut carregar el mapa (cal connexió a internet per descarregar Leaflet).
      </div>`;
    return;
  }

  if (!mapInstance || !container.querySelector('#dist-map')) {
    buildMapLayout(container);
  }
  updateMapList(list);
  updateMapMarkers(list);
  if (mapActiveId) setMapActive(mapActiveId);
}

// Geolocalitza un distribuïdor nou o editat (Nominatim/OpenStreetMap, gratuït)
async function ensureDistributorCoords(d, announce) {
  if (!d || hasValidCoords(d)) return;

  const firstPart = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').split(/[\/,&]/)[0].trim();
  const cc = MAP_COUNTRY_CODES[d.country] || '';
  const attempts = [];
  if (d.address) attempts.push({ q: [d.address, firstPart(d.city), d.country].filter(Boolean).join(', '), precision: 'address' });
  if (firstPart(d.city)) attempts.push({ q: firstPart(d.city), precision: 'city' });
  if (d.country) attempts.push({ q: d.country, precision: 'country' });

  for (const attempt of attempts) {
    try {
      const params = new URLSearchParams({ q: attempt.q, format: 'jsonv2', limit: '1', 'accept-language': 'ca' });
      if (cc) params.set('countrycodes', cc);
      const res = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString());
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data[0]) {
        d.lat = Math.round(parseFloat(data[0].lat) * 1e5) / 1e5;
        d.lng = Math.round(parseFloat(data[0].lon) * 1e5) / 1e5;
        d.geo_precision = attempt.precision;
        saveDistributorsLocally();
        syncSingleDistributorToFirebase(d);
        if (state.viewMode === 'map') renderDistributorsList();
        if (announce) {
          showToast(`Ubicació trobada per a "${d.name}"`, 'success');
          focusDistributorOnMap(d.id);
        }
        return;
      }
    } catch (e) {
      console.warn('Geolocalització fallida:', e);
    }
  }
  if (announce) showToast(`No s'ha pogut trobar la ubicació de "${d.name}"`, 'error');
}
