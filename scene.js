(() => {
"use strict";
/* Original instanced WebGL2 UGN voxel station. Presentation only, not Minecraft gameplay. */
const canvas=document.getElementById("space-scene"), root=document.getElementById("experience");
if(!canvas||!root)return;
// Preserve user-selected lower-impact homepage mode; does not alter the game engine.
try { if(localStorage.getItem("ugn-lightweight-home")==="1"){canvas.hidden=true;window.UGNScene={available:false,setActive(){}};return;} } catch {}
const coarse=matchMedia("(pointer:coarse)").matches, reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
const gl=canvas.getContext("webgl2",{alpha:true,antialias:true,depth:true,powerPreference:"low-power"});
if(!gl){canvas.hidden=true;window.UGNScene={available:false,setActive(){}};return;}
const vert=[
"#version 300 es",
"precision highp float;",
"layout(location=0) in vec3 aPosition;",
"layout(location=1) in vec3 aNormal;",
"layout(location=2) in vec3 iPosition;",
"layout(location=3) in vec3 iScale;",
"layout(location=4) in vec3 iColor;",
"layout(location=5) in float iGlow;",
"layout(location=6) in float iType;",
"layout(location=7) in float iPhase;",
"uniform mat4 uVP;",
"uniform float uTime;",
"out vec3 vColor;out vec3 vNormal;out float vGlow;out float vDepth;",
"void main(){",
"vec3 center=iPosition;",
"if(iType>.5&&iType<1.5){float a=uTime*.23+iPhase;vec3 q=iPosition-vec3(3.7,0.,-1.5);center=vec3(3.7,0.,-1.5)+vec3(q.x*cos(a)-q.z*sin(a),q.y+sin(uTime+iPhase)*.22,q.x*sin(a)+q.z*cos(a));}",
"else if(iType>1.5){center.y+=sin(uTime*.8+iPhase)*.17;}",
"vec4 clip=uVP*vec4(aPosition*iScale+center,1.);",
"gl_Position=clip;vNormal=aNormal;vColor=iColor;vGlow=iGlow;vDepth=max(0.,clip.w);",
"}"
].join("\n");
const frag=[
"#version 300 es",
"precision highp float;",
"in vec3 vColor;in vec3 vNormal;in float vGlow;in float vDepth;out vec4 outColor;",
"void main(){float diff=max(dot(normalize(vNormal),normalize(vec3(-.55,.86,.7))),0.);",
"vec3 c=vColor*(.34+.73*diff)+vColor*vGlow*.88;",
"c=mix(c,vec3(.07,.08,.19),clamp((vDepth-16.)/38.,0.,.57));",
"c=1.-exp(-max(c,0.)*.94);outColor=vec4(pow(c,vec3(.9)),1.);}"
].join("\n");
function compile(type,text){
  const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn("UGN scene shader",gl.getShaderInfoLog(s));gl.deleteShader(s);return null;}return s;
}
const vs=compile(gl.VERTEX_SHADER,vert),fs=compile(gl.FRAGMENT_SHADER,frag);
if(!vs||!fs){canvas.hidden=true;window.UGNScene={available:false,setActive(){}};return;}
const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)){canvas.hidden=true;console.warn(gl.getProgramInfoLog(program));window.UGNScene={available:false,setActive(){}};return;}
let seed=18704;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const data=[],cx=3.7,cz=-1.5;
function cube(x,y,z,sx,sy,sz,color,glow=0,type=0,phase=0){data.push(x,y,z,sx,sy,sz,...color,glow,type,phase);}
const stone=[[.12,.14,.28],[.16,.17,.34],[.19,.19,.39],[.22,.18,.37]];
const turf=[[.12,.43,.38],[.15,.49,.43],[.09,.37,.41]],metal=[.12,.18,.31],light=[.24,.29,.51],purple=[.55,.36,1.20],cyan=[.13,.84,1.32],green=[.31,1.16,.60];
const rx=coarse?7:9,rz=coarse?5:7;
for(let x=-rx;x<=rx;x++)for(let z=-rz;z<=rz;z++){
  const d=x*x/rx/rx+z*z/rz/rz;
  if(d>.92+(rand()-.5)*.16)continue;
  const bx=cx+x*.78,bz=cz+z*.78,top=-1.58;
  cube(bx,top,bz,.79,.79,.79,turf[Math.floor(rand()*turf.length)]);
  const depth=Math.max(1,Math.round((1.-d)*3.6+rand()*2));
  for(let y=1;y<=depth;y++)cube(bx,top-y*.79,bz,.79,.79,.79,stone[Math.floor(rand()*stone.length)]);
  if(rand()<.06&&d>.42)cube(bx,top+.58,bz,.12,.45,.12,green,.2,2,rand()*6.28);
}
for(let x=-5;x<=5;x++)for(let z=-3;z<=3;z++){
  const edge=Math.abs(x)===5||Math.abs(z)===3;
  cube(cx+x*.66,-.90,cz+z*.66,.66,.2,.66,(x+z)%2===0?metal:light);
  if(edge)cube(cx+x*.66,-.76,cz+z*.66,.66,.09,.66,cyan,.58);
}
for(const [tx,tz] of [[-3.15,-1.8],[-3.15,1.8],[3.15,-1.8],[3.15,1.8]]){
  for(let i=0;i<5;i++)cube(cx+tx,-.44+i*.60,cz+tz,.55,.60,.55,i%2?metal:light);
  cube(cx+tx,2.66,cz+tz,.78,.15,.78,purple,.55);
  cube(cx+tx,2.9,cz+tz,.27,.27,.27,cyan,1.,2,rand()*6.28);
}
for(let x=-3;x<=3;x++)for(let z=-2;z<=2;z++){
  const edge=Math.abs(x)===3||Math.abs(z)===2;
  cube(cx+x*.71,2.30,cz+z*.71,.71,.27,.71,edge?purple:light,edge?.34:0);
  if(edge&&(x+z)%2===0)cube(cx+x*.71,1.03,cz+z*.71,.22,2.04,.22,metal);
}
for(let y=0;y<4;y++){
  cube(cx,-.22+y*.54,cz,.85,.53,.85,y%2?metal:light);
  cube(cx+1.0,-.22+y*.54,cz,.14,.41,.59,cyan,.76);
  cube(cx-1.0,-.22+y*.54,cz,.14,.41,.59,purple,.76);
}
const glyphs={U:["10001","10001","10001","10001","10001","10001","01110"],
 G:["01111","10000","10000","10111","10001","10001","01111"],
 N:["10001","11001","10101","10011","10001","10001","10001"]};
