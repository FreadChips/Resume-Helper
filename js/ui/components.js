/* =============================================
   简历助手 · 通用界面组件
   模态框 / 确认框 / 输入框 / 轻提示 / 弹出菜单 / 拖拽排序
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { esc, el } = RB.util;
  const icon = RB.icon;
  const ui = (RB.ui = {});

  const overlayRoot = () => document.getElementById('overlay-root') || document.body;

  /* ---------- 模态框 ---------- */
  const openModals = [];

  ui.modal = function (opts) {
    const prevFocus = document.activeElement;
    const titleId = RB.util.uid('mt');
    const wrap = el(`
      <div class="modal-backdrop">
        <div class="modal ${opts.className || ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="${opts.width ? `max-width:${opts.width}px` : ''}">
          <div class="modal-head">
            <h2 class="modal-title" id="${titleId}">${esc(opts.title || '')}</h2>
            <button type="button" class="icon-btn modal-close" aria-label="关闭">${icon('x')}</button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-foot"></div>
        </div>
      </div>`);
    const body = wrap.querySelector('.modal-body');
    const foot = wrap.querySelector('.modal-foot');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    let closed = false;
    const close = result => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.add('is-leaving');
      setTimeout(() => wrap.remove(), 140);
      openModals.splice(openModals.indexOf(api), 1);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      if (opts.onClose) opts.onClose(result);
    };

    (opts.actions || []).forEach(action => {
      const btn = el(`<button type="button" class="btn ${action.kind === 'primary' ? 'btn-primary' : action.kind === 'danger' ? 'btn-danger' : 'btn-ghost'}">${esc(action.label)}</button>`);
      if (action.align === 'start') btn.classList.add('align-start');
      btn.addEventListener('click', () => {
        const keep = action.onClick ? action.onClick(api) : undefined;
        if (keep !== false) close(action.value);
      });
      foot.appendChild(btn);
    });
    if (!foot.children.length) foot.remove();

    const onKey = e => {
      if (openModals[openModals.length - 1] !== api) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && opts.submitOnEnter && e.target.tagName === 'INPUT') {
        e.preventDefault();
        const primary = foot.querySelector('.btn-primary');
        if (primary) primary.click();
      }
      if (e.key === 'Tab') trapFocus(e, wrap);
    };
    document.addEventListener('keydown', onKey, true);
    wrap.querySelector('.modal-close').addEventListener('click', () => close(null));
    let downOnBackdrop = false;
    wrap.addEventListener('mousedown', e => { downOnBackdrop = e.target === wrap; });
    wrap.addEventListener('click', e => { if (e.target === wrap && downOnBackdrop) close(null); });

    const api = { el: wrap, body, close };
    openModals.push(api);
    overlayRoot().appendChild(wrap);
    requestAnimationFrame(() => {
      const target = wrap.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]), textarea')
        || foot.querySelector('.btn-primary') || body.querySelector('button') || wrap.querySelector('.modal-close');
      if (target) { target.focus({ preventScroll: true }); if (target.select && target.tagName === 'INPUT') target.select(); }
    });
    return api;
  };

  function trapFocus(e, container) {
    const nodes = Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(n => !n.disabled && n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  ui.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      ui.modal({
        title: opts.title || '请确认',
        width: 420,
        body: `<p class="modal-text">${esc(message)}</p>`,
        actions: [
          { label: opts.cancelText || '取消', value: false },
          { label: opts.okText || '确定', kind: opts.danger ? 'danger' : 'primary', value: true }
        ],
        onClose: v => resolve(v === true)
      });
    });
  };

  ui.prompt = function (title, value, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      let result = null;
      const body = el(`<div><input class="input" type="text" maxlength="${opts.maxLength || 60}" placeholder="${esc(opts.placeholder || '')}" value="${esc(value || '')}"></div>`);
      const input = body.querySelector('input');
      ui.modal({
        title, width: 420, body, submitOnEnter: true,
        actions: [
          { label: '取消' },
          { label: opts.okText || '确定', kind: 'primary', onClick: () => { result = input.value.trim(); } }
        ],
        onClose: () => resolve(result)
      });
    });
  };

  /* ---------- 轻提示 ---------- */
  ui.toast = function (message, opts) {
    opts = opts || {};
    let host = document.querySelector('.toasts');
    if (!host) {
      host = el('<div class="toasts" role="status" aria-live="polite"></div>');
      document.body.appendChild(host);
    }
    const type = opts.type || 'info';
    const iconName = type === 'success' ? 'check' : type === 'error' ? 'info' : 'info';
    const node = el(`<div class="toast toast-${type}">${icon(iconName)}<span class="toast-msg">${esc(message)}</span></div>`);
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 180);
    };
    if (opts.action) {
      const btn = el(`<button type="button" class="toast-action">${esc(opts.action.label)}</button>`);
      btn.addEventListener('click', () => { opts.action.onClick(); dismiss(); });
      node.appendChild(btn);
    }
    host.appendChild(node);
    while (host.children.length > 3) host.firstElementChild.remove();
    const duration = opts.duration || (opts.action ? 5000 : type === 'error' ? 5000 : 2600);
    timer = setTimeout(dismiss, duration);
    node.addEventListener('mouseenter', () => clearTimeout(timer));
    node.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
    return dismiss;
  };

  /* ---------- 弹出菜单 ---------- */
  let activeMenu = null;

  ui.closeMenu = function () {
    if (!activeMenu) return;
    const m = activeMenu;
    activeMenu = null;
    m.cleanup();
  };

  /**
   * @param {Element} anchor
   * @param {Array} items { label, icon, onClick, danger, disabled, checked, hint } | { divider:true } | { header:'…' }
   */
  ui.menu = function (anchor, items, opts) {
    opts = opts || {};
    const wasOpenOnSame = activeMenu && activeMenu.anchor === anchor;
    ui.closeMenu();
    if (wasOpenOnSame) return;

    const menu = el(`<div class="menu ${opts.className || ''}" role="menu"></div>`);
    items.filter(Boolean).forEach(item => {
      if (item.divider) { menu.appendChild(el('<div class="menu-divider" role="separator"></div>')); return; }
      if (item.header) { menu.appendChild(el(`<div class="menu-header">${esc(item.header)}</div>`)); return; }
      const btn = el(`<button type="button" class="menu-item${item.danger ? ' is-danger' : ''}${item.checked ? ' is-checked' : ''}" role="menuitem" ${item.disabled ? 'disabled' : ''}>
        <span class="menu-ico">${item.checked ? icon('check') : item.icon ? icon(item.icon) : ''}</span>
        <span class="menu-label">${esc(item.label)}</span>
        ${item.hint ? `<span class="menu-hint">${esc(item.hint)}</span>` : ''}
      </button>`);
      btn.addEventListener('click', () => { ui.closeMenu(); if (item.onClick) item.onClick(); });
      menu.appendChild(btn);
    });
    overlayRoot().appendChild(menu);

    // 定位
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = opts.align === 'end' ? r.right - mw : r.left;
    let top = r.bottom + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    anchor.setAttribute('aria-expanded', 'true');

    const focusables = () => Array.from(menu.querySelectorAll('.menu-item:not([disabled])'));
    const onKey = e => {
      const list = focusables();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); ui.closeMenu(); anchor.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
      else if (e.key === 'Tab') ui.closeMenu();
    };
    const onDown = e => { if (!menu.contains(e.target) && !anchor.contains(e.target)) ui.closeMenu(); };
    const onScroll = e => { if (!menu.contains(e.target)) ui.closeMenu(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', ui.closeMenu);
    document.addEventListener('scroll', onScroll, true);

    activeMenu = {
      anchor,
      cleanup() {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('pointerdown', onDown, true);
        window.removeEventListener('resize', ui.closeMenu);
        document.removeEventListener('scroll', onScroll, true);
        anchor.setAttribute('aria-expanded', 'false');
        menu.remove();
      }
    };
    if (opts.focusFirst !== false) {
      const first = focusables()[0];
      if (first) first.focus({ preventScroll: true });
    }
  };

  /* ---------- 拖拽排序（指针事件，兼容鼠标与触屏） ---------- */
  /**
   * 在 root 上委托：按住 handle 拖动其所在 [data-key] 元素，在同一父容器（[data-sort]）内排序
   * @param {Element} root
   * @param {{ handle: string, onMove: (container, from, to) => void }} opts
   */
  ui.sortable = function (root, opts) {
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const handle = e.target.closest(opts.handle);
      if (!handle || !root.contains(handle)) return;
      const item = handle.closest('[data-key]');
      const container = item && item.parentElement;
      if (!container || !container.hasAttribute('data-sort')) return;
      const items = Array.from(container.children).filter(c => c.hasAttribute('data-key'));
      if (items.length < 2) return;
      e.preventDefault();

      const from = items.indexOf(item);
      const rects = items.map(n => n.getBoundingClientRect());
      const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
      const shift = rects[from].height + gap;
      const scroller = findScroller(container);
      const startScroll = scroller ? scroller.scrollTop : 0;
      const startY = e.clientY;
      let lastY = e.clientY;
      let to = from;
      let moved = false;
      let raf = 0;

      item.classList.add('is-dragging');
      container.classList.add('is-sorting');
      document.body.classList.add('is-sorting');
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }

      const update = () => {
        const dy = lastY - startY + (scroller ? scroller.scrollTop - startScroll : 0);
        if (Math.abs(dy) > 3) moved = true;
        item.style.transform = `translateY(${dy}px)`;
        const center = rects[from].top + rects[from].height / 2 + dy;
        to = from;
        for (let i = 0; i < items.length; i++) {
          if (i === from) continue;
          const mid = rects[i].top + rects[i].height / 2;
          if (i < from && center < mid) to = Math.min(to, i);
          if (i > from && center > mid) to = Math.max(to, i);
        }
        items.forEach((n, i) => {
          if (i === from) return;
          let off = 0;
          if (from < to && i > from && i <= to) off = -shift;
          if (from > to && i >= to && i < from) off = shift;
          n.style.transform = off ? `translateY(${off}px)` : '';
        });
      };

      const autoScroll = () => {
        raf = 0;
        if (!scroller) return;
        const sr = scroller.getBoundingClientRect();
        const edge = 48;
        let delta = 0;
        if (lastY < sr.top + edge) delta = -Math.ceil((sr.top + edge - lastY) / 4);
        else if (lastY > sr.bottom - edge) delta = Math.ceil((lastY - (sr.bottom - edge)) / 4);
        if (delta) {
          scroller.scrollTop += delta;
          update();
          raf = requestAnimationFrame(autoScroll);
        }
      };

      const onMove = ev => {
        lastY = ev.clientY;
        update();
        if (!raf) raf = requestAnimationFrame(autoScroll);
      };
      const onUp = () => {
        cancelAnimationFrame(raf);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        items.forEach(n => { n.style.transform = ''; });
        item.classList.remove('is-dragging');
        container.classList.remove('is-sorting');
        document.body.classList.remove('is-sorting');
        if (moved) {
          // 阻止拖动结束后触发的 click
          const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
          window.addEventListener('click', stop, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', stop, true), 0);
        }
        if (to !== from) opts.onMove(container, from, to);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  };

  function findScroller(node) {
    let n = node.parentElement;
    while (n && n !== document.body) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
      n = n.parentElement;
    }
    return null;
  }

  /** 让 textarea 随内容自动增高 */
  ui.autosize = function (ta) {
    if (!ta || ta.offsetParent === null) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  };
})();
