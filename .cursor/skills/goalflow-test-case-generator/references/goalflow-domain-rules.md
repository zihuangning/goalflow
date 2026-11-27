# GoalFlow 领域规则（写用例时对照）

## 产品

- 本地优先；跨浏览器需备份 JSON  
- 算法选 MIT / Top；用户可钉、可提到今天、可改期  

## 数据

- 项目 = workflow；节点树挂 `nodes`；`state.nodes` 是当前流镜像  
- 新节点：`newNode`；来源 `source`：parse/wizard/inbox/review/insert/template…  
- 期限五件套只经 `setNodeDeadline`  
- 删除：节点级 / 整树 / 项目级三级 purge；undo 需备份引用  

## 今日池

- 过滤条款顺序敏感：`planDate > 今天` 等排除放最前  
- 预算：`dayCap` / 全局递减；习惯不占预算（以代码为准）  
- 溢出：`_overflow` 留池可见，不进 MIT  

## 时间

- `planDate` = 排期日；`deadlineDate` = 到期日；勿混用下游语义  
- 跨天：`refreshTodayIfNeeded`；断言用相对日期 `dkOf(daysAgo(n))`  

## 容量

- 设置：`meta.capacity` 或按项目；全局 vs 单项目渲染必须同口径  
- 超支：`warnIfOverCapacity` 可 alert；无配置时勿假超支  

## 测试约定

见 `docs/TESTING.md`：零依赖、独立进程、相对日期、改节点后 `computeTree`。
