# GitHub 同类产品调研 · 功能点与可引入分析

> 调研日：2026-11-27  
> 目的：对照 GoalFlow（本地优先、目标树 → MIT/今日执行 → 仪式闭环、四象限、番茄、无账号）在 GitHub 上找相近个人效能/OKR 产品，枚举功能点，并判断哪些值得引入。  
> 口径：**可引入** = 不破坏「纯前端 / localStorage / 无强制云」边界，且补齐现有缺口；**慎引入** = 需后端/账号或偏离产品立场；**已有** = GoalFlow 已覆盖或等价。

---

## 1. GoalFlow 对照锚点（已有能力摘要）

| 能力域 | GoalFlow 现状 |
|--------|----------------|
| 目标结构 | 多项目工作流 + 文本解析目标树、尺度日/周/月/年 |
| 今日决策 | `focusScore` MIT、② 次重要、容量预算、溢出沉底、清单置顶 |
| 仪式 | 晨/晚/周计划/周月季回顾 + 历史 |
| 校准 | 四象限、价值×费力、桑基等多视角 |
| 习惯 | streak、强度衰减、打卡分轨 |
| 专注 | 番茄 25/50/90′、评分、执行日志 |
| 数据 | localStorage 双写、JSON 备份、ICS、文件绑定快照 |
| AI | 可选 DeepSeek 拆解/SMART（本机 Key） |

产品立场见 [PRODUCT-FLOW.md](../PRODUCT-FLOW.md)：看见精力错配、算法减决策、本地主权。

---

## 2. 样本库（按「与 GoalFlow 相近度」排序）

