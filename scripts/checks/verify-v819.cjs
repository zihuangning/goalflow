/* v8.19 移动端降级：查看 + 勾选 + 捕捉 + 简单改时
   ① 去重：抽屉视图/仪式 d-only；顶栏项目移除；明暗进 ⋯
   ② 行操作：移动只留提醒/时间/删除（CSS 藏深度动作）
   ③ 闹钟条：藏晨晚时间控件；设置承接；仪式菜单「改到点时间」
   ④ 底栏：今日 | 捕捉 | 更多（sheet→规划/洞察/AI）
   运行：node scripts/checks/verify-v819.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const mobile = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/mobile.css'), 'utf8');
const layout = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/layout.css'), 'utf8');

console.log('== v8.19 核查 ==');

// ① 去重
L.assertContains('抽屉视图标 d-only', 'class="slabel d-only">视图', html);
// v8.20: 顶部去仪式后，抽屉仪式改常显（不再 d-only）
L.assertContains('抽屉仪式常显', 'class="slabel">仪式', html);
L.assertContains('侧栏晨计划常显', 'class="si" id="sideMorning"', html);
L.assertNotContains('顶栏不再有 btnProjects', 'id="btnProjects"', html);
L.assertContains('明暗进 tb-drop', 'id="modeToggle"', html);
L.assertContains('主题区 d-only', 'class="topbar-theme d-only"', html);
L.assertContains('layout 移动藏 d-only', '.d-only{display:none !important;}', layout);

// ② 行操作减负
L.assertContains('mobile §48 降级', 'v8.19 移动端降级', mobile);
L.assertContains('藏估时', '.today-est { display: none !important; }', mobile);
L.assertContains('藏微动作', '.today-acts [data-micro]', mobile);
L.assertContains('藏预案', '.today-acts [data-woop]', mobile);
L.assertContains('藏等待', '.today-acts [data-wait]', mobile);
L.assertContains('藏删除以外深度动作仍可删', '.today-acts [data-tags]', mobile);
L.assertContains('藏 MIT 得分折叠', '.mit-score-fold', mobile);
L.assertContains('藏 →今天', '.fitem-today { display: none !important; }', mobile);

// ③ 闹钟条 / 设置
L.assertContains('藏闹钟时间控件', '.today-alarm-bar .alarm-set { display: none !important; }', mobile);
L.assertFnContains('设置含仪式时间区', 'openSettingsModal', 'setRitualSection');
L.assertFnContains('设置保存晨时间', 'openSettingsModal', 'setRitualMorning');
L.assertFnContains('仪式菜单改进设置', 'renderTodayAlarmBar', 'btnRitualTimes');
L.assertFnContains('改时间打开设置', 'renderTodayAlarmBar', 'openSettingsModal()');

// ④ 底栏：v8.20 起恢复五键常驻（本文件断言重定向）
L.assertContains('底栏规划常驻', 'mtab-btn" data-nav="plan"', html);
L.assertContains('底栏洞察常驻', 'mtab-btn" data-nav="insights"', html);
L.assertContains('底栏 AI 常驻', 'mtab-btn" data-nav="ai"', html);
L.assertNotContains('不再有更多 sheet', 'id="mtabMoreSheet"', html);

// 版本（滚动式）
const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 4 && new Set([...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1])).size === 1 ? L.ok : L.bad)('index.html 版本号一致且 ≥4 处（' + curV + ' ×' + vCount + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v819') ? 1 : 0);
