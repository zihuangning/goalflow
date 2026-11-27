/* v8.23 合并两线：
   A 今日清单：跨日清陈旧 time + 用户置顶（scrub/sort/pin）
   B 规范合规：confirmModal 门闩 / setNodeDeadline 唯一写入口 / 设置弹窗壳 / 容量口径
   运行：node scripts/checks/verify-v823.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.23 核查 ==');

L.assertContains('scrubStaleTodayTimes', 'function scrubStaleTodayTimes', L.APP_JS);
L.assertContains('stampNodeTimeDk', 'function stampNodeTimeDk', L.APP_JS);
L.assertContains('sortTodayExecEntries', 'function sortTodayExecEntries', L.APP_JS);
L.assertContains('toggleTodayListPin', 'function toggleTodayListPin', L.APP_JS);
L.assertContains('rolloverTodayState', 'function rolloverTodayState', L.APP_JS);
L.assertContains('timeDk 字段', 'timeDk', L.APP_JS);
L.assertContains('lastTodayDk meta', 'lastTodayDk', L.APP_JS);
L.assertContains('todayListPins meta', 'todayListPins', L.APP_JS);

L.assertFnContains('convertDue 盖章 timeDk', 'convertDuePlanDate', 'timeDk');
L.assertFnContains('refresh 走 rollover', 'refreshTodayIfNeeded', 'rolloverTodayState');
L.assertFnContains('renderToday 走 rollover', 'renderTodayPanel', 'rolloverTodayState');
L.assertFnContains('renderToday 走 sortTodayExecEntries', 'renderTodayPanel', 'sortTodayExecEntries');
L.assertFnContains('行内置顶按钮', 'todayRowHtml', 'data-todaypin');
L.assertFnContains('绑定置顶', 'bindTodayPanel', 'toggleTodayListPin');
L.assertFnContains('改 time 盖章', 'bindTodayPanel', 'stampNodeTimeDk');

L.assertContains('置顶行样式', '.today-row.is-list-pinned', css);
L.assertContains('导出 scrub', 'scrubStaleTodayTimes,', L.APP_JS);
L.assertContains('导出 sortTodayExecEntries', 'sortTodayExecEntries,', L.APP_JS);

// ---- B 规范合规 ----
L.assertContains('新建项目跳规划用 confirmModal', "title: '去目标规划'");
L.assertContains('树删节点用 confirmModal', "title: '删除节点'");
L.assertContains('换父用 confirmModal', "title: '调整层级'");
L.assertContains('Skill 重置用 confirmModal', "title: '恢复默认 Skill'");
L.assertFnContains('reparentNode 为 async', 'reparentNode', 'async function reparentNode');
L.assertFnNotContains('树删不再原生 confirm', 'bindTreeEditorDelegation', "confirm('删除该节点及其子树？')");
L.assertFnContains('树删走 confirmModal', 'bindTreeEditorDelegation', 'confirmModal');
L.assertContains('drop 调用 void reparentNode', 'void reparentNode(');
L.assertFnContains('promote 走 setNodeDeadline', 'promoteNodeToToday', "setNodeDeadline(n, '今天')");
L.assertFnNotContains('promote 不再手搓今天五字段', 'promoteNodeToToday', "n.deadline = '今天'");
L.assertFnContains('appendActionLeaf 走 setNodeDeadline', 'appendActionLeaf', 'setNodeDeadline(node');
L.assertFnContains('里程碑向导走 setNodeDeadline', 'generatePlanFromSteps', 'setNodeDeadline(node, dateKey(dd))');
L.assertFnContains('设置走 buildModalHtml', 'openSettingsModal', 'buildModalHtml({');
L.assertFnContains('设置走 openModalMask settingsModal', 'openSettingsModal', "openModalMask('settingsModal'");
L.assertFnContains('容量一览 hasGlobal 分支', 'openSettingsModal', 'hasGlobal');
L.assertFnContains('无全局引导配置空闲时段', 'openSettingsModal', '尚未配置全局空闲时段');
L.assertFnContains('warn 全局文案空闲合计', 'warnIfOverCapacity', '工作日空闲合计');
L.assertContains('导出 globalCapacityHours', 'globalCapacityHours,');
L.assertContains('导出 weekPlanFeasibility', 'weekPlanFeasibility,');
L.assertContains('导出 __testState', '__testState:');

const app = require('../tests/lib.cjs').requireApp();
const n = { id: 'x', time: '09:00', timeDk: '2099-01-01', done: false };
app.scrubStaleTodayTimes([n], '2099-01-02');
(n.time === '' ? L.ok : L.bad)('scrub 清非今日 timeDk', JSON.stringify(n));

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1
  ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（当前 ' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v823') ? 1 : 0);
