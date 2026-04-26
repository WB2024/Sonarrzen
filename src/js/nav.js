// nav.js — Spatial D-pad focus manager (Tizen-optimized)
//   • Instant scroll (smooth = sluggish on Tizen WebKit)
//   • Cached focusable list, invalidated on demand
//   • setMoveOverride(fn) — let virtualized screens own arrow nav
const Nav = (() => {
  let focusEl = null;
  let backHandler = null;
  let moveOverride = null;
  const FOCUS_ATTR = 'data-nav';
  const FOCUS_CLASS = 'nav-focused';

  let scope = null;
  let cachedList = null;
  let cachedListAt = 0;
  const CACHE_TTL_MS = 250;

  function root() { return scope || document; }

  function getAll() {
    const now = Date.now();
    if (cachedList && (now - cachedListAt) < CACHE_TTL_MS) return cachedList;
    const list = [];
    const nodes = root().querySelectorAll('[' + FOCUS_ATTR + ']:not([disabled]):not([data-nav-skip])');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.offsetParent === null && el !== document.activeElement) continue;
      list.push(el);
    }
    cachedList = list;
    cachedListAt = now;
    return list;
  }

  function invalidateCache() { cachedList = null; }

  function rect(el) { return el.getBoundingClientRect(); }

  // Natively-focusable tags that work with .focus() without tabIndex.
  const NATIVE_FOCUS_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, BUTTON: 1, A: 1 };

  // Text-input types where LEFT/RIGHT move the cursor (Jellyfin model).
  const TEXT_INPUT_TYPES = { '': 1, text: 1, search: 1, email: 1, tel: 1, url: 1, password: 1, number: 1 };

  function isTextInput(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') return !!TEXT_INPUT_TYPES[(el.type || '').toLowerCase()];
    return false;
  }

  function focus(el) {
    if (!el) return;
    if (focusEl && focusEl !== el) focusEl.classList.remove(FOCUS_CLASS);
    focusEl = el;
    el.classList.add(FOCUS_CLASS);
    // Non-native elements (divs, spans…) need tabIndex=0 for .focus() to
    // actually transfer browser focus.  Without this document.activeElement
    // stays on the previous element and keys continue going there.
    if (!NATIVE_FOCUS_TAGS[el.tagName] && !(el.tabIndex >= 0)) {
      el.tabIndex = 0;
    }
    try {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight ||
          r.left < 0 || r.right > window.innerWidth) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } catch (e) {}
    if (typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (_) {} }
    }
  }

  function move(direction) {
    if (moveOverride && focusEl) {
      try { if (moveOverride(direction, focusEl)) return; } catch (e) {}
    }
    const all = getAll();
    if (!all.length) return;
    if (!focusEl || all.indexOf(focusEl) < 0) { focus(all[0]); return; }

    const cr = rect(focusEl);
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;

    let best = null, bestScore = Infinity;
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el === focusEl) continue;
      const r = rect(el);
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - cx, dy = ey - cy;

      if (direction === 'up'    && dy >= -2) continue;
      if (direction === 'down'  && dy <=  2) continue;
      if (direction === 'left'  && dx >= -2) continue;
      if (direction === 'right' && dx <=  2) continue;

      const primary = (direction === 'up' || direction === 'down') ? Math.abs(dy) : Math.abs(dx);
      const perp    = (direction === 'up' || direction === 'down') ? Math.abs(dx) : Math.abs(dy);
      const score   = primary + perp * 0.4;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) focus(best);
  }

  function onKeydown(e) {
    const code = e.keyCode;
    const map = { 38: 'up', 40: 'down', 37: 'left', 39: 'right' };
    if (map[code]) {
      // Jellyfin model:
      //   LEFT (37) / RIGHT (39) — pass through if a text input is focused so
      //     the cursor can move.  The user presses DOWN to leave the input.
      //   UP (38) / DOWN (40)   — always spatial-navigate, even from inputs.
      // This is exactly how jellyfin-web/keyboardNavigation.js works.
      if ((code === 37 || code === 39) && isTextInput(e.target)) {
        return; // let browser handle cursor movement
      }
      e.preventDefault();
      move(map[code]);
      return;
    }
    if (code === 13) {
      if (focusEl && focusEl.tagName !== 'INPUT' && focusEl.tagName !== 'TEXTAREA') {
        e.preventDefault();
        focusEl.click();
      }
      return;
    }
    if (code === 10009 || code === 27) {
      if (backHandler) { e.preventDefault(); backHandler(); }
    }
  }

  function init() { document.addEventListener('keydown', onKeydown, true); }

  function reset(defaultEl) {
    invalidateCache();
    const all = getAll();
    focus(defaultEl || all[0] || null);
  }

  function setScope(container) { scope = container; focusEl = null; invalidateCache(); }
  function clearScope() { scope = null; focusEl = null; invalidateCache(); }
  function setBackHandler(fn) { backHandler = fn; }
  function setMoveOverride(fn) { moveOverride = fn; }
  function clearMoveOverride() { moveOverride = null; }

  return {
    init, focus, move, reset,
    setScope, clearScope, setBackHandler,
    setMoveOverride, clearMoveOverride, invalidateCache,
    get current() { return focusEl; },
  };
})();
