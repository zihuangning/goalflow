/* 单元测试 · 时间预算 / 容量口径（v8.23）
   globalCapacityHours / weekCapGlobal / weekPlanFeasibility.global 守卫
   + setNodeDeadline 五字段（与 promote/append 唯一写入口同口径）
   运行：node scripts/tests/unit/unit-capacity.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 时间预算与容量 ==');

const state = app.__testState();
const snap = {
  meta: state.meta,
  workflows: state.workflows,
  activeWorkflowId: state.activeWorkflowId,
  nodes: state.nodes,
  topId: state.topId,
};

function resetCapState(opts) {
  opts = opts || {};
  state.meta = { capacity: opts.capacity || {} };
  state.workflows = opts.workflows || [
    { id: 'wf1', name: 'A', nodes: [], topId: null, archived: false },
    { id: 'wf2', name: 'B', nodes: [], topId: null, archived: false },
  ];
  state.activeWorkflowId = 'wf1';
  state.nodes = state.workflows[0].nodes;
  state.topId = null;
}

// ---- 无全局 wins → globalCapacityHours null，weekPlanFeasibility.global=false ----
resetCapState({ capacity: {} });
L.eq('无全局 → globalCapacityHours null', app.globalCapacityHours(), null);
{
  const f = app.weekPlanFeasibility();
  L.eq('无全局 → f.global false', f.global, false);
  // over 可能为 true（est vs 回落单项目 cap），但 warn 守卫只在 f.global 时弹全局窗
  L.truthy('无全局时 cap 仍为数字', typeof f.cap === 'number' && f.cap > 0);
}

// ---- 有 workday/weekend wins → global true，cap = wins 周分钟 ----
resetCapState({
  capacity: {
    globalWorkdayWins: [{ start: '09:00', mins: 240 }], // 4h
    globalWeekendWins: [{ start: '10:00', mins: 120 }], // 2h
  },
});
{
  const g = app.globalCapacityHours();
  L.truthy('有 wins → globalCapacityHours 非 null', !!g);
  L.eq('工作日合计 4h', g.workday, 4);
  L.eq('周末合计 2h', g.weekend, 2);
  const expectCap = Math.round((4 * 5 + 2 * 2) * 60); // 24h → 1440′
  L.eq('weekCapGlobal = wins 周分钟', app.weekCapGlobal(), expectCap);
  const f = app.weekPlanFeasibility();
  L.eq('有全局 → f.global true', f.global, true);
  L.eq('有全局 → f.cap === weekCapGlobal', f.cap, expectCap);
}

// ---- 旧小时字段回落（无 wins 数组时）----
resetCapState({
  capacity: { globalWorkdayHours: 6, globalWeekendHours: 3 },
});
{
  const g = app.globalCapacityHours();
  L.eq('旧字段回落 workday 6', g && g.workday, 6);
  L.eq('旧字段回落 weekend 3', g && g.weekend, 3);
  L.eq('旧字段 weekCapGlobal', app.weekCapGlobal(), Math.round((6 * 5 + 3 * 2) * 60));
}

// ---- setNodeDeadline 五字段（promote/append 共用入口）----
{
  const n = {};
  app.setNodeDeadline(n, '今天');
  L.eq('今天 deadline 标签', n.deadline, '今天');
  L.eq('今天 deadlineText 同步', n.deadlineText, '今天');
  L.eq('今天 daysLeft=0', n.daysLeft, 0);
  L.eq('今天不逾期', n.overdue, false);
  L.truthy('今天有 deadlineDate', n.deadlineDate instanceof Date && !isNaN(+n.deadlineDate));
}
{
  const n = {};
  const dk = L.dkOf(L.daysAgo(-5));
  app.setNodeDeadline(n, dk);
  L.eq('绝对日期 daysLeft=5', n.daysLeft, 5);
  L.eq('绝对日期 label=dk', n.deadline, dk);
}
{
  const n = { deadline: '残留', deadlineText: '残留', deadlineDate: new Date(), daysLeft: 3, overdue: false };
  app.setNodeDeadline(n, '');
  L.truthy('清空六字段', !n.deadline && !n.deadlineText && n.deadlineDate === null && n.daysLeft === null && n.overdue === false);
}

// 恢复（避免污染同进程其它用例；run.cjs 本就是独立进程）
state.meta = snap.meta;
state.workflows = snap.workflows;
state.activeWorkflowId = snap.activeWorkflowId;
state.nodes = snap.nodes;
state.topId = snap.topId;

process.exit(L.summary('unit-capacity') ? 1 : 0);
