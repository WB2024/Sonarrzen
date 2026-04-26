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

  // Jellyfin-style edge-geometry spatial nav.
  // direction: 'left'|'right'|'up'|'down' → 0|1|2|3.
  function intersects(a1, a2, b1, b2) {
    return (b1 >= a1 && b1 <= a2) || (b2 >= a1 && b2 <= a2) ||
           (a1 >= b1 && a1 <= b2) || (a2 >= b1 && a2 <= b2);
  }

  function move(direction) {
    if (moveOverride && focusEl) {
      try { if (moveOverride(direction, focusEl)) return; } catch (e) {}
    }
    const all = getAll();
    if (!all.length) return;
    if (!focusEl || all.indexOf(focusEl) < 0) { focus(all[0]); return; }

    const dirIdx = { left: 0, right: 1, up: 2, down: 3 }[direction];
    const r = rect(focusEl);
    const p1x = r.left;
    const p1y = r.top;
    const p2x = r.left + r.width - 1;
    const p2y = r.top + r.height - 1;
    const sMidX = r.left + r.width / 2;
    const sMidY = r.top + r.height / 2;

    let best = null;
    let minDist = Infinity;

    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      if (c === focusEl) continue;
      const er = rect(c);
      if (!er.width && !er.height) continue;

      // Direction filter by element edges (not centers)
      switch (dirIdx) {
        case 0: if (er.left >= r.left || er.right === r.right) continue; break;
        case 1: if (er.right <= r.right || er.left === r.left) continue; break;
        case 2: if (er.top >= r.top || er.bottom >= r.bottom) continue; break;
        case 3: if (er.bottom <= r.bottom || er.top <= r.top) continue; break;
      }

      const x = er.left;
      const y = er.top;
      const x2 = x + er.width - 1;
      const y2 = y + er.height - 1;
      const ix = intersects(p1x, p2x, x, x2);
      const iy = intersects(p1y, p2y, y, y2);
      const midX = er.left + er.width / 2;
      const midY = er.top + er.height / 2;
      let dx, dy;
      switch (dirIdx) {
        case 0: dx = Math.abs(p1x - Math.min(p1x, x2)); dy = iy ? 0 : Math.abs(sMidY - midY); break;
        case 1: dx = Math.abs(p2x - Math.max(p2x, x));  dy = iy ? 0 : Math.abs(sMidY - midY); break;
        case 2: dy = Math.abs(p1y - Math.min(p1y, y2)); dx = ix ? 0 : Math.abs(sMidX - midX); break;
        case 3: dy = Math.abs(p2y - Math.max(p2y, y));  dx = ix ? 0 : Math.abs(sMidX - midX); break;
      }
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; best = c; }
    }
    if (best) focus(best);
  }

  function onKeydown(e) {
    const code = e.keyCode;
    const map = { 38: 'up', 40: 'down', 37: 'left', 39: 'right' };
    if (map[code]) {
      // Jellyfin model:
      //   LEFT/RIGHT — if text input focused, let browser move caret.
      //   UP/DOWN   — always spatial-nav (blurs input on focus()).
      if ((code === 37 || code === 39) && isTextInput(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      move(map[code]);
      return;
    }
    if (code === 13) {
      // Enter on text input → commit + leave field, then move down into results.
      if (isTextInput(e.target)) {
        e.preventDefault();
        try { e.target.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        try { e.target.blur(); } catch (_) {}
        invalidateCache();
        setTimeout(() => move('down'), 60);
        return;
      }
      if (focusEl) {
        e.preventDefault();
        focusEl.click();
      }
      return;
    }
    if (code === 10009 || code === 27) {
      // Tizen back / Esc — also blur any focused input so it doesn't swallow.
      if (isTextInput(e.target)) { try { e.target.blur(); } catch (_) {} }
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
