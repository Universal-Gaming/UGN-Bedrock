(() => {
"use strict";
const $=id=>document.getElementById(id), fmt=(n,d=0)=>Number.isFinite(n)?n.toFixed(d):"N/A";
const report={testedAt:null,device:{},render:{},network:{},recommendations:[]};
let running=false;
function detail(label,value){const wrap=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=String(value);wrap.append(dt,dd);$("details").append(wrap);}
function collect(){
 const nav=navigator,mem=nav.deviceMemory,cores=nav.hardwareConcurrency,conn=nav.connection||nav.mozConnection||nav.webkitConnection;
 const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const canvas=document.createElement("canvas"),gl=canvas.getContext("webgl2",{powerPreference:"low-power"})||canvas.getContext("webgl",{powerPreference:"low-power"});
 const info={webgl:gl?(typeof WebGL2RenderingContext!=="undefined"&&gl instanceof WebGL2RenderingContext?"WebGL 2":"WebGL 1"):"Unavailable",maxTexture:gl?gl.getParameter(gl.MAX_TEXTURE_SIZE):null,cores:cores||null,memoryGB:mem||null,devicePixelRatio:Math.round((devicePixelRatio||1)*100)/100,viewport:innerWidth+" x "+innerHeight,reducedMotion:reduced,online:nav.onLine,connectionType:conn?.effectiveType||"Not reported",saveData:conn?.saveData===true};
 if(gl){gl.getExtension("WEBGL_lose_context")?.loseContext();}
 report.device=info;$("details").replaceChildren();Object.entries(info).forEach(([k,v])=>detail(k,v??"Not reported"));
 $("webgl-value").textContent=info.webgl;$("webgl-note").textContent=info.maxTexture?"Max texture "+info.maxTexture+" px":"Software rendering or unsupported WebGL possible";
}
function paint(){
 const recommendations=[];
 if(report.device.webgl==="Unavailable")recommendations.push("WebGL is unavailable. Enable browser hardware acceleration, update graphics drivers, and try a modern browser.");
 if(report.device.memoryGB&&report.device.memoryGB<=4)recommendations.push("The browser reports limited device RAM. Close heavy tabs and applications before launching Minecraft.");
 if(report.device.saveData)recommendations.push("Data Saver is enabled. Disable it for large first-time game asset downloads when your network plan permits.");
 if(report.render.fps&&report.render.fps<40)recommendations.push("This tab's frame test was below 40 FPS. Reduce the game's render distance, particles, graphics and browser zoom; confirm hardware acceleration.");
 if(report.render.spikePercent>10)recommendations.push("Frequent long frames indicate stuttering. Close background tabs, disable overlays/extensions temporarily, and compare while plugged into power.");
 if(report.network.medianMs>250)recommendations.push("The UGN website responded slowly. Test another network; this does NOT prove Minecraft proxy/server latency.");
 if(report.network.error)recommendations.push("The website response probe failed. Check network connection, VPN/content blockers, then retry.");
 recommendations.push("To isolate multiplayer problems, test a singleplayer world on the same device. Smooth singleplayer with rubber-banding multiplayer points toward relay/server/network issues, not GPU FPS.");
 recommendations.push("For multiplayer, compare the auto-selected relay with a manually selected trusted relay. The shortest relay handshake is not necessarily the lowest sustained in-game latency.");
 report.recommendations=recommendations;$("tips").replaceChildren();recommendations.forEach(t=>{const li=document.createElement("li");li.textContent=t;$("tips").append(li)});
 $("report").textContent=JSON.stringify(report,null,2);
}
function frames(){
 return new Promise(resolve=>{
  const samples=[];let prev=0,start=0,raf=0,ended=false;
  const finish=()=>{if(ended)return;ended=true;cancelAnimationFrame(raf);
   const ordered=samples.slice().sort((a,b)=>a-b);
   const usable=ordered.filter(x=>x>0),median=ordered[Math.floor(ordered.length/2)]||0;
   const duration=usable.reduce((a,b)=>a+b,0);
   resolve({fps:duration?Math.round(usable.length*1000/duration):null,medianFrameMs:+fmt(median,1),spikePercent:usable.length?Math.round(usable.filter(x=>x>50).length/usable.length*100):0,samples:usable.length,backgrounded:document.hidden});
  };
  const tick=t=>{if(document.hidden){finish();return;}if(!start){start=t;prev=t;}else{const dt=t-prev;prev=t;if(dt<1000)samples.push(dt);}if(t-start>=6000){finish();return;}raf=requestAnimationFrame(tick);};
  raf=requestAnimationFrame(tick);
 });
}
async function net(){
 const times=[];for(let i=0;i<5;i++){
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),4000),start=performance.now();
  try{const url=new URL("./favicon.svg",location.href);url.searchParams.set("probe",String(i)+"-"+Math.random().toString(36).slice(2));
   const resp=await fetch(url.href,{method:"GET",cache:"no-store",signal:ctrl.signal,credentials:"omit"});
   if(!resp.ok)throw Error("HTTP "+resp.status);await resp.arrayBuffer();times.push(performance.now()-start);
  }catch(e){if(!times.length&&i===4)return {error:"Website probe unavailable"};}finally{clearTimeout(timeout);}
 }
 times.sort((a,b)=>a-b);return times.length?{medianMs:Math.round(times[Math.floor(times.length/2)]),minMs:Math.round(times[0]),maxMs:Math.round(times[times.length-1]),samples:times.length,scope:"GitHub Pages static asset — NOT Minecraft ping"}:{error:"All probes failed"};
}
async function run(which){
 if(running)return;running=true;$("run").disabled=$("fps").disabled=true;
 $("status").textContent="Running diagnostics. Keep this tab in the foreground.";$("progress").style.width="8%";
 try{
  collect();report.testedAt=new Date().toISOString();$("progress").style.width="18%";
  const render=await frames();report.render=render;
  $("fps-value").textContent=render.fps===null?"N/A":render.fps+" FPS";
  $("fps-note").textContent=render.backgrounded?"Invalid: tab was hidden":"6-second page render sampling · not game FPS";
  $("spikes-value").textContent=render.spikePercent+"%";
  $("spikes-note").textContent="Frames over 50 ms";$("progress").style.width="72%";
  if(which!=="fps"){report.network=await net();$("latency-value").textContent=report.network.medianMs==null?"N/A":report.network.medianMs+" ms";$("latency-note").textContent=report.network.error||"UGN website only · not server ping";}
  $("progress").style.width="100%";paint();
  $("status").textContent="Tests complete. Review the suggestions below. These values do not directly measure Minecraft tick rate, server TPS or real gameplay FPS.";
 }catch(e){$("status").textContent="Diagnostic failed: "+(e instanceof Error?e.message:"unknown error");}
 finally{running=false;$("run").disabled=$("fps").disabled=false;}
}
$("run").addEventListener("click",()=>void run("all"));$("fps").addEventListener("click",()=>void run("fps"));
$("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$("status").textContent="Safe diagnostic report copied. No usernames, tokens or world data were collected.";}catch{$("status").textContent="Clipboard unavailable. Select the report at the bottom to copy manually.";}});
$("less-motion").addEventListener("click",()=>{try{localStorage.setItem("ugn-lightweight-home","1");$("status").textContent="Lightweight UGN homepage enabled. Gameplay graphics are managed inside the game.";}catch{$("status").textContent="Preference storage blocked by browser.";}}); 
$("normal-motion").addEventListener("click",()=>{try{localStorage.removeItem("ugn-lightweight-home");$("status").textContent="Homepage effects restored.";}catch{$("status").textContent="Preference storage blocked by browser.";}}); 
$("reload").addEventListener("click",()=>location.reload());
collect();paint();
})();