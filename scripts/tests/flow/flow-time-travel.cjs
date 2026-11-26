/* 流程测试 · 时间旅行（跨天 / 换天 / 时间调整）：
   dateKey/today0 走可变 __now，模拟「昨天操作 → 跨午夜 → 今天继续」的完整旅程。
   场景：A 习惯 streak 跨天连续/中断/取消回退（v8.10 修复验证）
        B 习惯打卡日志跨天分桶 + 计数型 targetDone 对称
        C _remindOff 换天重置 + 提醒自动回填边界
        D 执行日志跨天分桶：取消勾选只动当天桶，昨天历史不回滚
        E 排期任务过夜自动进今日（planDate→time 旅程）
   运行：node scripts/tests/flow/flow-time-travel.cjs */
const L = require('../../checks/lib.cjs');

console.log('== 流程 · 时间旅行（跨天） ==');

const pad = n => String(n).padStart(2, '0');
const dkOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

// 可控时钟：__now 是「现在」，换天 = advance()
const stubs = {
  __now: new Date(),
  state: {
    activeWorkflowId: 'wf1', topId: null,
    nodes: [
      { id: 'root', text: '根' },
      { id: 'h1', parentId: 'root', text: '每天阅读30分钟', role: 'habit', estimateMinutes: 30, timesPerWeek: 0, targetNum: 0 },
      { id: 't1', parentId: 'root', text: '普通任务', estimateMinutes: 20 },
    ],
    workflows: [{ id: 'wf1', name: '项目A', nodes: [] }],
    meta: { executionLog: {}, habitStreaks: {}, dailyCompletions: {} },
  },
  dateKey: d => dkOf(d || stubs.__now),
  today0: () => { const d = stubs.__now; return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  hmToMin: s => { const p = String(s).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); },
  workflowById: id => (stubs.state.workflows || []).find(w => w.id === id),
  ensureScoreMeta: () => {},
  isRecurringTask: () => false,
  bumpDailyCompletion: () => { const dk = stubs.dateKey(); const dc = stubs.state.meta.dailyCompletions; dc[dk] = (dc[dk] || 0) + 1; },
  appendScore: () => {}, removeTodayScore: () => {},
  isUnderTopNode: () => false, goldChainIds: () => new Set(),
  getCachedTree: nodes => { nodes.forEach(x => x._children = nodes.filter(y => y.parentId === x.id)); return nodes; },
  save: () => {}, saveMeta: () => {}, afterChange: () => {},
};
const advance = (days = 1) => { stubs.__now.setDate(stubs.__now.getDate() + days); };
const dkNow = () => stubs.dateKey();

const ctx = L.buildCtx([
  'setNodeDone', 'appendExecutionLog', 'removeExecutionLogEntry',
  'updateHabitStreak', 'logHabitCheck', 'isHabitLike', 'nodeHabitKey',
  'habitRecurrence', 'habitTarget', 'ensureRemindDefaults', 'convertDuePlanDate',
], stubs);
const s = stubs.state;
const h1 = s.nodes[1], t1 = s.nodes[2];
const HS = () => s.meta.habitStreaks['wf1|h1'] || {};

