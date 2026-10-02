#!/usr/bin/env node
/* =============================================
   发布前检查（无第三方依赖）
   1. index.html 引用的本地资源都存在
   2. 所有脚本语法正确
   3. 每个模板都有对应的样式与缩略图
   4. 在沙箱中运行 tests/specs.js 的逻辑测试
   依赖真实布局的分页测试请在浏览器打开 tests/index.html 运行。
   ============================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (err) {
    failures += 1;
    console.log('  ✗ ' + name);
    console.log('    ' + String(err && err.stack ? err.stack : err).split('\n').join('\n    '));
  }
}

function listJs(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(rel);
    return entry.name.endsWith('.js') ? [rel] : [];
  });
}

console.log('静态检查');

const html = read('index.html');
const refs = Array.from(html.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)="([^"]+)"/g))
  .map(m => m[1])
  .filter(u => !/^(?:data:|https?:|\/\/)/.test(u));

check('index.html 引用的资源都存在', () => {
  const missing = refs.filter(ref => !fs.existsSync(path.join(ROOT, ref)));
  if (missing.length) throw new Error('缺少文件：' + missing.join(', '));
  if (!refs.includes('js/app.js')) throw new Error('未引用 js/app.js');
});

const jsFiles = listJs('js').concat(listJs('scripts'), ['tests/specs.js']);
check(`脚本语法正确（${jsFiles.length} 个文件）`, () => {
  jsFiles.forEach(file => {
    let src = read(file);
    if (src.startsWith('#!')) src = '//' + src;
    new vm.Script(src, { filename: file });
  });
});

console.log('\n逻辑测试');

const memory = new Map();
const localStorage = {
  get length() { return memory.size; },
  key: i => Array.from(memory.keys())[i] || null,
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: k => { memory.delete(k); },
  clear: () => memory.clear()
};
const noop = () => {};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  localStorage,
  addEventListener: noop,
  document: { addEventListener: noop, hidden: false }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const modules = [
  'js/core/util.js',
  'js/core/icons.js',
  'js/core/schema.js',
  'js/core/markup.js',
  'js/core/store.js',
  'js/render/templates.js',
  'tests/specs.js'
];
let loaded = false;
check('核心模块可在无 DOM 环境中加载', () => {
  modules.forEach(file => vm.runInContext(read(file), sandbox, { filename: file }));
  if (!sandbox.RB || !Array.isArray(sandbox.RB_TESTS)) throw new Error('模块未正确注册');
  loaded = true;
});

if (loaded) {
  const ids = sandbox.RB.templates.ids();
  const css = read('css/resume.css');
  const design = read('js/ui/design.js');
  check(`每个模板都有样式与缩略图（${ids.join('、')}）`, () => {
    const noCss = ids.filter(id => !css.includes('.tpl-' + id + ' '));
    const noThumb = ids.filter(id => !new RegExp('\\b' + id + ': \\(\\) =>').test(design));
    if (noCss.length) throw new Error('缺少样式：' + noCss.join(', '));
    if (noThumb.length) throw new Error('缺少缩略图：' + noThumb.join(', '));
  });

  sandbox.RB_TESTS.forEach(t => check(t.name, () => t.fn()));
}

console.log('');
if (failures) {
  console.error(`检查失败：${failures} 项未通过`);
  process.exit(1);
}
console.log('全部检查通过。');
