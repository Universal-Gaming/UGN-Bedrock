(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const area = $("arena");
  const status = $("status");
  const output = $("results");
  const model = $("world");
  const stats = {
    secureContext: window.isSecureContext,
    embeddedFrame: window.top !== window,
    pointerLockSupported: typeof area.requestPointerLock === "function",
    browser: navigator.userAgent,
    attempts: 0,
    granted: false,
    errorCount: 0,
    lastError: "",
    mouseEvents: 0,
    nonzeroMovements: 0,
    yaw: 15,
    pitch: 12
  };
  function update() {
    stats.granted = document.pointerLockElement === area;
    output.textContent = JSON.stringify(stats, null, 2);
    model.style.transform = `rotateX(${stats.pitch}deg) rotateY(${stats.yaw}deg)`;
  }
  function attempt() {
    stats.attempts++;
    stats.lastError = "";
    status.textContent = "Requesting mouse capture from this click…";
    if (!stats.pointerLockSupported) {
      stats.lastError = "Pointer Lock API is unavailable";
      status.textContent = stats.lastError;
      update();
      return;
    }
    try {
      const p = area.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch((e) => {
        stats.lastError = (e?.name || "Error") + ": " + (e?.message || "Unknown capture failure");
        status.textContent = "Mouse lock failed: " + stats.lastError;
        update();
      });
    } catch (e) {
      stats.lastError = (e?.name || "Error") + ": " + (e?.message || "Unknown capture failure");
      status.textContent = "Mouse lock failed: " + stats.lastError;
      update();
    }
    update();
  }
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === area) {
      stats.lastError = "";
      status.textContent = "MOUSE LOCK GRANTED · MOVE TO ROTATE · ESC TO RELEASE";
    } else {
      status.textContent = "Mouse unlocked. Click to capture again.";
    }
    update();
  });
  document.addEventListener("pointerlockerror", () => {
    stats.errorCount++;
    if (!stats.lastError) stats.lastError = "Browser emitted pointerlockerror";
    status.textContent = "MOUSE LOCK BLOCKED: " + stats.lastError;
    update();
  });
  document.addEventListener("mousemove", (event) => {
    stats.mouseEvents++;
    if (event.movementX || event.movementY) {
      stats.nonzeroMovements++;
      if (document.pointerLockElement === area) {
        stats.yaw += event.movementX * 0.4;
        stats.pitch = Math.max(-75, Math.min(75, stats.pitch - event.movementY * 0.4));
      }
    }
    update();
  });
  $("capture").addEventListener("click", attempt);
  area.addEventListener("click", () => {
    if (!document.pointerLockElement) attempt();
  });
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(stats, null, 2));
      status.textContent = "Results copied. No world or account data included.";
    } catch {
      output.focus();
      status.textContent = "Copy unavailable. Select the results below to copy them manually.";
    }
  });
  update();
})();
