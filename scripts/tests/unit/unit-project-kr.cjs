/* 单元测试 · v8.17 projectKrNodes（真 KR 筛选）
   口径：仅 role===KR 且有 parent 且未完成——文案「(1/2)」解析出的 targetNum 不算指标。
   运行：node scripts/tests/unit/unit-project-kr.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · projectKrNodes ==');

L.eq('空数组 → []', app.projectKrNodes([]).length, 0);
L.eq('null → []', app.projectKrNodes(null).length, 0);
L.eq('undefined → []', app.projectKrNodes(undefined).length, 0);

{
  const nodes = [
    { id: 'r', text: '根' },
    { id: 'k1', parentId: 'r', role: 'KR', text: '关键结果 A', targetNum: 10, targetDone: 3 },
    { id: 'k2', parentId: 'r', role: 'KR', text: '已完成 KR', done: true, targetNum: 5 },
    { id: 't1', parentId: 'r', text: '普通任务 (1/2)', targetNum: 2, targetDone: 1 }, // 文案分数，非 KR
    { id: 'h1', parentId: 'r', role: 'habit', text: '习惯', targetNum: 7 },
    { id: 'k3', parentId: 'r', role: 'KR', text: '关键结果 B' },
  ];
  const out = app.projectKrNodes(nodes);
  L.eq('只收未完成 KR', out.length, 2);
  L.eq('含 k1', out.some(n => n.id === 'k1'), true);
  L.eq('含 k3', out.some(n => n.id === 'k3'), true);
  L.eq('排除已完成 KR', out.some(n => n.id === 'k2'), false);
  L.eq('排除纯 targetNum 普通任务', out.some(n => n.id === 't1'), false);
  L.eq('排除 habit', out.some(n => n.id === 'h1'), false);
  L.eq('排除无 parent 的根', out.some(n => n.id === 'r'), false);
}

process.exit(L.summary('unit-project-kr') ? 1 : 0);
