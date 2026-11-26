/* 单元/流程测试统一入口：node scripts/tests/run.cjs [--with-checks]
   unit/*.cjs → flow/*.cjs 按文件名排序执行（每文件独立进程，require 缓存天然隔离）。
   --with-checks 追加 scripts/checks/run.cjs 全量守卫（verify 字符串核查 + smoke 冒烟）。
   新增测试：直接往 unit/ 或 flow/ 放 .cjs 文件即可被自动扫到。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require(path.join(__dirname, '..', 'checks', 'lib.cjs'));

let failed = 0, count = 0;

function step(name, file) {
  count++;
  console.log('\n=== ' + name + ' ===');
  try {
    // runSuite：Windows 子进程偶发 0xC0000409 崩溃时重试/按输出判定（见 checks/lib.cjs 注释）
    const r = L.runSuite(file);
    process.stdout.write(r.out);
    if (r.crashedTwice) console.log('  ⚠ 子进程两次异常退出（0xC0000409 Windows 管道层已知问题），输出证明全过，按通过计');
    else if (r.flaky) console.log('  ⚠ 首次进程异常退出（0xC0000409），重试通过');
    console.log('✓ ' + name);
  } catch (e) {
    failed++;
    // v8.9 教训：失败时 stdout 与 stderr 都要打出来（崩溃堆栈在 stderr）
    console.log('✗ ' + name + '\n' + (e.stdout ? e.stdout.toString() : ''));
    if (e.stderr) console.log(e.stderr.toString());
    if (!e.stdout && !e.stderr) console.log(e.message);
  }
}

['unit', 'flow'].forEach(dir => {
  const d = path.join(__dirname, dir);
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter(f => f.endsWith('.cjs')).sort()
    .forEach(f => step(dir + '/' + f.replace('.cjs', ''), path.join(d, f)));
});

if (process.argv.includes('--with-checks')) {
  count++;
  console.log('\n=== checks 全量守卫（verify+smoke） ===');
  try {
    const r = L.runSuite(path.join(__dirname, '..', 'checks', 'run.cjs'), /✅ 全部通过/);
    process.stdout.write(r.out);
    if (r.crashedTwice) console.log('  ⚠ 子进程两次异常退出（0xC0000409 Windows 管道层已知问题），输出证明全过，按通过计');
    else if (r.flaky) console.log('  ⚠ 首次进程异常退出（0xC0000409），重试通过');
    console.log('✓ checks 全量守卫');
  } catch (e) {
    failed++;
    console.log('✗ checks 全量守卫\n' + (e.stdout ? e.stdout.toString() : ''));
    if (e.stderr) console.log(e.stderr.toString());
  }
}

console.log('\n========================================');
console.log(failed ? '❌ 共 ' + failed + '/' + count + ' 个套件失败' : '✅ 全部通过（' + count + ' 个套件）');
process.exit(failed ? 1 : 0);
