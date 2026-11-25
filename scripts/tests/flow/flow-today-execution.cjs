/* 流程测试 · 今日执行之旅：
   Backlog 提到今天（自动排时）→ 撤回 → 收件箱澄清进今天 → 撤回回 inbox →
   采纳回顾行动（同流刷新）→ 采纳到另一项目（切流往返）
   运行：node scripts/tests/flow/flow-today-execution.cjs */
const L = require('../../checks/lib.cjs');

console.log('== 流程 · 今日执行 ==');

const pad = n => String(n).padStart(2, '0');
const stubs = {
  hmToMin: hm => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); },
  minToHm: m => pad(Math.floor(m / 60)) + ':' + pad(m % 60),
  esc: s => String(s == null ? '' : s),
  today0: () => new Date(2026, 10, 25),
  dateKey: () => '2026-11-25',
  ensureEstimate: n => { if (!n.estimateMinutes) n.estimateMinutes = 30; },
  recomputeSchedule: () => {}, save: () => {}, saveMeta: () => {},
  afterChange: () => { stubs.__ac++; },
  showToast: () => {}, showUndoToast: (m, r) => { stubs.__undo = r; },
  ensureScoreMeta: () => {}, ensureWorkflows: () => {},
  workflowById: id => stubs.state.workflows.find(w => w.id === id),
  switchWorkflow: id => { stubs.__sw.push(id); stubs.state.activeWorkflowId = id; const w = stubs.workflowById(id); if (w) stubs.state.nodes = w.nodes; },
  flushActiveWorkflow: () => { const w = stubs.workflowById(stubs.state.activeWorkflowId); if (w) w.nodes = stubs.state.nodes; },
  byId: id => stubs.state.nodes.find(n => n.id === id),
  appendActionLeaf: (text, opts) => { const node = { id: 'leaf' + (++stubs.__nid), parentId: 'root', text, scale: 'day', estimateMinutes: (opts && opts.est) || 30 }; stubs.state.nodes.push(node); return node; },
  wfTimeWindows: wfId => [{ start: '19:00', end: '22:00', mins: 180 }],
  __ac: 0, __sw: [], __undo: null, __nid: 0,
  state: {
    activeWorkflowId: 'wf1',
    workflows: [{ id: 'wf1', name: '主业', nodes: [] }],
    nodes: [
      { id: 'root', text: '根' },
      { id: 'bk1', parentId: 'root', text: 'Backlog 条目', scale: 'week', time: '', planDate: '2026-11-28T19:00', estimateMinutes: 30 },
    ],
    meta: { inbox: [], pendingActions: [] },
    pomo: { nodeId: null },
  },
};
stubs.state.workflows[0].nodes = stubs.state.nodes;

const ctx = L.buildCtx(['nextFreeTimeToday', 'promoteNodeToToday', 'clarifyInbox', 'adoptPendingAction'], stubs);
const s = stubs.state;

// ① Backlog 提到今天 → scale=day + 自动排 19:00 + planDate 清
ctx.promoteNodeToToday('bk1');
const n1 = s.nodes.find(n => n.id === 'bk1');
(n1.scale === 'day' && n1.time === '19:00' && n1.planDate === '')
  ? L.ok('① 提到今天 → scale=day · 自动排 19:00 · planDate 清')
  : L.bad('①', `scale=${n1.scale} time=${n1.time} planDate=${n1.planDate}`);

// ② 撤回 → 字段全部还原
if (typeof stubs.__undo === 'function') stubs.__undo();
(n1.scale === 'week' && n1.time === '' && n1.planDate === '2026-11-28T19:00')
  ? L.ok('② 撤回 → 字段全部还原') : L.bad('②', `scale=${n1.scale} time=${n1.time}`);

// ③ 收件箱澄清为任务 → 叶子入树 + 自动排 19:00 + 条目 clarified
s.meta.inbox.push({ id: 'ib1', text: '还书', status: 'inbox', deadline: '今天', deadlineDate: Date.now(), est: 20 });
ctx.clarifyInbox('ib1', 'task', 'wf1');
const leaf = s.nodes.find(n => n.text === '还书');
const it = s.meta.inbox[0];
(leaf && leaf.time === '19:00' && it.status === 'clarified' && it.wfId === 'wf1')
  ? L.ok('③ 澄清为任务 → 叶子入树 · 自动排 19:00 · clarified')
  : L.bad('③', JSON.stringify({ leaf, it }));

// ④ 撤回澄清 → 叶子移除 + 条目回 inbox
if (typeof stubs.__undo === 'function') stubs.__undo();
(!s.nodes.some(n => n.text === '还书') && it.status === 'inbox' && it.clarifiedAt === null)
  ? L.ok('④ 撤回澄清 → 叶子移除 · 条目回 inbox') : L.bad('④', JSON.stringify({ it }));

// ⑤ 采纳回顾行动（同流）→ adopted + 叶子插入 + afterChange 触发 + 不切流
stubs.__ac = 0; stubs.__sw = [];
s.meta.pendingActions.push({ id: 'pa1', wfId: 'wf1', text: '每周复盘提前到周五', status: 'pending' });
ctx.adoptPendingAction('pa1');
const p5 = s.meta.pendingActions[0].status === 'adopted'
  && s.nodes.some(n => n.text === '每周复盘提前到周五')
  && stubs.__ac >= 1 && stubs.__sw.length === 0;
p5 ? L.ok('⑤ 采纳行动（同流）→ adopted · 叶子插入 · 刷新且不切流')
  : L.bad('⑤', `ac=${stubs.__ac} sw=${stubs.__sw.length}`);

// ⑥ 采纳到另一项目 → 进目标树 + 切流往返（wf2→wf1）
s.workflows.push({ id: 'wf2', name: '副业', nodes: [{ id: 'root2', text: '根2' }] });
s.meta.pendingActions.push({ id: 'pa2', wfId: 'wf2', text: '给副业补里程碑', status: 'pending' });
ctx.adoptPendingAction('pa2');
const w2 = s.workflows.find(w => w.id === 'wf2');
const p6 = w2.nodes.some(n => n.text === '给副业补里程碑')
  && s.activeWorkflowId === 'wf1'
  && stubs.__sw.join(',') === 'wf2,wf1';
p6 ? L.ok('⑥ 采纳到副业 → 进 wf2 树 · 切流往返回原流')
  : L.bad('⑥', `sw=${stubs.__sw.join(',')} active=${s.activeWorkflowId}`);

process.exit(L.summary('flow-today-execution') ? 1 : 0);
