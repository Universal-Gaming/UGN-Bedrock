(() => {
  "use strict";

  // UI only. Bedrock game logic and Microsoft/Xbox auth are NOT implemented.
  // The actual game client must mount into #game-mount via a separately developed engine.
  const $ = (id) => document.getElementById(id);
  const stage = $("experience");
  const game = $("game-space");
  const mount = $("game-mount");
  const placeholder = $("engine-placeholder");
  const status = $("game-status");
  const dialog = $("information");
  const enter = $("enter-button");
  const exit = $("exit-button");
  const placeholderExit = $("placeholder-exit");
  const fullscreenButton = $("game-fullscreen");
  const info = $("info-button");
  const infoClose = $("info-close");
  let inGameSpace = false;
  let engineRunning = false;

  function setSpaceVisible(show) {
    inGameSpace = show;
    game.hidden = !show;
    stage.setAttribute("aria-hidden", String(show));
    document.body.style.overflow = show ? "hidden" : "";
    if (window.UGNScene) window.UGNScene.setActive(!show);
    if (show) {
      if (engineRunning) {
        status.textContent = "BROWSER ENGINE MOUNTED";
      } else {
        status.textContent = "RUNTIME NOT INSTALLED";
      }
      exit.focus({ preventScroll: true });
    } else {
      if (document.fullscreenElement && game.contains(document.fullscreenElement)) {
        document.exitFullscreen().catch(() => {});
      }
      enter.focus({ preventScroll: true });
    }
  }

  // Engine API contract for a future real Bedrock browser runtime:
  // window.UGNBedrockEngine = {
  //   async mount({ container, onStatus }) { ... real client ...; return true; },
  //   async suspend() { ... },
  //   async resume() { ... },
  //   async unmount() { ... }
  // }
  // Do NOT mark connected until the actual engine confirms initialization.
  async function openGame() {
    setSpaceVisible(true);
    const engine = window.UGNBedrockEngine;
    if (!engine || typeof engine.mount !== "function" || engineRunning) {
      placeholder.hidden = engineRunning;
      return;
    }
    status.textContent = "STARTING CLIENT";
    try {
      const initialized = await engine.mount({
        container: mount,
        onStatus(message) {
          if (typeof message === "string") status.textContent = message.slice(0, 60);
        }
      });
      engineRunning = initialized === true;
      placeholder.hidden = engineRunning;
      if (!engineRunning) status.textContent = "RUNTIME NOT READY";
      if (!inGameSpace && engineRunning && typeof engine.suspend === "function") {
        await engine.suspend();
      }
    } catch (error) {
      console.error("UGN Bedrock engine startup failed:", error);
      engineRunning = false;
      placeholder.hidden = false;
      status.textContent = "RUNTIME ERROR";
    }
  }

  async function leaveGame() {
    if (engineRunning && window.UGNBedrockEngine?.suspend) {
      try { await window.UGNBedrockEngine.suspend(); } catch (error) { console.warn("Unable to suspend engine", error); }
    }
    setSpaceVisible(false);
  }

  enter.addEventListener("click", () => { void openGame(); });
  exit.addEventListener("click", () => { void leaveGame(); });
  placeholderExit.addEventListener("click", () => { void leaveGame(); });
  info.addEventListener("click", () => dialog.showModal());
  infoClose.addEventListener("click", () => dialog.close());

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (game.requestFullscreen) {
        await game.requestFullscreen();
      }
    } catch {
      status.textContent = "FULLSCREEN UNAVAILABLE";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dialog.open) return; // Native dialog handles Escape itself.
    if (inGameSpace && !document.fullscreenElement) void leaveGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (!engineRunning || !window.UGNBedrockEngine) return;
    const fn = document.hidden ? window.UGNBedrockEngine.suspend : window.UGNBedrockEngine.resume;
    if (typeof fn === "function" && inGameSpace) {
      Promise.resolve(fn.call(window.UGNBedrockEngine)).catch((error) => console.warn("Engine visibility transition failed", error));
    }
  });
})();
