# Sonarrzen — Discovery Feature Spec

## Overview

Two linked features that surface new TV series recommendations using The Movie Database (TMDB) API:

1. **Similar Series** — a "You might also like" section at the bottom of every series detail page, based on the currently-viewed series.
2. **Discover Screen** — a dedicated screen (new header tab) showing trending series, top-rated series, and genre-filtered recommendations, all filtered to exclude titles already in your library.

Both features call TMDB directly from the Tizen app (CORS is permitted). No SAWSUBE dependency.

---

## API: The Movie Database (TMDB) for TV

Sonarr uses **TheTVDB** as its metadata provider and stores `tvdbId` on each series. TMDB also provides excellent TV show coverage with its own TV recommendation endpoints.

**Why TMDB instead of TheTVDB for discovery?**

| Criterion | TMDB | TVDB v4 |
|---|---|---|
| `/similar` series endpoint | ✅ Works | ❌ Returns "Bad Request" (tested) |
| TV recommendations endpoint | ✅ `/tv/{id}/recommendations` | ❌ Not available |
| Discover by genre | ✅ `/discover/tv?with_genres=X` | ❌ Not available |
| Auth model | Simple `?api_key=` query param | JWT (must POST to `/login` first, 30-day token) |
| CORS | ✅ `*` header | ✅ with auth header |
| TMDB ID from TVDB ID | ✅ `/find/{tvdb_id}?external_source=tvdb_id` | N/A |

**Decision**: Use TMDB for all discovery calls. TVDB API key is kept for potential future use (e.g., fetching episode images, extended metadata) but is not used in Phase 1 or 2.

**TMDB ID lookup for a Sonarr series**:  
`GET https://api.themoviedb.org/3/find/{tvdbId}?external_source=tvdb_id&api_key=KEY`  
Returns `tv_results[0].id` — the TMDB TV show ID. Tested live:  
- Breaking Bad TVDB `81189` → TMDB `1396` ✅  

---

## API Reference

**Base URL**: `https://api.themoviedb.org/3`  
**Auth**: `?api_key=KEY` query param  
**CORS**: ✅  
**Image base**: `https://image.tmdb.org/t/p/w300{poster_path}`

### Endpoints used

| Purpose | Endpoint |
|---|---|
| Look up TMDB ID from TVDB ID | `GET /find/{tvdb_id}?external_source=tvdb_id` |
| Series recommendations | `GET /tv/{tmdb_id}/recommendations` |
| Series similar | `GET /tv/{tmdb_id}/similar` |
| Trending series (week) | `GET /trending/tv/week` |
| Top rated TV | `GET /tv/top_rated` |
| Discover by genre | `GET /discover/tv?with_genres={id}&sort_by=vote_average.desc&vote_count.gte=50` |
| TV genre list | `GET /genre/tv/list` |

All results include: `id` (TMDB id), `name`, `first_air_date`, `overview`, `poster_path`, `vote_average`, `genre_ids`.

---

## ID Translation Strategy

Sonarr stores `tvdbId` on every series. TMDB recommendations need a TMDB TV ID.

**Translation flow**:
1. On detail page load, call `GET /find/{series.tvdbId}?external_source=tvdb_id`.
2. Cache the result in `sessionStorage` keyed by `tvdbId` → `{ tmdbId, tmdbName }`.
3. Use the `tmdbId` for recommendation calls.
4. If translation fails (series not on TMDB), skip the similar rail silently.

**Session cache key**: `sz-tmdb-id-{tvdbId}`

This avoids repeated `/find` calls when the user navigates back to the same detail page within a session.

---

## Feature 1: Similar Series on Detail Page

### Behaviour

- After the detail page enriches (full data loaded), fetch the TMDB ID then `GET /tv/{tmdb_id}/recommendations`.
- Render a horizontal scrollable rail of poster cards below the season grid.
- Each card: poster image, series title, year, TMDB rating.
- Card interaction:
  - **Already in library** (check `Store.state.series.find(s => s.tvdbId === result.tvdb_id)` — see note below): navigate to that series' detail page.
  - **Not in library**: open the "Add Series" overlay (same as search screen).
- Silent failure if no results or API error.

**TVDB ID on TMDB results**: TMDB TV results include `id` (their own ID) but not `tvdb_id` in the recommendations list. To check if a recommendation is already in the Sonarr library, we have two options:

- **Option A**: After getting recommendations, call `/find/{tmdb_id}?external_source=tmdb` — too many round-trips.
- **Option B**: In the "Add Series" overlay, perform a Sonarr lookup `SonarrAPI.series.lookup('tmdb:{tmdb_id}')` which returns a result with `tvdbId` — then check against `Store.state.series`.
- **Option C (recommended)**: Store `tmdbId` in slim series cache. Sonarr's API does not always return a TMDB ID natively, but we can populate it during the `/find` translation step.