["U","G","N"].forEach((l,i)=>glyphs[l].forEach((r,yy)=>r.split("").forEach((bit,xx)=>{
  if(bit==="1")cube(cx-1.75+(i*6+xx)*.25,3.87+(6-yy)*.25,cz+2.14,.21,.21,.16,i===0?purple:i===1?cyan:green,1.15);
})));
cube(cx,3.3,cz-.8,.12,1.52,.12,light);
cube(cx,4.16,cz-.8,.35,.29,.35,green,1.,2,1);
for(let i=0;i<(coarse?58:110);i++){
  const a=rand()*Math.PI*2,r=7+rand()*7,size=.10+rand()*.35;
  cube(cx+Math.cos(a)*r,-2+rand()*8,cz+Math.sin(a)*r,size,size,size,rand()<.5?purple:cyan,.36+rand()*.5,1,rand()*6.28);
}
for(let i=0;i<16;i++){const a=i/16*Math.PI*2;cube(cx+Math.cos(a)*4.25,-.2,cz+Math.sin(a)*3.3,.14,.14,.14,cyan,.6,2,a);}

const vertData=[],faceData=[
[[1,0,0],[[.5,-.5,-.5],[.5,-.5,.5],[.5,.5,.5],[.5,-.5,-.5],[.5,.5,.5],[.5,.5,-.5]]],
[[-1,0,0],[[-.5,-.5,.5],[-.5,-.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[-.5,.5,-.5],[-.5,.5,.5]]],
[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]],
[[0,0,1],[[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[.5,-.5,.5],[-.5,.5,.5],[-.5,-.5,.5]]],
[[0,0,-1],[[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[-.5,-.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]]
];
for(const [norm,positions] of faceData)for(const pos of positions)vertData.push(...pos,...norm);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const geometry=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,geometry);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertData),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
const instance=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,instance);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
for(const [loc,count,off] of [[2,3,0],[3,3,12],[4,3,24],[5,1,36],[6,1,40],[7,1,44]]){
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,count,gl.FLOAT,false,48,off);gl.vertexAttribDivisor(loc,1);
}
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(program);
const uVP=gl.getUniformLocation(program,"uVP"),uTime=gl.getUniformLocation(program,"uTime");
function perspective(a,aspect,near,far){
  const f=1/Math.tan(a/2),d=far-near;
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,-(far+near)/d,-1,0,0,-2*far*near/d,0]);
}
function view(eye,target){
  const unit=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const z=unit(eye.map((e,i)=>e-target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x);
  const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
function multiply(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
let active=true,frame=0,w=0,h=0,last=-Infinity,yaw=.32,pitch=0,zoom=16.5,drag=false,px=0,py=0;
const start=performance.now(),fps=reduced?1:coarse?24:38,scale=(coarse?.66:.82)*Math.min(devicePixelRatio||1,1.2);
function draw(now){
  frame=0;if(!active)return;
  frame=requestAnimationFrame(draw);
  if(document.hidden||now-last<1000/fps)return;
  last=now;
  const r=root.getBoundingClientRect(),nw=Math.min(1400,Math.max(1,Math.round(r.width*scale))),nh=Math.min(930,Math.max(1,Math.round(r.height*scale)));
  if(nw!==w||nh!==h){w=canvas.width=nw;h=canvas.height=nh;gl.viewport(0,0,w,h);}
  const t=reduced?0:(now-start)/1000, drift=reduced?0:Math.sin(t*.12)*.04;
  const eye=[cx+Math.sin(yaw+drift)*zoom,4+pitch,cz+Math.cos(yaw+drift)*zoom];
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.bindVertexArray(vao);
  gl.uniformMatrix4fv(uVP,false,multiply(perspective((coarse?55:48)*Math.PI/180,w/h,.1,80),view(eye,[cx,0,cz])));
  gl.uniform1f(uTime,t);gl.drawArraysInstanced(gl.TRIANGLES,0,36,data.length/12);
  gl.bindVertexArray(null);
}
function startLoop(){if(active&&!frame)frame=requestAnimationFrame(draw);}
window.UGNScene={available:true,setActive(value){active=Boolean(value);if(!active&&frame){cancelAnimationFrame(frame);frame=0;}if(active)startLoop();}};
root.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest("button,a,nav,dialog"))return;drag=true;px=e.clientX;py=e.clientY;});
window.addEventListener("pointerup",()=>drag=false);
window.addEventListener("pointercancel",()=>drag=false);
window.addEventListener("pointermove",e=>{if(!drag)return;yaw=Math.max(-1.3,Math.min(1.4,yaw-(e.clientX-px)*.005));pitch=Math.max(-3,Math.min(5,pitch+(e.clientY-py)*.014));px=e.clientX;py=e.clientY;});
root.addEventListener("wheel",e=>{if(!e.ctrlKey)zoom=Math.max(10,Math.min(23,zoom+e.deltaY*.004));},{passive:true});
canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();active=false;if(frame)cancelAnimationFrame(frame);frame=0;canvas.hidden=true;window.UGNScene.available=false;});
canvas.addEventListener("webglcontextrestored",()=>{canvas.hidden=true;});
startLoop();
})();