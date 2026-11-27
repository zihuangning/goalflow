/* v8.8 行为冒烟：grabFn 提取真实函数 + stub 依赖后实跑。
   覆盖：① nextFreeTimeToday 窗口/占用/缓冲/过去时间 ② deleteWorkflow 全链路
   （页内确认 + 孤儿数据清理 + 最后一项重建）③ promoteNodeToToday 自动排时间+撤回。
   运行：node scripts/checks/smoke-v88.cjs */
const L = require('./lib.cjs');

console.log('== v8.8 冒烟 ==');

const pad = n => String(n).padStart(2, '0');
const stubs = {
  hmToMin: hm => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); },
  minToHm: m => pad(Math.floor(m / 60)) + ':' + pad(m % 60),
  esc: s => String(s == null ? '' : s),
  today0: () => new Date(2026, 10, 25),
  dateKey: () => '2026-11-25',
  ensureEstimate: n => { if (!n.estimateMinutes) n.estimateMinutes = 30; },
  recomputeSchedule: () => {},
  save: () => {}, saveMeta: () => {}, afterChange: () => {}, syncTreeToInput: () => {},
  showToast: () => {},
  sysNotify: () => false,
  newWorkflowId: () => 'wf_new',
  normalizeWorkflowMeta: () => {},
  applyActiveWorkflow: () => { stubs.state.nodes = stubs.state.workflows[0].nodes; },
  ensureWorkflows: () => {},
  workflowById: id => (stubs.state.workflows || []).find(w => w.id === id),
  byId: id => stubs.state.nodes.find(n => n.id === id),
  // v8.23: promoteNodeToToday 改走 setNodeDeadline + stampNodeTimeDk，grabFn 上下文必须提供
  setNodeDeadline: (n, val) => {
    n.deadline = val; n.deadlineText = val;
    n.deadlineDate = stubs.today0(); n.daysLeft = 0; n.overdue = false;
  },
  stampNodeTimeDk: (n, dk) => { if (!n) return; if (n.time) n.timeDk = dk || stubs.dateKey(); else n.timeDk = ''; },
  wfTimeWindows: wfId => (((stubs.state.meta.capacity || {})[wfId] || {}).wins || []).map(w => ({ start: w.start, end: (() => { const m = stubs.hmToMin(w.start) + w.mins; return stubs.minToHm(m); })(), mins: w.mins })),
  confirmModal: () => Promise.resolve(stubs.__confirmRet !== false),  // 经 __confirmRet 可变标志控制（buildCtx 是参数快照，事后换 stub 属性无效）
  showUndoToast: (msg, restore) => { stubs.__lastUndo = restore; },
  state: {
    activeWorkflowId: 'wf1', nodes: [],
    workflows: [
      { id: 'wf1', name: '项目A', nodes: [] },
      { id: 'wf2', name: '项目B', nodes: [] },
    ],
    meta: {
      capacity: { wf1: { wins: [{ start: '19:00', mins: 180 }] } },
      weekPlans: { '2026-W48': { rocks: [{ wfId: 'wf1', text: '石头A' }, { wfId: 'wf2', text: '石头B' }] } },
      pendingActions: [{ wfId: 'wf1', text: 'a' }, { wfId: 'wf2', text: 'b' }],
      tomorrowMit: { wfId: 'wf1', text: 'x' },
      planShare: { wf1: 30, wf2: 40 },
      habitStreaks: { 'wf1|n1': { cur: 3 }, 'wf2|n2': { cur: 5 } },
    },
    topWfId: 'wf1',
  },
};

// v8.9: deleteWorkflow 的清理块抽成 purgeWorkflowRefs（与 clearAll 共用），需一并提取
const ctx = L.buildCtx(['nextFreeTimeToday', 'promoteNodeToToday', 'purgeWorkflowRefs', 'deleteWorkflow'], stubs);

