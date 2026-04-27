// screens/discover.js — TMDB-powered discovery (TV)
const DiscoverScreen = (function () {
  let _state = { tab: 'trending', genreId: null };

  function render(host) {
    if (typeof TMDB === 'undefined' || !TMDB.hasKey()) {
      host.innerHTML = '<div class="empty-state" style="padding:48px 32px;">' +
        '<h2>Discover unavailable</h2>' +
        '<p style="color:var(--muted);">No TMDB API key was injected at build time. ' +
        'Set <code>TMDB_API_KEY</code> when running build.sh, or set ' +
        '<code>localStorage[\'tmdb-api-key\']</code> in DevTools for local testing.</p>' +
        '</div>';
      return;
    }
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'discover-screen';
    wrap.innerHTML =
      '<div class="discover-tabs" id="d-tabs">' +
        '<button class="pill active" data-nav data-tab="trending">Trending</button>' +
        '<button class="pill" data-nav data-tab="topRated">Top Rated</button>' +
      '</div>' +
      '<div class="genre-pills" id="d-genres"></div>' +
      '<div id="d-status" class="search-status">Loading…</div>' +
      '<div id="d-grid" class="movie-grid-static" style="display:none;"></div>';
    host.appendChild(wrap);

    document.querySelectorAll('#d-tabs .pill').forEach(b => {
      b.addEventListener('click', () => switchTab(b.dataset.tab));
    });

    loadGenres();
    loadTab('trending');
    setTimeout(() => Nav.focus(document.querySelector('#d-tabs .pill')), 16);
  }

  function switchTab(tab) {
    _state.tab = tab; _state.genreId = null;
    document.querySelectorAll('#d-tabs .pill').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('#d-genres .pill').forEach(b => b.classList.remove('active'));
    loadTab(tab);
  }

  function loadGenres() {
    TMDB.genres().then(gs => {
      const host = document.getElementById('d-genres');
      if (!host) return;
      host.innerHTML = '';
      gs.forEach(g => {
        const b = document.createElement('button');
        b.className = 'pill'; b.dataset.nav = ''; b.textContent = g.name;
        b.addEventListener('click', () => {
          _state.tab = 'genre'; _state.genreId = g.id;
          document.querySelectorAll('#d-tabs .pill').forEach(x => x.classList.remove('active'));
          document.querySelectorAll('#d-genres .pill').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          loadGenre(g.id);
        });
        host.appendChild(b);
      });
      Nav.invalidateCache();
    }).catch(() => {});
  }

  function loadTab(tab) {
    const $st = document.getElementById('d-status');
    const $grid = document.getElementById('d-grid');
    $st.style.display = 'block'; $st.textContent = 'Loading…';
    $grid.style.display = 'none';
    const p = tab === 'topRated' ? TMDB.tv.topRated() : TMDB.tv.trending();
    p.then(d => renderResults((d && d.results) || []))
     .catch(e => { $st.textContent = 'Failed: ' + e.message; });
  }

  function loadGenre(id) {
    const $st = document.getElementById('d-status');
    const $grid = document.getElementById('d-grid');
    $st.style.display = 'block'; $st.textContent = 'Loading…';
    $grid.style.display = 'none';
    TMDB.tv.discover(id).then(d => renderResults((d && d.results) || []))
      .catch(e => { $st.textContent = 'Failed: ' + e.message; });
  }

  function renderResults(results) {
    const $st = document.getElementById('d-status');
    const $grid = document.getElementById('d-grid');
    if (!results.length) { $st.textContent = 'No results.'; return; }
    $st.style.display = 'none';
    $grid.style.display = 'grid';
    $grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    results.slice(0, 60).forEach(r => frag.appendChild(card(r)));
    $grid.appendChild(frag);
    Nav.invalidateCache();
  }

  function card(r) {
    const el = document.createElement('div');
    el.className = 'movie-card'; el.dataset.nav = '';
    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap'; wrap.style.height = '300px';
    const ph = document.createElement('div');
    ph.className = 'poster-placeholder'; ph.textContent = r.name || '';
    wrap.appendChild(ph);
    const purl = TMDB.posterUrl(r.poster_path);
    if (purl) {
      const img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.style.opacity = '0';
      img.onload = () => { img.style.opacity = '1'; ph.style.display = 'none'; };
      img.onerror = () => { img.remove(); };
      img.src = purl;
      wrap.appendChild(img);
    }
    el.appendChild(wrap);
    const t = document.createElement('div');
    t.className = 'title';
    const yr = (r.first_air_date || '').slice(0, 4);
    t.textContent = yr ? (r.name + ' (' + yr + ')') : r.name;
    el.appendChild(t);
    el.addEventListener('click', () => {
      Toast.show('Looking up…', 'info');
      TMDB.tv.externalIds(r.id).then(ids => {
        const tvdbId = ids && ids.tvdb_id;
        if (!tvdbId) throw new Error('No TVDB ID for this show');
        const found = Store.state.series.find(x => x.tvdbId === tvdbId);
        if (found) { App.navigate('detail', { seriesId: found.id }); return null; }
        return SonarrAPI.lookup.tvdb(tvdbId);
      }).then(lr => {
        if (lr === null) return;
        const result = Array.isArray(lr) ? lr[0] : lr;
        if (!result) { Toast.show('Series not found', 'error'); return; }
        if (typeof SearchScreen !== 'undefined' && SearchScreen.openAddOverlay) {
          SearchScreen.openAddOverlay(result);
        } else { Toast.show('Add overlay unavailable', 'error'); }
      }).catch(e => Toast.show('Lookup failed: ' + e.message, 'error'));
    });
    return el;
  }

  return { render: render };
})();
