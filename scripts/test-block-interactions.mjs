import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

/**
 * Execute the actual patched Minecraft web-client mouse plugin event handlers
 * against DOM event doubles. Source/build tests do not substitute for a
 * real Minecraft world test but catch the regression where mouse-look works
 * and both world action buttons are silently ignored.
 */
const root=path.resolve(process.argv[2] || "../upstream");
const source=fs.readFileSync(path.join(root,"src/mineflayer/plugins/mouse.ts"),"utf8");
const start=source.indexOf("const domListeners = (bot: Bot) => {");
assert(start>=0,"Can't find mouse plugin handlers");
const requireUpstream=createRequire(path.join(root,"package.json"));
const ts=requireUpstream("typescript");
const body=source.slice(start)+"\nexports.domListeners = domListeners;\n";
const js=ts.transpileModule(body,{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}
}).outputText;

function harness({lock=false,fallback=false,active=true}={}){
  const events=new Map(), calls=[];
  const doc={
    pointerLockElement:lock?{}:null,
    hasFocus:()=>true,
    addEventListener(name,listener){events.set(name,listener)}
  };
  const window={UGNMouseDiagnostics:{fallbackActive:fallback}};
  const bot={
    mouse:{buttons:[]},
    on(){},
    leftClickStart(){calls.push("attack-start")},
    leftClickEnd(){calls.push("attack-end")},
    rightClickStart(){calls.push("place-start")},
    rightClickEnd(){calls.push("place-end")}
  };
  const context={
    exports:{},document:doc,window,
    AbortController,
    isGameActive:()=>active,
    isCypress:()=>false,
    getThreeJsRendererMethods:()=>null,
    videoCursorInteraction:()=>null,
    sendVideoInteraction:()=>{},
    console
  };
  vm.runInNewContext(js,context,{timeout:3000});
  assert.equal(typeof context.exports.domListeners,"function");
  context.exports.domListeners(bot);
  function target(blocked=false){
    return {closest(){return blocked?{}:null}};
  }
  function mouse(button=0,blocked=false,isTrusted=true){
    events.get("mousedown")({button,isTrusted,target:target(blocked)});
  }
  function release(button=0){
    events.get("mouseup")({button});
  }
  function contextmenu(blocked=false){
    let prevented=false;
    events.get("contextmenu")({
      target:target(blocked),preventDefault(){prevented=true}
    });
    return prevented;
  }
  return {calls,mouse,release,contextmenu,doc,window};
}
{
  const h=harness();
  h.mouse(0);h.mouse(2);
  assert.deepEqual(h.calls,[],"Unlocked unarmed mouse should not mine/place");
  assert.equal(h.contextmenu(),false,"Right click should remain ordinary without active game mouse");
}
{
  const h=harness({fallback:true});
  h.mouse(0);h.release(0);h.mouse(2);h.release(2);
  assert.deepEqual(h.calls,["attack-start","attack-end","place-start","place-end"],"Unlocked UGN Free Look should allow both Minecraft mouse buttons");
  assert.equal(h.contextmenu(),true,"Right-clicking the world in Free Look should suppress the browser menu");
}
{
  const h=harness({lock:true});
  h.mouse(0);h.release(0);h.mouse(2);h.release(2);
  assert.deepEqual(h.calls,["attack-start","attack-end","place-start","place-end"],"Native pointer lock must preserve block interactions");
  assert.equal(h.contextmenu(),true);
}
{
  const h=harness({fallback:true});
  h.mouse(0,true);h.mouse(2,true);
  assert.deepEqual(h.calls,[],"Clicking menus and HUD must not mine/place");
  assert.equal(h.contextmenu(true),false,"Context menu on UI must remain available");
}
{
  const h=harness({fallback:true,active:false});
  h.mouse(0);h.mouse(2);
  assert.deepEqual(h.calls,[],"Inactive world/inventory must not mine/place");
  assert.equal(h.contextmenu(),false);
}
{
  const h=harness();
  h.mouse(0,false,false);h.release(0);
  assert.deepEqual(h.calls,["attack-start","attack-end"],"Synthetic controller/touch mouse actions remain functional");
}
console.log("[UGN interactions] 6 event-level regression cases passed: unlocked safety, fallback mining/placing, native lock, UI, inactive menus, synthetic controls.");
