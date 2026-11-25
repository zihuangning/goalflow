/* v8.2 AI 排期五修复 —— 常驻字符串核查（配合 smoke-v82.cjs 行为冒烟）。
   运行：node scripts/checks/verify-v82.cjs   或直接 node scripts/checks/run.cjs 全跑 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');

console.log('== v8.2 核查 ==');

// ① backfillAISchedule 兜底排期
L.assertFnContains('backfillAISchedule 存在且用多窗口', 'backfillAISchedule', 'wfTimeWindows(state.activeWorkflowId)');
L.assertFnContains('兜底：缺 date 从 max(今天,anchor) 顺排', 'backfillAISchedule', 'Math.max((anchorD && !isNaN(anchorD.getTime()))');
L.assertFnContains('兜底：定 date 与放 start 同一遍 bump（v8.2 二次避让修复）', 'backfillAISchedule', '每块只 bump 一次避免二次避让');
L.assertFnContains('兜底：当日任务写 time，未来写 planDate', 'backfillAISchedule', "n.planDate = dk + 'T' + hm");
L.assertFnContains('insertAITasks 最外层调用兜底', 'insertAITasks', 'backfillAISchedule(collected, anchorD)');

// ② 提醒默认 = 开始前 5 分钟
L.assertFnContains('ensureRemindDefaults 存在', 'ensureRemindDefaults', 'hmToMin(n.time) - 5');
L.assertFnContains('_remindOff 换天重置', 'ensureRemindDefaults', "n._remindOff && n._remindOff !== dk");
L.assertFnContains('setNodeRemind 清空记 _remindOff 当天不回填', 'setNodeRemind', '_remindOff');

// ③ MIT 候选池与今日清单同池
L.assertFnContains('heroGlobalCandidates 用今日执行池', 'heroGlobalCandidates', 'todayExecutionPoolFor(nodes).filter(n => !n._overflow)');

// ④ 多时段窗口
L.assertFnContains('wfTimeWindows 读 wins 数组', 'wfTimeWindows', 'Array.isArray(cap.wins)');
L.assertFnContains('wfTimeWindows 兼容旧 winStart/winEnd', 'wfTimeWindows', 'cap.winStart && cap.winEnd');
L.assertContains('readWins 读取 wfmWinsList 行（局部箭头函数）', 'const readWins = () =>');
// 弹窗 DOM 由 app.js 模板生成（不在 index.html）
L.assertContains('项目弹窗多窗口容器', 'id="wfmWinsList"');
L.assertContains('项目弹窗添加窗口按钮', 'id="wfmWinAdd"');
L.assertContains('wfm-win-row 样式', '.wfm-win-row', features);
L.assertFnContains('buildAIDecomposeInput 注入多段窗口文本', 'buildAIDecomposeInput', 'wfTimeWindows');

// ⑤ AI 分解框全屏居中 overlay
L.assertFnContains('showAIOverlay helper 存在', 'showAIOverlay', 'ai-analyzing-overlay');
L.assertFnContains('autoDecomposeGoal 用 overlay 不用 toast', 'autoDecomposeGoal', 'showAIOverlay(');

// parseAIStart 兼容格式
L.assertFnContains('parseAIStart 兼容 19点/7:30pm/19.30/裸小时', 'parseAIStart', '点');

process.exit(L.summary('verify-v82') ? 1 : 0);
