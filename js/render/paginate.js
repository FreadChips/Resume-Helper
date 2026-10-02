/* =============================================
   简历助手 · 分页引擎
   ---------------------------------------------
   在屏幕外的“排版台”中按真实 A4 尺寸逐块填充：
   1. 块放不下 → 若块足够大且可拆分（[data-split]），按行/条拆到下一页
   2. 否则整块移到下一页，并带上前面 data-keep="next" 的栏目标题
   3. 单块比整页还高且不可拆 → 允许溢出并在报告中标记
   预览、打印、导出 HTML 使用同一份分页结果，所见即所得。
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { el } = RB.util;

  const SMALL_BLOCK_RATIO = 0.22; // 小于页高 22% 的块整体移动，不拆分
  let stage = null;

  function getStage() {
    if (!stage || !stage.isConnected) {
      stage = document.createElement('div');
      stage.className = 'rb-stage';
      stage.setAttribute('aria-hidden', 'true');
      document.body.appendChild(stage);
    }
    return stage;
  }

  function contentBottom(col) {
    const rect = col.getBoundingClientRect();
    return rect.bottom - (parseFloat(getComputedStyle(col).paddingBottom) || 0);
  }

  function overflows(col, limit) {
    const last = col.lastElementChild;
    return !!last && last.getBoundingClientRect().bottom > limit + 0.5;
  }

  const splitTarget = blk => (blk.matches('[data-split]') ? blk : blk.querySelector('[data-split]'));

  function unitsOf(container) {
    const out = [];
    Array.from(container.children).forEach(child => {
      if (child.tagName === 'UL' || child.tagName === 'OL') out.push(...child.children);
      else out.push(child);
    });
    return out;
  }

  function removeEmptyLists(container) {
    container.querySelectorAll('ul, ol').forEach(list => { if (!list.children.length) list.remove(); });
    // 去掉首尾的段落间隔
    while (container.firstElementChild && container.firstElementChild.classList.contains('md-gap')) container.firstElementChild.remove();
    while (container.lastElementChild && container.lastElementChild.classList.contains('md-gap')) container.lastElementChild.remove();
  }

  /**
   * 尝试把块拆成“本页能放下的部分 + 续页部分”
   * @returns {Element|null} 续页部分；无法拆分时返回 null（原块保持不变）
   */
  function trySplit(blk, limit, colHeight, force) {
    const target = splitTarget(blk);
    if (!target) return null;
    if (!force && blk.getBoundingClientRect().height < colHeight * SMALL_BLOCK_RATIO) return null;

    const units = unitsOf(target);
    if (units.length < 2) return null;
    let k = -1;
    for (let i = 0; i < units.length; i++) {
      if (units[i].getBoundingClientRect().bottom <= limit) k = i;
      else break;
    }
    // 跳过末尾的空行单位
    while (k >= 0 && units[k].classList.contains('md-gap')) k--;
    if (k < 0 || k >= units.length - 1) return null;

    const rest = blk.cloneNode(true);
    const restTarget = splitTarget(rest);
    const restUnits = unitsOf(restTarget);

    // 有序列表在续页上接着编号
    const olOffsets = new Map();
    for (let i = 0; i <= k; i++) {
      const parent = restUnits[i].parentElement;
      if (parent && parent.tagName === 'OL') olOffsets.set(parent, (olOffsets.get(parent) || 0) + 1);
    }
    olOffsets.forEach((count, ol) => { ol.setAttribute('start', String((parseInt(ol.getAttribute('start'), 10) || 1) + count)); });

    for (let i = k + 1; i < units.length; i++) units[i].remove();
    for (let i = 0; i <= k; i++) restUnits[i].remove();
    removeEmptyLists(target);
    removeEmptyLists(restTarget);
    rest.querySelectorAll('[data-head]').forEach(n => n.remove());

    blk.classList.add('is-split');
    blk.classList.remove('is-last');
    rest.classList.add('is-cont');
    rest.classList.remove('is-first');
    return rest;
  }

  function flowColumn(blocks, getCol, report) {
    let pageIndex = 0;
    let col = getCol(0);
    let limit = contentBottom(col);
    const queue = blocks.slice();
    let guard = 0;

    const nextPage = () => {
      pageIndex += 1;
      col = getCol(pageIndex);
      limit = contentBottom(col);
    };

    while (queue.length && guard++ < 4000) {
      const blk = queue.shift();
      col.appendChild(blk);
      if (!overflows(col, limit)) continue;

      const isFirst = col.firstElementChild === blk;
      const colHeight = limit - col.getBoundingClientRect().top;
      const rest = trySplit(blk, limit, colHeight, isFirst);
      if (rest) {
        queue.unshift(rest);
        nextPage();
        continue;
      }
      if (isFirst) {
        // 整页都放不下且无法拆分：保留溢出，继续下一页
        report.overflow = true;
        col.closest('.rb-page').classList.add('is-overflow');
        if (queue.length) nextPage();
        continue;
      }
      const moving = [blk];
      blk.remove();
      let prev = col.lastElementChild;
      while (prev && prev.dataset.keep === 'next' && prev !== col.firstElementChild) {
        moving.unshift(prev);
        prev.remove();
        prev = col.lastElementChild;
      }
      nextPage();
      queue.unshift(...moving);
    }
  }

  /** 标记换行后位于行首的联系方式/标签，隐藏其前置分隔符（避免行首出现孤立的 “·” 或 “|”） */
  function markLineStarts(doc) {
    doc.querySelectorAll('.r-contact, .r-tags-list').forEach(list => {
      const items = Array.from(list.children).filter(n => n.classList.contains('r-info') || n.classList.contains('r-tag'));
      for (let i = 1; i < items.length; i++) {
        if (items[i].offsetTop > items[i - 1].offsetTop + 2) {
          items[i].classList.add('is-line-start');
          if (items[i].offsetTop <= items[i - 1].offsetTop + 2) items[i].classList.remove('is-line-start');
        }
      }
    });
  }

  function fillRatio(page) {
    let ratio = 0;
    page.querySelectorAll('[data-col]').forEach(col => {
      const last = col.lastElementChild;
      if (!last) return;
      const cs = getComputedStyle(col);
      const rect = col.getBoundingClientRect();
      const top = rect.top + (parseFloat(cs.paddingTop) || 0);
      const height = contentBottom(col) - top;
      if (height > 0) ratio = Math.max(ratio, (last.getBoundingClientRect().bottom - top) / height);
    });
    return ratio;
  }

  /**
   * 排版整份简历
   * @param {object} resume
   * @param {object} [override] 临时覆盖的排版参数（用于“智能一页”试算）
   * @returns {{ doc: HTMLElement, report: { pages: number, overflow: boolean, lastFill: number }, ctx: object }}
   */
  RB.paginate = function (resume, override) {
    const ctx = RB.templates.context(resume, override);
    const host = getStage();
    host.textContent = '';
    const doc = document.createElement('div');
    RB.templates.applyDoc(doc, ctx);
    host.appendChild(doc);

    const pages = [];
    const getPage = i => {
      while (pages.length <= i) {
        const page = el(ctx.tpl.page(pages.length, ctx));
        page.dataset.page = String(pages.length + 1);
        doc.appendChild(page);
        pages.push(page);
      }
      return pages[i];
    };
    getPage(0);

    const flows = ctx.tpl.flows(ctx);
    const report = { pages: 0, overflow: false, lastFill: 0 };
    ctx.tpl.columns.forEach(name => {
      const blocks = (flows[name] || []).map(html => el(html)).filter(Boolean);
      flowColumn(blocks, i => getPage(i).querySelector(`[data-col="${name}"]`), report);
    });

    markLineStarts(doc);
    report.pages = pages.length;
    report.lastFill = fillRatio(pages[pages.length - 1]);
    host.removeChild(doc);
    return { doc, report, ctx };
  };

  /** 仅计算页数（不保留 DOM） */
  RB.paginate.count = function (resume, override) {
    return RB.paginate(resume, override).report;
  };

  /**
   * 智能一页：在当前排版与最紧凑排版之间二分查找，找到恰好能放进一页的最宽松参数
   * @returns {{ ok: boolean, already?: boolean, values?: object }}
   */
  RB.paginate.fitOnePage = function (resume) {
    const tpl = RB.templates.get(resume.style.template);
    const base = RB.templates.resolveStyle(resume, tpl);
    if (RB.paginate.count(resume).pages <= 1) return { ok: true, already: true };

    const min = {
      fs: Math.max(8.5, base.fs - 1.5),
      lh: Math.max(0.82, base.lh - 0.16),
      sp: Math.max(0.45, base.sp * 0.5),
      px: Math.max(6, base.px - 4),
      py: Math.max(6, base.py - 4)
    };
    const at = t => ({
      fs: Math.floor((base.fs + (min.fs - base.fs) * t) * 4) / 4,
      lh: Math.floor((base.lh + (min.lh - base.lh) * t) * 100) / 100,
      sp: Math.floor((base.sp + (min.sp - base.sp) * t) * 100) / 100,
      px: Math.floor((base.px + (min.px - base.px) * t) * 2) / 2,
      py: Math.floor((base.py + (min.py - base.py) * t) * 2) / 2
    });

    if (RB.paginate.count(resume, at(1)).pages > 1) return { ok: false, values: at(1) };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (RB.paginate.count(resume, at(mid)).pages <= 1) hi = mid;
      else lo = mid;
    }
    return { ok: true, values: at(hi) };
  };
})();
