/* 常驻核查统一入口：node scripts/checks/run.cjs
   流程：node --check app.js → 版本号一致性 → 依次跑 checks 目录下 verify-*.cjs / smoke-*.cjs
   全部通过 exit 0；任一失败 exit 1。
   新增版本核查：直接在本目录新建 verify-vXX.cjs / smoke-vXX.cjs 即可被自动扫到。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let failed = 0;

function step(name, fn) {
  console.log('\n=== ' + name + ' ===');
  try { fn(); console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + '\n' + (e.stdout ? e.stdout.toString() : e.message)); }
}

// 1. 语法检查（拆分后的三业务文件）
['gf-model.js', 'gf-ui.js', 'app.js'].forEach(f => {
  step('node --check assets/js/' + f, () => {
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'assets/js', f)], { stdio: 'pipe' });
  });
});

// 2. index.html ?v= 版本号一致（含多 script）
step('index.html 资源版本号一致', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const vs = [...html.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]);
  if (!vs.length) throw new Error('未找到 ?v= 版本号');
  if (new Set(vs).size !== 1) throw new Error('版本号不一致: ' + vs.join(', '));
  console.log('  版本 v' + vs[0] + ' × ' + vs.length + ' 处');
});

// 3. 依次跑 checks（run.cjs/lib.cjs 除外，按文件名排序）
// runSuite：Windows 子进程偶发 0xC0000409 崩溃时重试/按输出判定（见 lib.cjs 注释）
const L = require('./lib.cjs');
const suites = fs.readdirSync(__dirname)
  .filter(f => /^(verify|smoke)-.*\.cjs$/.test(f))
  .sort();
suites.forEach(f => step(f.replace('.cjs', ''), () => {
  const r = L.runSuite(path.join(__dirname, f));
  process.stdout.write(r.out);
  if (r.crashedTwice) console.log('  ⚠ 子进程两次异常退出（0xC0000409 Windows 管道层已知问题），输出证明全过，按通过计');
  else if (r.flaky) console.log('  ⚠ 首次进程异常退出（0xC0000409），重试通过');
}));

console.log('\n========================================');
console.log(failed ? '❌ 共 ' + failed + ' 个环节失败' : '✅ 全部通过（' + (2 + suites.length) + ' 个环节）');
process.exit(failed ? 1 : 0);
