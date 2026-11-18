import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

/**
 * Run the actual patched Pointer Lock controller from src/utils.ts against
 * mocked browser states. This detects mouse-capture regressions before
 * compiling/publishing the Java client.
 *
 * It is a controller unit test, not an in-browser camera-rendering test.
 */
const upstream = path.resolve(process.argv[2] || "../upstream");
const source = fs.readFileSync(path.join(upstream, "src/utils.ts"), "utf8");
const from = source.indexOf("export const pointerLock = {");
const to = source.indexOf("export const isInRealGameSession", from);
assert(from >= 0 && to > from, "Can't locate upstream pointer-lock controller");
const pointerSource = source.slice(from, to);
const requireUpstream = createRequire(path.join(upstream, "package.json"));
const ts = requireUpstream("typescript");
const emitted = ts.transpileModule(pointerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;

function setup({ active = true, touch = false, escape = false, reject = false, error = false, fullScreen = false } = {}) {
  const calls = [];
  const root = {
    requestPointerLock(...args) {
      calls.push({ name: "pointerLock", args });
      if (error) throw new Error("policy blocked");
      if (reject) return Promise.reject(new Error("permission denied"));
      document.pointerLockElement = root;
      return Promise.resolve();
    }
  };
  const document = { documentElement: root, pointerLockElement: null };
  const hints = { captureMouseHint: false };
  const state = {
    document,
    isGameActive: () => active,
    miscUiState: { currentTouch: touch },
    displayHintsState: hints,
    options: { autoFullScreen: fullScreen },
    goFullscreen: () => { calls.push({ name: "fullscreen" }); return Promise.resolve(); },
    console,
    exports: {}
  };
  vm.runInNewContext(emitted, state, { timeout: 2000 });
  const pointer = state.exports.pointerLock;
  assert(pointer, "Pointer-lock controller not exported");
  pointer.justHitEscape = escape;
  return { pointer, document, calls, hints };
}

{
  const { pointer, calls, document } = setup();
  await pointer.requestPointerLock();
  assert.equal(calls.length, 1, "Game click should immediately request mouse capture");
  assert.equal(calls[0].name, "pointerLock");
  assert.equal(calls[0].args.length, 0, "Normal pointer lock must not request unsupported raw mouse movement");
  assert.equal(pointer.hasPointerLock, document.documentElement);
}
{
  const { pointer, calls } = setup({ escape: true });
  await pointer.requestPointerLock();
  assert.equal(calls.length, 1, "Click after Escape must try to recapture the cursor");
  assert.equal(pointer.justHitEscape, false);
}
{
  const { pointer, calls } = setup({ active: false });
  await pointer.requestPointerLock();
  assert.equal(calls.length, 0, "Do not capture the mouse in menus or inactive gameplay");
}
{
  const { pointer, calls } = setup({ touch: true });
  await pointer.requestPointerLock();
  assert.equal(calls.length, 0, "Touch controls should not use pointer lock");
}
{
  const { pointer, calls } = setup({ fullScreen: true });
  await pointer.requestPointerLock();
  assert.equal(calls[0].name, "pointerLock", "Capture must happen before fullscreen activation");
}
{
  const { pointer, hints } = setup({ error: true });
  await pointer.requestPointerLock();
  assert.equal(hints.captureMouseHint, true, "Synchronous failure must show capture hint");
}
{
  const { pointer, hints } = setup({ reject: true });
  await pointer.requestPointerLock();
  await Promise.resolve();
  assert.equal(hints.captureMouseHint, true, "Async failure must show capture hint");
}
console.log("[UGN mouse] 7 controller regression cases passed: click, Escape, menu, touch, fullscreen ordering, synchronous/async denial.");
