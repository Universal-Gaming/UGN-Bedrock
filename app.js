(() => {
  "use strict";
  const config = window.UGN_CONFIG || {};
  const prefix = "ugn-bedrock-v1:";
  const $ = (id) => document.getElementById(id);
  const fetchJSON = async (url, ms = 6500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };
  const readSession = (key, fallback) => {
    try {
      const value = sessionStorage.getItem(prefix + key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };
  const writeSession = (key, value) => {
    try { sessionStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* privacy mode may disable storage */ }
  };
  let favorites = readSession("favorites", []);
  let saved = readSession("connections", []);
  let filter = "all";
  let query = "";
  const normalizeHost = (value) => {
    const hostname = String(value || "").trim().toLowerCase().replace(/\.$/, "");
    if (hostname.length > 253 || hostname.length < 1 || /[\s\/?#@:%\\]/.test(hostname)) return null;
    // IPv4 dotted decimal (reject malformed lookalikes)
    if (/^[0-9.]+$/.test(hostname)) {
      const octets = hostname.split(".");
      if (octets.length !== 4 || octets.some((n) => !/^\d{1,3}$/.test(n) || Number(n) > 255)) return null;
      return octets.map(Number).join(".");
    }
    const labels = hostname.split(".");
    if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    // Browser side validation is UX only. Gateway must independently validate DNS/IP destinations.
    if (labels.at(-1).length < 2) return null;
    return hostname;
  };
  const validPort = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 65535 ? number : null;
  };
  const makeId = (host, port) => host + ":" + port;
  const gateway = String(config.gatewayUrl || "").replace(/\/$/, "");
  const baseServers = Array.isArray(config.servers) ? config.servers : [];
  let communityServers = [];
  const allServers = () => {
    const joined = [...baseServers, ...communityServers, ...saved];
    const map = new Map();
    for (const s of joined) {
      if (!s || !normalizeHost(s.host) || !validPort(s.port)) continue;
      const id = makeId(normalizeHost(s.host), validPort(s.port));
      if (!map.has(id)) map.set(id, { id, name: String(s.name || s.host).slice(0, 70), description: String(s.description || "Community Bedrock server").slice(0, 220), host: normalizeHost(s.host), port: validPort(s.port), mode: String(s.mode || "Bedrock").slice(0, 60), featured: Boolean(s.featured), custom: Boolean(s.custom) });
    }
    return [...map.values()];
  };
  const make = (tag, klass, value) => {
    const node = document.createElement(tag);
    if (klass) node.className = klass;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const notify = (title, message) => {
    $("modal-title").textContent = title;
    $("modal-body").textContent = message;
    $("modal").showModal();
  };
  const render = () => {
    const servers = allServers();
    $("all-count").textContent = String(servers.length);
    let visible = servers.filter((s) => {
      if (filter === "featured" && !s.featured) return false;
      if (filter === "favorites" && !favorites.includes(s.id)) return false;
      if (filter === "custom" && !s.custom) return false;
      return [s.name, s.description, s.host, s.mode].join(" ").toLowerCase().includes(query);
    });
    $("listing-count").textContent = visible.length + " SERVERS";
    const list = $("server-list");
    list.replaceChildren();
    if (!visible.length) {
      list.appendChild(make("div", "empty-state", "No servers matched. Try another search or add a custom address."));
      return;
    }
    for (const s of visible) {
      const card = make("article", "server-card");
      const logo = make("div", "server-logo" + (s.featured ? "" : " community"), s.featured ? "✦" : "◇");
      const details = make("div", "server-details");
      const name = make("h3", null, s.name);
      if (s.featured) name.appendChild(make("span", "pill", "UGN FEATURED"));
      const desc = make("p", null, s.description);
      const meta = make("div", "server-meta");
      const host = make("code", null, s.host + ":" + s.port);
      meta.append(host, make("span", null, "◈ " + s.mode), make("span", null, "● STATUS NOT VERIFIED"));
      details.append(name, desc, meta);
      const actions = make("div", "server-actions");
      const fav = make("button", "fav-btn", favorites.includes(s.id) ? "♥" : "♡");
      fav.type = "button";
      fav.setAttribute("aria-label", "Toggle favorite for " + s.name);
      fav.setAttribute("aria-pressed", String(favorites.includes(s.id)));
      fav.addEventListener("click", () => {
        favorites = favorites.includes(s.id) ? favorites.filter((id) => id !== s.id) : [...favorites, s.id];
        writeSession("favorites", favorites);
        render();
      });
      const check = make("button", "btn btn-secondary", "Check status ↗");
      check.type = "button";
      check.addEventListener("click", () => {
        $("server-host").value = s.host;
        $("server-port").value = String(s.port);
        location.hash = "#connect";
        void checkServer(s.host, s.port);
      });
      actions.append(fav, check);
      card.append(logo, details, actions);
      list.appendChild(card);
    }
  };
  const feedback = (message, kind = "") => {
    $("connection-status").textContent = message;
    $("connection-status").className = "form-feedback " + kind;
  };
  const checkServer = async (hostValue, portValue) => {
    const host = normalizeHost(hostValue);
    const port = validPort(portValue);
    if (!host || !port) return feedback("Please enter a valid public hostname or IPv4 address and a port from 1 to 65535.", "error");
    if (!gateway) return feedback("UGN gateway is not configured. A real ping cannot run yet; this is not a live availability result.", "error");
    feedback("Checking the server through the UGN gateway...");
    try {
      const url = new URL(gateway + "/api/ping");
      url.searchParams.set("host", host);
      url.searchParams.set("port", String(port));
      const response = await fetchJSON(url.toString());
      if (response.online === true) {
        const count = typeof response.players === "number" ? " • " + response.players + " players" : "";
        feedback("Online: " + String(response.name || host).slice(0, 80) + count + (response.version ? " • " + String(response.version).slice(0, 40) : "") + ". Browser gameplay is not yet implemented.", "success");
      } else {
        feedback("Gateway could not confirm server availability. The server may be offline, blocked, or incompatible.", "error");
      }
    } catch {
      feedback("Status check failed. Confirm the gateway is online and accessible over HTTPS.", "error");
    }
  };
  $("connect-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void checkServer($("server-host").value, $("server-port").value);
  });
  $("save-server").addEventListener("click", () => {
    const host = normalizeHost($("server-host").value);
    const port = validPort($("server-port").value);
    if (!host || !port) return feedback("Invalid hostname or port.", "error");
    if (!saved.some((server) => server.host === host && server.port === port)) saved.push({ name: host, description: "Custom server saved in this browser tab", host, port, mode: "Custom", custom: true });
    writeSession("connections", saved);
    render();
    feedback("Added to this tab's session directory. This does not connect to a game.", "success");
  });
  $("search-servers").addEventListener("input", (event) => {
    query = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === button));
    render();
  }));
  document.querySelectorAll("[data-nav]").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll("[data-nav]").forEach((other) => other.classList.toggle("active", other === link));
  }));
  $("sign-in").addEventListener("click", () => notify(
    "Microsoft authentication is not enabled yet",
    "UGN will use the official Microsoft sign-in flow with session-only token storage after application registration, Xbox entitlement/authorization, and secure multiplayer integration are implemented. This site does not ask for or accept Microsoft credentials."
  ));
  $("game-info").addEventListener("click", () => notify(
    "Real Bedrock gameplay is not available yet",
    "Remaining milestones: genuine Bedrock-compatible 3D rendering, world chunk decoding, input and collision, entities, inventory, sound, Xbox/Minecraft authentication, secure multiplayer relay, and verified protocol support. There is no simulated or cracked client in this repository."
  ));
  const modal = $("modal");
  $("modal-close").addEventListener("click", () => modal.close());
  $("modal-ok").addEventListener("click", () => modal.close());
  $("settings-open").addEventListener("click", () => $("settings-dialog").showModal());
  $("settings-close").addEventListener("click", () => $("settings-dialog").close());
  $("reduce-motion").checked = Boolean(readSession("reduce-motion", false));
  $("compact-cards").checked = Boolean(readSession("compact-cards", false));
  document.documentElement.classList.toggle("reduced-motion", $("reduce-motion").checked);
  document.documentElement.classList.toggle("compact-cards", $("compact-cards").checked);
  for (const [id, key, classname] of [["reduce-motion", "reduce-motion", "reduced-motion"], ["compact-cards", "compact-cards", "compact-cards"]]) {
    $(id).addEventListener("change", (event) => {
      writeSession(key, event.target.checked);
      document.documentElement.classList.toggle(classname, event.target.checked);
    });
  }
  $("clear-session").addEventListener("click", () => {
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    } catch { /* ignore */ }
    favorites = [];
    saved = [];
    $("reduce-motion").checked = false;
    $("compact-cards").checked = false;
    document.documentElement.classList.remove("reduced-motion", "compact-cards");
    render();
    $("settings-dialog").close();
    notify("This tab's UGN data cleared", "Server favorites, custom addresses and UI settings for this tab were removed. Microsoft identity cookies, if any, are managed separately by Microsoft.");
  });
  const loadDirectory = async () => {
    if (!config.directoryUrl) return;
    try {
      const url = new URL(config.directoryUrl, location.href);
      if (url.protocol !== "https:" && url.origin !== location.origin) return;
      const result = await fetchJSON(url.toString());
      const candidates = Array.isArray(result) ? result : result.servers;
      if (!Array.isArray(candidates)) return;
      communityServers = candidates.slice(0, 200).map((s) => ({ ...s, featured: false, custom: false }));
      $("directory-source").textContent = "COMMUNITY DIRECTORY";
      render();
    } catch { $("directory-source").textContent = "STARTER DIRECTORY · EXTERNAL FEED UNAVAILABLE"; }
  };
  render();
  void loadDirectory();
})();