# Developer Specification: Sonarrzen — TV-Native Sonarr Client for Tizen + SAWSUBE Integration

**Target Developer:** Claude Opus 4.7 (most advanced AI code developer, April 2026)  
**Reference Codebase:** `/home/will/Github/radarrzen/src/` — **READ THIS FIRST. Build Sonarrzen by adapting the actual working radarrzen codebase.**  
**Sonarr API Spec:** `/home/will/Github/Sonarrzen/SonarrApiv3.json` (authoritative, 12 482 lines)  
**Date:** April 2026

---

### ⚡ Before you start — read these files first

| File | Purpose |
|---|---|
| `/home/will/Github/radarrzen/src/js/nav.js` | Spatial D-pad engine — **copy verbatim**, no changes needed |
| `/home/will/Github/radarrzen/src/js/store.js` | State pattern — adapt for Sonarr entities |
| `/home/will/Github/radarrzen/src/js/api.js` | API client pattern — adapt for Sonarr endpoints |
| `/home/will/Github/radarrzen/src/js/app.js` | Router/boot pattern — add `season` screen |
| `/home/will/Github/radarrzen/src/js/screens/library.js` | Virtualized grid — adapt entity type |
| `/home/will/Github/radarrzen/src/js/screens/detail.js` | Detail + ISR pattern — adapt for series/seasons |
| `/home/will/Github/radarrzen/src/js/screens/search.js` | TVDB lookup + add series |
| `/home/will/Github/radarrzen/src/js/screens/queue.js` | Queue — minimal changes (different field names) |
| `/home/will/Github/radarrzen/src/css/app.css` | Full stylesheet — copy and update brand colour |
| `/home/will/Github/SAWSUBE/.env` | Contains `Sonarr_URL` and `Sonarr_API_KEY` |
| `/home/will/Github/SAWSUBE/backend/services/tizenbrew_service.py` | Build/install pipeline to adapt |

**Local project path:** `/home/will/Github/Sonarrzen/` — the directory already exists with `SonarrApiv3.json`.

---

## 1. What We Are Building

A **TV-native Sonarr client** — a standalone Tizen WGT web app that:

1. Connects to the user's **existing Sonarr v3 instance** via Sonarr's REST API v3.
2. Presents a **TV-first UI** with full D-pad remote navigation.
3. Is packaged as a `.wgt` file installable via SAWSUBE's existing install pipeline.
4. Is **not** a port of Sonarr's web UI — it is a calm, consumer-grade TV app in the same spirit as the Netflix TV app.

### What you are NOT doing
- Do not adapt Sonarr's React/TypeScript web frontend — it is mouse-driven and complex.
- Do not run any server-side code on the TV.
- Do not replicate admin features (indexers, notifications, naming formats, etc.).

### The four things a user does from a TV
1. **Browse** their series library (poster grid).
2. **Check** a show's seasons and episode status.
3. **Search** for a new show to add.
4. **Monitor** queue progress.

---

## 2. Project Structure

```
Sonarrzen/
├── src/
│   ├── config.xml               # Tizen app manifest
│   ├── index.html               # App entry point
│   ├── css/
│   │   └── app.css              # Dark TV-optimised styles (derived from radarrzen)
│   ├── js/
│   │   ├── sawsube-config.js    # Config seed (injected by SAWSUBE at install time)
│   │   ├── nav.js               # D-pad focus/navigation engine (copy verbatim from radarrzen)
│   │   ├── store.js             # In-memory state + localStorage (Sonarr entities)
│   │   ├── api.js               # Sonarr REST API v3 client
│   │   ├── app.js               # App bootstrap + screen router
│   │   ├── screens/
│   │   │   ├── setup.js         # First-run: Sonarr URL + API key
│   │   │   ├── library.js       # Series grid (virtualized, same pattern as radarrzen)
│   │   │   ├── detail.js        # Series detail + season list
│   │   │   ├── season.js        # Episode list for a selected season  ← NEW vs radarrzen
│   │   │   ├── search.js        # TVDB lookup + add series
│   │   │   └── queue.js         # Episode download queue
│   │   └── components/
│   │       ├── header.js        # Top nav: Library / Search / Queue tabs
│   │       ├── spinner.js       # Loading overlay (copy verbatim)
│   │       └── toast.js         # Timed notification (copy verbatim)
│   └── assets/
│       ├── icon.png             # 117×117 app icon
│       └── icon_hd.png          # 222×222 app icon
├── build.sh                     # Local build script
├── SonarrApiv3.json             # OpenAPI spec (already present)
└── README.md
```

---

## 3. Tizen App Manifest (`src/config.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets"
        xmlns:tizen="http://tizen.org/ns/widgets"
        id="https://github.com/WB2024/sonarrzen"
        version="1.0.0"
        viewmodes="fullscreen">

  <tizen:application id="SnarzTV001.Sonarrzen"
                     package="SnarzTV001"
                     required_version="4.0"
                     launch_mode="single"/>

  <content src="index.html"/>
  <icon src="assets/icon.png"/>

  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>

  <feature name="http://tizen.org/feature/network.internet"/>

  <tizen:setting screen-orientation="landscape"
                 context-menu="disable"
                 background-support="disable"
                 encryption="disable"
                 install-location="auto"
                 hw-key-event="enable"/>

  <access origin="*" subdomains="true"/>

  <name>Sonarr</name>
  <description>Sonarr TV show manager for Samsung TV</description>
</widget>
```

---

## 4. HTML Shell (`src/index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920">
  <title>Sonarr</title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <div id="app">
    <header id="header"></header>
    <main id="screen"></main>
    <div id="modal-root"></div>
    <div id="toast"></div>
  </div>

  <script src="js/sawsube-config.js"></script>
  <script src="js/nav.js"></script>
  <script src="js/store.js"></script>
  <script src="js/api.js"></script>
  <script src="js/components/toast.js"></script>
  <script src="js/components/spinner.js"></script>
  <script src="js/components/header.js"></script>
  <script src="js/screens/setup.js"></script>
  <script src="js/screens/library.js"></script>
  <script src="js/screens/detail.js"></script>
  <script src="js/screens/season.js"></script>
  <script src="js/screens/search.js"></script>
  <script src="js/screens/queue.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

Same structure as radarrzen — single HTML file, scripts loaded in dependency order.

---

## 5. CSS (`src/css/app.css`)

**Copy `radarrzen/src/css/app.css` in full** and make these targeted changes:

### Colour palette — change accent to a Sonarr blue
```css
:root {
  --bg:       #0D1B2A;   /* slightly cooler dark (vs radarrzen's warm dark) */
  --card:     #1A2840;
  --border:   #263A52;
  --fg:       #EFF4FA;
  --muted:    #8A9BB0;
  --accent:   #2E86C1;   /* Sonarr blue instead of radarrzen orange */
  --ok:       #4CAF50;
  --warn:     #FFC107;
  --err:      #F44336;
  --font:     'Arial', sans-serif;
}
```

### Header brand text
Change `.brand` text in `header.js` (not CSS) from `'📺 Radarr'` to `'📺 Sonarr'`.

### Additional CSS needed for `season.js` episode list

Add these rules (absent in radarrzen):

```css
/* ── Season / Episode list ──────────────────────────────────────── */
.season-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 24px 32px;
  overflow-y: auto;
}
.season-card {
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  cursor: pointer;
}
.season-card h3 { margin-bottom: 8px; }
.season-card .s-stats { color: var(--muted); font-size: 15px; }

.episode-list {
  padding: 16px 32px;
  overflow-y: auto;
  flex: 1;
}
.episode-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.episode-row:last-child { border-bottom: none; }
.ep-num { color: var(--muted); font-size: 15px; min-width: 48px; }
.ep-title { flex: 1; font-size: 18px; }
.ep-airdate { color: var(--muted); font-size: 14px; min-width: 100px; text-align: right; }
.ep-status { font-size: 13px; min-width: 80px; text-align: right; }
.ep-status.ok { color: var(--ok); }
.ep-status.warn { color: var(--warn); }
.ep-status.missing { color: var(--err); }
```

### CRITICAL CSS rule — copy from radarrzen, do NOT use `inset`

The Tizen WebKit engine does **not** support the `inset` CSS shorthand. Every modal overlay **must** use explicit sides:

