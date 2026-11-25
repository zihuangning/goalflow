/* 流程测试 · 习惯 30 天强度之旅：
   连续打卡 → 漏打衰减（不清零）→ 恢复打卡 → 历史贡献仍在 → 低频习惯对比。
   全程真实导出 habitStrength（原子习惯模型：做 +5%、漏 -freqDecay，30 天窗口）。
   运行：node scripts/tests/flow/flow-habit-strength.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 流程 · 习惯强度 30 天 ==');

// 旅程时间线（i=距今天数）：最近 10 天连续 → 中间 5 天漏打 → 最早 5 天连续
const log = {};
for (let i = 0; i < 10; i++) log[L.dkOf(L.daysAgo(i))] = true;      // 近 10 天连续
for (let i = 10; i < 15; i++) log[L.dkOf(L.daysAgo(i))] = false;   // 中段漏 5 天
for (let i = 15; i < 20; i++) log[L.dkOf(L.daysAgo(i))] = true;    // 最早 5 天连续

// 阶段断言（habitStrength 按 i 升序结算：先算最近的日子）
// ① 只看最近 10 天连续
const logRecent = {};
for (let i = 0; i < 10; i++) logRecent[L.dkOf(L.daysAgo(i))] = true;
L.eq('① 连打 10 天 → 50%（每天 +5%）', app.habitStrength({ log: logRecent }).pct, 50);

// ② 加上中段 5 天漏打 → 每天净 +3%（+5% 后 -2%），衰减但不清零
const logWithMiss = Object.assign({}, logRecent);
for (let i = 10; i < 15; i++) logWithMiss[L.dkOf(L.daysAgo(i))] = false;
L.eq('② 10 连 + 5 漏 → 65%（漏打净 +3%，不清零）', app.habitStrength({ log: logWithMiss }).pct, 65);

// ③ 再加上最早 5 天连续 → 历史贡献仍在
L.eq('③ 全程 20 天 → 90%（早期连续仍计入）', app.habitStrength({ log }).pct, 90);

// ④ 低频习惯（freqDecay=0.012）漏扣更少 → 同样旅程强度更高
L.eq('④ 低频习惯同旅程 → 94%（每周 1 次节奏衰减更慢）', app.habitStrength({ log, freqDecay: 0.012 }).pct, 94);

// ⑤ 未记录的日子完全不影响（samples 只数有记录的天）
const s = app.habitStrength({ log: logRecent });
L.eq('⑤ 只记 10 天 → samples=10（无记录日不参与）', s.samples, 10);

// ⑥ 30 天全勤 → 100 封顶
const logFull = {};
for (let i = 0; i < 30; i++) logFull[L.dkOf(L.daysAgo(i))] = true;
L.eq('⑥ 30 天全勤 → 100% 封顶', app.habitStrength({ log: logFull }).pct, 100);

process.exit(L.summary('flow-habit-strength') ? 1 : 0);
