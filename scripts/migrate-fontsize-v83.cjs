/* v8.3 一次性迁移：桌面字号整体放大一号。
   规则：base/features/layout/chip/button/forms.css 中 font-size ≤ 13px 的桌面规则全部 +1px
   （8.5→9.5, 9→10, 9.5→10.5, 10→11, 10.5→11.5, 11→12, 11.5→12.5, 12→13, 12.5→13.5, 13→14）；
   base.css 的 body 14→15。
   跳过 @media (max-width: ...) 块（移动端字号 v7.7 已单独调校，不动）。
   mobile.css 不在处理范围。单次 pass map 替换，不会连锁。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 防重复执行：本迁移不幂等（再跑一次会再抬一档）。body 已是 15px 说明已迁移过。
const baseNow = fs.readFileSync(path.join(ROOT, 'assets/css/base.css'), 'utf8');
if (/font-size:\s*15px/.test(baseNow)) {
  console.log('body 已是 15px —— v8.3 字号迁移已执行过，拒绝重复运行');
  process.exit(1);
}
const MAP = {
  '8.5': '9.5', '9': '10', '9.5': '10.5', '10': '11', '10.5': '11.5',
  '11': '12', '11.5': '12.5', '12': '13', '12.5': '13.5', '13': '14',
};
const FILES = [
  'assets/css/components/features.css',
  'assets/css/components/layout.css',
  'assets/css/components/chip.css',
  'assets/css/components/button.css',
  'assets/css/components/forms.css',
];

function bumpFile(rel, extraMap) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  const map = extraMap || MAP;
  const lines = src.split('\n');
  const out = [];
  let depth = 0;
  const skipStack = []; // 记录 max-width media 块结束时的 depth
  let changed = 0;
  for (const line of lines) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    const isMaxMedia = /^\s*@media[^\n{]*max-width/i.test(line);
    const skipping = skipStack.length > 0;
    let newLine = line;
    if (!skipping && !isMaxMedia) {
      newLine = line.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (m, v) => {
        if (map[v]) { changed++; return 'font-size: ' + map[v] + 'px'; }
        return m;
      });
    }
    if (isMaxMedia) skipStack.push(depth); // 块结束时 depth 回到进入前的值
    depth += opens - closes;
    while (skipStack.length && depth <= skipStack[skipStack.length - 1]) skipStack.pop();
    out.push(newLine);
  }
  fs.writeFileSync(file, out.join('\n'));
  console.log(rel + ': bumped ' + changed + ' 处');
}

FILES.forEach(f => bumpFile(f));
// base.css：body 14→15，gf-hint 11.5→12.5，kbd 10→11（同 MAP 已覆盖 10/11.5，这里单独补 14）
bumpFile('assets/css/base.css', { '14': '15', '11.5': '12.5', '10': '11' });
console.log('done');