```css
/* ✅ CORRECT — supported on Tizen WebKit */
.modal-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0,0,0,0.85);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ❌ WRONG — `inset: 0` silently has no effect on Tizen, making modal invisible */
.modal-backdrop { position: fixed; inset: 0; }
```

This applies to `.modal-backdrop`, `.spinner-overlay`, and any other full-screen overlay.

---

## 6. `js/nav.js` — Copy Verbatim

**Copy `/home/will/Github/radarrzen/src/js/nav.js` without any modification.**

The nav engine is battle-tested on Tizen TV. Key behaviours (do not change):

- `Nav.focus(el)` — auto-assigns `tabIndex = 0` on non-native elements (divs, spans) so that `el.focus()` actually transfers `document.activeElement`. Without this, `.focus()` is a silent no-op on Tizen and keyboard events keep going to the previous focused element.
- **Jellyfin keydown model**: `LEFT`/`RIGHT` pass through in text inputs (cursor moves); `UP`/`DOWN` always spatial-navigate even from inputs. This is the correct model for TV remote nav.
- `Nav.setMoveOverride(fn)` — lets virtualized screens own arrow keys.
- `Nav.setScope(container)` / `Nav.clearScope()` — traps navigation inside modals.
- `Nav.invalidateCache()` — must be called after dynamic DOM changes.
- No `transform`/`scale` on focus — Tizen TV repaints kill performance. Bright outline only (`.nav-focused` class).

---

## 7. `js/sawsube-config.js`

```javascript
// sawsube-config.js — Pre-install config seed.
//
// In the public GitHub release this file is a no-op.  SAWSUBE's
// tizenbrew_service.inject_app_config() replaces it at install time
// with a snippet that pre-seeds localStorage with the user's Sonarr
// URL + API key.
//
// For local browser dev, set config in DevTools console:
//   localStorage.setItem('sonarrzen-config', JSON.stringify({
//     url: 'http://192.168.1.250:8989',
//     apiKey: 'ca9ea34644c74bb68a062bc6697d3a1b',
//     sawsubeUrl: 'http://192.168.1.48:8000'
//   }));
(function(){})();
```

---

## 8. `js/store.js`

Adapt from radarrzen's `store.js`. Key changes: Sonarr storage keys, `series` instead of `movies`, Sonarr-specific slim shape.

```javascript
// store.js — In-memory state + localStorage persistence (Sonarr/Tizen-optimized)
const Store = (() => {
  const STORAGE_KEY = 'sonarrzen-config';
  const SERIES_KEY  = 'sonarrzen-series-v1';
  const SERIES_TTL  = 5 * 60 * 1000;     // 5 min

  const state = {
    config: null,
    series: [],                         // slim series array
    seriesLoadedAt: 0,
    qualityProfiles: [],
    rootFolders: [],
    currentScreen: 'setup',
    selectedSeriesId: null,
    selectedSeasonNumber: null,
    libraryView: { filter: 'all', sort: 'title' },
    libraryScrollTop: 0,
    libraryFocusIndex: 0,
  };

  // Keep only fields the UI needs. Sonarr's full series object is ~8KB each.
  function slimSeries(s) {
    let posterUrl = null;
    if (s.images) {
      for (let i = 0; i < s.images.length; i++) {
        if (s.images[i].coverType === 'poster') {
          // Prefer remotePoster (direct TVDB URL), fall back to local path
          posterUrl = s.images[i].remoteUrl || s.images[i].url || null;
          break;
        }
      }
    }
    return {
      id:             s.id,
      title:          s.title,
      sortTitle:      s.sortTitle,
      year:           s.year,
      tvdbId:         s.tvdbId,
      status:         s.status,           // 'continuing' | 'ended' | 'upcoming'
      monitored:      !!s.monitored,
      statistics:     s.statistics || {}, // episodeFileCount, episodeCount, percentOfEpisodes
      added:          s.added,
      network:        s.network,
      posterUrl:      posterUrl,
      seasons:        (s.seasons || []).map(sn => ({
        seasonNumber: sn.seasonNumber,
        monitored:    !!sn.monitored,
        statistics:   sn.statistics || {},
      })),
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
```

---

## 9. `js/api.js`

Model closely on radarrzen's `api.js`. Key differences:
- Sonarr base: `{url}/api/v3`
- Image path: `/api/v3/mediacover/{seriesId}/{filename}` (not `/MediaCover/`)
- Poster direct URL: `{sonarrBase}/api/v3/mediacover/{seriesId}/poster.jpg?apikey={key}`
- External (TVDB) images come from `artworks.thetvdb.com` — already whitelisted in SAWSUBE proxy
- SAWSUBE image proxy endpoint: use `/api/sonarr/image` (see §15 for the new SAWSUBE endpoint to add)

