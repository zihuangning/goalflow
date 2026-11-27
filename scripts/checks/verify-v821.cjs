/* v8.21 去掉今日摘要 + 基础设置扩充 + 空闲多段时段
   ① 移除 todayBrief；问候/待办并入 renderAppTitle → abMini / abMiniSub
   ② 基础设置扩：外观/默认番茄/AI Key/通知/关于/备份入口（对标 Things/Todoist/Structured）
   ③ 空闲时长 → 多段时间窗口 globalWorkdayWins / globalWeekendWins；小时数派生
   运行：node scripts/checks/verify-v821.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');

console.log('== v8.21 核查 ==');

// ① 去掉今日摘要，并入顶栏
L.assertNotContains('无 todayBrief 节点', 'id="todayBrief"', html);
L.assertNotContains('无 renderTodayBrief', 'function renderTodayBrief');
L.assertFnContains('顶栏问候', 'renderAppTitle', '早上好');
L.assertFnContains('顶栏待办文案', 'renderAppTitle', '待办 ${pending}');
L.assertFnContains('顶栏已完成文案', 'renderAppTitle', '已完成 ${doneN}');
L.assertFnContains('abMini 写问候', 'renderAppTitle', 'mbTitle.textContent = greet');
L.assertContains('移动 ab-mini 问候样式', 'body[data-view="today"] .ab-mini b', mobile);

// ② 设置扩充
L.assertFnContains('设置外观主题', 'openSettingsModal', 'setTheme');
L.assertFnContains('设置明暗', 'openSettingsModal', 'setMode');
L.assertFnContains('设置默认番茄', 'openSettingsModal', 'setPomoOpts');
L.assertFnContains('设置 AI Key', 'openSettingsModal', 'setApiKey');
L.assertFnContains('设置通知权限', 'openSettingsModal', 'setNotifyPerm');
L.assertFnContains('设置关于版本', 'openSettingsModal', 'setAboutVer');
L.assertFnContains('设置导出备份入口', 'openSettingsModal', 'setExportJson');
L.assertFnContains('prefs.pomoMinutes 落盘', 'openSettingsModal', 'prefs.pomoMinutes');
L.assertFnContains('ensureScoreMeta 兜底 prefs', 'ensureScoreMeta', 'state.meta.prefs');
L.assertFnContains('设置宽弹窗', 'openSettingsModal', 'wide: true');
L.assertContains('设置滚动区', '.set-body', css);
L.assertContains('番茄选项样式', '.set-pomo-opts', css);

// ③ 空闲多段时段
L.assertFnContains('globalTimeWindows 工作日键', 'globalTimeWindows', 'globalWorkdayWins');
L.assertFnContains('globalTimeWindows 周末键', 'globalTimeWindows', 'globalWeekendWins');
L.assertFnContains('旧小时迁移', 'globalTimeWindows', 'globalWorkdayHours');
L.assertFnContains('winsTotalHours', 'winsTotalHours', 'reduce');
L.assertFnContains('设置工作日时段列表', 'openSettingsModal', 'setWdWinsList');
L.assertFnContains('设置周末时段列表', 'openSettingsModal', 'setWeWinsList');
L.assertFnContains('保存写 wins', 'openSettingsModal', 'globalWorkdayWins = wd');
L.assertFnContains('派生小时同步', 'openSettingsModal', 'globalWorkdayHours = winsTotalHours(wd)');
L.assertFnContains('容量读时段', 'globalCapacityHours', 'globalTimeWindows');
L.assertFnContains('项目窗口回落全局', 'wfTimeWindows', 'globalTimeWindows');
L.assertFnContains('孤儿键白名单含 wins', 'reconcileRefsAfterRestore', 'globalWorkdayWins');
L.assertFnContains('MIT 番茄读 prefs', 'renderTodayPanel', 'prefs.pomoMinutes');

// 版本滚动
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v821') ? 1 : 0);
