/* v8.10 行为冒烟：grabFn 提取真实函数 + stub 依赖后实跑。
   覆盖：① setNodeDone 勾选/取消对称性（executionLog 回滚 + 出口统一 saveMeta）
   ② refreshTodayIfNeeded 跨午夜（TODAY 刷新 + 到期 planDate 转 time）
   ③ deleteTodayNode 统一走 deleteNode（跨流临时切换 + 根保护）
   ④ reconcileRefsAfterRestore 清孤儿引用（脏才落盘）
   ⑤ restoreSnapshot / importBackupText 页内确认取消与确认路径（async）
   运行：node scripts/checks/smoke-v810.cjs */
const L = require('./lib.cjs');

console.log('== v8.10 冒烟 ==');

const pad = n => String(n).padStart(2, '0');
const dkOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NOW = new Date();
const YEST = new Date(NOW); YEST.setDate(YEST.getDate() - 1);
const TMR = new Date(NOW); TMR.setDate(TMR.getDate() + 1);

(async () => {

// ---------- ① F1/F2：setNodeDone 勾选 → 取消 → 再勾 的对称性 ----------
const stubs = {
  state: {
    activeWorkflowId: 'wf1', topId: null,
    nodes: [
      { id: 'root', text: '根' },
      { id: 'n1', parentId: 'root', text: '每天阅读30分钟', role: 'habit', targetNum: 0 },
    ],
    workflows: [{ id: 'wf1', name: '项目A', nodes: [] }],
    meta: { executionLog: {}, habitStreaks: {}, dailyCompletions: {} },
  },
  __saveMeta: 0, __streakCalls: [], __habitLogs: [],
  isRecurringTask: () => false,
  dateKey: d => dkOf(d || NOW),
  today0: () => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()),
  addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  workflowById: id => (stubs.state.workflows || []).find(w => w.id === id),
  bumpDailyCompletion: () => { const dk = stubs.dateKey(); const dc = stubs.state.meta.dailyCompletions; dc[dk] = (dc[dk] || 0) + 1; },
  appendScore: () => {},          // 真身内部有 saveMeta；这里 stub 掉以验证「出口统一 saveMeta」不靠它
  removeTodayScore: () => {},
  updateHabitStreak: (n, wfId, checked) => { stubs.__streakCalls.push(checked); stubs.state.meta.habitStreaks[wfId + '|' + n.id] = { cur: checked ? 1 : 0 }; },
  logHabitCheck: (n, wfId, checked) => { stubs.__habitLogs.push(checked); },
  isUnderTopNode: () => false,
  goldChainIds: () => new Set(),
  getCachedTree: nodes => { nodes.forEach(x => x._children = nodes.filter(y => y.parentId === x.id)); return nodes; },
  saveMeta: () => { stubs.__saveMeta++; },
};
const ctx = L.buildCtx(['setNodeDone', 'appendExecutionLog', 'removeExecutionLogEntry', 'isHabitLike', 'nodeHabitKey'], stubs);
const s = stubs.state;
const n1 = s.nodes[1];
const dk = dkOf(NOW);

ctx.setNodeDone(n1, true);
let log = s.meta.executionLog[dk];
[
  ['勾选 · entries +1', log.entries.length === 1],
  ['勾选 · byWorkflow wf1=1', log.byWorkflow.wf1 === 1],
  ['勾选 · completedCount=1', log.completedCount === 1],
  ['勾选 · dailyCompletions=1', s.meta.dailyCompletions[dk] === 1],
  ['勾选 · entry 标 habit（role=habit）', log.entries[0].habit === true],
  ['勾选 · 习惯更新以 true 调用', stubs.__streakCalls.join() === 'true' && stubs.__habitLogs.join() === 'true'],
  ['勾选 · 出口 saveMeta 被调（stub 掉的 appendScore 不再代劳）', stubs.__saveMeta >= 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify(log).slice(0, 120)));

stubs.__saveMeta = 0;
ctx.setNodeDone(n1, false);
log = s.meta.executionLog[dk];
[
  ['取消 · entries 回滚为 0', log.entries.length === 0],
  ['取消 · byWorkflow 回退 0', log.byWorkflow.wf1 === 0],
  ['取消 · completedCount 回退 0', log.completedCount === 0],
  ['取消 · dailyCompletions 回退', (s.meta.dailyCompletions[dk] || 0) === 0],
  ['取消 · done/doneAt 复位', n1.done === false && n1.doneAt === null],
  ['取消 · 习惯更新以 false 调用', stubs.__streakCalls.join() === 'true,false' && stubs.__habitLogs.join() === 'true,false'],
  ['取消 · 出口 saveMeta 被调（F1：streak 回滚不落盘修复）', stubs.__saveMeta >= 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify(log).slice(0, 120)));

// 勾 → 另一节点也完成 → 取消 n1：只删 n1 的最新一条，别人的不动
ctx.setNodeDone(n1, true);                                    // entries: [A(n1)]
ctx.appendExecutionLog('wf1', { id: 'nX', text: '别的任务', im: 3, ur: 3 }); // entries: [A, B(nX)]
ctx.setNodeDone(n1, false);                                   // 应删 A 留 B
log = s.meta.executionLog[dk];
[
  ['再勾再取消 · n1 的记录被删', log.entries.every(e => e.nodeId !== 'n1')],
  ['再勾再取消 · 别的节点记录保留', log.entries.length === 1 && log.entries[0].nodeId === 'nX'],
  ['再勾再取消 · completedCount=1（只回退一条）', log.completedCount === 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify(log).slice(0, 120)));

// ---------- ② F3：refreshTodayIfNeeded 跨午夜 ----------
const stubs3 = {
  TODAY: YEST,                  // 模块级 TODAY 形参：假装页面是昨天打开的
  state: {
    workflows: [
      { id: 'wf1', nodes: [
        { id: 'r', text: '根' },
        { id: 'p1', parentId: 'r', text: '昨晚排期', planDate: dkOf(YEST) + 'T19:00', time: '' },
        { id: 'p2', parentId: 'r', text: '明天排期', planDate: dkOf(TMR) + 'T09:00', time: '' },
        { id: 'p3', parentId: 'r', text: '已完成不动', planDate: dkOf(YEST) + 'T10:00', time: '', done: true },
      ] },
      { id: 'wf2', nodes: [
        { id: 'x', text: '别流根' },
        { id: 'q1', parentId: 'x', text: '别流昨晚排期', planDate: dkOf(YEST) + 'T21:30', time: '' },
      ] },
    ],
  },
  dateKey: d => dkOf(d || stubs3.TODAY),   // dateKey() 无参读模块 TODAY（=昨天）
  save: () => { stubs3.__save++; },
  afterChange: () => { stubs3.__afterChange++; },
  __save: 0, __afterChange: 0,
};
const ctx3 = L.buildCtx(['refreshTodayIfNeeded', 'convertDuePlanDate'], stubs3);
const w1 = stubs3.state.workflows[0].nodes;
const w2 = stubs3.state.workflows[1].nodes;

const changed = ctx3.refreshTodayIfNeeded();
// 注：TODAY=now 写的是 buildCtx 闭包内形参，不会回写 stubs3.TODAY（参数快照）——
// 「TODAY 已刷新」由 p1 转换生效间接证明，TODAY=now 的源码断言在 verify-v810。
[
  ['换天 · 返回 true', changed === true],
  ['换天 · save+afterChange 各一次', stubs3.__save === 1 && stubs3.__afterChange === 1],
  ['换天 · 到期 planDate 转 time（p1）', w1[1].planDate === '' && w1[1].time === '19:00'],
  ['换天 · 未来 planDate 不动（p2）', w1[2].planDate === dkOf(TMR) + 'T09:00' && w1[2].time === ''],
  ['换天 · 已完成节点不动（p3）', w1[3].planDate === dkOf(YEST) + 'T10:00'],
  ['换天 · 别的目标流也一起转（q1）', w2[1].planDate === '' && w2[1].time === '21:30'],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify({ p1: w1[1], p2: w1[2], q1: w2[1] }).slice(0, 160)));

