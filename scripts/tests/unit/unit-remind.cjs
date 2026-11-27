/* 单元测试 · v8.18 提醒默认：remindAtFromTime / ensureRemindDefaults / workflowColor
   口径：有开始时间 → 提醒=开始前 5 分钟；手动改过（_remindManual）或当天清空（_remindOff）不覆盖。
   运行：node scripts/tests/unit/unit-remind.cjs */
const L = require('../lib.cjs');
const app = L.requireApp();

console.log('== 单元 · remind / workflowColor ==');

function day0Of(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const day0 = day0Of(new Date());

function expectMs(hm, d0) {
  const [h, m] = hm.split(':').map(Number);
  const mins = Math.max(0, h * 60 + m - 5);
  const d = new Date(d0.getTime());
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}

// ---- remindAtFromTime ----
L.eq('09:00 → 08:55', app.remindAtFromTime('09:00', day0), expectMs('09:00', day0));
L.eq('00:03 → 00:00（不跨昨天）', app.remindAtFromTime('00:03', day0), expectMs('00:03', day0));
L.eq('无 time → null', app.remindAtFromTime('', day0), null);
L.eq('非法 time → null', app.remindAtFromTime('xx', day0), null);
L.eq('14:30 → 14:25', app.remindAtFromTime('14:30', day0), expectMs('14:30', day0));

// ---- ensureRemindDefaults ----
const n1 = { id: 'a', time: '10:00', done: false };
app.ensureRemindDefaults([n1]);
L.eq('缺 remindAt 自动补 time-5', n1.remindAt, expectMs('10:00', day0));
L.eq('自动补后 _remindManual=false', !!n1._remindManual, false);

const n2 = { id: 'b', time: '11:00', remindAt: expectMs('09:00', day0), _remindManual: false, done: false };
app.ensureRemindDefaults([n2]);
L.eq('非手动旧提醒随 time 同步', n2.remindAt, expectMs('11:00', day0));

const manualAt = expectMs('08:00', day0);
const n3 = { id: 'c', time: '12:00', remindAt: manualAt, _remindManual: true, done: false };
app.ensureRemindDefaults([n3]);
L.eq('手动提醒不被覆盖', n3.remindAt, manualAt);

const n4 = { id: 'd', time: '13:00', remindAt: null, _remindOff: L.dkOf(new Date()), done: false };
app.ensureRemindDefaults([n4]);
L.eq('当天清空不回填', n4.remindAt, null);

const n5 = { id: 'e', time: '15:00', done: true };
app.ensureRemindDefaults([n5]);
L.eq('已完成不补提醒', n5.remindAt == null, true);

const n6 = { id: 'f', time: '', done: false };
app.ensureRemindDefaults([n6]);
L.eq('无开始时间不补提醒', n6.remindAt == null, true);

// ---- workflowColor ----
const c1 = app.workflowColor({ id: 'wf_aaa', color: '' });
const c2 = app.workflowColor({ id: 'wf_aaa', color: '' });
L.eq('同 id 稳定取色', c1, c2);
L.truthy('取色在调色板内', app.WF_COLORS.includes(c1));
L.eq('自定义色优先', app.workflowColor({ id: 'wf_aaa', color: '#112233' }), '#112233');
const cOther = app.workflowColor({ id: 'wf_zzz_other', color: '' });
L.truthy('不同 id 可不同色（或碰巧同槽仍合法）', typeof cOther === 'string' && cOther.length > 0);

process.exit(L.summary('unit-remind') ? 1 : 0);
