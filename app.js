(() => {
  "use strict";

  // This wrapper loads a REAL, independently developed Java browser game
  // compiled into ./client/. It is not Minecraft's official Java client.
  const $ = (id) => document.getElementById(id);
  const scene = $("experience");
  const workspace = $("game-space");
  const mount = $("game-mount");
  const placeholder = $("engine-placeholder");
  const status = $("game-status");
  const dialog = $("information");
  const enter = $("enter-button");
  const exit = $("exit-button");
  const placeholderExit = $("placeholder-exit");
  const fullscreen = $("game-fullscreen");
  const info = $("info-button");
  const infoClose = $("info-close");
  const config = window.UGN_JAVA_CONFIG || {};
  let frame = null;
  let loading = false;
  let visible = false;

  function setVisibility(show) {
    visible = show;
    workspace.hidden = !show;
    scene.setAttribute("aria-hidden", String(show));
    document.body.style.overflow = show ? "hidden" : "";
    window.UGNScene?.setActive(!show);
    if (show) exit.focus({ preventScroll: true });
    else enter.focus({ preventScroll: true });
    if (!show && document.fullscreenElement && workspace.contains(document.fullscreenElement)) {
      document.exitFullscreen().catch(() => {});
    }
  }

  async function checkSelfHostedClient(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(path, document.baseURI);
      if (url.origin !== location.origin) throw new Error("Client must be self-hosted on UGN origin.");
      const response = await fetch(url.href, {
        method: "GET", mode: "same-origin", redirect: "error",
        credentials: "same-origin", cache: "no-store", signal: controller.signal
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        throw new Error("The real game build was not found at " + url.pathname);
      }
      return url.href;
    } finally {
      clearTimeout(timer);
    }
  }

  function showClientMissing(message) {
    status.textContent = "CLIENT BUILD UNAVAILABLE";
    placeholder.hidden = false;
    const description = placeholder.querySelector("p");
    if (description) description.textContent = message;
  }

  async function openGame() {
    setVisibility(true);
    if (frame) {
      status.textContent = "JAVA CLIENT ACTIVE";
      placeholder.hidden = true;
      frame.hidden = false;
      return;
    }
    if (loading) return;
    loading = true;
    status.textContent = "CHECKING SELF-HOSTED GAME";
    const path = String(config.clientPath || "./client/index.html");
    try {
      const src = await checkSelfHostedClient(path);
      if (!visible) return;
      status.textContent = "LOADING JAVA CLIENT";
      const iframe = document.createElement("iframe");
      iframe.id = "ugn-java-client";
      iframe.title = "UGN Java - in-browser Minecraft-compatible game client";
      iframe.src = src;
      iframe.allow = "fullscreen; clipboard-read; clipboard-write";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "same-origin";
      iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:#050611;z-index:2";
      iframe.addEventListener("load", () => {
        status.textContent = "JAVA CLIENT LOADED";
      }, { once: true });
      iframe.addEventListener("error", () => {
        frame = null;
        iframe.remove();
        showClientMissing("The Java browser client failed to load. Inspect the GitHub Pages build and try again.");
      }, { once: true });
      frame = iframe;
      placeholder.hidden = true;
      mount.appendChild(iframe);
    } catch (error) {
      showClientMissing(error instanceof Error
        ? "The game is not deployed yet: " + error.message + ". Build the pinned open-source client in GitHub Actions and deploy its files under /client/."
        : "The game could not be verified. Check the Java client Pages deployment.");
    } finally {
      loading = false;
    }
  }

  async function leaveGame() {
    setVisibility(false);
    // Keep iframe session alive within the tab; never copy game tokens into the outer page.
    if (frame) frame.hidden = true;
  }

  enter.addEventListener("click", () => { void openGame(); });
  exit.addEventListener("click", () => { void leaveGame(); });
  placeholderExit.addEventListener("click", () => { void leaveGame(); });
  info.addEventListener("click", () => dialog.showModal());
  infoClose.addEventListener("click", () => dialog.close());
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (workspace.requestFullscreen) await workspace.requestFullscreen();
    } catch {
      status.textContent = "FULLSCREEN UNAVAILABLE";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && visible && !dialog.open && !document.fullscreenElement && document.activeElement !== frame) {
      void leaveGame();
    }
  });

  // Browser multiplayer still requires an authorized WebSocket-to-TCP relay.
  // The UGN wrapper never asks for passwords or Microsoft tokens.
})();
