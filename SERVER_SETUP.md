# UGN Java MC Browser Edition — game server setup

GitHub Pages hosts the **website and compiled browser client**, not a persistent Minecraft multiplayer server. For UGN multiplayer, run a **separate Java server** on Rocky Linux/Pterodactyl and a compatible browser-to-TCP gateway.

## Create a compatible server

1. In Pterodactyl, create a separate **Paper 1.21.4** test server with its own world, plugins and TCP port (commonly 25565). The current browser client lists Java 1.21.4 among its best-tested versions and supports protocol versions through 1.21.5. It is **not a native Java 26.3 client**.
2. Keep your current production UGN/Velocity setup unchanged while testing.
3. If you use a no-Microsoft-login **offline-mode** server, understand that usernames are unverified. Use a robust server-side login/account-protection plugin, protect administrator accounts, restrict privileges before authentication, and prevent bypass through direct backend connections. Do **not** disable online-mode on your existing production network.
4. Verify ordinary desktop Java clients can join the test server first.

## Install a secure relay

The browser cannot open a direct Java TCP connection. The open-source client supports a proxy such as the separately hosted [mwc-proxy](https://github.com/zardoy/mwc-proxy). A sample restricted Docker Compose configuration is at relay/docker-compose.example.yml and a sample Nginx configuration is at relay/nginx.example.conf.

Configure a dedicated HTTPS address such as java-api.universalgaming.us. Bind the relay to localhost. Restrict it to your specific Java server address and port, set a per-IP connection limit, block private/internal/cloud-metadata egress traffic at the host firewall, and do not log secrets. Set origin to https://universal-gaming.github.io (without the /UGN-Bedrock/ path). Disable external signal/metrics/debug endpoints. A CORS allowlist alone does not secure the service.

The relay must actually be installed and working before browser multiplayer works. The sample configuration is a starting point, not a claim that your infrastructure has been deployed.

## Enable the featured UGN entry

Edit the repository's server-config.json file after your server and gateway are ready. Example content (replace the placeholder hostname with YOUR ACTUAL game server):

    {
      "featuredServer": {
        "enabled": true,
        "name": "[UGN] Universal Java",
        "description": "Official UGN Java community world",
        "host": "java.example.org",
        "port": 25565
      },
      "relay": {
        "url": "https://java-api.universalgaming.us"
      },
      "extraServers": []
    }

- With enabled=false, the homepage correctly shows the UGN featured world as COMING SOON. No invented online status.
- Enabled=true adds the UGN address to the client's promoted server menu when GitHub Actions rebuilds. It does NOT imply that the server is online.
- extraServers lets you explicitly add more entries, but all upstream third-party promoted servers have been removed.
- relay.url must be the HTTPS origin of your deployed compatible relay (or a supported WSS URL). Do not publish passwords or secrets in this JSON.

## Acceptance checks

1. GitHub Actions build/deploy succeeds for the new configuration.
2. Homepage loads the 3D UGN outpost with animated startup, responsive menus and a genuine Play button.
3. Java browser client loads from /client/ and can start a singleplayer world.
4. Multiplayer: the relay can join the UGN test server, stream world data, chat, place blocks and reconnect without crashes.
5. Test devices/browsers individually. Java 26.3 gameplay is NOT yet implemented in the upstream browser client.

**Licensing:** This is a community, Java-compatible web client, not official Minecraft, and not affiliated with Mojang or Microsoft. No cracking the official Java client is required to host this open-source browser project.
