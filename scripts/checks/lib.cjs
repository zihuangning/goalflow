/* checks 公共工具：源码提取 + 断言。
   所有 checks/*.cjs（除 run.cjs）通过 require('./lib.cjs') 使用。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');

let passed = 0, failed = 0;
const failures = [];

function ok(name) { passed++; console.log('  ✓ ' + name); }
function bad(name, detail) { failed++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }

/* 字符串断言：源码包含目标串 */
function assertContains(name, needle, src) {
  (src || APP_JS).includes(needle) ? ok(name) : bad(name, '未找到: ' + needle.slice(0, 80));
}
function assertNotContains(name, needle, src) {
  !(src || APP_JS).includes(needle) ? ok(name) : bad(name, '不应存在: ' + needle.slice(0, 80));
}

/* 按函数名提取整个函数体（大括号计数），返回源码文本；保留 async 前缀（v8.8 起 deleteWorkflow 等为 async） */
function grabFn(name, src) {
  const s = src || APP_JS;
  const re = new RegExp('(async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(s);
  if (!m) return null;
  let i = s.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (!depth) return s.slice(m.index, j + 1); }
  }
  return null;
}

/* 函数体范围断言（避免跨函数误匹配） */
function assertFnContains(name, fnName, needle, src) {
  const body = grabFn(fnName, src);
  if (!body) return bad(name, '函数不存在: ' + fnName);
  body.includes(needle) ? ok(name) : bad(name, fnName + ' 内未找到: ' + needle.slice(0, 60));
}
function assertFnNotContains(name, fnName, needle, src) {
  const body = grabFn(fnName, src);
  if (!body) return bad(name, '函数不存在: ' + fnName);
  !body.includes(needle) ? ok(name) : bad(name, fnName + ' 内不应存在: ' + needle.slice(0, 60));
}

/* 用 new Function 把提取的函数 + stub 组装成可调用环境 */
function buildCtx(fnNames, stubs, src) {
  const s = src || APP_JS;
  const fns = fnNames.map(n => {
    const body = grabFn(n, s);
    if (!body) throw new Error('grabFn 失败: ' + n);
    return body;
  }).join('\n');
  const stubNames = Object.keys(stubs);
  const factory = new Function(
    ...stubNames,
    fns + '\nreturn { ' + fnNames.map(n => n + ': ' + n).join(', ') + ' };'
  );
  return factory(...stubNames.map(n => stubs[n]));
}

function summary(suite) {
  console.log('\n[' + suite + '] ' + passed + ' 通过, ' + failed + ' 失败');
  if (failed) { console.log('失败项:'); failures.forEach(f => console.log('  - ' + f)); }
  return failed;
}

module.exports = { ROOT, APP_JS, ok, bad, assertContains, assertNotContains, grabFn, assertFnContains, assertFnNotContains, buildCtx, summary };
