## 1. 采用的方式

该仓库是一个纯前端零构建项目（单页 `index.html` + `assets/js/app.js` + `assets/css/*` + `demos/`），没有 Node 后端、无第三方日志库、无结构化日志框架。程序对「日志」的处理分为两个层面：

1. **运行时调试输出**：仅使用浏览器原生 `console.log / console.warn / console.error / console.info / console.table`，所有日志统一以 `[GoalFlow]` 前缀标记来源，例如：
   - `console.info('[GoalFlow] 已从单树存储迁移到项目')`
   - `console.warn('[GoalFlow] 保存失败', e)`
   - `console.error('AI decompose parse error:', e)`
   - `console.table(rows)` 用于导出调试面板。

2. **持久化业务日志**：状态对象中内嵌了多个名为 `log` 字段的数据结构，用于持久化习惯与执行历史，并非通常意义上的「输出日志」：
   - `state.meta.scoreLog[日期].entries[]` — 评分理由记录（`kind / nodeId / text / wfId / score / reason`）
   - `state.meta.habitStreaks[key].log[日期]` — 习惯打卡明细 `{ done, act }`，配合 `freqDecay` 计算习惯强度衰减
   - `state.meta.executionLog[日期].entries[]` — 按日聚合的任务执行条目（`est / act / completedCount`），供统计与周回顾页面消费。

这些「log」键是数据域命名，不对外部系统路由，也不属于统一的日志管道。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `assets/js/app.js` | 唯一的运行期脚本，承载全部 `console.*` 调用及上述持久化 log 结构的读写 |
| `scripts/inline-bundle.mjs` | 打包脚本，含一行 `console.log(Wrote ...)` |
| `openmemory.md` | 需求文档中对 `habitStreaks.key.log`、`executionLog`、`scoreLog` 的数据字段进行了规格化描述 |

## 3. 架构与约定

- **无集中式 logger 初始化**：未定义任何 Logger class、配置对象或模块。日志输出分散在调用点附近，只有 `[GoalFlow]` 字符串前缀这一弱约定来标识来源。
- **无日志等级机制**：`error` 只用于 AI 解析失败等异常分支；`warn` 用于持久化失败的边界情况；`info/log` 用于流程提示和裁剪审计；不存在可切换的级别（如 DEBUG/INFO/WARN/ERROR）控制开关。
- **无外部 sink**：所有日志直接输出到浏览器控制台；没有写入 `localStorage`、网络端点、文件或使用服务 Worker 转发的实现。
- **持久化 log 是领域状态**：`scoreLog`、`habitStreaks[].log`、`executionLog` 是应用状态的序列化一部分（随 `m.logsTrimmedAt` 一起被滚动裁剪），不是独立的日志子系统。
- **日志裁剪策略**：`assets/js/app.js` 中的 `LOG_KEEP_DAYS` 常量决定保留最近 N 天的逐条明细（默认值见源码），并触发 `console.info('[GoalFlow] 滚动裁剪…')`。

## 4. 观察到的约定与约束

- 人类可读的提示性消息一律使用中文，并以 `[GoalFlow]` 作为来源标签（来源于 `app.js` 内多处 `console.info` 调用）。
- 解析异常走 `console.error`，持久化失败走 `console.warn`，成功/诊断消息走 `console.info` —— 这是代码中的行为模式，但并未通过类型系统或 Lint 规则强制（仓库无 lint 配置文件）。
- 业务侧的 `scoreLog`、`habitStreaks[].log`、`executionLog` 字段名由需求文档 `openmemory.md` 与实现共同约定，跨周期会按日期 key 自动清理过期条目，且仅在读取路径判断是否为空时做防御式 `|| {}` 处理，未见校验 schema。
- 该项目不存在独立日志库依赖项（包清单为空），因此该仓库**不适用**传统后端项目中成熟的 logging system 范畴——更准确地说，它是一套极轻量的浏览器调试惯例 + 内置于状态树的业务明细记录。

### 结论

仓库对「logging」的定义仅限于：① 面向开发者的原生 `console.*` 前缀消息；② 作为持久化状态一部分的任务/习惯执行明细。没有统一的 log level 策略、集中式 logger、sink 路由或结构化日志输出设施。