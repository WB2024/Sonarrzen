// screens/detail.js — Series detail + season grid (Tizen-optimized, Sonarr)
const DetailScreen = (() => {
  function fmtBytes(n) {
    if (!n) return '0 B';
    const u = ['B','KB','MB','GB','TB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v >= 100 ? 0 : 1) + ' ' + u[i];
  }

  function render(host, params) {
    params = params || {};
    const id = params.seriesId || Store.state.selectedSeriesId;
    Store.state.selectedSeriesId = id;
    const slim = Store.state.series.find(x => x.id === id);
    if (!slim) {
      host.innerHTML = '<div class="empty-state"><h2>Series not found</h2></div>';
      return;
    }

    renderShell(host, slim);
    SonarrAPI.series.get(id).then(full => {
      enrichDetail(full || slim);
      renderSeasonGrid(full || slim);
      loadSimilar(full || slim);
    }).catch(() => {
      renderSeasonGrid(slim);
      loadSimilar(slim);
    });
  }

  function loadSimilar(s) {
    const host = document.getElementById('d-similar');
    if (!host || !s || !s.tvdbId) return;
    if (typeof TMDB === 'undefined' || !TMDB.hasKey()) return;
    TMDB.resolveToTmdbId(s.tvdbId).then(tmdbId => {
      if (!tmdbId) return null;
      return TMDB.tv.recommendations(tmdbId).then(d => {
        let r = (d && d.results) || [];
        if (r.length) return r;
        return TMDB.tv.similar(tmdbId).then(d2 => (d2 && d2.results) || []);
      });
    }).then(list => {
      list = (list || []).slice(0, 12);
      if (!list.length) { host.style.display = 'none'; return; }
      renderSimilarRail(host, list);
    }).catch(() => { host.style.display = 'none'; });
  }

  function renderSimilarRail(host, results) {
    host.style.display = 'block';
    host.innerHTML = '<h2 style="margin:24px 32px 12px;">You might also like</h2>' +
                     '<div class="similar-rail" id="d-rail"></div>';
    const rail = document.getElementById('d-rail');
    results.forEach(r => rail.appendChild(similarCard(r)));
    Nav.invalidateCache();
  }

  function similarCard(r) {
    const el = document.createElement('div');
    el.className = 'rail-card';
    el.dataset.nav = '';
    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap';
    wrap.style.height = '300px';
    const ph = document.createElement('div');
    ph.className = 'poster-placeholder';
    ph.textContent = r.name || '';
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
      // TMDB result → external_ids → tvdbId → Sonarr lookup → add overlay
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
        if (!result) { Toast.show('Series not found in Sonarr lookup', 'error'); return; }
        if (typeof SearchScreen !== 'undefined' && SearchScreen.openAddOverlay) {
          SearchScreen.openAddOverlay(result);
        } else { Toast.show('Add overlay not available', 'error'); }
      }).catch(e => Toast.show('Lookup failed: ' + e.message, 'error'));
    });
    return el;
  }

  function renderShell(host, s) {
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'detail-wrap';

    const rating = (s.ratings && s.ratings.value) || 0;
    const pct = (s.statistics && s.statistics.percentOfEpisodes) || 0;
    const status = (s.status === 'ended' ? 'Ended' :
                    s.status === 'continuing' ? 'Continuing' :
                    s.status === 'upcoming' ? 'Upcoming' : (s.status || '—')) +
                   (s.monitored ? '' : ' (Unmonitored)');

    wrap.innerHTML =
      '<div class="detail-top">' +
        '<div class="detail-poster"><img id="d-poster" alt=""></div>' +
        '<div class="detail-info">' +
          '<h1>' + esc(s.title) + (s.year ? ' <span style="color:var(--muted);font-weight:400;">(' + s.year + ')</span>' : '') + '</h1>' +
          '<div class="meta" id="d-meta">' + (rating ? ('★ ' + rating.toFixed(1)) : '') + '</div>' +
          '<div class="overview" id="d-overview">Loading…</div>' +
          '<dl class="detail-stats" id="d-stats">' +
            '<dt>Status</dt><dd>' + esc(status) + '</dd>' +
            '<dt>Episodes</dt><dd>' + Math.round(pct) + '%</dd>' +
          '</dl>' +
          '<div class="detail-actions">' +
            '<button class="btn btn-primary" data-nav id="d-search">▶ Search All</button>' +
            '<button class="btn" data-nav id="d-monitor">' + (s.monitored ? '✓ Monitored' : '○ Unmonitored') + '</button>' +
            '<button class="btn btn-danger" data-nav id="d-delete">✕ Delete</button>' +
            '<button class="btn" data-nav id="d-back">← Back</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="season-screen-wrap"><h2 style="margin:8px 32px 0;">Seasons</h2><div class="season-grid" id="season-grid"></div></div>' +
      '<section id="d-similar" class="similar-section" style="display:none;"></section>';
    host.appendChild(wrap);

    const $img = document.getElementById('d-poster');
    $img.onerror = () => { $img.style.display = 'none'; };
    const src = SonarrAPI.posterImgSrc(s, 400);
    if (src) $img.src = src;

    document.getElementById('d-search').addEventListener('click', () => searchAll(s));
    document.getElementById('d-monitor').addEventListener('click', () => toggleMonitor(host, s));
    document.getElementById('d-delete').addEventListener('click', () => confirmDelete(s));
    document.getElementById('d-back').addEventListener('click', () => App.navigate('library'));

    setTimeout(() => Nav.focus(document.getElementById('d-search')), 16);
  }

  function enrichDetail(s) {
    const meta = document.getElementById('d-meta');
    const overview = document.getElementById('d-overview');
    const stats = document.getElementById('d-stats');
    if (!meta || !overview || !stats) return;

    const rating = (s.ratings && s.ratings.value) || 0;
    const stat = s.statistics || {};
    const pct = stat.percentOfEpisodes || 0;
    const epc = stat.episodeCount || 0;
    const epf = stat.episodeFileCount || 0;
    const size = stat.sizeOnDisk ? fmtBytes(stat.sizeOnDisk) : '—';
    const network = s.network || '—';
    const runtime = s.runtime ? (s.runtime + ' min') : '—';

    meta.innerHTML =
      (rating ? ('★ ' + rating.toFixed(1) + '  ·  ') : '') +
      esc(network) + '  ·  ' + esc(runtime);
    overview.textContent = s.overview || 'No overview available.';
    stats.innerHTML =
      '<dt>Status</dt><dd>' + esc((s.status === 'ended' ? 'Ended' : s.status === 'continuing' ? 'Continuing' : (s.status || '—')) + (s.monitored ? '' : ' (Unmonitored)')) + '</dd>' +
      '<dt>Episodes</dt><dd>' + epf + '/' + epc + ' (' + Math.round(pct) + '%)</dd>' +
      '<dt>Size</dt><dd>' + esc(size) + '</dd>' +
      '<dt>Network</dt><dd>' + esc(network) + '</dd>' +
      '<dt>Path</dt><dd style="color:var(--muted);font-size:15px;">' + esc(s.path || '—') + '</dd>';
  }

  function renderSeasonGrid(s) {
    const grid = document.getElementById('season-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const seasons = (s.seasons || []).filter(sn => {
      if (sn.seasonNumber > 0) return true;
      const st = sn.statistics || {};
      return (st.episodeCount || 0) > 0;
    });
    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
    if (!seasons.length) {
      grid.innerHTML = '<div style="color:var(--muted);padding:16px;">No seasons</div>';
      return;
    }
    seasons.forEach(sn => {
      const card = document.createElement('div');
      card.className = 'season-card';
      card.dataset.nav = '';
      const label = sn.seasonNumber === 0 ? 'Specials' : ('Season ' + sn.seasonNumber);
      const st = sn.statistics || {};
      const pct = Math.round(st.percentOfEpisodes || 0);
      const have = st.episodeFileCount || 0;
      const total = st.episodeCount || 0;
      const dot = pct >= 100 ? '✓' : (sn.monitored ? '●' : '○');
      const cls = pct >= 100 ? 'ok' : (have > 0 ? 'warn' : 'missing');
      card.innerHTML =
        '<div style="font-size:22px;font-weight:600;">' + esc(label) + '</div>' +
        '<div style="margin-top:8px;color:var(--muted);font-size:15px;">' + have + '/' + total + ' eps (' + pct + '%)</div>' +
        '<div style="margin-top:6px;" class="ep-status ' + cls + '">' + dot + (sn.monitored ? ' Monitored' : ' Unmonitored') + '</div>';
      card.addEventListener('click', () => {
        Store.state.selectedSeasonNumber = sn.seasonNumber;
        App.navigate('season', { seriesId: s.id, seasonNumber: sn.seasonNumber });
      });
      grid.appendChild(card);
    });
    Nav.invalidateCache();
  }

  async function toggleMonitor(host, s) {
    try {
      const full = await SonarrAPI.series.get(s.id);
      full.monitored = !full.monitored;
      await SonarrAPI.series.edit(s.id, full);
      const idx = Store.state.series.findIndex(x => x.id === s.id);
      if (idx >= 0) Store.state.series[idx] = Store.slimSeries(full);
      Toast.show(full.monitored ? 'Now monitoring' : 'Unmonitored', 'success');
      render(host, { seriesId: s.id });
    } catch (e) { Toast.show('Update failed: ' + e.message, 'error'); }
  }

  async function searchAll(s) {
    try {
      await SonarrAPI.command.seriesSearch(s.id);
      Toast.show('Searching all monitored episodes', 'success');
    } catch (e) {
      Toast.show('Search failed: ' + e.message, 'error');
    }
  }

  function confirmDelete(s) {
    const previousFocus = Nav.current;
    const root = document.getElementById('modal-root');
    root.innerHTML = '';

    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal" role="dialog">' +
        '<h2>Delete series?</h2>' +
        '<p>Remove <strong>' + esc(s.title) + '</strong> from Sonarr.<br>' +
           'Files on disk will <strong>not</strong> be deleted.</p>' +
        '<div class="modal-actions">' +
          '<button class="btn" data-nav id="m-cancel">Cancel</button>' +
          '<button class="btn btn-danger" data-nav id="m-confirm">Delete</button>' +
        '</div>' +
      '</div>';
    root.appendChild(back);

    const modal = back.querySelector('.modal');
    Nav.setScope(modal);
    setTimeout(() => Nav.focus(document.getElementById('m-cancel')), 16);

    function close() {
      Nav.clearScope();
      root.innerHTML = '';
      if (previousFocus) Nav.focus(previousFocus);
    }

    document.getElementById('m-cancel').addEventListener('click', close);
    document.getElementById('m-confirm').addEventListener('click', async () => {
      try {
        await SonarrAPI.series.del(s.id, false);
        Store.state.series = Store.state.series.filter(x => x.id !== s.id);
        Toast.show('Series removed', 'success');
        close();
        App.navigate('library');
      } catch (e) {
        Toast.show('Delete failed: ' + e.message, 'error');
        close();
      }
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  return { render };
})();