| 仓库 | 定位 | 许可 / 形态 | 相近理由 |
|------|------|-------------|----------|
| [trongdth/myOKR](https://github.com/trongdth/myOKR) | OKR + 今日 + 番茄 + 四象限 + 习惯，桌面 Tauri | 本地优先，可选 Dropbox | 与 GoalFlow 能力域几乎同构 |
| [thinkingjimmy/goalloom](https://github.com/thinkingjimmy/goalloom) | OKR 链到今日的时间地平线看板 | MIT，本地 SQLite | 「目标→今日」叙事极近，中英产品 |
| [zli117/RUOK](https://github.com/zli117/RUOK/) | 自托管年/月/周/日 OKR + 可编程分析 | AGPL，SQLite | 多尺度规划 + 估实时间 + AI 查询 |
| [Seven-Figure-Agency/personal-mission-control](https://github.com/Seven-Figure-Agency/personal-mission-control) | Rocks/Top3/看板/决策日志 | MIT，Next+SQLite | 季度大石头 + Top3 与 GoalFlow 周石头/MIT 同族 |
| [prpiece/momentum](https://github.com/prpiece/momentum) | 任务/日历/习惯/四象限/专注 + MCP | MIT，本地优先 | 日计划全家桶，可选同步 |
| [spuder/OpenThings](https://github.com/spuder/OpenThings) | Things 风格 Today/Upcoming + 番茄 + 脑暴 | MIT，自托管 POC | 收件箱时效清理、键盘优先 |
| [Avithegod2010/Goalcheck](https://github.com/Avithegod2010/Goalcheck) | 多目标清单 + 多视图 + 周回顾 Wrapped | MIT，PWA/IndexedDB | 本地纯前端路线，功能过载可参考「砍哪些」 |
| [super-productivity/super-productivity](https://github.com/super-productivity/super-productivity/) | 日计划 + 时间追踪 + 看板/四象限 | MIT，~24k★ | 成熟对照：日程并排、Flowtime、休息提醒 |
| [kaijiabo/open-sunsama](https://github.com/kaijiabo/open-sunsama)（[介绍页](https://opensunsama.com/open-source-task-manager)） | 日看板 + 日历 time-block + MCP | 非商业许可 | 日程拖拽排时对标；许可不适合整仓抄 |
| [islamdiaa/focus-assistant](https://github.com/islamdiaa/focus-assistant) | Today + 四象限 + 周回顾 + Markdown 存盘 | MIT，Docker | ADHD 友好、等待监控、Focus Goals≤3 |
| [tanghoong/focusflow](https://github.com/tanghoong/focusflow) | Kanban×番茄 PWA | MIT | 任务×时间耦合、模板库 |
| [Jinjinov/OpenHabitTracker](https://github.com/jinjinov/OpenHabitTracker) | 习惯/任务/笔记 | GPL，多端 | 习惯「逾期百分比」而非只看 streak |

未纳入深表但相邻：Habitica（游戏化社交）、Org-mode/Logseq（笔记图谱）——与「双击即用 SPA」栈差异过大，仅作理念参考。

---

## 3. 功能点总表（竞品有 · GoalFlow 对照）

图例：✅ 已有/近似 · 🔶 部分有 · ❌ 没有 · ★ 建议优先引入 · ○ 可考虑 · ✕ 不引入/慎引入

| 功能点 | 出现产品 | GF | 建议 |
|--------|----------|-----|------|
| 今日视图 / MIT·Top3 | myOKR, Goalloom, Mission Control, FocusAssist, Super Productivity | ✅ | — |
| 任务自动按目标评分进今日 | myOKR | ✅ focusScore | — |
| 按番茄预算裁剪今日清单 | myOKR | ✅ dayCap/溢出 | — |
| Skip / 换一批今日候选 | myOKR | ❌ | ★ |
| OKR 周期克隆（上月结构种子） | myOKR | ❌ | ○ |
| KR 信心红黄绿 + 周检查向导 | myOKR, RUOK | 🔶 conf 字段 | ★ 强化周回顾 |
| 习惯挂到 KR 自动推进进度 | myOKR | ❌ | ★ |
| 习惯生命周期（想养成/进行中/已养成） | myOKR | ❌ | ○ |
| 习惯月历格 / 年热力 | myOKR, Momentum, GoalCheck, OpenHabitTracker | 🔶 有 365 热力视角 | ○ 习惯专用格 |
| 逾期% 习惯分（非纯 streak） | OpenHabitTracker | 🔶 habitStrength | ○ 展示层可借鉴 |
| 时间地平线列（季/月/周/今日并排） | Goalloom | 🔶 尺度缩放 | ★ 规划视图一列板 |
| 目标链可视化（滤一目标亮路径） | Goalloom | ❌ | ★ |
| 未完成跨周期自动滚存 | Goalloom, Open Sunsama | 🔶 部分 | ★ 显式「滚到今天」策略 |
| 全局撤销栈（非单次 toast） | Goalloom | 🔶 危险操作 10s | ○ |
| Cmd+K 全局搜索 | Goalloom, Mission Control, GoalCheck | ❌ | ★ |
| 自然语言快捕解析（@今天 !高） | Goalloom, Super Productivity, GoalCheck | 🔶 inbox 时间词 | ○ 增强语法 |
| 年→月→周→日 rollup 进度 | RUOK | 🔶 树进度 | ○ |
| 可编程查询 / 仪表盘小部件 | RUOK | ❌ | ✕ 偏重，偏离双击即用 |
| 外部健康数据插件（Fitbit 等） | RUOK | ❌ | ✕ |
| 决策日志 / 会议纪要抽任务 | Mission Control | ❌ | ○ 轻量「决策卡」可选 |
| 6 态看板 | Mission Control, Super Productivity | 🔶 看板视角 | ○ |
| 日历并排 + 拖拽 time-block | Momentum, Open Sunsama, Super Productivity | 🔶 有 time/planDate | ★ 轻量日时间轴 |
| 休息提醒 / Flowtime | Super Productivity | ❌ | ★ 休息提醒 |
| 反拖延透视提示 | Super Productivity | ❌ | ○ |
| 议题源集成（Jira/GitHub…） | Super Productivity | ❌ | ✕ 个人工具边界 |
| 强制云账号 / 多人共享列表 | Momentum 可选 | ❌ | ✕ 主路径 |
| 脑暴区 48h 自清理 | OpenThings | 🔶 inbox someday | ★ 收件箱保鲜策略 |
| Deep Focus 全屏单任务 | GoalCheck, OpenThings | 🔶 番茄顶线 | ○ |
| Year-in-Review Wrapped | GoalCheck | ❌ | ○ 年终一页 |
| 第三方清单导入（Todoist 等） | GoalCheck | ❌ | ○ |
| Markdown 为人可读主存储 | FocusAssist | ❌ JSON | ○ 导出 Markdown 周报 |
| Focus Goals 每日最多 3 星 | FocusAssist | 🔶 MIT+② | ○ 显式「今日最多 N」 |
| 等待中监控列表 | FocusAssist | ✅ waiting/blocked | — |
| MCP / Agent CLI | Momentum, OpenThings, Open Sunsama | ❌ | ○ 可选，非核心 |
| 离线生成专注音乐 | myOKR | ❌ | ○ 低优先级彩蛋 |
| Dropbox/WebDAV 自有同步 | myOKR, Super Productivity | 🔶 文件绑定 | ○ 文档化「用网盘同步备份文件」 |
| RPG/社交裂变 | GoalCheck Advance, Habitica | ❌ | ✕ 产品禁区 |

---

## 4. 可引入分析（按优先级）

### P0 · 高契合、改动面可控（建议排进路线图）

1. **今日候选「换一批 / Skip」**（myOKR）  
   - 现状：算法钉 MIT，用户只能手动改。  
   - 引入：在 MIT/清单头增加「换一批」——从同池按 `focusScore` 跳过当前 Top，写入当日 `skippedIds`，不改树结构。  
   - 依据：[myOKR README · Daily Focus](https://github.com/trongdth/myOKR)

2. **Cmd/Ctrl+K 全局搜索**（Goalloom / Mission Control / GoalCheck）  
   - 搜项目名、节点文案、收件箱；回车跳规划树或「提到今天」。  
   - 依据：[goalloom](https://github.com/thinkingjimmy/goalloom)、[personal-mission-control](https://github.com/Seven-Figure-Agency/personal-mission-control)

3. **目标链高亮**（Goalloom）  
   - 选中一目标/标签时，今日清单与树只高亮该链（或半透明压暗其它）。链接解释「为什么做」，不必做进度 rollup。  
   - 依据：[goalloom · Every to-do knows why](https://github.com/thinkingjimmy/goalloom)

4. **轻量日时间轴（非完整日历产品）**（Open Sunsama / Super Productivity）  
   - 在今日视图用已有 `time` + 容量窗口画一条纵向时间轴，拖拽改 `time`（冲突仍走 `resolveTimeConflicts`）。不做 Google 日历双向同步。  
   - 依据：[Open Sunsama 介绍](https://opensunsama.com/open-source-task-manager)、[Super Productivity](https://github.com/super-productivity/super-productivity/)

5. **休息提醒（番茄间）**（Super Productivity）  
   - 连续专注 N 分钟后 toast/仪式条提示离开座位；可关。符合行为科学，不增云依赖。  
   - 依据：[Super Productivity · healthy habits](https://github.com/super-productivity/super-productivity/)

6. **收件箱保鲜**（OpenThings 脑暴 48h）  
   - `inbox` 超过 N 天未澄清 → 自动 someday 或角标「将过期」。  
   - 依据：[OpenThings](https://github.com/spuder/OpenThings)

### P1 · 值得做，但要设计约束

| 项 | 为什么 | 约束 |
|----|--------|------|
| 习惯→KR 自动推进 | myOKR 把日常打卡接到目标进度 | 仅 `role=KR` 且用户显式链接；禁止静默改 targetDone |
| 周回顾「逐步 KR 检查」向导 | myOKR Weekly Review Wizard | 复用现有 `openReview`，加步进 UI，不新建存储体系 |
| 规划「四列时间板」 | Goalloom | 用现有 scale/deadline 投影，勿再造第二套任务模型 |
| 显式跨周期滚存按钮 | Goalloom | 「未完成滚到今天」批量 `promoteNodeToToday`，带容量警告 |
| Focus Goals 上限（≤3） | FocusAssist | 与容量条联动：超 3 警告，不硬拦 |
| Markdown 周报导出 | FocusAssist | 只导出，不改主存储为 Markdown |
| Year Wrapped | GoalCheck | 年终一页，数据来自 executionLog/scoreLog |

### P2 · 可选 / 低优先级

- 习惯月历格、Deep Focus 全屏、离线白噪声、第三方清单导入、决策日志轻卡、MCP 只读接口。  
- Dropbox 级同步：优先**文档化**「备份 JSON / 绑定文件 + Syncthing」，不做内置 OAuth。

### 明确不引入（或极低优先）

| 项 | 原因 |
|----|------|
| 强制账号、多人共享列表、社交/RPG 裂变 | 与 PRODUCT-FLOW「本地主权 / 非裂变」冲突 |
| Jira/GitHub 议题同步 | Super Productivity 强项；GoalFlow 是个人目标流非工单台 |
| 可编程 JS 查询引擎、Fitbit 插件 | RUOK 路线；运维与心智负担过大 |
| 完整商业日历套件 | 许可与范围爆炸；用 ICS 导出即可 |
| Open Sunsama 整仓依赖 | [非商业许可](https://opensunsama.com/open-source-task-manager)，只可借鉴交互 |

---

## 5. 建议落地顺序（若开干）

```mermaid
flowchart LR
  A[Skip换一批] --> B[全局搜索CmdK]
  B --> C[目标链高亮]
  C --> D[今日时间轴]
  D --> E[休息提醒]
  E --> F[Inbox保鲜]
  F --> G[习惯链KR + 周KR向导]
```

每步：`@goalflow-test-case-generator` 出评审用例 → unit/flow/verify → bump `?v=`。

---

## 6. 竞品相对 GoalFlow 的差异结论

| GoalFlow 已领先或特色 | 竞品常有而 GF 弱 |
|----------------------|------------------|
| 桑基精力流、算法 MIT、仪式历史一体 | 时间地平线并排板、目标链可视化 |
| 纯浏览器零构建、双击即用 | Cmd+K、Skip 换一批、日历 time-block |
| 容量超支警告、执行/估实闭环 | 休息提醒、收件箱保鲜策略 |
| 无账号隐私默认 | 成熟桌面托盘/多端（非本仓目标） |

**一句话**：最值得抄的是 **myOKR 的「今日可换一批 + KR 周检」**、**Goalloom 的「时间列 + 目标链」**、**Super Productivity 的「休息提醒 + 日时间轴」**；不要抄成第二个全能 Super Productivity 或 RUOK 分析平台。

---

## Sources

- [trongdth/myOKR](https://github.com/trongdth/myOKR)
- [thinkingjimmy/goalloom](https://github.com/thinkingjimmy/goalloom)
- [zli117/RUOK](https://github.com/zli117/RUOK/)
- [Seven-Figure-Agency/personal-mission-control](https://github.com/Seven-Figure-Agency/personal-mission-control)
- [prpiece/momentum](https://github.com/prpiece/momentum)
- [spuder/OpenThings](https://github.com/spuder/OpenThings)
- [Avithegod2010/Goalcheck](https://github.com/Avithegod2010/Goalcheck)
- [super-productivity/super-productivity](https://github.com/super-productivity/super-productivity/)
- [Open Sunsama 介绍页](https://opensunsama.com/open-source-task-manager) · [kaijiabo/open-sunsama](https://github.com/kaijiabo/open-sunsama)
- [islamdiaa/focus-assistant](https://github.com/islamdiaa/focus-assistant)
- [tanghoong/focusflow](https://github.com/tanghoong/focusflow)
- [Jinjinov/OpenHabitTracker](https://github.com/jinjinov/OpenHabitTracker)
- [myOKR 0.2.0 博文](https://code4food.work/blog/myokr-0-2-0/)（2026-07）
