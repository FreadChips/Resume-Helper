/* =============================================
   简历助手 · 状态管理
   - 多份简历：rb2:index（列表）+ rb2:doc:<id>（内容）+ rb2:current
   - 撤销/重做：变更前快照，同一输入框的连续输入会合并为一步
   - 自动保存：防抖写入 localStorage，失败时给出明确状态
   事件类型：content（仅内容）/ style（排版）/ structure（编辑器结构）/ replace（整份替换）/ status / list
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { clone, debounce } = RB.util;
  const schema = RB.schema;

  const KEY_INDEX = 'rb2:index';
  const KEY_CURRENT = 'rb2:current';
  const KEY_PREFS = 'rb2:prefs';
  const KEY_DOC = id => 'rb2:doc:' + id;
  const LEGACY_KEY = 'resume-builder-data';
  const HISTORY_LIMIT = 120;
  const COALESCE_MS = 1200;

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { localStorage.setItem(key, value); },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ } },
    json(key, fallback) {
      const raw = storage.get(key);
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    }
  };

  const listeners = new Set();

  const store = (RB.store = {
    doc: null,
    index: [],
    status: 'saved',
    statusMessage: '',
    undoStack: [],
    redoStack: [],
    lastKey: null,
    lastTime: 0,
    prefs: {},

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(type, detail) { listeners.forEach(fn => { try { fn(type, detail); } catch (e) { console.error(e); } }); },

    /* ---------- 初始化 ---------- */
    init() {
      this.prefs = storage.json(KEY_PREFS, {}) || {};
      this.index = (storage.json(KEY_INDEX, []) || []).filter(e => e && e.id);
      let doc = null;

      if (!this.index.length) {
        doc = this.migrateLegacyStorage();
        if (!doc) doc = schema.sampleResume();
        this.index = [];
        this.addToIndex(doc);
      } else {
        const current = storage.get(KEY_CURRENT);
        const target = this.index.find(e => e.id === current) || this.index[0];
        doc = this.loadDoc(target.id);
        if (!doc) {
          // 索引存在但内容丢失：从索引移除并回退
          this.index = this.index.filter(e => e.id !== target.id);
          doc = this.index.length ? this.loadDoc(this.index[0].id) : null;
          if (!doc) { doc = schema.sampleResume(); this.index = []; this.addToIndex(doc); }
        }
      }
      this.doc = doc;
      this.undoStack = [];
      this.redoStack = [];
      this.lastKey = null;
      this.persistIndex();
      try { storage.set(KEY_CURRENT, doc.id); } catch (e) { /* 由 saveNow 报告 */ }
      this.saveNow();
    },

    migrateLegacyStorage() {
      const legacy = storage.json(LEGACY_KEY, null);
      if (!legacy || !schema.isLegacy(legacy)) return null;
      try {
        const doc = schema.normalize(schema.migrateLegacy(legacy));
        const hasData = doc.basics.name || doc.sections.some(schema.sectionHasContent);
        if (!hasData) return null;
        this.legacyMigrated = true;
        return doc;
      } catch (e) {
        console.warn('旧版数据迁移失败', e);
        return null;
      }
    },

    loadDoc(id) {
      const raw = storage.json(KEY_DOC(id), null);
      if (!raw) return null;
      const doc = schema.normalize(raw);
      doc.id = id;
      return doc;
    },

    /* ---------- 变更 ---------- */
    /**
     * @param {(doc) => void} mutator
     * @param {{ type?: string, key?: string, history?: boolean }} opts
     */
    update(mutator, opts) {
      opts = opts || {};
      if (opts.history !== false) this.checkpoint(opts.key);
      mutator(this.doc);
      this.touch();
      this.emit(opts.type || 'content', opts);
    },

    checkpoint(key) {
      const now = Date.now();
      if (key && key === this.lastKey && now - this.lastTime < COALESCE_MS) {
        this.lastTime = now;
        return;
      }
      this.undoStack.push(clone(this.doc));
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
      this.lastKey = key || null;
      this.lastTime = now;
      this.emit('history');
    },

    /** 打断合并：下一次输入一定生成新的撤销步骤 */
    breakCoalesce() { this.lastKey = null; },

    canUndo() { return this.undoStack.length > 0; },
    canRedo() { return this.redoStack.length > 0; },

    undo() {
      if (!this.undoStack.length) return false;
      this.redoStack.push(clone(this.doc));
      this.doc = this.undoStack.pop();
      this.lastKey = null;
      this.touch();
      this.emit('replace', { reason: 'undo' });
      this.emit('history');
      return true;
    },

    redo() {
      if (!this.redoStack.length) return false;
      this.undoStack.push(clone(this.doc));
      this.doc = this.redoStack.pop();
      this.lastKey = null;
      this.touch();
      this.emit('replace', { reason: 'redo' });
      this.emit('history');
      return true;
    },

    resetHistory() {
      this.undoStack = [];
      this.redoStack = [];
      this.lastKey = null;
      this.emit('history');
    },

    /* ---------- 保存 ---------- */
    touch() {
      this.doc.meta.updatedAt = Date.now();
      this.setStatus('dirty');
      this.scheduleSave();
    },

    setStatus(status, message) {
      if (this.status === status && this.statusMessage === (message || '')) return;
      this.status = status;
      this.statusMessage = message || '';
      this.emit('status');
    },

    saveNow() {
      this.scheduleSave.cancel();
      try {
        storage.set(KEY_DOC(this.doc.id), JSON.stringify(this.doc));
        this.addToIndex(this.doc);
        this.persistIndex();
        this.setStatus('saved');
        return true;
      } catch (e) {
        const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
        this.setStatus('error', quota ? '浏览器存储空间不足，请删除不用的简历或更换更小的照片' : '无法写入浏览器存储（可能处于隐私模式）');
        return false;
      }
    },

    flush() { if (this.scheduleSave.pending()) this.saveNow(); },

    addToIndex(doc) {
      const entry = { id: doc.id, title: schema.displayTitle(doc), updatedAt: doc.meta.updatedAt };
      const i = this.index.findIndex(e => e.id === doc.id);
      if (i >= 0) this.index[i] = entry;
      else this.index.unshift(entry);
    },

    persistIndex() {
      try { storage.set(KEY_INDEX, JSON.stringify(this.index)); } catch (e) { /* 由 saveNow 报告 */ }
      this.emit('list');
    },

    /* ---------- 多份简历 ---------- */
    list() { return this.index.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); },

    open(id) {
      if (this.doc && id === this.doc.id) return true;
      this.flush();
      const doc = this.loadDoc(id);
      if (!doc) return false;
      this.doc = doc;
      storage.set(KEY_CURRENT, id);
      this.resetHistory();
      this.setStatus('saved');
      this.emit('replace', { reason: 'open' });
      return true;
    },

    /** 新建一份简历（传入已有数据即为导入/复制）并切换过去 */
    create(doc) {
      this.flush();
      const fresh = schema.normalize(doc || schema.blankResume());
      fresh.id = RB.util.uid('r');
      fresh.meta.createdAt = fresh.meta.updatedAt = Date.now();
      this.doc = fresh;
      this.addToIndex(fresh);
      storage.set(KEY_CURRENT, fresh.id);
      this.resetHistory();
      this.saveNow();
      this.emit('replace', { reason: 'create' });
      return fresh;
    },

    duplicate(id) {
      const src = id === this.doc.id ? clone(this.doc) : this.loadDoc(id);
      if (!src) return null;
      src.meta.title = schema.displayTitle(src) + '（副本）';
      src.meta.sample = false;
      return this.create(src);
    },

    rename(id, title) {
      if (id === this.doc.id) {
        this.update(d => { d.meta.title = title; }, { type: 'meta', key: 'meta.title' });
        this.saveNow();
        return;
      }
      const doc = this.loadDoc(id);
      if (!doc) return;
      doc.meta.title = title;
      try { storage.set(KEY_DOC(id), JSON.stringify(doc)); } catch (e) { /* 忽略 */ }
      this.addToIndex(doc);
      this.persistIndex();
    },

    remove(id) {
      storage.remove(KEY_DOC(id));
      this.index = this.index.filter(e => e.id !== id);
      if (id === this.doc.id) {
        this.scheduleSave.cancel();
        const next = this.list()[0];
        const nextDoc = next ? this.loadDoc(next.id) : null;
        if (nextDoc) {
          this.doc = nextDoc;
          storage.set(KEY_CURRENT, nextDoc.id);
          this.persistIndex();
          this.resetHistory();
          this.setStatus('saved');
          this.emit('replace', { reason: 'open' });
        } else {
          this.index = [];
          this.create(schema.blankResume());
        }
      } else {
        this.persistIndex();
      }
    },

    /* ---------- 界面偏好 ---------- */
    pref(key, fallback) { return key in this.prefs ? this.prefs[key] : fallback; },
    setPref(key, value) {
      this.prefs[key] = value;
      try { storage.set(KEY_PREFS, JSON.stringify(this.prefs)); } catch (e) { /* 忽略 */ }
    },

    findSection(sid) { return this.doc.sections.find(s => s.id === sid) || null; },
    findItem(sid, iid) {
      const sec = this.findSection(sid);
      return sec && sec.items ? sec.items.find(i => i.id === iid) || null : null;
    }
  });

  store.scheduleSave = debounce(() => store.saveNow(), 400);
  window.addEventListener('beforeunload', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
})();