```javascript
// api.js — Sonarr REST API v3 client (Tizen-optimized)
const SonarrAPI = (() => {
  let base = '', key = '', sawsubeBase = '';

  function configure(url, apiKey, sawsubeUrl) {
    base = url.replace(/\/$/, '') + '/api/v3';
    key = apiKey;
    sawsubeBase = (sawsubeUrl || '').replace(/\/$/, '');
  }

  function rawBase() { return base.replace(/\/api\/v3$/, ''); }
  function apiKey()  { return key; }
  function hasSawsube() { return !!sawsubeBase; }

  async function request(path, options) {
    const opts = options || {};
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      body: opts.body,
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (e) {}
      throw new Error('Sonarr ' + res.status + ' on ' + path + (body ? ': ' + body.slice(0, 200) : ''));
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.indexOf('json') >= 0 ? res.json() : res.text();
  }

  // Resolve the raw poster URL from a slim or full series object.
  function posterUrlFromSeries(s) {
    if (!s) return null;
    if (s.posterUrl) {
      const u = s.posterUrl;
      return u.indexOf('http') === 0 ? u : rawBase() + u;
    }
    // Full series object path
    const imgs = s.images;
    if (!imgs) return null;
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].coverType === 'poster') {
        return imgs[i].remoteUrl || (rawBase() + (imgs[i].url || ''));
      }
    }
    return null;
  }

  // Sonarr-hosted poster for a known series id.
  function posterUrl(seriesId) {
    return rawBase() + '/api/v3/mediacover/' + seriesId + '/poster.jpg?apikey=' + encodeURIComponent(key);
  }

  // Resized poster via SAWSUBE proxy.
  // Same dual-path logic as radarrzen: Sonarr-hosted → ?path=  |  TVDB external → ?url=
  function posterImgSrc(series, width) {
    const w = width || 200;
    if (!sawsubeBase) {
      const raw = posterUrlFromSeries(series) || posterUrl(series.id);
      return raw + (raw.indexOf('apikey=') >= 0 ? '' : (raw.indexOf('?') >= 0 ? '&' : '?') + 'apikey=' + encodeURIComponent(key));
    }
    const raw = posterUrlFromSeries(series) || posterUrl(series.id);
    const sonarrOrigin = rawBase();
    if (raw.indexOf(sonarrOrigin) === 0) {
      // Sonarr-hosted — proxy attaches API key
      const pathPart = raw.slice(sonarrOrigin.length);
      return sawsubeBase + '/api/sonarr/image?path=' + encodeURIComponent(pathPart) + '&w=' + w;
    }
    // External TVDB image — proxy via ?url= (artworks.thetvdb.com is whitelisted)
    return sawsubeBase + '/api/sonarr/image?url=' + encodeURIComponent(raw) + '&w=' + w;
  }

  function remoteImgSrc(url, width) {
    if (!url) return null;
    if (!sawsubeBase) return url;
    return sawsubeBase + '/api/sonarr/image?url=' + encodeURIComponent(url) + '&w=' + (width || 200);
  }

  // ── Series ──────────────────────────────────────────────────────
  const series = {
    list:  ()         => request('/series'),
    get:   (id)       => request('/series/' + id),
    add:   (body)     => request('/series', { method: 'POST', body: JSON.stringify(body) }),
    edit:  (id, body) => request('/series/' + id, { method: 'PUT', body: JSON.stringify(body) }),
    del:   (id, deleteFiles) =>
                          request('/series/' + id + '?deleteFiles=' + (deleteFiles ? 'true' : 'false') + '&addImportExclusion=false',
                                  { method: 'DELETE' }),
  };

  // ── Episodes ─────────────────────────────────────────────────────
  // Sonarr returns all episodes for a series in one call — filter client-side by season.
  const episodes = {
    forSeries: (seriesId) => request('/episode?seriesId=' + seriesId),
    get:       (id)       => request('/episode/' + id),
    // Monitor/unmonitor a list of episode IDs
    monitor:   (ids, monitored) => request('/episode/monitor', {
      method: 'PUT',
      body: JSON.stringify({ episodeIds: ids, monitored: monitored }),
    }),
  };

  // ── Season pass (monitor whole season) ──────────────────────────
  // PUT /api/v3/seasonpass  body: { series: [{ id, seasons: [{ seasonNumber, monitored }] }] }
  const seasonPass = {
    monitor: (seriesId, seasonNumber, monitored) =>
      request('/seasonpass', {
        method: 'PUT',
        body: JSON.stringify({
          series: [{ id: seriesId, seasons: [{ seasonNumber, monitored }] }],
          monitoringOptions: { monitor: monitored ? 'all' : 'none' },
        }),
      }),
  };

  // ── Queue ────────────────────────────────────────────────────────
  const queue = {
    list: () => request('/queue?includeSeries=true&includeEpisode=true&pageSize=100'),
  };

  // ── Release (Interactive Search) ─────────────────────────────────
  // Search for a whole season: /release?seriesId=X&seasonNumber=Y
  // Search for a specific episode: /release?seriesId=X&seasonNumber=Y&episodeId=Z
  const release = {
    searchSeason:  (seriesId, seasonNumber) =>
      request('/release?seriesId=' + seriesId + '&seasonNumber=' + seasonNumber),
    searchEpisode: (seriesId, seasonNumber, episodeId) =>
      request('/release?seriesId=' + seriesId + '&seasonNumber=' + seasonNumber + '&episodeId=' + episodeId),
    grab: (body) => request('/release', { method: 'POST', body: JSON.stringify(body) }),
  };

  // ── Lookup (TVDB search) ─────────────────────────────────────────
  const lookup = {
    search: (term) => request('/series/lookup?term=' + encodeURIComponent(term)),
    tvdb:   (id)   => request('/series/lookup?term=tvdb:' + id),
  };

  // ── Commands ─────────────────────────────────────────────────────
  const command = {
    post:                (body)                     => request('/command', { method: 'POST', body: JSON.stringify(body) }),
    seriesSearch:        (seriesId)                 => command.post({ name: 'SeriesSearch', seriesId }),
    seasonSearch:        (seriesId, seasonNumber)   => command.post({ name: 'SeasonSearch', seriesId, seasonNumber }),
    episodeSearch:       (episodeIds)               => command.post({ name: 'EpisodeSearch', episodeIds }),
    missingEpisodeSearch: ()                        => command.post({ name: 'MissingEpisodeSearch' }),
  };

  // ── Quality profiles + root folders ──────────────────────────────
  const quality    = { profiles: () => request('/qualityprofile') };
  const rootFolders = { list:    () => request('/rootfolder') };
  const system     = { status:  () => request('/system/status') };
  const languageProfiles = { list: () => request('/languageprofile') };

  async function testConnection(url, apiKeyVal) {
    configure(url, apiKeyVal);
    return system.status();
  }

  return {
    configure, testConnection,
    series, episodes, seasonPass, queue, release, lookup,
    command, quality, rootFolders, system, languageProfiles,
    posterUrl, posterUrlFromSeries, posterImgSrc, remoteImgSrc,
    rawBase, apiKey, hasSawsube,
  };
})();
```

---

## 10. `js/components/` — toast.js, spinner.js

**Copy verbatim from radarrzen.** No changes needed.

---

## 11. `js/components/header.js`

Copy from radarrzen and change:
- Tabs: `Library`, `Search`, `Queue` (same)
- Brand text: `'📺 Sonarr'`
- Connection status shows `new URL(Store.state.config.url).host`

```javascript
const Header = (() => {
  const TABS = [
    { id: 'library', label: 'Library' },
    { id: 'search',  label: 'Search'  },
    { id: 'queue',   label: 'Queue'   },
  ];

  function render(currentScreen) {
    const host = document.getElementById('header');
    if (!host) return;
    if (currentScreen === 'setup') { host.innerHTML = ''; return; }

    host.innerHTML = '';
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.textContent = '📺 Sonarr';
    host.appendChild(brand);

    const tabs = document.createElement('div');
    tabs.className = 'header-tabs';
    TABS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'header-tab' + (t.id === currentScreen || (t.id === 'library' && currentScreen === 'detail') || (t.id === 'library' && currentScreen === 'season') ? ' active' : '');
      b.dataset.nav = '';
      b.textContent = t.label;
      b.addEventListener('click', () => {
        if (t.id !== Store.state.currentScreen) App.navigate(t.id);
      });
      tabs.appendChild(b);
    });
    host.appendChild(tabs);

    const status = document.createElement('div');
    status.className = 'conn-status';
    status.innerHTML = '<span class="conn-dot"></span><span>' +
      (Store.state.config ? new URL(Store.state.config.url).host : '') + '</span>';
    host.appendChild(status);
  }

  return { render };
})();
```

Note the `active` class logic: `detail` and `season` screens are children of the Library tab, so `Library` stays active on those screens.

---

## 12. `js/screens/setup.js`

Copy from radarrzen and change:
- Title and labels: `Sonarr` instead of `Radarr`
- Placeholder URL: `http://192.168.1.x:8989`
- Default port hint: `8989`
- API client: `SonarrAPI` instead of `RadarrAPI`
- `Store.saveConfig(url, k)` — same shape (url, apiKey, sawsubeUrl)
- After connect: `App.loadInitialData()` then `App.navigate('library')`
- No `sawsubeUrl` field needed on setup screen (SAWSUBE injects it at install time; omit for simplicity).

```javascript
// Same structure as radarrzen/src/js/screens/setup.js
// Change: RadarrAPI → SonarrAPI, placeholder port 8989, label "Sonarr URL"
const SetupScreen = (() => {
  function render(host) {
    // ... same pattern as radarrzen ...
    // card.innerHTML template:
    // <h1>Sonarr</h1>
    // <p>Connect to your Sonarr server to manage your TV library.</p>
    // <input placeholder="http://192.168.1.x:8989" ...>
    // Hint: "Include http:// and the port (default 8989)."
    // ...
  }
  return { render };
})();
```

---

## 13. `js/screens/library.js` — Series Grid (Virtualized)

**Copy radarrzen's `library.js` and adapt for Sonarr series.**

Key differences from radarrzen:

### Filters
```javascript
const FILTERS = [
  { id: 'all',        label: 'All',        match: () => true },
  { id: 'continuing', label: 'Continuing',  match: s => s.status === 'continuing' },
  { id: 'ended',      label: 'Ended',       match: s => s.status === 'ended' },
  { id: 'missing',    label: 'Missing',     match: s => s.monitored && (s.statistics.percentOfEpisodes || 0) < 100 },
  { id: 'monitored',  label: 'Monitored',   match: s => !!s.monitored },
];
```

### Sorts
```javascript
const SORTS = [
  { id: 'title',   label: 'Title',    cmp: (a,b) => (a.sortTitle||a.title||'').localeCompare(b.sortTitle||b.title||'') },
  { id: 'year',    label: 'Year',     cmp: (a,b) => (b.year||0) - (a.year||0) },
  { id: 'added',   label: 'Added',    cmp: (a,b) => new Date(b.added||0) - new Date(a.added||0) },
  { id: 'network', label: 'Network',  cmp: (a,b) => (a.network||'').localeCompare(b.network||'') },
];
```

### API calls
- `SonarrAPI.series.list()` instead of `RadarrAPI.movies.list()`
- `Store.saveSeriesCache(list || [])` / `Store.loadSeriesCache()`
- Count label: `items.length + ' series'`

### Card badge logic
- Downloaded badge (green ✓): `s.statistics && s.statistics.percentOfEpisodes >= 100`
- Missing badge (amber ●): `s.monitored && s.statistics && s.statistics.percentOfEpisodes < 100`
- Status badge: display `s.status` (`continuing` → teal, `ended` → grey)

