/* == layout.js == */
(function () {
  'use strict';
  var CME = (window.CME = window.CME || {});
  var root = document.documentElement;
  var KEY = 'cme-theme';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var listeners = [];

  /* ---------- theme ---------- */
  function saved() {
    try { var t = localStorage.getItem(KEY); return (t === 'light' || t === 'dark') ? t : null; } catch (e) { return null; }
  }
  function effective() {
    var a = root.getAttribute('data-theme');
    if (a === 'light' || a === 'dark') return a;
    return (mq && mq.matches) ? 'dark' : 'light';
  }
  function apply(t) {
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
  }
  function persist(t) {
    try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function notify() {
    var eff = effective(), s = saved();
    syncToggle(eff);
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](eff, s); } catch (e) {} }
    try { document.dispatchEvent(new CustomEvent('cme:theme', { detail: { theme: eff, saved: s } })); } catch (e) {}
  }
  function set(t) {
    t = (t === 'light' || t === 'dark') ? t : null;
    apply(t); persist(t); notify();
    return effective();
  }
  function toggle() { return set(effective() === 'dark' ? 'light' : 'dark'); }
  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); };
  }

  var btn = document.querySelector('[data-theme-toggle]');
  function syncToggle(eff) {
    if (!btn) return;
    var dark = eff === 'dark';
    var label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }
  if (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('is-switching');
      void btn.offsetWidth;                 /* restart the pop animation on rapid clicks */
      btn.classList.add('is-switching');
      toggle();
    });
    btn.addEventListener('animationend', function () { btn.classList.remove('is-switching'); });
  }
  if (mq) {                                  /* system preference changed while following the system */
    var onMq = function () { if (!saved()) notify(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  window.addEventListener('storage', function (e) {   /* another tab switched the theme */
    if (e.key === KEY || e.key === null) { apply(saved()); notify(); }
  });

  CME.theme = { KEY: KEY, get: saved, effective: effective, set: set, toggle: toggle, onChange: onChange };
  syncToggle(effective());

  /* ---------- active nav link ---------- */
  var nav = document.querySelector('[data-nav-active]');
  if (nav) {
    var want = nav.getAttribute('data-nav-active');
    var links = nav.querySelectorAll('[data-nav]');
    for (var j = 0; j < links.length; j++) {
      var on = links[j].getAttribute('data-nav') === want;
      links[j].classList.toggle('is-active', on);
      if (on) links[j].setAttribute('aria-current', 'page'); else links[j].removeAttribute('aria-current');
    }
  }

  /* ---------- compact sticky header ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var ticking = false, scrolled = false;
    var update = function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      /* only compact when there is real scroll room, so short pages cannot flicker at the threshold */
      var s = y > 8 && (scrolled || (root.scrollHeight - window.innerHeight) > 160);
      if (s !== scrolled) { scrolled = s; header.classList.toggle('is-scrolled', s); }
    };
    var request = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    update();
  }
})();

