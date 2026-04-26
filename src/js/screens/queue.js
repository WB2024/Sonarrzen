// screens/queue.js — Active downloads (Sonarr)
const QueueScreen = (() => {
  let timer = null;

  function fmtBytes(n) {
    if (!n) return '0 B';
    const u = ['B','KB','MB','GB','TB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v >= 100 ? 0 : 1) + ' ' + u[i];
  }

  function fmtEta(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime() - Date.now();
    if (t <= 0) return 'soon';
    const m = Math.round(t / 60000);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function pad2(n) { return n < 10 ? ('0' + n) : ('' + n); }

  function render(host) {
    host.innerHTML = '<div class="queue-wrap" id="q-root"><h1>Download Queue</h1><div id="q-list"></div></div>';
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 10000);
  }

  function teardown() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  async function refresh() {
    const root = document.getElementById('q-list');
    if (!root) { teardown(); return; }
    try {
      const q = await SonarrAPI.queue.list();
      const records = (q && q.records) || [];
      if (!records.length) {
        root.innerHTML = '<div class="queue-empty"><h2>Queue is empty</h2><p>No active downloads.</p></div>';
        return;
      }
      root.innerHTML = '';
      records.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.dataset.nav = '';
        const totalSize = rec.size || 0;
        const left = rec.sizeleft || 0;
        const pct = totalSize > 0 ? Math.max(0, Math.min(100, ((totalSize - left) / totalSize) * 100)) : 0;
        const sTitle = (rec.series && rec.series.title) || '(unknown)';
        const ep = rec.episode || {};
        const epCode = (ep.seasonNumber != null && ep.episodeNumber != null)
          ? ('S' + pad2(ep.seasonNumber) + 'E' + pad2(ep.episodeNumber))
          : '';
        const epTitle = ep.title || '';
        const heading = sTitle + (epCode ? (' — ' + epCode) : '') + (epTitle ? (' · ' + epTitle) : '');
        const quality = (rec.quality && rec.quality.quality && rec.quality.quality.name) || '—';
        item.innerHTML =
          '<h3>' + esc(heading) + '</h3>' +
          '<div class="queue-meta">' +
            esc(quality) + ' · ' + esc(rec.status || '—') + ' · ' + fmtBytes(totalSize) +
            ' · ETA ' + fmtEta(rec.estimatedCompletionTime) +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
          '<div style="margin-top:8px;color:var(--muted);font-size:14px;">' +
            pct.toFixed(0) + '% · ' + fmtBytes(totalSize - left) + ' of ' + fmtBytes(totalSize) +
          '</div>';
        root.appendChild(item);
      });
    } catch (e) {
      root.innerHTML = '<div class="empty-state"><h2>Failed to load queue</h2><p>' + esc(e.message) + '</p></div>';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  return { render, teardown };
})();