```javascript
// In buildCard(s, index):
const pct = (s.statistics && s.statistics.percentOfEpisodes) || 0;
const epCount = (s.statistics && s.statistics.episodeCount) || 0;
const fileCount = (s.statistics && s.statistics.episodeFileCount) || 0;

// Badge
if (pct >= 100 && epCount > 0) {
  b.innerHTML = '<div class="badge ok">✓</div>';
} else if (s.monitored && epCount > 0) {
  b.innerHTML = '<div class="badge warn">●</div>';
}

// Title line: show + network
title.textContent = s.year ? (s.title + ' (' + s.year + ')') : s.title;

// On click: navigate to detail
el.addEventListener('click', () => {
  Store.state.libraryFocusIndex = index;
  if (vp) Store.state.libraryScrollTop = vp.scrollTop;
  App.navigate('detail', { seriesId: s.id });
});
```

### Image proxy
```javascript
img.src = SonarrAPI.posterImgSrc(s, 200);
```

### Data loading
```javascript
const cacheLoaded = Store.state.series.length > 0 || Store.loadSeriesCache();
if (cacheLoaded) {
  buildItemsAndRender();
  if (!Store.seriesAreFresh()) refreshSeries();
} else {
  const sp = Spinner.show(vp);
  SonarrAPI.series.list().then(list => {
    Store.saveSeriesCache(list || []);
    Spinner.hide(sp);
    buildItemsAndRender();
  }).catch(/* ... */);
}
```

Everything else (virtualization, dropdown, key handler, scroll restore) is **identical** to radarrzen — copy verbatim and rename `movie` → `series`/`show`.

---

## 14. `js/screens/detail.js` — Series Detail + Season List

This screen is more complex than radarrzen's movie detail because a series has multiple seasons.

### Layout
```
┌──────────────────────────────────────────────────────────┐
│  [Poster]   Title (Year)                                 │
│             Network · Status · Rating                    │
│             Overview text                                │
│             [▶ Search All] [✓ Monitor] [✕ Delete] [← Back] │
├──────────────────────────────────────────────────────────┤
│  SEASONS                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Season 1 │ │ Season 2 │ │ Season 3 │                 │
│  │ 10/10 ✓  │ │  8/10 ●  │ │  0/0     │                 │
│  │[Episodes]│ │[Episodes]│ │[Episodes]│                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
└──────────────────────────────────────────────────────────┘
```

### Implementation notes

**Season 0 (Specials):** Sonarr includes a `seasonNumber: 0` entry for specials. Display it if it has episodes. Label it `Specials` instead of `Season 0`.

**Render shell fast:** Show the slim-cache data immediately (title, poster), then enrich with `SonarrAPI.series.get(id)` for full overview, network, ratings.

**Season cards:** Each season card has a `data-nav` button that navigates to `App.navigate('season', { seriesId, seasonNumber })`.

```javascript
const DetailScreen = (() => {
  function render(host, params) {
    params = params || {};
    const id = params.seriesId || Store.state.selectedSeriesId;
    Store.state.selectedSeriesId = id;
    const slim = Store.state.series.find(x => x.id === id);
    if (!slim) { host.innerHTML = '<div class="empty-state"><h2>Series not found</h2></div>'; return; }

    renderShell(host, slim);
    SonarrAPI.series.get(id).then(full => enrichDetail(full || slim)).catch(() => {});
  }

  function renderShell(host, s) {
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'detail-wrap';

    const pct = (s.statistics && s.statistics.percentOfEpisodes) || 0;
    const status = s.monitored
      ? (pct >= 100 ? 'Complete' : 'Missing episodes')
      : 'Not Monitored';

    wrap.innerHTML =
      '<div class="detail-top">' +
        '<div class="detail-poster"><img id="d-poster" alt=""></div>' +
        '<div class="detail-info">' +
          '<h1>' + esc(s.title) + (s.year ? ' <span style="color:var(--muted);font-weight:400;">(' + s.year + ')</span>' : '') + '</h1>' +
          '<div class="meta" id="d-meta">' + esc(s.network || '') + ' · ' + esc(s.status || '') + '</div>' +
          '<div class="overview" id="d-overview">Loading…</div>' +
          '<dl class="detail-stats" id="d-stats">' +
            '<dt>Status</dt><dd>' + esc(status) + '</dd>' +
          '</dl>' +
          '<div class="detail-actions">' +
            '<button class="btn btn-primary" data-nav id="d-search">▶ Search All</button>' +
            '<button class="btn" data-nav id="d-monitor">' + (s.monitored ? '✓ Monitored' : '○ Unmonitored') + '</button>' +
            '<button class="btn btn-danger" data-nav id="d-delete">✕ Delete</button>' +
            '<button class="btn" data-nav id="d-back">← Back</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="d-seasons" class="season-grid"></div>';
    host.appendChild(wrap);

    // Poster
    const $img = document.getElementById('d-poster');
    $img.onerror = () => { $img.style.display = 'none'; };
    const src = SonarrAPI.posterImgSrc(s, 400);
    if (src) $img.src = src;

    // Action buttons
    document.getElementById('d-search').addEventListener('click', () => searchAllSeasons(s));
    document.getElementById('d-monitor').addEventListener('click', () => toggleMonitor(host, s));
    document.getElementById('d-delete').addEventListener('click', () => confirmDelete(s));
    document.getElementById('d-back').addEventListener('click', () => App.navigate('library'));

    // Render season cards from slim cache
    renderSeasons(s.seasons || [], s.id);
    setTimeout(() => Nav.focus(document.getElementById('d-search')), 16);
  }

  function renderSeasons(seasons, seriesId) {
    const host = document.getElementById('d-seasons');
    if (!host) return;
    host.innerHTML = '';
    const visible = seasons.filter(sn => sn.seasonNumber > 0 || (sn.statistics && sn.statistics.episodeCount > 0));
    if (!visible.length) { host.innerHTML = '<p style="padding:16px;color:var(--muted);">No seasons yet.</p>'; return; }

    visible.forEach(sn => {
      const card = document.createElement('div');
      card.className = 'season-card';
      card.dataset.nav = '';
      const epTotal = (sn.statistics && sn.statistics.episodeCount) || 0;
      const epFile  = (sn.statistics && sn.statistics.episodeFileCount) || 0;
      const label   = sn.seasonNumber === 0 ? 'Specials' : 'Season ' + sn.seasonNumber;
      card.innerHTML =
        '<h3>' + esc(label) + '</h3>' +
        '<div class="s-stats">' + epFile + ' / ' + epTotal + ' episodes</div>' +
        (sn.monitored ? '<div class="s-stats" style="color:var(--ok);">Monitored</div>' : '<div class="s-stats" style="color:var(--muted);">Unmonitored</div>');
      card.addEventListener('click', () => {
        Store.state.selectedSeasonNumber = sn.seasonNumber;
        App.navigate('season', { seriesId: seriesId, seasonNumber: sn.seasonNumber });
      });
      host.appendChild(card);
    });
    Nav.invalidateCache();
  }

  function enrichDetail(s) {
    const meta = document.getElementById('d-meta');
    const overview = document.getElementById('d-overview');
    const stats = document.getElementById('d-stats');
    if (!meta || !overview || !stats) return;

    const rating = (s.ratings && s.ratings.value) || 0;
    meta.textContent = [s.network, s.status, (rating ? ('★ ' + rating.toFixed(1)) : '')].filter(Boolean).join(' · ');
    overview.textContent = s.overview || 'No overview available.';

    const pct = (s.statistics && s.statistics.percentOfEpisodes) || 0;
    const epTotal = (s.statistics && s.statistics.episodeCount) || 0;
    const epFile  = (s.statistics && s.statistics.episodeFileCount) || 0;
    stats.innerHTML =
      '<dt>Episodes</dt><dd>' + epFile + ' / ' + epTotal + '</dd>' +
      '<dt>Network</dt><dd>' + esc(s.network || '—') + '</dd>' +
      '<dt>Status</dt><dd>' + esc(s.status || '—') + '</dd>' +
      '<dt>Path</dt><dd style="color:var(--muted);font-size:15px;">' + esc(s.path || '—') + '</dd>';

    // Update season cards with enriched statistics from full response
    renderSeasons(s.seasons || [], s.id);
  }

  function searchAllSeasons(s) {
    const sp = Spinner.show();
    SonarrAPI.command.seriesSearch(s.id)
      .then(() => { Spinner.hide(sp); Toast.show('Searching for all episodes of ' + s.title, 'success'); })
      .catch(e => { Spinner.hide(sp); Toast.show('Search failed: ' + e.message, 'error'); });
  }

  function toggleMonitor(host, s) {
    SonarrAPI.series.get(s.id).then(full => {
      full.monitored = !full.monitored;
      return SonarrAPI.series.edit(s.id, full);
    }).then(updated => {
      const idx = Store.state.series.findIndex(x => x.id === s.id);
      if (idx >= 0) Store.state.series[idx] = Store.slimSeries(updated);
      Toast.show(updated.monitored ? 'Now monitoring' : 'Unmonitored', 'success');
      render(host, { seriesId: s.id });
    }).catch(e => Toast.show('Update failed: ' + e.message, 'error'));
  }

  function confirmDelete(s) {
    // Same modal pattern as radarrzen — copy verbatim, change "movie" → "series"
    // On confirm: SonarrAPI.series.del(s.id, false) → remove from Store.state.series → navigate library
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render };
})();
```

