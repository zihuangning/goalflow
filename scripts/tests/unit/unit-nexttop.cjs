/* 单元测试 · v8.13 英雄卡去重：pickNextTopId（清单「② 次重要」纯函数）
   口径：今日执行池里 focusScore 最高的一条；排除 MIT 自身 / 已完成 / 溢出沉底；并列取先出现者。
   运行：node scripts/tests/unit/unit-nexttop.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · pickNextTopId ==');

const a = { id: 'a', im: 5 };            // 54 分
const b = { id: 'b', im: 3 };            // 30 分
const c = { id: 'c', im: 4 };            // 42 分
const pool = [{ node: b }, { node: a }, { node: c }];

// ---- 基础 ----
L.eq('空池 → null', app.pickNextTopId([], null), null);
L.eq('null 入参 → null', app.pickNextTopId(null, null), null);
L.eq('undefined 入参 → null', app.pickNextTopId(undefined, 'x'), null);
L.eq('单条当选', app.pickNextTopId([{ node: b }], null), 'b');
L.eq('多条取算法分最高', app.pickNextTopId(pool, null), 'a');

// ---- 排除 MIT 自身 ----
L.eq('排除 MIT 后取次高', app.pickNextTopId(pool, 'a'), 'c');
L.eq('排除不存在 id 不影响', app.pickNextTopId(pool, 'zzz'), 'a');

// ---- done / 溢出跳过 ----
L.eq('done 节点跳过', app.pickNextTopId([{ node: { id: 'a', im: 5, done: true } }, { node: c }], null), 'c');
L.eq('溢出节点跳过（分再高也不当 ②）', app.pickNextTopId([{ node: { id: 'a', im: 5, _overflow: true } }, { node: c }], null), 'c');
L.eq('全 done → null', app.pickNextTopId([{ node: { id: 'a', im: 5, done: true } }], null), null);
L.eq('全溢出 → null', app.pickNextTopId([{ node: { id: 'a', im: 5, _overflow: true } }], null), null);

// ---- 并列与脏数据 ----
L.eq('并列取先出现者', app.pickNextTopId([{ node: { id: 'c1', im: 4 } }, { node: { id: 'c2', im: 4 } }], null), 'c1');
L.eq('ent 缺 node 安全跳过', app.pickNextTopId([{}, null, { node: b }], null), 'b');
L.eq('阻塞压分后让位（-60）', app.pickNextTopId([{ node: { id: 'a', im: 5, status: 'blocked' } }, { node: c }], null), 'c');

process.exit(L.summary('unit-nexttop') ? 1 : 0);
