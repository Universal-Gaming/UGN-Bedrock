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
