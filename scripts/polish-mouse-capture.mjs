import fs from "node:fs";
import path from "node:path";

/**
 * Finalize UGN cursor control after fix-mouse-look and install-mouse-controls.
 *
 * Pointer Lock is the only web-standard way to stop the cursor at window edges.
 * Request from the direct mouse POINTERDOWN gesture, not a timer or synthetic
 * event. Once captured, hide both the center tooltip and corner control.
 * If the browser denies permission, keep honest free-look fallback messaging.
 */
const root = process.argv[2];
if (!root) throw new Error("Usage: node polish-mouse-capture.mjs <upstream-root>");
const controlsPath = path.join(root, "src/controls.ts");
const hintsPath = path.join(root, "src/react/GlobalOverlayHints.tsx");
let controls = fs.readFileSync(controlsPath, "utf8");
let hints = fs.readFileSync(hintsPath, "utf8");

function replaceOnce(src, match, replacement, label) {
  const n = src.split(match).length - 1;
  if (n !== 1) throw new Error("Unexpected upstream " + label + " count: " + n);
  return src.replace(match, replacement);
}

// The normal upstream game mousedown handler now runs after the dedicated
// pointerdown request; avoid duplicate lock requests during one click.
controls = replaceOnce(
  controls,
  "  void pointerLock.requestPointerLock()\n  if (!bot) return",
  "  if (!ugnCapturePending && !document.pointerLockElement) void pointerLock.requestPointerLock()\n  if (!bot) return",
  "upstream mouse handler"
);

// A native lock automatically hides the cursor; also hide our custom HUD.
controls = replaceOnce(
  controls,
  "  const hasLock = document.pointerLockElement === document.documentElement\n  ugnMouseStats.lockGranted = hasLock",
  "  const hasLock = document.pointerLockElement === document.documentElement\n  if (hasLock) ugnWidget.style.display = 'none'\n  ugnMouseStats.lockGranted = hasLock",
  "capture HUD hide-on-lock"
);

// Ask for capture on mouse pointerdown, a recognized transient activation.
// This happens before upstream's mousedown and catches clicks inside the game.
const eventAnchor = "function ugnMountCaptureHud () {";
const directGesture = [
  "document.addEventListener('pointerdown', (event) => {",
  "  if (event.pointerType !== 'mouse' || event.button !== 0 || !ugnPlaying() || document.pointerLockElement) return",
  "  const target = event.target as HTMLElement | null",
  "  if (target?.closest?.('button, a, input, textarea, select, [role=\"dialog\"], .ugn-mouse-capture')) return",
  "  // The request happens synchronously in a trusted input event.",
  "  ugnTryCapture()",
  "}, { capture: true })",
  "",
].join("\n");
controls = replaceOnce(controls, eventAnchor, directGesture + eventAnchor, "direct gameplay pointerdown");

// The dedicated button must also request capture on pointerdown (not just
// mousedown), and block the upstream game action from the same click.
const oldButton = [
  "  button.addEventListener('mousedown', (event) => {",
  "    if (event.button !== 0) return",
  "    event.stopPropagation()",
  "    ugnTryCapture()",
  "  })"
].join("\n");
const newButton = [
  "  button.addEventListener('pointerdown', (event) => {",
  "    if (event.pointerType !== 'mouse' || event.button !== 0) return",
  "    event.stopPropagation()",
  "    event.preventDefault()",
  "    ugnTryCapture()",
  "  })",
  "  button.addEventListener('mousedown', (event) => event.stopPropagation())"
].join("\n");
controls = replaceOnce(controls, oldButton, newButton, "capture button pointerdown");

// Do not claim the pointer is confined while fallback free look is active.
const previousFallback = "FREE LOOK ACTIVE · MOVE MOUSE (ESC TO STOP)";
if (controls.split(previousFallback).length - 1 !== 2) {
  throw new Error("Unexpected fallback status labels in UGN mouse installer");
}
controls = controls.replaceAll(previousFallback, "FREE LOOK · CURSOR NOT LOCKED · CLICK TO RETRY");
controls = replaceOnce(
  controls,
  "ugnCaptureStatus('BROWSER BLOCKED LOCK · FREE LOOK ACTIVE')",
  "ugnCaptureStatus('BROWSER DENIED POINTER LOCK · CLICK TO RETRY')",
  "capture denial"
);
controls = replaceOnce(
  controls,
  "    ugnFreeLook = false\n    if (ugnMouseStats.nonZeroMouseEvents",
  "    ugnFreeLook = false\n    if (ugnMouseStats.nonZeroMouseEvents",
  "lock success handler"
);
// Ensure no residual free-look motion when native mouse capture is granted.
const lockChange = "  ugnMouseStats.lockGranted = document.pointerLockElement === document.documentElement\n  ugnMouseStats.lastError = ''";
controls = replaceOnce(controls, lockChange,
  "  ugnMouseStats.lockGranted = document.pointerLockElement === document.documentElement\n  if (ugnMouseStats.lockGranted) ugnFreeLook = false\n  ugnMouseStats.lastError = ''",
  "lock state");


// The upstream hint is a React center-screen overlay. Stop showing the
// "Click to capture mouse" hint once the player has clicked during gameplay.
// It remains a first-use hint only, not a persistent gameplay obstruction.
hints = replaceOnce(hints, "import { useEffect } from 'react'",
  "import { useEffect, useState } from 'react'", "React state import");
hints = replaceOnce(
  hints,
  "  const { captureMouseHint } = useSnapshot(displayHintsState)",
  "  const { captureMouseHint } = useSnapshot(displayHintsState)\n  const [hasClickedGame, setHasClickedGame] = useState(false)",
  "hint state"
);
hints = replaceOnce(
  hints,
  "    document.addEventListener('pointerlockchange', listener)",
  "    const onGamePointerDown = () => {\n      if (miscUiState.gameLoaded && activeModalStack.length === 0) setHasClickedGame(true)\n    }\n    document.addEventListener('pointerdown', onGamePointerDown, true)\n    document.addEventListener('pointerlockchange', listener)",
  "hint click listener"
);
hints = replaceOnce(
  hints,
  "      document.removeEventListener('pointerlockchange', listener)",
  "      document.removeEventListener('pointerdown', onGamePointerDown, true)\n      document.removeEventListener('pointerlockchange', listener)",
  "hint click cleanup"
);
hints = replaceOnce(
  hints,
  "{captureMouseHint && !usingTouch &&",
  "{captureMouseHint && !hasClickedGame && !usingTouch &&",
  "center hint condition"
);

fs.writeFileSync(controlsPath, controls);
fs.writeFileSync(hintsPath, hints);
console.log("[UGN pointer lock] Direct pointerdown capture, hidden native-lock HUD, one-time center hint.");
