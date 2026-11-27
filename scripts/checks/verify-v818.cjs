/* v8.18 今日已完成默认折叠 + 移动端顶部减负 + 侧栏项目色条 + 提醒 time−5
   起因（用户四点）：
   ① 「今日已完成」默认展开太长抢执行区 → FOLD_DEFAULT.done=false + details.fold
   ② 移动端顶部大标题/闹钟状态/空番茄区占屏 → body[data-view] + mobile §47
   ③ 侧栏项目看不出区别 → --wf-color 左色条 + WF_COLORS 稳定取色
   ④ 有开始时间必有提前 5 分钟提醒（MIT 同口径）→ remindAtFromTime + ensureRemindDefaults
      尊重 _remindManual / _remindOff
   运行：node scripts/checks/verify-v818.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const layout = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/layout.css'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');

console.log('== v8.18 核查 ==');

// ① 今日已完成默认折叠
L.assertContains('FOLD_DEFAULT.done=false', 'done: false }; // false=默认折叠');
L.assertFnContains('已完成包进 fold details', 'renderTodayPanel', 'today-done-fold');
// v8.21: 已完成折叠改走 foldSectionHtml({ fold:'done' })，属性在 helper 内拼
L.assertFnContains('已完成 fold=done', 'renderTodayPanel', "fold: 'done'");
L.assertContains('foldSectionHtml 写 data-fold', 'data-fold="${esc(fold)}"', L.APP_JS);
L.assertFnContains('已完成 bindFoldPersist', 'renderTodayPanel', "bindFoldPersist(list, 'done')");

// ② 移动端顶部减负
L.assertFnContains('switchView 写 body data-view', 'switchView', 'document.body.dataset.view = name');
L.assertContains('mobile §47 顶部减负', 'v8.18 今日页顶部减负', mobile);
L.assertContains('今日藏大标题', 'body[data-view="today"] .app-title { display: none !important; }', mobile);
L.assertContains('今日常显迷你标题', 'body[data-view="today"] header.topbar .ab-mini', mobile);
L.assertContains('空番茄收起 heroWrap', '#heroWrap:not(:has(.pomo-bar.show))', mobile);
L.assertContains('藏闹钟状态句', '.today-alarm-bar .today-alarm-st { display: none !important; }', mobile);

// ③ 侧栏项目色条
L.assertContains('WF_COLORS 调色板', 'const WF_COLORS =');
L.assertContains('workflowColor 函数', 'function workflowColor(w)');
L.assertFnContains('normalize 空色写入默认', 'normalizeWorkflowMeta', 'workflowColor({ id: w.id, color: \'\' })');
L.assertFnContains('侧栏写 --wf-color', 'renderWorkflowBar', '--wf-color:');
L.assertContains('wf-item 左色条', 'box-shadow: inset 3px 0 0 var(--wf-color, var(--accent));', layout);
L.assertContains('active 用项目色', 'box-shadow: inset 3px 0 0 var(--wf-color, var(--accent));', layout);
L.assertContains('active 略提亮底色', 'color-mix(in srgb, var(--wf-color, var(--accent)) 9%, var(--panel))', layout);

// ④ 提醒 time−5 + MIT 并入
L.assertContains('remindAtFromTime 纯函数', 'function remindAtFromTime(timeStr, day0)');
L.assertFnContains('缺 remindAt 补 time-5', 'ensureRemindDefaults', 'n.remindAt = expect');
L.assertFnContains('非手动随 time 同步', 'ensureRemindDefaults', '!n._remindManual');
L.assertFnContains('手改提醒打标', 'setNodeRemind', '_remindManual = true');
L.assertFnContains('MIT 并入 remindNodes', 'renderTodayPanel', 'remindNodes.push(mitEntry.node)');
L.assertContains('序列化 _remindManual', '_remindManual: !!n._remindManual');
L.assertContains('导出 remindAtFromTime', 'remindAtFromTime, ensureRemindDefaults, workflowColor');

// 版本
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);
// 版本号滚动式：不写死 8.18，升版后本文件仍绿

process.exit(L.summary('verify-v818') ? 1 : 0);
