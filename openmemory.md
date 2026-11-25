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
- **测试钩子:** `module.exports` 导出纯函数

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
- v5.6：节点增 `createdAt`（新解析起）与 `premortem`；meta 增 `energyLog`；新节点字面量三处需同步（parseText/insertChildren/adoptPendingAction）
- v6.0 视图拆分：`scrollToToday()`=转发 `switchView('today')`；视图切换时 main-scroll 回顶 + `history.replaceState('#/'+name)`；隐藏视图内 SVG 布局无常量外尺寸依赖（sankey 用固定 layout），但切回 insights 仍 rAF 重绘保险
- v6.2 移动端：布局/layout.css 与 features.css 均为**展开格式**（每属性一行）且 1500-2000 行，StrReplace 需用展开格式匹配；features.css 晚于 layout.css 加载，覆盖 `.modal` 必须放 features.css；桑基 SVG `setAttribute('width'/'height', W/H)` 显式像素尺寸（993/1100 行）→ 移动端横滑零改动；闹钟可靠性=前台 30s 轮询 + wakeCheck 可见性补跑，锁屏后仍不可靠（平台限制）
- v7：节点增 `status`/`waitNote`/`timesPerWeek`/`conf`/`confNote`/`confAt`；meta 增 `inbox`/`planShare`/`eveningDispo`；habitStreaks rec 增 `log`+`freqDecay`；备份 JSON 升 **v10**
- v8：节点增 `source`/`dropped`/`_manualIm`/`_manualUr`；**`newNode()` 工厂统一所有新节点**；`applySuggestions` 尊重手动 im/ur；`pendingActions` 增 `wfId`；`flushActiveWorkflow` 引用化不再拷贝
- 备份 JSON v9：`{ workflows, activeWorkflowId, nodes, meta }`（v7 仅单树可导入）
- **执行闭环（v5.7）**：`meta.executionLog[dateKey]` 每日勾选日志（含 wfId/估/实/习惯）；`meta.habitStreaks[wf|nodeId]` 习惯连续；周回顾草稿自动带「执行/偏差反馈」；度量条近 7 天动量 + 估/实
- 今日行动行内：**时段下拉** 钉 `slot`（When）、`🔥 streak` 习惯连续天数