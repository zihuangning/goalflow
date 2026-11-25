# GoalFlow（目标流）

## Overview
单文件纯前端工具（`index.html`）：年度目标树 → 桑基精力图 → 算法选出「当下最重要」→ 四象限校准。数据仅存浏览器 localStorage，可选 DeepSeek 拆解。

**project_id:** zihuangning/goalflow

## Architecture
- **入口:** `index.html` + `assets/css/main.css` + `assets/js/{gf-tokens,gf-demos,app}.js`
- **设计系统:** `gf-` 前缀组件；`docs/DESIGN-SYSTEM.md`
- **状态:** `state.workflows[]` **项目**（目标流）：`id/name/tags[]/startDate/endDate/description/color + nodes/topId`；`state.activeWorkflowId`；`state.nodes` 为当前流镜像；`state.meta` 周回顾等
- **持久化:** `goalfocus.workflows.v2` 主键 + `goalfocus.workflows.bak` 镜像（每次 save 双写）；加载顺序 v2→bak→v1→单树；`console` 有诊断（`goalflowStorageReport()`）；`beforeunload` 兜底保存；`meta.lastSavedAt` 显示于侧栏 `#wsStore`；`goalfocus.meta.v1`（回顾/执行/评分）
- **核心算法:** `parseText` → `focusScore` / `pickRanked` → `buildView` + `sankeyLayout`
- **测试钩子:** `module.exports` 导出 60 纯函数（node 26 可直接 require，仅 ExperimentalWarning localStorage 提示）
- **测试体系:** 四层——`scripts/checks/`（verify 字符串守卫+smoke 冒烟，按版本 v8.2~v8.10）+ `scripts/tests/`（unit 真 require 单测 + flow grabFn+stub 用户旅程，按领域组织）。运行：`node scripts/tests/run.cjs [--with-checks]`。文档 `docs/TESTING.md`（体系+约定）+ `docs/TEST-CASES.md`（384+ 项用例矩阵）

## User Defined Namespaces
- （留空）

## Components
**三视图 v6.0（`switchView`）**：`.main-scroll` 内三个 `section.view`（单显 `.on`）——`#view-today`（默认主页：hero-wrap+metricsStrip+pomoBar → `#todayPanel` → `#focusPanel`）、`#view-plan`（panelInput/panelTree/panelSmart 纵向堆叠）、`#view-insights`（canvasPanel/quadPanel）；rail+侧栏用 `[data-nav]` 按钮切换（`VIEWS` 映射 crumb）；记忆 `localStorage goalflow.view`；深链 `#/today|plan|insights`，旧 `#day` 等尺度深链设 scale 并跳 insights；切到 insights 时 rAF 重绘 `renderCanvas/renderQuadrant`；侧栏增「仪式」组（sideMorning/sideEvening/sideWeekPlan/sideWeekReview）；双列 `.wrap` grid 已废弃

