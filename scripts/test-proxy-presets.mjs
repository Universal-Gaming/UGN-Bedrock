import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const upstream = path.resolve(process.argv[2] || '../upstream');
const config=JSON.parse(fs.readFileSync(path.join(upstream,'config.json'),'utf8'));
const requireFromHere=createRequire(import.meta.url);
const {COMMUNITY_PROXIES, gameWithProxy}=requireFromHere('../apps/desktop/proxies.cjs');
const expected=COMMUNITY_PROXIES.map(({url})=>url);
assert.deepEqual(config.defaultProxies,expected,'Game must have same four proxies as desktop menu');
assert.equal(config.defaultProxy,'','No external proxy is forced before selection');
assert.equal(config.allowAutoConnect,false,'Game must not auto-join a server');
assert.equal(config.defaultHost,'','No automatic raw Minecraft TCP server join before UGN relay');
assert.ok(config.promoteServers.some(x=>x.ip==='play.universalgaming.us:25578'),'Keep featured UGN server');
for(const url of expected){
  assert.match(url,/^https:\/\//);
  const gameUrl=new URL(gameWithProxy(url));
  assert.equal(gameUrl.searchParams.get('proxy'),url);
  assert.equal(gameUrl.pathname,'/UGN-Bedrock/client/index.html');
}
const patched=fs.readFileSync(path.join(upstream,'src/react/ServersList.tsx'),'utf8');
assert.ok(patched.includes('if (saved?.proxies?.length) return saved'),'Legacy empty saved lists restored');
console.log('[UGN proxies] PASS: 4 identical presets, migration, explicit selection, UGN server.');
