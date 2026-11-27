/* 单元测试 · v8.23 今日清单：跨日清陈旧 time + 用户置顶排序
   口径：
   ① time 无日期语义=「今天几点」—— timeDk≠今天 或无 timeDk 的非习惯任务，跨日应清掉，避免昨日排程冒充今日
   ② 用户置顶（todayListPins）排在有 time 的任务之前、MIT 之后；同组内仍按时间升序
   运行：node scripts/tests/unit/unit-today-sort.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · today-sort / scrub / pin ==');

const today = L.dkOf(new Date());
const yest = L.dkOf(L.daysAgo(1));

// ---- scrubStaleTodayTimes ----
{
  const a = { id: 'a', time: '09:00', timeDk: yest, done: false };
  const b = { id: 'b', time: '10:00', timeDk: today, done: false };
  const c = { id: 'c', time: '11:00', done: false }; // 旧数据无 timeDk
  const h = { id: 'h', time: '07:00', timeDk: yest, recur: true, done: false };
  const dirty = app.scrubStaleTodayTimes([a, b, c, h], today);
  L.truthy('跨日有脏数据 → dirty', dirty === true);
  L.eq('昨日 time 被清', [a.time, a.timeDk], ['', '']);
  L.eq('今日 time 保留', [b.time, b.timeDk], ['10:00', today]);
  L.eq('无 timeDk 旧数据清掉', [c.time, c.timeDk || ''], ['', '']);
  L.eq('习惯 time 保留并盖章今天', [h.time, h.timeDk], ['07:00', today]);
}

{
  const n = { id: 'ok', time: '12:00', timeDk: today, done: false };
  L.truthy('全是今天 → 不脏', app.scrubStaleTodayTimes([n], today) === false);
  L.eq('今天 time 不动', n.time, '12:00');
}

// ---- sortTodayExecEntries ----
{
  const mk = (id, time, extra) => ({ wfId: 'wf1', node: Object.assign({ id, time: time || '', slot: '', im: 3, ur: 3, done: false }, extra || {}) });
  const pins = ['wf1|pin1'];
  const entries = [
    mk('t2', '14:00'),
    mk('t1', '09:00'),
    mk('u1', '', { im: 5 }),
    mk('pin1', '16:00'),
    mk('ov1', '08:00', { _overflow: true }),
    mk('od1', '', { overdue: true, daysLeft: -2, im: 4 }),
  ];
  // stub focusScore via im if needed — sort uses focusScore from app
  const ordered = app.sortTodayExecEntries(entries, { pins });
  const ids = ordered.map(e => e.node.id);
  L.eq('置顶在最前', ids[0], 'pin1');
  L.eq('有 time 按升序', ids.slice(1, 3), ['t1', 't2']);
  L.truthy('未设时间在有时间之后', ids.indexOf('u1') > ids.indexOf('t2'));
  L.truthy('逾期补做在未设时间之后或同区靠后', ids.indexOf('od1') > ids.indexOf('u1') || ids.indexOf('od1') > ids.indexOf('t2'));
  L.eq('溢出沉底', ids[ids.length - 1], 'ov1');
}

{
  const mk = (id, time) => ({ wfId: 'wf1', node: { id, time, slot: '', done: false, im: 3, ur: 3 } });
  const ordered = app.sortTodayExecEntries([mk('b', '15:00'), mk('a', '08:00')], { pins: [] });
  L.eq('无置顶纯时间升序', ordered.map(e => e.node.id), ['a', 'b']);
}

process.exit(L.summary('unit-today-sort') ? 1 : 0);
