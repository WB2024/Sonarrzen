// header.js — Top navigation bar (Sonarr)
const Header = (() => {
  const TABS = [
    { id: 'library', label: 'Library'  },
    { id: 'search',  label: 'Search'   },
    { id: 'queue',   label: 'Queue'    },
    { id: 'setup',   label: 'Settings' },
  ];

  function render(currentScreen) {
    const host = document.getElementById('header');
    if (!host) return;
    if (currentScreen === 'setup' && !Store.state.config) { host.innerHTML = ''; return; }

    host.innerHTML = '';
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.textContent = '📺 Sonarr';
    host.appendChild(brand);

    const tabs = document.createElement('div');
    tabs.className = 'header-tabs';
    TABS.forEach(t => {
      const isActive = t.id === currentScreen
        || (t.id === 'library' && (currentScreen === 'detail' || currentScreen === 'season'));
      const b = document.createElement('button');
      b.className = 'header-tab' + (isActive ? ' active' : '');
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
