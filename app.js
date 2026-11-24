// ========================================================
// CRM DISTRIBUÏDORS DE VINS ESCUMOSOS - APP CORE v2
// Amb dades consolidades de Corpinnat, Dinamarca, Espanya i BWW
// ========================================================

const STORAGE_KEY = 'crm_sparkling_distributors_v23';
const SUPABASE_CONFIG_KEY = 'crm_supabase_config_v1';

const COUNTRY_FLAGS = {
  'Espanya': '🇪🇸',
  'Dinamarca': '🇩🇰',
  'Estats Units': '🇺🇸',
  'Regne Unit': '🇬🇧',
  'Països Baixos': '🇳🇱',
  'Bèlgica': '🇧🇪',
  'Alemanya': '🇩🇪',
  'Suècia': '🇸🇪',
  'Suïssa': '🇨🇭',
  'Canadà': '🇨🇦',
  'Japó': '🇯🇵',
  'Irlanda': '🇮🇪',
  'Noruega': '🇳🇴',
  'França': '🇫🇷',
  'Itàlia': '🇮🇹',
  'Àustria': '🇦🇹',
  'Mèxic': '🇲🇽',
  'Puerto Rico': '🇵🇷',
  'Perú': '🇵🇪',
  'Xina': '🇨🇳',
  'Austràlia': '🇦🇺',
  'Singapur': '🇸🇬',
  'Andorra': '🇦🇩',
  'Estònia': '🇪🇪',
  'Finlàndia': '🇫🇮',
  'Lituània': '🇱🇹',
  'Txèquia': '🇨🇿',
  'Letònia': '🇱🇻',
  'Filipines': '🇵🇭',
  'Colòmbia': '🇨🇴',
  'Brasil': '🇧🇷',
  'Panamà': '🇵🇦'
};

function getCountryFlag(country) {
  return COUNTRY_FLAGS[country] || '🌍';
}

const state = {
  distributors: [],
  filterProvince: 'Totes',
  filterCity: 'Totes',
  searchQuery: '',
  activeTab: 'all',
  filterStatus: 'Tots',
  filterCountry: 'Tots',
  filterZone: 'Totes',
  filterRegion: 'Totes',
  filterSpecialty: 'Totes',
  filterWinery: 'Tots',
  filterCasajouCategory: 'Tots',
  quickOnlyActive: false,
  quickOnlyInstagram: false,
  quickOnlyPriority: false,
  viewMode: 'grid',
  selectedDistributor: null,
  activeDetailTab: 'fitxa',
  supabaseClient: null,
  supabaseConfig: {
    url: '',
    key: '',
    connected: false
  }
};

function initApp() {
  loadSupabaseConfig();
  loadDistributors();
  if ((!state.distributors || state.distributors.length === 0) && window.INITIAL_DISTRIBUTORS) {
    state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
    saveDistributorsLocally();
  }
  setupEventListeners();
  initGeographicFilters();
  render();
  updateSyncIndicator();
}

function loadSupabaseConfig() {
  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      state.supabaseConfig = JSON.parse(saved);
      if (state.supabaseConfig.url && state.supabaseConfig.key && window.supabase) {
        state.supabaseClient = window.supabase.createClient(
          state.supabaseConfig.url,
          state.supabaseConfig.key
        );
        state.supabaseConfig.connected = true;
      }
    }
  } catch (e) {
    console.error('Error carregant configuració de Supabase:', e);
  }
}

function loadDistributors() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.distributors = parsed;
      } else if (window.INITIAL_DISTRIBUTORS) {
        state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
        saveDistributorsLocally();
      }
    } else if (window.INITIAL_DISTRIBUTORS) {
      state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
      saveDistributorsLocally();
    }
  } catch (e) {
    console.error('Error carregant distribuïdors:', e);
    state.distributors = window.INITIAL_DISTRIBUTORS || [];
  }
}

function saveDistributorsLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.distributors));
  } catch (e) {
    console.error('Error guardant distribuïdors en local:', e);
  }
}

async function syncWithSupabase() {
  if (!state.supabaseClient) {
    openCloudModal();
    showToast('Configura primer les claus de Supabase a la pestanya Núvol', 'warning');
    return;
  }

  showToast('Sincronitzant amb el núvol...', 'info');
  try {
    const { data, error } = await state.supabaseClient
      .from('distributors')
      .select('*');

    if (error) throw error;

    if (data && data.length > 0) {
      state.distributors = data;
      saveDistributorsLocally();
      showToast('Dades descarregades del núvol amb èxit!', 'success');
    } else {
      showToast(`Pujant ${state.distributors.length} distribuïdors a Supabase...`, 'info');
      for (const d of state.distributors) {
        const copy = { ...d };
        delete copy.contacts;
        delete copy.interactions;
        delete copy.documents;
        await state.supabaseClient.from('distributors').upsert(copy);
      }
      showToast("Totes les dades s'han guardat al núvol!", "success");
    }
    render();
    updateSyncIndicator();
  } catch (err) {
    console.error('Error de sincronització:', err);
    showToast('Error de connexió: ' + (err.message || 'Comprova les credencials'), 'error');
  }
}

function getFilteredDistributors() {
  const q = state.searchQuery.toLowerCase().trim();

  return state.distributors.filter(d => {
    if (state.quickOnlyActive && d.status !== 'Actiu') return false;
    if (state.quickOnlyInstagram && !d.instagram) return false;
    if (state.quickOnlyPriority && d.priority !== 'Alta' && d.priority !== 'Molt alta') return false;

    if (state.filterStatus !== 'Tots' && d.status !== state.filterStatus) return false;

    // Filtre de País
    if (state.filterCountry !== 'Tots') {
      const dCountry = (d.country || '').toLowerCase();
      const targetCountry = state.filterCountry.toLowerCase();
      if (!dCountry.includes(targetCountry) && d.country !== state.filterCountry) return false;
    }

    // Filtre de Província / Estat (Espanya o EUA)
    if (state.filterProvince && state.filterProvince !== 'Totes' && state.filterProvince !== 'Tots') {
      const prov = (d.province || '').toLowerCase();
      const reg = (d.region || '').toLowerCase();
      const city = (d.city || '').toLowerCase();
      const tags = (d.specialty_tags || []).join(' ').toLowerCase();
      const target = state.filterProvince.toLowerCase();

      const cleanTarget = target.replace(/\(.*?\)/g, '').trim();
      const codeMatch = target.match(/\(([a-z0-9]+)\)/);
      const code = codeMatch ? codeMatch[1].toLowerCase() : '';

      const matchProv = prov.includes(target) || prov.includes(cleanTarget) || (code && prov.includes(code));
      const matchReg = reg.includes(target) || reg.includes(cleanTarget) || (code && reg.includes(code));
      const matchCity = city.includes(target) || city.includes(cleanTarget) || (code && city.includes(code));
      const matchTags = tags.includes(target) || tags.includes(cleanTarget);

      if (!matchProv && !matchReg && !matchCity && !matchTags) return false;
    }

    // Filtre de Ciutat / Localitat
    if (state.filterCity && state.filterCity !== 'Totes' && state.filterCity !== 'Tots') {
      const city = (d.city || '').toLowerCase();
      const addr = (d.address || '').toLowerCase();
      const targetCity = state.filterCity.toLowerCase();
      if (!city.includes(targetCity) && !addr.includes(targetCity)) return false;
    }

    // Filtre de Regió / Comunitat
    if (state.filterRegion && state.filterRegion !== 'Totes' && state.filterRegion !== 'Tots') {
      const reg = (d.region || '').toLowerCase();
      const prov = (d.province || '').toLowerCase();
      const target = state.filterRegion.toLowerCase();
      if (!reg.includes(target) && !prov.includes(target)) return false;
    }

    // Filtre Xarxa Casajou
    if (state.activeTab === 'casajou') {
      const isCasajou = d.is_casajou || (d.specialty_tags && d.specialty_tags.some(t => t.toLowerCase().includes('casajou')));
      if (!isCasajou) return false;

      if (state.filterCasajouCategory && state.filterCasajouCategory !== 'Tots') {
        const cat = state.filterCasajouCategory.toLowerCase();
        const type = (d.distribution_type || '').toLowerCase();
        const role = (d.casajou_role || '').toLowerCase();
        const tags = (d.specialty_tags || []).join(' ').toLowerCase();
        if (cat === 'distribuidor' && !type.includes('distribuïdor') && !role.includes('distribuïdor') && !tags.includes('distribuïdor')) return false;
        if (cat === 'importador' && !type.includes('importador') && !role.includes('importador') && !tags.includes('importador')) return false;
        if (cat === 'prescriptor' && !type.includes('prescriptor') && !type.includes('sommelier') && !role.includes('sommelier') && !role.includes('prescriptor')) return false;
      }
    }

    // Filtre d'especialitat
    if (state.filterSpecialty !== 'Totes') {
      const tags = d.specialty_tags || [];
      const hasSpecialty = tags.some(t => t.toLowerCase().includes(state.filterSpecialty.toLowerCase()));
      if (!hasSpecialty) return false;
    }

    // Filtre per Celler Corpinnat
    if (state.filterWinery && state.filterWinery !== 'Tots') {
      const win = (d.related_wineries || '').toLowerCase();
      const target = state.filterWinery.toLowerCase();
      if (!win.includes(target)) return false;
    }

    if (!q) return true;

    const matchName = (d.name || '').toLowerCase().includes(q);
    const matchLegal = (d.legal_name || '').toLowerCase().includes(q);
    const matchCountry = (d.country || '').toLowerCase().includes(q);
    const matchCity = (d.city || '').toLowerCase().includes(q);
    const matchProvince = (d.province || '').toLowerCase().includes(q);
    const matchRegion = (d.region || '').toLowerCase().includes(q);
    const matchNotes = (d.notes || '').toLowerCase().includes(q);
    const matchWineries = (d.related_wineries || '').toLowerCase().includes(q);
    const matchFocus = (d.sparkling_focus || '').toLowerCase().includes(q);
    const matchChannels = (d.channels || '').toLowerCase().includes(q);
    const matchInstagram = (d.instagram || '').toLowerCase().includes(q);
    const matchWeb = (d.website || '').toLowerCase().includes(q);

    const matchContacts = (d.contacts || []).some(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.mobile || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );

    return matchName || matchLegal || matchCountry || matchCity || matchProvince || matchRegion || matchNotes || matchWineries || matchFocus || matchChannels || matchContacts || matchInstagram || matchWeb;
  });
}

function getUniqueCountries() {
  const map = {};
  state.distributors.forEach(d => {
    if (d.country) {
      map[d.country] = (map[d.country] || 0) + 1;
    }
  });
  return Object.keys(map).sort((a,b) => {
    if (a === 'Espanya') return -1;
    if (b === 'Espanya') return 1;
    return map[b] - map[a];
  }).map(c => ({ country: c, count: map[c] }));
}

function getStats() {
  const total = state.distributors.length;
  const active = state.distributors.filter(d => d.status === 'Actiu').length;
  const countries = new Set(state.distributors.map(d => d.country)).size;
  const withInstagram = state.distributors.filter(d => d.instagram).length;
  return { total, active, countries, withInstagram };
}

function render() {
  renderStats();
  renderFilters();
  renderDistributorsList();
  if (state.selectedDistributor) {
    renderDetailModal();
  }
}

function renderStats() {
  const { total, active, countries, withInstagram } = getStats();
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-countries').textContent = countries;
  document.getElementById('stat-followups').textContent = withInstagram;
}

function getUniqueZones() {
  const map = {};
  state.distributors.forEach(d => {
    // Si està filtrat per país (o per defecte Espanya)
    if (state.filterCountry === 'Tots' || d.country === state.filterCountry) {
      const p = d.province || d.city;
      if (p) {
        map[p] = (map[p] || 0) + 1;
      }
    }
  });
  return Object.keys(map).sort((a,b) => map[b] - map[a]).map(k => ({ zone: k, count: map[k] }));
}

function renderFilters() {
  const countrySelect = document.getElementById('filter-country');
  const currentCountry = state.filterCountry;
  const countryList = getUniqueCountries();
  
  countrySelect.innerHTML = `<option value="Tots">Tots els Mercats (${state.distributors.length})</option>` +
    countryList.map(item => `
      <option value="${item.country}" ${item.country === currentCountry ? 'selected' : ''}>
        ${getCountryFlag(item.country)} ${item.country} (${item.count})
      </option>
    `).join('');

  // Selector de Cellers Corpinnat (24)
  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) {
    const CORP_WINERIES = [
      "Gramona", "Llopart", "Nadal", "Recaredo", "Sabaté i Coca", "Torelló",
      "Huguet de Can Feixes", "Júlia Bernet", "Mas Candí", "Can Descregut",
      "Pardas", "Bufadors", "Cisteller", "Viader", "Mas de la Basserola",
      "Celler Kripta", "Demost", "Mas Bertran", "AT Roca", "Celler Mir",
      "Torné & Bel", "Juvé & Camps", "Mas Vilella", "Fèlix Massana Ràfols"
    ];
    const currentWinery = state.filterWinery || 'Tots';
    winerySelect.innerHTML = `<option value="Tots">🍾 Tots els Cellers Corpinnat (24)</option>` +
      CORP_WINERIES.map(w => {
        const count = state.distributors.filter(d => (d.related_wineries || '').toLowerCase().includes(w.toLowerCase())).length;
        return `<option value="${w}" ${w === currentWinery ? 'selected' : ''}>${w} (${count})</option>`;
      }).join('');
  }

  // Selector de Províncies / Zones
  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) {
    const zones = getUniqueZones();
    const currentZone = state.filterZone;
    zoneSelect.innerHTML = `<option value="Totes">Totes les Zones / Províncies (${zones.length})</option>` +
      zones.map(z => `
        <option value="${z.zone}" ${z.zone === currentZone ? 'selected' : ''}>
          📍 ${z.zone} (${z.count})
        </option>
      `).join('');
  }
}

