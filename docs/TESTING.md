# GoalFlow 测试体系

测试是这个项目敢快速迭代的原因。纯前端、无构建、数据全在 localStorage 的应用，最怕「改 A 坏 B 不知道」。四层测试各管一段，全部零依赖（node 直跑 .cjs，无 jest/vitest/npm）。

**相关流程**：用例设计用 `@goalflow-test-case-generator`（评审后再改套件）· 场景顺序见 [`dev/agent-scenario-workflows.md`](./dev/agent-scenario-workflows.md) · Agent 总入口 [`../AGENTS.md`](../AGENTS.md)。

## 四层结构

```
scripts/
├── checks/                    # 第 1-2 层：回归守卫（verify/smoke → v8.29；APP_JS=三文件拼接）
│   ├── lib.cjs                #   grabFn + 断言；源码来自 app-scripts.logicSource()
│   ├── run.cjs                #   统一入口（自动扫 verify-*/smoke-*；三文件 --check）
│   ├── verify-v8X.cjs         #   ① 字符串核查
│   └── smoke-v8X.cjs          #   ② 冒烟：grabFn+stub
├── app-scripts.cjs            #   APP_SCRIPT_PARTS 加载顺序（浏览器/bundle/require 共用）
└── tests/                     # 第 3-4 层：行为测试
    ├── lib.cjs                #   requireApp() 按 APP_SCRIPT_PARTS 拼接编译
    ├── run.cjs                #   --with-checks 连 checks
    ├── unit/                  #   ③ 单元（含 unit-clip-wins / unit-capacity / unit-today-sort 等）
    └── flow/                  #   ④ 流程旅程
```

## 运行

```powershell
node scripts/tests/run.cjs                 # 单元 + 流程（约 20 套件）
node scripts/tests/run.cjs --with-checks   # 再加上 checks 全量守卫
node scripts/checks/run.cjs                # 只跑 checks
node scripts/tests/unit/unit-parse.cjs     # 单跑一个套件
```

## 各层怎么用

| 层 | 什么时候写 | 特点 |
|---|---|---|
| ① verify 字符串核查 | 每个版本的关键结构/修复点 | 最快，但只能确认「代码还在」 |
| ② smoke 冒烟 | 版本的核心交互场景 | grabFn 抠真实函数体 + stub 依赖，实跑验证行为 |
| ③ unit 单元 | 纯函数逻辑（解析/评分/进度/习惯） | 直接 require app.js 调导出函数，最真实；断言相对日期，与运行日无关 |
| ④ flow 流程 | 跨函数用户旅程（增删改查全链路） | 同 smoke 机制，但串联 5-8 步验证数据同步 |

原则：**unit 管逻辑正确性，flow 管模块间同步，smoke 管版本修复不回退，verify 管结构不被误删**。新功能至少带一层；改 bug 先写复现测试再修。

## 约定

1. **零依赖**：只用 node 内置模块。新增套件直接丢 `unit/` 或 `flow/` 目录，run.cjs 自动扫到。
2. **独立进程**：每个套件单独 node 进程执行，require 缓存天然隔离，套件间互不影响。
3. **断言用相对日期**：`dkOf(daysAgo(n))` 生成日期键，任何一天跑结果一致（只跑一次的测试是没用的）。
4. **改节点后刷缓存**：`pickRanked` 等依赖 `_rankSlot` 缓存，测试里改完节点必须再调一次 `computeTree(nodes)`（内部 `beginTick()` 重置缓存）。
5. **buildCtx 是参数快照**：stub 行为要动态变化时，用可变标志位（如 `stubs.__flag`）而非重赋值。
6. **排错先单跑**：run.cjs 失败会同时打印 stdout+stderr，但最稳还是 `node <套件路径>` 直接看堆栈。
7. **Windows 0xC0000409 容错**：node 子进程偶发以 3221226505（STATUS_STACK_BUFFER_OVERRUN，libuv/管道层）异常退出，输出却完整全过——与测试逻辑无关。`checks/lib.cjs runSuite` 统一处理：catch 后 stdout 汇总行证明全过 → 重试 1 次 → 仍崩按过处理并打 ⚠（flaky）。所有套件执行都走 runSuite，看到 ⚠ 不用慌；真失败（含「M 失败」/无输出）不匹配全过正则，照常报 ✗。

## 已知边界（不测什么）

- **渲染层**：`buildView`/`renderPomoBar` 等依赖 DOM，node 下需完整 document stub，性价比低。靠手动实测 + smoke 兜底。
- **LLM 调用**：真实 AI 请求不进测试，全部 stub。
- **localStorage 持久化格式**：node 26 自带 localStorage（仅 ExperimentalWarning），序列化由 `serializeNodes` 单测覆盖。