// 同一天：不再触发
const stubs3b = {
  TODAY: NOW, state: { workflows: [] },
  dateKey: d => dkOf(d || stubs3b.TODAY),
  save: () => { stubs3b.__save++; }, afterChange: () => { stubs3b.__afterChange++; },
  __save: 0, __afterChange: 0,
};
const ctx3b = L.buildCtx(['refreshTodayIfNeeded', 'convertDuePlanDate'], stubs3b);
const same = ctx3b.refreshTodayIfNeeded();
[
  ['同一天 · 返回 false', same === false],
  ['同一天 · 不落盘不重渲染', stubs3b.__save === 0 && stubs3b.__afterChange === 0],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name));

// ---------- ③ F6：deleteTodayNode 统一走 deleteNode ----------
const stubs6 = {
  state: {
    activeWorkflowId: 'wf1',
    workflows: [
      { id: 'wf1', nodes: [{ id: 'r1' }, { id: 'a', parentId: 'r1' }] },
      { id: 'wf2', nodes: [{ id: 'r2' }, { id: 'b', parentId: 'r2' }] },
    ],
  },
  workflowById: id => stubs6.state.workflows.find(w => w.id === id),
  switchWorkflow: id => { stubs6.__switches.push(id); stubs6.state.activeWorkflowId = id; },
  deleteNode: id => { stubs6.__deleted.push(id); },
  __switches: [], __deleted: [],
};
const ctx6 = L.buildCtx(['deleteTodayNode'], stubs6);