---

## 15. `js/screens/season.js` — Episode List (New Screen)

This screen does not exist in radarrzen. It shows all episodes for a chosen season.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Breaking Bad — Season 2               [← Back] [▶ Search] │
├─────────────────────────────────────────────────────────────┤
│  S02E01  Seven Thirty-Seven       2009-03-08   ✓ Downloaded │
│  S02E02  Grilled                  2009-03-15   ✓ Downloaded │
│  S02E03  Bit by a Dead Bee        2009-03-22   ● Missing    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Navigation
- Back button → `App.navigate('detail', { seriesId })`
- Search Season button → `SonarrAPI.command.seasonSearch(seriesId, seasonNumber)` then toast

### Episode rows
- `data-nav` on each row
- Pressing OK on a row: toggle monitor OR open ISR for that episode

### ISR for individual episodes
Follow the same pattern as radarrzen's `interactiveSearch()` in `detail.js`:
1. `SonarrAPI.release.searchEpisode(seriesId, seasonNumber, episodeId)`
2. Display in same `.isr-panel` modal
3. Grab via `SonarrAPI.release.grab({ guid, indexerId })`
4. **Delay focus to first Grab button by 400ms** (same Tizen key-repeat guard)

```javascript
const SeasonScreen = (() => {
  function render(host, params) {
    params = params || {};
    const seriesId     = params.seriesId     || Store.state.selectedSeriesId;
    const seasonNumber = params.seasonNumber != null ? params.seasonNumber : Store.state.selectedSeasonNumber;

    const slim = Store.state.series.find(x => x.id === seriesId);
    const seriesTitle = slim ? slim.title : 'Series';
    const seasonLabel = seasonNumber === 0 ? 'Specials' : 'Season ' + seasonNumber;

    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

    // Toolbar
    const tb = document.createElement('div');
    tb.className = 'toolbar';
    tb.innerHTML =
      '<h2>' + esc(seriesTitle) + ' — ' + esc(seasonLabel) + '</h2>' +
      '<div style="margin-left:auto;display:flex;gap:12px;">' +
        '<button class="btn btn-primary" data-nav id="sea-search">▶ Search Season</button>' +
        '<button class="btn" data-nav id="sea-back">← Back</button>' +
      '</div>';
    wrap.appendChild(tb);

    const listHost = document.createElement('div');
    listHost.className = 'episode-list';
    listHost.id = 'ep-list';
    const sp = Spinner.show(listHost);
    wrap.appendChild(listHost);
    host.appendChild(wrap);

    document.getElementById('sea-back').addEventListener('click',
      () => App.navigate('detail', { seriesId }));
    document.getElementById('sea-search').addEventListener('click', () => {
      const btn = document.getElementById('sea-search');
      btn.disabled = true;
      SonarrAPI.command.seasonSearch(seriesId, seasonNumber)
        .then(() => { Toast.show('Searching ' + seasonLabel + '…', 'success'); btn.disabled = false; })
        .catch(e => { Toast.show('Search failed: ' + e.message, 'error'); btn.disabled = false; });
    });

    SonarrAPI.episodes.forSeries(seriesId).then(eps => {
      Spinner.hide(sp);
      const filtered = (eps || []).filter(e => e.seasonNumber === seasonNumber);
      filtered.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
      renderEpisodes(listHost, filtered, seriesId, seasonNumber);
    }).catch(e => {
      Spinner.hide(sp);
      listHost.innerHTML = '<div class="empty-state"><h2>Failed to load episodes</h2><p>' + esc(e.message) + '</p></div>';
    });

    setTimeout(() => Nav.focus(document.getElementById('sea-back')), 16);
  }

  function renderEpisodes(host, eps, seriesId, seasonNumber) {
    host.innerHTML = '';
    if (!eps.length) {
      host.innerHTML = '<div class="empty-state"><h2>No episodes</h2></div>';
      return;
    }
    eps.forEach(ep => {
      const row = document.createElement('div');
      row.className = 'episode-row';
      row.dataset.nav = '';
      const epCode = 'S' + pad2(ep.seasonNumber) + 'E' + pad2(ep.episodeNumber);
      const airdate = ep.airDateUtc ? ep.airDateUtc.slice(0, 10) : '—';
      const statusCls = ep.hasFile ? 'ok' : (ep.monitored ? 'missing' : '');
      const statusTxt = ep.hasFile ? '✓ Downloaded' : (ep.monitored ? '● Missing' : '○ Unmonitored');
      row.innerHTML =
        '<span class="ep-num">' + esc(epCode) + '</span>' +
        '<span class="ep-title">' + esc(ep.title || 'TBA') + '</span>' +
        '<span class="ep-airdate">' + esc(airdate) + '</span>' +
        '<span class="ep-status ' + statusCls + '">' + esc(statusTxt) + '</span>';

      row.addEventListener('click', () => {
        if (!ep.hasFile) {
          interactiveSearch({ seriesId, seasonNumber, episode: ep });
        } else {
          Toast.show('Already downloaded', 'info');
        }
      });
      host.appendChild(row);
    });
    Nav.invalidateCache();
  }

  function interactiveSearch({ seriesId, seasonNumber, episode }) {
    const previousFocus = Nav.current;
    const root = document.getElementById('modal-root');
    root.innerHTML = '';

    const back = document.createElement('div');
    back.className = 'modal-backdrop isr-backdrop';
    root.appendChild(back);

    const panel = document.createElement('div');
    panel.className = 'isr-panel';
    const ep = episode;
    const epCode = 'S' + pad2(ep.seasonNumber) + 'E' + pad2(ep.episodeNumber);
    panel.innerHTML =
      '<div class="isr-header">' +
        '<span class="isr-title">Interactive Search — ' + esc(epCode + ' ' + (ep.title || '')) + '</span>' +
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

    SonarrAPI.release.searchEpisode(seriesId, seasonNumber, ep.id).then(results => {
      // Same table render + grab logic as radarrzen detail.js interactiveSearch()
      // Copy the table/grab pattern verbatim — only the API call and title change.
      const body = document.getElementById('isr-body');
      if (!results || !results.length) { body.innerHTML = '<div class="isr-empty">No releases found.</div>'; return; }
      results.sort((a, b) => { if (a.rejected !== b.rejected) return a.rejected ? 1 : -1; return (b.qualityWeight || 0) - (a.qualityWeight || 0); });
      const cap = results.slice(0, 100);
      // ... build table, grab buttons (identical to radarrzen) ...
      // Grab: SonarrAPI.release.grab({ guid: r.guid, indexerId: r.indexerId })
      // Focus delay: setTimeout(() => Nav.focus(firstBtn), 400)
    }).catch(e => {
      const body = document.getElementById('isr-body');
      if (body) body.innerHTML = '<div class="isr-empty">Search failed: ' + esc(e.message) + '</div>';
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render };
})();
```

---

## 16. `js/screens/search.js` — Add Series

Copy radarrzen's `search.js` and adapt for Sonarr series.

