# UGN Java — Browser Edition

A cinematic, mobile-responsive UGN 3D website with **real Minecraft Java-compatible browser gameplay loaded in the page**. This replaces the abandoned Bedrock browser-engine plan.

**This repository remains named `UGN-Bedrock` for now** because no repository rename was requested. The site branding is **UGN Java**. The repository can be renamed from GitHub Settings if desired (renaming updates the Pages URL).

## What UGN built

- One full-screen UGN universe experience: original real-time raymarched WebGL2 portal.
- Drag to rotate the 3D viewing angle; scroll to zoom; CSS fallback for unsupported devices.
- A single **ENTER GAME SPACE** button and full-screen in-page gameplay surface.
- No UGN server lists, IP checker, login imitation or website launcher.
- On enter, the page checks for a real compiled client at `./client/index.html` and loads it within the same page.
- The wrapper itself does not collect passwords or tokens or use persistent browser storage.

## The actual playable Java client

We use the real, open-source **Minecraft Web Client** project by the PrismarineJS ecosystem and zardoy (MIT-licensed code), **not** a copy of the Eaglercraft Java source or official Minecraft distribution.

Upstream: https://github.com/zardoy/minecraft-web-client

Pinned revision: `d7ab705efee3af674421c65e62b660ae470cad6b`.

The GitHub Actions build compiles the upstream application and copies its actual assets into `/client/` in the Pages deployment. The client itself provides singleplayer, inventories, textures and rendering on compatible browsers. Java multiplayer requires a **separately hosted** secure WebSocket-to-TCP relay and a compatible Java server. See upstream documentation for supported versions (documented through 1.21.5), limitations and licensing.

This means:
- **This isn't the official Minecraft Java binary, nor Eaglercraft.**
- The upstream client may have its own local save and login preferences. Its privacy/storage behavior needs a separate audit; the outer UGN page does not manage that.
- A Microsoft account is not required for offline singleplayer. Authenticated online servers have additional requirements and may not be usable until a permitted login flow and relay are configured.
- UGN's Minecraft 26.x servers are **not** assumed compatible with an upstream client that advertises support only through 1.21.5.
- The 3D portal is **decorative website UI**, not a fake Minecraft world.

## Deploy to GitHub Pages

1. Open repository **Settings → Pages**.
2. Change **Build and deployment** → Source to **GitHub Actions**.
3. Workflow `.github/workflows/deploy-java.yml` runs on pushes to `main` (or manually from Actions). It checks out the pinned open-source client, compiles it with Node/pnpm and publishes the main website plus the real game in `/client/`.
4. Check the Actions tab for a green **Build and deploy UGN Java browser game** run.
5. After successful GitHub Pages deployment, the expected site URL at the existing repo name is `https://universal-gaming.github.io/UGN-Bedrock/`.

**Important:** If the game compilation or Pages deployment fails, the website will explicitly say the game is unavailable. It will never silently pretend to be playable. A successful GitHub commit does not prove a successful CI build or deployed game.

**Production checks:** Review the upstream/client dependencies, the source license versus Minecraft assets and trademark rules, auth/token storage, network relay abuse protection and browser compatibility before public release. See `THIRD_PARTY_NOTICES.md`.

## Next integration: multiplayer

For Java multiplayer, run a hardened and access-controlled WebSocket-to-TCP relay on a Rocky Linux/Pterodactyl node with TLS and public port restrictions. `mwc-proxy` is described upstream as one option: https://github.com/zardoy/mwc-proxy .

Do not use an open proxy capable of accessing localhost, metadata IPs or internal networks. Configure server allowlists, limits and monitoring. We have **not** deployed or connected any multiplayer proxy in this build.

Eaglercraft-specific Velocity support is a different protocol; do not assume it will work with this client. UGN's current Java 26.x network requires separate version testing or an appropriate version-compatible backend.

## Repository structure

```
index.html          UGN outer website
styles.css          UGN styles
scene.js            procedural 3D portal WebGL2
app.js              in-page game iframe lifecycle
client-config.js    public path to the self-hosted client
favicon.svg         UGN favicon
THIRD_PARTY_NOTICES.md
.github/workflows/deploy-java.yml
.github/workflows/validate.yml
```

This project is independent and not affiliated with Mojang or Microsoft. All rights to their names and content remain with their respective owners.
