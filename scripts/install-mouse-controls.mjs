import fs from "node:fs";
import path from "node:path";

/**
 * UGN mouse-capture UX and fallback. Installed after fix-mouse-look.mjs.
 * This supplements (does not bypass) browser pointer lock permissions.
 * Uses the actual player's camera handler for Shift+drag fallback.
 */
const root = process.argv[2];
if (!root) throw new Error("Usage: node install-mouse-controls.mjs <upstream-root>");
const controlsFile = path.join(root, "src/controls.ts");
const cameraFile = path.join(root, "src/cameraRotationControls.ts");
const cssFile = path.join(root, "src/styles.css");

let controls = fs.readFileSync(controlsFile, "utf8");
let camera = fs.readFileSync(cameraFile, "utf8");
if (!controls.includes("import { onCameraMove, onControInit } from './cameraRotationControls'")) {
  throw new Error("Upstream controls import changed; refusing to patch.");
}
if (!controls.includes("addEventListener('mousedown', async (e) => {")) {
  throw new Error("Upstream mouse event handler changed; refusing to patch.");
}
if (!camera.includes("export function onCameraMove (e: MouseEvent | CameraMoveEvent) {")) {
  throw new Error("Upstream camera move handler changed; refusing to patch.");
}

const component = String.raw\`

// UGN browser mouse capture. This is shown only while actually playing.
// It displays browser permission failures and provides a Shift+drag fallback.
const ugnMouseStats = {
  captureAttempts: 0,
  lockGranted: false,
  lockErrors: 0,
  mouseEvents: 0,
  nonZeroMouseEvents: 0,
  cameraUpdates: 0,
  dragUpdates: 0,
  lastError: ''
}
;(window as any).UGNMouseDiagnostics = ugnMouseStats

let ugnDragging = false
let ugnLastX = 0
let ugnLastY = 0
let ugnWidget: HTMLDivElement | undefined
let ugnButton: HTMLButtonElement | undefined
let ugnFeedback: HTMLSpanElement | undefined
let ugnCapturePending = false

function ugnPlaying () {
  return isGameActive(true) && !miscUiState.currentTouch
}

function ugnCaptureStatus (text: string) {
  if (ugnFeedback) ugnFeedback.textContent = text
}

function ugnUpdateCaptureHud () {
  if (!ugnWidget) return
  const playing = ugnPlaying()
  ugnWidget.style.display = playing ? 'flex' : 'none'
  if (!playing) return
  const hasLock = document.pointerLockElement === document.documentElement
  ugnMouseStats.lockGranted = hasLock
  if (ugnButton) ugnButton.style.display = hasLock ? 'none' : 'block'
  if (hasLock) {
    if (ugnMouseStats.nonZeroMouseEvents && !ugnMouseStats.cameraUpdates) {
      ugnCaptureStatus('CURSOR LOCKED · CHECK CAMERA INPUT')
    } else {
      ugnCaptureStatus('MOUSE LOCKED · ESC TO RELEASE')
    }
  } else if (!ugnCapturePending && !ugnMouseStats.lastError) {
    ugnCaptureStatus('CLICK TO CAPTURE · SHIFT+DRAG FALLBACK')
  }
}

function ugnTryCapture () {
  if (!ugnPlaying()) return
  ugnMouseStats.captureAttempts += 1
  ugnMouseStats.lastError = ''
  ugnCapturePending = true
  ugnCaptureStatus('REQUESTING MOUSE CONTROL…')
  // The original patched pointer-lock method calls requestPointerLock()
  // immediately, before returning from this real mousedown gesture.
  void pointerLock.requestPointerLock()
  window.setTimeout(() => {
    ugnCapturePending = false
    if (ugnPlaying() && !document.pointerLockElement) {
      if (!ugnMouseStats.lastError) {
        ugnMouseStats.lastError = 'Capture not granted'
      }
      ugnCaptureStatus('MOUSE LOCK DENIED · SHIFT+DRAG TO LOOK')
    }
    ugnUpdateCaptureHud()
  }, 650)
}

function ugnMountCaptureHud () {
  if (ugnWidget || !document.body) return
  const box = document.createElement('div')
  box.className = 'ugn-mouse-capture'
  box.setAttribute('aria-label', 'UGN mouse-look controls')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ugn-mouse-capture-button'
  button.textContent = '⌖ CAPTURE MOUSE'
  button.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    ugnTryCapture()
  })
  // A button click from the keyboard also provides an activation gesture.
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return
    ugnTryCapture()
  })
  const caption = document.createElement('span')
  caption.className = 'ugn-mouse-capture-status'
  caption.setAttribute('role', 'status')
  caption.setAttribute('aria-live', 'polite')
  caption.textContent = 'CLICK TO CAPTURE · SHIFT+DRAG FALLBACK'
  box.append(button, caption)
  document.body.appendChild(box)
  ugnWidget = box
  ugnButton = button
  ugnFeedback = caption
  ugnUpdateCaptureHud()
}

if (document.body) ugnMountCaptureHud()
else document.addEventListener('DOMContentLoaded', ugnMountCaptureHud, { once: true })
document.addEventListener('pointerlockchange', () => {
  ugnCapturePending = false
  ugnMouseStats.lockGranted = document.pointerLockElement === document.documentElement
  ugnMouseStats.lastError = ''
  ugnUpdateCaptureHud()
})
document.addEventListener('pointerlockerror', () => {
  ugnCapturePending = false
  ugnMouseStats.lockErrors++
  ugnMouseStats.lastError = 'Browser denied pointer lock'
  ugnCaptureStatus('BROWSER BLOCKED LOCK · SHIFT+DRAG TO LOOK')
  ugnUpdateCaptureHud()
})

document.addEventListener('mousemove', (event) => {
  if (!ugnPlaying()) return
  ugnMouseStats.mouseEvents++
  if (event.movementX !== 0 || event.movementY !== 0) {
    ugnMouseStats.nonZeroMouseEvents++
  }
  // Fallback works with mouse capture denied, without modifying keybinds,
  // inventory controls, or the existing camera handler.
  if (ugnDragging && !document.pointerLockElement) {
    const dx = event.clientX - ugnLastX
    const dy = event.clientY - ugnLastY
    ugnLastX = event.clientX
    ugnLastY = event.clientY
    if (!dx && !dy) return
    ugnMouseStats.dragUpdates++
    onCameraMove({
      type: 'ugn-drag',
      movementX: dx,
      movementY: dy,
      stopPropagation () {}
    })
  }
}, { capture: true })

document.addEventListener('mousedown', (event) => {
  if (!ugnPlaying() || document.pointerLockElement) return
  if (event.shiftKey && event.button === 0 && !event.target?.closest?.('button,input,textarea,a')) {
    // Shift+drag only activates if browser capture is unavailable.
    ugnDragging = true
    ugnLastX = event.clientX
    ugnLastY = event.clientY
    event.preventDefault()
  }
}, { capture: true })
window.addEventListener('mouseup', () => { ugnDragging = false })
window.addEventListener('blur', () => { ugnDragging = false })
document.addEventListener('pointerlockchange', () => { ugnDragging = false })
window.setInterval(ugnUpdateCaptureHud, 450)
\`;

controls += component;

const handlerStart = "export function onCameraMove (e: MouseEvent | CameraMoveEvent) {\n";
const handlerNew = \`export function onCameraMove (e: MouseEvent | CameraMoveEvent) {
  const ugnMouseStats = (window as any).UGNMouseDiagnostics
\`;
if(camera.split(handlerStart).length!==2) throw new Error("Camera handler location changed");
camera = camera.replace(handlerStart, handlerNew);
const target = "  bot.mouse.update()\n  updateMotion()";
if(camera.split(target).length!==2) throw new Error("Camera update block changed");
camera = camera.replace(target, \`  if (ugnMouseStats) ugnMouseStats.cameraUpdates++
  bot.mouse.update()
  updateMotion()\`);

const css = String.raw\`

/* Scoped UGN in-game mouse capture feedback, outside inventory & hotbar */
.ugn-mouse-capture {
  position: fixed;
  top: 10px;
  right: 12px;
  z-index: 11000;
  display: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  font-family: mojangles, 'Segoe UI', monospace;
  pointer-events: none;
}
.ugn-mouse-capture-button {
  pointer-events: auto;
  cursor: pointer;
  padding: 8px 11px;
  font-size: 11px;
  font-weight: bold;
  color: #d9fff2;
  border-radius: 4px;
  border: 1px solid #65eca8;
  background: linear-gradient(110deg, #174f58, #302d77);
  box-shadow: 0 3px 14px rgba(0,0,0,.5);
}
.ugn-mouse-capture-button:hover {
  filter: brightness(1.22);
}
.ugn-mouse-capture-status {
  color: #cfeaf8;
  font-size: 9px;
  text-shadow: 0 2px 4px #000;
  background: rgba(5,8,23,.72);
  border-radius: 3px;
  padding: 4px 6px;
  max-width: 230px;
  text-align: right;
}
@media (max-width: 600px) {
  .ugn-mouse-capture { top: 4px; right: 5px; }
  .ugn-mouse-capture-button { font-size: 10px; padding: 6px; }
  .ugn-mouse-capture-status { font-size: 8px; }
}
\`;

fs.writeFileSync(controlsFile, controls);
fs.writeFileSync(cameraFile, camera);
fs.appendFileSync(cssFile, css);
console.log("[UGN mouse] Installed capture button, lock diagnostics, and Shift+drag camera fallback.");
