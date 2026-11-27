/* v8.30：rowChrome 石头 + 树 a11y + gfIcon + 浅色 SVG + MIT 文案降噪
   运行：node scripts/checks/verify-v830.cjs */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const html = fs.readFileSync(path.join(L.ROOT, 'index.html'), 'utf8');
const featCss = fs.readFileSync(path.join(L.ROOT, 'assets/css/components/features.css'), 'utf8');
const uiJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/gf-ui.js'), 'utf8');
const modelJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/gf-model.js'), 'utf8');
const appJs = fs.readFileSync(path.join(L.ROOT, 'assets/js/app.js'), 'utf8');

console.log('== v8.30 核查 ==');

L.assertContains('gfIcon 定义', 'function gfIcon(name', modelJs);
L.assertContains('svgDimStroke 定义', 'function svgDimStroke()', modelJs);
L.assertContains('render 用 svgDimStroke', 'svgDimStroke()', modelJs);
L.assertContains('app exports gfIcon', 'gfIcon', appJs);
L.assertFnContains('大石头 rowChrome', 'renderTodayRocks', 'rowChrome({');
L.assertContains('石头勾选用 ✓/○', "done ? '✓' : '○'", uiJs);
{
  const rocksFn = L.grabFn('renderTodayRocks', uiJs) || '';
  const chipSeg = rocksFn.includes('const chips') ? rocksFn.slice(rocksFn.indexOf('const chips'), rocksFn.indexOf("}).join('')")) : '';
  !chipSeg.includes('🪨') && !chipSeg.includes('✅') ? L.ok('石头 chip 不用 emoji 勾') : L.bad('石头 chip 不用 emoji 勾', 'chip 段仍含 emoji');
}

L.assertContains('树 more aria-expanded 初始', "setAttribute('aria-expanded'", uiJs);
L.assertFnContains('树 more 切换 aria', 'bindTreeEditorDelegation', "setAttribute('aria-expanded'");

L.assertContains('导航 gf-icon 静态 SVG', 'class="gf-icon"', html);
L.assertContains('侧栏仪式仍用 emoji 晨', '🌅 晨计划', html);

L.assertContains('MIT 无 emoji 头', 'MIT · 当下最重要', uiJs);
L.assertContains('优先级折叠无 📊', '优先级 ${mitFs.total} · 为什么排最前', uiJs);

// 简洁模式回归（v8.29 口径沿用）
L.assertNotContains('简洁模式不藏 inboxCapture', 'body.simple-mode #inboxCapture', featCss);
L.assertNotContains('简洁模式不整藏 heroWrap', 'body.simple-mode #heroWrap,', featCss);
L.assertContains('空 hero 才藏', 'body.simple-mode #heroWrap:not(:has(.pomo-bar.show))', featCss);

const curV = (html.match(/\?v=([\d.]+)/) || [])[1];
const vCount = (html.match(new RegExp('\\?v=' + String(curV).replace(/\./g, '\\.'), 'g')) || []).length;
(vCount >= 6 ? L.ok : L.bad)('index.html ≥6 处 ?v=（当前 ' + curV + '）', '实际 ' + vCount);

process.exit(L.summary('verify-v830') ? 1 : 0);