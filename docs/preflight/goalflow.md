# GoalFlow · Preflight（边界与准备）

> 进入开发前可读。来源：从 wechat_fitness `docs/preflight/zhixing-app.md` 抽取「边界 / 不做 / 环境」思想，适配纯前端目标流。

## 1. 产品一句话

把年度目标画成「精力河流」，让当下最重要自己发光，用晨晚仪式与周回顾闭环保证执行落地。数据主权在用户本机。

## 2. 技术边界

| 项 | 约定 |
|----|------|
| 运行 | 浏览器；无构建；可选静态托管 |
| 存储 | `localStorage`：`goalfocus.workflows.v2` + `.bak`、`goalfocus.meta.v1` |
| 跨浏览器 | **不共享**；迁移靠 JSON 备份/恢复 |
| LLM | 可选；Key 仅用户本机设置；失败要可见 |
| 通知 | 页内仪式弹窗为主；`Notification` 仅 opt-in 镜像 |

## 3. 不做清单（默认拒绝扩 scope）

- 强制账号 / 云同步作为主路径
- 社交裂变、积分商城、站内交易
- 诊疗/医疗承诺式文案
- 引入 React/Vue/Webpack 作为主应用栈
- 第二套平行「测试驾驶舱」或平行功法索引（用现有 `scripts/tests` + `scripts/checks`）

## 4. 发版 / 交付门禁

1. `node --check assets/js/app.js`
2. `node scripts/tests/run.cjs --with-checks`
3. `index.html` 四处 `?v=` 同号
4. 若动存储 schema：备份 JSON version 说明 + 迁移/兼容路径
5. 更新 `openmemory.md` 相关节；大功能同步 `docs/TEST-CASES.md`

## 5. 给 AI 的标准起手

```
请先阅读 docs/preflight/goalflow.md 与 AGENTS.md。
对照仓库列出边界与缺口，不要引入新框架或云后端。
确认后再实现：[具体功能]。
每步给出可验证命令（优先 node scripts/tests 或 checks）。
```
