/* 流程测试 · 收件箱之旅：
   快速捕获（自然语言时间词 → 提醒）→ 过去时间不设提醒 → 澄清为任务（入树+自动排时）→
   撤回回 inbox → 以后再说/恢复/暂缓/丢掉 → 目标项目不存在的容错。
   运行：node scripts/tests/flow/flow-inbox.cjs */
const L = require('../../checks/lib.cjs');

console.log('== 流程 · 收件箱 ==');

const stubs = {
  ensureScoreMeta: () => {},
  saveMeta: () => {}, save: () => {}, afterChange: () => { stubs.__ac++; },
  showToast: m => { stubs.__toasts.push(m); },
  esc: s => String(s == null ? '' : s),
  today0: () => new Date(2026, 10, 25, 0, 0, 0),
  addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  parseDeadline: () => ({ label: '', date: null, daysLeft: null, overdue: false }),
  parseEstimateMinutes: () => 30,
  recomputeSchedule: () => {}, flushActiveWorkflow: () => {},
  ensureEstimate: n => { if (!n.estimateMinutes) n.estimateMinutes = 30; },
  workflowById: id => stubs.state.workflows.find(w => w.id === id),
  switchWorkflow: () => {},
  appendActionLeaf: (text) => { const node = { id: 'leaf1', parentId: 'root', text, estimateMinutes: 30 }; stubs.state.nodes.push(node); return node; },
  nextFreeTimeToday: () => '19:00',
  showUndoToast: (m, r) => { stubs.__undo = r; },
  __ac: 0, __toasts: [], __undo: null,
  state: {
    activeWorkflowId: 'wf1',
    workflows: [{ id: 'wf1', name: '主业', nodes: [{ id: 'root', text: '根' }] }],
    nodes: [{ id: 'root', text: '根' }],
    meta: { inbox: [] },
  },
};

const ctx = L.buildCtx(['addInbox', 'clarifyInbox', 'captureInboxFromText'], stubs);
const s = stubs.state;

// 固定「现在」为 2026-11-25 上午 10:00，断言提醒时间确定性
const fixedNow = new Date(2026, 10, 25, 10, 0, 0).getTime();

// ① 捕获「明天下午3点」→ 明天 15:00 提醒
let _now = Date.now; Date.now = () => fixedNow;
const it1 = ctx.captureInboxFromText('明天下午3点开评审会');
Date.now = _now;
const expectRemind = new Date(2026, 10, 26, 15, 0, 0).getTime();
(it1 && it1.remindAt === expectRemind)
  ? L.ok('① 捕获 → 「明天下午3点」= 明天 15:00 提醒') : L.bad('①', String(it1 && it1.remindAt));
(it1.status === 'inbox' && s.meta.inbox.length === 1)
  ? L.ok('① 条目入收件箱（status=inbox）') : L.bad('① 入箱', JSON.stringify(s.meta.inbox));

// ② 过去时间 → 不设提醒（今天上午 8 点已过去）
_now = Date.now; Date.now = () => fixedNow;
const it2 = ctx.captureInboxFromText('今天上午8点已经发生过的事');
Date.now = _now;
(it2 && it2.remindAt === null)
  ? L.ok('② 过去时间 → 不设提醒') : L.bad('②', String(it2 && it2.remindAt));

// ③ 澄清为任务 → 叶子入树 + 自动排 19:00 + clarified + 记录目标项目
ctx.clarifyInbox(it1.id, 'task', 'wf1');
const leaf = s.nodes.find(n => n.text === it1.text);
(leaf && leaf.time === '19:00' && it1.status === 'clarified' && it1.wfId === 'wf1')
  ? L.ok('③ 澄清为任务 → 入树 · 自动排 19:00 · clarified')
  : L.bad('③', JSON.stringify({ leaf, it: it1 }));

// ④ 撤回 → 叶子移除 + 条目回 inbox
if (typeof stubs.__undo === 'function') stubs.__undo();
(!s.nodes.some(n => n.text === it1.text) && it1.status === 'inbox' && it1.clarifiedAt === null)
  ? L.ok('④ 撤回 → 叶子移除 · 条目回待澄清') : L.bad('④', JSON.stringify(it1));

// ⑤ 其余分支：以后再说 / 恢复 / 暂缓 24h / 丢掉
ctx.clarifyInbox(it1.id, 'someday');
(it1.status === 'someday') ? L.ok('⑤ 以后再说 → someday') : L.bad('⑤ someday', it1.status);
ctx.clarifyInbox(it1.id, 'restore');
(it1.status === 'inbox' && it1.snoozeUntil === null) ? L.ok('⑤ 恢复 → inbox') : L.bad('⑤ restore', it1.status);
const before = Date.now();
ctx.clarifyInbox(it1.id, 'snooze');
(it1.snoozeUntil >= before + 86399000) ? L.ok('⑤ 暂缓 → 24 小时后再见') : L.bad('⑤ snooze', String(it1.snoozeUntil));
ctx.clarifyInbox(it1.id, 'trash');
(it1.status === 'trashed') ? L.ok('⑤ 丢掉 → trashed') : L.bad('⑤ trash', it1.status);

// ⑥ 目标项目不存在 → 提示选择项目，条目不动、不炸
stubs.__toasts = [];
s.meta.inbox.push({ id: 'ib9', text: '孤儿条目', status: 'inbox' });
ctx.clarifyInbox('ib9', 'task', 'ghost');
(stubs.__toasts.length === 1 && s.meta.inbox[1].status === 'inbox')
  ? L.ok('⑥ 目标项目不存在 → 提示 + 条目不动') : L.bad('⑥', JSON.stringify(stubs.__toasts));

process.exit(L.summary('flow-inbox') ? 1 : 0);
