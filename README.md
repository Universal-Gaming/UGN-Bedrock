# UGN Java — Play in Your Browser

An independently designed, game-first website inspired by the **ease of use** of Eaglercraft, with original UGN space artwork and a real Java-compatible browser client that opens **in the same tab as a full-page UGN game**. No server-directory dashboard, IP checker or downloadable launcher.

## What is committed

- An original WebGL2 animated cosmic background with pointer orbit, responsive fallback and reduced-motion support.
- Simple Play Now homepage, deployment indicator, version support notice and game fullscreen view.
- A direct same-tab game route for the **real, open-source** Minecraft Web Client from the PrismarineJS ecosystem and zardoy.
- A pinned upstream source revision and automatic GitHub Actions build.
- A required `client/ugn-build.json` manifest, so Play Now never presents decorative 3D animation as Minecraft.
- Responsive controls for phone, tablet, Chromebook and desktop page layouts (in-game touch/controller support is owned by the upstream client).
- No UGN website account database or Microsoft sign-in requirement. The upstream client has its own settings; see privacy caveats.

## Version compatibility

On **November 18, 2026**, the newest stable official Minecraft Java release is **26.3**. The currently chosen browser client advertises support for Java **1.8 through 1.21.5**, with 1.19.4 and 1.21.4 among its better-tested versions.

The website **does not** pretend to support 26.3. Making this independent browser engine natively compatible with Minecraft 26.3 would require upstream protocol, assets, world data, entity and gameplay work. Running an older client through ViaVersion may allow connections to some newer servers but **does not deliver the missing newer-version features**. There is no safe shortcut that changes a version label into a functioning 26.3 client.

## Build and deploy

The repository is still named `Universal-Gaming/UGN-Bedrock`. User-facing branding is **UGN Java**.

1. Under repository **Settings → Pages**, choose **GitHub Actions** as the source; branch publishing won't copy the generated Java game client into `/client/`.
2. The file `.github/workflows/deploy-java.yml` checks out pinned upstream revision `d7ab705efee3af674421c65e62b660ae470cad6b` and builds it using Node 22/pnpm 9.
3. When the build succeeds, GitHub Actions deploys the entire UGN website with compiled client assets under `/client/`, along with `/client/ugn-build.json`.
4. The page's Play Now button checks the build manifest and compiled `client/index.html`, then navigates to the game at **/client/index.html in the same browser tab**. This removes the iframe boundary that can interfere with browser pointer-lock mouse controls.
5. A green JavaScript syntax validation run isn't evidence the game compiled or that gameplay is functioning. Verify the **Build and deploy UGN Java browser game** workflow and manually start a world after publish.

Expected GitHub Pages address, once configured and deployment succeeds:

```
https://universal-gaming.github.io/UGN-Bedrock/
```

The upstream pinned source's `patchedDependencies` did not match its lockfile on its original revision. Our workflow uses `pnpm install --no-frozen-lockfile` to address that specific build blocker, while retaining a pinned upstream checkout. Dependency integrity and maintenance need continued auditing.

## Singleplayer and multiplayer

Supported offline singleplayer does not require Microsoft sign-in on the UGN website. This does **not** make the browser client the official Minecraft Java game.

For multiplayer, Java uses raw TCP but browsers only expose WebSockets. Use a separate **restricted WebSocket-to-TCP proxy** such as the upstream-documented [mwc-proxy](https://github.com/zardoy/mwc-proxy) on the UGN Rocky Linux/Pterodactyl infrastructure. Set TLS (`wss://`), restrict allowed destination servers, block all internal network and metadata address ranges, implement rate limits and firewall policy, and monitor for abuse. **A working public relay has not been deployed here.**

For a no-Microsoft-login UGN server, a separate, explicitly configured **offline-mode** server can accept unauthenticated Java names, but that's vulnerable to username impersonation. Don't disable authentication on your existing production UGN network. Isolate the offline-mode server, use a robust account registration/login plugin and secure proxy forwarding, and do not expose unprotected backend ports. Offline-mode does not verify ownership of Minecraft or grant distribution rights.

## Privacy and licensing

- The outer UGN page collects no passwords or Microsoft tokens.
- The upstream game client may store singleplayer worlds, UI settings, and optional account session data in the browser. **Session-only credential handling has not been verified inside upstream.** Do not promise that feature until audited.
- MIT licensing applies to the **web-client source code**. It does not grant rights to distribute Mojang/Microsoft software, proprietary assets or trademarks. Review actual generated bundle contents and Minecraft's usage rules before public release.
- The site is an independent community project, not affiliated with Mojang Studios or Microsoft.

See `THIRD_PARTY_NOTICES.md` for upstream attribution.

## Project files

```
index.html              UGN game-first homepage and temporary launch workspace
styles.css              Legacy base styles, not loaded by the current homepage
landing.css             Eaglercraft-inspired simple play page, original UGN design
scene.js                Procedural, original WebGL2 portal
app.js                  Build verification and full-page same-tab game navigation
client-config.js        Public client and manifest paths
favicon.svg             Original UGN icon
THIRD_PARTY_NOTICES.md  Source attribution and license
.github/workflows/deploy-java.yml
.github/workflows/validate.yml
```
