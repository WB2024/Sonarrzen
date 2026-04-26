// toast.js — Timed notification overlay
const Toast = (() => {
  function show(msg, type = 'info', duration = 3000) {
    const root = document.getElementById('toast');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast-msg ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, duration);
  }
  return { show };
})();
