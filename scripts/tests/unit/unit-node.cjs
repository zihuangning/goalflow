/* 单元测试 · 节点族：ensureVE / category / isQuickWin / computeTree / treeOrder /
   subtreeProgress / metricProgress / paceStatus / serializeNodes / 停放谓词
   运行：node scripts/tests/unit/unit-node.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 节点族 ==');

// ---- ensureVE：价值/费力默认推断 ----
let n = { im: 4, text: '普通任务' }; app.ensureVE(n);
L.eq('VE 默认 val=im', n.val, 4);
L.eq('VE 默认 eff=3', n.eff, 3);
n = { im: 2, ur: 5, text: '急事' }; app.ensureVE(n);
L.eq('VE 紧急≥4 → eff 4', n.eff, 4);
n = { im: 3, text: '只需5分钟的顺手事' }; app.ensureVE(n);
L.eq('VE 「只需/5分钟」→ eff 2', n.eff, 2);
n = { im: 3, text: '深度重构整个体系' }; app.ensureVE(n);
L.eq('VE 「深度/重构/体系」→ eff 4', n.eff, 4);
n = { im: 3, val: 9, eff: 0, text: '' }; app.ensureVE(n);
L.eq('VE clamp 到 1-5', [n.val, n.eff], [5, 1]);

// ---- category 四象限 ----
const cats = [app.category(5, 5), app.category(5, 2), app.category(2, 5), app.category(2, 2)];
L.eq('四象限互不相同', new Set(cats.map(c => c.key)).size, 4);
L.eq('重要紧急 → now', app.category(4, 4).key, 'now');
L.eq('重要不紧急 → core', app.category(4, 3).key, 'core');
L.eq('不重要紧急 → distract', app.category(3, 4).key, 'distract');
L.eq('不重要不紧急 → noise', app.category(3, 3).key, 'noise');

// ---- isQuickWin ----
L.truthy('快赢 val4 eff2', app.isQuickWin({ val: 4, eff: 2 }));
L.truthy('非快赢 eff3', !app.isQuickWin({ val: 4, eff: 3 }));

// ---- computeTree + treeOrder ----
const nodes = [
  { id: 'r', text: '根' },
  { id: 'a', parentId: 'r', text: 'A' },
  { id: 'b', parentId: 'a', text: 'B' },
  { id: 'c', parentId: 'r', text: 'C' },
  { id: 'orphan', parentId: 'ghost', text: '孤儿' },
];
app.computeTree(nodes);
L.eq('computeTree _children 数量', [nodes[0]._children.length, nodes[1]._children.length], [2, 1]);
L.eq('computeTree depth', [nodes[0].depth, nodes[1].depth, nodes[2].depth], [0, 1, 2]);
L.eq('computeTree 孤儿（父不存在）不挂树', nodes[0]._children.some(x => x.id === 'orphan'), false);
L.eq('treeOrder DFS 序', app.treeOrder(nodes).map(x => x.id), ['r', 'a', 'b', 'c']);

// ---- subtreeProgress ----
nodes[2].done = true;
app.computeTree(nodes);
let p = app.subtreeProgress(nodes[0]);
L.eq('子树进度 根 1/2 → 50%', [p.done, p.total, p.pct], [1, 2, 50]);
p = app.subtreeProgress(nodes[1]);
L.eq('子树进度 A 1/1 → 100%', p.pct, 100);

// ---- metricProgress ----
let m = app.metricProgress({ targetNum: 10, targetDone: 5 });
L.eq('指标进度 5/10', [m.pct, m.over], [50, false]);
m = app.metricProgress({ targetNum: 10, targetDone: 15 });
L.eq('指标进度 超额 pct 封顶 + pctReal 保留', [m.pct, m.pctReal, m.over], [100, 150, true]);
L.eq('指标进度 无 target → null', app.metricProgress({}), null);

// ---- paceStatus：结构断言（期望值随时间线性，ahead=done-expect） ----
const ps = app.paceStatus({ targetNum: 10, targetDone: 4, deadlineDate: new Date(Date.now() + 10 * 86400000) });
L.truthy('节奏 结构（expect∈[0,tgt]，ahead=done-expect）', ps && ps.expect >= 0 && ps.expect <= 10 && ps.ahead === ps.done - ps.expect);
L.eq('节奏 无期限 → null', app.paceStatus({ targetNum: 10, targetDone: 4 }), null);

// ---- serializeNodes：持久化形状 ----
const ser = app.serializeNodes([{ id: 'x', text: 't', im: 3, ur: 3, parentId: 'r', deadlineDate: new Date(2027, 0, 1), daysLeft: 99, done: false }]);
L.eq('序列化 deadlineDate → 时间戳', ser[0].deadlineDate, new Date(2027, 0, 1).getTime());
L.truthy('序列化不含 daysLeft（派生值不占存储）', !('daysLeft' in ser[0]));
L.eq('序列化 tags 兜底 []', ser[0].tags, []);

// ---- 停放谓词 ----
L.truthy('waiting 谓词', app.isNodeWaiting({ status: 'waiting' }) && app.isNodeParked({ status: 'waiting' }));
L.truthy('blocked 谓词', app.isNodeBlocked({ status: 'blocked' }) && app.isNodeParked({ status: 'blocked' }));
L.truthy('正常节点不停放', !app.isNodeParked({ status: '' }));

process.exit(L.summary('unit-node') ? 1 : 0);
