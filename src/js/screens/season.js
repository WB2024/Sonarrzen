// screens/season.js — Season episode list + per-episode interactive search (Sonarr)
const SeasonScreen = (() => {
  function pad2(n) { return n < 10 ? ('0' + n) : ('' + n); }
  function fmtBytes(n) {
    if (!n) return '0 B';
    const u = ['B','KB','MB','GB','TB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v >= 100 ? 0 : 1) + ' ' + u[i];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }
  function fmtAge(r) {
    const h = r.ageHours || (r.age || 0) * 24;
    if (h < 24) return Math.round(h) + 'h';
    if (h < 24 * 7) return Math.round(h / 24) + 'd';
    return Math.round(h / 24 / 7) + 'w';
  }

  function render(host, params) {
    params = params || {};
    const seriesId = params.seriesId || Store.state.selectedSeriesId;
    const seasonNumber = (params.seasonNumber != null) ? params.seasonNumber : Store.state.selectedSeasonNumber;
    Store.state.selectedSeriesId = seriesId;
    Store.state.selectedSeasonNumber = seasonNumber;

    const slim = Store.state.series.find(x => x.id === seriesId);
    if (!slim) {
      host.innerHTML = '<div class="empty-state"><h2>Series not found</h2></div>';
      return;
    }

    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'season-screen-wrap';
    const label = seasonNumber === 0 ? 'Specials' : ('Season ' + seasonNumber);
    wrap.innerHTML =
      '<div class="season-toolbar">' +
        '<h1 style="margin:0;flex:1;">' + esc(slim.title) + ' — ' + esc(label) + '</h1>' +
        '<button class="btn btn-primary" data-nav id="se-search">▶ Search Season</button>' +
        '<button class="btn" data-nav id="se-back">← Back</button>' +
      '</div>' +
      '<div class="episode-list" id="ep-list">' +
        '<div style="padding:24px;color:var(--muted);">Loading episodes…</div>' +
      '</div>';
    host.appendChild(wrap);

    document.getElementById('se-search').addEventListener('click', async () => {
      try {
        await SonarrAPI.command.seasonSearch(seriesId, seasonNumber);
        Toast.show('Searching ' + label, 'success');
      } catch (e) { Toast.show('Search failed: ' + e.message, 'error'); }
    });
    document.getElementById('se-back').addEventListener('click', () => {
      App.navigate('detail', { seriesId: seriesId });
    });

    setTimeout(() => Nav.focus(document.getElementById('se-search')), 16);

    SonarrAPI.episodes.forSeries(seriesId).then(eps => {
      const list = (eps || []).filter(e => e.seasonNumber === seasonNumber);
      list.sort((a, b) => a.episodeNumber - b.episodeNumber);
      renderEpisodes(slim, list);
    }).catch(e => {
      const root = document.getElementById('ep-list');
      if (root) root.innerHTML = '<div style="padding:24px;color:var(--muted);">Failed: ' + esc(e.message) + '</div>';
    });
  }

  function renderEpisodes(series, eps) {
    const root = document.getElementById('ep-list');
    if (!root) return;
    root.innerHTML = '';
    if (!eps.length) {
      root.innerHTML = '<div style="padding:24px;color:var(--muted);">No episodes</div>';
      return;
    }
    eps.forEach(ep => {
      const row = document.createElement('div');
      row.className = 'episode-row';
      row.dataset.nav = '';
      const code = 'S' + pad2(ep.seasonNumber) + 'E' + pad2(ep.episodeNumber);
      const has = !!ep.hasFile;
      const monitored = !!ep.monitored;
      const air = ep.airDate || '';
      let statusCls = 'missing', statusTxt = monitored ? '○ Missing' : '○ Unmonitored';
      if (has) { statusCls = 'ok'; statusTxt = '✓ Downloaded'; }
      else if (monitored) { statusCls = 'warn'; statusTxt = '● Missing'; }

      row.innerHTML =
        '<div class="ep-num">' + code + '</div>' +
        '<div class="ep-title">' + esc(ep.title || '(TBA)') + '</div>' +
        '<div class="ep-airdate">' + esc(air) + '</div>' +
        '<div class="ep-status ' + statusCls + '">' + statusTxt + '</div>';

      row.addEventListener('click', () => {
        if (has) {
          Toast.show('Already downloaded', 'success');
          return;
        }
        interactiveSearchEpisode(series, ep);
      });
      root.appendChild(row);
    });
    Nav.invalidateCache();
  }

  function interactiveSearchEpisode(series, ep) {
    const previousFocus = Nav.current;
    const root = document.getElementById('modal-root');
    root.innerHTML = '';

    const back = document.createElement('div');
    back.className = 'modal-backdrop isr-backdrop';
    root.appendChild(back);

    const code = 'S' + pad2(ep.seasonNumber) + 'E' + pad2(ep.episodeNumber);
    const panel = document.createElement('div');
    panel.className = 'isr-panel';
    panel.innerHTML =
      '<div class="isr-header">' +
        '<span class="isr-title">Search — ' + esc(series.title) + ' ' + code + '</span>' +
        '<button class="isr-close btn" data-nav id="isr-close">✕ Close</button>' +
      '</div>' +
      '<div class="isr-body" id="isr-body">' +
        '<div class="isr-loading">Searching indexers…<div class="spinner" style="margin:16px auto 0;"></div></div>' +
      '</div>';
    back.appendChild(panel);

    Nav.setScope(panel);
    setTimeout(() => Nav.focus(document.getElementById('isr-close')), 16);

    function close() {
      Nav.clearScope();
      root.innerHTML = '';
      if (previousFocus) Nav.focus(previousFocus);
    }
    document.getElementById('isr-close').addEventListener('click', close);

    SonarrAPI.release.searchEpisode(ep.id).then(results => {
      const body = document.getElementById('isr-body');
      if (!results || !results.length) {
        body.innerHTML = '<div class="isr-empty">No releases found.</div>';
        return;
      }
      results.sort((a, b) => {
        if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
        return (b.qualityWeight || 0) - (a.qualityWeight || 0);
      });
      const cap = results.slice(0, 100);

      const table = document.createElement('table');
      table.className = 'isr-table';
      table.innerHTML =
        '<thead><tr>' +
          '<th>Source</th><th>Age</th><th>Title</th>' +
          '<th>Indexer</th><th>Size</th><th>Peers</th>' +
          '<th>Quality</th><th></th>' +
        '</tr></thead>';
      const tbody = document.createElement('tbody');

      cap.forEach(r => {
        const tr = document.createElement('tr');
        if (r.rejected) tr.className = 'isr-rejected';
        const proto = (r.downloadProtocol || '').toLowerCase();
        const protoBadge = proto === 'torrent'
          ? '<span class="isr-proto torrent">TRK</span>'
          : '<span class="isr-proto nzb">NZB</span>';
        const peers = proto === 'torrent'
          ? ((r.seeders || 0) + '/' + (r.leechers || 0))
          : '—';
        const qualName = (r.quality && r.quality.quality && r.quality.quality.name) || '—';
        const lang = (r.languages && r.languages[0] && r.languages[0].name) || '';
        const rejectTip = r.rejections && r.rejections.length
          ? r.rejections.map(x => x.reason || x).join(', ')
          : '';

        tr.innerHTML =
          '<td>' + protoBadge + '</td>' +
          '<td class="isr-age">' + esc(fmtAge(r)) + '</td>' +
          '<td class="isr-title-cell" title="' + esc(r.title) + '">' + esc(r.title) + '</td>' +
          '<td class="isr-indexer">' + esc(r.indexer || '—') + '</td>' +
          '<td class="isr-size">' + esc(fmtBytes(r.size)) + '</td>' +
          '<td class="isr-peers">' + esc(peers) + '</td>' +
          '<td><span class="isr-quality">' + esc(qualName) + '</span>' + (lang ? (' <span class="isr-lang">' + esc(lang) + '</span>') : '') + '</td>' +
          '<td class="isr-actions"></td>';

        const actCell = tr.querySelector('.isr-actions');
        if (r.rejected) {
          const warn = document.createElement('span');
          warn.className = 'isr-warn';
          warn.title = rejectTip;
          warn.textContent = '⚠ Rejected';
          actCell.appendChild(warn);
        }
        const grabBtn = document.createElement('button');
        grabBtn.className = 'btn isr-grab-btn';
        grabBtn.dataset.nav = '';
        grabBtn.textContent = '⬇ Grab';
        grabBtn.addEventListener('click', async () => {
          grabBtn.disabled = true;
          grabBtn.textContent = '…';
          try {
            await SonarrAPI.release.grab({ guid: r.guid, indexerId: r.indexerId });
            Toast.show('Grabbing: ' + r.title, 'success');
            grabBtn.textContent = '✓ Grabbed';
            grabBtn.className = 'btn isr-grab-btn isr-grabbed';
          } catch (e) {
            Toast.show('Grab failed: ' + e.message, 'error');
            grabBtn.disabled = false;
            grabBtn.textContent = '⬇ Grab';
          }
        });
        actCell.appendChild(grabBtn);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      body.innerHTML = '';
      body.appendChild(table);
      Nav.invalidateCache();

      const firstBtn = panel.querySelector('.isr-grab-btn');
      const closeBtn = document.getElementById('isr-close');
      if (closeBtn) Nav.focus(closeBtn);
      if (firstBtn) setTimeout(() => Nav.focus(firstBtn), 400);
    }).catch(e => {
      const body = document.getElementById('isr-body');
      if (body) body.innerHTML = '<div class="isr-empty">Search failed: ' + esc(e.message) + '</div>';
    });
  }

  return { render };
})();
