(() => {
  "use strict";
  // Game launch stays on the UGN website, but uses its OWN top-level document
  // rather than an iframe. Browser pointer lock is tied to the active document.
  // Do not collect Minecraft passwords or Microsoft tokens in this wrapper.
  const $ = (id) => document.getElementById(id);
  const scene = $("experience");
  const workspace = $("game-space");
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
  const buildMetadata = String(config.buildMetadataPath || "./client/ugn-build.json");
  const clientPath = String(config.clientPath || "./client/index.html");
  let loading = false;
  let visible = false;
  let buildPromise = null;
  let navigationId = 0;

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
  }

  async function getBuild() {
    if (buildPromise) return buildPromise;
    buildPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const manifestUrl = new URL(buildMetadata, document.baseURI);
        const gameUrl = new URL(clientPath, document.baseURI);
        if (manifestUrl.origin !== location.origin || gameUrl.origin !== location.origin) {
          throw new Error("The Java browser client must be hosted on the UGN website.");
        }
        const response = await fetch(manifestUrl.href, {
          cache: "no-store", redirect: "error",
          credentials: "same-origin", signal: controller.signal
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("The compiled Java browser game has not been deployed.");
        }
        const manifest = await response.json();
        if (!manifest || manifest.client !== "minecraft-web-client" ||
          !/^[a-f0-9]{40}$/.test(manifest.upstreamCommit)) {
          throw new Error("The deployed game build is incomplete or unrecognized.");
        }
        const gameResponse = await fetch(gameUrl.href, {
          cache: "no-store", redirect: "error",
          credentials: "same-origin", signal: controller.signal
        });
        if (!gameResponse.ok || !gameResponse.headers.get("content-type")?.includes("text/html")) {
          throw new Error("The game entrypoint is missing.");
        }
        return { url: gameUrl.href, manifest };
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
    if (description) description.textContent =
      (error instanceof Error ? error.message : "The game could not be opened.") +
      " Check GitHub Actions for a successful Java-client deployment.";
  }

  async function probeBuild() {
    try {
      const { manifest } = await getBuild();
      note("CLIENT FILES FOUND", "Compiled client available");
      if (cardStatus) cardStatus.title = `Pinned Java client: ${manifest.upstreamCommit.slice(0, 7)}`;
    } catch {
      note("BUILD PENDING", "Game files not deployed");
    }
  }

  async function openGame() {
    if (loading) return;
    loading = true;
    const request = ++navigationId;
    setVisibility(true);
    placeholder.hidden = false;
    status.textContent = "VERIFYING JAVA GAME BUILD";
    try {
      const { url } = await getBuild();
      if (!visible || request !== navigationId) return;
      status.textContent = "OPENING GAME IN THIS TAB";
      // Deliberately do NOT embed another document. Firefox/Chromium mouse
      // capture is more reliable when the game is the top-level document.
      // Same origin and the same /client/ route preserve browser world storage.
      window.location.assign(url);
    } catch (error) {
      if (visible) showMissing(error);
    } finally {
      loading = false;
    }
  }

  function leaveGame() {
    navigationId += 1;
    setVisibility(false);
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
      else status.textContent = "FULLSCREEN UNAVAILABLE";
    } catch {
      status.textContent = "FULLSCREEN UNAVAILABLE";
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && visible && !dialog.open && !document.fullscreenElement) {
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
  void probeBuild();
  void loadFeaturedServer();
})();
