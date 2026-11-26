/* 流程测试 · 今日池容量与时间纠偏（v8.11）：
   A 池预算参数：budgetCap 截断 / 默认 dayCap / 保底 / 习惯不占预算
   B backfill 全局避让：新批次顺排避开项目里已存在的今日/各日占用
   C backfill 本批纠偏：AI 直给两个相同 start → 写库前顺延开
   运行：node scripts/tests/flow/flow-today-pool.cjs */
const L = require('../../checks/lib.cjs');

console.log('== 流程 · 今日池容量与时间纠偏 ==');

const pad = n => String(n).padStart(2, '0');
const TODAY = new Date(2026, 10, 25);   // 2026-11-25
const dkOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const stubs = {
  hmToMin: hm => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); },
  minToHm: m => pad(Math.floor(m / 60)) + ':' + pad(m % 60),
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  today0: () => new Date(TODAY),
  dateKey: d => dkOf(d || TODAY),
  dayCap: () => 240,
  ensureEstimate: n => { if (!n.estimateMinutes) n.estimateMinutes = 30; },
  isQuickWin: () => false,
  focusScore: n => (n.im || 3) * 10,
  buildView: nodes => nodes,
  wfTimeWindows: () => [{ start: '09:00', end: '22:00', mins: 780 }],
  setNodeDeadline: (n, raw) => {
    const dk = raw ? String(raw).slice(0, 10) : '';
    n.deadline = dk; n.deadlineDate = dk ? new Date(dk + 'T00:00:00') : null;
    n.daysLeft = dk ? Math.round((new Date(dk + 'T00:00:00') - TODAY) / 86400000) : null;
  },
  isRecurringTask: () => false,
  recurringTaskDueToday: () => false,
  habitDueToday: () => true,
  parseAIStart: raw => raw || '',
  beginTick: () => {}, endTick: () => {},
  _rankSlot: null, _tickN: 0,
  state: { activeWorkflowId: 'wf1', nodes: [], workflows: [], meta: {} },
};
const ctx = L.buildCtx([
  'todayExecutionPoolFor', 'computeTree', 'pickRanked', 'isNodeParked', 'isNodeWaiting', 'isNodeBlocked',
  'backfillAISchedule', 'resolveTimeConflicts',
], stubs);

const mkLeaf = (id, extra) => Object.assign({ id, parentId: 'root', text: id, scale: 'day', im: 3, estimateMinutes: 60 }, extra);

// ---- A. 池预算参数（v8.11：全局日预算递减分配的 building block） ----
let pool = ctx.todayExecutionPoolFor([{ id: 'root', text: '根' }, mkLeaf('a'), mkLeaf('b')], 60);
const aIn = pool.find(n => n.id === 'a'), bIn = pool.find(n => n.id === 'b');
(aIn && !aIn._overflow && bIn && bIn._overflow)
  ? L.ok('A1 budget=60 → 第一个池内 · 第二个溢出')
  : L.bad('A1', pool.map(n => n.id + ':' + n._overflow).join(' '));

pool = ctx.todayExecutionPoolFor([{ id: 'root', text: '根' }, mkLeaf('a'), mkLeaf('b'), mkLeaf('c')]);
(pool.length === 3 && pool.every(n => !n._overflow))
  ? L.ok('A2 不传 budget → 默认 dayCap(240) 全进（180≤240）')
  : L.bad('A2', pool.map(n => n.id + ':' + n._overflow).join(' '));

pool = ctx.todayExecutionPoolFor([{ id: 'root', text: '根' }, mkLeaf('a')], 0);
(pool.length === 1 && !pool[0]._overflow)
  ? L.ok('A3 budget=0 保底 → 首个任务仍进池')
  : L.bad('A3', JSON.stringify(pool.map(n => n._overflow)));

pool = ctx.todayExecutionPoolFor([{ id: 'root', text: '根' }, mkLeaf('h', { recur: true }), mkLeaf('a')], 10);
const hIn = pool.find(n => n.id === 'h'), tIn = pool.find(n => n.id === 'a');
(hIn && !hIn._overflow && tIn && tIn._overflow)
  ? L.ok('A4 习惯不占预算 · 任务超 10′ 预算溢出')
  : L.bad('A4', pool.map(n => n.id + ':' + n._overflow).join(' '));

// ---- B. backfill 全局避让（v8.11：第二次 AI 拆解不与旧任务撞车） ----
stubs.state.nodes = [{ id: 'old', parentId: 'root', text: '旧任务', time: '09:00', estimateMinutes: 60 }];
let batch = [mkLeaf('t1', { estimateMinutes: 30 })];
ctx.backfillAISchedule(batch, new Date(TODAY));
(batch[0].time === '10:10')
  ? L.ok('B1 旧任务占 09:00+60′ → 新批缺省任务顺到 10:10')
  : L.bad('B1', `time=${batch[0].time} planDate=${batch[0].planDate}`);

stubs.state.nodes = [{ id: 'old', parentId: 'root', text: '旧任务', planDate: '2026-11-26T09:00', estimateMinutes: 60 }];
batch = [mkLeaf('t2', { estimateMinutes: 30 })];
ctx.backfillAISchedule(batch, new Date(TODAY));
(batch[0].time === '09:00')
  ? L.ok('B2 旧任务占「明天」09:00 → 今天顺排不受影响')
  : L.bad('B2', `time=${batch[0].time}`);

// ---- C. backfill 本批纠偏（AI 直给两个相同 start） ----
stubs.state.nodes = [];
batch = [mkLeaf('x', { time: '09:00', estimateMinutes: 30 }), mkLeaf('y', { time: '09:00', estimateMinutes: 30 })];
ctx.backfillAISchedule(batch, new Date(TODAY));
(batch[0].time === '09:00' && batch[1].time === '09:40')
  ? L.ok('C1 AI 直给两个 9:00 → 写库前纠成 09:00/09:40')
  : L.bad('C1', batch.map(n => n.time).join(' '));

process.exit(L.summary('flow-today-pool') ? 1 : 0);
