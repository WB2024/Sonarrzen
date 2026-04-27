// screens/setup.js — First-run config (URL + API key)
const APP_VERSION = '1.1.0';

const SetupScreen = (() => {
  function render(host) {
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'setup-wrap';

    const card = document.createElement('div');
    card.className = 'setup-card';

    const cfg = Store.state.config || { url: '', apiKey: '' };

    card.innerHTML = `
      <h1>Sonarr</h1>
      <p class="lead" style="display:flex;justify-content:space-between;align-items:baseline;">Connect to your Sonarr server to manage your TV library.<span style="font-size:12px;color:var(--muted);">v${APP_VERSION}</span></p>
      <div class="field">
        <label for="s-url">Sonarr URL</label>
        <input id="s-url" class="input" type="text" data-nav
               placeholder="http://192.168.1.x:8989"
               value="${escapeHtml(cfg.url || '')}">
        <div class="hint">Include http:// and the port (default 8989).</div>
      </div>
      <div class="field">
        <label for="s-key">API Key</label>
        <input id="s-key" class="input" type="text" data-nav
               placeholder="32-character API key"
               value="${escapeHtml(cfg.apiKey || '')}">
        <div class="hint">Find this in Sonarr → Settings → General → API Key.</div>
      </div>
      <div style="display:flex;gap:16px;margin-top:24px;flex-wrap:wrap;">
        <button id="s-connect" class="btn btn-primary" data-nav>Connect</button>
        <button id="s-clear-cache" class="btn" data-nav>Clear Cache</button>
        <button id="s-disconnect" class="btn btn-danger" data-nav>Disconnect</button>
      </div>
      <div id="s-status" style="margin-top:20px;color:var(--muted);font-size:15px;"></div>
    `;
    wrap.appendChild(card);
    host.appendChild(wrap);

    const $url = document.getElementById('s-url');
    const $key = document.getElementById('s-key');
    const $btn = document.getElementById('s-connect');
    const $st  = document.getElementById('s-status');

    async function tryConnect() {
      const url = ($url.value || '').trim();
      const k   = ($key.value || '').trim();
      if (!url || !k) { Toast.show('Enter URL and API key', 'error'); return; }
      $st.textContent = 'Connecting…';
      const sp = Spinner.show();
      try {
        const status = await SonarrAPI.testConnection(url, k);
        Spinner.hide(sp);
        Store.saveConfig(url, k);
        Toast.show(`Connected to Sonarr ${status.version || ''}`, 'success');
        await App.loadInitialData();
        App.navigate('library');
      } catch (e) {
        Spinner.hide(sp);
        $st.textContent = 'Failed: ' + e.message;
        Toast.show('Connection failed', 'error');
      }
    }

    $btn.addEventListener('click', tryConnect);

    document.getElementById('s-clear-cache').addEventListener('click', () => {
      try { localStorage.removeItem('sonarrzen-series-v1'); } catch (e) {}
      Store.state.series = [];
      Store.state.seriesLoadedAt = 0;
      Toast.show('Cache cleared', 'success');
    });

    document.getElementById('s-disconnect').addEventListener('click', () => {
      Store.clearConfig();
      App.navigate('setup');
    });

    $url.addEventListener('keydown', (e) => {
      if (e.keyCode === 13) { e.preventDefault(); Nav.focus($key); }
    });
    $key.addEventListener('keydown', (e) => {
      if (e.keyCode === 13) { e.preventDefault(); Nav.focus($btn); }
    });

    setTimeout(() => Nav.focus(cfg.url ? $btn : $url), 30);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
  }

  return { render };
})();