| 区域 | 作用 |
|------|------|
| 今日行动 `#todayPanel` | **四分区去重**（v6.3）：MIT（唯一）→ 执行清单按时段分组（非习惯、非 MIT，未排期归 📥）→ 习惯打卡（recur/habit + 🔥streak）→ ✅ 今日已完成（executionLog 当日）；行内 ⏰/时长/时段；`#todayAlarmBar` |
| 项目总览 `#projectModal` | 点项目名打开：整体/分支进度条、今日待办数、近 7 天执行（估/实/偏差）、习惯连续；入口 🗺 重新规划 + ✎ 设置 |
| 规划向导 `#planWizardModal` | 必经步骤（【里程碑】【例行】【习惯】【行动】，decomposeSuggestions 预填）→ 生成子节点：里程碑按达成日均排 deadline、例行 recur week、习惯 day+slot、行动 day+30′；新建项目后引导至目标规划 |
| 多项目 `#wfBar` | **手风琴列表**（v6.2）：独立区块（非 side-ws 内），可多展开；展开 = 项目本地概览（标签/时间段/叶子进度条/树预览/今日待办数），不含视图链接——视图归下方「视图」导航（项目选哪个目标，视图选怎么看）；✎ 设置；＋新建；底部 **项目关系**（共享标签 × 时间段重叠）；展开状态存 `meta.wfExpanded` |
| 英雄卡 + 执行栈 | Top1 + #2/#3 候选 |
| 精力流向图 | 年/月/周/日缩放、聚焦模式 |
| 四象限 + V/E 矩阵 | 拖拽校准；价值/费力；⚡快速赢筛选；叶子：时段、微动作、SMART |
| 精力图多视角 | `viewMode`: 桑基/关系/看板/脑图/365热力 |
| 回顾 v5.3 | `openReview` 周·月·季 + OKR 进度块 |
| 度量 | `role` O/KR/习惯 · `targetNum`/`targetDone` · pace line · `metricsStrip` |
| 番茄钟 v5.4 | 英雄卡 🍅 25′ 绑定 Top1 · `#pomoBar` 进度条+% · `#pomoTopLine` 顶部金线（body.focus-timer-on） |
| 自动评分 | `scoreDoneItem`/`scorePomoItem` → `meta.scoreLog[dk]`；`todayScore()` 汇总；`#todayScore` 总评分块（S/A/B/C，日目标 100） |
| 早晚仪式闹钟 | `meta.ritual{morning,evening,on}`；`tickRitualAlarms` 30s 检查到点弹 `#ritualModal`（晨=MIT+容量+调整入口，晚=逐项得分+未完成+dayNotes 总结）；`#todayAlarmBar` 时间设置+手动打开 |
| 时间审计 v5.5 | `timeAudit(7)` 聚合 executionLog → `#todayAudit`（按工作流/象限 bars）；估/实偏差 `bias=pairAct/pairEst`；`applyCalibratedBuffer` 一键缓冲今日预估 |
| 回顾→Act | ritual 模板 `next` 字段 → `meta.pendingActions[]`；晨计划「采纳」`adoptPendingAction` 插入当前流根（scale=day）/「跳过」 |
| WOOP 执行意图 | 叶子 `ifThen` 字段（序列化 v5.5+）；今日行 🛡 行内编辑；晨计划 MIT 缺预案时提示补全 |
| 周计划仪式 | `meta.weekPlans[wk].rocks[]`；`openWeekPlan` 候选=跨流 im≥4 叶子 top12 选≤5；`#todayRocks` 石头条可勾完成；周一晨自动弹（`weekplan\|wk`） |
| 停滞预警 v5.6 | `stagnationAlerts(7)`：`stagnantDays`=今−(touchedAt\|\|createdAt)，双 null=999；跨流 im≥4 叶 → `#todayStale` 条+晨计划区；「⚡激活到今日」`activateStale` |
| **v7 收件箱** | `meta.inbox[]`（status: inbox/someday/trashed/clarified + snoozeUntil）；`addInbox` 解析自然语言时间词→`remindAt`；`clarifyInbox` 四选一（→任务插根下 scale=day / ☁以后 / 💤明天 / ×丢）；`#inboxPanel`（今日面板底部）`renderInboxPanel` |
| **v7 等待/阻塞** | 节点 `status`('waiting'\|'blocked')+`waitNote`；`isNodeParked` → `focusScore` −45/−60、`pickRanked`/`todayExecutionPoolFor` 排除；行内 ⏳/🚫 按钮 + prompt 注明原因；`#todayParked` 暂停条（可见不竞选，↩解除） |
| **v7 英雄卡得分分解** | `focusScoreParts(n)` 逐条加分（重要/期限阶梯/长期主线/等待/阻塞/停滞）；`renderHero` 增 `.hero-score` 行；`pickHeroTop` 习惯（recur/role=habit）退出英雄卡竞选 |
| **v7 习惯分轨** | 节点 `timesPerWeek`（解析「每周N次」）；`meta.habitStreaks[key].log{dk:{done,act}}` + `freqDecay`（日 0.02 / 低频 0.012）；`habitStrength` Loop 式衰减（做+5% 漏−freqDecay，不清零）；`habitWeekLog` 本周 done/target；今日行 `📈 本周 x/y · 强度z%`；习惯不抢各流 Top1（`todayAggregatedPool` 内 Top1 是习惯则换首个非习惯） |
| **v7 计划带宽** | `meta.planShare{wfId:%}`；项目设置弹窗 `#wfmShare`；`planVsActual` 近 7 天 executionLog 按流聚合 act/est；`#planShare`（hero 上）`renderPlanShareStrip`：计划条（灰）叠实际条（彩）+ 对齐/超投/不足 tag |
| **v7 KR 信心** | 节点 `conf`(0-5)/`confNote`/`confAt`；metricsStrip KR pill 内 💪 按钮 prompt 打卡；月/季回顾 okr 行显示信心；`computePeriodStats` 增 `progressed`/`stalled`（本周期 touched/完成/指标）；月/季回顾「🎯 目标前进了没有」区块（✅有前进 / ⏸原地） |
| **v7 MIT 精力拖拽** | 今日行 `draggable`；`#todaySlots` 时段列 `.drop-slot`（`data-slotdrop`），精力高峰列 `.peak`（⚡标记，来自 `energyCurve().peak`→ENERGY_BUCKETS 映射）；dragover/drop → 钉 `n.slot`；MIT 块上 `.mit-energy` 提示是否在高峰 |
| **v7 晚总结处置** | `meta.eveningDispo{dk|wf|node: action}`；晚总结未完成行三按钮：继续（deadline=明天+scale=day）/ 改期（prompt→parseDeadline）/ 放弃（done+dropped）；`renderParkedStrip` 配合 |
| **v8 节点工厂** | `newNode(partial)` 统一字段（含 source/_manualIm/_manualUr/dropped）；所有新节点走工厂（parseText/insertChildren/adoptPendingAction/generatePlanFromSteps/clarifyInbox→appendActionLeaf）；`source` 标记来源（parse/wizard/inbox/review/insert） |
| **v8 手动优先** | `_manualIm/_manualUr`：四象限拖拽 + 树形行内 im/ur 输入设置；`applySuggestions` 不再覆盖手动值；树形行内新增 `.trow-im/.trow-ur` |
| **v8 树形拖拽换父** | `.trow` 行 draggable → 拖到另一行挂为其子（防环校验 + confirm） |
| **v8 计划生成改进** | `planStepsSuggestion` 带入目标文本数字/期限（quant 注入首个里程碑）；里程碑按 `order` 依赖排序（非均匀撒）；`removeWizardNodes` 重新规划先清 `source==='wizard'` 子树 |
| **v8 今日容量** | `todayExecutionPoolFor` 估时累计超 `DAY_CAPACITY_MIN` → `_overflow`（不进清单）；`dayPlanFeasibilityAll` 改用池同口径（不再只算 scale=day） |
| **v8 高峰加权** | `focusScore` 对 `eff>=4 && slot` 落在当前精力高峰段 +6（依赖 `energyCurve().peak===energyBucketNow()`） |
| **v8 回顾闭环** | `pendingActions` 增 `wfId`（采纳回原地非当前流）；`appendActionLeaf` 统一插入（adopt/clarify/月回顾补行动共用）；月/季回顾停滞目标行内「→ 补行动」→ 晨计划待确认 |
| **v8 数据一致性** | `flushActiveWorkflow` 不再拷贝（`w.nodes = state.nodes` 引用相等判断）；`setNodeDoneInWorkflow` 简化为临时切流；习惯取消勾选回滚 `targetDone`（计数型） |
| 事前验尸 | 根节点 `premortem`；`#premortemCard`（SMART 面板顶，`renderSmart` 调用）存档/重审 |
| 精力曲线 | `meta.energyLog{dk:{am,pm,eve}}` 3 桶（5-12/12-18/其余）；`#todayEnergy` 五级打卡；近 14 天 `energyCurve()` → 高峰桶映射 DAY_SLOTS 建议重任务排程 |
| 树形维护 | 内联编辑、估时、同步到文本框 |
| Backlog 泳道 | 聚焦清单：上周未完成 / 下月预告（不进 Top3） |
| ICS 导出 | 仅 `deadlineDate` 叶子，顶栏本地下载 |
| 聚焦清单 | Top3 + 立即做 / 核心投入 |
| 顶栏 | 进度、备份/恢复、周回顾 |
| 面板折叠 v6.3 | 审计/停滞/精力包 `<details class="fold">` 默认折叠，summary 带关键摘要；状态记忆 `goalflow.folds`（`foldOpen/bindFoldPersist`）；精力打卡按钮留在 summary（`.fold-keep` stopPropagation） |
| 备份提醒 | `exportBackup` 写 `meta.lastBackupAt`；`renderBackupTip` >7 天在今日面板提示（`#todayBackupBar`） |
| 倦怠预警 | `burnoutSignal`：近 3 天有数据天中 ≥2 天「精力均 ≤2.4 且评分 <40」→ `#todayBurnout` 恢复提示 |
| 新手引导 | 首次 `load()` 无数据 → 自动 `loadDemo()`；`#onboardCard` 三步卡，`meta.onboarded` 关闭 |
| 撤销 v6.3 | `showUndoToast`（`#toast`，10s 窗口）；`deleteNode`/`clearAll` 操作前快照 state，点撤销恢复 |
| 三件好事 | 晚总结 `rtGood1-3` → `meta.goodThings[dk][]`（峰终定律积极收尾） |
| 前一晚预选 MIT | 晚总结 radio 预选（候选=未完成 top4）→ `meta.tomorrowMit{forDate,wfId,nodeId}`；晨计划 `preMit` 优先显示「🌙昨晚预选」，「✓就是它」钉 scale=day+touchedAt 并清除 /「换一个」清除回算法 MIT |
| 面板折叠 v6.3 | 审计/停滞/精力包 `<details class="fold">` 默认折叠，summary 带关键摘要；状态记忆 `goalflow.folds`（`foldOpen/bindFoldPersist`）；精力打卡按钮留在 summary（`.fold-keep` stopPropagation） |
| 备份提醒 | `exportBackup` 写 `meta.lastBackupAt`；`renderBackupTip` >7 天在今日面板提示（`#todayBackupBar`） |
| 倦怠预警 | `burnoutSignal`：近 3 天有数据天中 ≥2 天「精力均 ≤2.4 且评分 <40」→ `#todayBurnout` 恢复提示 |
| 新手引导 | 首次 `load()` 无数据 → 自动 `loadDemo()`；`#onboardCard` 三步卡，`meta.onboarded` 关闭 |
| 撤销 v6.3 | `showUndoToast`（`#toast`，10s 窗口）；`deleteNode`/`clearAll` 操作前快照 state，点撤销恢复 |
| 三件好事 | 晚总结 `rtGood1-3` → `meta.goodThings[dk][]`（峰终定律积极收尾） |
| 前一晚预选 MIT | 晚总结 radio 预选（候选=未完成 top4）→ `meta.tomorrowMit{forDate,wfId,nodeId}`；晨计划 `preMit` 优先显示「🌙昨晚预选」，「✓就是它」钉 scale=day+touchedAt 并清除 /「换一个」清除回算法 MIT |
| 移动端 H5 v6.2 | ≤900px：底部 tab `.mtab`（3 data-nav + `#mtabWeekReview`）替代 rail/侧栏；顶栏隐藏 ICS/恢复/主题下拉；弹窗全屏（≤640px，`100dvh`）；桑基图靠 `canvas-wrap overflow:auto` + SVG 显式宽高天然横滑（零改动）；四象限仅查看（`.m-only` 提示）；闹钟=页面弹窗式，`wakeCheck` 在 visibilitychange/pageshow/focus 时补跑 tickReminders/tickRitualAlarms/renderPomoBar（锁屏挂起兜底）；无 Notification 时 `requestAlarmPermission` 静默降级 |
| **v6.4 Q2 目标线** | `meta.q2Target`（默认 50，10-90 可调）；`renderTimeAudit` 加 `.ta-q2` 块（达成✓/偏低/严重不足三档）；周回顾「核心 vs 救火」下加 Q2 时间行（timeAudit 7/30/90 复用） |
| **v6.4 习惯 anchor** | 节点 `anchor` 字段（⚓习惯叠加，「在X之后」）；今日行 ⚓ 按钮行内编辑；执行区习惯按 anchor 聚类（`.habit-anchor-h` 分组标题），未设的沉底提醒；晨计划 `noAnchor` 提醒补设 |
| **v6.4 快捷键+番茄暂停** | 全局 keydown：`1/2/3` 切三视图、`t` 今日、`c` `quickCapture()`（切今日+focus #ibQuick）、空格 `togglePomoPause()`；跳过输入框/修饰键/弹窗开时；番茄 `paused/remainMs` 字段，⏸/▶ 按钮；移动端 `.mtab` 中央 ⚡FAB `#mtabCapture` |
| **v6.5 承诺卡** | 周计划 wpSave → `openCommitCard(wk,picks)`（石头清单+意图 textarea），「✍️我承诺」才落库 `weekPlans[wk]={rocks,intent,committedAt}`；周回顾 stats pane 开头 `.wr-commit` 对照块（履约 doneN/total + 逐条 ✅/○，仅 week 周期） |
| **v6.5 梯度冲刺** | `renderHero` 中 `subtreeProgress(top).pct>=80` → `.pill-sprint`「🔥冲刺·还剩N个叶子」（目标梯度效应） |
| **v6.5 深潜块** | 英雄卡番茄 25/50/90′ 三档（btnPomo25/50/90）；`scorePomoItem` 加权 ≥50+4、≥90+6；`renderPomoBar` `pomoMode` 按分钟显 🍅专注/长专注/🌊深潜（BRAC/ultradian） |
| **v6.5 归档** | 工作流 `archived/archivedAt`；`isWorkflowComplete`=叶子100%完成；侧栏 `#wfBar` 拆 live/归档两区（完成项 🏆 按钮 → `archiveWorkflow` → `openArchiveCelebrate` 庆祝卡复用 #weekReviewModal；归档区 ↩恢复）；`activeWorkflows()` 过滤器排除归档——已应用于 `todayAggregatedPool`/本周承诺容量/`stagnationAlerts`/`weekPlanCandidates` 四处 |
| **v7.9 每日时段窗口** | `meta.capacity[wfId]` 增 `winStart/winEnd`（'HH:MM'，项目设置弹窗「每日可安排」）；`wfTimeWindow(wfId)` 读取；注入 `buildAIDecomposeInput`（AI 排期必须落窗口内）；留空=全天。用途：只能休息时间做的项目（副业 19:00-22:00） |
| **v7.9 AI 失败明示+回滚** | `callLLM` 失败写 `_llmLastError`（区分 401 key无效/402 余额不足/429 限流/网络），`lastLLMError()` 读取；`autoDecomposeGoal` 失败 → `failAndRollback` 删除刚创建的空项目（>1 项目时）+ toast 具体原因；`showDecomposeGuide(node, reason)` 副标题显示原因 |
| **v7.9 未开始项目不进今日** | `wfStarted(wf)` 判 startDate<=今天；`todayAggregatedPool`/`dayPlanFeasibilityAll` 排除未开始项目；AI 分解的未来日期任务挂 `planDate`（'YYYY-MM-DDTHH:MM'）而非 `time`，`normalizeNode` 到期当天自动转 `time` 进今日排序 |
| **v7.9 全局唯一 MIT** | `heroGlobalCandidates()` 跨全部已开始+未归档项目选英雄卡；`renderHero`/`syncTop` 同源；`state.topWfId` 记 MIT 所属项目；番茄 `pomo.wfId` 跨项目归账；MIT 跨项目查找 `nodeInWorkflow(topWfId,...)` |
| **v7.9 排序+闹钟歧义** | 今日清单：有 `time` 升序 → 无 time 按 `slotRank(h0-h6)` 粗排 → focusScore；⏰=闹钟（弹通知）/🕐=计划时间（只排序不提醒），行内 title 已注明 |
| **v8.0 今日页 UX 精简** | 原则=默认极简（MIT+清单+习惯），次级全部可点开但默认收折。①英雄卡：7pill→3pill（分类/期限/冲刺），得分+进度+节奏收进「📊得分·进度与分解」details；番茄 25/50/90 三独立按钮→主按钮+`#pomoLen` 档位下拉 ②闹钟条 8 控件→🌅/🌙时间+🔔开关+「⏰仪式」弹出菜单（晨/晚/周计划/周回顾+权限说明.am-foot）③度量条：KR pill 收进「指标N▾」`.ms-kr-fold`，移除 Top1 分 ④习惯 meta 4 段→1 条（📈x/y 🔥n，详情在 title）⑤容量 3 条→今日 1 条+「周预算▾」`.dc-fold` ⑥planShare 从 hero 上迁入 zoneStatus ⑦hero-eyebrow 删除、metricsStrip 移到 hero 与 todayPanel 之间 ⑧CSS：`.hero-pomo-group`/`.alarm-menu`（移动端 fixed 底部弹出）/MIT border 2px+金阴影/已完成后 checklist opacity .75/移动端触控 min-height 36-44px |
| **v8.1 移动端 app 化深化** | mobile.css 第 45 节（≤900px）：①布局去「panel 套 panel」——`.today-panel` 透明化，today-block/zone/hero/已完成清单统一 16px 分组卡（iOS inset-grouped 感）②大石头/情境 chips 折行→单行横滑（同提醒条模式）③字体：hero-main 17→21px（今日焦点仅次于大标题）、app-title 30→32px ④信息减载：行内 meta 默认只留 wf-tag/🕐/📈/等待阻塞，隐藏 `.habit-recur/.anchor-tag/.ctx-tag/.meta-dleft`（剩n天 JS 新加类名），点 ⋯ 展开行恢复全量 ⑤底部 tab 玻璃加强 blur(18px) 与顶栏一致。JS 仅 1 处：剩n天 meta 加 `meta-dleft` 类 |
| **v8.2 AI 排期五修复** | ①`backfillAISchedule` 兜底排期：AI 只给第一个叶子 start 时，缺 date 从 max(今天,项目开始日)顺排、缺 start 在当日窗口顺接（间隔 10min 避让本批块；窗口满换次日；塞不下贴窗口尾）——**每个叶子必有具体时间**；`parseAIStart` 兼容「19点/7:30pm/19.30/裸小时」②`ensureRemindDefaults`（renderToday 挂载）：有 time 的今日任务自动带提醒=开始前 5 分钟；手动清空记 `_remindOff`=当天日期不回填（序列化落库，换天重置）③MIT 漏项修复：`heroGlobalCandidates` 候选池改 `todayExecutionPoolFor`（与今日清单同池，滤 `_overflow`），不再只走 buildView('day') 漏非 day 尺度叶子 ④多时段窗口：`meta.capacity[wfId].wins=[{start,mins}]`（兼容旧 winStart/winEnd），`wfTimeWindows` 返回[{start,end,mins}]，项目弹窗改动态行（开始+时长小时+✕+「＋添加时段」），AI 输入注入多段 ⑤`showAIOverlay` helper 统一全屏遮罩：autoDecomposeGoal 原用底部 toast（用户以为框在底部）改 overlay，AI 视图共用。**教训：backfill 的「定 date 占位」与「放 start 避让」必须同一遍 bump 一次，分两遍会二次避让导致时间翻倍偏移** |
| **v8.3 四问题修复** | ①**精力超标弹窗点多次才退出**：`insertAITasks` 尾部逻辑（recomputeSchedule/save/afterChange/`warnIfOverCapacity`/`showTodayAlarm`）原本递归每层都执行——AI 任务有 children 时 alert 排队；现包进 `if (!_collected)` 只跑最外层 ②**桌面字号整体 +1 档**：`migrate-fontsize-v83.cjs` 一次性迁移（防重复执行 guard：body 已 15px 则拒绝）——base body 14→15px，features/layout/chip/button/forms 桌面规则 ≤13px 全抬一档（8.5→9.5…12.5→13.5、13→14，共 329 处+index.html 内联 3 处），`@media(max-width)` 移动端块跳过不动 ③**测试常驻**：`scripts/checks/{lib,run,verify-v82,smoke-v82,verify-v83}.cjs`，`node scripts/checks/run.cjs` 一键全跑（node --check + 版本号一致性 + 自动扫目录）；新版本直接加 verify-vXX.cjs ④**Chrome 提醒无兜底**：`tickReminders` 到点改走 `showTodayAlarm` 三通道（granted→系统通知+toast+页头横幅；未授权→toast+横幅兜底，不再静默）；行内 ⏰ 填时间时权限 default 自动 `requestAlarmPermission` 引导。附带修：backfill ①「有 start 无 date」任务现按今天计入占用（否则后续顺排块与它时间重叠） |
| **v8.4 五项修复** | ①**AI 报错可见**：`autoDecomposeGoal`（新建项目流程）此前不写 AI 历史——失败无处可查；现成功/失败都 `addAIHistoryEntry`（via:'create'）；`btnAIDecompose` 失败改记 `lastLLMError()` 具体原因（401/402/429/网络），空 tasks 数组抛错（原会无声「成功」0 个任务），parse 失败附 `rawSnippet` 原始返回 300 字（详情弹窗 details 展示）；历史失败行内联 `.ai-history-err` 摘要 ②**AI 分解假流程展示**：`showAIOverlay` 分步演出——5 步（理解目标→拆解→估时→落窗口→校验）每 1.1s 点亮一步（working 转圈/done ✓），停最后一步等真实返回；`overlay.remove` 重写清理定时器；样式在 mobile.css `.ai-steps` 族 ③**最后一个项目可删**：`deleteWorkflow` 去掉「至少保留一个」，删空重建空白「默认目标」；**`.wf-item.active` 框统一**——用户反馈「默认目标框和其他不一样」，整圈 accent border+inset shadow 改灰框+`inset 3px 0 0 var(--accent)` 左竖条 ④**项目设置删除按钮被遮挡**：根因=`.modal`(max-height:88vh,overflow:hidden) 内 `.wfm-body` 无 `flex:1;overflow:auto`，内容超高时 modal-foot 被裁；修复一处 CSS ⑤**创建项目一键模板**：`WF_TEMPLATES`（📚学习/💪健身/💼副业/📖读写 4 个，preset 预填名称/标签/周期/预算/窗口/带宽 + tasks 兼容 insertAITasks 格式）；新建弹窗 chips 点击预填表单；保存分支模板优先于 AI 分解；`applyWorkflowTemplate` 建根+insertAITasks（v8.2 兜底排期自动生效，source:'template'） |
| **v8.5 回归修复+结果弹窗** | ①**v8.4 回归：保存项目后无法 AI 分解**——根因：`#workflowMetaModal` 是复用元素，`close()` 只清 `innerHTML`，`overlay.dataset.tpl`（v8.4 模板选择）残留 → 点过一次模板后每次创建都被劫持走模板分支。修复：openWorkflowMetaModal 打开即 `delete overlay.dataset.tpl` + 再点已选 chip 可取消。**教训：复用弹窗元素上挂 dataset/属性状态，必须在打开时重置（innerHTML 清除不管 dataset）** ②**分解完成弹窗 `showAIResultModal`**：展示真实排期结果（backfill 后节点的 time/planDate 归一排序，非 AI 原始输出）+ 今日安排（`todayExecutionPoolFor` 有 time 按序）；三处成功分支接入：autoDecomposeGoal（替代 toast+静默跳 plan）、btnAIDecompose（内联 resultBox 保留+弹窗）、applyWorkflowTemplate |
| **v8.6 模板×AI 共存+错误弹窗** | ①**模板+描述走 AI 分解**：wfmSave 创建分支 `if (tplId)` 时 description 非空 → `autoDecomposeGoal(desc, meta, {fallbackTpl: tpl})`（AI 优先，模板兜底）；无描述 → 纯 `applyWorkflowTemplate`。`autoDecomposeGoal` 第三参 opts；失败 `failAndRollback` 里 fallbackTpl 分支 `applyWorkflowTemplate(opts.fallbackTpl, meta, {silent:true})` 不删项目；`applyWorkflowTemplate` 支持 `opts.silent` 不双弹窗 ②**anchorD.getTime is not a function**：根因=insertAITasks 的 anchor 三调用方传 'YYYY-MM-DD' 字符串（旧项目不填开始日期走 aiDeadlineAnchor() 返 Date 不炸，v8.4 模板自动填日期后必炸）；双层防御：insertAITasks 与 backfillAISchedule 开头都 `if (!(d instanceof Date)) d = new Date(d)` 归一化（NaN 回落 today0()）；smoke 场景 E 覆盖 ③**`showAIErrorModal(reason, rawSnippet, opts)`**：❌ 分解失败弹窗（原因块 + cancelledProject 回滚说明 + fallbackTpl 兜底说明 `.aierr-fallback` + rawSnippet details + 「📜 查看 AI 使用历史」跳 ai 视图）；failAndRollback 用它替代 toast ④**AI 视图移除分解模块**：`#panelAIDecompose` 整块删除（入口统一在新建项目流程），保留历史/配置/SMART 三面板；JS 引用全部判空安全（renderAIView/initAIDecomposeHandlers）；`reuseHistoryEntry` 无输入框时降级 `navigator.clipboard.writeText` + toast |
| **v8.7 模板必过AI+今日池排期泄漏+工作流过滤** | ①**选模板也进 AI**：`templateHasSchedule(tpl)`（递归查任务 date/start）——仅模板自带具体时间的直接 `applyWorkflowTemplate`；否则无描述也走 `autoDecomposeGoal`（用「模板名+desc+骨架文本」合成 goalText，fallbackTpl 兜底不变）；弹窗提示与 chip toast 文案同步 ②**今日执行混进明天任务的根因**：backfill 顺排到次日的任务带 `deadlineDate=排期日`（daysLeft=1、scale='day'），被今日池 `daysLeft<=1`/`scale='day'`/快赢条款拉回今天且无 time。修复：`todayExecutionPoolFor` 过滤器**最前**排除 `planDate.slice(0,10) > dateKey()`（到当天 normalizeNode 加载时 planDate→time 再正常进）；smoke-v87 场景 A-F 实跑覆盖（含「明天到期无 planDate 仍进」「昨天 planDate+逾期仍进补救」「planDate=今天边界」）③**今日视图工作流过滤**：`_wfOnly`（localStorage `goalflow.todayWfOnly` 持久化）——`heroGlobalCandidates`/`todayAggregatedPool` 开头各一行 `if (_wfOnly && wf.id !== state.activeWorkflowId) return;`；今日执行头部开关 `🌐全部项目/🎯当前项目`（`.today-wfonly`，innerHTML 重建后重绑 onclick）；容量条保持全局口径（不随过滤，避免虚报）④**审计顺带修顶栏计数**：renderAppTitle 原用 `todayExecutionPoolFor(state.nodes)` 只算当前项目（清单是全局的）且 pool 已滤 done → 完成数恒 0；改 `todayAggregatedPool()`（跟随过滤）+ executionLog 今日 entries 数为 done、total=待办+done；insertAITasks 成功提醒改数 `n.time` 叶子（planDate 未来不再谎称已入今日清单） |
| **v8.8 提到今天+删除链路+系统通知** | ①**备选/Backlog 提到今天**：`nextFreeTimeToday(wfId, durMin, _nowMin)`——跨全部项目收集今日已排 time 块（时间共享），在项目每日窗口内找首段空隙（块间 10min 缓冲，不排过去：max(窗口起点,now+5min)，窗口满返回 null）；`promoteNodeToToday` 重写=字段级快照→scale/deadline 设今天+自动排 time→`showUndoToast` 撤回（Object.assign 恢复快照）；`clarifyInbox` 任务分支同样接入（撤回=从目标 wf.nodes 移除新叶子+条目回 'inbox'，注意目标项目可能非当前项目不能直接动 state.nodes）②**删除项目孤儿清理**：deleteWorkflow 同步清 `weekPlans[*].rocks`（wfId 匹配）、pendingActions、tomorrowMit、planShare、capacity、habitStreaks（`wfId|`前缀 key）、topWfId ③**最后一个项目删除没反应根因**：原生 `confirm()` 在部分 WebView/嵌入浏览器（微信 H5、未实现 JsConfirm 的 Android WebView）被静默吞（返回 false/抛错）——v8.4 逻辑早放开但 confirm 弹不出。新建 `confirmModal(opts)`（smartModal Promise<boolean>，danger 红色按钮），deleteWorkflow 改 async+await confirmModal；删除结果 toast+sysNotify ④**系统弹窗**：`sysNotify(title,body)`（仅 granted 发，tag 'gf-sys' 防堆叠）；`sysNotifyOptIn(footEl,...)`（permission=default 时弹窗底部给「🔔 开启系统通知」按钮——Chrome 要求 requestPermission 必须用户手势）；AI 结果/失败弹窗均接入 ⑤**渲染容错根治「没同步更新」**：VIEW_GROUP 改函数数组，renderViewGroup 逐个 try（原：单面板抛错中断整组渲染）；afterChange 全链 safe(label,fn) 包装——一个环节抛错不再让 UI 停在旧状态 |
| **测试基建（2026-11-25）** | `scripts/tests/` 与 checks 并存：**unit/**（4 套件 126 例，直接 `require('assets/js/app.js')` 调 60 个导出纯函数，断言全用 `dkOf(daysAgo(n))` 相对日期与运行日无关）+ **flow/**（4 套件 29 例，沿用 checks/lib.cjs grabFn+stub 串 5-8 步用户旅程：项目全生命周期/今日执行/收件箱/习惯 30 天强度）；`run.cjs` 统一入口自动扫目录+独立进程隔离+失败同打 stdout/stderr，`--with-checks` 连 checks 一起跑。docs/TESTING.md（四层分工+6 条约定）+ docs/TEST-CASES.md（模块×覆盖层矩阵 384 项）。**关键事实**：`pickRanked` 依赖 `_rankSlot` 缓存，测试里改节点后必须再调 `computeTree`（内部 beginTick 重置）；habitStrength 漏打日净 +3%（+5% 后 -freqDecay）；buildCtx 参数快照要动态行为走可变标志位 |
| **v8.10 增改后同步审计（9 处修复）** | ①`setNodeDone` 出口统一 `saveMeta()`——updateHabitStreak/logHabitCheck 写在 appendScore 内部 saveMeta 之后，调用方只 save()，习惯打卡 🔥streak/强度刷新即回滚 ②`removeExecutionLogEntry(nodeId)`——取消勾选对称回滚 executionLog（尾查最新一条删+byWorkflow/completedCount/dailyCompletions 回退；此前只增不减，「✅今日已完成」/顶栏 X/Y/时间审计/planVsActual 全虚报）③`refreshTodayIfNeeded()` 跨午夜自愈——TODAY 原只在启动赋值，页面过夜「今日」全停昨天；30s 轮询+wakeCheck 挂载，换天刷 TODAY+全流 `convertDuePlanDate`（从 normalizeNode 抽出共用）+save+afterChange；beforeunload 补 saveMeta ④`importBackupText` 恢复 meta 后补 saveMeta+reconcileRefsAfterRestore（原刷新读回旧 meta）⑤精力打卡 onclick 改 `afterChange()` 全链（peak 变化当场重排 MIT，原只 renderEnergyWidget）⑥`deleteTodayNode` 改临时切流+`deleteNode` 级联（v8.9 盲区：只审计 `state.nodes=` 漏了 `w.nodes=` 直改，独立实现留孤儿引用）⑦importBackupText/restoreSnapshot 原生 confirm 改 `confirmModal`（async 化，WebView 吞 confirm 同 v8.8）⑧`reconcileRefsAfterRestore()`——快照/备份恢复后按「全流 wfId\|nodeId 存活集」清孤儿 rocks/tomorrowMit/habitStreaks，脏才 saveMeta ⑨晚总结「明天继续/改期」手搓五字段改走 `setNodeDeadline` 唯一写入口（deadlineText 残留修复）。verify-v810 43 项 + smoke-v810 49 项实跑 |
| **v8.9 模块间增删同步审计（8 处修复）** | **三级引用清理体系**：①`purgeNodeRefs(wfId, droppedIds, backup)` 节点级——清 weekPlans rocks（nodeId 匹配）/tomorrowMit/habitStreaks（`wfId|`前缀），backup=true 返回被清内容；`restoreNodeRefs(bak)` 供 undo 还原 ②`purgeCurrentTreeRefs()` 整树替换前置——旧 id 集 + purgeNodeRefs + topPin/番茄钟解绑 + saveMeta；**doParse/autoDecomposeGoal/applyWorkflowTemplate 三处共用**（新建流空集 no-op）③`purgeWorkflowRefs(wfId)` 项目级——v8.8 deleteWorkflow 内联块抽出 + 补番茄钟 wfId/nodeId 解绑，与 clearAll 共用。**8 处修复**：deleteNode 级联（备份→undo 还原）+番茄钟解绑；doParse 整树替换清旧引用；removeWizardNodes 向导重生成删子树补级联（不走 deleteNode 的删除路径）；clearAll 改 confirmModal（原生 confirm 被吞同 v8.8）+ meta 入快照 + 全流 purgeWorkflowRefs + undo 还原 meta；adoptPendingAction 同流采纳补 afterChange（原仅跨流经 switchWorkflow 刷新，今日面板停旧数据）；autoDecomposeGoal/applyWorkflowTemplate 防御性接入 purgeCurrentTreeRefs。smoke-v89 35 项实跑（删除级联/undo 还原/整树替换/clearAll 取消+确认+undo） |

## Visual (v6.0 · app shell + 三视图导航 + 主题×明暗)
- 布局：参考 demos/01-linear — `.app-shell` = 52px 图标轨 `.rail`（logo/☀今日·🎯规划·📊洞察 [data-nav]/周回顾◔/demos 链接）+ 230px 侧栏 `.side`（「视图」3 项 [data-nav] +「仪式」4 项 + 目标树 `#sideTree`+`#sideProg`）+ 主区 `.main`（顶栏含 `.topbar-theme` = `#themeSelect`+`#modeToggle` ☾/☀，+ `.main-scroll`）；`body{overflow:hidden}` 仅主区滚动；≤900px 隐藏 rail/side；选中态 `.ric.on`/`.si.on`
- 主题机制（双维度）：`<html data-theme data-mode>`；存储 `goalflow.theme` + `goalflow.mode`；`tokens.css` `:root`=linear dark，`[data-theme]`=各主题 dark，`[data-theme][data-mode='light']`=各主题 light；`gf-tokens.js` `THEMES[t].dark/.light` 双套色板摊平到顶层（app.js 零感知）；head bootstrap 防闪烁写两个 attr；app.js 绑定带旧缓存兜底；资源引用带 `?v=` 版本串破缓存（inline-bundle.mjs 正则已兼容）
- 视觉：实体面板 `#131417`+1px 边、iris `#5e6ad2`、金 `#e8b84a`（light 下 `#d4a017`）；Inter + JetBrains Mono；步骤 1-4 `.idx` iris 描边徽章；英雄卡 2px 金左边线；zoombar 选中白底黑字
- 进入：body `.is-ready` 淡入；尊重 `prefers-reduced-motion`

## Visual Demos (`demos/`)
- **索引:** `demos/index.html` — 十套独立 HTML 风格实验室 v2（仅壳层 + 内联 SVG 桑基 mock，无业务逻辑）
- **v2 方向（参考真实产品）:** 01 Linear 深色工作台 / 02 Things Mac 纯净 / 03 Notion 文档 / 04 Sunsama 日计划 / 05 Stripe 落地页 / 06 Raycast 命令面板 / 07 Amie 日历时间块 / 08 Kinfolk 杂志 / 09 Vercel bento / 10 RPG 游戏化
- **教训:** 用户否掉 v1「风格实验」方向（太丑），要求参考成熟个人管理产品的真实布局；文件名语义化（`NN-产品名.html`）

## Patterns
- **示例主题库:** `assets/js/gf-demos.js` → `GoalFlowDemos.list`（10 条）；`#demoSelect` +「载入示例」调用 `loadDemo()`
- **产品全景文档:** `docs/PRODUCT-FLOW.md`（目的/流程/功能全景/科学依据映射/改进路线图 v6.3+）；进度口径 `docs/PROGRESS-ROLLUP.md`
- 叶子任务优先进入 `pickRanked`；进度 rollup 见 `docs/PROGRESS-ROLLUP.md`
- 节点字段：`val`/`eff`/`recur`/`doneAt`（v4.2）
- 例行任务在无期限时按尺度展开到节奏条 + 日 slot
- 微动作子节点默认 `scale: day`、可选 `slot`（h0–h6）
- 节点字段补充：`remindAt`（今日提醒时间戳）
- meta 字段：`scoreLog{dk:{entries[{kind,nodeId,score,reason}]}}`、`dayNotes{dk:str}`、`ritual{morning,evening,on}`；取消勾选回滚当日 done 分（`removeTodayScore`）
- meta 字段 v5.5：`pendingActions[{id,text,fromCycle,period,status}]`、`weekPlans{wk:{rocks[{wfId,nodeId,text}]}}`；executionLog entries 增 `im/ur`（审计象限分布用）；节点字段增 `ifThen`（WOOP）
- meta 字段 v6.3：`goodThings{dk:[s,s,s]}`、`tomorrowMit{forDate,wfId,nodeId,text}`、`lastBackupAt`、`onboarded`；**inbox 已实现**（`addInbox/clarifyInbox/inboxPending` + 今日面板 `#inboxPanel`，v6.4 捕捉入口无需重做）
- meta 字段 v6.4：`q2Target`（10-90）；节点增 `anchor`（习惯叠加触发线索）；番茄 `state.pomo.paused/remainMs`
- meta 字段 v6.5：`weekPlans[wk]` 增 `intent/committedAt`（承诺卡）；工作流增 `archived/archivedAt`；**PowerShell Add-Content 写 features.css 常被另一进程锁 → 改用 StrReplace 走编辑器通道**；mem0 免费额度 30 天后需自带 LLM key（2026-12-14 重置，当前 ADD 被拒）
- meta 字段 v7.9：`capacity[wfId]` 增 `winStart/winEnd`；节点增 `planDate`（未来排期日，到期自动转 `time`）；state 增 `topWfId`（全局 MIT 所属项目）、`pomo.wfId`；`callLLM` 有 `_llmLastError`（401/402/429 区分）
- v8.0：番茄时长来自 hero 的 `#pomoLen` 下拉（不再有 btnPomo50/90）；`renderPlanShareStrip` 挂载点仍在 `#planShare` 但元素已迁入 `#zoneStatus`；验证脚本模式沿用 `_verify-*.cjs` 全量字符串核查（注意断言别写太严——title 里的文案不算裸奔）
- v8.1：行内 meta 按优先级分层——执行必需（wf-tag/🕐/📈/wait/block）常驻，装饰性（recur/anchor/🏷/剩n天）移动端仅 `.today-row.expanded` 可见；`hero-main` 字号在 mobile.css 16 节有全局 `!important`，移动端放大需 `.hero .hero-main` 双类 + `!important` 覆盖；index.html 批量改版本号用 PowerShell `Set-Content` 安全（中文编码与换行不受影响，diff 验证过）
- v8.2：节点字段增 `_remindOff`（手动清空提醒当天不回填）；`meta.capacity[wfId]` 增 `wins[{start,mins}]`（winStart/winEnd 为遗留兼容，不再写入）；排期类纯逻辑可用「grabFn 大括号计数提取 + stub DOM 依赖」在 node 冒烟（注意 stub 要补 `state.activeWorkflowId`）；核查脚本断言限定函数体范围（`function X\(\) \{[\s\S]*?\n\}` 非贪婪会跨函数误匹配）
- v8.3：**核查/冒烟脚本常驻 `scripts/checks/`，不再用完即删**——`run.cjs` 统一入口（语法+版本号+自动扫 verify-*/smoke-*），用户明确要求「测试代码保留，直接调用检查」；新增版本只加文件即可。字号迁移类一次性脚本必须加防重复 guard（不幂等）；「整体放大一号」= 每档 +1px 批量 map 替换（单次 pass 防连锁），**跳过 `@media(max-width)` 块**；验证迁移完成度用「签名档位存在 + 最小档上移」而非「无 ≤13px」（+1 档后 12→13 仍 ≤13 会误报）；`insertAITasks` 类递归函数的尾部副作用（提醒/alert/保存）必须包 `if (!_collected)` 只跑最外层，否则弹窗排队
- v8.4：AI 历史 `goalflow.aiHistory` 是唯一持久化日志——**新建项目分解流程也要写**（via:'create'），失败必记 `lastLLMError()` 具体原因 + `rawSnippet` 原始片段；「按钮被遮挡」类 bug 先查弹窗 flex 链：`.modal`(overflow:hidden) 内内容区必须 `flex:1;min-height:0;overflow:auto`；`showAIOverlay` 分步演出模式（假进度）可复用于其他长等待；模板任务的 `children` 嵌套会过 insertAITasks 递归（v8.3 后副作用只跑最外层，安全）；节点 `source` 新增 'template' 枚举
- v8.5：**复用弹窗元素（`#workflowMetaModal`/`#smartModal`）上挂 dataset/属性状态，打开时必须重置**——`overlay.innerHTML=''` 不清 dataset（v8.4 模板残留劫持回归的教训）；交互开关类控件（模板 chip）要支持再点取消；分解/模板完成后统一弹 `showAIResultModal`（排期预览读 backfill 后真实节点，不读 AI 原始输出——兜底排期的价值要可视化）
- v8.6：**日期参数跨调用方传递必须防御归一化**——`insertAITasks(anchor)`/`backfillAISchedule(anchor)` 三调用方传的是 'YYYY-MM-DD' 字符串，函数内直接 `.getTime()` 必炸（`instanceof Date` 检查 + `new Date(str)` + NaN 回落 today0()，调用方与被调方双层防御）；**模板与 AI 不是二选一而是共存**：模板给结构兜底、描述给 AI 语义，`fallbackTpl` 模式 = AI 失败自动落纯模板（`silent` 防双弹窗）；**失败也要体面**：错误必须弹窗（含原因/原始片段/回滚说明/跳转入口），toast 一闪而过用户看不见；**删除 UI 模块后 JS 引用全部判空**，复用入口降级方案（剪贴板）；**行为变更后必须同步更新旧版本核查断言**（v8.4 的 toast 断言因 v8.6 改弹窗而红，改为断言新行为而非删除）
- v8.7：**「排期日」≠「到期日」不能共用一个字段的下游语义**——backfill 把 `deadlineDate` 写成排期日，导致 `daysLeft<=1`（明天到期今天做）条款把自己排到明天的任务拉回今天；凡是「按 X 条款纳入集合」的过滤器，新增数据来源时要重审每条纳入条款是否会被新来源误触发（快赢 ≤10min、scale=day 全中招）。修复模式=**排除条款放最前**（planDate>今天先 return false）而非逐条打补丁；**全局一致性功能（MIT/清单）要留「只看当前」过滤口**，实现=聚合函数开头一行 wfId 判断（heroGlobalCandidates/todayAggregatedPool 双管齐下），UI 开关持久化 localStorage，容量等全局指标不随过滤；**审计类修复要顺手改「读起来对其实错」的显示**：顶栏「今日 done/total」原 done 恒 0（pool 滤 done 后再 filter done）——完成数应从 executionLog 取；**核查断言避开注释**：assertFnNotContains 会命中注释里的历史引用，断言要写到「调用语句」粒度（`pool = todayExecutionPoolFor(...)`）
- v8.8：**原生 confirm/alert 在部分 WebView（微信 H5、未实现 JsConfirm 的 Android WebView）会被静默吞掉——「点了没反应」类 bug 优先怀疑原生对话框**，根治=页内 `confirmModal`（smartModal+Promise）；**「系统弹窗」诉求=Notification 镜像而非替代页内弹窗**：`sysNotify` 只在 granted 发（tag 固定防堆叠），default 给 opt-in 按钮（Chrome 强制 requestPermission 来自用户手势，自动请求会被拒）；**删除实体必须级联清理所有引用方**（rocks/pendingActions/tomorrowMit/planShare/capacity/habitStreaks `wfId|` 前缀 key/topWfId——孤儿引用是「删了还在」类 bug 的根源）；**渲染管线必须容错**：VIEW_GROUP 函数数组逐个 try + afterChange 全链 safe 包装——单面板抛错中断整组渲染是「数据变了 UI 没变」的隐形根因且 console 之外无痕迹；**smoke 里 buildCtx 是参数快照**：要动态改 stub 行为需经可变标志位（`__confirmRet`）而非事后替换 stub 属性；grabFn 已支持 async 前缀（`(async\s+)?function`） |
- 测试基建（2026-11-25）：**app.js 可直接 require 做单元测试**（node 26 仅 ExperimentalWarning）——纯函数逻辑别再走 grabFn 字符串抠取（脆、只覆盖函数体），unit 层真 require 最真实；**断言与运行日无关**：日期键一律 `dkOf(daysAgo(n))` 生成；**grabFn vs require 分工**：跨函数用户旅程（涉及 DOM/全局 state 的函数）仍走 grabFn+stub，纯计算函数走 require；**单元测试发现的函数行为事实**（断言依据）：`focusScoreParts` im=5 无期限=54（50+4 主线）、阻塞-60/等待-45；`habitStrength` 漏打净+3%、samples=min(30,记录天数)；`parseText` 第二顶级行收敛到 nodes[0]（单根）；`category` 返回 CAT 对象取 `.key`；`computeTree` 内调 beginTick 重置 `_rankSlot/_viewSlot/_estTick` 缓存——测试改节点后必须重调
- v8.10：**meta 写入函数分两类：自带 saveMeta（appendScore/removeTodayScore/logEnergy/addInbox）vs 依赖调用方（appendExecutionLog/updateHabitStreak/logHabitCheck/bumpDailyCompletion）**——混用时「写 meta 的顺序」决定丢失风险：依赖型函数若排在自带型之后执行，其变更要等下一个 saveMeta 才落盘，期间刷新即回滚；根治=调用方出口统一 saveMeta（setNodeDone 模式），别依赖内部 saveMeta 的位置巧合；**「对称操作」检查法：有 append 就要想 remove**——executionLog 只增不减导致取消勾选后所有下游统计虚报（scoreLog 早有 removeTodayScore 对称物，executionLog 缺了两年）；**删除路径审计要同时 grep `state.nodes =` 和 `w.nodes =`**——v8.9 只查前者漏了 deleteTodayNode 的 `w.nodes=` 直改；**模块级 TODAY 缓存必须跨午夜自愈**——长开页面（30s 轮询+wakeCheck 双挂载）换天要刷 TODAY+转换到期 planDate+全链重渲染，否则「今日」面板/执行日志日期各认各的；**期限字段五件套（deadline/deadlineDate/daysLeft/overdue/deadlineText）只能经 setNodeDeadline 写**——手搓子集必残留；**恢复类操作（快照/备份）后必须 reconcile 引用**——恢复的树与现存 meta 不配套，按「全流 wfId|nodeId 存活集」清孤儿；**smoke 里 buildCtx 形参是快照**：函数内 `TODAY = now` 改的是闭包形参不回写 stub 对象，验证 TODAY 刷新要靠行为副作用（planDate 转换生效）而非回读 stub 属性
- v8.9：**删除/替换路径审计要穷举所有 `state.nodes =` 赋值点**——grep 出 16 处，逐个分类：引用共享（applyActiveWorkflow/switchWorkflow）安全、整树替换（doParse/autoDecomposeGoal/applyWorkflowTemplate/clearAll/removeWizardNodes）必须级联清理、迁移/恢复（applyWorkflowsData/单树迁移）自带配套 meta 安全；**级联清理要带备份进 undo 快照**——deleteNode 原 undo 只快照 nodes+topId+topPin，级联清了 rocks/打卡不备份则「撤销删除」永久丢数据（purgeNodeRefs backup 模式 + restoreNodeRefs）；**同函数名清理逻辑抽共用助手时，旧版核查断言要同步重定向**（v8.8 的 deleteWorkflow 内联断言 → purgeWorkflowRefs，smoke 的 buildCtx 提取列表也要加新函数名）；**「同流 vs 跨流」双路径函数要两条都验刷新**——adoptPendingAction 跨流经 switchWorkflow 隐式刷新，同流什么都不调（加 else afterChange()）；**番茄钟是隐形引用方**——pomo.wfId/nodeId 指向被删实体时显示层有空兜底不炸，但计时挂在空名上，删除路径都要解绑 |
- v5.6：节点增 `createdAt`（新解析起）与 `premortem`；meta 增 `energyLog`；新节点字面量三处需同步（parseText/insertChildren/adoptPendingAction）
- v6.0 视图拆分：`scrollToToday()`=转发 `switchView('today')`；视图切换时 main-scroll 回顶 + `history.replaceState('#/'+name)`；隐藏视图内 SVG 布局无常量外尺寸依赖（sankey 用固定 layout），但切回 insights 仍 rAF 重绘保险
- v6.2 移动端：布局/layout.css 与 features.css 均为**展开格式**（每属性一行）且 1500-2000 行，StrReplace 需用展开格式匹配；features.css 晚于 layout.css 加载，覆盖 `.modal` 必须放 features.css；桑基 SVG `setAttribute('width'/'height', W/H)` 显式像素尺寸（993/1100 行）→ 移动端横滑零改动；闹钟可靠性=前台 30s 轮询 + wakeCheck 可见性补跑，锁屏后仍不可靠（平台限制）
- v7：节点增 `status`/`waitNote`/`timesPerWeek`/`conf`/`confNote`/`confAt`；meta 增 `inbox`/`planShare`/`eveningDispo`；habitStreaks rec 增 `log`+`freqDecay`；备份 JSON 升 **v10**
- v8：节点增 `source`/`dropped`/`_manualIm`/`_manualUr`；**`newNode()` 工厂统一所有新节点**；`applySuggestions` 尊重手动 im/ur；`pendingActions` 增 `wfId`；`flushActiveWorkflow` 引用化不再拷贝
- 备份 JSON v9：`{ workflows, activeWorkflowId, nodes, meta }`（v7 仅单树可导入）
- **执行闭环（v5.7）**：`meta.executionLog[dateKey]` 每日勾选日志（含 wfId/估/实/习惯）；`meta.habitStreaks[wf|nodeId]` 习惯连续；周回顾草稿自动带「执行/偏差反馈」；度量条近 7 天动量 + 估/实
- 今日行动行内：**时段下拉** 钉 `slot`（When）、`🔥 streak` 习惯连续天数