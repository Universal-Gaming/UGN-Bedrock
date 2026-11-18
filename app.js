(() => {
  "use strict";
  // UGN outer UI never asks for passwords, creates player profiles, or stores login tokens.
  // The separately built upstream Java-compatible client controls its own world and account settings.
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
  const readiness = $("client-readiness");
  const cardStatus = $("portal-client-status");
  const config = window.UGN_JAVA_CONFIG || {};
  let frame = null;
  let loading = false;
  let visible = false;
  let buildPromise = null;
  let requestNumber = 0;
  const buildMetadata = String(config.buildMetadataPath || "./client/ugn-build.json");
  const clientPath = String(config.clientPath || "./client/index.html");

  function note(text, value) {
    if (readiness) readiness.textContent = text;
    if (cardStatus) cardStatus.textContent = value;
  }

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

  async function getBuild() {
    if (buildPromise) return buildPromise;
    buildPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const metaUrl = new URL(buildMetadata, document.baseURI);
        const clientUrl = new URL(clientPath, document.baseURI);
        if (metaUrl.origin !== location.origin || clientUrl.origin !== location.origin) {
          throw new Error("The game client must be hosted on the same site.");
        }
        const response = await fetch(metaUrl.href, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("The compiled Java browser client has not been deployed.");
        }
        const manifest = await response.json();
        if (!manifest || manifest.client !== "minecraft-web-client" || !/^[a-f0-9]{40}$/.test(manifest.upstreamCommit)) {
          throw new Error("Unrecognized or incomplete UGN game build.");
        }
        const htmlResponse = await fetch(clientUrl.href, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!htmlResponse.ok || !htmlResponse.headers.get("content-type")?.includes("text/html")) {
          throw new Error("The game entrypoint is missing.");
        }
        return { url: clientUrl.href, manifest };
      } finally {
        clearTimeout(timer);
      }
    })();
    try {
      return await buildPromise;
    } catch (error) {
      buildPromise = null;
      throw error;
    }
  }

  function showMissing(error) {
    status.textContent = "GAME BUILD UNAVAILABLE";
    placeholder.hidden = false;
    note("BUILD NOT VERIFIED", "Game build unavailable");
    const description = placeholder.querySelector("p");
    if (description) description.textContent = (error instanceof Error ? error.message : "The client is unavailable.") +
      " Check the repository's GitHub Actions deployment. No simulated game will be displayed.";
  }

  async function probeBuild() {
    try {
      const { manifest } = await getBuild();
      note("CLIENT FILES FOUND", "Compiled files available");
      // This is a file-deployment check, NOT proof of a loaded world or network connection.
      const detail = `Pinned source: ${manifest.upstreamCommit.slice(0, 7)}`;
      if (cardStatus) cardStatus.title = detail;
    } catch {
      note("BUILD PENDING", "Game files not deployed");
    }
  }

  async function openGame() {
    setVisibility(true);
    if (frame) {
      frame.hidden = false;
      status.textContent = "GAME VIEW OPEN";
      placeholder.hidden = true;
      return;
    }
    if (loading) return;
    loading = true;
    const ownRequest = ++requestNumber;
    status.textContent = "CHECKING GAME FILES";
    try {
      const { url } = await getBuild();
      if (!visible || ownRequest !== requestNumber) return;
      const iframe = document.createElement("iframe");
      iframe.id = "ugn-java-client";
      iframe.title = "UGN Java compatible browser game";
      iframe.src = url;
      iframe.allow = "fullscreen; gamepad; clipboard-read; clipboard-write";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "same-origin";
      iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:#050611;z-index:2";
      iframe.addEventListener("load", () => {
        if (frame === iframe) status.textContent = "CLIENT PAGE LOADED";
        // load does not attest that terrain rendering or multiplayer works.
      });
      iframe.addEventListener("error", () => {
        if (frame === iframe) frame = null;
        iframe.remove();
        showMissing(new Error("The browser could not load the game entrypoint."));
      });
      frame = iframe;
      placeholder.hidden = true;
      status.textContent = "OPENING JAVA GAME";
      mount.appendChild(iframe);
    } catch (error) {
      if (visible) showMissing(error);
    } finally {
      loading = false;
    }
  }

  function leaveGame() {
    requestNumber++;
    setVisibility(false);
    // Keep a loaded game in the tab, preserving in-game progress unless the upstream client exits.
    if (frame) frame.hidden = true;
  }

  enter.addEventListener("click", () => { void openGame(); });
  exit.addEventListener("click", leaveGame);
  placeholderExit.addEventListener("click", leaveGame);
  info.addEventListener("click", () => dialog.showModal());
  infoClose.addEventListener("click", () => dialog.close());
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (workspace.requestFullscreen) await workspace.requestFullscreen();
      else status.textContent = "FULLSCREEN IS NOT SUPPORTED";
    } catch {
      status.textContent = "FULLSCREEN NOT AVAILABLE";
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && visible && !dialog.open && !document.fullscreenElement && document.activeElement !== frame) {
      leaveGame();
    }
  });
  async function loadFeaturedServer() {
    const name = $("featured-name");
    const description = $("featured-description");
    const address = $("featured-host");
    const state = $("featured-state");
    if (!name || !description || !address || !state) return;
    try {
      const response = await fetch(new URL("./server-config.json", document.baseURI), {
        cache: "no-store", credentials: "omit"
      });
      if (!response.ok) throw new Error("Configuration is unavailable.");
      const cfg = await response.json();
      const entry = cfg && cfg.featuredServer;
      if (!entry || !entry.enabled || typeof entry.host !== "string" || !entry.host.trim()) {
        state.replaceChildren();
        const dot = document.createElement("i");
        state.append(dot, document.createTextNode("COMING SOON"));
        state.classList.remove("configured");
        address.textContent = "YOUR SERVER WILL APPEAR HERE";
        return;
      }
      const port = Number(entry.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return;
      name.textContent = String(entry.name || "UGN Java").slice(0, 70);
      description.textContent = String(entry.description || "Official UGN Java community world").slice(0, 190);
      address.textContent = String(entry.host).slice(0, 253) + ":" + port;
      state.replaceChildren();
      const dot = document.createElement("i");
      state.append(dot, document.createTextNode("ADDRESS CONFIGURED · NOT PINGED"));
      state.classList.add("configured");
    } catch {
      state.textContent = "FEATURED SERVER CONFIG PENDING";
      address.textContent = "SET UP SERVER-CONFIG.JSON";
    }
  }
  // No fake online statuses, fabricated servers, or fake 26.3 compatibility.
  void probeBuild();
  void loadFeaturedServer();
})();
