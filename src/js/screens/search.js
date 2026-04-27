// screens/search.js — Search TVDB / add series (Tizen-optimized, Sonarr)
const SearchScreen = (() => {
  let debounceTimer = null;
  let lastQuery = '';

  function render(host) {
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'search-wrap';
    wrap.innerHTML =
      '<div class="search-bar">' +
        '<input id="s-input" class="input" type="text" data-nav placeholder="Search for a TV show title…">' +
      '</div>' +
      '<div id="s-status" class="search-status">Type a title then press \u25bc to browse results.</div>' +
      '<div id="s-results" class="search-results movie-grid-static" style="display:none;"></div>';
    host.appendChild(wrap);

    const $in = document.getElementById('s-input');
    $in.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = $in.value.trim();
      if (q.length < 2) {
        document.getElementById('s-status').style.display = 'block';
        document.getElementById('s-status').textContent = 'Type at least 2 characters…';
        document.getElementById('s-results').style.display = 'none';
        return;
      }
      debounceTimer = setTimeout(() => doSearch(q), 600);
    });

    setTimeout(() => Nav.focus($in), 16);
  }

  async function doSearch(q) {
    if (q === lastQuery) return;
    lastQuery = q;
    const $st = document.getElementById('s-status');
    const $res = document.getElementById('s-results');
    $st.style.display = 'block';
    $st.textContent = 'Searching…';
    $res.style.display = 'none';
    try {
      const results = await SonarrAPI.lookup.search(q);
      if (!results || !results.length) {
        $st.textContent = 'No results.';
        return;
      }
      $st.style.display = 'none';
      $res.style.display = 'grid';
      $res.innerHTML = '';
      const cap = results.slice(0, 40);
      const frag = document.createDocumentFragment();
      cap.forEach(r => frag.appendChild(card(r)));
      $res.appendChild(frag);
      Nav.invalidateCache();
    } catch (e) {
      $st.textContent = 'Search failed: ' + e.message;
    }
  }

  function card(r) {
    const inLib = !!(r.id || Store.state.series.find(s => s.tvdbId === r.tvdbId));
    const el = document.createElement('div');
    el.className = 'movie-card';
    el.dataset.nav = '';

    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap';
    wrap.style.height = '300px';   // search uses static grid — explicit height required
    const ph = document.createElement('div');
    ph.className = 'poster-placeholder';
    ph.textContent = r.title || '';
    wrap.appendChild(ph);

    const posterUrl = pickImage(r, 'poster');
    if (posterUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.opacity = '0';
      img.onload = () => { img.style.opacity = '1'; ph.style.display = 'none'; };
      img.onerror = () => { img.remove(); };
      // Lookup results are usually external (TVDB CDN) — always proxy via remoteImgSrc.
      img.src = SonarrAPI.remoteImgSrc(posterUrl, 200);
      wrap.appendChild(img);
    }

    if (inLib) {
      const b = document.createElement('div');
      b.className = 'badges';
      b.innerHTML = '<div class="badge ok">In Library</div>';
      wrap.appendChild(b);
    }

    el.appendChild(wrap);
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = r.year ? (r.title + ' (' + r.year + ')') : r.title;
    el.appendChild(t);

    el.addEventListener('click', () => {
      if (inLib) { Toast.show('Already in library', 'info'); return; }
      openAddOverlay(r);
    });
    return el;
  }

  function pickImage(r, type) {
    if (!r.images) return null;
    const img = r.images.find(i => i.coverType === type);
    return img ? (img.remoteUrl || img.url) : null;
  }

  function openAddOverlay(r) {
    const previousFocus = Nav.current;
    const root = document.getElementById('modal-root');
    root.innerHTML = '';

    const profiles  = Store.state.qualityProfiles;
    const folders   = Store.state.rootFolders;
    const langs     = (Store.state.languageProfiles || []).filter(l => l && l.name && l.name.toLowerCase() !== 'deprecated');

    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal" style="min-width:640px;">' +
        '<h2>Add ' + esc(r.title) + (r.year ? (' (' + r.year + ')') : '') + '</h2>' +
        '<p style="color:var(--muted);max-height:140px;overflow:auto;">' + esc(r.overview || '') + '</p>' +
        '<div class="field"><label>Quality Profile</label><div id="qp-dd" class="dropdown"></div></div>' +
        (langs.length ? '<div class="field"><label>Language Profile</label><div id="lp-dd" class="dropdown"></div></div>' : '') +
        '<div class="field"><label>Root Folder</label><div id="rf-dd" class="dropdown"></div></div>' +
        '<div class="field"><label>Monitor</label><div id="mn-dd" class="dropdown"></div></div>' +
        '<div class="modal-actions">' +
          '<button class="btn" data-nav id="add-cancel">Cancel</button>' +
          '<button class="btn btn-primary" data-nav id="add-confirm">+ Add Series</button>' +
        '</div>' +
      '</div>';
    root.appendChild(back);

    const modal = back.querySelector('.modal');
    Nav.setScope(modal);

    const monitorOpts = [
      { id: 'all',     label: 'All Episodes' },
      { id: 'future',  label: 'Future Episodes Only' },
      { id: 'missing', label: 'Missing Episodes' },
      { id: 'existing',label: 'Existing Episodes' },
      { id: 'pilot',   label: 'Pilot' },
      { id: 'firstSeason', label: 'First Season' },
      { id: 'latestSeason', label: 'Latest Season' },
      { id: 'none',    label: 'None' },
    ];

    const state = {
      profileId: profiles[0] && profiles[0].id,
      languageProfileId: langs[0] && langs[0].id,
      rootPath:  folders[0]  && folders[0].path,
      monitor:   'all',
    };

    buildPickerDropdown('qp-dd', profiles.map(p => ({ id: p.id, label: p.name })),
      state.profileId, (id) => { state.profileId = id; });
    if (langs.length) {
      buildPickerDropdown('lp-dd', langs.map(l => ({ id: l.id, label: l.name })),
        state.languageProfileId, (id) => { state.languageProfileId = id; });
    }
    buildPickerDropdown('rf-dd', folders.map(f => ({ id: f.path, label: f.path })),
      state.rootPath, (id) => { state.rootPath = id; });
    buildPickerDropdown('mn-dd', monitorOpts, state.monitor, (id) => { state.monitor = id; });

    function close() {
      Nav.clearScope();
      root.innerHTML = '';
      if (previousFocus) Nav.focus(previousFocus);
    }
    document.getElementById('add-cancel').addEventListener('click', close);
    document.getElementById('add-confirm').addEventListener('click', async () => {
      const confirmBtn = document.getElementById('add-confirm');
      confirmBtn.disabled = true;
      const origText = confirmBtn.textContent;
      confirmBtn.textContent = 'Adding…';
      try {
        const body = {
          title: r.title,
          tvdbId: r.tvdbId,
          year:   r.year,
          qualityProfileId: state.profileId,
          rootFolderPath:   state.rootPath,
          monitored: state.monitor !== 'none',
          seasonFolder: true,
          seriesType: r.seriesType || 'standard',
          titleSlug: r.titleSlug,
          images: r.images || [],
          seasons: r.seasons || [],
          addOptions: {
            monitor: state.monitor,
            searchForMissingEpisodes: state.monitor !== 'none' && state.monitor !== 'future',
            searchForCutoffUnmetEpisodes: false,
          },
        };
        if (langs.length && state.languageProfileId) {
          body.languageProfileId = state.languageProfileId;
        }
        const added = await SonarrAPI.series.add(body);
        Toast.show('Added to library', 'success');
        if (added && added.id) {
          Store.state.series.push(Store.slimSeries(added));
        }
        Store.state.seriesLoadedAt = 0;
        close();
        if (added && added.id) {
          App.navigate('detail', { seriesId: added.id });
        }
      } catch (e) {
        Toast.show('Add failed: ' + e.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = origText;
      }
    });
    setTimeout(() => Nav.focus(document.getElementById('add-confirm')), 16);
  }

  function buildPickerDropdown(hostId, items, selectedId, onPick) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const sel = items.find(i => i.id === selectedId) || items[0];
    host.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'dropdown-btn';
    btn.dataset.nav = '';
    btn.textContent = (sel ? sel.label : '—') + ' ▾';
    host.appendChild(btn);
    let menu = null;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu) { menu.remove(); menu = null; return; }
      menu = document.createElement('div');
      menu.className = 'dropdown-menu';
      items.forEach(it => {
        const o = document.createElement('div');
        o.className = 'dropdown-item';
        o.dataset.nav = '';
        o.textContent = it.label;
        o.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onPick(it.id);
          btn.textContent = it.label + ' ▾';
          menu.remove(); menu = null;
          Nav.invalidateCache();
          Nav.focus(btn);
        });
        menu.appendChild(o);
      });
      host.appendChild(menu);
      Nav.invalidateCache();
      setTimeout(() => Nav.focus(menu.querySelector('.dropdown-item')), 10);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  return { render: render, openAddOverlay: openAddOverlay };
})();
