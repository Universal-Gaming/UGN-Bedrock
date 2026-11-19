# UGN Private Minecraft Browser Relay

First-party transport for the UGN Java browser game and desktop/mobile shells.
This Node.js relay implements the HTTP-connect + WebSocket stream protocol that
the browser uses. It is not a Minecraft server and does not replace Paper/Velocity.

Public UGN endpoint to set up: https://proxy.universalgaming.us
Approved Minecraft destination: play.universalgaming.us:25578

**Status:** Code and test coverage are maintained here. This does NOT mean
your DNS, HTTPS certificate, Pterodactyl process, or Minecraft tunnel have
been deployed or tested on your hosting node.

## 1. Create a Pterodactyl server

Use a Node.js 22 egg on your Rocky Linux host. Start with 512 MB RAM,
1 CPU thread share and a dedicated TCP allocation. Upload the files in this
proxy/ folder; do not replace your Minecraft server files.

First installation command:
    npm install --omit=dev --no-audit --no-fund

Startup command:
    node server.cjs

Set the following environment variables using the Pterodactyl egg or server
startup settings (replace PORT with the allocation's actual port):

    LISTEN_HOST=0.0.0.0
    PORT=8088
    PUBLIC_SERVER_HOST=play.universalgaming.us
    PUBLIC_SERVER_PORT=25578
    TARGET_HOST=play.universalgaming.us
    TARGET_PORT=25578
    ALLOWED_ORIGINS=https://universal-gaming.github.io,https://universalgaming.us,https://www.universalgaming.us
    MAX_CONNECTIONS_PER_IP=4
    MAX_CONNECTIONS_TOTAL=96
    TRUST_PROXY=false

The public host is the address typed in the game. The target is where the
private proxy forwards traffic. If Paper runs on another private LAN address,
set TARGET_HOST to that internal address and keep PUBLIC_SERVER_HOST unchanged.
Do not use 127.0.0.1 for TARGET_HOST unless the Java server is actually in the
same container/network namespace.

## 2. Add DNS and HTTPS/WSS

Create DNS A record proxy.universalgaming.us pointing to your datacenter IP.
Nginx must reverse-proxy HTTPS/WSS to the real Pterodactyl allocation address.

Start with a functioning Nginx HTTP site and issue the HTTPS certificate:
    sudo certbot --nginx -d proxy.universalgaming.us

Example final Nginx configuration AFTER certificate issuance, assuming Nginx
really reaches the relay at 127.0.0.1:8088 (different Pterodactyl networks
may require a different address):

    server {
      listen 80;
      server_name proxy.universalgaming.us;
      return 301 https://$host$request_uri;
    }
    server {
      listen 443 ssl;
      server_name proxy.universalgaming.us;
      ssl_certificate /etc/letsencrypt/live/proxy.universalgaming.us/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/proxy.universalgaming.us/privkey.pem;
      client_max_body_size 2k;

      location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
      }
    }

Important: If Pterodactyl puts the Node app in a Docker container, host
127.0.0.1 is NOT container 127.0.0.1. Substitute the accessible
container/port allocation and test from the Nginx machine before proceeding.

Do not expose the Node HTTP listener directly on the public internet.
Block the internal allocation with a firewall if necessary. The only
public entry should be the Nginx HTTPS 443 virtual host.

## 3. Test the relay

On your own machine/runner:
    npm install --no-audit --no-fund
    npm run check

From the Nginx host:
    curl -fsS http://127.0.0.1:8088/healthz

From outside after DNS and certificate deployment:
    curl -fsS https://proxy.universalgaming.us/healthz

The health endpoint reports the relay process, NOT the Minecraft server
or the ability to join. For a full check, join the Java server from the
UGN Java game using the new private proxy selection.

## 4. Activate UGN as the preferred proxy

The browser game and first-party desktop app list the UGN-owned relay first
but should not force it while infrastructure is pending.

Only AFTER you confirm DNS, HTTPS, WebSocket routing, backend reachability,
and a successful actual game connection, edit UGN-Bedrock/server-config.json:

    "relay": {
      "url": "https://proxy.universalgaming.us"
    }

Redeploy the UGN website build. The client will then prefer your relay.
Community relays are optional, external alternatives; the private proxy does
not depend on them.

## Protocol and security

POST /api/vm/net/connect with JSON host/port -> single-use token + remote info.
WS /api/vm/net/socket?token=... -> binary Minecraft TCP stream.
WS /api/vm/net/ping -> relay latency response.
GET /api/vm/net/connect -> minimal capabilities.
GET /healthz -> process health and concurrent session count.

- Restricted to exactly play.universalgaming.us:25578 (configurable).
- Forwards to one trusted target only. Not an open TCP proxy.
- Exact browser Origin allowlist; per-IP and total connection limits.
- Tokens are 256-bit random and expire rapidly if unused.
- TCP connect, idle and pairing timeouts; WebSocket payload caps.
- No player database, analytics service, external relay or cloud dependency.
- Do not forward Microsoft credentials through untrusted third-party relays.
- Keep login/permissions and Minecraft authentication independently secure.
- This relay does not implement Microsoft authentication endpoints.

The proxy server is UGN-controlled, but the browser game still runs from GitHub
Pages unless you separately move the website to your own host.