ctx6.deleteTodayNode('wf2', 'b');
[
  ['跨流删除 · 经 deleteNode 级联', stubs6.__deleted.join() === 'b'],
  ['跨流删除 · 临时切到 wf2 再切回 wf1', stubs6.__switches.join() === 'wf2,wf1'],
  ['跨流删除 · 当前流还原', stubs6.state.activeWorkflowId === 'wf1'],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, `switches=${stubs6.__switches} deleted=${stubs6.__deleted}`));

ctx6.deleteTodayNode('wf1', 'a');
[
  ['同流删除 · 经 deleteNode', stubs6.__deleted.join() === 'b,a'],
  ['同流删除 · 不触发切换', stubs6.__switches.join() === 'wf2,wf1'],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, `switches=${stubs6.__switches}`));

ctx6.deleteTodayNode('wf1', 'r1');
[
  ['根保护 · 根节点不可删', stubs6.__deleted.join() === 'b,a'],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name));

// ---------- ④ F8：reconcileRefsAfterRestore 清孤儿 ----------
const stubs8 = {
  state: {
    workflows: [
      { id: 'wf1', nodes: [{ id: 'r' }, { id: 'live' }] },
      { id: 'wf2', nodes: [{ id: 'x' }] },
    ],
    meta: {
      weekPlans: { '2026-W48': { rocks: [
        { wfId: 'wf1', nodeId: 'live', text: '活石头' },
        { wfId: 'wf1', nodeId: 'dead', text: '节点没了' },
        { wfId: 'wf3', nodeId: 'ghost', text: '流都没了' },
      ] } },
      tomorrowMit: { wfId: 'wf2', nodeId: 'gone', text: '死预选' },
      habitStreaks: { 'wf1|live': { cur: 5 }, 'wf1|dead': { cur: 2 }, 'wf9|zzz': { cur: 1 } },
    },
  },
  ensureScoreMeta: () => {},
  saveMeta: () => { stubs8.__saveMeta++; },
  __saveMeta: 0,
};
const ctx8 = L.buildCtx(['reconcileRefsAfterRestore'], stubs8);
const m8 = stubs8.state.meta;

ctx8.reconcileRefsAfterRestore();
[
  ['清孤儿 · 活石头保留', m8.weekPlans['2026-W48'].rocks.length === 1 && m8.weekPlans['2026-W48'].rocks[0].nodeId === 'live'],
  ['清孤儿 · 死节点/死流的石头移除', m8.weekPlans['2026-W48'].rocks.every(r => r.nodeId !== 'dead' && r.wfId !== 'wf3')],
  ['清孤儿 · 明晚预选置空', m8.tomorrowMit === null],
  ['清孤儿 · 活习惯保留（wf1|live）', m8.habitStreaks['wf1|live'] && m8.habitStreaks['wf1|live'].cur === 5],
  ['清孤儿 · 死习惯移除', !m8.habitStreaks['wf1|dead'] && !m8.habitStreaks['wf9|zzz']],
  ['清孤儿 · 有变更落盘一次', stubs8.__saveMeta === 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify(m8).slice(0, 160)));

ctx8.reconcileRefsAfterRestore();
[
  ['再跑一次 · 无孤儿不重复落盘', stubs8.__saveMeta === 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, 'saveMeta=' + stubs8.__saveMeta));