// ==========================================
// CONTROLADORS DE PESTANYES I FILTRES NETS
// ==========================================

function setMainTab(tab) {
  state.activeTab = tab;
  
  // 1. Estil de pestanyes principals (Segmented Navigation moderna)
  document.querySelectorAll('.category-tab').forEach(b => {
    b.className = 'category-tab px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-white text-stone-700 hover:bg-stone-100 border border-stone-200';
  });
  const activeBtn = document.getElementById('tab-' + tab);
  if (activeBtn) {
    activeBtn.className = 'category-tab px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-amber-900 text-white shadow-2xs border-transparent';
  }

  // 1b. Sincronitzar la barra de navegació inferior d'iPhone (iOS Tab Bar)
  ['all', 'casajou', 'corpinnat', 'spain', 'intl'].forEach(t => {
    const mobBtn = document.getElementById('mobnav-' + t);
    if (mobBtn) {
      if (t === tab || (t === 'intl' && tab === 'usa')) {
        mobBtn.className = 'flex flex-col items-center justify-center gap-1 h-full text-amber-400 transition-colors active:opacity-70';
      } else {
        mobBtn.className = 'flex flex-col items-center justify-center gap-1 h-full text-stone-400 hover:text-stone-200 transition-colors active:opacity-70';
      }
    }
  });

  // 2. Mostrar només el sub-panell contextual actiu
  ['all', 'casajou', 'spain', 'corpinnat', 'usa', 'intl'].forEach(t => {
    const p = document.getElementById('subpanel-' + t);
    if (p) {
      if (t === tab) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    }
  });

  // 3. Adaptar l'estat dels filtres segons la pestanya
  state.filterCity = 'Totes';

  if (tab === 'all') {
    state.filterCountry = 'Tots';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    state.filterCasajouCategory = 'Tots';
  } else if (tab === 'casajou') {
    state.filterCountry = 'Tots';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    state.filterCasajouCategory = 'Tots';
    setCasajouSubFilter('Tots');
    return;
  } else if (tab === 'spain') {
    state.filterCountry = 'Espanya';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setSpainQuickFilter('Tots');
    return;
  } else if (tab === 'corpinnat') {
    state.filterCountry = 'Tots';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Corpinnat';
    setCorpinnatSubWinery('Tots');
    return;
  } else if (tab === 'usa') {
    state.filterCountry = 'Estats Units';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setUsaQuickFilter('Tots');
    return;
  } else if (tab === 'intl') {
    state.filterCountry = 'Tots';
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setIntlQuickFilter('Tots');
    return;
  }

  render();
  updateActiveChips();
}

function setSpainSubZone(zone) {
  document.querySelectorAll('.spain-subpill').forEach(b => {
    b.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });
  
  if (zone === 'Tots') {
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    const allBtn = document.getElementById('subpill-spain-all');
    if (allBtn) allBtn.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const isReg = ['Catalunya', 'País Basc', 'Andalusia', 'Galícia'].indexOf(zone) !== -1;
    if (isReg) {
      state.filterRegion = zone;
      state.filterZone = 'Totes';
    } else {
      state.filterRegion = 'Totes';
      state.filterZone = zone;
    }
    const cleanId = 'subpill-spain-' + zone.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) zoneSelect.value = state.filterZone;

  renderDistributorsList();
  updateActiveChips();
}

