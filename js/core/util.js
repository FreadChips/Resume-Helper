/* =============================================
   简历助手 · 基础工具
   所有模块挂载在全局命名空间 window.RB 上（无构建、可直接 file:// 打开）
   ============================================= */
(function () {
  'use strict';

  const RB = (window.RB = window.RB || {});
  const util = (RB.util = {});

  util.$ = (sel, root) => (root || document).querySelector(sel);
  util.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  util.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 7);
  };

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  util.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, ch => ESC_MAP[ch]);
  };

  util.debounce = function (fn, ms) {
    let timer = null;
    let lastArgs = null;
    const debounced = function (...args) {
      lastArgs = args;
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn(...lastArgs); }, ms);
    };
    debounced.flush = function () {
      if (timer) { clearTimeout(timer); timer = null; fn(...(lastArgs || [])); }
    };
    debounced.cancel = function () { clearTimeout(timer); timer = null; };
    debounced.pending = () => timer !== null;
    return debounced;
  };

  /** 深拷贝普通 JSON 数据（字符串按引用共享，适合做撤销快照） */
  util.clone = function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = clone(value[key]);
      return out;
    }
    return value;
  };

  /** 把 HTML 字符串转为单个元素 */
  util.el = function (html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  };

  util.clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  util.round = (n, step) => Math.round(n / step) * step;
  util.str = v => (v === null || v === undefined ? '' : String(v));
  util.isBlank = v => !util.str(v).trim();

  util.isTextField = function (el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !/^(checkbox|radio|range|color|file|button|submit)$/i.test(el.type);
  };

  util.sanitizeFilename = function (name) {
    return util.str(name).replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '简历';
  };

  util.download = function (content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  util.readFile = function (file, as) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      if (as === 'dataURL') reader.readAsDataURL(file);
      else reader.readAsText(file, 'utf-8');
    });
  };

  /** 读取图片并压缩为 JPEG dataURL，避免 localStorage 被头像撑爆 */
  util.compressImage = function (file, maxW, maxH, quality) {
    return util.readFile(file, 'dataURL').then(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth * ratio));
        const h = Math.max(1, Math.round(img.naturalHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.88));
      };
      img.onerror = () => reject(new Error('无法识别的图片格式'));
      img.src = src;
    }));
  };

  util.formatTime = function (ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
    const md = `${d.getMonth() + 1}月${d.getDate()}日`;
    return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
  };

  /* ---------- 颜色 ---------- */
  const color = (util.color = {});

  color.normalize = function (hex) {
    let h = util.str(hex).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
  };

  color.toRgb = function (hex) {
    const h = color.normalize(hex) || '#000000';
    return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  };

  color.toHex = rgb => '#' + rgb.map(v => Math.round(util.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  /** 线性混合：t=0 返回 a，t=1 返回 b */
  color.mix = function (a, b, t) {
    const ca = color.toRgb(a);
    const cb = color.toRgb(b);
    return color.toHex(ca.map((v, i) => v + (cb[i] - v) * t));
  };

  /** 预设色板（深浅色为手工调校，保证“经典”模板与原版颜色一致） */
  color.PRESETS = [
    { name: '经典蓝', c: '#3b82f6', dark: '#1e40af', ink: '#1e3a5f', soft: '#eff6ff' },
    { name: '靛青', c: '#4f46e5', dark: '#3730a3', ink: '#312e81', soft: '#eef2ff' },
    { name: '青碧', c: '#0d9488', dark: '#115e59', ink: '#134e4a', soft: '#f0fdfa' },
    { name: '翠绿', c: '#10b981', dark: '#065f46', ink: '#065f46', soft: '#ecfdf5' },
    { name: '雅紫', c: '#8b5cf6', dark: '#5b21b6', ink: '#4c1d95', soft: '#f5f3ff' },
    { name: '酒红', c: '#be123c', dark: '#881337', ink: '#4c0519', soft: '#fff1f2' },
    { name: '活力橙', c: '#f97316', dark: '#9a3412', ink: '#7c2d12', soft: '#fff7ed' },
    { name: '琥珀棕', c: '#b45309', dark: '#78350f', ink: '#451a03', soft: '#fffbeb' },
    { name: '石墨灰', c: '#475569', dark: '#1e293b', ink: '#0f172a', soft: '#f1f5f9' },
    { name: '墨黑', c: '#262626', dark: '#171717', ink: '#0a0a0a', soft: '#f5f5f5' }
  ];

  color.palette = function (hex) {
    const c = color.normalize(hex) || color.PRESETS[0].c;
    const preset = color.PRESETS.find(p => p.c === c);
    const base = preset || {
      c,
      dark: color.mix(c, '#000000', 0.45),
      ink: color.mix(c, '#000000', 0.62),
      soft: color.mix(c, '#ffffff', 0.92)
    };
    return Object.assign({ line: color.mix(c, '#ffffff', 0.55) }, base);
  };
})();
