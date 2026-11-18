# UGN Bedrock

**Foundation build — not yet a playable Minecraft client.**

UGN Bedrock is designed as a direct-in-browser Bedrock experience, **not a launcher**. This repository now contains a space-themed responsive GitHub Pages site, searchable server directory, per-tab session-only favorites, custom IP/port form, and a separate optional Bedrock UDP status-check service.

**Not yet implemented:** genuine Bedrock gameplay, WebGL world engine, Xbox/Microsoft multiplayer login, entitlement checks, real multiplayer joins, or Realms. No cracked APK, game binary, proprietary game assets, or fake gameplay are included.

## GitHub Pages setup

Publish `main` branch root via repository **Settings → Pages → Deploy from a branch → main → /(root)**. After a successful deploy the expected URL is:

https://universal-gaming.github.io/UGN-Bedrock/

The site's frontend needs no build system. Edit `config.js` to add legitimate public directory entries. There is no tracking or UGN account database.

## Optional Bedrock server status gateway

Run on Node.js 22+ behind an HTTPS Nginx reverse proxy. Example:

```bash
cd gateway
ALLOWED_ORIGINS=https://universal-gaming.github.io HOST=127.0.0.1 PORT=3001 npm start
```

Edit `config.js` to set `gatewayUrl` to your gateway's **HTTPS** origin (no trailing slash) after deployment.

- `GET /health`: health/status.
- `GET /api/ping?host=example.org&port=19132`: real RakNet unconnected Bedrock UDP status ping (not a join).

The server rejects known private/local/special IPv4 targets, rejects IPv6 until a full safe policy exists, pins validated DNS to a resolved public IP, enforces a bounded ping timeout/concurrency/rate limit, and uses an explicit origin allowlist. **Also configure firewall egress deny rules**, reverse-proxy request limits, and monitoring for production. Application-level rate limiting alone is not sufficient for a public service. It is a status checker only; it never handles Microsoft tokens or game streams.

## Server directory

Starter entry: `play.universalgaming.us:19132` (featured, **not verified online**). Optional `directoryUrl` in `config.js` accepts HTTPS JSON:

```json
{"servers":[{"name":"Example Community","description":"Survival world","host":"example.org","port":19132,"mode":"Survival"}]}
```

Directory discovery and custom-address entries don't establish successful connections. Favorites and manually added addresses are stored in the current tab's `sessionStorage` only. The site does not store player credentials.

## Microsoft and privacy specification

Microsoft sign-in is **not implemented yet**. The button explains that state instead of presenting fake authentication. The eventual flow requires legitimate Microsoft/Xbox Minecraft permissions/entitlements and OAuth PKCE, with browser `sessionStorage` token cache and no UGN credential database. Microsoft may independently retain its own cookies. Never store secrets, auth tokens or passwords in GitHub, config, logs or gateway status requests.

## Development milestones

1. Confirm permitted Minecraft/Xbox auth and game asset usage, then integrate a secure session-only browser auth design.
2. Implement genuine browser-native Bedrock engine: chunk packets, geometry, rendering, player physics, UI, interactions and permitted assets.
3. Add a new secure Bedrock gameplay relay (separate from status pings), authorize sessions, bound resources, isolate users.
4. Play actual compatible public servers with custom IP and port.
5. Implement keyboard/mouse, mobile touch, tablet/Chromebook, controller options and graphics scalability.
6. Advertise only **verified** Bedrock protocol/version compatibility.
7. Integrate Realms and friends' worlds **later**.

Independent UGN project; not affiliated with Mojang Studios or Microsoft. Do not redistribute their proprietary binaries or game content without authorization.
