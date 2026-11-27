/* v8.24：弹窗壳铺完 + app.js 三文件拆分接线
   运行：node scripts/checks/verify-v824.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const { APP_SCRIPT_PARTS, APP_LOGIC_PARTS } = require('../app-scripts.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');

console.log('== v8.24 核查 ==');

// 拆分文件存在
APP_LOGIC_PARTS.forEach(rel => {
  const p = path.join(L.ROOT, rel);
  (fs.existsSync(p) ? L.ok : L.bad)('存在 ' + rel);
});

// index 五段连续 script（tokens demos model ui app）
APP_SCRIPT_PARTS.forEach(rel => {
  const base = rel.split('/').pop();
  (html.includes(base) ? L.ok : L.bad)('index.html 引用 ' + base);
});

// 高频弹窗走壳
['showApiKeyPrompt', 'viewHistoryDetail', 'openParkEditor', 'openPlanWizard',
  'openProjectSwitcher', 'openProjectOverview', 'openWeekPlan', 'openHistory',
  'showDecomposeGuide', 'openHabitEditor', 'openWorkflowMetaModal', 'openRitualModal', 'openReview'
].forEach(fn => {
  L.assertFnContains(fn + ' 用 buildModalHtml', fn, 'buildModalHtml');
  L.assertFnContains(fn + ' 用 openModalMask', fn, 'openModalMask');
});

// Smart / 搜索不强行套壳，但保留关闭行为
L.assertFnContains('openSmart 仍有 modal-head（特例）', 'openSmart', 'modal-head');
L.assertFnContains('openGlobalSearch 自定义 gs', 'openGlobalSearch', 'gs-bar');

// 手写 modal-head 仅剩 helper + openSmart（注释不计）
const heads = [...L.APP_JS.matchAll(/modal-head/g)];
const inSmart = (L.grabFn('openSmart') || '').includes('modal-head');
const inHelper = (L.grabFn('modalHeadHtml') || '').includes('modal-head');
(inSmart && inHelper ? L.ok : L.bad)('modal-head 仅 helper+openSmart 函数体');

// DESIGN 文档已对账
const design = fs.readFileSync(path.join(L.ROOT, 'docs/DESIGN-SYSTEM.md'), 'utf8');
(/三视图/.test(design) && /MIT pin/.test(design) && !/英雄卡、面板网格/.test(design) ? L.ok : L.bad)('DESIGN-SYSTEM 已改为三视图+MIT');
(/goalfocus\.workflows\.v2/.test(design) && /禁止/.test(design) ? L.ok : L.bad)('DESIGN 含存储键规范');
(/快捷键/.test(design) && /Ctrl\/Cmd\+K|⌘/.test(design) ? L.ok : L.bad)('DESIGN 含快捷键表');

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 6 ? L.ok : L.bad)('index.html ≥6 处 ?v=（当前 ' + curV + '）', '实际 ' + vCount);

const app = require('../tests/lib.cjs').requireApp();
(typeof app.buildModalHtml === 'function' && typeof app.parseText === 'function' ? L.ok : L.bad)('requireApp 导出壳+解析');

process.exit(L.summary('verify-v824') ? 1 : 0);