// ---------- ⑤ F4/F7：restoreSnapshot + importBackupText 取消/确认路径 ----------
const stubs7 = {
  state: { workflows: [], activeWorkflowId: null, nodes: [], meta: {} },
  listSnapshots: () => [{ at: 111, payload: '{"workflows":[]}' }],
  parseWorkflowsJson: () => ({ workflows: [{ id: 'wfN', nodes: [{ id: 'nr' }] }] }),
  confirmModal: () => Promise.resolve(stubs7.__confirm),
  applyWorkflowsData: res => { stubs7.state.workflows = res.workflows; stubs7.__applied++; },
  reconcileRefsAfterRestore: () => { stubs7.__reconciled++; },
  save: () => {}, afterChange: () => { stubs7.__afterChange++; },
  showToast: () => {},
  __confirm: true, __applied: 0, __reconciled: 0, __afterChange: 0,
};
const ctx7 = L.buildCtx(['restoreSnapshot'], stubs7);

stubs7.__confirm = false;
await ctx7.restoreSnapshot(111);
[
  ['快照取消 · 不应用数据', stubs7.__applied === 0],
  ['快照取消 · 不清引用不重渲染', stubs7.__reconciled === 0 && stubs7.__afterChange === 0],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name));

stubs7.__confirm = true;
await ctx7.restoreSnapshot(111);
[
  ['快照确认 · 数据已应用', stubs7.__applied === 1 && stubs7.state.workflows[0].id === 'wfN'],
  ['快照确认 · 清孤儿引用（F8）', stubs7.__reconciled === 1],
  ['快照确认 · 重渲染', stubs7.__afterChange === 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name));

const stubs9 = {
  state: { workflows: [], nodes: [], activeWorkflowId: null, meta: { habitStreaks: {} }, viewMode: 'sankey' },
  confirmModal: () => Promise.resolve(stubs9.__confirm),
  alert: () => {},
  newWorkflowId: () => 'wf_new',
  normalizeNode: n => n,
  normalizeWorkflowMeta: () => {},
  applyActiveWorkflow: () => { stubs9.state.nodes = stubs9.state.workflows[0].nodes; },
  ensureWorkflows: () => {},
  recomputeSchedule: () => {},
  reconcileRefsAfterRestore: () => { stubs9.__reconciled++; },
  save: () => { stubs9.__save++; },
  saveMeta: () => { stubs9.__saveMeta++; },
  afterChange: () => { stubs9.__afterChange++; },
  __confirm: true, __reconciled: 0, __save: 0, __saveMeta: 0, __afterChange: 0,
};
const ctx9 = L.buildCtx(['importBackupText'], stubs9);
// 真实备份格式：顶层 nodes（当前流节点数组，校验用）+ workflows + meta
const backup = JSON.stringify({
  nodes: [{ id: 'br', text: '备份根' }],
  workflows: [{ id: 'wfB', name: '备份流', nodes: [{ id: 'br', text: '备份根' }] }],
  meta: { habitStreaks: { 'wfB|br': { cur: 9 } } },
  activeWorkflowId: 'wfB',
});

stubs9.__confirm = false;
await ctx9.importBackupText(backup);
[
  ['备份取消 · 不落盘不应用', stubs9.__save === 0 && stubs9.state.workflows.length === 0],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name));

stubs9.__confirm = true;
await ctx9.importBackupText(backup);
[
  ['备份确认 · 工作流恢复', stubs9.state.workflows.length === 1 && stubs9.state.workflows[0].id === 'wfB'],
  ['备份确认 · meta 合并进来', stubs9.state.meta.habitStreaks['wfB|br'] && stubs9.state.meta.habitStreaks['wfB|br'].cur === 9],
  ['备份确认 · 清孤儿引用（F8）', stubs9.__reconciled === 1],
  ['备份确认 · saveMeta 落盘（F4：刷新不再读回旧 meta）', stubs9.__saveMeta >= 1],
  ['备份确认 · 重渲染', stubs9.__afterChange === 1],
].forEach(([name, ok]) => ok ? L.ok(name) : L.bad(name, JSON.stringify(stubs9.state.meta).slice(0, 120)));

process.exit(L.summary('smoke-v810') ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
