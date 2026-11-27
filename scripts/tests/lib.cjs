/* 单元/流程测试公共工具：断言 + 应用加载。
   与 scripts/checks/lib.cjs 分工：
   - checks/lib.cjs = 字符串核查（verify）+ grabFn 提取冒烟（smoke），针对有状态函数
   - 本文件 = 真实 require 业务脚本的单元测试断言（纯函数直接调）
   流程测试（flow/）仍用 checks/lib.cjs 的 buildCtx（有状态函数 + stub 依赖）。 */
const path = require('path');
const Module = require('module');
const { ROOT, APP_SCRIPT_PARTS, readConcat } = require('../app-scripts.cjs');

let passed = 0, failed = 0;
const failures = [];

function ok(name) { passed++; console.log('  ✓ ' + name); }
function bad(name, detail) { failed++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }

function truthy(name, v) { v ? ok(name) : bad(name, '期望真值，得到: ' + JSON.stringify(v)); }
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  a === e ? ok(name) : bad(name, '期望 ' + e + '，得到 ' + a);
}

/* 按 APP_SCRIPT_PARTS 拼接后一次编译（浏览器多 script 共享作用域的 Node 等价）。 */
function requireApp() {
  const filename = path.join(ROOT, 'assets/js/app-bundle-for-tests.js');
  const code = readConcat(APP_SCRIPT_PARTS);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(code, filename);
  return m.exports;
}

/* 日期工具（测试内构造相对日期，断言与运行日期无关） */
function dkOf(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function daysAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

function summary(suite) {
  console.log('\n[' + suite + '] ' + passed + ' 通过, ' + failed + ' 失败');
  if (failed) { console.log('失败项:'); failures.forEach(f => console.log('  - ' + f)); }
  return failed;
}

module.exports = { ROOT, ok, bad, truthy, eq, requireApp, dkOf, daysAgo, summary };
