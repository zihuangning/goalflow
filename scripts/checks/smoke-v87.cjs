/* v8.7 行为冒烟：grabFn 提取真实函数 + stub 依赖后实跑。
   覆盖：① todayExecutionPoolFor 的「planDate 未来排除」（v8.7 根因修复——backfill 排到明天的
   任务带 daysLeft=1/scale=day，旧版被拉回今天且无时间）② templateHasSchedule 递归判定。
   运行：node scripts/checks/smoke-v87.cjs */
const L = require('./lib.cjs');

console.log('== v8.7 冒烟 ==');

const TODAY = new Date(2026, 10, 25); // 固定“今天” 2026-11-25（周三）
const dkOf = d => {
  const x = d ? new Date(d) : TODAY;
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
const dayShift = n => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return dkOf(d); };

const stubs = {
  // computeTree 最小桩：所有节点 _children=[]（传入的都是叶子）、depth=0
  computeTree: nodes => nodes.forEach(n => { n._children = n._children || []; n.depth = 0; }),
  buildView: nodes => nodes,
  pickRanked: () => [],
  isRecurringTask: n => !!n.recur,
  recurringTaskDueToday: () => true,
  habitDueToday: () => true,
  focusScore: () => 0,
  isQuickWin: () => false,
  isNodeParked: () => false,
  ensureEstimate: () => {},
  dayCap: () => 9999,
  dateKey: d => dkOf(d),
};

const ctx = L.buildCtx(['todayExecutionPoolFor', 'templateHasSchedule'], stubs);
const leaf = (id, extra) => Object.assign({ id, parentId: 'p1', text: 't' + id }, extra || {});
const inPool = n => ctx.todayExecutionPoolFor([n]).some(x => x.id === n.id);

// 场景 A：backfill 排到明天的任务（planDate=明天 + deadline=明天 + daysLeft=1 + scale=day）
// —— 旧版被 daysLeft<=1 / scale=day 条款拉进今天且无 time（用户：今日执行混进第二天的）
{
  const n = leaf('a', { planDate: dayShift(1) + 'T19:00', daysLeft: 1, scale: 'day', estimateMinutes: 60 });
  !inPool(n)
    ? L.ok('场景A 排期=明天（planDate）→ 不进今日池')
    : L.bad('场景A 排期明天', '不应进今日池');
}

// 场景 B：用户手动设的「明天到期」（无 planDate）→ 保留「明天到期今天做」设计
{
  const n = leaf('b', { daysLeft: 1, scale: 'day', estimateMinutes: 60 });
  inPool(n)
    ? L.ok('场景B 明天到期（无 planDate）→ 仍进今日池')
    : L.bad('场景B 明天到期', '应进今日池');
}

// 场景 C：今天有 time → 正常进入
{
  const n = leaf('c', { time: '19:00', scale: 'day', estimateMinutes: 30 });
  inPool(n)
    ? L.ok('场景C 今日有 time → 进今日池')
    : L.bad('场景C 今日 time', '应进今日池');
}

// 场景 D：planDate=今天（边界：pdk == 今天不排除）+ time → 进入
{
  const n = leaf('d', { planDate: dkOf() + 'T19:00', time: '19:00', scale: 'day', estimateMinutes: 30 });
  inPool(n)
    ? L.ok('场景D planDate=今天 → 不排除')
    : L.bad('场景D planDate 今天', '应进今日池');
}

// 场景 E：planDate=昨天（错过的排期）+ 逾期 → 仍进今日池（要补救）
{
  const n = leaf('e', { planDate: dayShift(-1) + 'T19:00', daysLeft: -1, overdue: true, scale: 'day', estimateMinutes: 30 });
  inPool(n)
    ? L.ok('场景E planDate=昨天+逾期 → 仍进今日池补救')
    : L.bad('场景E 逾期排期', '应进今日池');
}

// 场景 F：planDate=后天 + 快赢估时（≤10min 条款也救不回来——排除判断在最前）
{
  const n = leaf('f', { planDate: dayShift(2) + 'T19:00', daysLeft: 2, scale: 'week', estimateMinutes: 5 });
  !inPool(n)
    ? L.ok('场景F 排期=后天+快赢估时 → 仍不进今日池')
    : L.bad('场景F 后天快赢', '不应进今日池');
}

// ---- templateHasSchedule ----
(ctx.templateHasSchedule({ tasks: [{ text: 'x', estimate: 30 }] }) === false)
  ? L.ok('templateHasSchedule 无时间 → false') : L.bad('templateHasSchedule 无时间', '应为 false');
(ctx.templateHasSchedule({ tasks: [{ text: 'x', children: [{ text: 'y', date: '2026-11-26' }] }] }) === true)
  ? L.ok('templateHasSchedule 嵌套 children 含 date → true') : L.bad('templateHasSchedule 嵌套', '应为 true');
(ctx.templateHasSchedule({ tasks: [{ text: 'x', start: '19:00' }] }) === true)
  ? L.ok('templateHasSchedule 含 start → true') : L.bad('templateHasSchedule start', '应为 true');
(ctx.templateHasSchedule(null) === false)
  ? L.ok('templateHasSchedule null → false') : L.bad('templateHasSchedule null', '应为 false');

process.exit(L.summary('smoke-v87') ? 1 : 0);
