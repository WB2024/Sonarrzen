// tmdb.js — The Movie Database client for TV (Sonarr).
// Sonarr is tvdbId-based; TMDB is tmdbId-based. We translate via /find.
const TMDB = (function () {
  const BASE = 'https://api.themoviedb.org/3';
  const IMG  = 'https://image.tmdb.org/t/p/w300';

  function key() {
    if (typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY && TMDB_API_KEY.indexOf('__') !== 0) return TMDB_API_KEY;
    try {
      const k = localStorage.getItem('tmdb-api-key');
      if (k) return k;
    } catch (e) {}
    return '';
  }

  function get(path) {
    const k = key();
    if (!k) return Promise.reject(new Error('TMDB key missing'));
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    return fetch(BASE + path + sep + 'api_key=' + encodeURIComponent(k))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('TMDB ' + r.status)); });
  }

  function posterUrl(poster_path) { return poster_path ? (IMG + poster_path) : null; }

  let _genres = null;
  function genres() {
    if (_genres) return Promise.resolve(_genres);
    try {
      const raw = sessionStorage.getItem('sz-tmdb-genres');
      if (raw) { _genres = JSON.parse(raw); return Promise.resolve(_genres); }
    } catch (e) {}
    return get('/genre/tv/list').then(function (d) {
      _genres = (d && d.genres) || [];
      try { sessionStorage.setItem('sz-tmdb-genres', JSON.stringify(_genres)); } catch (e) {}
      return _genres;
    });
  }

  const tv = {
    findByTvdb:      function (tvdbId) { return get('/find/' + tvdbId + '?external_source=tvdb_id'); },
    recommendations: function (id)     { return get('/tv/' + id + '/recommendations'); },
    similar:         function (id)     { return get('/tv/' + id + '/similar'); },
    externalIds:     function (id)     { return get('/tv/' + id + '/external_ids'); },
    trending:        function ()       { return get('/trending/tv/week'); },
    topRated:        function ()       { return get('/tv/top_rated'); },
    discover:        function (genreId, page) {
      return get('/discover/tv?with_genres=' + genreId + '&sort_by=popularity.desc&vote_count.gte=50&page=' + (page || 1));
    },
  };

  // Session-cached TVDB → TMDB ID translation
  function resolveToTmdbId(tvdbId) {
    if (!tvdbId) return Promise.resolve(null);
    const sk = 'sz-tmdb-id-' + tvdbId;
    try {
      const cached = sessionStorage.getItem(sk);
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (e) {}
    return tv.findByTvdb(tvdbId).then(function (data) {
      const r = (data && data.tv_results) || [];
      const tmdbId = r[0] ? r[0].id : null;
      if (tmdbId) { try { sessionStorage.setItem(sk, JSON.stringify(tmdbId)); } catch (e) {} }
      return tmdbId;
    });
  }

  function hasKey() { return !!key(); }

  return { tv, genres, posterUrl, hasKey, resolveToTmdbId };
})();
