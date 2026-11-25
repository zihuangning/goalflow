/* 流程测试 · 项目全生命周期：
   解析目标 → 加引用 → 模板整树替换（清旧引用）→ 删节点（级联+撤销）→ 删项目（级联）→ 清空全部（撤销）
   验证 v8.9 三级引用清理体系在真实串联下的数据同步。
   运行：node scripts/tests/flow/flow-goal-lifecycle.cjs */
const L = require('../../checks/lib.cjs');

console.log('== 流程 · 项目全生命周期 ==');

let nid = 0;
const stubs = {
  esc: s => String(s == null ? '' : s),
  today0: () => new Date(2026, 10, 25),
  dateKey: () => '2026-11-25',
  recomputeSchedule: () => {}, save: () => {}, saveMeta: () => {}, afterChange: () => {},
  syncTreeToInput: () => {},
  showToast: () => {}, showUndoToast: (m, r) => { stubs.__undo = r; },
  sysNotify: () => false,
  confirmModal: () => Promise.resolve(true),
  newWorkflowId: () => 'wf_new',
  normalizeWorkflowMeta: () => {},
  ensureWorkflows: () => {},
  workflowById: id => (stubs.state.workflows || []).find(w => w.id === id),
  applyActiveWorkflow: () => { const w = stubs.state.workflows[0]; stubs.state.nodes = w ? w.nodes : []; stubs.state.activeWorkflowId = w ? w.id : null; },
  flushActiveWorkflow: () => { const w = stubs.state.workflows.find(x => x.id === stubs.state.activeWorkflowId); if (w) w.nodes = stubs.state.nodes; },
  switchWorkflow: id => { stubs.state.activeWorkflowId = id; const w = stubs.workflowById(id); if (w) stubs.state.nodes = w.nodes; },
  parseText: raw => [{ id: 'p1', text: raw + '（根）' }, { id: 'p2', parentId: 'p1', text: '旧子任务' }],
  newNode: p => Object.assign({ id: 't' + (++nid) }, p),
  setNodeDeadline: () => {},
  insertAITasks: (rootId, tasks) => { (tasks || []).forEach((t, i) => stubs.state.nodes.push({ id: 'tpl' + i, parentId: rootId, text: t.text || ('模板任务' + i) })); },
  showAIResultModal: () => {}, warnIfOverCapacity: () => {}, switchView: () => {}, alert: () => {},
  document: { getElementById: () => ({ value: '年度目标' }) },
  localStorage: { removeItem: () => {} },
  __undo: null,
  state: {
    activeWorkflowId: 'wf1', nodes: [], topId: null, topPin: null,
    pomo: { active: false, nodeId: null, wfId: null },
    workflows: [{ id: 'wf1', name: '主业', nodes: [] }],
    meta: { weekPlans: {}, habitStreaks: {}, pendingActions: [] },
  },
};

const ctx = L.buildCtx(['purgeNodeRefs', 'restoreNodeRefs', 'purgeCurrentTreeRefs', 'purgeWorkflowRefs', 'doParse', 'applyWorkflowTemplate', 'deleteNode', 'deleteWorkflow', 'clearAll'], stubs);
const s = stubs.state;

// ① 解析目标 → 树就位
ctx.doParse();
(s.nodes.length === 2 && s.nodes[0].id === 'p1')
  ? L.ok('① 解析目标 → 树就位（根+1子）') : L.bad('① 解析', JSON.stringify(s.nodes));

// ② 手工加引用：大石头 / 习惯打卡 / 置顶
s.meta.weekPlans['2026-W48'] = { rocks: [{ wfId: 'wf1', nodeId: 'p2', text: '石头' }] };
s.meta.habitStreaks['wf1|p2'] = { cur: 5 };
s.topPin = 'p2';

// ③ 模板整树替换 → 新树就位 + 旧引用全清
ctx.applyWorkflowTemplate({ icon: '📚', name: '学习', tasks: [{ text: '任务A' }, { text: '任务B' }] }, { name: '学习' }, { silent: true });
const step3 = s.nodes.length === 3
  && s.meta.weekPlans['2026-W48'].rocks.length === 0
  && !s.meta.habitStreaks['wf1|p2']
  && s.topPin === null;
step3 ? L.ok('③ 模板替换 → 新树就位 + 旧引用（石头/打卡/置顶）全清')
  : L.bad('③ 模板替换', JSON.stringify({ n: s.nodes.length, rocks: s.meta.weekPlans, pin: s.topPin }));

// ④ 删除模板子节点 → 级联清石头；撤销 → 一并还原
s.meta.weekPlans['2026-W48'].rocks.push({ wfId: 'wf1', nodeId: 'tpl0', text: '模板石头' });
ctx.deleteNode('tpl0');
const step4 = s.nodes.length === 2 && s.meta.weekPlans['2026-W48'].rocks.length === 0;
step4 ? L.ok('④ 删节点 → 级联清石头') : L.bad('④ 删节点', JSON.stringify(s.meta.weekPlans));
if (typeof stubs.__undo === 'function') stubs.__undo();
const step4u = s.nodes.length === 3 && s.meta.weekPlans['2026-W48'].rocks.length === 1;
step4u ? L.ok('④ 撤销 → 节点与石头一并还原') : L.bad('④ 撤销', JSON.stringify({ n: s.nodes.length, rocks: s.meta.weekPlans['2026-W48'].rocks.length }));

(async () => {
  // ⑤ 删除最后一个项目 → 重建空白默认 + 石头清空
  await ctx.deleteWorkflow('wf1');
  const step5 = s.workflows.length === 1 && s.workflows[0].id === 'wf_new'
    && s.meta.weekPlans['2026-W48'].rocks.length === 0;
  step5 ? L.ok('⑤ 删项目（最后一个）→ 重建空白默认 + 石头清空')
    : L.bad('⑤ 删项目', JSON.stringify({ wf: s.workflows.length, rocks: s.meta.weekPlans }));

  // ⑥ 恢复数据后清空全部 → 引用全清；撤销 → 全量还原
  s.workflows = [{ id: 'wf9', name: 'X', nodes: [{ id: 'r9', text: '根' }] }];
  s.activeWorkflowId = 'wf9'; s.nodes = s.workflows[0].nodes;
  s.meta.tomorrowMit = { wfId: 'wf9', nodeId: 'r9' };
  s.meta.habitStreaks['wf9|r9'] = { cur: 2 };
  await ctx.clearAll();
  const step6 = s.workflows.length === 1 && s.workflows[0].id === 'wf_new'
    && !s.meta.tomorrowMit && Object.keys(s.meta.habitStreaks).length === 0;
  step6 ? L.ok('⑥ 清空全部 → 重建 + 引用全清') : L.bad('⑥ 清空', JSON.stringify(s.meta));
  if (typeof stubs.__undo === 'function') stubs.__undo();
  const step6u = s.workflows.length === 1 && s.workflows[0].id === 'wf9'
    && s.meta.tomorrowMit && s.meta.habitStreaks['wf9|r9'].cur === 2;
  step6u ? L.ok('⑥ 撤销清空 → 工作流与 meta 全量还原') : L.bad('⑥ 撤销', JSON.stringify({ wf: s.workflows, meta: s.meta }));

  process.exit(L.summary('flow-goal-lifecycle') ? 1 : 0);
})().catch(e => { L.bad('流程异常', e.message); process.exit(L.summary('flow-goal-lifecycle') ? 1 : 0); });
