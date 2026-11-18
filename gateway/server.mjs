import http from "node:http";
import dgram from "node:dgram";
import dns from "node:dns/promises";
import net from "node:net";
import { randomBytes } from "node:crypto";

/**
 * Minimal, bounded Bedrock unconnected status ping gateway.
 * This is NOT a Bedrock login, authentication, WebSocket or gameplay proxy.
 * This service NEVER receives Microsoft tokens.
 */
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_IN_FLIGHT = 24;
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 20;
const requests = new Map();
let inFlight = 0;
const MAGIC = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");

function validHost(raw) {
  if (typeof raw !== "string" || raw.length > 253) return null;
  const host = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!host || /[\s\/?#@:%\\]/.test(host)) return null;
  if (net.isIP(host) === 4) return host;
  if (/^[0-9.]+$/.test(host)) return null;
  const parts = host.split(".");
  if (parts.length < 2 || parts.at(-1).length < 2 || parts.some((p) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p))) return null;
  return host;
}
function validPort(raw) {
  if (raw === null || !/^\d{1,5}$/.test(raw)) return null;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}
function publicIPv4(addr) {
  const a = addr.split(".").map(Number);
  if (a.length !== 4 || a.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [x, y, z] = a;
  // Explicit deny for local, special-purpose, reserved and non-global ranges.
  if (x === 0 || x === 10 || x === 127 || x >= 224 || x === 255) return false;
  if (x === 100 && y >= 64 && y <= 127) return false;
  if (x === 169 && y === 254) return false;
  if (x === 172 && y >= 16 && y <= 31) return false;
  if (x === 192 && (y === 168 || y === 0 && (z === 0 || z === 2) || y === 88 && z === 99)) return false;
  if (x === 198 && (y === 18 || y === 19 || y === 51 && z === 100)) return false;
  if (x === 203 && y === 0 && z === 113) return false;
  if (x === 192 && y === 0) return false;
  if (x === 198 && y === 19) return false;
  if (x === 192 && y === 0 && z === 0) return false;
  if (x === 192 && y === 0 && z === 0) return false;
  return true;
}
async function resolvePublic(host) {
  const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true, verbatim: true });
  // Fail closed on all IPv6 (until a complete global-unicast IPv6 policy is implemented).
  if (!addresses.length || addresses.some((a) => a.family !== 4 || !publicIPv4(a.address))) throw new Error("Target resolves to non-public or unsupported address");
  return addresses[0].address;
}
function allowedOrigin(origin) { return !!origin && ORIGINS.includes(origin); }
function send(res, status, payload, origin = "") {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin" };
  if (allowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}
function limit(key) {
  const now = Date.now();
  const data = requests.get(key);
  if (!data || now - data.since >= RATE_WINDOW_MS) {
    requests.set(key, { since: now, count: 1 });
    return true;
  }
  data.count++;
  return data.count <= RATE_MAX;
}
function ping(address, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Bedrock ping timed out")), 2500);
    socket.once("error", (err) => finish(err));
    socket.once("message", (buffer, info) => {
      if (info.address !== address || info.port !== port || buffer.length < 35 || buffer[0] !== 0x1c || !buffer.subarray(17, 33).equals(MAGIC)) return finish(new Error("Invalid Bedrock pong"));
      const length = buffer.readUInt16BE(33);
      if (!length || length > 2048 || buffer.length < 35 + length) return finish(new Error("Invalid Bedrock status payload"));
      const fields = buffer.subarray(35, 35 + length).toString("utf8").split(";");
      if (!fields[0]?.startsWith("MCPE")) return finish(new Error("Unsupported Bedrock status payload"));
      const count = Number(fields[4]);
      const max = Number(fields[5]);
      finish(null, {
        online: true,
        name: String(fields[1] || "Bedrock Server").replace(/§[0-9a-fk-or]/gi, "").slice(0, 100),
        version: String(fields[3] || "").slice(0, 32),
        players: Number.isInteger(count) && count >= 0 ? count : null,
        maxPlayers: Number.isInteger(max) && max >= 0 ? max : null
      });
    });
    const request = Buffer.alloc(33);
    request[0] = 0x01; // RakNet unconnected ping
    request.writeBigUInt64BE(BigInt(Date.now()), 1);
    MAGIC.copy(request, 9);
    randomBytes(8).copy(request, 25);
    socket.send(request, port, address, (err) => { if (err) finish(err); });
  });
}
const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return send(res, 403, { error: "Origin not allowed" }, origin);
    res.writeHead(204, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", "Vary": "Origin" });
    return res.end();
  }
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }, origin);
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/health") return send(res, 200, { status: "ok", service: "ugn-bedrock-status-gateway", gameplay: false }, origin);
  if (pathname !== "/api/ping") return send(res, 404, { error: "Not found" }, origin);
  // Reject browser origins not explicitly allowed. No-Origin calls may be probes; rate-limit them too.
  if (origin && !allowedOrigin(origin)) return send(res, 403, { error: "Origin not allowed" }, origin);
  const remote = req.socket.remoteAddress || "unknown";
  if (!limit(remote)) return send(res, 429, { error: "Rate limit exceeded" }, origin);
  if (inFlight >= MAX_IN_FLIGHT) return send(res, 503, { error: "Server busy" }, origin);
  const url = new URL(req.url, "http://localhost");
  const host = validHost(url.searchParams.get("host"));
  const port = validPort(url.searchParams.get("port") || "19132");
  if (!host || !port) return send(res, 400, { error: "Invalid hostname or port" }, origin);
  inFlight++;
  try {
    const ip = await resolvePublic(host);
    // Using the resolved, validated IP avoids a second DNS resolution and DNS rebinding at send time.
    const result = await ping(ip, port);
    return send(res, 200, result, origin);
  } catch {
    return send(res, 200, { online: false, name: host, players: null }, origin);
  } finally {
    inFlight--;
  }
});
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error("Invalid PORT");
server.listen(PORT, HOST, () => console.log("UGN Bedrock status gateway listening on " + HOST + ":" + PORT));
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [key, value] of requests) if (value.since < cutoff) requests.delete(key);
}, RATE_WINDOW_MS).unref();
