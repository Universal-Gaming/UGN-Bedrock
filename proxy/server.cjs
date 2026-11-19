'use strict';

/*
 * UGN Java private Minecraft TCP bridge.
 * Implements the two-step HTTP + WebSocket protocol used by
 * prismarinejs-net-browserify and the UGN Java browser client.
 *
 * NOT a general-purpose proxy: the client can request only the approved
 * public host/port, which is forwarded to one configured Minecraft backend.
 */
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { WebSocketServer, WebSocket } = require('ws');

function integer(value, fallback, min, max, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error((name || 'Value') + ' must be between ' + min + ' and ' + max);
  }
  return num;
}
function readConfig(env = process.env) {
  const origins = String(env.ALLOWED_ORIGINS || 'https://universal-gaming.github.io')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length || origins.some(s => {
    try {
      const u = new URL(s);
      return u.protocol !== 'https:' || u.origin !== s || !u.hostname || s.includes('*');
    } catch { return true; }
  })) throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins, never wildcards');
  const publicHost = String(env.PUBLIC_SERVER_HOST || 'play.universalgaming.us').toLowerCase();
  const targetHost = String(env.TARGET_HOST || publicHost).toLowerCase();
  for (const host of [publicHost, targetHost]) {
    if (!/^[a-z0-9.-]{1,253}$/.test(host) && !net.isIP(host)) {
      throw new Error('Server target is not a valid domain or IPv4/IPv6 address');
    }
  }
  return {
    host: String(env.LISTEN_HOST || '0.0.0.0'),
    port: integer(env.PORT, 8088, 1, 65535, 'PORT'),
    publicHost,
    publicPort: integer(env.PUBLIC_SERVER_PORT, 25578, 1, 65535, 'PUBLIC_SERVER_PORT'),
    targetHost,
    targetPort: integer(env.TARGET_PORT, 25578, 1, 65535, 'TARGET_PORT'),
    origins: Object.freeze(origins),
    maxConnectionsPerIp: integer(env.MAX_CONNECTIONS_PER_IP, 4, 1, 30, 'MAX_CONNECTIONS_PER_IP'),
    maxConnectionsTotal: integer(env.MAX_CONNECTIONS_TOTAL, 96, 1, 1000, 'MAX_CONNECTIONS_TOTAL'),
    tcpTimeoutMs: integer(env.TCP_CONNECT_TIMEOUT_MS, 8000, 1000, 30000, 'TCP_CONNECT_TIMEOUT_MS'),
    pairTimeoutMs: integer(env.PAIR_TIMEOUT_MS, 12000, 2000, 60000, 'PAIR_TIMEOUT_MS'),
    idleTimeoutMs: integer(env.IDLE_TIMEOUT_MS, 600000, 30000, 3600000, 'IDLE_TIMEOUT_MS'),
    trustProxy: env.TRUST_PROXY === 'true'
  };
}
function createRelay(settings = readConfig()) {
  const paths = {
    connect: '/api/vm/net/connect',
    socket: '/api/vm/net/socket',
    ping: '/api/vm/net/ping'
  };
  const validOrigins = new Set(settings.origins);
  const sessions = new Map();
  const connecting = new Set();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const log = (message) => console.log('[UGN proxy] ' + message);

  function clientIP(req) {
    let ip = req.socket.remoteAddress || '';
    const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (settings.trustProxy && loopback) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        const candidate = forwarded.split(',')[0].trim();
        if (net.isIP(candidate)) ip = candidate;
      }
    }
    return ip;
  }
  function allowed(req) { return validOrigins.has(req.headers.origin); }
  function cors(req, res) {
    res.setHeader('Vary', 'Origin');
    if (allowed(req)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Cache-Control', 'no-store');
  }
  function reply(res, code, object) {
    if (res.writableEnded || res.destroyed) return;
    const body = JSON.stringify(object);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }
  function countFor(ip) {
    let count = 0;
    for (const item of connecting) if (item.ip === ip) count++;
    for (const item of sessions.values()) if (item.ip === ip) count++;
    return count;
  }
  function terminate(item) {
    if (item.dead) return;
    item.dead = true;
    clearTimeout(item.pairTimer);
    sessions.delete(item.token);
    try { item.socket.destroy(); } catch {}
    if (item.ws && item.ws.readyState !== WebSocket.CLOSED) {
      try { item.ws.close(); } catch {}
    }
  }
  async function handleConnect(req, res) {
    if (req.method !== 'POST') return reply(res, 405, { error: 'POST required' });
    if (!allowed(req)) return reply(res, 403, { error: 'Origin not permitted' });
    const ip = clientIP(req);
    if (connecting.size + sessions.size >= settings.maxConnectionsTotal ||
        countFor(ip) >= settings.maxConnectionsPerIp) {
      return reply(res, 429, { error: 'UGN connection limit reached' });
    }
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (contentType !== 'application/json') return reply(res, 415, { error: 'Expected application/json' });
    const length = Number(req.headers['content-length']);
    if (Number.isFinite(length) && length > 1024) return reply(res, 413, { error: 'Request too large' });
    let data = '';
    try {
      for await (const chunk of req) {
        data += chunk.toString('utf8');
        if (data.length > 1024) return reply(res, 413, { error: 'Request too large' });
      }
    } catch { return; }
    let requested;
    try { requested = JSON.parse(data); } catch { return reply(res, 400, { error: 'Invalid JSON' }); }
    if (typeof requested !== 'object' || !requested ||
        String(requested.host).toLowerCase() !== settings.publicHost ||
        Number(requested.port) !== settings.publicPort) {
      return reply(res, 403, { error: 'Only the configured UGN Minecraft server is allowed' });
    }
    const reservation = { ip };
    connecting.add(reservation);
    const tcp = net.createConnection({ host: settings.targetHost, port: settings.targetPort });
    tcp.setNoDelay(true);
    tcp.setTimeout(settings.tcpTimeoutMs);
    let settled = false;
    function fail(status, why) {
      if (settled) return;
      settled = true;
      connecting.delete(reservation);
      tcp.destroy();
      reply(res, status, { error: why });
    }
    tcp.once('timeout', () => fail(504, 'Minecraft server timed out'));
    tcp.once('error', () => fail(502, 'Minecraft server unreachable'));
    res.once('close', () => { if (!res.writableEnded) fail(499, 'Client disconnected'); });
    tcp.once('connect', () => {
      if (settled) { tcp.destroy(); return; }
      settled = true;
      connecting.delete(reservation);
      tcp.setTimeout(settings.idleTimeoutMs);
      tcp.pause();
      const token = crypto.randomBytes(32).toString('hex');
      const item = { token, ip, socket: tcp, ws: null, dead: false, pairTimer: null };
      sessions.set(token, item);
      item.pairTimer = setTimeout(() => terminate(item), settings.pairTimeoutMs);
      item.pairTimer.unref?.();
      tcp.on('timeout', () => terminate(item));
      tcp.on('error', () => terminate(item));
      tcp.on('close', () => terminate(item));
      reply(res, 200, {
        token,
        remote: {
          address: tcp.remoteAddress || settings.targetHost,
          port: tcp.remotePort || settings.targetPort,
          family: tcp.remoteFamily || 'IPv4'
        }
      });
    });
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://local');
    cors(req, res);
    if (req.method === 'GET' && u.pathname === '/healthz') {
      return reply(res, 200, {
        status: 'running', service: 'UGN Java private relay', activeSessions: sessions.size,
        destination: settings.publicHost + ':' + settings.publicPort
      });
    }
    if (u.pathname === paths.connect) {
      if (!allowed(req)) return reply(res, 403, { error: 'Origin not permitted' });
      if (req.method === 'OPTIONS') return res.writeHead(204).end();
      if (req.method === 'GET') return reply(res, 200, {
        version: 'ugn-1.0.0', capabilities: {}, destination: settings.publicHost + ':' + settings.publicPort
      });
      void handleConnect(req, res);
      return;
    }
    return reply(res, 404, { error: 'Not found' });
  });
  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url || '/', 'http://local');
    if (!allowed(req) || (u.pathname !== paths.socket && u.pathname !== paths.ping)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    let item;
    if (u.pathname === paths.socket) {
      const token = u.searchParams.get('token');
      item = sessions.get(token);
      if (!item || item.dead || item.ws || item.ip !== clientIP(req)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      // Reserve before upgrading so the token can't be reused concurrently.
      item.ws = { readyState: WebSocket.CONNECTING, close() {} };
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (u.pathname === paths.ping) {
        ws.on('message', (data, binary) => {
          if (!binary && String(data).startsWith('ping:')) ws.send('pong:' + String(data).slice(5));
        });
        return;
      }
      item.ws = ws;
      clearTimeout(item.pairTimer);
      const tcp = item.socket;
      ws.on('message', (data, binary) => {
        if (!binary) {
          const message = String(data);
          if (message.startsWith('ping:')) { ws.send('pong:' + message.slice(5)); return; }
          ws.close(1003, 'Binary TCP data required');
          return;
        }
        if (!tcp.destroyed && !tcp.write(data)) {
          ws._socket?.pause();
          tcp.once('drain', () => ws._socket?.resume());
        }
      });
      tcp.on('data', (bytes) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > 4 * 1024 * 1024) { ws.close(1013, 'Slow connection'); return; }
        ws.send(bytes, { binary: true }, err => { if (err) terminate(item); });
      });
      ws.once('close', () => terminate(item));
      ws.once('error', () => terminate(item));
      tcp.resume();
    });
  });
  function stop() {
    for (const item of [...sessions.values()]) terminate(item);
    wss.close();
    return new Promise(resolve => server.close(resolve));
  }
  return { server, stop, settings, sessions, log };
}
if (require.main === module) {
  const relay = createRelay();
  relay.server.listen(relay.settings.port, relay.settings.host, () => {
    relay.log('Listening on ' + relay.settings.host + ':' + relay.settings.port);
    relay.log('Only ' + relay.settings.publicHost + ':' + relay.settings.publicPort + ' is permitted');
    relay.log('TLS/WSS must terminate at Nginx. Do not expose this HTTP backend publicly.');
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void relay.stop().then(() => process.exit(0)));
}
module.exports = { readConfig, createRelay };
