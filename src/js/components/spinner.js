// spinner.js — Loading overlay
const Spinner = (() => {
  function show(target) {
    const host = target || document.getElementById('screen');
    if (!host) return null;
    const el = document.createElement('div');
    el.className = 'spinner-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    host.appendChild(el);
    return el;
  }
  function hide(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  return { show, hide };
})();