/* == card.js == */
(function () {
  'use strict';
  var CME = window.CME = window.CME || {};
  var FLASH_MS = 1600;
  var live = null;

  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'visually-hidden';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 30);
  }

  function cardOf(el) { return el && el.closest ? el.closest('.card') : null; }

  /* toggleAbstract(target, force?) — target is the toggle button or the .card. Returns the new state. */
  function toggleAbstract(target, force) {
    var card = target.classList && target.classList.contains('card') ? target : cardOf(target);
    if (!card) return false;
    var btn = card.querySelector('[data-action="toggle-abstract"]');
    var panel = card.querySelector('.card-abstract');
    if (!btn || !panel) return false;
    var open = typeof force === 'boolean' ? force : btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    return open;
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    var active = document.activeElement;
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (active && active.focus) active.focus();
    return ok;
  }

  /* copyText(text) -> Promise<boolean> */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(text); }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function flash(btn, ok) {
    if (!btn.hasAttribute('data-label')) btn.setAttribute('data-label', btn.textContent.trim());
    if (btn._cmeTimer) window.clearTimeout(btn._cmeTimer);
    btn.classList.remove('is-copied', 'is-failed');
    btn.classList.add(ok ? 'is-copied' : 'is-failed');
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    announce(ok ? 'Copied to clipboard' : 'Could not copy to clipboard');
    btn._cmeTimer = window.setTimeout(function () {
      btn.classList.remove('is-copied', 'is-failed');
      btn.textContent = btn.getAttribute('data-label');
      btn._cmeTimer = null;
    }, FLASH_MS);
  }

  /* copyFrom(btn) -> Promise<boolean>: copies btn's data-copy and flashes the result on it */
  function copyFrom(btn) {
    var text = btn.getAttribute('data-copy') || '';
    if (!text) { flash(btn, false); return Promise.resolve(false); }
    return copyText(text).then(function (ok) { flash(btn, ok); return ok; });
  }

  /* init(root): replace the abstract toggle with a quiet label on cards without an abstract */
  function init(root) {
    root = root || document;
    var cards = root.querySelectorAll ? root.querySelectorAll('.card') : [];
    Array.prototype.forEach.call(cards, function (card) {
      if (card.getAttribute('data-card-ready') === '1') return;
      card.setAttribute('data-card-ready', '1');
      var btn = card.querySelector('[data-action="toggle-abstract"]');
      var text = card.querySelector('.card-abstract-text');
      if (btn && (!text || !text.textContent.trim())) {
        var none = document.createElement('span');
        none.className = 'card-abstract-none';
        none.textContent = 'No abstract indexed';
        btn.replaceWith(none);
        var panel = card.querySelector('.card-abstract');
        if (panel) panel.remove();
      }
    });
  }

  function setAll(root, open) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('.card'), function (card) {
      if (card.querySelector('[data-action="toggle-abstract"]')) toggleAbstract(card, open);
    });
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (action === 'toggle-abstract') {
      ev.preventDefault();
      toggleAbstract(el);
    } else if (action === 'copy') {
      ev.preventDefault();
      copyFrom(el);
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var card = cardOf(ev.target);
    if (!card) return;
    var btn = card.querySelector('[data-action="toggle-abstract"][aria-expanded="true"]');
    if (btn) {
      toggleAbstract(card, false);
      btn.focus();
      ev.preventDefault();
    }
  });

  CME.card = {
    init: init,
    toggleAbstract: toggleAbstract,
    copyText: copyText,
    copyFrom: copyFrom,
    expandAll: function (root) { setAll(root, true); },
    collapseAll: function (root) { setAll(root, false); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();

/* == filters.js == */
(function () {
  'use strict';
  var doc = document;
  var CME = window.CME = window.CME || {};
  if (CME.filters && CME.filters.version) return;

  var STORE = 'cme.filters:' + location.pathname;
  var SORT_KEYS = ['impact', 'votes', 'relevance', 'date', 'cites'];
  var ONLY_KEYS = ['gem', 'preprint', 'review'];
  var DEBOUNCE = 120;

  var root = null, chipsBox, chips = [], search, searchClear, sortSel, toggles = [], countEl, clearBtn, emptyEl;
  var cards = [], groups = [], sections = [], threads = {}, threadOrder = [];
  var DEFAULT_SORT = 'impact';
  var state = { t: [], q: '', sort: DEFAULT_SORT, only: [] };
  var terms = [];
  var listeners = [];
  var timer = null, bound = false, observer = null, lastCount = '';

  /* ---------- helpers ---------- */
  function fold(s) {
    s = String(s == null ? '' : s).toLowerCase();
    try { s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* old engines */ }
    return s.replace(/\s+/g, ' ').trim();
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function flag(v) { return v === '1' || v === 'true'; }
  function uniq(a) { var o = [], i; for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) < 0) o.push(a[i]); return o; }
  function toList(v) { return [].concat(v || []).join(',').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }

  function normalize(s) {
    s = s || {};
    var t = uniq(toList(s.t).filter(function (x) { return threads[x] != null; }));
    t.sort(function (a, b) { return threadOrder.indexOf(a) - threadOrder.indexOf(b); });
    var only = uniq(toList(s.only).filter(function (x) { return ONLY_KEYS.indexOf(x) >= 0; }));
    only.sort(function (a, b) { return ONLY_KEYS.indexOf(a) - ONLY_KEYS.indexOf(b); });
    return {
      t: t,
      q: String(s.q == null ? '' : s.q).replace(/\s+/g, ' ').slice(0, 200),
      sort: s.sort === 'order' ? 'order' : (SORT_KEYS.indexOf(s.sort) >= 0 ? s.sort : DEFAULT_SORT),
      only: only
    };
  }
  function filtering() { return !!(state.t.length || state.q.trim() || state.only.length); }
  function active() { return filtering() || state.sort !== DEFAULT_SORT; }

  /* ---------- hash + storage ---------- */
  function serialize(s) {
    s = s || state;
    var parts = [];
    if (s.t.length) parts.push('t=' + s.t.join(','));
    if (s.q.trim()) parts.push('q=' + encodeURIComponent(s.q.trim()).replace(/%20/g, '+'));
    if (s.sort && s.sort !== DEFAULT_SORT) parts.push('sort=' + s.sort);
    if (s.only.length) parts.push('only=' + s.only.join(','));
    return parts.join('&');
  }
  function parseHash(h) {
    h = String(h == null ? location.hash : h).replace(/^#/, '');
    if (h.indexOf('=') < 0) return null;            // a plain #anchor, not filter state
    var o = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 0) return;
      var k = kv.slice(0, i), v = kv.slice(i + 1);
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
      o[k] = v;
    });
    return normalize(o);
  }
  function writeHash() {
    var h = serialize(), cur = location.hash.replace(/^#/, '');
    if (h === cur) return;
    if (!h && cur && cur.indexOf('=') < 0) return;  // never clobber a plain anchor with nothing
    var url = location.pathname + location.search + (h ? '#' + h : '');
    try { history.replaceState(history.state, '', url); } catch (e) { location.hash = h; }
  }
  function readStore() {
    try { var v = localStorage.getItem(STORE); return v ? normalize(JSON.parse(v)) : null; } catch (e) { return null; }
  }
  function writeStore() {
    try { if (active()) localStorage.setItem(STORE, JSON.stringify(state)); else localStorage.removeItem(STORE); } catch (e) { /* private mode */ }
  }

  /* ---------- indexing ---------- */
  function index() {
    cards = []; groups = []; sections = []; threads = {};
    var order = 0, byParent = [];
    $$('.issue-section', doc).forEach(function (secEl) {
      var sec = { el: secEl, key: secEl.getAttribute('data-section') || '', recs: [] };
      $$('.card', secEl).forEach(function (el) {
        var d = el.dataset;
        var rec = {
          el: el, sec: sec, order: order++, votes: num(el.getAttribute('data-votes')),
          thread: d.thread || 'other',
          impact: num(d.impact), relevance: num(d.relevance), date: d.date || '', cites: num(d.cites) || 0,
          gem: flag(d.gem), preprint: flag(d.preprint), review: flag(d.review),
          hay: fold(d.search != null && d.search !== '' ? d.search : el.textContent),
          visible: true
        };
        cards.push(rec); sec.recs.push(rec);
        threads[rec.thread] = (threads[rec.thread] || 0) + 1;
        var g = null;
        for (var i = 0; i < byParent.length; i++) if (byParent[i].parent === el.parentNode) { g = byParent[i]; break; }
        if (!g) { g = { parent: el.parentNode, recs: [], current: [], after: null }; byParent.push(g); groups.push(g); }
        g.recs.push(rec); g.current.push(rec); g.after = el.nextSibling;
      });
      sections.push(sec);
    });
    threadOrder = chips.map(function (c) { return c.getAttribute('data-thread'); });
    Object.keys(threads).forEach(function (t) { if (threadOrder.indexOf(t) < 0) threadOrder.push(t); });
  }

  /* ---------- sorting ---------- */
  function comparator(key) {
    if (!key || key === 'order') return function (a, b) { return a.order - b.order; };
    return function (a, b) {
      var av = a[key], bv = b[key];
      if (key === 'date') { if (av !== bv) return av < bv ? 1 : -1; }
      else {
        var an = av == null, bn = bv == null;
        if (an !== bn) return an ? 1 : -1;               // missing values sink
        if (!an && av !== bv) return bv - av;            // descending
      }
      return a.order - b.order;                          // stable: issue order breaks ties
    };
  }
  function reorder() {
    var cmp = comparator(state.sort);
    groups.forEach(function (g) {
      var sorted = g.recs.slice().sort(cmp), same = true, i;
      for (i = 0; i < sorted.length; i++) if (sorted[i] !== g.current[i]) { same = false; break; }
      if (same) return;
      var ref = g.after && g.after.parentNode === g.parent ? g.after : null;
      for (i = 0; i < sorted.length; i++) g.parent.insertBefore(sorted[i].el, ref);
      g.current = sorted;
    });
  }

  /* ---------- apply ---------- */
  function passes(rec, ignoreThread) {
    var i;
    if (!ignoreThread && state.t.length && state.t.indexOf(rec.thread) < 0) return false;
    for (i = 0; i < state.only.length; i++) if (!rec[state.only[i]]) return false;
    for (i = 0; i < terms.length; i++) if (rec.hay.indexOf(terms[i]) < 0) return false;
    return true;
  }
  function setCount(text) {
    if (!countEl) return;
    if (countEl.textContent === text) return;
    countEl.textContent = text;
    if (lastCount) { countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }
    lastCount = text;
  }
  function apply() {
    terms = fold(state.q).split(' ').filter(Boolean);
    var visible = 0, perThread = {}, perSection = {};
    cards.forEach(function (rec) {
      var base = passes(rec, true);
      if (base) perThread[rec.thread] = (perThread[rec.thread] || 0) + 1;
      var v = base && (!state.t.length || state.t.indexOf(rec.thread) >= 0);
      rec.visible = v;
      if (rec.el.hidden === v) rec.el.hidden = !v;
      if (v) visible++;
    });
    reorder();
    sections.forEach(function (sec) {
      var n = 0; sec.recs.forEach(function (r) { if (r.visible) n++; });
      var hide = sec.recs.length > 0 && n === 0;
      if (sec.el.hidden !== hide) sec.el.hidden = hide;
      perSection[sec.key] = n;
    });
    chips.forEach(function (chip) {
      var t = chip.getAttribute('data-thread'), n = perThread[t] || 0;
      var badge = chip.querySelector('.chip-count');
      if (badge) badge.textContent = String(n);
      if (n) chip.removeAttribute('data-empty'); else chip.setAttribute('data-empty', '1');
    });
    var total = cards.length, unit = total === 1 ? 'paper' : 'papers';
    setCount(filtering() ? visible + ' of ' + total + ' ' + unit : total + ' ' + unit);
    if (clearBtn) clearBtn.hidden = !active();
    if (emptyEl) emptyEl.hidden = !(total > 0 && visible === 0);
    var detail = { state: getState(), visible: visible, total: total, sections: perSection };
    listeners.forEach(function (fn) { try { fn(detail); } catch (e) { /* listener error */ } });
    try { doc.dispatchEvent(new CustomEvent('cme:filters', { detail: detail })); } catch (e) { /* no CustomEvent */ }
    return detail;
  }

  /* ---------- UI sync ---------- */
  function syncUI() {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', state.t.indexOf(c.getAttribute('data-thread')) >= 0 ? 'true' : 'false'); });
    toggles.forEach(function (c) { c.setAttribute('aria-pressed', state.only.indexOf(c.getAttribute('data-only')) >= 0 ? 'true' : 'false'); });
    if (search && search.value !== state.q) search.value = state.q;
    if (searchClear) searchClear.hidden = !state.q;
    if (sortSel && sortSel.value !== state.sort) sortSel.value = state.sort;
  }
  function commit(persist) {
    syncUI();
    var d = apply();
    if (persist !== false) { writeHash(); writeStore(); }
    return d;
  }

  /* ---------- public API ---------- */
  function getState() { return { t: state.t.slice(), q: state.q, sort: state.sort, only: state.only.slice() }; }
  function setState(patch, opts) {
    var next = getState(), k;
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
    state = normalize(next);
    return commit(!(opts && opts.silent));
  }
  function clear() { return setState({ t: [], q: '', sort: DEFAULT_SORT, only: [] }); }
  function toggleThread(t) {
    var next = state.t.slice(), i = next.indexOf(t);
    if (i >= 0) next.splice(i, 1); else next.push(t);
    return setState({ t: next });
  }
  function toggleOnly(k) {
    var next = state.only.slice(), i = next.indexOf(k);
    if (i >= 0) next.splice(i, 1); else next.push(k);
    return setState({ only: next });
  }

  /* ---------- events ---------- */
  function bind() {
    if (bound) return; bound = true;
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip[data-thread]');
      if (chip && root.contains(chip)) { toggleThread(chip.getAttribute('data-thread')); return; }
      var tog = e.target.closest('.chip-toggle[data-only]');
      if (tog) { toggleOnly(tog.getAttribute('data-only')); return; }
      if (e.target.closest('.filters-clear')) { clear(); return; }
      if (e.target.closest('.search-clear')) { setState({ q: '' }); if (search) search.focus(); }
    });
    if (search) {
      search.addEventListener('input', function () {
        if (searchClear) searchClear.hidden = !search.value;
        clearTimeout(timer);
        timer = setTimeout(function () { setState({ q: search.value }); }, DEBOUNCE);
      });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          clearTimeout(timer);
          if (search.value) setState({ q: '' }); else search.blur();
        } else if (e.key === 'Enter') {
          e.preventDefault(); clearTimeout(timer); setState({ q: search.value });
        }
      });
      search.addEventListener('search', function () { clearTimeout(timer); setState({ q: search.value }); });
    }
    if (sortSel) sortSel.addEventListener('change', function () { setState({ sort: sortSel.value }); });
    if (emptyEl) emptyEl.addEventListener('click', function (e) { if (e.target.closest('.filters-empty-clear')) { clear(); if (search) search.focus(); } });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !search) return;
      var a = doc.activeElement, tag = a && a.tagName;
      if (a && (a.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
      e.preventDefault(); search.focus(); search.select();
    });
    window.addEventListener('hashchange', function () {
      var s = parseHash(location.hash);
      if (!s || serialize(s) === serialize()) return;
      state = s; commit(false); writeStore();
    });
    window.addEventListener('resize', function () { clearTimeout(bind._rz); bind._rz = setTimeout(watchSticky, 150); });
  }

  /* is-stuck: a 1px sentinel above the toolbar leaves the viewport (under the header) when pinned */
  function watchSticky() {
    if (observer) { observer.disconnect(); observer = null; }
    root.classList.remove('is-stuck');
    if (!('IntersectionObserver' in window) || getComputedStyle(root).position !== 'sticky') return;
    var s = root.previousElementSibling;
    if (!s || !s.classList.contains('filters-sentinel')) {
      s = doc.createElement('div'); s.className = 'filters-sentinel'; s.setAttribute('aria-hidden', 'true');
      root.parentNode.insertBefore(s, root);
    }
    var top = parseFloat(getComputedStyle(root).top) || 0;
    observer = new IntersectionObserver(function (entries) {
      var e = entries[0];
      root.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < top + 1);
    }, { rootMargin: (-top) + 'px 0px 0px 0px', threshold: 0 });
    observer.observe(s);
  }

  /* ---------- init ---------- */
  function prune() {
    // hide chips whose thread has no cards, toggles with no candidates, sort options with no data
    chips.forEach(function (c) { c.hidden = !threads[c.getAttribute('data-thread')]; });
    chips = chips.filter(function (c) { return !c.hidden; });
    toggles.forEach(function (c) {
      var k = c.getAttribute('data-only');
      c.hidden = !cards.some(function (r) { return r[k]; });
    });
    if (sortSel) SORT_KEYS.forEach(function (k) {
      var opt = sortSel.querySelector('option[value="' + k + '"]'); if (!opt) return;
      var has = cards.some(function (r) { return k === 'date' ? !!r.date : k === 'cites' ? r.cites > 0 : r[k] != null; });
      opt.hidden = !has; opt.disabled = !has;
    });
  }
  function init(el) {
    root = el || doc.querySelector('[data-filters]');
    if (!root) return false;
    chipsBox = $('.filters-chips');
    chips = $$('.chip[data-thread]');
    search = $('.filters-search input');
    searchClear = $('.search-clear');
    sortSel = $('.filters-sort select');
    toggles = $$('.chip-toggle[data-only]');
    countEl = $('.filters-count');
    clearBtn = $('.filters-clear');
    emptyEl = doc.querySelector('.filters-empty');
    if (!emptyEl) {
      emptyEl = doc.createElement('div'); emptyEl.className = 'filters-empty'; emptyEl.hidden = true;
      emptyEl.innerHTML = '<h3>Nothing matches</h3><p>No papers in this issue match the current filters.</p><button class="filters-empty-clear" type="button">Clear filters</button>';
      var secs = doc.querySelectorAll('.issue-section'), last = secs[secs.length - 1];
      if (last) last.parentNode.insertBefore(emptyEl, last.nextSibling); else root.parentNode.insertBefore(emptyEl, root.nextSibling);
    }
    chips.forEach(function (c) { if (!c.querySelector('.chip-count')) { var b = doc.createElement('span'); b.className = 'chip-count'; c.appendChild(b); } });
    index();
    prune();
    var s = parseHash(location.hash), fromStore = false;
    if (!s) { s = readStore(); fromStore = !!s; }
    state = normalize(s || {});
    bind();
    commit(false);
    if (fromStore) writeHash();
    writeStore();
    watchSticky();
    return true;
  }
  function refresh() {
    if (!root) return init();
    chips = $$('.chip[data-thread]'); toggles = $$('.chip-toggle[data-only]');
    index(); prune(); state = normalize(state); return commit();
  }

  CME.filters = {
    version: '1.0.0',
    init: init,
    refresh: refresh,
    getState: getState,
    setState: setState,
    clear: clear,
    toggleThread: toggleThread,
    toggleOnly: toggleOnly,
    apply: function () { return commit(); },
    serialize: function () { return serialize(); },
    parse: parseHash,
    on: function (fn) { if (listeners.indexOf(fn) < 0) listeners.push(fn); return fn; },
    off: function (fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();

/* == votes.js == */
(function () {
  var API = 'https://abacus.jasoncameron.dev', NS = (window.CME_VOTES_NS || 'cme-weekly-1'), KEY = 'cme-votes';
  var voted = {}; try { voted = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(voted)); } catch (e) {} }
  function btnFor(card) { return card.querySelector('[data-action="vote"]'); }
  function getJSON(url) { return fetch(url, { mode: 'cors', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function count(url) { return getJSON(url).then(function (d) { return (d && typeof d.value === 'number') ? d.value : 0; }, function (err) { if (/404/.test(String(err && err.message))) return 0; throw err; }); }
  var rt = null; function queueRefresh() { clearTimeout(rt); rt = setTimeout(function () { if (window.CME && CME.filters && CME.filters.refresh) CME.filters.refresh(); }, 200); }
  function live(msg) { var el = document.getElementById('cme-vote-live'); if (!el) { el = document.createElement('div'); el.id = 'cme-vote-live'; el.className = 'visually-hidden'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); } el.textContent = msg; }
  function flash(btn, msg) { btn.setAttribute('data-flash', msg); live(msg); setTimeout(function () { btn.removeAttribute('data-flash'); }, 1500); }
  function render(card) {
    var b = btnFor(card); if (!b) return;
    var id = card.getAttribute('data-id'), known = card.__up != null;
    var n = known ? Math.max((card.__up || 0) - (card.__undo || 0), 0) : null;
    var s = b.querySelector('[data-vote-count]'); if (s) s.textContent = (n == null ? '–' : String(n));
    if (n == null) card.removeAttribute('data-votes'); else card.setAttribute('data-votes', String(n));
    var mine = !!voted[id];
    b.classList.toggle('is-voted', mine); b.setAttribute('aria-pressed', mine ? 'true' : 'false');
    b.title = mine ? 'Remove your upvote' : 'Upvote this paper';
    b.setAttribute('aria-label', (mine ? 'Remove your upvote' : 'Upvote this paper') + (n == null ? '' : ', ' + n + ' upvote' + (n === 1 ? '' : 's') + ' so far'));
  }
  function load(card) {
    var id = card.getAttribute('data-id'); if (!id || card.getAttribute('data-votes-loaded')) return;
    card.setAttribute('data-votes-loaded', '1');
    count(API + '/get/' + NS + '/' + encodeURIComponent(id)).then(function (up) {
      card.__up = up; card.__undo = 0;
      if (up > 0) return count(API + '/get/' + NS + '/' + encodeURIComponent(id + '.undo')).then(function (u) { card.__undo = u; });
    }).then(function () { render(card); queueRefresh(); }, function () { card.__up = null; render(card); });
  }
  function vote(btn) {
    var card = btn.closest('.card'); var id = card && card.getAttribute('data-id'); if (!id) return;
    var undo = !!voted[id];
    btn.disabled = true; btn.classList.add('is-busy');
    count(API + '/hit/' + NS + '/' + encodeURIComponent(undo ? id + '.undo' : id))
      .then(function (v) {
        if (undo) { delete voted[id]; card.__undo = v; if (card.__up == null) card.__up = v; }
        else { voted[id] = Date.now(); card.__up = v; if (card.__undo == null) card.__undo = 0; }
        save(); render(card); flash(btn, undo ? 'Upvote removed' : 'Thanks'); queueRefresh();
      }, function () { flash(btn, 'Vote server unreachable'); })
      .then(function () { btn.disabled = false; btn.classList.remove('is-busy'); });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-action="vote"]') : null; if (!b) return; ev.preventDefault(); vote(b);
  });
  function init() {
    var cards = [].slice.call(document.querySelectorAll('article.card[data-id]')); if (!cards.length) return;
    cards.forEach(render);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }); }, { rootMargin: '400px 0px' });
      cards.forEach(function (c) { io.observe(c); });
    } else cards.forEach(load);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.CME = window.CME || {}; CME.votes = { init: init, load: load, vote: vote, API: API, NS: NS };
})();
