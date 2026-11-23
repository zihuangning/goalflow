#!/usr/bin/env node
/**
 * 将 index.html + assets 内联为单文件 dist/index-standalone.html
 * 用法: node scripts/inline-bundle.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

  const tokensJs = fs.readFileSync(path.join(root, 'assets/js/gf-tokens.js'), 'utf8');
  const demosJs = fs.readFileSync(path.join(root, 'assets/js/gf-demos.js'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');

  html = html.replace(
    /<link rel="stylesheet" href="assets\/css\/main\.css(\?[^"]*)?">\s*/i,
    `<style>\n${css}\n</style>\n`
  );

  html = html.replace(
    /<script src="assets\/js\/gf-tokens\.js(\?[^"]*)?"><\/script>\s*<script src="assets\/js\/gf-demos\.js(\?[^"]*)?"><\/script>\s*<script src="assets\/js\/app\.js(\?[^"]*)?"><\/script>/i,
    `<script>\n${tokensJs}\n${demosJs}\n${appJs}\n</script>`
  );

  const outDir = path.join(root, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index-standalone.html');
  fs.writeFileSync(outFile, html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`Wrote ${outFile} (${kb} KB)`);
}

bundle();