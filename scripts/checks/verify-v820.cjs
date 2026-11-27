/* v8.20 弹窗关闭可见 + 侧栏基础设置 + 移动藏闹钟 + 底栏五键
   ① mh-x 做成真按钮；搜索/归档补关闭
   ② 侧栏「⚙ 基础设置」+ profile.displayName + 空闲/仪式时间
   ③ 移动藏闹钟条；仪式回抽屉（v8.21 起 todayBrief 已并入顶栏 ab-mini，本文件不再锁摘要条）
   ④ 底栏恢复 今日|规划|捕捉|洞察|AI
   运行：node scripts/checks/verify-v820.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');

console.log('== v8.20 核查 ==');

// ① 关闭按钮
L.assertContains('mh-x 最小触控', 'min-width: 40px', css);
L.assertContains('mh-x 边框按钮感', '.modal-head .mh-x {', css);
L.assertContains('搜索关闭钮', 'id="gsClose"', L.APP_JS);
L.assertContains('归档关闭 closeId', "closeId: 'archX'", L.APP_JS);
L.assertContains('mh-x 多为 button', '<button type="button" class="mh-x"', L.APP_JS);

// ② 基础设置（v8.21 文案「全局资料」→「个人资料」，锁显示名控件）
L.assertContains('侧栏基础设置', 'id="sideSettings"', html);
L.assertContains('设置分组标题', '>设置</div>', html);
L.assertContains('profile 初始化', 'state.meta.profile', L.APP_JS);
L.assertFnContains('设置含显示名', 'openSettingsModal', 'setDisplayName');
L.assertFnContains('设置含个人资料', 'openSettingsModal', '个人资料');
L.assertFnContains('保存显示名', 'openSettingsModal', 'displayName');
L.assertContains('绑定 sideSettings', "bindRit('sideSettings'");

// ③ 移动顶栏（闹钟藏；仪式抽屉常显；摘要已迁 v8.21 ab-mini）
L.assertContains('mobile §49', '移动端：顶栏去闹钟仪式', mobile);
L.assertContains('藏闹钟条', '#todayAlarmBar', mobile);
L.assertContains('仪式抽屉常显', 'class="si" id="sideMorning"', html);

// ④ 底栏五键
L.assertContains('底栏今日', 'data-nav="today"', html);
L.assertContains('底栏规划', 'mtab-btn" data-nav="plan"', html);
L.assertContains('底栏洞察', 'mtab-btn" data-nav="insights"', html);
L.assertContains('底栏 AI', 'mtab-btn" data-nav="ai"', html);
L.assertContains('捕捉 FAB', 'id="mtabCapture"', html);
L.assertNotContains('无更多 sheet', 'mtabMoreSheet', html);

// 滚动版本守卫
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v820') ? 1 : 0);
