import fs from "node:fs";
import path from "node:path";

/**
 * Restore world attack/use when UGN free-look is active without Pointer Lock.
 * Upstream's trusted-click guard must still protect menus and other UI.
 */
const root=process.argv[2];
if(!root)throw new Error("Usage: node restore-block-interactions.mjs <upstream-root>");
const controlsPath=path.join(root,"src/controls.ts");
const mousePath=path.join(root,"src/mineflayer/plugins/mouse.ts");
let controls=fs.readFileSync(controlsPath,"utf8");
let mouse=fs.readFileSync(mousePath,"utf8");
const replaceOnce=(source,oldText,newText,label)=>{
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error("Unexpected "+label+" anchor count: "+count);
  return source.replace(oldText,newText);
};

controls=replaceOnce(controls,
  "  lockGranted: false,\n  lockErrors: 0,",
  "  lockGranted: false,\n  fallbackActive: false,\n  lockErrors: 0,",
  "UGN diagnostics flag");
controls=replaceOnce(controls,
  "  ugnMouseStats.lockGranted = hasLock\n  if (ugnButton)",
  "  ugnMouseStats.lockGranted = hasLock\n  ugnMouseStats.fallbackActive = playing && ugnFreeLook && !hasLock\n  if (ugnButton)",
  "fallback HUD state");
controls=replaceOnce(controls,
  "event.button !== 0 || !ugnPlaying() || document.pointerLockElement) return",
  "event.button !== 0 || !ugnPlaying() || document.pointerLockElement || ugnFreeLook) return",
  "stop re-requesting pointer lock for every mining click");
controls=replaceOnce(controls,
  "window.addEventListener('blur', () => { ugnDragging = false })",
  "window.addEventListener('blur', () => { ugnDragging = false; ugnFreeLook = false; ugnMouseStats.fallbackActive = false })",
  "blur cleanup");

const oldGuard="    if (e.isTrusted && !document.pointerLockElement && !isCypress()) return";
const newGuard=[
  "    // UGN: trusted gameplay clicks require native lock OR active free look.",
  "    const hasPointerLock = !!document.pointerLockElement",
  "    const ugnFallback = !!(window as any).UGNMouseDiagnostics?.fallbackActive",
  "    if (e.isTrusted && !hasPointerLock && !ugnFallback && !isCypress()) return",
  "    if (e.isTrusted && !hasPointerLock && ugnFallback) {",
  "      const target = e.target as Element | null",
  "      // Never mine/place when clicking settings, inventory, or the capture HUD.",
  "      if (!target || typeof target.closest !== 'function' ||",
  "          target.closest('button,a,input,textarea,select,[role=\"dialog\"],.ugn-mouse-capture,[data-no-game-click]')) return",
  "    }"
].join("\n");
mouse=replaceOnce(mouse,oldGuard,newGuard,"trusted mouse guard");

const contextAnchor="  document.addEventListener('mouseup', (e) => {";
const contextGuard=[
  "  document.addEventListener('contextmenu', (e) => {",
  "    const captured = !!document.pointerLockElement",
  "    const fallback = !!(window as any).UGNMouseDiagnostics?.fallbackActive",
  "    if (!isGameActive(true) || (!captured && !fallback)) return",
  "    const target = e.target as Element | null",
  "    if (target && typeof target.closest === 'function' &&",
  "        target.closest('button,a,input,textarea,select,[role=\"dialog\"],.ugn-mouse-capture,[data-no-game-click]')) return",
  "    e.preventDefault()",
  "  }, { signal: abortController.signal })",
  ""
].join("\n");
mouse=replaceOnce(mouse,contextAnchor,contextGuard+contextAnchor,"world right-click contextmenu");

fs.writeFileSync(controlsPath,controls);
fs.writeFileSync(mousePath,mouse);
console.log("[UGN interactions] Trusted left/right world clicks restored in Free Look; UI remains protected.");
