#!/usr/bin/env node
/**
 * 将 index.html + assets 内联为单文件 dist/index-standalone.html
 * 用法: node scripts/inline-bundle.mjs
 * 脚本顺序与 scripts/app-scripts.cjs 的 APP_SCRIPT_PARTS 一致。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const { APP_SCRIPT_PARTS } = require('./app-scripts.cjs');

function expandCss(filePath) {
  const dir = path.dirname(filePath);
  let css = fs.readFileSync(filePath, 'utf8');
  return css.replace(
    /@import\s+url\(['"]?\.\/([^'")]+)['"]?\)\s*;?/g,
    (_, rel) => expandCss(path.join(dir, rel)) + '\n'
  );
}

function bundle() {
  const htmlPath = path.join(root, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const mainCss = path.join(root, 'assets/css/main.css');
  const css = expandCss(mainCss);

  const jsBlob = APP_SCRIPT_PARTS.map(rel => fs.readFileSync(path.join(root, rel), 'utf8')).join('\n;\n');

  html = html.replace(
    /<link rel="stylesheet" href="assets\/css\/main\.css(\?[^"]*)?">\s*/i,
    `<style>\n${css}\n</style>\n`
  );

  // 连续 script 标签（数量可变）整段替换为一个内联 script
  html = html.replace(
    /(?:<script src="assets\/js\/[^"]+"><\/script>\s*)+/i,
    `<script>\n${jsBlob}\n</script>\n`
  );

  const outDir = path.join(root, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index-standalone.html');
  fs.writeFileSync(outFile, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`Wrote ${outFile} (${kb} KB) · ${APP_SCRIPT_PARTS.length} scripts`);
}

bundle();
