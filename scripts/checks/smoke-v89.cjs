/* v8.9 行为冒烟：grabFn 提取真实函数 + stub 依赖后实跑。
   覆盖：① purgeNodeRefs/restoreNodeRefs 清理+还原 ② deleteNode 级联+undo 完整性
   ③ doParse 整树替换清旧引用 ④ adoptPendingAction 同流补 afterChange。
   运行：node scripts/checks/smoke-v89.cjs */
const L = require('./lib.cjs');

console.log('== v8.9 冒烟 ==');

const stubs = {
  esc: s => String(s == null ? '' : s),
  today0: () => new Date(2026, 10, 25),
  recomputeSchedule: () => {},
  save: () => {}, saveMeta: () => {}, afterChange: () => { stubs.__afterChange++; },
  showToast: () => {}, showUndoToast: (msg, restore) => { stubs.__lastUndo = restore; },
  ensureScoreMeta: () => {},
  ensureWorkflows: () => {},
  workflowById: id => (stubs.state.workflows || []).find(w => w.id === id),
  switchWorkflow: id => { stubs.__switches.push(id); },
  appendActionLeaf: (text, opts) => { stubs.state.nodes.push({ id: 'new_leaf', parentId: 'root', text, scale: opts.scale }); },
  parseText: raw => [{ id: 'm1', text: '新根（' + raw + '）' }],
  flushActiveWorkflow: () => {},
  warnIfOverCapacity: () => {},
  switchView: () => {},
  alert: () => {},
  confirmModal: () => Promise.resolve(stubs.__confirmRet !== false),
  newWorkflowId: () => 'wf_new',
  normalizeWorkflowMeta: () => {},
  localStorage: { removeItem: () => {} },
  document: { getElementById: () => ({ value: '新目标文本' }) },
  __afterChange: 0, __switches: [], __lastUndo: null, __confirmRet: true,
  state: {
    activeWorkflowId: 'wf1', topId: 'n2', topPin: 'n3',
    pomo: { active: true, nodeId: 'n3', wfId: 'wf1' },
    nodes: [
      { id: 'root', text: '根' },
      { id: 'n1', parentId: 'root', text: '分支一' },
      { id: 'n2', parentId: 'n1', text: '叶子A' },
      { id: 'n3', parentId: 'n1', text: '叶子B' },
      { id: 'n4', parentId: 'root', text: '分支二' },
    ],
    workflows: [{ id: 'wf1', name: '项目A', nodes: [] }],
    meta: {
      weekPlans: { '2026-W48': { rocks: [
        { wfId: 'wf1', nodeId: 'n2', text: '石头A' },
        { wfId: 'wf1', nodeId: 'n4', text: '石头B' },
        { wfId: 'wf2', nodeId: 'x9', text: '别的项目石头' },
      ] } },
      tomorrowMit: { forDate: '2026-11-26', wfId: 'wf1', nodeId: 'n3', text: '预选B' },
      habitStreaks: { 'wf1|n2': { cur: 3 }, 'wf1|n4': { cur: 7 }, 'wf2|x9': { cur: 1 } },
      pendingActions: [],
    },
  },
};

const ctx = L.buildCtx(['purgeNodeRefs', 'restoreNodeRefs', 'purgeCurrentTreeRefs', 'purgeWorkflowRefs', 'deleteNode', 'doParse', 'adoptPendingAction', 'clearAll'], stubs);
const s = stubs.state;

// ---- ① deleteNode 删 n1（子树 n1/n2/n3）：级联清理 + undo 完整还原 ----
ctx.deleteNode('n1');
const afterDel = [
  ['n1 子树已删（留 root+n4）', s.nodes.length === 2 && !s.nodes.some(n => n.id === 'n1')],
  ['topId 指向 n2 → 已清', s.topId === null],
  ['topPin 指向 n3 → 已清', s.topPin === null],
  ['番茄钟 nodeId n3 → 已解绑', s.pomo.nodeId === null],
  ['大石头 n2 已清（留 n4 + 别项目）', s.meta.weekPlans['2026-W48'].rocks.length === 2 && s.meta.weekPlans['2026-W48'].rocks.every(r => r.nodeId !== 'n2')],
  ['明晚预选 n3 → 已清', !s.meta.tomorrowMit],
  ['习惯打卡 wf1|n2 已清（留 n4 + 别项目）', !s.meta.habitStreaks['wf1|n2'] && s.meta.habitStreaks['wf1|n4'].cur === 7 && s.meta.habitStreaks['wf2|x9'].cur === 1],
];
afterDel.forEach(([name, ok]) => ok ? L.ok('删除级联 · ' + name) : L.bad('删除级联 · ' + name, JSON.stringify({ rocks: s.meta.weekPlans, hs: s.meta.habitStreaks }).slice(0, 140)));

if (typeof stubs.__lastUndo === 'function') stubs.__lastUndo();
const afterUndo = [
  ['n1 子树还原（5 节点）', s.nodes.length === 5],
  ['topId/topPin 还原', s.topId === 'n2' && s.topPin === 'n3'],
  ['大石头 n2 还原（3 块）', s.meta.weekPlans['2026-W48'].rocks.length === 3 && s.meta.weekPlans['2026-W48'].rocks.some(r => r.nodeId === 'n2')],
  ['明晚预选还原', !!(s.meta.tomorrowMit && s.meta.tomorrowMit.nodeId === 'n3')],
  ['习惯打卡 wf1|n2 还原', s.meta.habitStreaks['wf1|n2'] && s.meta.habitStreaks['wf1|n2'].cur === 3],
];
afterUndo.forEach(([name, ok]) => ok ? L.ok('撤销还原 · ' + name) : L.bad('撤销还原 · ' + name, JSON.stringify(s.meta).slice(0, 140)));

