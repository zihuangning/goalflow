/* 单元 · clipWinsToGlobal / clipProjectWinsToGlobals */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · 项目时段裁剪 ==');

{
  const clipped = app.clipWinsToGlobal([{ start: '19:00', mins: 120 }], [{ start: '18:00', mins: 240 }]);
  L.eq('完全落在全局内', clipped.length, 1);
  L.eq('分钟不变', clipped[0].mins, 120);
}

{
  const clipped = app.clipWinsToGlobal([{ start: '08:00', mins: 120 }], [{ start: '09:00', mins: 240 }]);
  L.eq('部分超出 → 裁到全局起点', clipped[0].start, '09:00');
  L.eq('部分超出 → 时长 60′', clipped[0].mins, 60);
}

{
  const clipped = app.clipWinsToGlobal([{ start: '06:00', mins: 60 }], [{ start: '09:00', mins: 240 }]);
  L.eq('完全在全局外', clipped.length, 0);
}

{
  const clipped = app.clipWinsToGlobal([{ start: '10:00', mins: 60 }], []);
  L.eq('无全局约束 → 原样', clipped[0].start, '10:00');
}

const state = app.__testState();
const snapMeta = state.meta;
state.meta = {
  capacity: {
    globalWorkdayWins: [{ start: '19:00', mins: 180 }],
    globalWeekendWins: [{ start: '19:00', mins: 180 }],
  },
};
{
  const out = app.clipProjectWinsToGlobals([{ start: '19:00', mins: 120 }, { start: '08:00', mins: 60 }]);
  L.eq('链式裁剪 · 早段去掉', out.length, 1);
  L.eq('链式裁剪 · 保留 19:00', out[0].start, '19:00');
}
state.meta = snapMeta;

L.summary('unit-clip-wins');