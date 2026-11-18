import fs from "node:fs";
import path from "node:path";

/**
 * Verify the built client contains terrain geometry and asset data needed
 * by minecraft-renderer's WebGL terrain renderer.
 *
 * This is a packaging check, NOT a claim that the browser renders correctly.
 */
const upstream = process.argv[2];
if (!upstream) throw new Error("Usage: node verify-game-assets.mjs <upstream-dir>");
const dist = path.resolve(upstream, "dist");
const issues = [];
const stats = [];
function fileCheck(relative, minimum = 50) {
  const location = path.join(dist, relative);
  try {
    const st = fs.statSync(location);
    if (!st.isFile() || st.size < minimum) {
      issues.push(relative + " is empty or unexpectedly small");
      return;
    }
    stats.push({ name: relative, bytes: st.size });
  } catch {
    issues.push("Missing essential game asset: " + relative);
  }
}
function directoryCheck(relative, minimumFiles = 1) {
  const location = path.join(dist, relative);
  try {
    const st = fs.statSync(location);
    if (!st.isDirectory()) throw new Error("not a directory");
    const entries = fs.readdirSync(location);
    if (entries.length < minimumFiles) throw new Error("no entries");
    stats.push({ name: relative, entries: entries.length });
  } catch (error) {
    issues.push("Missing or empty game asset directory: " + relative + " (" + error.message + ")");
  }
}
// Required meshing / worker artifacts; without these world blocks may be invisible.
fileCheck("index.html", 500);
fileCheck("mesher.js", 1000);
fileCheck("lightOwnerWorker.js", 500);
directoryCheck("textures/entity");
directoryCheck("static/js");

// Verify the source generation pipeline produced terrain atlas and block data.
for (const relative of ["generated/mc-assets-compressed.js", "generated/minecraft-data-optimized.json"]) {
  const location = path.join(upstream, relative);
  try {
    const st = fs.statSync(location);
    if (st.size < 1000) issues.push("Generated Minecraft block resources are suspiciously small: " + relative);
    stats.push({ name: relative, bytes: st.size });
  } catch {
    issues.push("Missing generated Minecraft block resources: " + relative);
  }
}
const wasm = path.join(dist, "wasm_mesher_bg.wasm");
if (fs.existsSync(wasm)) {
  const st = fs.statSync(wasm);
  stats.push({ name: "wasm_mesher_bg.wasm (optional with legacy-js fallback)", bytes: st.size });
} else {
  console.warn("WASM mesher binary unavailable; legacy-js fallback must remain enabled.");
}
for (const stat of stats) console.log("[UGN asset check]", stat);
if (issues.length) {
  console.error("UGN Java build asset verification FAILED:\n - " + issues.join("\n - "));
  process.exitCode = 1;
} else {
  console.log("UGN Java assets packaged: block data, textures and mesher scripts were generated.");
}
