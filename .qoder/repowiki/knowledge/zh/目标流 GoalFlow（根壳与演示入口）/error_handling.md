## 1. 采用的方式

该项目是纯前端零构建项目，**没有后端中间件、框架异常处理或统一错误类型**。整体采用以下原生 JS 模式：
- **校验失败**通过 `throw new Error('...')`（字面量消息）直接抛出；
- **调用方在各自位置 `try / catch`**，通常记录到 `console.error` 或展示给用户；
- **I/O/环境侧的副作用**（主要是 `localStorage.setItem/getItem/removeItem`、`Notification`、`history.replaceState`、DOM API）大量使用内联 try/catch 并忽略错误，把这类异常视为“容错”而非业务错误。

不存在任何自定义错误类、错误码常量、全局错误监听器、路由级错误页面或 try-recover 模式。

## 2. 关键文件

- `assets/js/app.js` — 业务逻辑与 UI 主脚本，承载全部 error handling 实例；
- `assets/js/gf-tokens.js` — CSS 变量解析时捕获 JSON 解析失败；
- demos/ 下的 HTML — 仅做主题/视觉演示，无独立错误处理逻辑。

## 3. 架构与约定

### 3.1 业务错误：抛 `new Error` + 就近 catch
典型用法出现在 AI 解析流程中（app.js）：

```js
if (!jsonMatch) throw new Error('No JSON found');
if (!parsed.tasks || !Array.isArray(parsed.tasks)) throw new Error('Invalid format');
```

每个调用点自行处理，例如：

- `848–856`: 解析失败后 `console.error('AI decompose parse error:', e)`，并给出用户提示；
- `4936–4994`: 将 `error: null` → 成功后写入 history，失败时设置 `historyEntry.error = 'AI 调用失败'`，并通过 UI 中的 `.ai-error` 元素回显；
- `1063–1090`: 另一处调用，同样是 catch → `console.error` → 用户可见错误。

这类错误由发起调用的函数负责判断和反馈，没有在更上层集中分发。

### 3.2 I/O 容错：就地 try/catch 吞掉
对 `localStorage` 的全局封装风格为：

```js
function store(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
}
```

这种模式在整个代码库中被重复了数十次（app.js 中约 30+ 处），涵盖折叠状态、视图选择、主题、Pomo 计时、提醒、工作流备份等所有持久化操作。捕获后不做任何额外处理——即默认“写不进去也没关系”。

### 3.3 无全局错误边界
未发现以下设施：
- 无 `window.onerror` / `unhandledrejection` 注册；
- 无全局 toast 组件；UI 上只出现过 `alert('JSON 解析失败')` 一处（`5514` 行）；
- 无错误日志上报；
- 无 `panic`/`recover`（JavaScript 语言本身没有）。

### 3.4 数据恢复容错
`foldState()` 使用 `try { return JSON.parse(...) } catch(e) { return {}; }`，确保渲染不会因为本地数据损坏而中断。

## 4. 约定与约束

根据仓库实际代码归纳出的观察：

| 类别 | 约定（描述性） |
|---|---|
| 非预期的业务错误 | 使用裸 `throw new Error('字面量消息')`，消息为英文； |
| 消费方责任 | 谁调用谁 catch，并在 catch 分支中至少 `console.error` 记录原因； |
| I/O 副作用 | `localStorage.*` 被 `try/catch` 包裹且不重新抛出； |
| 用户可见错误 | 主要放在 `div.ai-error` 等专用元素或一条 alert； |
| 数据完整性 | JSON 反序列化解法路径总是提供空默认值 `{}` 或 `[]`； |
| 未覆盖场景 | 没有统一错误对象、错误码或远程错误上报机制；异常不会冒泡。 |

这些不是文档中声明的规则，而是代码中反复出现的模式；仓库没有任何 lint、测试或编译规则强制它们。