**Recommended implementation**: Store the TMDB ID in `sessionStorage` as part of the translation cache. For the "already in library" check on the similar rail, check against a session-cached `tvdbId → tmdbId` map built lazily. If a series hasn't been translated yet, assume it's not in library (conservative — worst case we show it as addable when it's already there, and the add overlay will catch it).

### Add Series Overlay

Sonarr's add flow requires:
- `tvdbId` (required by `SonarrAPI.series.add`)
- `title`, `year`, `images`, `seasons`

From TMDB recommendations results we get a TMDB ID but not a TVDB ID. To add the series to Sonarr:
1. Use the existing `SonarrAPI.lookup.search('tmdb:{tmdb_id}')` or `SonarrAPI.lookup.tvdb(tvdb_id)`.
2. Actually: call `GET https://api.themoviedb.org/3/tv/{tmdb_id}/external_ids?api_key=KEY` to get the TVDB ID from TMDB.
3. Then call `SonarrAPI.lookup.tvdb(tvdbId)` to get the full Sonarr-ready series object.
4. Pass to the Add Series overlay.

This is a 2-step async process — the Add button shows a spinner while resolving IDs.

**TMDB external IDs endpoint**: `GET /tv/{tmdb_id}/external_ids?api_key=KEY`  
Returns: `{ tvdb_id, imdb_id, ... }`

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [poster]  [series info + actions]                              │
│            ── existing detail top ──                            │
├─────────────────────────────────────────────────────────────────┤
│  Seasons                                                        │
│  [S1] [S2] [S3] [S4] [S5]                                      │
├─────────────────────────────────────────────────────────────────┤
│  You might also like                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│  │      │ │      │ │      │ │      │ │      │  ←→ scroll       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                 │
│  Title     Title    Title    Title    Title                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 2: Discover Screen

### Behaviour

- New header tab: **Discover** (between Queue and Settings).
- Two sections:
  1. **Trending This Week** — `GET /trending/tv/week` → filter out library items → show rail.
  2. **Browse by Genre** — horizontal list of genre buttons. Selecting one loads a discover grid for that genre.

### New file: `src/js/screens/discover.js`

```js
const DiscoverScreen = (() => {
  let _genres = null;

  function render(host) { /* ... */ }

  function isInLibrary(tmdbId) {
    // Series cache is tvdbId-based, not tmdbId-based.
    // Use session cache of tvdbId→tmdbId translations to match.
    // Falls through to false if not yet translated — acceptable.
    return false; // TODO: enhance with session-cached tmdb→tvdb map
  }

  function renderRail(container, results) { /* poster cards */ }
  function renderGenreGrid(container, genreId) { /* discover grid */ }

  return { render };
})();
```

**Note on "already in library" filtering for the discover screen**: Because Sonarr is tvdbId-based and TMDB results are tmdbId-based, perfect de-duplication requires the tvdbId→tmdbId session cache to be populated. On first visit to Discover, the cache is empty. Options:

- **Option A** (recommended for Phase 1): Skip de-duplication on Discover. Show all trending/genre results. The add overlay will detect if a series is already in the library when the user tries to add it (Sonarr's API returns an error for duplicates, or we check during lookup).
- **Option B** (Phase 2): When the library loads, batch-resolve TMDB IDs for all series. Store a `tvdbId → tmdbId` map in `sessionStorage`. Discover screen uses this map to filter. Background resolution is ~N API calls where N = library size — do in batches with delays to avoid rate-limiting.

---

## New Files

### `src/js/tmdb.js`

```js
const TMDB = (() => {
  const BASE = 'https://api.themoviedb.org/3';
  const KEY  = typeof TMDB_API_KEY !== 'undefined' ? TMDB_API_KEY : '';
  const IMG  = 'https://image.tmdb.org/t/p/w300';

  function get(path) {
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    return fetch(BASE + path + sep + 'api_key=' + KEY)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('TMDB ' + r.status)));
  }

  function posterUrl(poster_path) {
    return poster_path ? IMG + poster_path : null;
  }

  // TV-specific
  const tv = {
    findByTvdb:      (tvdbId)  => get('/find/' + tvdbId + '?external_source=tvdb_id'),
    recommendations: (tmdbId)  => get('/tv/' + tmdbId + '/recommendations'),
    similar:         (tmdbId)  => get('/tv/' + tmdbId + '/similar'),
    externalIds:     (tmdbId)  => get('/tv/' + tmdbId + '/external_ids'),
    trending:        ()        => get('/trending/tv/week'),
    topRated:        ()        => get('/tv/top_rated'),
    discover:        (genreId, page) => get('/discover/tv?with_genres=' + genreId + '&sort_by=vote_average.desc&vote_count.gte=50&page=' + (page || 1)),
    genres:          ()        => get('/genre/tv/list'),
  };

  // Session-cached TVDB→TMDB ID translation
  async function resolveToTmdbId(tvdbId) {
    const key = 'sz-tmdb-id-' + tvdbId;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    const data = await tv.findByTvdb(tvdbId);
    const result = (data.tv_results || [])[0];
    if (!result) return null;
    const tmdbId = result.id;
    try { sessionStorage.setItem(key, JSON.stringify(tmdbId)); } catch (e) {}
    return tmdbId;
  }

  return { tv, posterUrl, resolveToTmdbId };
})();
```

---

## Changes to Existing Files

### `src/js/screens/detail.js`

Add `loadSimilar(series)` function called after `enrichDetail()`:

```js
async function loadSimilar(s) {
  try {
    const tmdbId = await TMDB.resolveToTmdbId(s.tvdbId);
    if (!tmdbId) return;
    const data = await TMDB.tv.recommendations(tmdbId);
    const results = (data.results || []).slice(0, 10);
    if (!results.length) return;
    renderSimilarRail(results);
  } catch (e) { /* silent */ }
}
```

### `src/js/components/header.js`

Add `{ id: 'discover', label: 'Discover' }` between Queue and Settings.

### `src/js/app.js`

- Register `DiscoverScreen` in `screens`.
- Add `'discover'` to the `handleBack` chain (back → library).

### `src/index.html`

```html
<script src="js/tmdb.js"></script>
<script src="js/screens/discover.js"></script>
```

---

## Build-time API Key Injection

Modify `build.sh` to accept `TMDB_API_KEY` env var and inject into `sawsube-config.js`:

```bash
TMDB_KEY="${TMDB_API_KEY:-}"
# Replace placeholder in sawsube-config.js
```

Template line in `sawsube-config.js`:
```js
var TMDB_API_KEY = '__TMDB_API_KEY__';
```

SAWSUBE injects this from its `.env` `TMDB_API_KEY` during `inject_app_config()`.

---

## Implementation Phases

### Phase 1 — Similar series on detail page
- [ ] Create `src/js/tmdb.js` with `resolveToTmdbId()` + session cache
- [ ] Add build-time TMDB key injection to `build.sh`
- [ ] Add `loadSimilar()` + similar rail to `detail.js`
- [ ] Extract add-series overlay from `search.js` to `src/js/components/addseries.js`
- [ ] Add-series flow: TMDB `external_ids` → tvdbId → `SonarrAPI.lookup.tvdb()` → overlay
- [ ] Test TVDB→TMDB ID translation on real library (requires internet from Tizen)

### Phase 2 — Discover screen
- [ ] Create `src/js/screens/discover.js`
- [ ] Trending rail + genre browser
- [ ] Add tab to header, register in app.js
- [ ] Add script tags to index.html

### Phase 3 — Library-aware de-duplication on Discover
- [ ] On library load, batch-resolve TMDB IDs for all series (background, throttled)
- [ ] Store `tvdb→tmdb` map in sessionStorage
- [ ] Discover screen uses map to filter out existing library items

---

## Tizen Compatibility Notes

- **CORS**: TMDB API returns `Access-Control-Allow-Origin: *`. ✅
- **HTTPS**: All TMDB and CDN endpoints are HTTPS. ✅
- **`fetch`**: Available on Tizen 6.5. ✅
- **`sessionStorage`**: Available. ✅
- **Chained async calls**: ID translation (`/find`) + recommendations = 2 fetches per detail page view. Both are fast (<200ms each). Show a subtle loading indicator in the rail while fetching.
- **Grid size**: Cap discover grid at 20 items, similar rail at 10.
- **Rate limiting**: TMDB allows ~40 requests/10 seconds. With a library of 100+ series, Phase 3 batch resolution needs throttling (e.g., 2 requests/second).
- **`Nav.invalidateCache()`**: Must be called after every dynamic DOM update in rails/grids.

---

## Security Notes

- TMDB API key embedded in client-side JS — acceptable for a self-hosted personal TV app.
- `sawsube-config.js` (where the key lives at runtime) must be in `.gitignore`. Only the placeholder template is committed.
- All discovery calls are read-only GET requests. No personal data sent to TMDB.
- TVDB API key is present in `.env` but not used in Phase 1 or 2 — no exposure risk.
