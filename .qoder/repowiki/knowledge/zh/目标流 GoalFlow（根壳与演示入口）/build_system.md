## 1. 整体方法
GoalFlow 是一个「纯前端、零依赖」的静态站点项目：HTML/CSS/JS 源文件可直接被浏览器加载，**没有 Makefile、没有 npm scripts、没有 Dockerfile、没有 CI 配置**。仓库根和 `demos/` 下的 HTML 文件都是静态资源，部署即把整个目录放在任意 HTTP 服务器上即可。

唯一与构建相关的逻辑位于 `scripts/inline-bundle.mjs`（Node.js ESM），作用是把多文件的 `index.html` + `assets/` 内联成单个离线的 `dist/index-standalone.html`——供需要一次性分发（例如邮件附件或离线文档）的场景使用。

## 2. 关键文件
- `scripts/inline-bundle.mjs` — 唯一的打包器；使用 Node.js `fs` / `path` 原生命令，无任何第三方依赖。运行命令：`node scripts/inline-bundle.mjs`。
- `index.html` — 入口壳，引用 `assets/css/main.css` 和三个 JS 文件；打包后这些 `<link>/<script>` 被替换为内联 `<style>/<script>` 内容。
- `assets/css/main.css` — 打包时会被递归展开所有 `@import url(...)` 引用（`expandCss` 中的正则匹配相对路径 `@import url('./...')`）。
- `assets/js/gf-tokens.js`、`assets/js/gf-demos.js`、`assets/js/app.js` — 按此顺序串行注入到内联 `<script>` 块中。
- `demos/*.html` — 同主题演示页，共享同一套 assets，无需额外构建步骤。

## 3. 架构与约定
- **源码 = 产物**：最终网站就是 `index.html` + `assets/` + `demos/` 的原样结构，无需编译器或 bundler。这是设计选择（参见项目概述“纯前端零构建项目”）。
- **仅有一个可选产物**：`dist/` 是脚本生成的输出目录，不会提交到版本库，包含单个 `index-standalone.html`。
- **无版本号、无压缩、无哈希**：`inline-bundle.mjs` 只做纯文本拼接并打印 `Wrote ... (xx.x KB)`；不进行 Terser/Uglify 压缩、不做文件名 hash、不生成 source map。
- **CSS import 处理策略**：通过正则 `/@import\s+url(['"]?\.\/[^'")]+)['"]?\)\s*;?/` 递归读取并展开同级 `@import`，因此 `assets/css/components/*.css` 可通过 `main.css` 的 `@import url('./components/...')` 间接引入。
- **JS 内联顺序固定**：tokens → demos → app（先定义 token，再定义 demo 数据，最后运行主逻辑）。

## 4. 约定与约束
- 不存在 Makefile / build.sh / package.json scripts / docker-compose.yml / GitHub Actions / CI YAML 等自动化构建流程——这一点已在根目录及全仓扫描后确认。
- `inline-bundle.mjs` 硬编码了要处理的 HTML 标签模式：
  - 样式匹配正则：`<link rel="stylesheet" href="assets\/css\/main\.css(\?[^"]*)?">\s*`
  - 脚本匹配正则：`<script src="assets\/js\/gf-tokens\.js(\?[^"]*)?"><\/script>\s*<script src="assets\/js\/gf-demos\.js(\?[^"]*)?"><\/script>\s*<script src="assets\/js\/app\.js(\?[^"]*)?"><\/script>`
  - 若希望保持自动内联，必须维持这两个标签的书写形式（允许 URL 带 query 参数），否则脚本会跳过替换。
- CSS `@import` 语法必须是 `@import url("./xxx")` 或 `@import url('./xxx');` 形式，其他变体不会被递归展开（由内联脚本的正则决定）。
- 由于没有跨平台编译、交叉编译或容器化步骤，该项目不具备 CI/CD 流水线或 release artifact 管理逻辑。发布工作即直接推送源代码，由托管平台（如 Vercel/GitHub Pages）在外部完成部署。