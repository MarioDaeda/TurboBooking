// Genera ../TurboBooking.html: l'app completa (tutte le sezioni) in un unico file HTML autonomo
// che si apre con doppio clic, senza terminale, server o connessione (immagini incluse).
//
// Uso: npm run build:html   (dalla cartella frontend)
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.resolve(frontendDir, '..', 'TurboBooking.html');

console.log('• Compilo il CSS Tailwind…');
const css = execFileSync(
  path.join(frontendDir, 'node_modules/.bin/tailwindcss'),
  ['-c', 'tailwind.config.ts', '-i', 'src/app/globals.css', '--minify'],
  { cwd: frontendDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
);

console.log('• Compilo l\'app React…');
const result = await build({
  absWorkingDir: frontendDir,
  entryPoints: ['standalone/main.tsx'],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: ['es2019', 'safari14'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'warning',
  logOverride: { 'unsupported-directive': 'silent' },
});
let js = result.outputFiles[0].text;

console.log('• Incorporo le immagini…');
const imageUrls = [...new Set(js.match(/https:\/\/images\.unsplash\.com\/[^"'`\s)]+/g) || [])];
for (const url of imageUrls) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || 'image/jpeg';
    const data = Buffer.from(await res.arrayBuffer()).toString('base64');
    js = js.split(url).join(`data:${type};base64,${data}`);
  } catch (err) {
    console.warn(`  ! immagine non incorporata (resterà online): ${url} — ${err.message}`);
  }
}

const safeJs = js.replace(/<\/script/gi, '<\\/script');
const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FFFFFF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TurboBooking">
<meta name="darkreader-lock">
<title>TurboBooking — Gestionale Salone</title>
<style>${css}</style>
</head>
<body class="antialiased">
<div id="root"></div>
<noscript>Per usare TurboBooking abilita JavaScript nel browser.</noscript>
<script>${safeJs}</script>
</body>
</html>
`;

writeFileSync(outFile, html);
console.log(`✓ Creato ${path.relative(process.cwd(), outFile)} (${(html.length / 1024).toFixed(0)} KB)`);
