// store.js — In-memory state + localStorage persistence (Sonarr/Tizen-optimized)
const Store = (() => {
  const STORAGE_KEY = 'sonarrzen-config';
  const SERIES_KEY  = 'sonarrzen-series-v1';
  const SERIES_TTL  = 5 * 60 * 1000;     // 5 min — fresh enough, instant boot

  const state = {
    config: null,
    series: [],                         // slim subset (see slimSeries below)
    seriesLoadedAt: 0,
    qualityProfiles: [],
    languageProfiles: [],
    rootFolders: [],
    currentScreen: 'setup',
    selectedSeriesId: null,
    selectedSeasonNumber: null,
    libraryView: { filter: 'all', sort: 'title' },
    libraryScrollTop: 0,
    libraryFocusIndex: 0,
  };

  // Persist only fields the UI uses.  Saves ~80% storage + parse time.
  function slimSeries(s) {
    let posterUrl = null;
    const imgs = s.images;
    if (imgs) {
      for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].coverType === 'poster') {
          posterUrl = imgs[i].remoteUrl || imgs[i].url || null;
          break;
        }
      }
    }
    return {
      id:         s.id,
      title:      s.title,
      sortTitle:  s.sortTitle,
      year:       s.year,
      tvdbId:     s.tvdbId,
      status:     s.status,         // 'continuing' | 'ended' | 'upcoming' | 'deleted'
      monitored:  !!s.monitored,
      network:    s.network,
      added:      s.added,
      ratings:    s.ratings,
      statistics: s.statistics || {},
      seasons:    (s.seasons || []).map(sn => ({
        seasonNumber: sn.seasonNumber,
        monitored:    !!sn.monitored,
        statistics:   sn.statistics || {},
      })),
      posterUrl:  posterUrl,
    };
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { state.config = JSON.parse(raw); return true; }
    } catch (e) {}
    return false;
  }

  function saveConfig(url, apiKey, sawsubeUrl) {
    state.config = {
      url: url.replace(/\/$/, ''),
      apiKey: apiKey,
      sawsubeUrl: (sawsubeUrl || '').replace(/\/$/, ''),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config)); } catch (e) {}
  }

  function clearConfig() {
    state.config = null;
    state.series = [];
    state.seriesLoadedAt = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SERIES_KEY);
    } catch (e) {}
  }

  function loadSeriesCache() {
    try {
      const raw = localStorage.getItem(SERIES_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || !obj.t || !obj.m) return false;
      state.series = obj.m;
      state.seriesLoadedAt = obj.t;
      return true;
    } catch (e) { return false; }
  }

  function saveSeriesCache(seriesList) {
    const slim = seriesList.map(slimSeries);
    state.series = slim;
    state.seriesLoadedAt = Date.now();
    try {
      localStorage.setItem(SERIES_KEY, JSON.stringify({ t: state.seriesLoadedAt, m: slim }));
    } catch (e) {
      try { localStorage.removeItem(SERIES_KEY); } catch (_) {}
    }
  }

  function seriesAreFresh() {
    return state.series.length > 0 && (Date.now() - state.seriesLoadedAt) < SERIES_TTL;
  }

  return {
    state, loadConfig, saveConfig, clearConfig,
    loadSeriesCache, saveSeriesCache, seriesAreFresh, slimSeries,
  };
})();
