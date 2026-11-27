/* v8.28 Batch 4+5：色板归一 / a11y / 简洁模式 / 动效
   运行：node scripts/checks/verify-v828.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const baseCss = fs.readFileSync(path.join(L.ROOT, 'assets/css/base.css'), 'utf8');
const featCss = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const modelJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/gf-model.js'), 'utf8');

console.log('== v8.28 核查 ==');

L.assertFnContains('ensureScoreMeta 兜底 simpleMode', 'ensureScoreMeta', 'prefs.simpleMode');
L.assertFnContains('syncSimpleModeClass', 'syncSimpleModeClass', 'simple-mode');
L.assertFnContains('设置简洁模式开关', 'openSettingsModal', 'setSimpleMode');
L.assertFnContains('保存 simpleMode', 'openSettingsModal', 'prefs.simpleMode = !!sm.checked');
L.assertFnContains('今日区强制收折', 'updateTodayZones', 'prefsSimpleMode() ? false');

L.assertContains('svgGold 助手', 'const svgGold', modelJs);
L.assertFnContains('桑基金渐变', 'render', 'svgGoldSoft()');
L.assertFnContains('桑基噪音色', 'render', 'svgNoise()');
L.assertFnContains('审计噪音色', 'renderTimeAudit', 'svgNoise()');
L.assertFnContains('导出 PNG 用 cssVar', 'exportPNG', 'cssVar');

L.assertFnContains('fold summary aria-expanded', 'foldSectionHtml', 'aria-expanded');
L.assertFnContains('zone toggle aria', 'bindZonePersist', 'aria-expanded');

L.assertContains('全局 focus-visible', 'summary:focus-visible', baseCss);
L.assertContains('简洁模式 CSS', 'body.simple-mode #zoneStatus', featCss);
L.assertContains('弹窗动效', 'gf-modal-in', featCss);
L.assertContains('勾选动效', 'gf-check-pop', featCss);

L.assertFnContains('设置关于快捷键', 'openSettingsModal', 'set-shortcuts');
L.assertFnContains('洞察时间线空态', 'renderCompletionHistory', 'emptyStateHtml');

const arch = fs.readFileSync(path.join(L.ROOT, 'openmemory.md'), 'utf8');
(/gf-model/.test(arch) && /gf-ui/.test(arch) ? L.ok : L.bad)('openmemory Architecture 含拆分脚本');

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 6 && curV === '8.28' ? L.ok : L.bad)('index.html 版本 8.28 ×' + vCount, '当前 ' + curV + ' / ' + vCount);

const app = require('../tests/lib.cjs').requireApp();
(typeof app.prefsSimpleMode === 'function' ? L.ok : L.bad)('requireApp 导出 prefsSimpleMode');

process.exit(L.summary('verify-v828') ? 1 : 0);