import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ugn-perf-'));
try {
  const game=path.join(dir,'upstream'),dist=path.join(game,'dist');fs.mkdirSync(dist,{recursive:true});
  const html=path.join(dist,'index.html');
  fs.writeFileSync(html,'<!doctype html><html><body><main>Existing client</main></body></html>');
  const script=new URL('./install-game-performance.mjs', import.meta.url).pathname;
  const run=()=>spawnSync(process.execPath,[script,game],{encoding:'utf8'});
  let result=run();assert.equal(result.status,0,result.stderr);
  const modified=fs.readFileSync(html,'utf8');
  assert.match(modified,/<script src="\.\/ugn-performance\.js" defer><\/script>/);
  assert.match(modified,/Existing client/);
  assert.ok(fs.statSync(path.join(dist,'ugn-performance.js')).size>1000);
  result=run();assert.notEqual(result.status,0,'duplicate install must be rejected');
  fs.writeFileSync(html,'<html><main>broken page</main></html>');
  result=run();assert.notEqual(result.status,0,'missing body must fail safely');
  console.log('UGN game diagnostics injector: PASS');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }