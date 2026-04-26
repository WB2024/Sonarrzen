// api.js — Sonarr REST API v3 client (Tizen-optimized)
const SonarrAPI = (() => {
  let base = '', key = '', sawsubeBase = '';

  function configure(url, apiKey, sawsubeUrl) {
    base = url.replace(/\/$/, '') + '/api/v3';
    key = apiKey;
    sawsubeBase = (sawsubeUrl || '').replace(/\/$/, '');
  }

  function rawBase() { return base.replace(/\/api\/v3$/, ''); }
  function apiKey() { return key; }
  function hasSawsube() { return !!sawsubeBase; }

  async function request(path, options) {
    const opts = options || {};
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      body: opts.body,
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
      },
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

  function posterUrlFromSeries(s) {
    if (!s) return null;
    if (s.posterUrl) {
      const u = s.posterUrl;
      return u.indexOf('http') === 0 ? u : rawBase() + u;
    }
    const imgs = s.images;
    if (!imgs) return null;
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].coverType === 'poster') {
        const u = imgs[i].remoteUrl || imgs[i].url;
        if (!u) continue;
        return u.indexOf('http') === 0 ? u : rawBase() + u;
      }
    }
    return null;
  }

  function posterUrl(seriesId) {
    return rawBase() + '/api/v3/mediacover/' + seriesId + '/poster.jpg?apikey=' + encodeURIComponent(key);
  }

  // Resized poster via SAWSUBE proxy. Browser HTTP-caches (Cache-Control 30d).
  function posterImgSrc(series, width) {
    const w = width || 200;
    if (!sawsubeBase) {
      const raw = posterUrlFromSeries(series) || posterUrl(series.id);
      return raw + (raw.indexOf('apikey=') >= 0 ? '' : (raw.indexOf('?') >= 0 ? '&' : '?') + 'apikey=' + encodeURIComponent(key));
    }
    const raw = posterUrlFromSeries(series) || posterUrl(series.id);
    const sonarrOrigin = rawBase();
    if (raw.indexOf(sonarrOrigin) === 0) {
      // Sonarr-hosted image — use ?path= so the proxy attaches the API key.
      const pathPart = raw.slice(sonarrOrigin.length);
      return sawsubeBase + '/api/sonarr/image?path=' + encodeURIComponent(pathPart) + '&w=' + w;
    }
    // External URL (TVDB CDN — common for lookups before Sonarr caches locally)
    // — use the whitelisted ?url= proxy.
    return sawsubeBase + '/api/sonarr/image?url=' + encodeURIComponent(raw) + '&w=' + w;
  }

  function remoteImgSrc(url, width) {
    if (!url) return null;
    if (!sawsubeBase) return url;
    const w = width || 200;
    return sawsubeBase + '/api/sonarr/image?url=' + encodeURIComponent(url) + '&w=' + w;
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
  const episodes = {
    forSeries: (seriesId) => request('/episode?seriesId=' + seriesId),
    get:       (id)       => request('/episode/' + id),
    monitor:   (ids, monitored) => request('/episode/monitor', {
      method: 'PUT',
      body: JSON.stringify({ episodeIds: ids, monitored: monitored }),
    }),
  };

  // ── Season pass ──────────────────────────────────────────────────
  const seasonPass = {
    monitor: (seriesId, seasonNumber, monitored) =>
      request('/seasonpass', {
        method: 'POST',
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
  const release = {
    searchSeason:  (seriesId, seasonNumber) =>
      request('/release?seriesId=' + seriesId + '&seasonNumber=' + seasonNumber),
    searchEpisode: (episodeId) =>
      request('/release?episodeId=' + episodeId),
    grab: (body) => request('/release', { method: 'POST', body: JSON.stringify(body) }),
  };

  // ── Lookup (TVDB search) ─────────────────────────────────────────
  const lookup = {
    search: (term) => request('/series/lookup?term=' + encodeURIComponent(term)),
    tvdb:   (id)   => request('/series/lookup?term=' + encodeURIComponent('tvdb:' + id)),
  };

  // ── Commands ─────────────────────────────────────────────────────
  const command = {
    post:                (body)                     => request('/command', { method: 'POST', body: JSON.stringify(body) }),
    seriesSearch:        (seriesId)                 => command.post({ name: 'SeriesSearch', seriesId }),
    seasonSearch:        (seriesId, seasonNumber)   => command.post({ name: 'SeasonSearch', seriesId, seasonNumber }),
    episodeSearch:       (episodeIds)               => command.post({ name: 'EpisodeSearch', episodeIds }),
    missingEpisodeSearch: ()                        => command.post({ name: 'MissingEpisodeSearch' }),
  };

  const quality          = { profiles: () => request('/qualityprofile') };
  const languageProfiles = { list:     () => request('/languageprofile') };
  const rootFolders      = { list:     () => request('/rootfolder') };
  const system           = { status:   () => request('/system/status') };

  async function testConnection(url, apiKeyVal) {
    configure(url, apiKeyVal);
    return system.status();
  }

  return {
    configure, testConnection,
    series, episodes, seasonPass, queue, release, lookup, command,
    quality, languageProfiles, rootFolders, system,
    posterUrl, posterUrlFromSeries, posterImgSrc, remoteImgSrc,
    rawBase, apiKey, hasSawsube,
  };
})();
