/* 应用脚本加载顺序（浏览器 / inline-bundle / Node require / checks 共用）。
   经典 <script> 共享词法环境；Node 必须按此清单拼接后一次编译。 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

/** 相对仓库根的路径，顺序不可乱 */
const APP_SCRIPT_PARTS = [
  'assets/js/gf-tokens.js',
  'assets/js/gf-demos.js',
  'assets/js/gf-model.js',
  'assets/js/gf-ui.js',
  'assets/js/app.js',
];

/** 仅业务逻辑三件（不含 tokens/demos），供 requireApp / APP_JS 字符串扫描 */
const APP_LOGIC_PARTS = [
  'assets/js/gf-model.js',
  'assets/js/gf-ui.js',
  'assets/js/app.js',
];

function absParts(parts) {
  return parts.map(p => path.join(ROOT, p));
}

function readConcat(parts) {
  return absParts(parts).map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
}

function logicSource() {
  return readConcat(APP_LOGIC_PARTS);
}

module.exports = {
  ROOT,
  APP_SCRIPT_PARTS,
  APP_LOGIC_PARTS,
  absParts,
  readConcat,
  logicSource,
};
