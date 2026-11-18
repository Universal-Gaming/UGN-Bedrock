import fs from "node:fs";
import path from "node:path";

/**
 * Fix the embedded Java client's mouse-look capture.
 * In Firefox and some embedded Chromium configurations, requesting raw
 * pointer movement first can reject. Retrying from an async catch is too late
 * to retain the original click's transient user activation.
 *
 * Call the standard Pointer Lock API synchronously from the game's existing
 * mousedown handler (src/controls.ts), keeping its game-active gate intact.
 */
const root = process.argv[2];
if (!root) throw new Error("Usage: node fix-mouse-look.mjs <upstream-root>");
const sourcePath = path.join(root, "src/utils.ts");
const original = fs.readFileSync(sourcePath, "utf8");
const begin = original.indexOf("export const pointerLock = {");
const end = original.indexOf("export const isInRealGameSession", begin);
if (begin === -1 || end === -1 || end < begin) {
  throw new Error("Upstream pointerLock implementation moved: review patch before releasing.");
}
const previous = original.slice(begin, end);
if (!previous.includes("document.documentElement.requestPointerLock({") || !previous.includes("this.justHitEscape = false")) {
  throw new Error("Unexpected upstream mouse capture implementation; refusing unsafe blind edit.");
}
const replacement = \`export const pointerLock = {
  get hasPointerLock () {
    return document.pointerLockElement
  },
  justHitEscape: false,
  async requestPointerLock () {
    if (!isGameActive(true) || !document.documentElement.requestPointerLock || miscUiState.currentTouch) {
      return
    }
    if (document.pointerLockElement === document.documentElement) return

    // UGN: Always request normal (accelerated) pointer lock while the actual
    // mousedown gesture is active. Do NOT first request unadjustedMovement and
    // then retry asynchronously: that often fails in Firefox / an iframe.
    // Escape intentionally releases the pointer; the NEXT user click recaptures.
    const displayMouseCaptureFailure = (error?: unknown) => {
      displayHintsState.captureMouseHint = true
      if (error) console.warn('[UGN mouse capture] Could not lock cursor:', error)
    }
    try {
      const attempt = document.documentElement.requestPointerLock()
      // Older browsers return void. Modern browsers return a Promise.
      // The pointer lock request itself MUST happen synchronously, here.
      if (attempt && typeof (attempt as Promise<void>).catch === 'function') {
        void (attempt as Promise<void>).catch(displayMouseCaptureFailure)
      }
    } catch (error) {
      displayMouseCaptureFailure(error)
    }
    // Preserve upstream fullscreen option, but never spend the click's
    // transient activation before making the pointer-lock request.
    if (options.autoFullScreen) void goFullscreen()
    this.justHitEscape = false
  }
}

\`;
fs.writeFileSync(sourcePath, original.slice(0, begin) + replacement + original.slice(end));
console.log("[UGN mouse] Patched pointer lock to use synchronous standard mouse capture.");