// ---------- A. 习惯 streak 跨天：连续 → 防重 → 取消回退 → 中断重置 ----------
ctx.setNodeDone(h1, true);                       // d0 打卡
const dk0 = dkNow();
[
  ['d0 打卡 · cur=1', HS().cur === 1],
  ['d0 打卡 · lastDate=d0', HS().lastDate === dk0],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

advance();                                       // 跨午夜 → d1
ctx.setNodeDone(h1, true);                       // d1 连打
ctx.setNodeDone(h1, true);                       // d1 重复进入（防重）
[
  ['d1 连打 · cur=2', HS().cur === 2],
  ['d1 连打 · best=2', HS().best === 2],
  ['d1 重复勾 · 防重 cur 仍 2', HS().cur === 2],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

ctx.setNodeDone(h1, false);                      // d1 取消（误点）
[
  ['d1 取消 · cur 回退 1（v8.10 修复：不再清零）', HS().cur === 1],
  ['d1 取消 · lastDate 回退 d0', HS().lastDate === dk0],
  ['d1 取消 · best=2 历史最好保留', HS().best === 2],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

ctx.setNodeDone(h1, true);                       // d1 再勾 → 恢复连续
[
  ['d1 再勾 · cur 恢复 2', HS().cur === 2 && HS().lastDate === dkNow()],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

advance(3);                                      // 断 2 天 → d4
ctx.setNodeDone(h1, true);                       // 中断后打卡
[
  ['d4 中断后打卡 · cur 重置 1', HS().cur === 1],
  ['d4 中断后打卡 · best=2 不动', HS().best === 2],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

ctx.setNodeDone(h1, false);                      // d4 取消（cur=1 → 归零）
ctx.setNodeDone(h1, false);                      // 再取消（lastDate 已空 → no-op）
[
  ['d4 取消 · cur=0 lastDate 清空', HS().cur === 0 && HS().lastDate === ''],
  ['d4 重复取消 · 安全 no-op', HS().cur === 0],
].forEach(([n, ok]) => ok ? L.ok('A ' + n) : L.bad('A ' + n, JSON.stringify(HS())));

// ---------- B. 打卡日志跨天分桶 + 计数型 targetDone 对称 ----------
const h2 = { id: 'h2', text: '每周健身3次', role: 'habit', timesPerWeek: 3, targetNum: 3, targetDone: 0, estimateMinutes: 40 };
ctx.logHabitCheck(h2, 'wf1', true);              // d4 第 1 次
const dk4 = dkNow();
const H2 = () => s.meta.habitStreaks['wf1|h2'] || {};
advance();                                       // → d5
ctx.logHabitCheck(h2, 'wf1', true);              // d5 第 2 次
const dk5 = dkNow();
ctx.logHabitCheck(h2, 'wf1', true);              // d5 重复勾（防重：prev.done 已 true）
[
  ['B 跨天 · d4/d5 各建一桶', !!(H2().log || {})[dk4] && !!H2().log[dk5]],
  ['B 跨天 · d4 桶 act=40', H2().log[dk4].act === 40],
  ['B 计数 · 跨天累积 targetDone=2', h2.targetDone === 2],
  ['B 计数 · 同日重复勾防重 仍 2', h2.targetDone === 2],
  ['B 低频 · freqDecay=0.012', H2().freqDecay === 0.012],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(H2()).slice(0, 120)));

ctx.logHabitCheck(h2, 'wf1', false);             // d5 取消
[
  ['B 取消 · d5 桶删除', !H2().log[dk5]],
  ['B 取消 · d4 桶保留', !!H2().log[dk4]],
  ['B 取消 · targetDone 回退 1', h2.targetDone === 1],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(H2()).slice(0, 120)));

// ---------- C. _remindOff 换天重置 + 自动回填边界 ----------
const r1 = { id: 'r1', time: '19:00', remindAt: null, _remindOff: dkNow() };   // 今天手动关了提醒
ctx.ensureRemindDefaults([r1]);
[
  ['C 当天关提醒 · 不回填', r1.remindAt === null && r1._remindOff === dkNow()],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(r1)));

advance();                                       // → d6
ctx.ensureRemindDefaults([r1]);
const exp1855 = stubs.today0(); exp1855.setHours(18, 55, 0, 0);
[
  ['C 换天 · _remindOff 重置', r1._remindOff === ''],
  ['C 换天 · 自动回填 18:55（开始前 5 分钟）', r1.remindAt === exp1855.getTime()],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(r1)));

const r2 = { id: 'r2', time: '00:03', remindAt: null, _remindOff: '' };
const r3 = { id: 'r3', time: '09:00', remindAt: null, _remindOff: '' };
const r4 = { id: 'r4', time: '10:00', remindAt: 123, _remindOff: '' };        // 已有提醒不覆盖
const r5 = { id: 'r5', time: '11:00', remindAt: null, done: true };           // 已完成不回填
ctx.ensureRemindDefaults([r2, r3, r4, r5]);
const exp0855 = stubs.today0(); exp0855.setHours(8, 55, 0, 0);
[
  ['C 边界 · 00:03 前 5 分钟是昨天 → 不设置', r2.remindAt === null],
  ['C 回填 · 09:00 → 08:55', r3.remindAt === exp0855.getTime()],
  ['C 已有提醒 · 不覆盖', r4.remindAt === 123],
  ['C 已完成 · 不回填', r5.remindAt === null],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify({ r2: r2.remindAt, r3: r3.remindAt, r4: r4.remindAt, r5: r5.remindAt })));

// ---------- D. 执行日志跨天分桶：取消只动当天桶，昨天历史不回滚 ----------
ctx.setNodeDone(t1, true);                       // d6 完成普通任务
const dk6 = dkNow();
advance();                                       // → d7
ctx.setNodeDone(t1, false);                      // d7 取消昨天勾的任务
const log6 = s.meta.executionLog[dk6], log7 = s.meta.executionLog[dkNow()];
[
  ['D 跨天 · d6 桶有 1 条记录', log6 && log6.entries.length === 1],
  ['D 跨天取消 · 昨天历史保留（removeExecutionLogEntry 只查当天桶）', log6.entries.length === 1 && log6.completedCount === 1],
  ['D 跨天取消 · 今天不建空桶', !log7],
  ['D 跨天取消 · dailyCompletions[d6] 不动', s.meta.dailyCompletions[dk6] === 1],
  ['D 跨天取消 · 节点状态仍复位', t1.done === false && t1.doneAt === null],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify({ log6, log7, dc: s.meta.dailyCompletions }).slice(0, 140)));

ctx.setNodeDone(t1, true);                       // d7 重新完成 → 记到新一天
[
  ['D 换天重勾 · d7 建新桶', s.meta.executionLog[dkNow()] && s.meta.executionLog[dkNow()].entries.length === 1],
  ['D 换天重勾 · d6 历史仍独立', s.meta.executionLog[dk6].entries.length === 1],
  ['D 换天重勾 · 两天计数各自独立', s.meta.dailyCompletions[dk6] === 1 && s.meta.dailyCompletions[dkNow()] === 1],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(s.meta.executionLog).slice(0, 140)));

// ---------- E. 排期任务过夜自动进今日（planDate→time 旅程） ----------
const tmr19 = dkNow().slice(0, 0);               // 明天 19:00 排期
const tmr = new Date(stubs.__now); tmr.setDate(tmr.getDate() + 1);
const pd = { id: 'p9', planDate: dkOf(tmr) + 'T19:00', time: '' };
[
  ['E 排期明天 · 今天不转换', ctx.convertDuePlanDate(pd) === false && pd.planDate.includes('T19:00')],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(pd)));

advance();                                       // → d8（排期日到了）
[
  ['E 过夜 · 到期自动转 time', ctx.convertDuePlanDate(pd) === true],
  ['E 过夜 · time=19:00 planDate 清空', pd.time === '19:00' && pd.planDate === ''],
].forEach(([n, ok]) => ok ? L.ok(n) : L.bad(n, JSON.stringify(pd)));

process.exit(L.summary('flow-time-travel') ? 1 : 0);