function setCorpinnatSubWinery(winery) {
  state.filterWinery = winery;
  
  document.querySelectorAll('.corp-subpill').forEach(b => {
    b.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (winery === 'Tots') {
    const allBtn = document.getElementById('subpill-winery-all');
    if (allBtn) allBtn.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const cleanId = 'subpill-winery-' + winery.replace(/[^a-zA-Z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) winerySelect.value = winery;

  renderDistributorsList();
  updateActiveChips();
}

function setUsaSubState(st) {
  state.filterZone = (st === 'Tots' ? 'Totes' : st);

  document.querySelectorAll('.usa-subpill').forEach(b => {
    b.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (st === 'Tots') {
    const allBtn = document.getElementById('subpill-usa-all');
    if (allBtn) allBtn.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const cleanId = 'subpill-usa-' + st.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  renderDistributorsList();
  updateActiveChips();
}

function setIntlSubCountry(country) {
  state.filterCountry = country;

  document.querySelectorAll('.intl-subpill').forEach(b => {
    b.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (country === 'Tots') {
    const allBtn = document.getElementById('subpill-intl-all');
    if (allBtn) allBtn.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    var countryMap = {
      'Alemanya': 'germany', 'Països Baixos': 'nl', 'Regne Unit': 'uk',
      'Canadà': 'ca', 'Dinamarca': 'dk', 'Japó': 'jp', 'Suècia': 'se', 'Suïssa': 'ch'
    };
    var code = countryMap[country] || country.toLowerCase().replace(/[^a-z0-9]/g, '');
    var activeSubBtn = document.getElementById('subpill-intl-' + code);
    if (activeSubBtn) activeSubBtn.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const countrySelect = document.getElementById('filter-country');
  if (countrySelect) countrySelect.value = country;

  renderDistributorsList();
  updateActiveChips();
}

function toggleAdvancedFilters() {
  const drawer = document.getElementById('advanced-filters-drawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickStatus(status) {
  state.quickOnlyActive = !state.quickOnlyActive;
  const btn = document.getElementById('btn-quick-active');
  if (btn) {
    if (state.quickOnlyActive) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-700 text-white border border-emerald-700 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-800 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickInstagram() {
  state.quickOnlyInstagram = !state.quickOnlyInstagram;
  const btn = document.getElementById('btn-quick-instagram');
  if (btn) {
    if (state.quickOnlyInstagram) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-rose-700 text-white border border-rose-700 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-rose-400 hover:text-rose-800 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickPriority() {
  state.quickOnlyPriority = !state.quickOnlyPriority;
  const btn = document.getElementById('btn-quick-priority');
  if (btn) {
    if (state.quickOnlyPriority) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-amber-800 text-white border border-amber-800 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-amber-500 hover:text-amber-900 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function updateActiveChips() {
  const container = document.getElementById('active-filter-chips');
  const clearBtn = document.getElementById('clear-filters-btn');
  const badgeCount = document.getElementById('active-filters-count');
  if (!container) return;

  const chips = [];
  let advCount = 0;

  if (state.searchQuery) {
    chips.push({ label: '"' + state.searchQuery + '"', action: 'clearSearch()' });
  }
  if (state.filterCountry && state.filterCountry !== 'Tots' && state.activeTab === 'intl') {
    chips.push({ label: '🌍 ' + state.filterCountry, action: 'handleIntlCountryChange("Tots")' });
  }
  if (state.filterProvince && state.filterProvince !== 'Totes' && state.filterProvince !== 'Tots') {
    const icon = state.activeTab === 'usa' ? '🗺️ ' : '📍 ';
    chips.push({ label: icon + state.filterProvince, action: 'state.filterProvince="Totes"; render(); updateActiveChips();' });
  }
  if (state.filterCity && state.filterCity !== 'Totes') {
    chips.push({ label: '🏙️ ' + state.filterCity, action: 'state.filterCity="Totes"; render(); updateActiveChips();' });
  }
  if (state.filterZone && state.filterZone !== 'Totes') {
    chips.push({ label: 'Zona: ' + state.filterZone, action: 'setSpainSubZone("Tots")' });
  }
  if (state.filterRegion && state.filterRegion !== 'Totes') {
    chips.push({ label: 'Regió: ' + state.filterRegion, action: 'setSpainSubZone("Tots")' });
  }
  if (state.filterWinery && state.filterWinery !== 'Tots') {
    chips.push({ label: 'Celler: ' + state.filterWinery, action: 'setCorpinnatSubWinery("Tots")' });
  }
  if (state.filterStatus && state.filterStatus !== 'Tots') {
    chips.push({ label: 'Estat: ' + state.filterStatus, action: 'state.filterStatus="Tots"; if(document.getElementById("filter-status")) document.getElementById("filter-status").value="Tots"; renderDistributorsList(); updateActiveChips();' });
    advCount++;
  }
  if (state.filterSpecialty && state.filterSpecialty !== 'Totes' && state.filterSpecialty !== 'Corpinnat') {
    chips.push({ label: 'Esp.: ' + state.filterSpecialty, action: 'state.filterSpecialty="Totes"; if(document.getElementById("filter-specialty")) document.getElementById("filter-specialty").value="Totes"; renderDistributorsList(); updateActiveChips();' });
    advCount++;
  }
  if (state.quickOnlyActive) {
    chips.push({ label: '🟢 Actius', action: 'toggleQuickStatus()' });
  }
  if (state.quickOnlyInstagram) {
    chips.push({ label: '📸 Amb IG', action: 'toggleQuickInstagram()' });
  }
  if (state.quickOnlyPriority) {
    chips.push({ label: '⭐ Prioritat', action: 'toggleQuickPriority()' });
  }

  container.innerHTML = chips.map(c => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold">
      ${c.label}
      <button onclick="${c.action}" class="hover:text-black font-extrabold text-xs ml-0.5">✕</button>
    </span>
  `).join('');

  if (clearBtn) {
    if (chips.length > 0 || state.activeTab !== 'all') {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (badgeCount) {
    if (advCount > 0) {
      badgeCount.textContent = advCount;
      badgeCount.classList.remove('hidden');
    } else {
      badgeCount.classList.add('hidden');
    }
  }
}

// Funció de compatibilitat anterior
function setQuickFilter(type, value) {
  if (type === 'all') setMainTab('all');
  else if (type === 'country' && value === 'Espanya') setMainTab('spain');
  else if (type === 'region') { setMainTab('spain'); setSpainSubZone(value); }
  else if (type === 'zone') { setMainTab('spain'); setSpainSubZone(value); }
  else if (type === 'us-state') { setMainTab('usa'); setUsaSubState(value); }
  else if (type === 'winery') { setMainTab('corpinnat'); setCorpinnatSubWinery(value); }
  else setMainTab('all');
}

function renderDistributorsList() {
  const filtered = getFilteredDistributors();
  const container = document.getElementById('distributors-container');
  const countBadge = document.getElementById('results-count');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} distribuïdors i importadors`;
  }
  updateActiveChips();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300">
        <div class="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-800">
          <i data-lucide="search-x" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-stone-800 mb-1">Cap distribuïdor trobat</h3>
        <p class="text-stone-500 text-sm max-w-md mx-auto mb-6">No s'han trobat resultats amb aquests filtres o terme de cerca.</p>
        <button onclick="resetFilters()" class="px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all">
          Netejar cerca i filtres
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (state.viewMode === 'table') {
    renderTableView(filtered, container);
  } else {
    renderGridView(filtered, container);
  }

  if (window.lucide) lucide.createIcons();
}

function renderGridView(distributors, container) {
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5';
  container.innerHTML = distributors.map(d => {
    const primaryContact = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || null;
    const phoneNum = (primaryContact && (primaryContact.mobile || primaryContact.phone)) || d.phone || '';
    const emailAddr = (primaryContact && primaryContact.email) || d.email || '';
    const docsCount = (d.documents || []).length;
    
    // Status colors
    let statusClass = 'bg-stone-100 text-stone-700 border-stone-200';
    if (d.status === 'Actiu') statusClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (d.status === 'En negociació') statusClass = 'bg-sky-50 text-sky-800 border-sky-200';
    if (d.status === 'Potencial') statusClass = 'bg-amber-50 text-amber-900 border-amber-200';
    if (d.status === 'Inactiu') statusClass = 'bg-rose-50 text-rose-800 border-rose-200';

    // Priority badge & Casajou badge
    let priorityBadge = '';
    if (d.is_casajou) {
      priorityBadge = '<span class="text-[10px] bg-gradient-to-r from-amber-100 to-rose-100 text-amber-950 font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shadow-2xs">🍇 Xarxa Casajou</span>';
    } else if (d.priority === 'Molt alta') {
      priorityBadge = '<span class="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-full border border-rose-200">⭐ Prioritat Màxima</span>';
    } else if (d.priority === 'Alta') {
      priorityBadge = '<span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">Prioritat Alta</span>';
    }

    return `
      <div onclick="openDetailModal('${d.id}')" 
           class="bg-white rounded-3xl border border-stone-200/90 shadow-xs hover:shadow-md hover:border-amber-900/30 transition-all cursor-pointer p-5 flex flex-col justify-between group relative overflow-hidden">
        
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-700 via-rose-900 to-amber-950 opacity-80 group-hover:opacity-100"></div>

        <div>
          <!-- Capçalera targeta -->
          <div class="flex items-start justify-between gap-2 mb-2 pt-1">
            <div class="min-w-0">
              <div class="flex items-center flex-wrap gap-1 text-xs font-bold text-stone-500 mb-1">
                <span class="flex items-center gap-1">${getCountryFlag(d.country)} ${d.country}</span>
                ${d.province ? `<span class="bg-amber-100/80 text-amber-950 px-2 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1">📍 ${d.province}</span>` : (d.city ? `<span class="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md text-[11px]">• ${d.city}</span>` : '')}
              </div>
              <h3 class="text-base font-black text-stone-900 group-hover:text-amber-900 transition-colors line-clamp-1">
                ${d.name}
              </h3>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusClass}">
                ${d.status}
              </span>
              ${priorityBadge}
            </div>
          </div>

          <!-- Banner Xarxa Casajou si escau -->
          ${d.casajou_role ? `
            <div class="mb-2 bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200/90 rounded-xl p-2 text-xs text-amber-950 flex items-center justify-between">
              <span class="font-black text-amber-900 flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-700"></i> ${d.casajou_role}</span>
              ${d.instagram ? `<a href="${d.instagram}" target="_blank" onclick="event.stopPropagation()" class="text-rose-700 font-extrabold hover:underline flex items-center gap-1 text-[11px]"><i data-lucide="instagram" class="w-3 h-3"></i> Instagram</a>` : ''}
            </div>
          ` : ''}

          <!-- Cellers relacionats o Especialitat -->
          ${d.related_wineries ? `
            <div class="mb-2.5 bg-rose-50/70 border border-rose-100 rounded-xl p-2 text-xs text-rose-950">
              <span class="font-bold text-rose-900">🍷 Cellers a cartera:</span> 
              <span class="font-medium text-stone-800 line-clamp-1">${d.related_wineries}</span>
            </div>
          ` : (d.sparkling_focus ? `
            <div class="mb-2.5 bg-amber-50/70 border border-amber-100 rounded-xl p-2 text-xs text-amber-950">
              <span class="font-bold text-amber-900">🍾 Focus:</span> 
              <span class="font-medium text-stone-800 line-clamp-1">${d.sparkling_focus}</span>
            </div>
          ` : '')}

          <!-- Specialty tags -->
          ${(d.specialty_tags && d.specialty_tags.length > 0) ? `
            <div class="flex flex-wrap gap-1 mb-3">
              ${d.specialty_tags.slice(0, 3).map(t => `
                <span class="text-[10px] font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">
                  ${t}
                </span>
              `).join('')}
              ${d.specialty_tags.length > 3 ? `<span class="text-[10px] text-stone-400 font-bold">+${d.specialty_tags.length - 3}</span>` : ''}
            </div>
          ` : ''}

          <!-- Condicions o Dades Clau -->
          <div class="grid grid-cols-3 gap-1 py-2 border-y border-stone-100 text-center mb-3">
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Tipus</div>
              <div class="text-xs font-bold text-stone-800 truncate">${d.distribution_type ? d.distribution_type.split(' ')[0] : 'Distribuïdor'}</div>
            </div>
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Incoterm</div>
              <div class="text-xs font-bold text-stone-800">${d.incoterm || 'EXW'}</div>
            </div>
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Pagament</div>
              <div class="text-xs font-bold text-stone-800 truncate">${d.payment_terms || '30 dies'}</div>
            </div>
          </div>
        </div>

        <!-- Botons d'acció directa (Touch-optimized per a iPhone) -->
        <div class="pt-2 flex items-center justify-between gap-1 text-xs" onclick="event.stopPropagation()">
          <div class="flex items-center gap-1.5 sm:gap-2">
            ${phoneNum ? `
              <a href="https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}" target="_blank" 
                 title="Obrir xat de WhatsApp" 
                 class="w-9.5 h-9.5 sm:w-8 sm:h-8 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs active:scale-95">
                <i data-lucide="message-circle" class="w-4.5 h-4.5 sm:w-4 sm:h-4"></i>
              </a>
              <a href="tel:${phoneNum}" 
                 title="Trucar per telèfon" 
                 class="w-9.5 h-9.5 sm:w-8 sm:h-8 bg-sky-100 hover:bg-sky-200 active:bg-sky-300 text-sky-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs active:scale-95">
                <i data-lucide="phone" class="w-4.5 h-4.5 sm:w-4 sm:h-4"></i>
              </a>
            ` : ''}

            ${emailAddr ? `
              <a href="mailto:${emailAddr}" 
                 title="Enviar correu" 
                 class="w-9.5 h-9.5 sm:w-8 sm:h-8 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs active:scale-95">
                <i data-lucide="mail" class="w-4.5 h-4.5 sm:w-4 sm:h-4"></i>
              </a>
            ` : ''}

            ${d.instagram ? `
              <a href="${d.instagram}" target="_blank" 
                 title="Veure perfil d'Instagram" 
                 class="w-9.5 h-9.5 sm:w-8 sm:h-8 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 active:opacity-75 text-white rounded-xl flex items-center justify-center transition-all shadow-2xs active:scale-95">
                <i data-lucide="instagram" class="w-4.5 h-4.5 sm:w-4 sm:h-4"></i>
              </a>
            ` : ''}

            ${d.website ? `
              <a href="${d.website}" target="_blank" 
                 title="Visitar pàgina web" 
                 class="w-9.5 h-9.5 sm:w-8 sm:h-8 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 rounded-xl flex items-center justify-center transition-colors shadow-2xs active:scale-95">
                <i data-lucide="globe" class="w-4.5 h-4.5 sm:w-4 sm:h-4"></i>
              </a>
            ` : ''}
          </div>

          <button onclick="openDetailModal('${d.id}')" class="px-3.5 py-2 sm:px-3 sm:py-1.5 bg-stone-100 hover:bg-amber-900 hover:text-white active:bg-amber-900 active:text-white rounded-xl text-stone-700 font-bold transition-all flex items-center gap-1 text-xs sm:text-[11px] active:scale-95">
            <span>Fitxa</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function renderTableView(distributors, container) {
  container.className = 'w-full overflow-x-auto bg-white rounded-3xl border border-stone-200 shadow-xs';
  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs sm:text-sm">
      <thead>
        <tr class="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold text-xs uppercase tracking-wider">
          <th class="py-3.5 px-4">Distribuïdor / Empresa</th>
          <th class="py-3.5 px-4">País / Àmbit</th>
          <th class="py-3.5 px-4">Estat & Prioritat</th>
          <th class="py-3.5 px-4">Cellers a Cartera / Focus</th>
          <th class="py-3.5 px-4">Contacte Ràpid</th>
          <th class="py-3.5 px-4 text-right">Accions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-stone-100">
        ${distributors.map(d => {
          const c = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || {};
          const phone = c.mobile || c.phone || d.phone || '';
          return `
            <tr onclick="openDetailModal('${d.id}')" class="hover:bg-amber-50/40 cursor-pointer transition-colors">
              <td class="py-3 px-4 font-bold text-stone-900">
                <div class="flex items-center gap-1.5">
                  <span>${d.name}</span>
                  ${d.instagram ? `<a href="${d.instagram}" target="_blank" onclick="event.stopPropagation()" class="text-rose-600 hover:text-rose-800"><i data-lucide="instagram" class="w-3.5 h-3.5"></i></a>` : ''}
                </div>
                <div class="text-[11px] font-normal text-stone-500">${d.distribution_type || ''}</div>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1 font-semibold text-stone-800">
                  <span>${getCountryFlag(d.country)}</span>
                  <span>${d.country}</span>
                </div>
                <div class="text-[11px] text-stone-400">${d.city || '-'}</div>
              </td>
              <td class="py-3 px-4">
                <div class="flex flex-col gap-1 items-start">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    d.status === 'Actiu' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    d.status === 'En negociació' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                    d.status === 'Potencial' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-200'
                  }">
                    ${d.status}
                  </span>
                  ${d.priority === 'Molt alta' ? '<span class="text-[9px] text-rose-700 font-extrabold">⭐ Prioritat Màxima</span>' : ''}
                </div>
              </td>
              <td class="py-3 px-4 max-w-xs">
                ${d.related_wineries ? `<div class="font-medium text-stone-800 truncate text-xs"><span class="font-bold text-rose-900">🍷</span> ${d.related_wineries}</div>` : ''}
                ${d.sparkling_focus ? `<div class="text-stone-500 truncate text-[11px]">${d.sparkling_focus}</div>` : ''}
              </td>
              <td class="py-3 px-4" onclick="event.stopPropagation()">
                <div class="flex items-center gap-2">
                  ${phone ? `
                    <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-7 h-7 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg flex items-center justify-center">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                  ${c.email || d.email ? `
                    <a href="mailto:${c.email || d.email}" class="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                  ${phone ? `<span class="text-xs text-stone-600 font-mono">${phone}</span>` : ''}
                </div>
              </td>
              <td class="py-3 px-4 text-right">
                <button class="px-3 py-1 bg-stone-100 hover:bg-stone-900 hover:text-white rounded-lg text-xs font-bold transition-all">
                  Fitxa
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openDetailModal(id) {
  const dist = state.distributors.find(d => d.id === id);
  if (!dist) return;
  state.selectedDistributor = dist;
  state.activeDetailTab = 'fitxa';
  renderDetailModal();
  document.getElementById('detail-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
  state.selectedDistributor = null;
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function switchDetailTab(tab) {
  state.activeDetailTab = tab;
  renderDetailModal();
  if (window.lucide) lucide.createIcons();
}

function renderDetailModal() {
  const d = state.selectedDistributor;
  if (!d) return;

  document.getElementById('modal-dist-name').textContent = d.name;
  document.getElementById('modal-dist-flag').textContent = getCountryFlag(d.country);
  document.getElementById('modal-dist-country').textContent = `${d.country} ${d.city ? `• ${d.city}` : ''}`;
  
  const statusEl = document.getElementById('modal-dist-status');
  statusEl.textContent = d.status;
  statusEl.className = `text-xs font-bold px-3 py-1 rounded-full border ${
    d.status === 'Actiu' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
    d.status === 'En negociació' ? 'bg-sky-50 text-sky-800 border-sky-200' :
    d.status === 'Potencial' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-200'
  }`;

  ['fitxa', 'contactes', 'seguiment', 'documents'].forEach(tab => {
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (tab === state.activeDetailTab) {
      btn.className = 'py-3 px-4 text-xs md:text-sm font-bold border-b-2 border-amber-800 text-amber-900 flex items-center gap-2';
    } else {
      btn.className = 'py-3 px-4 text-xs md:text-sm font-semibold text-stone-500 hover:text-stone-800 border-b-2 border-transparent flex items-center gap-2';
    }
  });

  const content = document.getElementById('modal-tab-content');

  if (state.activeDetailTab === 'fitxa') {
    const primaryContact = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || null;
    const phoneNum = (primaryContact && (primaryContact.mobile || primaryContact.phone)) || d.phone || '';
    const emailAddr = (primaryContact && primaryContact.email) || d.email || '';
    
    // Parse wineries into badges
    const rawWineries = (d.related_wineries || '').split(/[,;]+/).map(w => w.trim()).filter(Boolean);
    const CORPINNAT_CELLERS = ['Gramona', 'Recaredo', 'Llopart', 'Nadal', 'Torelló', 'Sabaté i Coca', 'Huguet de Can Feixes', 'Can Feixes', 'Júlia Bernet', 'Mas Candí', 'Can Descregut', 'Pardas', 'Bufadors', 'Cisteller', 'Viader', 'Mas de la Basserola', 'Celler Kripta', 'Demost', 'Mas Bertran', 'AT Roca', 'Celler Mir', 'Torné & Bel', 'Juvé & Camps', 'Mas Vilella', 'Fèlix Massana Ràfols', 'Celler Casajou', 'Casajou'];
    
    // Clean domain & handle names for preview
    let webHost = '';
    try {
      if (d.website) {
        webHost = new URL(d.website).hostname.replace('www.', '');
      }
    } catch(e) { webHost = d.website; }
    
    let igHandle = '';
    if (d.instagram) {
      igHandle = d.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
      if (igHandle && !igHandle.startsWith('@')) igHandle = '@' + igHandle;
    }

    content.innerHTML = `
      <div class="space-y-5">
        
        <!-- Enllaços ràpids i canals directes (Web, Instagram, Contacte directe) -->
        <div class="bg-gradient-to-br from-stone-50 to-stone-100/90 p-4 rounded-3xl border border-stone-200/90 shadow-2xs">
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-xs font-black uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
              <i data-lucide="link-2" class="w-4 h-4 text-amber-800"></i> Canals Directes & Xarxes
            </span>
            ${d.is_casajou ? `
              <span class="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-rose-100 text-amber-950 border border-amber-300 shadow-2xs flex items-center gap-1">
                🍇 Xarxa Casajou
              </span>
            ` : (d.priority ? `
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Nivell: ${d.priority}
              </span>
            ` : '')}
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <!-- Botó Lloc Web -->
            ${d.website ? `
              <a href="${d.website}" target="_blank" 
                 class="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs rounded-xl border border-stone-300 flex items-center gap-2 shadow-2xs transition-all active:scale-95 group">
                <i data-lucide="globe" class="w-4 h-4 text-stone-500 group-hover:text-amber-800 transition-colors"></i>
                <span class="truncate max-w-[200px]">${webHost || 'Lloc Web'}</span>
                <i data-lucide="external-link" class="w-3 h-3 text-stone-400"></i>
              </a>
            ` : `
              <a href="https://www.google.com/search?q=${encodeURIComponent(d.name + ' ' + d.country + ' vino distribuidor')}" target="_blank" 
                 class="px-3 py-2 bg-white hover:bg-stone-50 text-stone-500 font-semibold text-xs rounded-xl border border-dashed border-stone-300 flex items-center gap-1.5 transition-all">
                <i data-lucide="search" class="w-3.5 h-3.5 text-stone-400"></i> Cercar web a Google
              </a>
            `}

            <!-- Botó Instagram -->
            ${d.instagram ? `
              <a href="${d.instagram}" target="_blank" 
                 class="px-3.5 py-2 bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-2xs transition-all active:scale-95">
                <i data-lucide="instagram" class="w-4 h-4"></i>
                <span>${igHandle || 'Instagram'}</span>
                <i data-lucide="external-link" class="w-3 h-3 text-white/80"></i>
              </a>
            ` : `
              <a href="https://www.instagram.com/explore/tags/${encodeURIComponent(d.name.toLowerCase().replace(/[^a-z0-9]/g, ''))}/" target="_blank" 
                 class="px-3 py-2 bg-white hover:bg-rose-50 text-stone-500 hover:text-rose-700 font-semibold text-xs rounded-xl border border-dashed border-stone-300 flex items-center gap-1.5 transition-all">
                <i data-lucide="instagram" class="w-3.5 h-3.5 text-stone-400"></i> Cercar a Instagram
              </a>
            `}

            <!-- Botó WhatsApp ràpid si hi ha telèfon -->
            ${phoneNum ? `
              <a href="https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}" target="_blank" 
                 class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all active:scale-95">
                <i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp
              </a>
              <a href="tel:${phoneNum}" 
                 class="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all active:scale-95">
                <i data-lucide="phone" class="w-3.5 h-3.5"></i> Trucar
              </a>
            ` : ''}

            <!-- Botó Email -->
            ${emailAddr ? `
              <a href="mailto:${emailAddr}" 
                 class="px-3 py-2 bg-stone-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all active:scale-95">
                <i data-lucide="mail" class="w-3.5 h-3.5 text-amber-300"></i> Email
              </a>
            ` : ''}
          </div>
        </div>

        <!-- BLOC 1: CELLERS QUE PORTEN (CARTERA REPRESENTADA) -->
        <div class="bg-rose-50/60 border border-rose-200/90 rounded-3xl p-5 shadow-2xs">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h4 class="text-xs font-black uppercase text-rose-950 tracking-wider flex items-center gap-2">
              <i data-lucide="wine" class="w-4 h-4 text-rose-800"></i> 
              <span>Cellers que Porten / Cartera Representada (${rawWineries.length})</span>
            </h4>
            <span class="text-[11px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full">Portfoli</span>
          </div>

          ${rawWineries.length > 0 ? `
            <div class="flex flex-wrap gap-2 pt-1">
              ${rawWineries.map(w => {
                const isCasajou = w.toLowerCase().includes('casajou');
                const isCorp = CORPINNAT_CELLERS.some(c => w.toLowerCase().includes(c.toLowerCase()));
                if (isCasajou) {
                  return `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-100 via-rose-100 to-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                      <span class="text-sm">🍇</span> ${w}
                      <span class="text-[9px] bg-amber-900 text-amber-200 px-1.5 py-0.2 rounded-md font-extrabold uppercase">Casajou</span>
                    </span>
                  `;
                }
                if (isCorp) {
                  return `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-stone-900 border border-amber-300 shadow-2xs">
                      <span class="text-sm">🍾</span> ${w}
                      <span class="text-[9px] bg-amber-800 text-amber-100 px-1.5 py-0.2 rounded-md font-extrabold">Corpinnat</span>
                    </span>
                  `;
                }
                return `
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-stone-800 border border-stone-200 shadow-2xs">
                    <span class="text-sm">🍷</span> ${w}
                  </span>
                `;
              }).join('')}
            </div>
          ` : `
            <p class="text-xs text-stone-500 font-medium">Aquest distribuïdor gestiona cellers de terrer a la seva zona comercial.</p>
          `}
        </div>

        <!-- BLOC 2: QUIN TIPUS DE CELLERS PORTEN (FILOSOFIA I PERFIL DE CATÀLEG) -->
        <div class="bg-amber-50/60 border border-amber-200/90 rounded-3xl p-5 shadow-2xs">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h4 class="text-xs font-black uppercase text-amber-950 tracking-wider flex items-center gap-2">
              <i data-lucide="sparkles" class="w-4 h-4 text-amber-800"></i>
              <span>Quin Tipus de Cellers Porten (Filosofia & Perfil)</span>
            </h4>
            <span class="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">Tipologia</span>
          </div>

          <!-- Descripció detallada del focus -->
          <div class="bg-white p-4 rounded-2xl border border-amber-200/70 mb-3.5 shadow-2xs">
            <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800 block mb-1">Perfil de Selecció de Cellers:</span>
            <p class="text-sm font-bold text-stone-900 leading-relaxed">
              ${d.sparkling_focus || "Cellers familiars amb vinya pròpia, viticultura ecològica i vins de terrer singulars."}
            </p>
          </div>

          <!-- Tipus de distribuïdor, Canals i Especialitats -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="bg-white/80 p-3 rounded-2xl border border-amber-100">
              <span class="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Tipus de Distribuïdor:</span>
              <span class="font-extrabold text-stone-900">${d.distribution_type || 'Distribuïdor de Vins'}</span>
            </div>
            <div class="bg-white/80 p-3 rounded-2xl border border-amber-100">
              <span class="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Canals Comercials:</span>
              <span class="font-extrabold text-stone-900">${d.channels || 'HORECA, Vinoteques'}</span>
            </div>
          </div>

          <!-- Tags d'especialitat -->
          ${(d.specialty_tags && d.specialty_tags.length > 0) ? `
            <div class="mt-3 flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-bold text-stone-400 mr-1">Especialitats:</span>
              ${d.specialty_tags.map(t => `
                <span class="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-stone-700 text-xs font-bold shadow-2xs">
                  ${t}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- BLOC 3: CONDICIONS COMERCIALS & VINS ESCUMOSOS -->
        <div class="bg-stone-50 rounded-3xl p-5 border border-stone-200">
          <h4 class="text-xs font-black uppercase text-stone-500 tracking-wider mb-3 flex items-center gap-2">
            <i data-lucide="receipt" class="w-4 h-4 text-stone-700"></i> Condicions Comercials & Venda
          </h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div class="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Incoterm</span>
              <span class="text-sm font-black text-amber-900">${d.incoterm || 'EXW'}</span>
            </div>
            <div class="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Termini Pagament</span>
              <span class="text-sm font-black text-stone-800">${d.payment_terms || '30 dies'}</span>
            </div>
            <div class="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Comanda Mín. (MOQ)</span>
              <span class="text-sm font-black text-stone-800">${d.moq || '1 Palet'}</span>
            </div>
            <div class="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Marge / Comissió</span>
              <span class="text-sm font-black text-stone-800">${d.margin_commission || 'Estàndard'}</span>
            </div>
          </div>
        </div>

        <!-- BLOC 4: DADES DE L'EMPRESA & SEU -->
        <div class="bg-stone-50 rounded-3xl p-5 border border-stone-200">
          <h4 class="text-xs font-black uppercase text-stone-500 tracking-wider mb-3 flex items-center gap-2">
            <i data-lucide="building-2" class="w-4 h-4 text-stone-700"></i> Dades Generals & Magatzem
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Raó Social</span>
              <span class="font-bold text-stone-800">${d.legal_name || d.name}</span>
            </div>
            <div>
              <span class="text-stone-400 block text-[10px] font-bold uppercase">NIF / CAE / Tax ID</span>
              <span class="font-mono font-bold text-stone-800">${d.tax_id || 'No informat'}</span>
            </div>
            <div class="sm:col-span-2">
              <span class="text-stone-400 block text-[10px] font-bold uppercase">Adreça o Magatzem</span>
              <div class="flex items-center justify-between gap-2 mt-0.5">
                <span class="font-bold text-stone-800">${d.address || d.city || d.country || 'Sense adreça especificada'}</span>
                ${(d.address || d.city) ? `
                  <a href="https://maps.google.com/?q=${encodeURIComponent((d.address ? d.address + ', ' : '') + (d.city || '') + ' ' + d.country)}" 
                     target="_blank" class="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-300 text-xs font-bold flex items-center gap-1 shadow-2xs">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-600"></i> Maps
                  </a>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- BLOC 5: NOTES DE SEGUIMENT I VERIFICACIÓ -->
        <div class="bg-stone-50 rounded-3xl p-5 border border-stone-200">
          <h4 class="text-xs font-black uppercase text-stone-500 tracking-wider mb-2 flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-stone-700"></i> Notes del Dossier Comercial
          </h4>
          <p class="text-stone-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
            ${d.notes || 'Sense observacions adicionals.'}
          </p>
        </div>

        <!-- Botons inferiors -->
        <div class="flex items-center justify-between pt-2">
          <button onclick="deleteDistributor('${d.id}')" class="px-4 py-2 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar Distribuïdor
          </button>
          <button onclick="closeDetailModal()" class="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
            Tancar Fitxa
          </button>
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'contactes') {
    const contacts = d.contacts || [];
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Persones de Contacte (${contacts.length})</h4>
          <button onclick="showAddContactForm()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Afegir Contacte
          </button>
        </div>

        <div id="add-contact-form" class="hidden bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-4">
          <h5 class="text-xs font-bold text-amber-900 mb-3">Nou Contacte per a ${d.name}</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <input id="new-contact-name" placeholder="Nom complet *" class="p-2.5 rounded-xl border border-stone-300 bg-white" required>
            <input id="new-contact-role" placeholder="Càrrec (ex: Director de Compres, Sommelier)" class="p-2.5 rounded-xl border border-stone-300 bg-white">
            <input id="new-contact-email" placeholder="Correu electrònic" class="p-2.5 rounded-xl border border-stone-300 bg-white">
            <input id="new-contact-mobile" placeholder="Mòbil / WhatsApp" class="p-2.5 rounded-xl border border-stone-300 bg-white">
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button onclick="document.getElementById('add-contact-form').classList.add('hidden')" class="px-3.5 py-1.5 bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold">Cancel·lar</button>
            <button onclick="saveNewContact()" class="px-3.5 py-1.5 bg-amber-800 text-white rounded-xl text-xs font-bold">Guardar Contacte</button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          ${contacts.map(c => {
            const p = c.mobile || c.phone || '';
            return `
              <div class="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-stone-900 text-sm md:text-base">${c.name}</span>
                    ${c.is_primary ? '<span class="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">Principal</span>' : ''}
                  </div>
                  <div class="text-xs text-stone-500 font-medium mb-1">${c.role || 'Contacte comercial'}</div>
                  <div class="flex flex-wrap gap-4 text-xs text-stone-600">
                    ${c.email ? `<span class="flex items-center gap-1 font-mono"><i data-lucide="mail" class="w-3 h-3 text-stone-400"></i> ${c.email}</span>` : ''}
                    ${p ? `<span class="flex items-center gap-1 font-mono"><i data-lucide="phone" class="w-3 h-3 text-stone-400"></i> ${p}</span>` : ''}
                  </div>
                </div>
                
                <div class="flex items-center gap-2 shrink-0">
                  ${p ? `
                    <a href="https://wa.me/${p.replace(/[^0-9]/g, '')}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp
                    </a>
                    <a href="tel:${p}" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="phone" class="w-3.5 h-3.5"></i> Trucar
                    </a>
                  ` : ''}
                  ${c.email ? `
                    <a href="mailto:${c.email}" class="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i> Email
                    </a>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'seguiment') {
    const interactions = (d.interactions || []).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Historial de Tast de Vins, Fires i Trucades</h4>
          <button onclick="showAddInteractionForm()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Registrar Tast / Nota
          </button>
        </div>

        <div id="add-interaction-form" class="hidden bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-4">
          <h5 class="text-xs font-bold text-amber-900 mb-3">Registrar Interacció / Tast de Mostres</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Data:</label>
              <input id="new-int-date" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Tipus:</label>
              <select id="new-int-type" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white font-semibold">
                <option value="Tast de vins / Mostres">Tast de vins / Mostres</option>
                <option value="Fira (BWW, ProWein, Wine Paris)">Fira (BWW, ProWein, Wine Paris)</option>
                <option value="Reunió comercial">Reunió comercial</option>
                <option value="Trucada">Trucada de seguiment</option>
                <option value="Email">Correu electrònic</option>
                <option value="Comanda">Comanda tancada</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Resum ràpid:</label>
              <input id="new-int-summary" placeholder="Ex: Tast nova anyada Corpinnat" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white" required>
            </div>
          </div>
          <div class="mt-3 text-xs">
            <label class="block font-semibold text-stone-600 mb-1">Detalls i comentaris sobre el tast:</label>
            <textarea id="new-int-details" rows="2" placeholder="Comentaris del client sobre el vi, valoració de bombolla, preus acordats..." class="w-full p-2.5 rounded-xl border border-stone-300 bg-white"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Propera acció (Següent pas):</label>
              <input id="new-int-nextstep" placeholder="Ex: Enviar ampolles de mostra o tarifes EXW" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Data del proper pas:</label>
              <input id="new-int-nextdate" type="date" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button onclick="document.getElementById('add-interaction-form').classList.add('hidden')" class="px-3.5 py-1.5 bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold">Cancel·lar</button>
            <button onclick="saveNewInteraction()" class="px-3.5 py-1.5 bg-amber-800 text-white rounded-xl text-xs font-bold">Guardar</button>
          </div>
        </div>

        <div class="relative pl-6 border-l-2 border-amber-800/30 space-y-6">
          ${interactions.length === 0 ? '<div class="text-xs text-stone-400 italic py-4">Encara no hi ha cap interacció registrada.</div>' : ''}
          ${interactions.map(i => `
            <div class="relative group">
              <div class="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-amber-800 border-2 border-white"></div>
              <div class="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">${i.type}</span>
                  <span class="text-stone-400 font-semibold">${i.date}</span>
                </div>
                <h5 class="font-bold text-stone-900 text-sm mb-1">${i.summary}</h5>
                ${i.details ? `<p class="text-xs text-stone-600 mb-2 whitespace-pre-wrap">${i.details}</p>` : ''}
                ${i.next_step ? `
                  <div class="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2 text-stone-700">
                    <div><span class="font-bold text-amber-800">Propera acció:</span> ${i.next_step}</div>
                    ${i.next_date ? `<span class="text-stone-500 font-semibold shrink-0">📅 ${i.next_date}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'documents') {
    const docs = d.documents || [];
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Tarifes, Catàlegs i Fitxes Tècniques (${docs.length})</h4>
          <div>
            <input type="file" id="doc-file-input" class="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onchange="handleFileUpload(event)">
            <button onclick="document.getElementById('doc-file-input').click()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i> Pujar Nou PDF
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${docs.length === 0 ? '<div class="col-span-full text-xs text-stone-400 italic py-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">Cap document adjuntat encara. Pots pujar tarifes d’exportació o fitxes tècniques en PDF aquí.</div>' : ''}
          ${docs.map(doc => `
            <div class="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100">
                  <i data-lucide="file-text" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-xs md:text-sm text-stone-900 truncate">${doc.title}</div>
                  <div class="text-[11px] text-stone-400 truncate">${doc.file_name || 'Document PDF'} • ${doc.category || 'Tarifa'}</div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                ${doc.file_url && doc.file_url !== '#' ? `
                  <a href="${doc.file_url}" download="${doc.file_name}" class="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors" title="Descarregar">
                    <i data-lucide="download" class="w-4 h-4"></i>
                  </a>
                ` : `
                  <button onclick="showToast('Document registrat', 'info')" class="w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                `}
                <button onclick="deleteDocument('${doc.id}')" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-colors" title="Eliminar">
                  <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

function showAddContactForm() {
  document.getElementById('add-contact-form').classList.remove('hidden');
}

function saveNewContact() {
  const name = document.getElementById('new-contact-name').value.trim();
  if (!name) {
    showToast('El nom del contacte és obligatori', 'error');
    return;
  }
  const role = document.getElementById('new-contact-role').value.trim();
  const email = document.getElementById('new-contact-email').value.trim();
  const mobile = document.getElementById('new-contact-mobile').value.trim();

  const d = state.selectedDistributor;
  if (!d.contacts) d.contacts = [];
  
  const newContact = {
    id: 'c-' + Date.now(),
    name,
    role,
    email,
    mobile,
    phone: mobile,
    is_primary: d.contacts.length === 0
  };

  d.contacts.push(newContact);
  saveDistributorsLocally();
  render();
  showToast('Contacte afegit!', 'success');
}

function showAddInteractionForm() {
  document.getElementById('add-interaction-form').classList.remove('hidden');
}

function saveNewInteraction() {
  const summary = document.getElementById('new-int-summary').value.trim();
  if (!summary) {
    showToast('El resum de la interacció és obligatori', 'error');
    return;
  }

  const d = state.selectedDistributor;
  if (!d.interactions) d.interactions = [];

  const newInt = {
    id: 'int-' + Date.now(),
    date: document.getElementById('new-int-date').value,
    type: document.getElementById('new-int-type').value,
    summary,
    details: document.getElementById('new-int-details').value.trim(),
    next_step: document.getElementById('new-int-nextstep').value.trim(),
    next_date: document.getElementById('new-int-nextdate').value
  };

  d.interactions.unshift(newInt);
  saveDistributorsLocally();
  render();
  showToast('Interacció registrada correctament!', 'success');
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const d = state.selectedDistributor;
  if (!d.documents) d.documents = [];

  const reader = new FileReader();
  reader.onload = function(e) {
    const newDoc = {
      id: 'doc-' + Date.now(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      category: 'Tarifa / Fitxa Tècnica',
      file_name: file.name,
      file_size: file.size,
      file_url: e.target.result
    };
    d.documents.push(newDoc);
    saveDistributorsLocally();
    render();
    showToast('Fitxer ' + file.name + ' afegit a la fitxa!', 'success');
  };
  reader.readAsDataURL(file);
}

function deleteDocument(docId) {
  const d = state.selectedDistributor;
  if (!d || !d.documents) return;
  d.documents = d.documents.filter(doc => doc.id !== docId);
  saveDistributorsLocally();
  render();
  showToast('Document eliminat', 'info');
}

function deleteDistributor(id) {
  if (!confirm('Segur que vols eliminar aquest distribuïdor i totes les seves dades?')) return;
  state.distributors = state.distributors.filter(d => d.id !== id);
  saveDistributorsLocally();
  closeDetailModal();
  render();
  showToast('Distribuïdor eliminat', 'info');
}

// ========================================================
// MÒDUL D'ALTA AMB IA & DETECTOR DE DUPLICATS
// ========================================================

const GEMINI_API_KEY_STORAGE = 'crm_gemini_api_key';
let currentDuplicateDistributor = null;
let allowDuplicateSaveOnce = false;

// Helpers de normalització
function normalizeText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\b(co|company|sl|sarl|llc|inc|corp|ltd|gmbh|distribution|distribucio|distribucion|imports|import|vins|vinos|wines|selections)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInstagramHandle(input) {
  if (!input) return '';
  let str = input.toString().trim();
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '');
  str = str.replace(/^\/?@?/, '');
  str = str.split('?')[0].split('/')[0].trim().toLowerCase();
  return str;
}

function extractDomain(url) {
  if (!url) return '';
  let str = url.toString().trim().toLowerCase();
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
  if (str.startsWith('linktr.ee/')) {
    return str.split('?')[0].replace(/\/+$/, '');
  }
  return str.split('/')[0].split('?')[0].trim();
}

function findDuplicateDistributor({ name, instagram, website }) {
  if (!state || !state.distributors || !state.distributors.length) return null;
  
  const targetHandle = extractInstagramHandle(instagram);
  const targetDomain = extractDomain(website);
  const targetNameNorm = normalizeText(name);

  for (const d of state.distributors) {
    // 1. Coincidència per Instagram handle (la més fiable)
    if (targetHandle) {
      const distHandle = extractInstagramHandle(d.instagram);
      if (distHandle && distHandle === targetHandle) {
        return { matchType: 'Instagram (@' + distHandle + ')', distributor: d };
      }
    }

    // 2. Coincidència per domini web
    if (targetDomain && !['instagram.com', 'facebook.com', 'google.com', 'linkedin.com'].includes(targetDomain)) {
      const distDomain = extractDomain(d.website);
      if (distDomain && distDomain === targetDomain) {
        return { matchType: 'Lloc Web (' + distDomain + ')', distributor: d };
      }
    }

    // 3. Coincidència per nom normalitzat
    if (targetNameNorm && targetNameNorm.length >= 4) {
      const distNameNorm = normalizeText(d.name);
      const distLegalNorm = normalizeText(d.legal_name);
      
      if (distNameNorm === targetNameNorm || distLegalNorm === targetNameNorm) {
        return { matchType: 'Nom (' + d.name + ')', distributor: d };
      }
      
      if (targetNameNorm.length >= 6 && distNameNorm.length >= 6) {
        if (distNameNorm.includes(targetNameNorm) || targetNameNorm.includes(distNameNorm)) {
          return { matchType: 'Nom similar (' + d.name + ')', distributor: d };
        }
      }
    }
  }

  return null;
}

function checkDuplicateInForm() {
  const nameEl = document.getElementById('new-name');
  const igEl = document.getElementById('new-instagram');
  const webEl = document.getElementById('new-website');

  const name = nameEl ? nameEl.value : '';
  const instagram = igEl ? igEl.value : '';
  const website = webEl ? webEl.value : '';

  const warnBox = document.getElementById('duplicate-warning-box');
  const warnMsg = document.getElementById('duplicate-warning-msg');
  const successBox = document.getElementById('ai-success-box');

  if (!name.trim() && !instagram.trim() && !website.trim()) {
    if (warnBox) warnBox.classList.add('hidden');
    currentDuplicateDistributor = null;
    return;
  }

  const result = findDuplicateDistributor({ name, instagram, website });

  if (result) {
    currentDuplicateDistributor = result.distributor;
    if (warnBox && warnMsg) {
      warnMsg.innerHTML = 'Ja tens registrat <strong>"' + result.distributor.name + '"</strong> (' + (result.distributor.country || 'Sense país') + ') per coincidència de <strong>' + result.matchType + '</strong>.';
      warnBox.classList.remove('hidden');
    }
    if (successBox) successBox.classList.add('hidden');
  } else {
    currentDuplicateDistributor = null;
    if (warnBox) warnBox.classList.add('hidden');
  }
}

function dismissDuplicateWarning() {
  allowDuplicateSaveOnce = true;
  const warnBox = document.getElementById('duplicate-warning-box');
  if (warnBox) warnBox.classList.add('hidden');
  showToast("Avís de duplicat omès. Pots guardar el registre.", "info");
}

function goToExistingDistributor() {
  if (!currentDuplicateDistributor) return;
  const dist = currentDuplicateDistributor;
  closeAddDistributorModal();
  openDetailModal(dist.id);
  showToast("S'ha obert la fitxa de: " + dist.name, "info");
}

function toggleApiKeyConfig() {
  const box = document.getElementById('gemini-key-box');
  if (box) {
    box.classList.toggle('hidden');
    const input = document.getElementById('gemini-api-key-input');
    if (input && !box.classList.contains('hidden')) {
      input.value = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
      input.focus();
    }
  }
}

function saveGeminiApiKey() {
  const input = document.getElementById('gemini-api-key-input');
  if (!input) return;
  const key = input.value.trim();
  if (!key) {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    showToast('Clau de Gemini esborrada', 'info');
  } else {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    showToast('Clau de Gemini guardada correctament!', 'success');
  }
  const box = document.getElementById('gemini-key-box');
  if (box) box.classList.add('hidden');
}

function resetAiImage() {
  const preview = document.getElementById('ai-preview-container');
  if (preview) preview.classList.add('hidden');
  const img = document.getElementById('ai-preview-img');
  if (img) img.src = '';
  const fileInput = document.getElementById('ai-image-file-input');
  if (fileInput) fileInput.value = '';
}

function openAddDistributorModal(focusAi = false) {
  const modal = document.getElementById('new-dist-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  allowDuplicateSaveOnce = false;
  currentDuplicateDistributor = null;

  const keyInput = document.getElementById('gemini-api-key-input');
  if (keyInput) {
    keyInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  }

  const warnBox = document.getElementById('duplicate-warning-box');
  if (warnBox) warnBox.classList.add('hidden');
  const successBox = document.getElementById('ai-success-box');
  if (successBox) successBox.classList.add('hidden');
  resetAiImage();

  if (focusAi) {
    const fileInput = document.getElementById('ai-image-file-input');
    if (fileInput) setTimeout(() => fileInput.click(), 150);
  }

  if (window.lucide) lucide.createIcons();
}

function closeAddDistributorModal() {
  const modal = document.getElementById('new-dist-modal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function handleAiImageFile(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    processAiImageBlob(file);
  }
}

// Compressió i redimensionament ultraràpid en memòria (Canvas HTML5)
// Redueix fotos i captures d'iPhone de 10-15MB a només ~180KB en 50ms,
// multiplicant per 10 la velocitat de pujada i d'anàlisi de Gemini
function compressImageForAi(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = function(e) {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = function() {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64Data = compressedDataUrl.split(',')[1];
          const sizeKb = Math.round((base64Data.length * 3) / 4 / 1024);

          resolve({
            dataUrl: compressedDataUrl,
            base64Data: base64Data,
            mimeType: 'image/jpeg',
            width,
            height,
            sizeKb
          });
        } catch (err) {
          console.warn('Canvas compression fallback:', err);
          resolve(null);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function processAiImageBlob(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast("Només es permeten fitxers d'imatge (PNG, JPG, WEBP, etc.)", 'error');
    return;
  }

  const previewContainer = document.getElementById('ai-preview-container');
  const previewImg = document.getElementById('ai-preview-img');
  const statusText = document.getElementById('ai-status-text');
  const statusDetail = document.getElementById('ai-status-detail');

  if (previewContainer) previewContainer.classList.remove('hidden');
  if (statusText) statusText.innerText = "⚡ Optimitzant imatge en memòria...";
  if (statusDetail) statusDetail.innerText = "Comprimint resolució per a lectura instantània...";

  const startTime = performance.now();
  let base64Data = '';
  let mimeType = 'image/jpeg';
  let dataUrl = '';

  // Redimensionar i optimitzar imatge
  const compressed = await compressImageForAi(file, 1200, 0.85);
  if (compressed && compressed.base64Data) {
    base64Data = compressed.base64Data;
    mimeType = compressed.mimeType;
    dataUrl = compressed.dataUrl;
    console.log(`Imatge optimitzada a ${compressed.width}x${compressed.height} (${compressed.sizeKb} KB) en ${(performance.now() - startTime).toFixed(0)}ms`);
  } else {
    // Fallback lectura directa si el navegador no té canvas
    dataUrl = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.readAsDataURL(file);
    });
    base64Data = dataUrl.split(',')[1];
    mimeType = file.type || 'image/jpeg';
  }

  if (previewImg) previewImg.src = dataUrl;
  if (statusText) statusText.innerText = "🤖 Llegint dades amb Gemini Flash...";
  if (statusDetail) statusDetail.innerText = "Extracció d'empresa, @instagram, país, ciutat i cellers...";

  analyzeImageWithGemini(base64Data, mimeType, startTime);
}

async function analyzeImageWithGemini(base64Data, mimeType, startTime = performance.now()) {
  const apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
  const statusText = document.getElementById('ai-status-text');
  const statusDetail = document.getElementById('ai-status-detail');

  if (!apiKey) {
    toggleApiKeyConfig();
    if (statusText) statusText.innerText = "Configura la clau gratuïta de Google Gemini";
    if (statusDetail) statusDetail.innerText = "Introdueix la teva clau per activar la lectura automàtica d'Instagram.";
    showToast("Introdueix la clau gratuïta de Gemini per analitzar imatges", "warning");
    return;
  }

  const promptText = `Ets un expert sommelier i director d'exportació de vins i escumosos d'autor (Corpinnat, Champagne de vignerons, vins naturals).
Analitza amb precisió aquesta imatge (captura de pantalla d'un compte d'Instagram, perfil comercial, targeta de visita, full de tast o catàleg d'un distribuïdor / importador de vi).
Extreu i retorna ÚNICAMENT un objecte JSON vàlid sense cap text addicional ni blocs de markdown amb aquests camps exactes:
{
  "name": "Nom comercial de l'empresa o distribuïdor",
  "legal_name": "Raó social o el mateix nom",
  "country": "País principal en català (ex: Estats Units, Dinamarca, França, Espanya, etc.)",
  "city": "Ciutat, regió o estats coberts (ex: Nova York, NY/NJ/CT/FL, Barcelona, Madrid)",
  "address": "Adreça si apareix, o buit",
  "website": "Lloc web o linktr.ee si apareix",
  "instagram": "Enllaç complet a Instagram (ex: https://www.instagram.com/handle/) o @handle",
  "distribution_type": "Tipus de distribució (ex: Importador & Distribuïdor, Prescriptor / Tastador, Cave à vins)",
  "channels": "Canals de venda (ex: HORECA Gastronomia, Restaurants Michelin, Wine Bars, Vinoteques)",
  "related_wineries": "Llista dels cellers o productors que es veuen a les ampolles, llista de tast o posts (separats per comes)",
  "sparkling_focus": "Descripció del focus en vins escumosos i de vignerons (ex: Vins de terrer, escumosos de vigneron, mínima intervenció)",
  "notes": "Comentaris sobre el tast, la bio o perfil comercial"
}`;

  // Priorització directa de models ultraràpids (evitem la crida prèvia GET /models per no afegir latència)
  let candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-pro'];

  // Si a la sessió ja s'ha verificat un model que funciona, situar-lo el primer
  const cachedModel = sessionStorage.getItem('gemini_working_model');
  if (cachedModel && candidateModels.includes(cachedModel)) {
    candidateModels = [cachedModel, ...candidateModels.filter(m => m !== cachedModel)];
  }

  let rawText = null;
  let lastError = null;

  for (const model of candidateModels) {
    try {
      if (statusDetail) {
        statusDetail.innerText = `Processant dades amb ${model}...`;
      }

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 800,
          temperature: 0.1
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const cand = data.candidates && data.candidates[0];
        if (cand && cand.content && cand.content.parts) {
          rawText = cand.content.parts.map(p => p.text || '').join('').trim();
        }
        if (rawText) {
          sessionStorage.setItem('gemini_working_model', model);
          break;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error ? errJson.error.message : ('Error HTTP ' + res.status);
        lastError = new Error(errMsg);

        // Si el model té alta demanda o falla, passem immediatament al següent sense bloquejar l'usuari
        console.warn(`Model ${model} ha retornat error (${res.status}): ${errMsg}. Provant següent...`);
      }
    } catch (err) {
      lastError = err;
      console.warn(`Error connectant amb ${model}:`, err);
    }

    if (rawText) break;
  }

  // Fallback opcional: si cap dels 3 models directes funciona, fem una llista ràpida
  if (!rawText) {
    try {
      if (statusDetail) statusDetail.innerText = "Cercant model de reserva a Google...";
      const listRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey));
      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.models && Array.isArray(listData.models)) {
          const alternateModels = listData.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(m => !candidateModels.includes(m) && (m.includes('flash') || m.includes('pro')));

          for (const altModel of alternateModels.slice(0, 2)) {
            const altUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + altModel + ':generateContent?key=' + encodeURIComponent(apiKey);
            const res = await fetch(altUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: promptText }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } }] }],
                generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800, temperature: 0.1 }
              })
            });
            if (res.ok) {
              const data = await res.json();
              const cand = data.candidates && data.candidates[0];
              if (cand && cand.content && cand.content.parts) {
                rawText = cand.content.parts.map(p => p.text || '').join('').trim();
              }
              if (rawText) {
                sessionStorage.setItem('gemini_working_model', altModel);
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error en fallback de models:", e);
    }
  }

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);

  if (!rawText) {
    const errorMsg = lastError ? (lastError.message || String(lastError)) : "Google té els servidors saturats en aquest moment. Espera uns segons i torna-ho a provar.";
    if (statusText) statusText.innerText = "⚠️ Error o alta demanda a Google";
    if (statusDetail) statusDetail.innerText = errorMsg;
    showToast("Avís: " + errorMsg, "error");
    return;
  }

  try {
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    fillFormWithAiData(parsedData);
    if (statusText) statusText.innerText = `✨ Dades extretes en ${elapsedSec}s!`;
    if (statusDetail) statusDetail.innerText = "Les dades s'han bolcat automàticament al formulari.";
  } catch (parseErr) {
    console.error("Error parsejant JSON de Gemini:", rawText);
    if (statusText) statusText.innerText = "⚠️ Error de format de resposta";
    if (statusDetail) statusDetail.innerText = "La IA no ha retornat un format JSON vàlid.";
    showToast("Error en el format de dades de la IA", "error");
  }
}

function fillFormWithAiData(data) {
  if (!data) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
    }
  };

  if (data.name) setVal('new-name', data.name);
  if (data.legal_name) setVal('new-legal-name', data.legal_name);
  if (data.country) setVal('new-country', data.country);
  if (data.city) setVal('new-city', data.city);
  if (data.address) setVal('new-address', data.address);
  if (data.website) setVal('new-website', data.website);

  if (data.instagram) {
    let ig = data.instagram.trim();
    if (ig.startsWith('@')) ig = 'https://www.instagram.com/' + ig.replace('@', '') + '/';
    else if (!ig.startsWith('http')) ig = 'https://www.instagram.com/' + ig + '/';
    setVal('new-instagram', ig);
  }

  if (data.distribution_type) setVal('new-type', data.distribution_type);
  if (data.channels) setVal('new-channels', data.channels);
  if (data.related_wineries) setVal('new-wineries', data.related_wineries);
  if (data.sparkling_focus) setVal('new-focus', data.sparkling_focus);
  if (data.notes) setVal('new-notes', data.notes);

  checkDuplicateInForm();

  const warnBox = document.getElementById('duplicate-warning-box');
  const successBox = document.getElementById('ai-success-box');
  const successMsg = document.getElementById('ai-success-msg');

  if (!warnBox || warnBox.classList.contains('hidden')) {
    if (successBox) {
      if (successMsg) successMsg.innerHTML = "<strong>" + (data.name || "Importador nou") + "</strong> detectat! Dades omplertes amb IA. Revisa-les i fes clic a Guardar.";
      successBox.classList.remove('hidden');
    }
    showToast("Dades de " + (data.name || "l'importador") + " omplertes amb IA!", 'success');
  } else {
    showToast('Atenció: Aquest importador ja està creat a la base de dades!', 'warning');
  }
}

function saveNewDistributorForm(e) {
  e.preventDefault();
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const name = getVal('new-name');
  const country = getVal('new-country');
  const instagram = getVal('new-instagram');
  const website = getVal('new-website');
  
  if (!name || !country) {
    showToast('El Nom Comercial i el País són obligatoris', 'error');
    return;
  }

  const duplicateResult = findDuplicateDistributor({ name, instagram, website });
  if (duplicateResult && !allowDuplicateSaveOnce) {
    currentDuplicateDistributor = duplicateResult.distributor;
    const warnBox = document.getElementById('duplicate-warning-box');
    const warnMsg = document.getElementById('duplicate-warning-msg');
    if (warnBox && warnMsg) {
      warnMsg.innerHTML = 'Ja tens registrat <strong>"' + duplicateResult.distributor.name + '"</strong> (' + (duplicateResult.distributor.country || 'Sense país') + '). Fes clic a <em>"Veure fitxa existent"</em> per consultar-lo o a <em>"Continuar igualment"</em> per forçar la creació.';
      warnBox.classList.remove('hidden');
      warnBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast('Ja existeix un importador amb ' + duplicateResult.matchType, 'warning');
    return;
  }

  const newDist = {
    id: 'dist-' + Date.now(),
    name: name,
    legal_name: getVal('new-legal-name') || name,
    country: country,
    city: getVal('new-city'),
    address: getVal('new-address'),
    website: website,
    instagram: instagram,
    tax_id: getVal('new-tax-id'),
    status: getVal('new-status') || 'Potencial',
    distribution_type: getVal('new-type') || 'Importador & Distribuïdor',
    channels: getVal('new-channels') || 'HORECA, Vinoteques',
    incoterm: getVal('new-incoterm') || 'EXW',
    payment_terms: getVal('new-payment') || '30 dies',
    currency: 'EUR',
    moq: getVal('new-moq') || '1 Palet',
    margin_commission: getVal('new-margin') || '30%',
    sparkling_focus: getVal('new-focus') || 'Vins escumosos i de vignerons',
    annual_volume: getVal('new-volume') || 'Mitjà',
    related_wineries: getVal('new-wineries'),
    notes: getVal('new-notes'),
    specialty_tags: ['Afegit amb IA'],
    contacts: [],
    interactions: [
      {
        id: 'int-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'Alta de Contacte',
        notes: "Creat al sistema amb assistència de lectura d'imatge IA."
      }
    ],
    documents: [],
    province: getVal('new-city'),
    region: country
  };

  const contactName = getVal('new-contact-person');
  if (contactName) {
    newDist.contacts.push({
      id: 'c-' + Date.now(),
      name: contactName,
      role: getVal('new-contact-role') || 'Contacte Comercial',
      email: getVal('new-contact-email'),
      mobile: getVal('new-contact-mobile'),
      phone: getVal('new-contact-mobile'),
      is_primary: true
    });
  }

  state.distributors.unshift(newDist);
  saveDistributorsLocally();
  closeAddDistributorModal();
  render();
  openDetailModal(newDist.id);
  showToast('Nou distribuïdor "' + name + '" afegit amb èxit!', 'success');
}

function initAiScannerAndDuplicateListeners() {
  const dropzone = document.getElementById('ai-scanner-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('border-amber-500', 'bg-amber-900/20');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('border-amber-500', 'bg-amber-900/20');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length) {
        processAiImageBlob(files[0]);
      }
    }, false);
  }

  window.addEventListener('paste', (e) => {
    const modal = document.getElementById('new-dist-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData)) ? (e.clipboardData || e.originalEvent.clipboardData).items : null;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            processAiImageBlob(blob);
            e.preventDefault();
            break;
          }
        }
      }
    }
  });

  ['new-name', 'new-instagram', 'new-website'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        checkDuplicateInForm();
      });
    }
  });
}


function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast("La llibreria Excel s'està carregant...", "warning");
    return;
  }

  const rows = state.distributors.map(d => {
    const c = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || {};
    return {
      'Nom Distribuïdor': d.name,
      'Raó Social': d.legal_name || '',
      'País': d.country,
      'Ciutat / Província': d.city || '',
      'Estat': d.status,
      'Prioritat': d.priority || '',
      'Tipus Distribució': d.distribution_type || '',
      'Cellers a Cartera': d.related_wineries || '',
      'Focus Escumosos': d.sparkling_focus || '',
      'Instagram': d.instagram || '',
      'Lloc Web': d.website || '',
      'Contacte Principal': c.name || '',
      'Email Contacte': c.email || '',
      'Telèfon / WhatsApp': c.mobile || c.phone || '',
      'Incoterm': d.incoterm || '',
      'Terminis Pagament': d.payment_terms || '',
      'Comanda Mínima (MOQ)': d.moq || '',
      'Notes & Verificació': d.notes || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dr. Comercial - Distribuïdors');
  XLSX.writeFile(wb, 'Dr_Comercial_Distribuidors_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showToast('Base de dades exportada a Excel!', 'success');
}

function triggerExcelImport() {
  document.getElementById('excel-file-input').click();
}

function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (!jsonData || jsonData.length === 0) {
        showToast('El fitxer Excel està buit', 'error');
        return;
      }

      let importedCount = 0;
      jsonData.forEach((row, index) => {
        const name = row['Nom Distribuïdor'] || row['Nom'] || row['Empresa'] || row['Name'] || row['Company'] || row['Actor'];
        const country = row['País'] || row['Pais'] || row['Country'] || 'Espanya';

        if (name) {
          const newDist = {
            id: 'dist-import-' + Date.now() + '-' + index,
            name: String(name),
            legal_name: String(row['Raó Social'] || row['Legal Name'] || name),
            country: String(country),
            city: String(row['Ciutat / Província'] || row['Ciutat'] || row['Província'] || row['City'] || ''),
            address: String(row['Adreça'] || row['Address'] || ''),
            status: String(row['Estat'] || row['Status'] || 'Actiu'),
            distribution_type: String(row['Tipus Distribució'] || row['Type'] || 'Distribuïdor'),
            related_wineries: String(row['Cellers a Cartera'] || row['Celler(s) relacionat(s)'] || ''),
            sparkling_focus: String(row['Focus Escumosos'] || row['Especialitat Escumosos'] || ''),
            instagram: String(row['Instagram'] || ''),
            website: String(row['Lloc Web'] || row['Web'] || row['website'] || ''),
            incoterm: String(row['Incoterm'] || 'EXW'),
            payment_terms: String(row['Terminis Pagament'] || '30 dies'),
            moq: String(row['Comanda Mínima (MOQ)'] || '1 Palet'),
            notes: String(row['Notes & Verificació'] || row['Notes'] || ''),
            specialty_tags: ['Importat d’Excel'],
            contacts: [],
            interactions: [],
            documents: []
          };

          const contactName = row['Contacte Principal'] || row['Contacte'] || row['Contact'];
          const phone = row['Telèfon / WhatsApp'] || row['Telèfon'] || row['Phone'] || row['Mòbil'];
          const email = row['Email Contacte'] || row['Email'] || row['Correu'];

          if (contactName || phone || email) {
            newDist.contacts.push({
              id: 'c-imp-' + Date.now() + '-' + index,
              name: String(contactName || 'Contacte Principal'),
              role: String(row['Càrrec'] || 'Comercial'),
              email: String(email || ''),
              mobile: String(phone || ''),
              phone: String(phone || ''),
              is_primary: true
            });
          }

          state.distributors.push(newDist);
          importedCount++;
        }
      });

      saveDistributorsLocally();
      render();
      showToast(`S’han importat ${importedCount} distribuïdors amb èxit!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error en llegir l’Excel: " + err.message, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function openCloudModal() {
  document.getElementById('cloud-url').value = state.supabaseConfig.url || '';
  document.getElementById('cloud-key').value = state.supabaseConfig.key || '';
  document.getElementById('cloud-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCloudModal() {
  document.getElementById('cloud-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function saveSupabaseConfig() {
  const url = document.getElementById('cloud-url').value.trim();
  const key = document.getElementById('cloud-key').value.trim();

  state.supabaseConfig = { url, key, connected: false };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(state.supabaseConfig));

  if (url && key && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(url, key);
      state.supabaseConfig.connected = true;
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(state.supabaseConfig));
      showToast('Credencials desades! Prova ara la sincronització.', 'success');
      updateSyncIndicator();
      closeCloudModal();
    } catch (e) {
      showToast('Error amb les dades de connexió', 'error');
    }
  } else {
    showToast("S'ha restablert el mode Local", "info");
    updateSyncIndicator();
    closeCloudModal();
  }
}

function updateSyncIndicator() {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;

  if (state.supabaseConfig.connected) {
    badge.className = 'cursor-pointer text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 flex items-center gap-1.5 hover:bg-emerald-900 transition-colors shrink-0';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span class="hidden md:inline">Núvol Actiu</span><span class="md:hidden text-[10px]">Núvol</span>';
  } else {
    badge.className = 'cursor-pointer text-[11px] font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-stone-800/90 text-stone-300 border border-stone-700 flex items-center gap-1.5 hover:bg-stone-700 transition-colors shrink-0';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> <span class="hidden md:inline">Mode Local</span><span class="md:hidden text-[10px]">Local</span>';
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-all duration-300 transform translate-y-0 opacity-100 ' +
    (type === 'success' ? 'bg-emerald-800' : type === 'error' ? 'bg-rose-800' : type === 'warning' ? 'bg-amber-800' : 'bg-stone-900');

  setTimeout(() => {
    toast.className += ' translate-y-12 opacity-0 pointer-events-none';
  }, 3500);
}

function resetFilters() {
  state.searchQuery = '';
  state.filterProvince = 'Totes';
  state.filterCity = 'Totes';
  state.filterStatus = 'Tots';
  state.filterCountry = 'Tots';
  state.filterZone = 'Totes';
  state.filterRegion = 'Totes';
  state.filterSpecialty = 'Totes';
  state.filterWinery = 'Tots';
  state.quickOnlyActive = false;
  state.quickOnlyInstagram = false;
  state.quickOnlyPriority = false;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  if (document.getElementById('filter-status')) document.getElementById('filter-status').value = 'Tots';
  if (document.getElementById('filter-country')) document.getElementById('filter-country').value = 'Tots';
  if (document.getElementById('filter-zone')) document.getElementById('filter-zone').value = 'Totes';
  if (document.getElementById('filter-specialty')) document.getElementById('filter-specialty').value = 'Totes';
  if (document.getElementById('filter-winery')) document.getElementById('filter-winery').value = 'Tots';

  // Restablir botons de filtres ràpids
  const btnAct = document.getElementById('btn-quick-active');
  if (btnAct) btnAct.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-800 font-semibold text-stone-700 transition-all text-xs';
  const btnIg = document.getElementById('btn-quick-instagram');
  if (btnIg) btnIg.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-rose-400 hover:text-rose-800 font-semibold text-stone-700 transition-all text-xs';
  const btnPrio = document.getElementById('btn-quick-priority');
  if (btnPrio) btnPrio.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-amber-500 hover:text-amber-900 font-semibold text-stone-700 transition-all text-xs';

  setMainTab('all');
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) {
        if (state.searchQuery) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      renderDistributorsList();
      updateActiveChips();
    });
  }

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    renderDistributorsList();
  });

  document.getElementById('filter-country').addEventListener('change', (e) => {
    state.filterCountry = e.target.value;
    renderDistributorsList();
  });

  document.getElementById('filter-specialty').addEventListener('change', (e) => {
    state.filterSpecialty = e.target.value;
    renderDistributorsList();
  });

  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) {
    zoneSelect.addEventListener('change', (e) => {
      state.filterZone = e.target.value;
      renderDistributorsList();
    });
  }

  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) {
    winerySelect.addEventListener('change', (e) => {
      state.filterWinery = e.target.value;
      setQuickFilter('winery', e.target.value);
    });
  }

  document.getElementById('view-grid-btn').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('view-grid-btn').className = 'p-1.5 rounded-xl bg-amber-800 text-white';
    document.getElementById('view-table-btn').className = 'p-1.5 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200';
    renderDistributorsList();
  });

  document.getElementById('view-table-btn').addEventListener('click', () => {
    state.viewMode = 'table';
    document.getElementById('view-table-btn').className = 'p-1.5 rounded-xl bg-amber-800 text-white';
    document.getElementById('view-grid-btn').className = 'p-1.5 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200';
    renderDistributorsList();
  });

  initAiScannerAndDuplicateListeners();
}

document.addEventListener('DOMContentLoaded', initApp);


// ==========================================
// NATIVE iOS & MOBILE ENHANCEMENTS
// ==========================================
function mobileNavSelect(tab) {
  setMainTab(tab);
  
  // Desplaçament suau cap al selector de filtres o distribuïdors
  const target = document.getElementById('sub-filters-container') || document.getElementById('distributors-container');
  if (target) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = rect.top + scrollTop - 75; // compensació de la capçalera fixa
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }
}

function forceRefreshApp() {
  showToast('🔄 Netejant memòria cau i recarregant versió nova...', 'info');
  try {
    if (window.caches) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }
  } catch(e) {}
  
  setTimeout(() => {
    const cleanUrl = window.location.href.split('?')[0];
    window.location.replace(cleanUrl + '?v=' + Date.now());
  }, 300);
}

function setCasajouSubFilter(cat) {
  state.filterCasajouCategory = cat;
  document.querySelectorAll('.casajou-subpill').forEach(b => {
    b.className = 'casajou-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });
  
  let targetId = 'subpill-casajou-all';
  if (cat === 'distribuidor') targetId = 'subpill-casajou-dist';
  if (cat === 'importador') targetId = 'subpill-casajou-imp';
  if (cat === 'prescriptor') targetId = 'subpill-casajou-somm';
  
  const activeBtn = document.getElementById(targetId);
  if (activeBtn) {
    activeBtn.className = 'casajou-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }
  
  render();
  updateActiveChips();
}

// ========================================================
// SISTEMA DE FILTRES GEOGRÀFICS DINÀMICS COMPLETS (v23)
// Espanya: 52 Províncies + 116 Ciutats
// Estats Units: 50 Estats + 83 Ciutats
// Internacional: 24 Països + 100 Ciutats
// ========================================================

const SPAIN_PROVINCE_MAPPING = [
  ['Barcelona', ['barcelona', 'penedès', 'osona', 'bages', 'llobregat', 'cabrera', 'sitges', 'igualada', 'manresa', 'vic', 'vilanova', 'badalona', 'sabadell', 'terrassa']],
  ['Girona', ['girona', 'empordà', 'figueres', 'costa brava', 'olot', 'palafrugell', 'blanes', 'roses', 'palamós']],
  ['Lleida', ['lleida', 'urgell', 'segarra', 'pirineu', 'cerdanya', 'arreu', 'balaguer', 'tàrrega', 'tremp']],
  ['Tarragona', ['tarragona', 'reus', 'priorat', "terres de l'ebre", 'tortosa', 'cambrils', 'salou', 'valls', 'el vendrell']],
  ['Madrid', ['madrid', 'alcalá', 'alcobendas', 'pozuelo', 'las rozas', 'getafe', 'leganés', 'majadahonda']],
  ['Balears', ['balears', 'baleares', 'mallorca', 'menorca', 'ibiza', 'eivissa', 'formentera', 'palma', 'manacor', 'ciutadella', 'maó']],
  ['València', ['valència', 'valencia', 'gandia', 'sagunt', 'paterna', 'torrent']],
  ['Alacant', ['alacant', 'alicante', 'elx', 'elche', 'denia', 'altea', 'benidorm', 'xàbia', 'torrevella']],
  ['Castelló', ['castelló', 'castellon', 'vila-real', 'borriana', 'vinaròs']],
  ['Biscaia', ['bizkaia', 'vizcaya', 'bilbao', 'getxo', 'barakaldo', 'durango', 'portugalete']],
  ['Guipúscoa', ['guipúzcoa', 'guipúscoa', 'donostia', 'san sebastián', 'irun', 'errenteria', 'zarautz']],
  ['Àlaba', ['álava', 'àlaba', 'vitoria', 'gasteiz', 'amurrio']],
  ['Navarra', ['navarra', 'pamplona', 'irunya', 'tudela', 'estella']],
  ['La Rioja', ['rioja', 'logronyo', 'logroño', 'haro', 'calahorra', 'arnedo']],
  ['Astúries', ['astúries', 'asturias', 'oviedo', 'gijón', 'aviles', 'mieres', 'siero']],
  ['Cantàbria', ['cantàbria', 'cantabria', 'santander', 'torrelavega', 'castro urdiales', 'laredo']],
  ['Saragossa', ['zaragoza', 'saragossa', 'calatayud', 'tarazona', 'ejea']],
  ['Osca', ['huesca', 'osca', 'barbastro', 'monzón', 'jaca']],
  ['Terol', ['teruel', 'terol', 'alcañiz', 'andorra terol']],
  ['Sevilla', ['sevilla', 'dos hermanas', 'alcalá de guadaíra', 'utrera', 'écija']],
  ['Màlaga', ['màlaga', 'málaga', 'marbella', 'ronda', 'estepona', 'fuengirola', 'antequera']],
  ['Cadis', ['cadis', 'cádiz', 'jerez', 'el puerto', 'sanlucar', 'algesires', 'chiclana']],
  ['Còrdova', ['còrdova', 'córdoba', 'montilla', 'lucena', 'puente genil']],
  ['Granada', ['granada', 'motril', 'baza', 'loja', 'guadix']],
  ['Almeria', ['almeria', 'almería', 'roquetas', 'el ejido', 'níjar']],
  ['Jaén', ['jaén', 'ubeda', 'úbeda', 'baeza', 'linares', 'andújar']],
  ['Huelva', ['huelva', 'almonte', 'lepe', 'isla cristina']],
  ['La Corunya', ['corunya', 'coruña', 'santiago de compostela', 'ferrol', 'betanzos', 'ribeira']],
  ['Pontevedra', ['pontevedra', 'vigo', 'vilagarcía', 'redondela', 'marín']],
  ['Ourense', ['ourense', 'orense', 'verín', 'o barco']],
  ['Lugo', ['lugo', 'monforte', 'viveiro', 'ribadeo']],
  ['Valladolid', ['valladolid', 'medina del campo', 'peñafiel', 'tordesillas']],
  ['Burgos', ['burgos', 'aranda de duero', 'miranda de ebro', 'lerma']],
  ['Lleó', ['lleó', 'león', 'ponferrada', 'astorga']],
  ['Salamanca', ['salamanca', 'béjar', 'ciudad rodrigo']],
  ['Segòvia', ['segòvia', 'segovia', 'cuéllar']],
  ['Sòria', ['sòria', 'soria', 'el burgo de osma']],
  ['Palència', ['palència', 'palencia', 'aguilar de campoo']],
  ['Àvila', ['àvila', 'ávila', 'arévalo']],
  ['Zamora', ['zamora', 'toro', 'benavente']],
  ['Toledo', ['toledo', 'talavera', 'illescas']],
  ['Ciudad Real', ['ciudad real', 'valdepeñas', 'puertollano', 'alcázar de san juan']],
  ['Albacete', ['albacete', 'hellín', 'villarrobledo', 'almansa']],
  ['Conca', ['cuenca', 'conca', 'tarancón']],
  ['Guadalajara', ['guadalajara', 'azuqueca']],
  ['Múrcia', ['murcia', 'múrcia', 'cartagena', 'jumilla', 'lorca', 'caravaca']],
  ['Las Palmas', ['las palmas', 'grancanaria', 'fuerteventura', 'lanzarote', 'telde', 'arrecife']],
  ['Santa Cruz de Tenerife', ['tenerife', 'la palma', 'la gomera', 'el hierro', 'la laguna', 'arona']],
  ['Canàries', ['canàries', 'canarias']],
  ['Badajoz', ['badajoz', 'merida', 'mérida', 'almendralejo', 'zafra']],
  ['Càceres', ['cáceres', 'càceres', 'plasencia', 'navalmoral', 'trujillo']],
  ['Ceuta', ['ceuta']],
  ['Melilla', ['melilla']]
];

const USA_STATE_MAPPING = [
  ['Nova York (NY)', ['nova york', 'new york', 'brooklyn', 'manhattan', 'queens', 'ny']],
  ['Califòrnia (CA)', ['califòrnia', 'california', 'los angeles', 'san francisco', 'oakland', 'napa', 'sonoma', 'benicia', 'brentwood', 'ca']],
  ['Florida (FL)', ['florida', 'miami', 'tampa', 'orlando', 'fl']],
  ['Illinois (IL)', ['illinois', 'chicago', 'il']],
  ['Texas (TX)', ['texas', 'austin', 'dallas', 'houston', 'tx']],
  ['Washington (WA)', ['washington', 'seattle', 'wa']],
  ['Oregon (OR)', ['oregon', 'portland', 'or']],
  ['Colorado (CO)', ['colorado', 'denver', 'boulder', 'aspen', 'co']],
  ['Geòrgia (GA)', ['geòrgia', 'georgia', 'atlanta', 'ga']],
  ['Massachusetts (MA)', ['massachusetts', 'boston', 'cambridge', 'ma']],
  ['Carolina del Nord (NC)', ['carolina del nord', 'north carolina', 'charlotte', 'durham', 'asheville', 'nc']],
  ['Nova Jersey (NJ)', ['nova jersey', 'new jersey', 'newark', 'nj']],
  ['Connecticut (CT)', ['connecticut', 'ct']],
  ['Pennsilvània (PA)', ['pennsilvània', 'pennsylvania', 'filadèlfia', 'philadelphia', 'pa']],
  ['Washington DC', ['washington dc', 'dc']],
  ['Louisiana (LA)', ['louisiana', 'nova orleans', 'new orleans', 'la']],
  ['Michigan (MI)', ['michigan', 'detroit', 'mi']],
  ['Missouri (MO)', ['missouri', 'st. louis', 'kansas city', 'mo']],
  ['Minnesota (MN)', ['minnesota', 'minneapolis', 'mn']],
  ['Montana (MT)', ['montana', 'bozeman', 'mt']],
  ['Ohio (OH)', ['ohio', 'cincinnati', 'cleveland', 'columbus', 'oh']],
  ['Oklahoma (OK)', ['oklahoma', 'oklahoma city', 'ok']],
  ['Utah (UT)', ['utah', 'salt lake', 'ut']],
  ['Vermont (VT)', ['vermont', 'burlington', 'vt']],
  ['Wisconsin (WI)', ['wisconsin', 'milwaukee', 'wi']],
  ['Iowa (IA)', ['iowa', 'des moines', 'ia']],
  ['Maine (ME)', ['maine', 'portland maine', 'me']],
  ['Delaware (DE)', ['delaware', 'de']],
  ['Carolina del Sud (SC)', ['carolina del sud', 'south carolina', 'charleston', 'sc']]
];

function getDistributorProvince(d) {
  const text = [d.province || '', d.region || '', d.city || '', (d.specialty_tags || []).join(' ')].join(' ').toLowerCase();
  for (const [provName, keywords] of SPAIN_PROVINCE_MAPPING) {
    for (const kw of keywords) {
      if (text.includes(kw)) return provName;
    }
  }
  return d.province || 'Altres Províncies';
}

function getDistributorUsaState(d) {
  const text = [d.province || '', d.region || '', d.city || '', (d.specialty_tags || []).join(' ')].join(' ').toLowerCase();
  for (const [stateName, keywords] of USA_STATE_MAPPING) {
    for (const kw of keywords) {
      if (text.includes(kw)) return stateName;
    }
  }
  return d.province || 'Altres Estats';
}

function initGeographicFilters() {
  const dists = state.distributors || [];

  // 1. ESPANYA: Províncies i Ciutats
  const spainDists = dists.filter(d => (d.country || '').includes('Espanya') || (d.country || '').includes('Spain'));
  const provCount = {};
  spainDists.forEach(d => {
    const p = getDistributorProvince(d);
    provCount[p] = (provCount[p] || 0) + 1;
  });

  const provSelect = document.getElementById('spain-province-select');
  if (provSelect) {
    let opts = '<option value="Totes">📍 Totes les Províncies (' + spainDists.length + ')</option>';
    const sortedProvs = Object.keys(provCount).sort((a, b) => provCount[b] - provCount[a]);
    sortedProvs.forEach(p => {
      opts += `<option value="${p}">${p} (${provCount[p]})</option>`;
    });
    provSelect.innerHTML = opts;
  }
  updateSpainCitiesSelect('Totes');

  // 2. ESTATS UNITS: Estats i Ciutats
  const usaDists = dists.filter(d => (d.country || '').includes('Estats Units') || (d.country || '').includes('EUA') || (d.country || '').includes('USA'));
  const stateCount = {};
  usaDists.forEach(d => {
    const s = getDistributorUsaState(d);
    stateCount[s] = (stateCount[s] || 0) + 1;
  });

  const usaStateSelect = document.getElementById('usa-state-select');
  if (usaStateSelect) {
    let opts = '<option value="Tots">🗺️ Tots els Estats dels EUA (' + usaDists.length + ')</option>';
    const sortedStates = Object.keys(stateCount).sort((a, b) => stateCount[b] - stateCount[a]);
    sortedStates.forEach(s => {
      opts += `<option value="${s}">${s} (${stateCount[s]})</option>`;
    });
    usaStateSelect.innerHTML = opts;
  }
  updateUsaCitiesSelect('Tots');

  // 3. INTERNACIONAL: Països i Ciutats
  const intlDists = dists.filter(d => !spainDists.includes(d) && !usaDists.includes(d));
  const countryCount = {};
  intlDists.forEach(d => {
    const c = (d.country || '').trim() || 'Altres Països';
    countryCount[c] = (countryCount[c] || 0) + 1;
  });

  const intlCountrySelect = document.getElementById('intl-country-select');
  if (intlCountrySelect) {
    let opts = '<option value="Tots">🌍 Tots els Països (' + intlDists.length + ')</option>';
    const sortedCountries = Object.keys(countryCount).sort((a, b) => countryCount[b] - countryCount[a]);
    sortedCountries.forEach(c => {
      const flag = COUNTRY_FLAGS[c] || '🌍';
      opts += `<option value="${c}">${flag} ${c} (${countryCount[c]})</option>`;
    });
    intlCountrySelect.innerHTML = opts;
  }
  updateIntlCitiesSelect('Tots');

  // 4. CORPINNAT: 24 Cellers
  populateCorpinnatWinerySelect();
}

function updateSpainCitiesSelect(selectedProvince = 'Totes') {
  const citySelect = document.getElementById('spain-city-select');
  if (!citySelect) return;

  const spainDists = (state.distributors || []).filter(d => (d.country || '').includes('Espanya') || (d.country || '').includes('Spain'));
  const filtered = (selectedProvince === 'Totes') ? spainDists : spainDists.filter(d => getDistributorProvince(d) === selectedProvince);

  const cityCount = {};
  filtered.forEach(d => {
    const c = (d.city || '').trim();
    if (c) cityCount[c] = (cityCount[c] || 0) + 1;
  });

  let opts = '<option value="Totes">🏙️ Totes les Ciutats (' + Object.keys(cityCount).length + ')</option>';
  const sortedCities = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a]);
  sortedCities.forEach(c => {
    opts += `<option value="${c}">${c} (${cityCount[c]})</option>`;
  });
  citySelect.innerHTML = opts;
}

function updateUsaCitiesSelect(selectedState = 'Tots') {
  const citySelect = document.getElementById('usa-city-select');
  if (!citySelect) return;

  const usaDists = (state.distributors || []).filter(d => (d.country || '').includes('Estats Units') || (d.country || '').includes('EUA') || (d.country || '').includes('USA'));
  const filtered = (selectedState === 'Tots') ? usaDists : usaDists.filter(d => getDistributorUsaState(d) === selectedState);

  const cityCount = {};
  filtered.forEach(d => {
    const c = (d.city || '').trim();
    if (c) cityCount[c] = (cityCount[c] || 0) + 1;
  });

  let opts = '<option value="Totes">🏙️ Totes les Ciutats (' + Object.keys(cityCount).length + ')</option>';
  const sortedCities = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a]);
  sortedCities.forEach(c => {
    opts += `<option value="${c}">${c} (${cityCount[c]})</option>`;
  });
  citySelect.innerHTML = opts;
}

function updateIntlCitiesSelect(selectedCountry = 'Tots') {
  const citySelect = document.getElementById('intl-city-select');
  if (!citySelect) return;

  const intlDists = (state.distributors || []).filter(d => !(d.country || '').includes('Espanya') && !(d.country || '').includes('Estats Units'));
  const filtered = (selectedCountry === 'Tots') ? intlDists : intlDists.filter(d => (d.country || '').trim() === selectedCountry);

  const cityCount = {};
  filtered.forEach(d => {
    const c = (d.city || '').trim();
    if (c) cityCount[c] = (cityCount[c] || 0) + 1;
  });

  let opts = '<option value="Totes">🏙️ Totes les Ciutats (' + Object.keys(cityCount).length + ')</option>';
  const sortedCities = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a]);
  sortedCities.forEach(c => {
    opts += `<option value="${c}">${c} (${cityCount[c]})</option>`;
  });
  citySelect.innerHTML = opts;
}

function populateCorpinnatWinerySelect() {
  const winerySelect = document.getElementById('filter-winery');
  if (!winerySelect) return;

  const wineries = [
    'Recaredo', 'Gramona', 'Llopart', 'Nadal', 'Torelló', 'Can Feixes', 'Júlia Bernet',
    'Mas Candí', 'Can Descregut', 'Pardas', 'Bufadors', 'Celler Kripta (Agustí Torelló Mata)',
    'Sabartés', "Castell d'Encús", 'Celler Batllori', 'AT Roca', 'Mas Bertran', 'Colet',
    'Raventós i Blanc', 'Clos Lentiscus', 'Celler Sanstravé', 'Eudald Massana', 'Enric Soler', 'Sicus'
  ];

  let opts = '<option value="Tots">🍾 Tots els 24 Cellers de Corpinnat</option>';
  wineries.forEach(w => {
    opts += `<option value="${w}">🍾 ${w}</option>`;
  });
  winerySelect.innerHTML = opts;
}

function handleSpainProvinceChange(prov) {
  state.filterProvince = prov;
  state.filterCity = 'Totes';
  state.filterRegion = 'Totes';
  updateSpainCitiesSelect(prov);
  render();
  updateActiveChips();
}

function handleSpainCityChange(city) {
  state.filterCity = city;
  render();
  updateActiveChips();
}

function setSpainQuickFilter(zone) {
  document.querySelectorAll('.spain-quick-pill').forEach(b => {
    b.className = 'spain-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  const provSelect = document.getElementById('spain-province-select');

  if (zone === 'Tots') {
    state.filterProvince = 'Totes';
    state.filterRegion = 'Totes';
    state.filterCity = 'Totes';
    if (provSelect) provSelect.value = 'Totes';
    const allBtn = document.getElementById('subpill-spain-all');
    if (allBtn) allBtn.className = 'spain-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
  } else {
    const isReg = ['Catalunya', 'País Basc', 'Andalusia', 'Galícia'].includes(zone);
    if (isReg) {
      state.filterRegion = zone;
      state.filterProvince = 'Totes';
      if (provSelect) provSelect.value = 'Totes';
    } else {
      state.filterRegion = 'Totes';
      state.filterProvince = zone;
      if (provSelect) provSelect.value = zone;
    }
    state.filterCity = 'Totes';
    const cleanId = 'subpill-spain-' + zone.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'spain-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
  }

  updateSpainCitiesSelect(state.filterProvince);
  render();
  updateActiveChips();
}

function handleUsaStateChange(stateName) {
  state.filterProvince = stateName;
  state.filterCity = 'Totes';
  updateUsaCitiesSelect(stateName);
  render();
  updateActiveChips();
}

function handleUsaCityChange(city) {
  state.filterCity = city;
  render();
  updateActiveChips();
}

function setUsaQuickFilter(stateName) {
  document.querySelectorAll('.usa-quick-pill').forEach(b => {
    b.className = 'usa-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  const stateSelect = document.getElementById('usa-state-select');

  if (stateName === 'Tots') {
    state.filterProvince = 'Totes';
    state.filterCity = 'Totes';
    if (stateSelect) stateSelect.value = 'Tots';
    const allBtn = document.getElementById('subpill-usa-all');
    if (allBtn) allBtn.className = 'usa-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
  } else {
    state.filterProvince = stateName;
    state.filterCity = 'Totes';
    if (stateSelect) {
      for (let i = 0; i < stateSelect.options.length; i++) {
        if (stateSelect.options[i].value.includes(stateName)) {
          stateSelect.selectedIndex = i;
          break;
        }
      }
    }
    const cleanId = 'subpill-usa-' + stateName.toLowerCase().slice(0, 2);
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'usa-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
  }

  updateUsaCitiesSelect(state.filterProvince);
  render();
  updateActiveChips();
}

function handleIntlCountryChange(country) {
  state.filterCountry = country;
  state.filterCity = 'Totes';
  updateIntlCitiesSelect(country);
  render();
  updateActiveChips();
}

function handleIntlCityChange(city) {
  state.filterCity = city;
  render();
  updateActiveChips();
}

function setIntlQuickFilter(country) {
  document.querySelectorAll('.intl-quick-pill').forEach(b => {
    b.className = 'intl-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  const countrySelect = document.getElementById('intl-country-select');

  if (country === 'Tots') {
    state.filterCountry = 'Tots';
    state.filterCity = 'Totes';
    if (countrySelect) countrySelect.value = 'Tots';
    const allBtn = document.getElementById('subpill-intl-all');
    if (allBtn) allBtn.className = 'intl-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
  } else {
    state.filterCountry = country;
    state.filterCity = 'Totes';
    if (countrySelect) countrySelect.value = country;
    const mapPill = {
      'Alemanya': 'subpill-intl-de',
      'Països Baixos': 'subpill-intl-nl',
      'Regne Unit': 'subpill-intl-uk',
      'Canadà': 'subpill-intl-ca',
      'Dinamarca': 'subpill-intl-dk',
      'Japó': 'subpill-intl-jp',
      'Suècia': 'subpill-intl-se',
      'Suïssa': 'subpill-intl-ch'
    };
    const pillId = mapPill[country];
    if (pillId) {
      const activeBtn = document.getElementById(pillId);
      if (activeBtn) activeBtn.className = 'intl-quick-pill px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-900 text-white shadow-2xs shrink-0';
    }
  }

  updateIntlCitiesSelect(state.filterCountry);
  render();
  updateActiveChips();
}

function handleCorpinnatWineryChange(winery) {
  state.filterWinery = winery;
  render();
  updateActiveChips();
}

function handleStatusFilterChange(status) {
  state.filterStatus = status;
  render();
  updateActiveChips();
}

function handleSpecialtyFilterChange(spec) {
  state.filterSpecialty = spec;
  render();
  updateActiveChips();
}
