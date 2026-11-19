'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { WebSocket } = require('ws');
const { readConfig, createRelay } = require('../server.cjs');

const browserOrigin = 'https://universal-gaming.github.io';
const minecraftAddress = {host:'play.universalgaming.us',port:25578};

function tcpServer() {
  return net.createServer(socket => {
    socket.on('data', bytes => socket.write(bytes));
    socket.on('error', () => {});
  });
}
function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
function close(server) { return new Promise(resolve => server.close(resolve)); }
function timeout(promise, name) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(name+' timed out')), 3500))]);
}
function connectWebsocket(url, origin) {
  return timeout(new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Origin: origin } });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  }), 'websocket open');
}
function message(ws) {
  return timeout(new Promise(resolve => ws.once('message',(bytes,binary)=>resolve({bytes,binary}))), 'websocket message');
}

test('in-house relay handles Minecraft browser protocol and blocks unsafe routing', async t => {
  const echo = tcpServer();
  const echoPort = await listen(echo);
  const settings = readConfig({
    ALLOWED_ORIGINS: browserOrigin+',https://universalgaming.us',
    PUBLIC_SERVER_HOST:minecraftAddress.host,
    PUBLIC_SERVER_PORT:String(minecraftAddress.port),
    TARGET_HOST:'127.0.0.1',
    TARGET_PORT:String(echoPort),
    MAX_CONNECTIONS_PER_IP:'1',
    MAX_CONNECTIONS_TOTAL:'5',
    TCP_CONNECT_TIMEOUT_MS:'2000',
    PAIR_TIMEOUT_MS:'3000'
  });
  const relay = createRelay(settings);
  const relayPort = await listen(relay.server);
  const root='http://127.0.0.1:'+relayPort;
  const websocket='ws://127.0.0.1:'+relayPort;
  let gameSocket;
  t.after(async () => {
    try { gameSocket?.close(); } catch {}
    await relay.stop();
    await close(echo);
  });
  function request(url, body, origin=browserOrigin) {
    return fetch(root+url,{
      method:'POST',
      headers:{Origin:origin,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }
  await t.test('heartbeat and feature reporting', async () => {
    const health = await fetch(root+'/healthz');
    assert.equal(health.status,200);
    assert.equal((await health.json()).status,'running');
    const caps=await fetch(root+'/api/vm/net/connect',{headers:{Origin:browserOrigin}});
    assert.equal(caps.status,200);
    const body=await caps.json();
    assert.ok(body.capabilities);
    assert.equal(body.destination,'play.universalgaming.us:25578');
  });
  await t.test('cross-origin and open TCP proxy requests rejected', async () => {
    const denied=await request('/api/vm/net/connect',minecraftAddress,'https://evil.example');
    assert.equal(denied.status,403);
    assert.equal(denied.headers.get('access-control-allow-origin'),null);
    const arbitrary=await request('/api/vm/net/connect',{host:'127.0.0.1',port:echoPort});
    assert.equal(arbitrary.status,403);
    const wrongPort=await request('/api/vm/net/connect',{host:minecraftAddress.host,port:25565});
    assert.equal(wrongPort.status,403);
    const invalidJSON=await fetch(root+'/api/vm/net/connect',{
      method:'POST',headers:{Origin:browserOrigin,'Content-Type':'application/json'},body:'{invalid'
    });
    assert.equal(invalidJSON.status,400);
    const unsupported=await fetch(root+'/api/vm/net/auth',{headers:{Origin:browserOrigin}});
    assert.equal(unsupported.status,404);
  });
  await t.test('CORS preflight only for UGN', async () => {
    const preflight=await fetch(root+'/api/vm/net/connect',{method:'OPTIONS',headers:{Origin:browserOrigin,'Access-Control-Request-Method':'POST'}});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),browserOrigin);
  });
  await t.test('Minecraft TCP bytes travel in both directions through one-use websocket token', async () => {
    const res=await request('/api/vm/net/connect',minecraftAddress);
    assert.equal(res.status,200);
    const info=await res.json();
    assert.match(info.token,/^[0-9a-f]{64}$/);
    assert.equal(info.remote.port,echoPort);
    gameSocket=await connectWebsocket(websocket+'/api/vm/net/socket?token='+info.token,browserOrigin);
    const reply=message(gameSocket);
    gameSocket.send(Buffer.from('UGN Java binary test'));
    const received=await reply;
    assert.equal(received.binary,true);
    assert.equal(received.bytes.toString(),'UGN Java binary test');
    const waiting=message(gameSocket);
    gameSocket.send('ping:test-123');
    assert.equal((await waiting).bytes.toString(),'pong:test-123:0');
    const limit=await request('/api/vm/net/connect',minecraftAddress);
    assert.equal(limit.status,429,'Per-IP concurrent connection cap must be enforced');
  });
  await t.test('dedicated latency ping and rejected invalid websocket origin', async () => {
    const ping=await connectWebsocket(websocket+'/api/vm/net/ping',browserOrigin);
    const result=message(ping);
    ping.send('ping:123');
    assert.equal((await result).bytes.toString(),'pong:123:0');
    ping.close();
    const denied=await timeout(new Promise(resolve=>{
      const ws=new WebSocket(websocket+'/api/vm/net/ping',{headers:{Origin:'https://attacker.example'}});
      ws.once('unexpected-response',(_,res)=>{res.resume();resolve(res.statusCode)});
      ws.once('error',()=>resolve(403));
    }), 'denied WebSocket');
    assert.equal(denied,403);
  });
});

test('invalid host and origin settings are rejected before startup', () => {
  assert.throws(()=>readConfig({ALLOWED_ORIGINS:'*'}),/exact HTTPS origins/);
  assert.throws(()=>readConfig({ALLOWED_ORIGINS:'http://universal-gaming.github.io'}),/exact HTTPS origins/);
  assert.throws(()=>readConfig({PUBLIC_SERVER_PORT:'999999'}),/PUBLIC_SERVER_PORT/);
  assert.throws(()=>readConfig({TARGET_PORT:'0'}),/TARGET_PORT/);
  assert.throws(()=>readConfig({MAX_CONNECTIONS_PER_IP:'0'}),/MAX_CONNECTIONS_PER_IP/);
});
