# GoalFlow 测试体系

测试是这个项目敢快速迭代的原因。纯前端、无构建、数据全在 localStorage 的应用，最怕「改 A 坏 B 不知道」。四层测试各管一段，全部零依赖（node 直跑 .cjs，无 jest/vitest/npm）。

## 四层结构

```
scripts/
├── checks/                    # 第 1-2 层：回归守卫（按版本组织，v8.2 ~ v8.10）
│   ├── lib.cjs                #   grabFn 从 app.js 源码抠函数 + 断言工具
│   ├── run.cjs                #   统一入口（自动扫 verify-*/smoke-*）
│   ├── verify-v8X.cjs         #   ① 字符串核查：确认关键代码结构没被改坏（防误删/防回退）
│   └── smoke-v8X.cjs          #   ② 冒烟：grabFn+stub 实跑某个版本的修复场景
└── tests/                     # 第 3-4 层：行为测试（按领域组织）
    ├── lib.cjs                #   requireApp() 真 require app.js + 断言工具
    ├── run.cjs                #   统一入口（--with-checks 连 checks 一起跑）
    ├── unit/                  #   ③ 单元测试：app.js 有 module.exports，直接 require 调真实函数
    │   ├── unit-parse.cjs     #     解析族（期限/尺度/重复/估时/文本→树）· 33 例
    │   ├── unit-node.cjs      #     节点族（VE/象限/树构建/进度/序列化/停放）· 30 例
    │   ├── unit-score.cjs     #     评分族（焦点分/优先级/完成分/番茄分/等级）· 33 例
    │   ├── unit-time.cjs      #     时间与习惯族（周键/停滞/习惯强度/SMART/拆解）· 30 例
    │   ├── unit-schedule.cjs  #     时间安排与期限族（跨天重算/期限写入口/排期转换/周期判定/时间冲突纠偏）· 55 例
    │   └── unit-history.cjs   #     仪式历史聚合族（评分/番茄/dkWeekLabel/晨晚周历史合并）· 34 例
    └── flow/                  #   ④ 流程测试：grabFn+stub 串多函数走完整用户旅程
        ├── flow-goal-lifecycle.cjs   # 项目全生命周期（解析→引用→替换→删节点→删项目→清空+撤销）· 7 例
        ├── flow-today-execution.cjs  # 今日执行（提到今天/撤回/澄清/采纳跨流）· 6 例
        ├── flow-today-pool.cjs       # 今日池容量与时间纠偏（预算截断/保底/全局避让/本批纠偏）· 7 例
        ├── flow-inbox.cjs            # 收件箱（捕获时间词/澄清/撤回/暂缓/容错）· 10 例
        ├── flow-habit-strength.cjs   # 习惯 30 天强度之旅（连续/漏打/低频/封顶）· 6 例
        └── flow-time-travel.cjs      # 时间旅行（跨天 streak/打卡分桶/提醒换天/日志分桶/排期过夜）· 39 例
```

## 运行

```powershell
node scripts/tests/run.cjs                 # 单元 + 流程（12 套件 290 例，约 2 秒）
node scripts/tests/run.cjs --with-checks   # 再加上 checks 全量守卫（18 环节 430 项）
node scripts/checks/run.cjs                # 只跑 checks（日常改代码后）
node scripts/tests/unit/unit-parse.cjs     # 单跑一个套件（排错时，stderr 完整可见）
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