// ---- nextFreeTimeToday ----
// A：窗口 19:00–22:00 无占用，now=18:00 → 19:00
{
  stubs.state.workflows[0].nodes = []; stubs.state.workflows[1].nodes = [];
  const got = ctx.nextFreeTimeToday('wf1', 30, 18 * 60);
  got === '19:00' ? L.ok('空闲A 无占用 → 窗口起点 19:00') : L.bad('空闲A', got);
}
// B：本项目 19:00 占 30′ → 顺接 19:40（+10 缓冲）
{
  stubs.state.workflows[0].nodes = [{ id: 'x', time: '19:00', estimateMinutes: 30 }];
  const got = ctx.nextFreeTimeToday('wf1', 30, 18 * 60);
  got === '19:40' ? L.ok('空闲B 顺接已排块 → 19:40') : L.bad('空闲B', got);
}
// C：占用在【另一个项目】也要算（时间共享）
{
  stubs.state.workflows[0].nodes = [];
  stubs.state.workflows[1].nodes = [{ id: 'y', time: '19:00', estimateMinutes: 60 }];
  const got = ctx.nextFreeTimeToday('wf1', 30, 18 * 60);
  got === '20:10' ? L.ok('空闲C 跨项目占用 → 20:10') : L.bad('空闲C', got);
}
// D：窗口被占满 → null（调用方提示「窗口已满」）
{
  stubs.state.workflows[0].nodes = [{ id: 'x', time: '19:00', estimateMinutes: 170 }];
  stubs.state.workflows[1].nodes = [];
  const got = ctx.nextFreeTimeToday('wf1', 60, 18 * 60);
  got === null ? L.ok('空闲D 窗口满 → null') : L.bad('空闲D', String(got));
}
// E：现在已过窗口起点 → 从现在起排（不排过去）
{
  stubs.state.workflows[0].nodes = []; stubs.state.workflows[1].nodes = [];
  const got = ctx.nextFreeTimeToday('wf1', 30, 20 * 60);
  got === '20:00' ? L.ok('空闲E 现在 20:00 → 20:00（不排过去）') : L.bad('空闲E', got);
}

// ---- promoteNodeToToday：自动排时间 + 撤回恢复 ----
{
  stubs.state.workflows[0].nodes = [
    { id: 'root', text: '根' },
    { id: 'n1', parentId: 'root', text: ' backlog条目 ', scale: 'week', time: '', planDate: '2026-11-28T19:00', slot: '', estimateMinutes: 30 },
  ];
  stubs.state.workflows[1].nodes = [];
  stubs.state.nodes = stubs.state.workflows[0].nodes;
  const n = stubs.state.nodes.find(x => x.id === 'n1');
  ctx.promoteNodeToToday('n1');
  const okPromote = n.scale === 'day' && n.time === '19:00' && n.planDate === '';
  okPromote ? L.ok('提到今天 → scale=day · 自动排 19:00 · planDate 清空') : L.bad('提到今天', `scale=${n.scale} time=${n.time} planDate=${n.planDate}`);
  // 撤回
  if (typeof stubs.__lastUndo === 'function') stubs.__lastUndo();
  const okUndo = n.scale === 'week' && n.time === '' && n.planDate === '2026-11-28T19:00';
  okUndo ? L.ok('撤回 → scale/time/planDate 全部还原') : L.bad('撤回', `scale=${n.scale} time=${n.time} planDate=${n.planDate}`);
}

// ---- deleteWorkflow 全链路（async，实跑 await）----
(async () => {
  // 删 wf1：rocks/pendingActions/tomorrowMit/planShare/capacity/habitStreaks/topWfId 全清理，wf2 不受影响
  await ctx.deleteWorkflow('wf1');
  const s = stubs.state;
  const checks = [
    ['workflows 剩 wf2', s.workflows.length === 1 && s.workflows[0].id === 'wf2'],
    ['rocks 清 wf1 留 wf2', s.meta.weekPlans['2026-W48'].rocks.length === 1 && s.meta.weekPlans['2026-W48'].rocks[0].wfId === 'wf2'],
    ['pendingActions 清 wf1', s.meta.pendingActions.length === 1 && s.meta.pendingActions[0].wfId === 'wf2'],
    ['tomorrowMit 已清', !s.meta.tomorrowMit],
    ['planShare 清 wf1 留 wf2', !s.meta.planShare.wf1 && s.meta.planShare.wf2 === 40],
    ['capacity 清 wf1', !s.meta.capacity.wf1],
    ['habitStreaks 清 wf1| 前缀', !s.meta.habitStreaks['wf1|n1'] && !!s.meta.habitStreaks['wf2|n2']],
    ['topWfId 已清', s.topWfId === null],
  ];
  checks.forEach(([name, ok]) => ok ? L.ok('删除清理 · ' + name) : L.bad('删除清理 · ' + name, JSON.stringify({ rocks: s.meta.weekPlans, meta: s.meta }).slice(0, 120)));

  // 取消路径：confirmModal 返回 false → 什么都不动
  stubs.__confirmRet = false;
  await ctx.deleteWorkflow('wf2');
  (s.workflows.length === 1 && s.workflows[0].id === 'wf2') ? L.ok('取消删除 → 项目保留') : L.bad('取消删除', '项目被误删');

  // 最后一个项目：删空重建空白「默认目标」
  stubs.__confirmRet = true;
  await ctx.deleteWorkflow('wf2');
  const rebuilt = s.workflows.length === 1 && s.workflows[0].id === 'wf_new' && s.workflows[0].name === '默认目标' && s.workflows[0].nodes.length === 0;
  rebuilt ? L.ok('删空重建空白默认目标') : L.bad('删空重建', JSON.stringify(s.workflows));

  process.exit(L.summary('smoke-v88') ? 1 : 0);
})().catch(e => { L.bad('deleteWorkflow 冒烟异常', e.message); process.exit(L.summary('smoke-v88') ? 1 : 0); });