### Key differences

| radarrzen | Sonarrzen |
|---|---|
| `RadarrAPI.lookup.search(q)` | `SonarrAPI.lookup.search(q)` |
| `r.tmdbId` | `r.tvdbId` |
| `Store.state.movies.find(m => m.tmdbId === r.tmdbId)` | `Store.state.series.find(s => s.tvdbId === r.tvdbId)` |
| `store.slimMovie(added)` | `Store.slimSeries(added)` |
| `RadarrAPI.movies.add(body)` | `SonarrAPI.series.add(body)` |
| Add body: `tmdbId`, `minimumAvailability`, `addOptions.searchForMovie` | Add body: `tvdbId`, `languageProfileId`, `addOptions.searchForMissingEpisodes` |
| Input placeholder: "Search for a movie title…" | "Search for a TV show title…" |

### Add series body (Sonarr API shape)
```javascript
const body = {
  title:             r.title,
  tvdbId:            r.tvdbId,
  year:              r.year,
  qualityProfileId:  state.profileId,
  languageProfileId: state.langProfileId,
  rootFolderPath:    state.rootPath,
  monitored:         true,
  seasonFolder:      true,
  addOptions: {
    searchForMissingEpisodes: true,
    monitor: 'all',           // 'all' | 'future' | 'missing' | 'existing' | 'none'
  },
  images:  r.images  || [],
  seasons: r.seasons || [],
};
```

### Monitor option dropdown
Add a third dropdown in the "Add" modal:

| Option | Value | Meaning |
|---|---|---|
| All episodes | `all` | Monitor + search every episode |
| Future only | `future` | Only new episodes going forward |
| Missing | `missing` | Monitor only undownloaded episodes |
| None | `none` | Add but don't monitor |

### Language profile
Sonarr v3 requires a `languageProfileId`. Load from `SonarrAPI.languageProfiles.list()` at boot and store in `Store.state.languageProfiles`. Include a language picker dropdown alongside quality profile in the Add modal.

### Post-add navigation
After successful add, navigate to the detail screen:
```javascript
const added = await SonarrAPI.series.add(body);
Store.state.series.push(Store.slimSeries(added));
Store.state.seriesLoadedAt = 0;  // force refetch
close();
if (added && added.id) App.navigate('detail', { seriesId: added.id });
```

### Image
Sonarr lookup results have `images[].remoteUrl` (TVDB CDN direct). Use `SonarrAPI.remoteImgSrc(url, 200)` for all search result images — they are always external TVDB URLs.

```javascript
const posterUrl = pickImage(r, 'poster');  // r.images.find(i => i.coverType === 'poster')?.remoteUrl
if (posterUrl) {
  img.src = SonarrAPI.remoteImgSrc(posterUrl, 200);
}
```

