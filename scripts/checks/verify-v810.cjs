/* v8.10 「增改之后其他模块的显示/统计」同步审计修复 —— 常驻字符串核查。
   审计「添加/修改」链路的跨模块一致性，共修 9 处：
   ① setNodeDone 出口统一 saveMeta —— updateHabitStreak/logHabitCheck 写在 appendScore 内部
      saveMeta 之后，调用方只 save()，习惯打卡 🔥streak/强度刷新页面即回滚
   ② removeExecutionLogEntry 新增 —— 取消勾选对称回滚 executionLog
     （此前只增不减：「✅今日已完成」/顶栏 X/Y/时间审计/planVsActual 全部虚报）
   ③ refreshTodayIfNeeded 跨午夜自愈 —— TODAY 此前只在启动赋值，页面过夜「今日」全停昨天；
      convertDuePlanDate 从 normalizeNode 抽出共用；30s 轮询 + 唤醒补跑挂载
   ④ importBackupText 恢复 meta 后补 saveMeta + reconcileRefsAfterRestore（刷新读回旧 meta 修复）
   ⑤ 精力打卡走 afterChange 全链 —— peak 变化当场重排 MIT（此前只重画精力卡）
   ⑥ deleteTodayNode 统一走 deleteNode 级联 —— v8.9 审计盲区：只查 state.nodes= 漏了 w.nodes= 直改
   ⑦ importBackupText/restoreSnapshot 原生 confirm 改 confirmModal（WebView 静默吞 confirm）
   ⑧ reconcileRefsAfterRestore 新增 —— 快照/备份恢复后清孤儿引用（大石头/明晚预选/习惯打卡）
   ⑨ 晚总结「明天继续/改期」走 setNodeDeadline 唯一写入口（此前手搓五字段，deadlineText 残留）
   运行：node scripts/checks/verify-v810.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');

console.log('== v8.10 核查 ==');

// ① setNodeDone 出口统一 saveMeta
L.assertFnContains('setNodeDone 出口统一 saveMeta', 'setNodeDone', 'saveMeta();');
L.assertFnContains('setNodeDone 勾选仍更新习惯', 'setNodeDone', 'updateHabitStreak(n, state.activeWorkflowId, true);');
L.assertFnContains('setNodeDone 取消仍回滚习惯', 'setNodeDone', 'updateHabitStreak(n, state.activeWorkflowId, false);');
// ①+ 取消打卡 streak 回退非清零（flow-time-travel 发现：连续 N 天误点取消 🔥N→0）
L.assertFnContains('updateHabitStreak 取消回退 cur-1', 'updateHabitStreak', 'const prev = (rec.cur || 1) - 1;');
L.assertFnContains('updateHabitStreak 回退 lastDate 到昨天', 'updateHabitStreak', 'rec.lastDate = dateKey(yest);');
L.assertFnNotContains('updateHabitStreak 不再直接清零', 'updateHabitStreak', "rec.lastDate = '';\n      rec.cur = 0;");

// ② 取消勾选 executionLog 对称回滚
L.assertFnContains('removeExecutionLogEntry 从尾部找最新一条', 'removeExecutionLogEntry', 'let i = dayLog.entries.length - 1');
L.assertFnContains('removeExecutionLogEntry 回退 byWorkflow', 'removeExecutionLogEntry', 'dayLog.byWorkflow[key] = Math.max(0');
L.assertFnContains('removeExecutionLogEntry 回退 completedCount', 'removeExecutionLogEntry', 'dayLog.completedCount = Math.max(0');
L.assertFnContains('removeExecutionLogEntry 回退 dailyCompletions', 'removeExecutionLogEntry', 'state.meta.dailyCompletions[dk]--');
L.assertFnContains('removeExecutionLogEntry 只删一条', 'removeExecutionLogEntry', 'break;');
L.assertFnContains('setNodeDone 取消分支调回滚', 'setNodeDone', "removeExecutionLogEntry(n.id);");

// ③ 跨午夜自愈
L.assertFnContains('convertDuePlanDate 抽出共用', 'convertDuePlanDate', 'if (dk > dateKey()) return false;');
L.assertFnContains('normalizeNode 复用 convertDuePlanDate', 'normalizeNode', 'convertDuePlanDate(n);');
// v8.23: 换天逻辑抽到 rolloverTodayState（含 convertDuePlanDate + scrubStaleTodayTimes），refresh 只判日+委托
L.assertFnContains('refreshTodayIfNeeded 同日且已滚过则跳过', 'refreshTodayIfNeeded', 'sameClock && state.meta.lastTodayDk === dateKey()');
L.assertFnContains('refreshTodayIfNeeded 刷新 TODAY', 'refreshTodayIfNeeded', 'TODAY = now;');
L.assertFnContains('refreshTodayIfNeeded 委托 rollover', 'refreshTodayIfNeeded', 'rolloverTodayState()');
L.assertFnContains('refreshTodayIfNeeded 重渲染', 'refreshTodayIfNeeded', 'afterChange();');
L.assertFnContains('rollover 全流转 planDate', 'rolloverTodayState', 'convertDuePlanDate(n)');
L.assertFnContains('rollover 脏则 save', 'rolloverTodayState', 'if (dirty) save();');
L.assertContains('30s 轮询挂跨午夜检查', 'setInterval(() => { refreshTodayIfNeeded(); tickReminders();');
L.assertContains('唤醒补跑挂跨午夜检查', 'const wakeCheck = () => { try { refreshTodayIfNeeded();');
L.assertContains('beforeunload 补 saveMeta', '() => { try { save(); saveMeta(); }');

// ④+⑦ 备份恢复：落盘 meta + 页内确认
L.assertContains('importBackupText 为 async', 'async function importBackupText(text)');
L.assertFnContains('备份恢复用页内确认', 'importBackupText', 'await confirmModal({');
L.assertFnNotContains('备份恢复不再原生 confirm', 'importBackupText', 'confirm(');
L.assertFnContains('备份恢复清孤儿引用', 'importBackupText', 'reconcileRefsAfterRestore();');
L.assertFnContains('备份恢复落盘 meta', 'importBackupText', 'save(); saveMeta(); afterChange();');

// ⑤ 精力打卡走全链（peak 变化当场重排 MIT）
L.assertContains('精力打卡后 afterChange 全链', 'logEnergy(+b.dataset.energy); afterChange();');

// ⑥ deleteTodayNode 统一走 deleteNode 级联
L.assertFnContains('deleteTodayNode 走 deleteNode', 'deleteTodayNode', 'deleteNode(id);');
L.assertFnContains('deleteTodayNode 跨流临时切换', 'deleteTodayNode', 'switchWorkflow(wfId);');
L.assertFnContains('deleteTodayNode 切回原流', 'deleteTodayNode', 'switchWorkflow(prevWf);');
L.assertFnNotContains('deleteTodayNode 不再直改 w.nodes', 'deleteTodayNode', 'w.nodes = w.nodes.filter');

// ⑦ 快照恢复页内确认
L.assertContains('restoreSnapshot 为 async', 'async function restoreSnapshot(at)');
L.assertFnContains('快照恢复用页内确认', 'restoreSnapshot', 'await confirmModal({');
L.assertFnNotContains('快照恢复不再原生 confirm', 'restoreSnapshot', 'confirm(');

// ⑧ 恢复后清孤儿引用
L.assertFnContains('reconcileRefsAfterRestore 建存活集合', 'reconcileRefsAfterRestore', "alive.add(w.id + '|' + n.id)");
L.assertFnContains('reconcileRefsAfterRestore 清孤儿大石头', 'reconcileRefsAfterRestore', 'alive.has((r.wfId ||');
L.assertFnContains('reconcileRefsAfterRestore 清孤儿明晚预选', 'reconcileRefsAfterRestore', 'state.meta.tomorrowMit = null;');
L.assertFnContains('reconcileRefsAfterRestore 清孤儿习惯', 'reconcileRefsAfterRestore', 'delete state.meta.habitStreaks[key];');
L.assertFnContains('reconcileRefsAfterRestore 脏则落盘', 'reconcileRefsAfterRestore', 'if (dirty) saveMeta();');
L.assertFnContains('快照恢复清孤儿引用', 'restoreSnapshot', 'reconcileRefsAfterRestore();');

// ⑨ 晚总结期限走唯一写入口
L.assertContains('晚总结明天继续走 setNodeDeadline', "setNodeDeadline(n, '明天');");
L.assertContains('晚总结改期走 setNodeDeadline', 'setNodeDeadline(n, inp.value.trim());');
L.assertNotContains('晚总结不再手搓期限字段', 'n.deadlineDate = tmr; n.daysLeft = 1;');
L.assertNotContains('晚总结不再手搓 dl 字段', 'n.deadline = dl.label; n.deadlineDate = dl.date;');

// 版本号（最新版 verify 承担）
// 滚动版本守卫：跟随 index.html 当前版本（每次升版不再改这里）；残留检查锁定已退役版本
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
L.assertContains('index.html 版本号为当前滚动版（' + curV + '）', '?v=' + curV, html);
L.assertNotContains('index.html 无残留 8.10', '?v=8.10', html);
L.assertNotContains('index.html 无残留 8.9', '?v=8.9', html);

process.exit(L.summary('verify-v810') ? 1 : 0);
