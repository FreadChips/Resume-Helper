/* =============================================
   简历助手 · 数据结构、预设、示例数据与旧版迁移
   ---------------------------------------------
   Resume v2:
   {
     version: 2,
     id, meta: { title, createdAt, updatedAt, sample },
     basics: { name, headline, avatar, info: [{ id, type, label, value }] },
     sections: [
       { id, kind: 'text',    title, hidden, column, content }
       { id, kind: 'entries', title, hidden, column, labels, fields, items: [{ id, hidden, title, subtitle, location, start, end, description }] }
       { id, kind: 'tags',    title, hidden, column, items: [{ id, name, keywords }] }
       { id, kind: 'list',    title, hidden, column, items: [{ id, text }] }
     ],
     style: { template, color, font, fs, lh, sp, px, py, photo, showPhoto, icons }  // null = 跟随模板默认
   }
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { uid, str, clone } = RB.util;
  const schema = (RB.schema = {});

  schema.VERSION = 2;

  /* ---------- 个人信息条目类型 ---------- */
  /** 只生成 http(s) 链接，避免 javascript: 等危险协议出现在导出的文件中 */
  const toUrl = v => (/^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^[a-z][\w+.-]*:\/*/i, '').replace(/^\/+/, ''));

  schema.INFO_TYPES = {
    phone: { label: '电话', icon: 'phone', placeholder: '138-0000-0000', href: v => 'tel:' + v.replace(/[^\d+]/g, '') },
    email: { label: '邮箱', icon: 'mail', placeholder: 'name@example.com', href: v => 'mailto:' + v },
    wechat: { label: '微信', icon: 'wechat', placeholder: '微信号', showLabel: true },
    location: { label: '所在地', icon: 'pin', placeholder: '北京市朝阳区' },
    website: { label: '个人网站', icon: 'globe', placeholder: 'https://example.com', href: toUrl },
    github: { label: 'GitHub', icon: 'github', placeholder: 'github.com/username', href: v => toUrl(/^[\w-]+$/.test(v) ? 'github.com/' + v : v) },
    linkedin: { label: 'LinkedIn', icon: 'linkedin', placeholder: 'linkedin.com/in/username', href: toUrl },
    age: { label: '年龄', icon: 'user', placeholder: '28 岁', showLabel: true },
    gender: { label: '性别', icon: 'user', placeholder: '男 / 女', showLabel: true },
    birth: { label: '出生年月', icon: 'calendar', placeholder: '1996.05', showLabel: true },
    hometown: { label: '籍贯', icon: 'home', placeholder: '湖北武汉', showLabel: true },
    political: { label: '政治面貌', icon: 'flag', placeholder: '中共党员', showLabel: true },
    years: { label: '工作年限', icon: 'briefcase', placeholder: '6 年', showLabel: true },
    target: { label: '求职意向', icon: 'target', placeholder: '前端开发工程师', showLabel: true },
    salary: { label: '期望薪资', icon: 'wallet', placeholder: '面议', showLabel: true },
    arrival: { label: '到岗时间', icon: 'clock', placeholder: '一个月内', showLabel: true },
    custom: { label: '', icon: 'dot', placeholder: '内容', showLabel: true, custom: true }
  };
  schema.INFO_ORDER = ['phone', 'email', 'wechat', 'location', 'website', 'github', 'linkedin', 'age', 'gender', 'birth', 'hometown', 'political', 'years', 'target', 'salary', 'arrival', 'custom'];

  schema.createInfo = function (type, value) {
    const def = schema.INFO_TYPES[type] || schema.INFO_TYPES.custom;
    return { id: uid('i'), type: schema.INFO_TYPES[type] ? type : 'custom', label: def.label, value: value || '' };
  };

  /* ---------- 栏目 ---------- */
  schema.KINDS = {
    text: { name: '文本', desc: '一段自由文字，如个人简介' },
    entries: { name: '经历', desc: '带标题、时间和描述的条目' },
    tags: { name: '标签', desc: '分组关键词，如技能' },
    list: { name: '列表', desc: '逐条列出，如证书' }
  };

  schema.ENTRY_FIELDS = ['title', 'subtitle', 'location', 'date', 'description'];
  const ENTRY_LABELS = { title: '标题', subtitle: '副标题', location: '地点', date: '时间', description: '描述' };

  const entryPreset = (title, icon, labels, fields) => ({
    kind: 'entries', title, icon,
    labels: Object.assign({}, ENTRY_LABELS, labels),
    fields: Object.assign({ subtitle: true, location: false, date: true, description: true }, fields)
  });

  schema.PRESETS = {
    summary: { kind: 'text', title: '个人简介', icon: 'user', desc: '职业概述与核心优势' },
    work: entryPreset('工作经历', 'briefcase', { title: '公司名称', subtitle: '职位', location: '城市', date: '在职时间', description: '工作内容与业绩' }),
    education: entryPreset('教育背景', 'cap', { title: '学校', subtitle: '专业 / 学历', location: '城市', date: '就读时间', description: '主修课程、荣誉等（可选）' }),
    project: entryPreset('项目经历', 'rocket', { title: '项目名称', subtitle: '担任角色', date: '项目时间', description: '项目描述与个人贡献' }),
    skills: { kind: 'tags', title: '专业技能', icon: 'tag', desc: '按分类列出技能关键词' },
    internship: entryPreset('实习经历', 'briefcase', { title: '公司名称', subtitle: '实习岗位', location: '城市', date: '实习时间', description: '实习内容' }),
    campus: entryPreset('校园经历', 'users', { title: '组织 / 活动', subtitle: '担任职务', date: '时间', description: '经历描述' }),
    awards: entryPreset('荣誉奖项', 'award', { title: '奖项名称', subtitle: '颁发机构', date: '获奖时间', description: '说明' }, { subtitle: false, description: false }),
    certificates: { kind: 'list', title: '证书资质', icon: 'star', desc: '每行一个证书' },
    languages: { kind: 'list', title: '语言能力', icon: 'languages', desc: '语种与水平' },
    hobbies: { kind: 'text', title: '兴趣爱好', icon: 'heart', desc: '个人兴趣' },
    evaluation: { kind: 'text', title: '自我评价', icon: 'message', desc: '性格与职业素养' },
    customEntries: entryPreset('自定义经历', 'layout', {}),
    customText: { kind: 'text', title: '自定义文本', icon: 'text', desc: '自由文字段落' },
    customList: { kind: 'list', title: '自定义列表', icon: 'list', desc: '逐条列出内容' },
    customTags: { kind: 'tags', title: '自定义标签', icon: 'tag', desc: '分组关键词' }
  };
  schema.PRESETS.work.desc = '公司、职位、时间与业绩';
  schema.PRESETS.education.desc = '学校、专业与学历';
  schema.PRESETS.project.desc = '项目背景、角色与成果';
  schema.PRESETS.internship.desc = '实习公司与岗位';
  schema.PRESETS.campus.desc = '学生组织、社团活动';
  schema.PRESETS.awards.desc = '奖学金、竞赛获奖';
  schema.PRESETS.customEntries.desc = '任意带时间的经历';

  schema.PRESET_GROUPS = [
    { name: '常用栏目', keys: ['summary', 'work', 'education', 'project', 'skills'] },
    { name: '更多栏目', keys: ['internship', 'campus', 'awards', 'certificates', 'languages', 'hobbies', 'evaluation'] },
    { name: '自定义', keys: ['customEntries', 'customText', 'customList', 'customTags'] }
  ];

  schema.createItem = function (kind, data) {
    data = data || {};
    if (kind === 'entries') {
      return {
        id: uid('e'), hidden: !!data.hidden,
        title: str(data.title), subtitle: str(data.subtitle), location: str(data.location),
        start: str(data.start), end: str(data.end), description: str(data.description)
      };
    }
    if (kind === 'tags') return { id: uid('t'), name: str(data.name), keywords: str(data.keywords) };
    if (kind === 'list') return { id: uid('l'), text: str(data.text) };
    return null;
  };

  schema.createSection = function (presetKey, overrides) {
    const preset = schema.PRESETS[presetKey] || schema.PRESETS.customEntries;
    const sec = { id: uid('s'), kind: preset.kind, title: preset.title, hidden: false, column: 'auto' };
    if (preset.kind === 'text') sec.content = '';
    if (preset.kind === 'entries') {
      sec.labels = Object.assign({}, preset.labels);
      sec.fields = Object.assign({}, preset.fields);
    }
    if (preset.kind !== 'text') sec.items = [schema.createItem(preset.kind)];
    return Object.assign(sec, overrides || {});
  };

  /* ---------- 样式 ---------- */
  schema.STYLE_KEYS = ['font', 'fs', 'lh', 'sp', 'px', 'py', 'photo', 'icons'];
  schema.defaultStyle = function () {
    return { template: 'classic', color: '#3b82f6', font: null, fs: null, lh: null, sp: null, px: null, py: null, photo: null, showPhoto: true, icons: null };
  };

  /* ---------- 整份简历 ---------- */
  schema.emptyResume = function () {
    const now = Date.now();
    return {
      version: schema.VERSION,
      id: uid('r'),
      meta: { title: '', createdAt: now, updatedAt: now, sample: false },
      basics: { name: '', headline: '', avatar: '', info: [] },
      sections: [],
      style: schema.defaultStyle()
    };
  };

  /** 空白简历：带常用栏目骨架，用户直接填写即可 */
  schema.blankResume = function () {
    const r = schema.emptyResume();
    r.basics.info = ['phone', 'email', 'location'].map(t => schema.createInfo(t));
    r.sections = ['summary', 'education', 'work', 'project', 'skills'].map(k => schema.createSection(k));
    return r;
  };

  /* 示例头像（插画风 SVG，避免使用真实人像） */
  schema.SAMPLE_AVATAR = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe7f6"/><stop offset="1" stop-color="#b9cde8"/></linearGradient></defs>' +
    '<rect width="300" height="400" fill="url(#bg)"/>' +
    '<path d="M38 400c6-74 52-112 112-112s106 38 112 112z" fill="#2f3e56"/>' +
    '<path d="M126 288h48l-24 54z" fill="#f4f6fa"/><path d="M146 296h8l6 70-10 12-10-12z" fill="#3c5a8a"/>' +
    '<rect x="128" y="226" width="44" height="62" rx="18" fill="#efc9aa"/>' +
    '<ellipse cx="150" cy="172" rx="62" ry="72" fill="#f6d7bd"/>' +
    '<path d="M86 166c-4-62 34-92 70-92 40 0 70 28 66 88-10-26-30-40-56-44-26 18-58 26-80 48z" fill="#2b2b33"/>' +
    '<ellipse cx="127" cy="182" rx="5" ry="6" fill="#2b2b33"/><ellipse cx="173" cy="182" rx="5" ry="6" fill="#2b2b33"/>' +
    '<path d="M136 214q14 10 28 0" stroke="#c98b6b" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '</svg>'
  );

  schema.sampleResume = function () {
    const r = schema.emptyResume();
    r.meta.sample = true;
    r.basics = {
      name: '张明华',
      headline: '高级前端开发工程师',
      avatar: schema.SAMPLE_AVATAR,
      info: [
        schema.createInfo('email', 'zhangminghua@email.com'),
        schema.createInfo('phone', '138-0000-1234'),
        schema.createInfo('location', '北京市朝阳区'),
        schema.createInfo('github', 'github.com/zhangminghua')
      ]
    };
    const sec = (key, extra) => Object.assign(schema.createSection(key), extra);
    const entries = list => list.map(d => schema.createItem('entries', d));
    r.sections = [
      sec('summary', {
        content: '拥有 6 年前端开发经验，专注于 React 生态与性能优化。曾在电商、金融科技领域主导多个大型项目的前端架构设计。具备良好的团队协作能力与技术分享精神，致力于构建高质量、可维护的 Web 应用。'
      }),
      sec('work', {
        items: entries([
          {
            title: '字节跳动', subtitle: '高级前端工程师', start: '2022.03', end: '至今',
            description: '- 负责抖音电商后台管理系统前端架构设计与开发\n- 推动微前端架构落地，将单体应用拆分为 **12 个独立子应用**\n- 建立前端监控体系，页面性能提升 **40%**，错误率降低 **60%**\n- 指导 3 名初级工程师，主持内部技术分享'
          },
          {
            title: '阿里巴巴', subtitle: '前端开发工程师', start: '2019.07', end: '2022.02',
            description: '- 参与淘宝商家中心核心模块开发，日活超 100 万\n- 使用 React + TypeScript 重构遗留 jQuery 项目，代码量减少 35%\n- 设计通用组件库，覆盖 20+ 业务场景，提升团队开发效率'
          },
          {
            title: '美团', subtitle: '前端开发实习生', start: '2018.06', end: '2019.06',
            description: '- 参与美团外卖商家端 Web App 开发\n- 负责活动页面搭建，支持大促期间高并发访问'
          }
        ])
      }),
      sec('education', {
        items: entries([
          { title: '北京大学', subtitle: '硕士 · 计算机科学与技术', start: '2016.09', end: '2019.06' },
          { title: '武汉大学', subtitle: '学士 · 软件工程', start: '2012.09', end: '2016.06' }
        ])
      }),
      sec('project', {
        items: entries([
          {
            title: '电商中台管理系统', subtitle: '前端负责人', start: '2023.01', end: '2023.08',
            description: '基于 **React 18 + TypeScript** 构建的大型 B 端管理系统，服务公司内部 200+ 运营人员。\n- 主导微前端架构设计（qiankun），实现多团队并行开发\n- 设计通用组件库，覆盖 30+ 业务组件，**复用率提升 60%**\n- 集成 ECharts 与 WebSocket，页面响应速度 **提升 35%**'
          },
          {
            title: '前端性能监控平台', subtitle: '核心开发', start: '2022.06', end: '2022.12',
            description: '自研前端性能监控（RUM）平台，采集 **Core Web Vitals** 指标，支持 SourceMap 错误定位。日均处理 **500 万+** 数据点，P99 延迟控制在 50ms 以内。'
          }
        ])
      }),
      sec('skills', {
        items: [
          schema.createItem('tags', { name: '前端', keywords: 'React, Vue, TypeScript, Webpack, Vite' }),
          schema.createItem('tags', { name: '后端', keywords: 'Node.js, Express, Python' }),
          schema.createItem('tags', { name: '工程化', keywords: 'Docker, CI/CD, Nginx, Linux' }),
          schema.createItem('tags', { name: '其他', keywords: 'WebGL, Three.js, 性能优化' })
        ]
      }),
      sec('languages', {
        items: ['中文（母语）', '英语（流利，CET-6）'].map(text => schema.createItem('list', { text }))
      }),
      sec('certificates', {
        items: ['PMP 项目管理专业人士', 'AWS Solutions Architect', '阿里云 ACE 认证'].map(text => schema.createItem('list', { text }))
      })
    ];
    return r;
  };

  /* ---------- 规范化（防御任何来源的脏数据） ---------- */
  const bool = v => v === true;
  const nullableNum = (v, min, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
  };

  schema.normalize = function (input) {
    const src = input && typeof input === 'object' ? input : {};
    const base = schema.emptyResume();
    const seen = new Set();
    const id = (value, prefix) => {
      let v = typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : uid(prefix);
      while (seen.has(v)) v = uid(prefix);
      seen.add(v);
      return v;
    };

    const meta = src.meta || {};
    const out = {
      version: schema.VERSION,
      id: id(src.id, 'r'),
      meta: {
        title: str(meta.title),
        createdAt: Number(meta.createdAt) || base.meta.createdAt,
        updatedAt: Number(meta.updatedAt) || base.meta.updatedAt,
        sample: bool(meta.sample)
      },
      basics: { name: '', headline: '', avatar: '', info: [] },
      sections: [],
      style: schema.defaultStyle()
    };

    const b = src.basics || {};
    out.basics.name = str(b.name);
    out.basics.headline = str(b.headline);
    out.basics.avatar = /^data:image\//.test(str(b.avatar)) ? str(b.avatar) : '';
    out.basics.info = (Array.isArray(b.info) ? b.info : []).filter(Boolean).map(it => {
      const type = schema.INFO_TYPES[it.type] ? it.type : 'custom';
      return { id: id(it.id, 'i'), type, label: it.label === undefined ? schema.INFO_TYPES[type].label : str(it.label), value: str(it.value) };
    });

    (Array.isArray(src.sections) ? src.sections : []).filter(Boolean).forEach(s => {
      const kind = schema.KINDS[s.kind] ? s.kind : 'text';
      const sec = {
        id: id(s.id, 's'), kind, title: str(s.title), hidden: bool(s.hidden),
        column: s.column === 'main' || s.column === 'side' ? s.column : 'auto'
      };
      if (kind === 'text') sec.content = str(s.content);
      if (kind === 'entries') {
        sec.labels = Object.assign({}, ENTRY_LABELS, pick(s.labels, schema.ENTRY_FIELDS, str));
        sec.fields = Object.assign({ subtitle: true, location: false, date: true, description: true }, pick(s.fields, ['subtitle', 'location', 'date', 'description'], bool));
      }
      if (kind !== 'text') {
        sec.items = (Array.isArray(s.items) ? s.items : []).filter(Boolean).map(it => {
          const item = schema.createItem(kind, it);
          item.id = id(it.id, item.id.split('_')[0]);
          return item;
        });
      }
      out.sections.push(sec);
    });

    const st = src.style || {};
    const tplIds = RB.templates ? RB.templates.ids() : null;
    out.style.template = tplIds && !tplIds.includes(st.template) ? 'classic' : str(st.template) || 'classic';
    out.style.color = RB.util.color.normalize(st.color) || out.style.color;
    out.style.font = st.font === 'sans' || st.font === 'serif' ? st.font : null;
    out.style.fs = nullableNum(st.fs, 8, 14);
    out.style.lh = nullableNum(st.lh, 0.7, 1.6);
    out.style.sp = nullableNum(st.sp, 0.3, 2);
    out.style.px = nullableNum(st.px, 4, 30);
    out.style.py = nullableNum(st.py, 4, 30);
    out.style.photo = ['rect', 'rounded', 'circle'].includes(st.photo) ? st.photo : null;
    out.style.showPhoto = st.showPhoto !== false;
    out.style.icons = st.icons === true || st.icons === false ? st.icons : null;
    return out;
  };

  function pick(obj, keys, map) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    keys.forEach(k => { if (obj[k] !== undefined) out[k] = map(obj[k]); });
    return out;
  }

  /* ---------- 内容判断 ---------- */
  schema.itemHasContent = function (kind, item) {
    if (!item || item.hidden) return false;
    if (kind === 'entries') return ['title', 'subtitle', 'location', 'start', 'end', 'description'].some(k => str(item[k]).trim());
    if (kind === 'tags') return !!(str(item.name).trim() || str(item.keywords).trim());
    if (kind === 'list') return !!str(item.text).trim();
    return false;
  };

  schema.sectionHasContent = function (sec) {
    if (!sec || sec.hidden) return false;
    if (sec.kind === 'text') return !!str(sec.content).trim();
    return (sec.items || []).some(it => schema.itemHasContent(sec.kind, it));
  };

  schema.splitKeywords = v => str(v).split(/[,，、;；\n]+/).map(s => s.trim()).filter(Boolean);

  schema.displayTitle = function (r) {
    if (r.meta && r.meta.title) return r.meta.title;
    const parts = [r.basics.name, r.basics.headline].filter(s => str(s).trim());
    return parts.length ? parts.join(' · ') : '未命名简历';
  };

  /* =============================================
     旧版数据迁移
     - v1.0：固定字段 work / education / projects / skills（多行文本）…
     - v1.1：sections[{ name, fields:[{name}], items:[{字段名: 值}] }]
     ============================================= */
  const LEGACY_THEME = { blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6', orange: '#f97316', dark: '#475569' };
  const LEGACY_LAYOUT = { classic: 'classic', modern: 'modern', creative: 'timeline' };

  /** 旧版数据一定带有 settings 或 profile 字段（JSON Resume 没有） */
  schema.isLegacy = function (d) {
    return !!d && typeof d === 'object' && d.version !== 2 && !!d.basics && typeof d.basics === 'object'
      && ('settings' in d || 'profile' in d || Array.isArray(d.sections));
  };

  /** 拆分 “2019.07 - 2022.02” 这类时间段 */
  schema.splitRange = function (value) {
    const s = str(value).trim();
    if (!s) return ['', ''];
    let m = s.match(/^(.+?)\s+[-–—~～至到]\s+(.+)$/) || s.match(/^(.+?)\s*[–—~～]\s*(.+)$/) || s.match(/^(.+?)\s*(?:至(?!今)|到)\s*(.+)$/);
    if (!m && /^\d{4}[.\/年]\d{1,2}月?\s*-\s*\S/.test(s)) m = s.match(/^(.+?)\s*-\s*(.+)$/);
    return m ? [m[1].trim(), m[2].trim()] : [s, ''];
  };

  const LONG_FIELD = /描述|简介|职责|贡献|成果|内容|说明|经历|详情|业绩/;
  const DATE_FIELD = /时间|日期|期间|年份|date/i;
  const LOC_FIELD = /地点|城市|地址|location/i;

  function legacyLinesToList(text) {
    return str(text).split('\n').map(l => l.replace(/^\s*[-*•·]\s*/, '').trim()).filter(Boolean);
  }

  function legacySkillGroups(text) {
    return str(text).split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const m = line.match(/^([^:：]{1,20})[:：]\s*(.*)$/);
      return m ? schema.createItem('tags', { name: m[1].trim(), keywords: m[2].trim() }) : schema.createItem('tags', { name: '', keywords: line });
    });
  }

  function legacyCustomSection(old) {
    const name = str(old.name) || '未命名栏目';
    const fields = (old.fields || []).map(f => str(f && f.name)).filter(Boolean);
    const items = Array.isArray(old.items) ? old.items : [];

    if (fields.length <= 1) {
      const key = fields[0];
      const text = items.map(it => str(it && it[key])).filter(Boolean).join('\n');
      if (/技能|技术|skill/i.test(name)) return Object.assign(schema.createSection('skills'), { title: name, items: legacySkillGroups(text) });
      if (/简介|评价|爱好|兴趣|总结/.test(name)) return Object.assign(schema.createSection('customText'), { title: name, content: text });
      return Object.assign(schema.createSection('customList'), { title: name, items: legacyLinesToList(text).map(t => schema.createItem('list', { text: t })) });
    }

    const dateField = fields.find(f => DATE_FIELD.test(f));
    const locField = fields.find(f => LOC_FIELD.test(f));
    const descFields = fields.filter(f => LONG_FIELD.test(f) && f !== dateField);
    const rest = fields.filter(f => f !== dateField && f !== locField && !descFields.includes(f));
    const [titleField, subField, ...extra] = rest;

    const presetKey = /工作|任职/.test(name) ? 'work' : /教育|学历/.test(name) ? 'education' : /项目/.test(name) ? 'project' : 'customEntries';
    const sec = schema.createSection(presetKey, { title: name });
    if (titleField) sec.labels.title = titleField;
    if (subField) sec.labels.subtitle = subField;
    if (dateField) sec.labels.date = dateField;
    if (locField) sec.labels.location = locField;
    if (descFields[0]) sec.labels.description = descFields[0];
    sec.fields = { subtitle: !!subField, location: !!locField, date: !!dateField, description: descFields.length > 0 || extra.length > 0 };
    sec.items = items.filter(Boolean).map(it => {
      const [start, end] = schema.splitRange(dateField ? it[dateField] : '');
      const desc = extra.filter(f => str(it[f]).trim()).map(f => `${f}：${str(it[f]).trim()}`)
        .concat(descFields.map(f => str(it[f]).trim()).filter(Boolean));
      return schema.createItem('entries', {
        title: titleField ? it[titleField] : '', subtitle: subField ? it[subField] : '',
        location: locField ? it[locField] : '', start, end, description: desc.join('\n')
      });
    });
    return sec;
  }

  schema.migrateLegacy = function (d) {
    const r = schema.emptyResume();
    const b = d.basics || {};
    r.basics.name = str(b.name);
    r.basics.headline = str(b.title);
    r.basics.avatar = str(b.avatar);
    [['email', b.email], ['phone', b.phone], ['location', b.location], ['website', b.website]]
      .forEach(([type, value]) => { if (str(value).trim()) r.basics.info.push(schema.createInfo(type, str(value).trim())); });

    const settings = d.settings || {};
    const oldVis = settings.visibility || {};
    const secVis = settings.sectionVisibility || {};

    if (str(d.profile).trim()) {
      r.sections.push(Object.assign(schema.createSection('summary'), {
        content: str(d.profile), hidden: secVis.profile === false || oldVis.profile === false
      }));
    }

    if (Array.isArray(d.sections) && d.sections.length) {
      d.sections.forEach(old => {
        if (!old) return;
        const sec = legacyCustomSection(old);
        sec.hidden = secVis[old.id] === false;
        r.sections.push(sec);
      });
    } else {
      const join = (a, b2) => [str(a).trim(), str(b2).trim()];
      if (Array.isArray(d.work) && d.work.length) {
        r.sections.push(Object.assign(schema.createSection('work'), {
          hidden: oldVis.work === false,
          items: d.work.map(w => {
            const [start, end] = join(w.startDate, w.endDate);
            return schema.createItem('entries', { title: w.company, subtitle: w.position, start, end, description: w.description });
          })
        }));
      }
      if (Array.isArray(d.education) && d.education.length) {
        r.sections.push(Object.assign(schema.createSection('education'), {
          hidden: oldVis.education === false,
          items: d.education.map(e => {
            const [start, end] = join(e.startDate, e.endDate);
            return schema.createItem('entries', { title: e.school, subtitle: e.degree, start, end });
          })
        }));
      }
      if (Array.isArray(d.projects) && d.projects.length) {
        r.sections.push(Object.assign(schema.createSection('project'), {
          hidden: oldVis.projects === false,
          items: d.projects.map(p => {
            let desc = str(p.description);
            if (p.useDetailed) {
              desc = [p.intro && '项目简介：' + p.intro, p.contributions && '核心贡献：' + p.contributions, p.techStack && '技术栈：' + p.techStack]
                .filter(Boolean).join('\n');
            }
            const [start, end] = schema.splitRange(p.date);
            return schema.createItem('entries', { title: p.name, start, end, description: desc });
          })
        }));
      }
      if (str(d.skills).trim()) {
        r.sections.push(Object.assign(schema.createSection('skills'), { hidden: oldVis.skills === false, items: legacySkillGroups(d.skills) }));
      }
      if (str(d.languages).trim()) {
        r.sections.push(Object.assign(schema.createSection('languages'), {
          hidden: oldVis.languages === false, items: legacyLinesToList(d.languages).map(text => schema.createItem('list', { text }))
        }));
      }
      if (str(d.certificates).trim()) {
        r.sections.push(Object.assign(schema.createSection('certificates'), {
          hidden: oldVis.certificates === false, items: legacyLinesToList(d.certificates).map(text => schema.createItem('list', { text }))
        }));
      }
    }

    r.style.template = LEGACY_LAYOUT[settings.layout] || 'classic';
    r.style.color = LEGACY_THEME[settings.theme] || '#3b82f6';
    return r;
  };

  /* ---------- JSON Resume (jsonresume.org) 导入 ---------- */
  schema.isJsonResume = d => !!d && typeof d === 'object' && !!d.basics && typeof d.basics === 'object'
    && !('settings' in d) && !('profile' in d) && !Array.isArray(d.sections) && d.version !== 2
    && ('label' in d.basics || 'summary' in d.basics || Array.isArray(d.work) || Array.isArray(d.education) || Array.isArray(d.skills));

  schema.fromJsonResume = function (d) {
    const r = schema.emptyResume();
    const b = d.basics || {};
    r.basics.name = str(b.name);
    r.basics.headline = str(b.label);
    const loc = b.location ? [b.location.city, b.location.region].filter(Boolean).join(' ') : '';
    [['email', b.email], ['phone', b.phone], ['location', loc], ['website', b.url]]
      .forEach(([t, v]) => { if (str(v).trim()) r.basics.info.push(schema.createInfo(t, str(v).trim())); });
    (b.profiles || []).forEach(p => {
      const net = str(p.network).toLowerCase();
      const type = net.includes('github') ? 'github' : net.includes('linkedin') ? 'linkedin' : 'website';
      if (p.url || p.username) r.basics.info.push(schema.createInfo(type, str(p.url || p.username)));
    });
    if (str(b.summary).trim()) r.sections.push(Object.assign(schema.createSection('summary'), { content: str(b.summary) }));

    const desc = (summary, highlights) => [str(summary).trim()].concat((highlights || []).map(h => '- ' + str(h))).filter(Boolean).join('\n');
    const addEntries = (key, list, map) => {
      if (Array.isArray(list) && list.length) r.sections.push(Object.assign(schema.createSection(key), { items: list.map(x => schema.createItem('entries', map(x))) }));
    };
    addEntries('work', d.work, w => ({ title: w.name || w.company, subtitle: w.position, location: w.location, start: w.startDate, end: w.endDate || (w.startDate ? '至今' : ''), description: desc(w.summary, w.highlights) }));
    addEntries('education', d.education, e => ({ title: e.institution, subtitle: [e.studyType, e.area].filter(Boolean).join(' · '), start: e.startDate, end: e.endDate, description: (e.courses || []).length ? '主修课程：' + e.courses.join('、') : '' }));
    addEntries('project', d.projects, p => ({ title: p.name, subtitle: (p.roles || []).join('、'), start: p.startDate, end: p.endDate, description: desc(p.description, p.highlights) }));
    addEntries('campus', d.volunteer, v => ({ title: v.organization, subtitle: v.position, start: v.startDate, end: v.endDate, description: desc(v.summary, v.highlights) }));
    addEntries('awards', d.awards, a => ({ title: a.title, subtitle: a.awarder, start: a.date, description: a.summary }));
    if (Array.isArray(d.skills) && d.skills.length) {
      r.sections.push(Object.assign(schema.createSection('skills'), { items: d.skills.map(s => schema.createItem('tags', { name: s.name, keywords: (s.keywords || []).join(', ') })) }));
    }
    if (Array.isArray(d.certificates) && d.certificates.length) {
      r.sections.push(Object.assign(schema.createSection('certificates'), { items: d.certificates.map(c => schema.createItem('list', { text: [c.name, c.issuer].filter(Boolean).join(' · ') })) }));
    }
    if (Array.isArray(d.languages) && d.languages.length) {
      r.sections.push(Object.assign(schema.createSection('languages'), { items: d.languages.map(l => schema.createItem('list', { text: [l.language, l.fluency].filter(Boolean).join('（') + (l.fluency ? '）' : '') })) }));
    }
    if (Array.isArray(d.interests) && d.interests.length) {
      r.sections.push(Object.assign(schema.createSection('hobbies'), { content: d.interests.map(i => i.name).filter(Boolean).join('、') }));
    }
    return r;
  };

  /**
   * 识别任意导入内容，返回规范化的 v2 简历；无法识别时抛错
   * 支持：本工具 v2 备份 / v1 备份 / v1 原始数据 / JSON Resume / 本工具导出的 HTML
   */
  schema.parseImport = function (text) {
    let raw = str(text).trim();
    if (raw.startsWith('<')) {
      const m = raw.match(/<script[^>]+id="rb-data"[^>]*>([\s\S]*?)<\/script>/i);
      if (!m) throw new Error('该 HTML 文件不包含可导入的简历数据');
      raw = m[1].replace(/<\\\//g, '</');
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new Error('文件不是有效的 JSON'); }

    if (parsed && parsed.app === 'resume-builder') {
      if (parsed.resume) return schema.normalize(parsed.resume);
      if (parsed.data) parsed = parsed.data;
    }
    if (parsed && parsed.version === 2 && parsed.basics) return schema.normalize(parsed);
    if (schema.isJsonResume(parsed)) return schema.normalize(schema.fromJsonResume(parsed));
    if (schema.isLegacy(parsed)) return schema.normalize(schema.migrateLegacy(parsed));
    throw new Error('无法识别的数据格式');
  };

  schema.clone = clone;
})();
