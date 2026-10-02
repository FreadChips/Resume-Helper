/* =============================================
   简历助手 · 预览面板
   缩放（适应宽度 / 固定比例）、页数提示、点击预览定位到编辑器
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { $, clamp, debounce } = RB.util;
  const store = RB.store;

  const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5];

  const preview = (RB.preview = {
    zoom: 'fit',
    scale: 1,
    doc: null,
    report: null,

    init() {
      this.scroll = $('#viewer-scroll');
      this.canvas = $('#viewer-canvas');
      this.host = $('#viewer-scale');
      this.zoom = store.pref('zoom', 'fit');
      this.schedule = debounce(() => this.render(), 110);

      if (window.ResizeObserver) new ResizeObserver(() => this.applyScale()).observe(this.scroll);
      else window.addEventListener('resize', () => this.applyScale());

      this.host.addEventListener('click', e => {
        const target = e.target.closest('[data-sid]');
        if (e.target.closest('a')) e.preventDefault();
        if (target) RB.editor.reveal(target.dataset.sid, target.dataset.iid);
      });

      $('#zoom-in').addEventListener('click', () => this.step(1));
      $('#zoom-out').addEventListener('click', () => this.step(-1));
      $('#zoom-fit').addEventListener('click', () => this.setZoom('fit'));
      $('#zoom-label').addEventListener('click', () => this.setZoom(this.zoom === 'fit' ? 1 : 'fit'));
      $('#page-hint').addEventListener('click', () => RB.design.fitOnePage());
    },

    render() {
      this.schedule.cancel();
      const { doc, report } = RB.paginate(store.doc);
      const pages = Array.from(doc.children);
      pages.forEach((p, i) => p.insertAdjacentHTML('afterend', `<div class="pg-label">第 ${i + 1} / ${pages.length} 页</div>`));
      this.host.replaceChildren(doc);
      this.doc = doc;
      this.report = report;
      this.applyScale();
      this.updateBar();
    },

    flush() {
      if (this.schedule.pending() || !this.doc) this.render();
    },

    applyScale() {
      if (!this.doc) return;
      const pageWidth = this.doc.offsetWidth || 794;
      let scale = this.zoom;
      if (scale === 'fit') {
        const avail = this.scroll.clientWidth - (window.innerWidth < 640 ? 20 : 56);
        scale = clamp(avail / pageWidth, 0.3, 1);
      }
      this.scale = scale;
      this.host.style.transform = `scale(${scale})`;
      this.canvas.style.width = Math.ceil(pageWidth * scale) + 'px';
      this.canvas.style.height = Math.ceil(this.doc.offsetHeight * scale) + 'px';
      $('#zoom-label').textContent = Math.round(scale * 100) + '%';
      $('#zoom-fit').classList.toggle('is-active', this.zoom === 'fit');
    },

    setZoom(z) {
      this.zoom = z;
      store.setPref('zoom', z);
      this.applyScale();
    },

    step(dir) {
      const cur = this.scale;
      const next = dir > 0 ? ZOOMS.find(z => z > cur + 0.01) : ZOOMS.slice().reverse().find(z => z < cur - 0.01);
      if (next) this.setZoom(next);
    },

    updateBar() {
      const r = this.report;
      $('#page-count').textContent = `共 ${r.pages} 页`;
      const hint = $('#page-hint');
      if (r.overflow) {
        hint.hidden = false;
        hint.className = 'page-hint is-warn';
        hint.textContent = '有内容超出页面，请精简过长的描述';
      } else if (r.pages > 1 && r.lastFill < 0.3) {
        hint.hidden = false;
        hint.className = 'page-hint';
        hint.textContent = '最后一页内容很少，试试「智能一页」';
      } else {
        hint.hidden = true;
      }
    },

    /** 用于打印 / 导出的干净副本 */
    cloneDoc() {
      this.flush();
      const copy = this.doc.cloneNode(true);
      copy.querySelectorAll('.pg-label').forEach(n => n.remove());
      return copy;
    }
  });
})();
