/* 单元测试 · v8.16 逾期并入需要关注：splitStaleOverdue（逾期优先去重纯函数）
   口径：同一节点同时「逾期」与「停滞」时只归逾期组（更严重）；返回 {od, stale} 互不重叠；
   供 renderTodayStale 渲染与 updateTodayZones 角标计数同口径。
   运行：node scripts/tests/unit/unit-overdue.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · splitStaleOverdue ==');

const na = { id: 'a' }, nb = { id: 'b' }, nc = { id: 'c' }, nd = { id: 'd' };

// ---- 基础分组 ----
{
  const r = app.splitStaleOverdue([], []);
  L.eq('双空 → od 空', r.od.length, 0);
  L.eq('双空 → stale 空', r.stale.length, 0);
}
{
  const r = app.splitStaleOverdue([{ node: na }], [{ node: nb }]);
  L.eq('无重叠 → od 保留', r.od.length, 1);
  L.eq('无重叠 → stale 保留', r.stale.length, 1);
}

// ---- 逾期优先去重 ----
{
  const r = app.splitStaleOverdue([{ node: na }, { node: nb }], [{ node: nb }, { node: nc }]);
  L.eq('重叠 → od 全保留', r.od.length, 2);
  L.eq('重叠 → stale 去掉重复', r.stale.length, 1);
  L.eq('重叠 → stale 只剩非逾期', r.stale[0].node.id, 'a');
  const total = r.od.length + r.stale.length;
  L.eq('去重后总数 = 去重节点数', total, 3);
}

// ---- 全部重叠 ----
{
  const r = app.splitStaleOverdue([{ node: na }, { node: nb }], [{ node: na }, { node: nb }]);
  L.eq('全重叠 → stale 清空', r.stale.length, 0);
  L.eq('全重叠 → od 不动', r.od.length, 2);
}

// ---- 脏数据安全 ----
{
  const r = app.splitStaleOverdue(null, null);
  L.eq('null 双参 → od 空', r.od.length, 0);
  L.eq('null 双参 → stale 空', r.stale.length, 0);
}
{
  const r = app.splitStaleOverdue(undefined, undefined);
  L.eq('undefined 双参安全', r.od.length + r.stale.length, 0);
}
{
  // 缺 node/null 条目：无法判定重复 → 安全侧保留（不静默吞），只删确定与逾期重复的
  const r = app.splitStaleOverdue([{ node: na }, {}, null], [{ node: na }]);
  L.eq('alerts 含缺 node/null 不炸且保留', r.stale.length, 2);
  L.eq('确定重复的仍被去掉', r.stale.some(x => x && x.node && x.node.id === 'a'), false);
}
{
  const r = app.splitStaleOverdue([{ node: nd }], [{}, { node: nd }]);
  L.eq('od 含缺 node 不误删', r.stale.length, 0);
}

process.exit(L.summary('unit-overdue') ? 1 : 0);
