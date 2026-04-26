// sawsube-config.js — Pre-install config seed.
//
// In the public GitHub release this file is intentionally a no-op so no
// credentials are committed.  When a user installs via SAWSUBE, this file is
// REPLACED inside the WGT by SAWSUBE's tizenbrew_service.inject_app_config()
// with a snippet that pre-seeds localStorage with their Sonarr URL + API key.
//
// For local browser dev, set the config in DevTools:
//   localStorage.setItem('sonarrzen-config', JSON.stringify({
//     url: 'http://192.168.1.250:8989',
//     apiKey: 'your-key-here',
//     sawsubeUrl: 'http://localhost:8000'
//   }));
(function(){})();