// ---- ② doParse 整树替换：旧 id 全清，新树就位 ----
ctx.doParse();
const afterParse = [
  ['新树就位（m1 根）', s.nodes.length === 1 && s.nodes[0].id === 'm1'],
  ['大石头全清（旧树 n2/n4 失效；别项目 x9 的 rocks 也按 nodeId 清——x9 不在旧树故保留）', s.meta.weekPlans['2026-W48'].rocks.length === 1 && s.meta.weekPlans['2026-W48'].rocks[0].wfId === 'wf2'],
  ['明晚预选已清', !s.meta.tomorrowMit],
  ['wf1 习惯打卡全清（别项目保留）', !s.meta.habitStreaks['wf1|n2'] && !s.meta.habitStreaks['wf1|n4'] && s.meta.habitStreaks['wf2|x9'].cur === 1],
  ['置顶已清', s.topPin === null],
  ['番茄钟 nodeId 已解绑', s.pomo.nodeId === null],
];
afterParse.forEach(([name, ok]) => ok ? L.ok('整树替换 · ' + name) : L.bad('整树替换 · ' + name, JSON.stringify(s.meta).slice(0, 140)));

// ---- ③ adoptPendingAction 同流：补 afterChange，不触发 switchWorkflow ----
stubs.__afterChange = 0; stubs.__switches = [];
s.nodes = [{ id: 'root', text: '根' }];
s.meta.pendingActions = [{ id: 'pa1', wfId: 'wf1', text: '回顾行动', status: 'pending' }];
ctx.adoptPendingAction('pa1');
const pa = s.meta.pendingActions[0];
const adoptChecks = [
  ['状态置 adopted', pa.status === 'adopted'],
  ['叶子已追加', s.nodes.some(n => n.id === 'new_leaf')],
  ['同流触发 afterChange（v8.9 修复点）', stubs.__afterChange >= 1],
  ['同流不触发 switchWorkflow', stubs.__switches.length === 0],
];
adoptChecks.forEach(([name, ok]) => ok ? L.ok('采纳行动 · ' + name) : L.bad('采纳行动 · ' + name, `afterChange=${stubs.__afterChange} switches=${stubs.__switches.length}`));

// ---- ④ clearAll（async）：清全流 + meta 引用；undo 全量还原 ----
(async () => {
  s.workflows = [{ id: 'wf1', name: 'A', nodes: [] }, { id: 'wf2', name: 'B', nodes: [] }];
  s.nodes = [{ id: 'root', text: '根' }];
  s.meta.weekPlans = { '2026-W48': { rocks: [{ wfId: 'wf1', nodeId: 'root', text: 'r1' }, { wfId: 'wf2', nodeId: 'x', text: 'r2' }] } };
  s.meta.habitStreaks = { 'wf1|root': { cur: 2 }, 'wf2|x': { cur: 4 } };
  s.meta.tomorrowMit = { wfId: 'wf2', nodeId: 'x', text: 't' };
  s.meta.pendingActions = [{ id: 'p1', wfId: 'wf1', text: 'a', status: 'pending' }];
  s.meta.planShare = { wf1: 30 }; s.meta.capacity = { wf2: { wins: [] } };
  s.topWfId = 'wf2'; s.pomo = { active: true, wfId: 'wf2', nodeId: 'x' };

  // 取消路径：confirmModal 返回 false → 什么都不动
  stubs.__confirmRet = false;
  await ctx.clearAll();
  (s.workflows.length === 2 && s.meta.weekPlans['2026-W48'].rocks.length === 2)
    ? L.ok('清空取消 → 一切保留') : L.bad('清空取消', '数据被误清');

  stubs.__confirmRet = true;
  await ctx.clearAll();
  const cleared = [
    ['重建空白默认项目', s.workflows.length === 1 && s.workflows[0].id === 'wf_new'],
    ['大石头清空', s.meta.weekPlans['2026-W48'].rocks.length === 0],
    ['习惯打卡清空', Object.keys(s.meta.habitStreaks).length === 0],
    ['明晚预选清空', !s.meta.tomorrowMit],
    ['待办行动清空', s.meta.pendingActions.length === 0],
    ['planShare/capacity 清空', !s.meta.planShare.wf1 && !s.meta.capacity.wf2],
    ['topWfId 清空', s.topWfId === null],
    ['番茄钟解绑', s.pomo.wfId === null && s.pomo.nodeId === null],
  ];
  cleared.forEach(([name, ok]) => ok ? L.ok('清空全部 · ' + name) : L.bad('清空全部 · ' + name, JSON.stringify(s.meta).slice(0, 140)));

  if (typeof stubs.__lastUndo === 'function') stubs.__lastUndo();
  const restored = [
    ['工作流还原 ×2', s.workflows.length === 2],
    ['大石头还原', s.meta.weekPlans['2026-W48'].rocks.length === 2],
    ['习惯打卡还原', s.meta.habitStreaks['wf2|x'] && s.meta.habitStreaks['wf2|x'].cur === 4],
    ['明晚预选还原', !!(s.meta.tomorrowMit && s.meta.tomorrowMit.wfId === 'wf2')],
  ];
  restored.forEach(([name, ok]) => ok ? L.ok('清空撤销 · ' + name) : L.bad('清空撤销 · ' + name, JSON.stringify(s.meta).slice(0, 140)));

  process.exit(L.summary('smoke-v89') ? 1 : 0);
})().catch(e => { L.bad('clearAll 冒烟异常', e.message); process.exit(L.summary('smoke-v89') ? 1 : 0); });
