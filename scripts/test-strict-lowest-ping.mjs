import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const upstream=path.resolve(process.argv[2]||'../upstream');
const requireUpstream=createRequire(path.join(upstream,'package.json'));
const ts=requireUpstream('typescript');
const source=fs.readFileSync(path.join(upstream,'src/core/proxyAutoSelect.ts'),'utf8');
assert.ok(source.includes('lowestLatency'), 'Strict measured ping patch missing');
assert.ok(!source.includes('Promise.any(pingPromises)'), 'Do not select first completed request');
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS
}}).outputText;

function setup(results){
  const state={exports:{},AbortController,console,Date,Number,Promise,setTimeout,clearTimeout,
    location:{protocol:'https:',hostname:'example.test'}};
  state.require=(name)=>{
    if(name==='valtio')return {proxy:(obj)=>obj};
    if(name==='./pingProxy')return {pingProxyServer:async (url,signal)=>{
      const item=results[url]||{success:false,error:'Not found',delay:0};
      await new Promise(resolve=>setTimeout(resolve,item.delay||0));
      if(signal.aborted)return {success:false,error:'Aborted'};
      return {success:item.success,latency:item.latency,error:item.error};
    }};
    throw new Error('Unexpected import '+name);
  };
  vm.runInNewContext(compiled,state,{timeout:3000});
  return state.exports;
}
const high='https://community-fast-response.test';
const low='https://community-low-ping.test';
const offline='https://proxy.universalgaming.us';
{
  const client=setup({
    [high]:{success:true,latency:84,delay:1},
    [low]:{success:true,latency:13,delay:35},
    [offline]:{success:false,error:'Offline',delay:2}
  });
  const best=await client.selectBestProxy([high,offline,low]);
  assert.equal(best,low,'Choose lowest measured ping, NOT first response');
  assert.equal(client.proxyPingState.selectedProxy,low);
  assert.equal(client.proxyPingState.proxyStatus[offline].status,'error');
  assert.equal(client.proxyPingState.proxyStatus[high].latency,84);
  assert.equal(client.proxyPingState.proxyStatus[low].latency,13);
  assert.equal(client.proxyPingState.checkStarted,false);
}
{
  const client=setup({
    [offline]:{success:false,error:'Offline'},
    [high]:{success:false,error:'Timeout'}
  });
  assert.equal(await client.selectBestProxy([offline,high]),null);
  assert.equal(client.proxyPingState.selectedProxy,null);
}
{
  const client=setup({
    [high]:{success:true,latency:NaN},
    [low]:{success:true,latency:23},
    [offline]:{success:true,latency:Infinity}
  });
  assert.equal(await client.selectBestProxy([high,low,offline]),low);
  assert.equal(client.proxyPingState.proxyStatus[high].status,'error');
  assert.equal(client.proxyPingState.proxyStatus[offline].status,'error');
}
const ping=fs.readFileSync(path.join(upstream,'src/core/pingProxy.ts'),'utf8');
assert.ok(ping.includes('Number.isFinite(parsedProcessing)'));
console.log('[UGN proxies] PASS: actual lowest latency, offline relay skipped, all-offline safe, invalid readings ignored.');
