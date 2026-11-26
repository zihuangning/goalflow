/* 单元测试 · v8.14 已完成区单项得分：scoreOfDoneEntry（纯函数）
   口径：当日 scoreLog 里倒序找该节点最新一条 kind='done' 记录；pomo 不算；脏数据安全返回 null。
   运行：node scripts/tests/unit/unit-done-score.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · scoreOfDoneEntry ==');

const log = {
  entries: [
    { kind: 'done', nodeId: 'n1', score: 30, reason: '重要3 · 期限内' },
    { kind: 'pomo', nodeId: 'n1', score: 20 },
    { kind: 'done', nodeId: 'n2', score: 45, reason: '重要4 · 时长达标' },
    { kind: 'done', nodeId: 'n1', score: 38, reason: '再次完成' },
  ]
};

// ---- 基础匹配 ----
L.eq('n2 命中唯一 done 记录', app.scoreOfDoneEntry({ nodeId: 'n2' }, log), { score: 45, reason: '重要4 · 时长达标' });
L.eq('n1 多条 done 取最新（倒序）', app.scoreOfDoneEntry({ nodeId: 'n1' }, log).score, 38);
L.eq('reason 随最新一条', app.scoreOfDoneEntry({ nodeId: 'n1' }, log).reason, '再次完成');
L.eq('pomo 记录不参与（n3 只有 pomo）', app.scoreOfDoneEntry({ nodeId: 'n3' }, { entries: [{ kind: 'pomo', nodeId: 'n3', score: 20 }] }), null);
L.eq('无匹配节点 → null', app.scoreOfDoneEntry({ nodeId: 'zzz' }, log), null);

// ---- 脏数据安全 ----
L.eq('dayScoreLog 为 null', app.scoreOfDoneEntry({ nodeId: 'n1' }, null), null);
L.eq('dayScoreLog 为 undefined', app.scoreOfDoneEntry({ nodeId: 'n1' }, undefined), null);
L.eq('entries 非数组', app.scoreOfDoneEntry({ nodeId: 'n1' }, { entries: 'bad' }), null);
L.eq('空 entries', app.scoreOfDoneEntry({ nodeId: 'n1' }, { entries: [] }), null);
L.eq('entry 为 null', app.scoreOfDoneEntry(null, log), null);
L.eq('entry 缺 nodeId', app.scoreOfDoneEntry({ text: 'x' }, log), null);
L.eq('reason 缺省兜底空串', app.scoreOfDoneEntry({ nodeId: 'n4' }, { entries: [{ kind: 'done', nodeId: 'n4', score: 12 }] }).reason, '');
L.eq('条目为 null 跳过不炸', app.scoreOfDoneEntry({ nodeId: 'n1' }, { entries: [null, { kind: 'done', nodeId: 'n1', score: 7 }] }).score, 7);

process.exit(L.summary('unit-done-score') ? 1 : 0);
