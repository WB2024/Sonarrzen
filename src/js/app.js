// app.js — Router + bootstrap (Tizen-optimized, Sonarr)
const App = (() => {
  const screens = {
    setup:   typeof SetupScreen   !== 'undefined' ? SetupScreen   : null,
    library: typeof LibraryScreen !== 'undefined' ? LibraryScreen : null,
    detail:  typeof DetailScreen  !== 'undefined' ? DetailScreen  : null,
    season:  typeof SeasonScreen  !== 'undefined' ? SeasonScreen  : null,
    search:  typeof SearchScreen  !== 'undefined' ? SearchScreen  : null,
    queue:    typeof QueueScreen    !== 'undefined' ? QueueScreen    : null,
    discover: typeof DiscoverScreen !== 'undefined' ? DiscoverScreen : null,
  };

  let currentTeardown = null;

  function navigate(name, params) {
    params = params || {};
    if (currentTeardown) { try { currentTeardown(); } catch (e) {} currentTeardown = null; }
    const screen = screens[name];
    if (!screen) { console.error('Unknown screen', name); return; }
    Store.state.currentScreen = name;
    Header.render(name);
    const el = document.getElementById('screen');
    el.innerHTML = '';
    Nav.invalidateCache();
    screen.render(el, params);
    if (typeof screen.teardown === 'function') currentTeardown = screen.teardown;
    setTimeout(() => Nav.invalidateCache(), 30);
  }

  async function loadInitialData() {
    try {
      const results = await Promise.all([
        SonarrAPI.quality.profiles().catch(() => []),
        SonarrAPI.rootFolders.list().catch(() => []),
        SonarrAPI.languageProfiles.list().catch(() => []),
      ]);
      Store.state.qualityProfiles  = results[0] || [];
      Store.state.rootFolders      = results[1] || [];
      Store.state.languageProfiles = results[2] || [];
    } catch (e) {
      console.warn('Failed to preload profiles/folders', e);
    }
  }

  async function boot() {
    if (window.tizen && window.tizen.tvinputdevice) {
      const KEYS = ['MediaPlayPause','MediaFastForward','MediaRewind',
                    'ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
                    'ChannelUp','ChannelDown'];
      KEYS.forEach(k => { try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {} });
    }

    Nav.init();
    Nav.setBackHandler(handleBack);

    const ok = Store.loadConfig();
    if (!ok) { navigate('setup'); return; }

    SonarrAPI.configure(Store.state.config.url, Store.state.config.apiKey, Store.state.config.sawsubeUrl);
    Store.loadSeriesCache();

    if (Store.state.series.length > 0) {
      navigate('library');
      loadInitialData().catch(() => {});
      SonarrAPI.system.status().catch(() => {
        Toast.show('Cannot reach Sonarr — check settings', 'error');
      });
    } else {
      try {
        await SonarrAPI.system.status();
        await loadInitialData();
        navigate('library');
      } catch (e) {
        Toast.show('Cannot reach Sonarr — check settings', 'error');
        navigate('setup');
      }
    }
  }

  function handleBack() {
    const modal = document.querySelector('#modal-root .modal-backdrop');
    if (modal) {
      const cancel = modal.querySelector('[id$="-cancel"]') || modal.querySelector('[id$="-close"]');
      if (cancel) cancel.click();
      else { document.getElementById('modal-root').innerHTML = ''; Nav.clearScope(); }
      return;
    }
    const cur = Store.state.currentScreen;
    if (cur === 'season') {
      navigate('detail', { seriesId: Store.state.selectedSeriesId });
      return;
    }
    if (cur === 'setup' && Store.state.config) {
      navigate('library');
      return;
    }
    if (cur === 'detail' || cur === 'search' || cur === 'queue' || cur === 'discover') {
      navigate('library');
      return;
    }
    if (cur === 'library') {
      try { if (window.tizen && window.tizen.application) window.tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }
  }

  return { navigate, boot, loadInitialData };
})();

document.addEventListener('DOMContentLoaded', App.boot);
