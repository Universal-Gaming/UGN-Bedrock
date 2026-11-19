import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deploy an opt-in performance monitor without modifying engine internals.
const upstream = process.argv[2];
if (!upstream) throw new Error('Usage: node install-game-performance.mjs <upstream>');
const dist = path.resolve(upstream, 'dist');
const htmlPath = path.join(dist, 'index.html');
const jsPath = fileURLToPath(new URL('../game-performance.js', import.meta.url));
if (!fs.existsSync(htmlPath)) throw new Error('Game HTML missing. Run only after pnpm build.');
const html = fs.readFileSync(htmlPath, 'utf8');
const marker = '<script src="./ugn-performance.js" defer></script>';
if (html.includes('ugn-performance.js')) throw new Error('Performance instrumentation already installed.');
if ((html.match(/<\/body\s*>/gi) || []).length !== 1) throw new Error('Unexpected compiled HTML shape; instrumentation rejected.');
if (!fs.readFileSync(jsPath, 'utf8').includes('UGNPerformance')) throw new Error('Instrumentation file unrecognized.');
const patched = html.replace(/<\/body\s*>/i, marker + '\n</body>');
fs.copyFileSync(jsPath, path.join(dist, 'ugn-performance.js'));
fs.writeFileSync(htmlPath, patched);
console.log('[UGN perf] Opt-in game overlay installed; Ctrl+Shift+F8.');