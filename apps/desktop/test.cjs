'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {HOME,isUGNPage,canOpenExternal}=require('./url-policy.cjs');
test('first-party scope includes the hosted game',()=>{
  assert.ok(isUGNPage(HOME));
  assert.ok(isUGNPage(HOME+'client/index.html'));
  assert.ok(isUGNPage(HOME+'mouse-test.html'));
});
test('reject host spoofing, insecure and out-of-scope URLs',()=>{
  for(const url of ['https://universal-gaming.github.io.evil.test/UGN-Bedrock/',
    'https://universal-gaming.github.io/UGN-Bedrock-evil/',
    'http://universal-gaming.github.io/UGN-Bedrock/',
    'file:///tmp/index.html','javascript:alert(1)']) assert.equal(isUGNPage(url),false,url);
});
test('third-party links open outside; non-web schemes blocked',()=>{
  assert.ok(canOpenExternal('https://discord.universalgaming.us/'));
  assert.ok(canOpenExternal('https://github.com/Universal-Gaming/UGN-Bedrock'));
  assert.equal(canOpenExternal('file:///etc/passwd'),false);
  assert.equal(canOpenExternal(HOME+'client/index.html'),false);
});

const { COMMUNITY_PROXIES, gameWithProxy, proxyIsCommunity } = require('./proxies.cjs');
test('UGN desktop ships four explicit proxy choices',()=>{
  assert.equal(COMMUNITY_PROXIES.length,4);
  assert.equal(new Set(COMMUNITY_PROXIES.map(p=>p.url)).size,4);
  for(const relay of COMMUNITY_PROXIES) {
    assert.match(relay.url,/^https:\/\//);
    assert.ok(proxyIsCommunity(relay.url));
    const url=new URL(gameWithProxy(relay.url));
    assert.ok(isUGNPage(url.href));
    assert.equal(url.searchParams.get('proxy'),relay.url);
    assert.equal(url.pathname,'/UGN-Bedrock/client/index.html');
  }
});
test('reject arbitrary proxy injection into desktop game URL',()=>{
  for(const invalid of ['https://evil.example','http://proxy.mcraft.fun','javascript:alert(1)','']) {
    assert.throws(()=>gameWithProxy(invalid),TypeError);
  }
});

const { UGN_PROXY, ALL_PROXIES } = require('./proxies.cjs');
test('UGN-owned proxy can be manually selected without being imposed as a default',()=>{
  assert.equal(UGN_PROXY.url,'https://proxy.universalgaming.us');
  assert.equal(ALL_PROXIES.length,5);
  assert.equal(proxyIsCommunity(UGN_PROXY.url),false);
  const app=new URL(gameWithProxy(UGN_PROXY.url));
  assert.ok(isUGNPage(app.href));
  assert.equal(app.searchParams.get('proxy'),UGN_PROXY.url);
});