### poster-wrap height
**Must set explicit height.** Same bug as radarrzen (the static grid doesn't set row height in CSS):
```javascript
wrap.style.height = '300px';  // ← required or image collapses to 0px
```

---

## 17. `js/screens/queue.js` — Download Queue

Copy radarrzen's `queue.js` with these field changes:

| radarrzen field | Sonarrzen field |
|---|---|
| `rec.movie && rec.movie.title` | `rec.series && rec.series.title` |
| `rec.title` (fallback) | `rec.episode && rec.episode.title` |

Also display episode info when present:
```javascript
const seriesTitle = (rec.series && rec.series.title) || rec.title || '(unknown)';
const epTitle     = (rec.episode && (
  'S' + pad2(rec.episode.seasonNumber) + 'E' + pad2(rec.episode.episodeNumber) + ' ' + rec.episode.title
)) || '';
```

API call:
```javascript
SonarrAPI.queue.list()  // GET /api/v3/queue?includeSeries=true&includeEpisode=true&pageSize=100
```

Queue refresh interval: keep at 10 seconds (same as radarrzen).

---

## 18. `js/app.js`

Copy radarrzen's `app.js` and adapt:

```javascript
const App = (() => {
  const screens = {
    setup:   typeof SetupScreen   !== 'undefined' ? SetupScreen   : null,
    library: typeof LibraryScreen !== 'undefined' ? LibraryScreen : null,
    detail:  typeof DetailScreen  !== 'undefined' ? DetailScreen  : null,
    season:  typeof SeasonScreen  !== 'undefined' ? SeasonScreen  : null,   // NEW
    search:  typeof SearchScreen  !== 'undefined' ? SearchScreen  : null,
    queue:   typeof QueueScreen   !== 'undefined' ? QueueScreen   : null,
  };

  // ... navigate(), loadInitialData(), boot(), handleBack() same pattern ...

  async function loadInitialData() {
    const [profiles, folders, langProfiles] = await Promise.all([
      SonarrAPI.quality.profiles(),
      SonarrAPI.rootFolders.list(),
      SonarrAPI.languageProfiles.list(),    // Sonarr-specific
    ]);
    Store.state.qualityProfiles  = profiles     || [];
    Store.state.rootFolders      = folders      || [];
    Store.state.languageProfiles = langProfiles || [];
  }

  async function boot() {
    // Register Tizen media keys (copy from radarrzen verbatim)
    Nav.init();
    Nav.setBackHandler(handleBack);

    const ok = Store.loadConfig();
    if (!ok) { navigate('setup'); return; }

    SonarrAPI.configure(Store.state.config.url, Store.state.config.apiKey, Store.state.config.sawsubeUrl);
    Store.loadSeriesCache();

    if (Store.state.series.length > 0) {
      navigate('library');
      loadInitialData().catch(() => {});
      SonarrAPI.system.status().catch(() => Toast.show('Cannot reach Sonarr — check settings', 'error'));
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
    // Close modal if open (same as radarrzen)
    const modal = document.querySelector('#modal-root .modal-backdrop');
    if (modal) { /* close modal */ return; }

    const cur = Store.state.currentScreen;
    if (cur === 'season') { navigate('detail', { seriesId: Store.state.selectedSeriesId }); return; }
    if (cur === 'detail' || cur === 'search' || cur === 'queue') { navigate('library'); return; }
    if (cur === 'library') {
      try { window.tizen && window.tizen.application && window.tizen.application.getCurrentApplication().exit(); } catch (e) {}
    }
  }

  return { navigate, boot, loadInitialData };
})();

document.addEventListener('DOMContentLoaded', App.boot);
```

**Back button chain:** `season` → `detail` → `library` → exit app.

---

## 19. SAWSUBE Integration

### New `.env` variables
SAWSUBE's `.env` already contains (from the Radarrzen build):
```env
RADARRZEN_SRC_PATH=/home/will/Github/radarrzen/src
RADARRZEN_TIZEN_PROFILE=TestProfile

# Add these for Sonarrzen:
SONARRZEN_SRC_PATH=/home/will/Github/Sonarrzen/src
SONARRZEN_TIZEN_PROFILE=TestProfile
```

### New SAWSUBE service method
Add `build_and_install_sonarrzen()` to `tizenbrew_service.py`. Copy `build_and_install_radarrzen()` verbatim and change:
- `RADARRZEN_SRC_PATH` → `SONARRZEN_SRC_PATH`
- `RADARRZEN_TIZEN_PROFILE` → `SONARRZEN_TIZEN_PROFILE`
- `"radarrzen_build"` → `"sonarrzen_build"`
- `app_name="Radarrzen"` → `app_name="Sonarrzen"`
- `app_source="local:radarrzen/src"` → `app_source="local:sonarrzen/src"`
- Config injection key: look for `sonarr` entry in `CURATED_APPS` (or `sonarrzen` — see below)
- Log messages: `build_and_install_sonarrzen`

### Config injection (`inject_app_config`)
The `sawsube-config.js` file is replaced at install time. For Sonarrzen, the injected snippet must write to `localStorage.setItem('sonarrzen-config', ...)`.

Add a Sonarrzen entry to `CURATED_APPS` in `tizenbrew_service.py`:
```python
{
    "id": "sonarrzen",
    "name": "Sonarrzen",
    "source": "WB2024/sonarrzen",   # (or local build)
    "config_file": "js/sawsube-config.js",
    "storage_key": "sonarrzen-config",
    "fields": [
        {"key": "url",        "setting": "Sonarr_URL",      "label": "Sonarr URL"},
        {"key": "apiKey",     "setting": "Sonarr_API_KEY",  "label": "Sonarr API Key"},
        {"key": "sawsubeUrl", "setting": "SAWSUBE_URL",     "label": "SAWSUBE URL"},
    ],
},
```

The existing `inject_app_config` method will handle generating the `sawsube-config.js` snippet using these fields (same pattern as radarrzen).

### New SAWSUBE image proxy endpoint (`/api/sonarr/image`)
Add a new router `backend/routers/sonarr.py` modeled on `backend/routers/radarr.py`:

```python
# GET /api/sonarr/image?path=/api/v3/mediacover/...&w=200
# GET /api/sonarr/image?url=https://artworks.thetvdb.com/...&w=200
```

The `?url=` whitelist should allow (already whitelisted for radarrzen, verify):
- `artworks.thetvdb.com`
- `thetvdb.com`
- `image.tmdb.org` (TVDB sometimes uses TMDB images)

For `?path=`: fetch from Sonarr at `{Sonarr_URL}{path}&apikey={Sonarr_API_KEY}`, resize, cache 30 days.

Register the router in `main.py`:
```python
from backend.routers import sonarr as sonarr_router
app.include_router(sonarr_router.router, prefix="/api/sonarr")
```

---

## 20. All Tizen WebKit Gotchas — Learned the Hard Way

These were discovered building radarrzen. **Every single one will bite you on Sonarrzen if ignored.**

### 20.1 `inset: 0` is silently ignored
`inset` is not supported in the Tizen WebKit engine (based on an older Blink/WebKit build). Writing `position: fixed; inset: 0;` produces a 0×0 element — the element exists but has no size, so it is invisible and has no hit area. **Always use explicit sides:**

```css
/* CORRECT */
position: fixed;
top: 0;
right: 0;
bottom: 0;
left: 0;

/* WRONG — silently zero-sizes the element */
position: fixed;
inset: 0;
```

This affects: `.modal-backdrop`, `.spinner-overlay`, any fullscreen overlay.

The radarrzen bug this caused: ISR modal was invisible but still interactive. Focus went to the first Grab button. User pressed OK thinking nothing happened and auto-grabbed a release.

### 20.2 `div.focus()` is a silent no-op without `tabIndex`

Tizen WebKit only transfers `document.activeElement` (and thus keyboard event routing) to an element if it is natively focusable (INPUT, BUTTON, A, SELECT, TEXTAREA) OR has `tabIndex >= 0`.

Calling `.focus()` on a `<div>` without `tabIndex` silently does nothing — the CSS class changes but `document.activeElement` does not change, so all keyboard events keep going to the previous element.

**radarrzen's Nav.focus() handles this automatically** by setting `el.tabIndex = 0` if the element is not natively focusable. This is why you must always use `Nav.focus(el)` instead of `el.focus()` directly.

### 20.3 Jellyfin keydown model for text inputs

Do not prevent default on LEFT/RIGHT when a text input is focused — the user needs to move the cursor within the field. Only UP/DOWN should spatial-navigate away from the input.

This is the same model used by `jellyfin-web/src/scripts/keyboardNavigation.js`. radarrzen's `nav.js` implements this correctly — copy verbatim.

### 20.4 Performance: no transform/scale on focus

`transform: scale(1.05)` on `.nav-focused` causes full-page composited repaints on Tizen TV. The Samsung Frame 55 has a slow GPU. Use only `outline` changes for focus:

```css
.nav-focused {
  outline: 4px solid var(--accent) !important;
  outline-offset: -4px;
  z-index: 10;
}
```

### 20.5 Virtualize any list with 50+ items

The Samsung Frame TV's Blink engine cannot scroll a DOM with 200+ complex cards without jank. radarrzen's library uses a virtualized viewport (only ~3 rows live in DOM, positioned absolutely). Use the same pattern for the series library. Episode lists (typically ≤25 per season) do not need virtualization — a simple `overflow-y: auto` div is fine.

### 20.6 Scroll: `behavior: 'instant'` not `'smooth'`

Smooth scrolling is sluggish and drops frames on Tizen. Use `scrollTop` assignment directly or `scrollIntoView({ behavior: 'instant' })`. Never use `behavior: 'smooth'`.

### 20.7 Modal focus: delay 400ms before focusing first interactive element

When a modal opens after the user presses OK, Tizen fires a key-repeat event 100–200ms later. If focus is already on a Grab/Confirm button, that key-repeat triggers an immediate click.

**Fix:** Focus the Close button immediately (safe), then after 400ms focus the first actionable button:
```javascript
Nav.setScope(panel);
setTimeout(() => Nav.focus(document.getElementById('isr-close')), 16);
// ...after results load:
if (firstBtn) setTimeout(() => Nav.focus(firstBtn), 400);
```

### 20.8 `img.loading = 'lazy'` + `img.decoding = 'async'`

Always set these on dynamically created `<img>` elements. Without lazy loading, Tizen tries to fetch all poster images at once when the grid renders, causing network congestion and blank posters.

### 20.9 `poster-wrap` must have explicit height in static grids

In a CSS `grid` layout (not the virtualized absolute-position layout), a `div` inside a grid row with no explicit height collapses to 0px even if the grid row has a set height. The `img` inside loads correctly but is invisible.

**Fix:** Always set `wrap.style.height = '300px'` (or the appropriate value) inline when building search result cards. Library cards in the virtualized grid set the card height absolutely, so this is only needed in search.

### 20.10 `Nav.invalidateCache()` after DOM changes

The nav engine caches the list of `[data-nav]` elements for 250ms. After dynamically adding or removing elements, call `Nav.invalidateCache()` to force a fresh query.

### 20.11 `viewport` meta width must be `1920`

```html
<meta name="viewport" content="width=1920">
```

This forces the Tizen browser to use a 1920px layout viewport matching the TV's native resolution. Without it, Tizen may use a default mobile viewport (360px or 980px) and scale the entire UI up, making everything blurry.

### 20.12 Key codes for Tizen remote

```javascript
// Standard keys (always available):
// 38 = Up, 40 = Down, 37 = Left, 39 = Right
// 13 = Enter/OK
// 10009 = Return/Back (Tizen-specific), 27 = Escape

// Media keys (must register via tizen.tvinputdevice.registerKey):
// 'MediaPlayPause', 'MediaFastForward', 'MediaRewind'
// 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'
// 'ChannelUp', 'ChannelDown'
```

Register all media keys at boot (copy radarrzen's `boot()` function).

### 20.13 `Nav.setScope()` for modal trap

When a modal is open, focus must be trapped inside the modal — the user must not be able to arrow-navigate out to background elements. Use `Nav.setScope(modalEl)` before focusing inside the modal, and `Nav.clearScope()` when closing.

### 20.14 `offsetParent === null` means invisible

`nav.js` skips elements where `el.offsetParent === null` (unless it's `document.activeElement`). This correctly skips hidden/display:none elements. Make sure season cards and episode rows are visible before calling `Nav.invalidateCache()`.

---

## 21. Sonarr API Quick Reference

All Sonarr API v3 endpoints used by Sonarrzen. Authoritative shapes: `SonarrApiv3.json`.

| Operation | Method | Path |
|---|---|---|
| Test connection | GET | `/api/v3/system/status` |
| List all series | GET | `/api/v3/series` |
| Get single series | GET | `/api/v3/series/{id}` |
| Add series | POST | `/api/v3/series` |
| Update series | PUT | `/api/v3/series/{id}` |
| Delete series | DELETE | `/api/v3/series/{id}?deleteFiles=false&addImportExclusion=false` |
| Series lookup | GET | `/api/v3/series/lookup?term={q}` |
| Episodes for series | GET | `/api/v3/episode?seriesId={id}` |
| Monitor episodes | PUT | `/api/v3/episode/monitor` body: `{episodeIds, monitored}` |
| Season pass | PUT | `/api/v3/seasonpass` |
| Release search (season) | GET | `/api/v3/release?seriesId={id}&seasonNumber={n}` |
| Release search (episode) | GET | `/api/v3/release?seriesId={id}&seasonNumber={n}&episodeId={epId}` |
| Grab release | POST | `/api/v3/release` body: `{guid, indexerId}` |
| Queue | GET | `/api/v3/queue?includeSeries=true&includeEpisode=true&pageSize=100` |
| Quality profiles | GET | `/api/v3/qualityprofile` |
| Language profiles | GET | `/api/v3/languageprofile` |
| Root folders | GET | `/api/v3/rootfolder` |
| Command: series search | POST | `/api/v3/command` body: `{name:"SeriesSearch", seriesId}` |
| Command: season search | POST | `/api/v3/command` body: `{name:"SeasonSearch", seriesId, seasonNumber}` |
| Command: episode search | POST | `/api/v3/command` body: `{name:"EpisodeSearch", episodeIds:[...]}` |
| Series poster (local) | GET | `/api/v3/mediacover/{seriesId}/poster.jpg?apikey={key}` |

### Key Sonarr data shapes

**Series (slim, used in library grid):**
```json
{
  "id": 1,
  "title": "Breaking Bad",
  "sortTitle": "breaking bad",
  "year": 2008,
  "tvdbId": 81189,
  "status": "ended",
  "monitored": true,
  "network": "AMC",
  "added": "2023-01-15T00:00:00Z",
  "statistics": {
    "episodeFileCount": 62,
    "episodeCount": 62,
    "percentOfEpisodes": 100.0
  },
  "seasons": [
    { "seasonNumber": 1, "monitored": true, "statistics": { "episodeFileCount": 7, "episodeCount": 7 } }
  ],
  "images": [
    { "coverType": "poster", "url": "/api/v3/mediacover/1/poster.jpg", "remoteUrl": "https://artworks.thetvdb.com/banners/..." }
  ]
}
```

**Episode:**
```json
{
  "id": 1001,
  "seriesId": 1,
  "tvdbId": 1234567,
  "episodeFileId": 501,
  "seasonNumber": 1,
  "episodeNumber": 1,
  "title": "Pilot",
  "airDate": "2008-01-20",
  "airDateUtc": "2008-01-21T02:00:00Z",
  "overview": "...",
  "hasFile": true,
  "monitored": true
}
```

**Release (from /release endpoint):**
```json
{
  "guid": "...",
  "indexerId": 1,
  "title": "Breaking.Bad.S01E01...",
  "size": 1073741824,
  "ageHours": 24.5,
  "quality": { "quality": { "id": 7, "name": "HDTV-1080p" }, "revision": { "version": 1 } },
  "qualityWeight": 330,
  "downloadProtocol": "torrent",
  "seeders": 10,
  "leechers": 2,
  "indexer": "Torrentio",
  "rejected": false,
  "rejections": []
}
```

---

## 22. Testing Checklist

Before calling the app complete, verify each of these on the actual Samsung Frame TV (not just a browser):

### Setup
- [ ] Setup screen renders (no existing config)
- [ ] Entering Sonarr URL + API key connects successfully
- [ ] Invalid URL shows error toast
- [ ] Connected host shows in header status bar

### Library
- [ ] Series grid renders with posters
- [ ] Posters load (not blank) — confirms SAWSUBE image proxy is routing correctly
- [ ] Sort by Title works (grid re-renders with new order, not stale)
- [ ] Sort by Year works
- [ ] Filter: Continuing shows only continuing series
- [ ] Filter: Missing shows only monitored series with missing episodes
- [ ] D-pad navigates cards correctly (left/right/up/down)
- [ ] Pressing UP from top row moves focus to toolbar dropdowns
- [ ] Pressing down from toolbar moves focus back to grid

### Detail
- [ ] Series title, overview, network display correctly
- [ ] Season cards render with episode counts
- [ ] "Season 0 / Specials" only shows if it has episodes
- [ ] Search All triggers a command (toast confirms)
- [ ] Monitor toggle changes monitored state
- [ ] Delete prompts confirmation modal, then removes from library
- [ ] Back button returns to library

### Season (episode list)
- [ ] Episodes list with correct S01E01 codes and titles
- [ ] Downloaded episodes show green ✓
- [ ] Missing monitored episodes show amber ●
- [ ] Pressing OK on missing episode opens ISR modal
- [ ] ISR modal is visible (not 0×0) — the `inset: 0` gotcha
- [ ] ISR closes without auto-grabbing when opened — the 400ms delay gotcha
- [ ] Grab button downloads the release and shows success toast
- [ ] Search Season button triggers season search command
- [ ] Back button returns to detail screen

### Search
- [ ] Typing a show name shows results after debounce
- [ ] Posters load in search results (poster-wrap has non-zero height)
- [ ] Shows already in library show "In Library" badge
- [ ] Add overlay opens with quality + language + root folder + monitor options
- [ ] Adding a show navigates to its detail screen

### Queue
- [ ] Episode downloads show series title + episode code
- [ ] Progress bar fills correctly
- [ ] ETA displays correctly
- [ ] Auto-refreshes every 10 seconds

### Navigation (cross-cutting)
- [ ] Back button on remote navigates correctly through the screen stack
- [ ] Back button in season → detail → library → exits app
- [ ] Modal Back/Escape closes modals
- [ ] No "ghost focus" (focus ring appearing on wrong element)
- [ ] No auto-grab (ISR delay working)

---

## 23. Build + Install

### Local build (`build.sh`)

```bash
#!/usr/bin/env bash
set -e
TIZEN=~/tizen-studio/tools/ide/bin/tizen
PROFILE=TestProfile
SRC="$(dirname "$0")/src"
OUT="$(dirname "$0")/dist"

rm -rf "$OUT"
mkdir -p "$OUT"

"$TIZEN" package \
  --type wgt \
  --sign "$PROFILE" \
  -o "$OUT" \
  -- "$SRC"

echo "Built: $(ls "$OUT"/*.wgt)"
```

### Install via SAWSUBE

From SAWSUBE's frontend (TV management page):
1. Click **Install App** → **Sonarrzen (Local Build)**
2. SAWSUBE runs `build_and_install_sonarrzen(tv_id)`:
   - Packages WGT from `SONARRZEN_SRC_PATH`
   - Injects `sonarrzen-config` into `sawsube-config.js`
   - Signs if required (Tizen 7+)
   - Installs via `sdb install`

### Manual install (sdb)
```bash
sdb -s 192.168.1.202:26101 install Sonarrzen.wgt
```

### App IDs
- **Package ID:** `SnarzTV001`
- **App ID:** `SnarzTV001.Sonarrzen`
- **localStorage key:** `sonarrzen-config`

---

## 24. Connection + Auth

- **Sonarr URL:** `http://192.168.1.250:8989` (from `.env`: `Sonarr_URL`)
- **API Key:** `ca9ea34644c74bb68a062bc6697d3a1b` (from `.env`: `Sonarr_API_KEY`)
- **SAWSUBE URL:** `http://192.168.1.48:8000`
- **API header:** `X-Api-Key: {apiKey}` (same pattern as Radarr)

---

## 25. What to Reuse Verbatim vs What to Adapt

| File | Action |
|---|---|
| `nav.js` | **Copy verbatim** — no changes |
| `components/toast.js` | **Copy verbatim** |
| `components/spinner.js` | **Copy verbatim** |
| `css/app.css` | Copy and change accent colour + add episode CSS |
| `components/header.js` | Copy and change brand text + active tab logic for `season` |
| `screens/setup.js` | Copy and change labels/port/API client |
| `screens/queue.js` | Copy and change field names (`movie` → `series`, add episode info) |
| `store.js` | Adapt: Sonarr storage keys, `series` + `slimSeries()` instead of `movies` + `slimMovie()` |
| `api.js` | Adapt: all endpoints, image proxy paths, add `episodes`/`seasonPass`/`languageProfiles` |
| `app.js` | Adapt: add `season` screen, `loadInitialData` includes language profiles, `handleBack` handles `season` |
| `screens/library.js` | Adapt: series filters/sorts, entity field names, poster call, count label |
| `screens/detail.js` | Adapt: series fields, season card grid, different stats, no ISR at series level |
| `screens/search.js` | Adapt: TVDB lookup, add series body, language profile dropdown, monitor option |
| `screens/season.js` | **Write from scratch** — new screen, no radarrzen equivalent |
| `sawsube-config.js` | Adapt: comment + storage key name |
