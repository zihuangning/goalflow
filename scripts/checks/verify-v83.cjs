/* v8.3 四问题修复 —— 常驻字符串核查。
   ① 精力超标弹窗点多次才退出：insertAITasks 尾部逻辑（recomputeSchedule/save/afterChange/
      warnIfOverCapacity/showTodayAlarm）包进 if (!_collected)，递归层不再重复触发
   ② 桌面字号整体 +1：body 15px；桌面规则 ≤13px 全部抬一档（max-width 移动端块不动）
   ④ Chrome 提醒无兜底：tickReminders 走 showTodayAlarm 三通道（系统通知+toast+页头横幅）；
      行内 ⏰ 填时间时权限 default 自动引导授权
   运行：node scripts/checks/verify-v83.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

console.log('== v8.3 核查 ==');

// ① insertAITasks 尾部只在最外层执行
L.assertFnContains('尾部逻辑包 if (!_collected)', 'insertAITasks', 'if (!_collected) {');
L.assertFnContains('递归层跳过：v8.3 注释', 'insertAITasks', '递归调用时 _collected 存在，跳过');
{
  const body = L.grabFn('insertAITasks');
  const tailIdx = body.indexOf('if (!_collected) {');
  const warnIdx = body.indexOf('warnIfOverCapacity', tailIdx);
  const alarmIdx = body.indexOf('showTodayAlarm', tailIdx);
  (tailIdx > -1 && warnIdx > tailIdx && alarmIdx > tailIdx)
    ? L.ok('warnIfOverCapacity/showTodayAlarm 均在 !collected 块内')
    : L.bad('尾部逻辑归属', 'warnIfOverCapacity 或 showTodayAlarm 不在 !collected 块内');
}

// ② 字号（迁移签名验证：「+1 档」后原 12px 变 13px 仍 ≤13，故不能用「无 ≤13px」判定）
const base = fs.readFileSync(path.join(L.ROOT, 'assets/css/base.css'), 'utf8');
const features = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const layout = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/layout.css'), 'utf8');
L.assertContains('body 桌面基础字号 15px', 'font-size: 15px', base);
L.assertContains('迁移签名：原 12.5px 档抬为 13.5px', 'font-size: 13.5px', features);
L.assertContains('迁移签名：layout 原 8.5px 档抬为 9.5px', 'font-size: 9.5px', layout);
{
  // 桌面规则（max-width 块外）不应再有 ≤9px（迁移后最小档 9.5）；移动端块内原值保留
  const files = ['assets/css/components/features.css', 'assets/css/components/layout.css', 'assets/css/components/chip.css', 'assets/css/components/button.css', 'assets/css/components/forms.css'];
  let leaked = [];
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(L.ROOT, rel), 'utf8').split('\n');
    let depth = 0; const skip = [];
    for (const line of lines) {
      const o = (line.match(/\{/g) || []).length, c = (line.match(/\}/g) || []).length;
      const isMax = /^\s*@media[^\n{]*max-width/i.test(line);
      if (isMax) skip.push(depth);
      depth += o - c;
      while (skip.length && depth <= skip[skip.length - 1]) skip.pop();
      const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
      if (m && !skip.length && parseFloat(m[1]) <= 9) leaked.push(rel + ' → ' + m[1] + 'px: ' + line.trim().slice(0, 60));
    }
  }
  leaked.length === 0 ? L.ok('桌面规则无 ≤9px 字号（+1 档迁移完成，移动端块不动）') : L.bad('桌面小字号残留', leaked.slice(0, 5).join(' | '));
}

// ④ 提醒兜底
L.assertFnContains('tickReminders 走 showTodayAlarm 三通道', 'tickReminders', 'showTodayAlarm(msg');
L.assertFnNotContains('tickReminders 不再裸 new Notification', 'tickReminders', 'new Notification');
L.assertFnContains('showTodayAlarm 保留系统通知通道', 'showTodayAlarm', 'new Notification');
L.assertFnContains('showTodayAlarm 页头横幅兜底', 'showTodayAlarm', 'topbar-banner');
L.assertContains('⏰ 填时间时权限 default 引导授权', "Notification.permission === 'default'");

process.exit(L.summary('verify-v83') ? 1 : 0);
