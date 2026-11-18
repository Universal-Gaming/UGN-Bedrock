(() => {
  "use strict";

  /* Original WebGL2 sci-fi portal artwork. This is NOT Minecraft gameplay. */
  const canvas = document.getElementById("space-scene");
  const root = document.getElementById("experience");
  if (!canvas || !root) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: "low-power", preserveDrawingBuffer: false
  });
  if (!gl) {
    canvas.hidden = true;
    window.UGNScene = { available: false, setActive() {} };
    return;
  }

  const vert = `#version 300 es
    precision highp float;
    const vec2 pos[3]=vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
    void main(){gl_Position=vec4(pos[gl_VertexID],0.0,1.0);}
  `;
  const frag = `#version 300 es
    precision highp float;
    out vec4 outColor;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uYaw;
    uniform float uPitch;
    uniform float uZoom;

    float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
    float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float noise3(vec3 p){
      vec3 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      float a=hash3(i);
      float b=hash3(i+vec3(1,0,0));
      float c=hash3(i+vec3(0,1,0));
      float d=hash3(i+vec3(1,1,0));
      float e=hash3(i+vec3(0,0,1));
      float g=hash3(i+vec3(1,0,1));
      float h=hash3(i+vec3(0,1,1));
      float k=hash3(i+vec3(1,1,1));
      return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);
    }
    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
    float boxSDF(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
    vec2 mini(vec2 a,vec2 b){return a.x<b.x?a:b;}
    vec2 world(vec3 p) {
      vec3 q=p-vec3(1.42,.02,-.82);
      float r=length(q.xy);
      vec2 d=vec2(p.y+1.8,1.);
      d=mini(d,vec2(length(vec2(r-1.48,q.z))-.10,2.));
      d=mini(d,vec2(length(vec2(r-1.71,q.z))-.032,3.));
      d=mini(d,vec2(length(vec2(r-1.62,q.z))-.022,4.));
      d=mini(d,vec2(max(r-1.37,abs(q.z+.17)-.022),5.));
      d=mini(d,vec2(boxSDF(p-vec3(1.42,-1.75,-.82),vec3(2.18,.10,.91)),6.));
      d=mini(d,vec2(boxSDF(p-vec3(-3.15,-.06,-1.8),vec3(.24,1.7,.30)),7.));
      d=mini(d,vec2(boxSDF(p-vec3(4.65,-.06,-1.8),vec3(.24,1.7,.30)),7.));
      vec3 shard=p-vec3(3.18,.77,-.2);
      shard.xy*=rot(uTime*.22);
      shard.xz*=rot(.5);
      d=mini(d,vec2(boxSDF(shard,vec3(.18,.39,.18)),8.));
      vec3 shard2=p-vec3(-2.1,1.5,-1.2);
      shard2.xz*=rot(-uTime*.14);
      d=mini(d,vec2(boxSDF(shard2,vec3(.17,.25,.22)),8.));
      return d;
    }
    vec3 normalAt(vec3 p){
      float e=.003;
      return normalize(vec3(world(p+vec3(e,0,0)).x-world(p-vec3(e,0,0)).x,
        world(p+vec3(0,e,0)).x-world(p-vec3(0,e,0)).x,
        world(p+vec3(0,0,e)).x-world(p-vec3(0,0,e)).x));
    }
    vec3 sky(vec3 rd){
      vec2 uv=vec2(atan(rd.z,rd.x),asin(rd.y));
      float cloud=noise3(rd*6.2+vec3(.2,.1,uTime*.004));
      float glow=exp(-length(uv-vec2(-.26,.13))*1.25);
      vec3 col=mix(vec3(.009,.014,.040),vec3(.075,.037,.185),pow(glow,3.0)*(.35+cloud*.8));
      col+=vec3(.018,.045,.094)*pow(max(0.,1.-length(uv-vec2(-1.05,-.2))*.6),4.);
      vec2 cells=floor(uv*vec2(230.,160.));
      vec2 f=fract(uv*vec2(230.,160.))-.5;
      float star=step(.992,hash(cells))*exp(-56.*dot(f,f));
      col+=star*vec3(.50,.73,1.);
      return col;
    }
    vec3 material(vec3 p,float id,vec3 n,vec3 rd) {
      vec3 base=vec3(.10,.13,.25);
      if(id<1.5){
        float gx=abs(fract(p.x*.52)-.5);
        float gz=abs(fract(p.z*.52)-.5);
        float line=1.-smoothstep(.010,.026,min(gx,gz));
        float minor=1.-smoothstep(.010,.036,min(abs(fract(p.x*2.)-.5),abs(fract(p.z*2.)-.5)));
        float pool=exp(-length(p.xz-vec2(1.42,-.82))*.28);
        base=vec3(.012,.021,.05)+line*vec3(.060,.14,.27)+minor*vec3(.016,.022,.048)+pool*line*vec3(.12,.29,.39);
      }else if(id<2.5){
        float angle=atan(p.y-.02,p.x-1.42);
        float pulse=sin(angle*24.+uTime*1.2)*.5+.5;
        base=vec3(.43,.31,.87)+vec3(.12,.21,.27)*pulse;
      }else if(id<3.5){base=vec3(.27,.65,1.1);
      }else if(id<4.5){base=vec3(.63,1.2,1.7);
      }else if(id<5.5){
        vec2 q=p.xy-vec2(1.42,.02);
        float a=atan(q.y,q.x),r=length(q);
        float nse=noise3(vec3(q*3.5,uTime*.08));
        float vortex=sin(a*12.-r*17.+uTime*.65+nse*3.);
        float filament=sin(a*23.+r*25.-uTime*1.2)*sin(r*21.-uTime*.9);
        return mix(vec3(.08,.04,.25),vec3(.31,.18,.8),smoothstep(-.7,.8,vortex))
          +vec3(.22,.43,.98)*pow(max(filament,0.),7.)*.75;
      }else if(id<6.5){base=vec3(.14,.23,.40);
      }else if(id<7.5){base=vec3(.07,.11,.22);
      }else{base=vec3(.30,.42,.93);}
      vec3 light=normalize(vec3(-.5,.9,1.1));
      float diff=max(dot(n,light),0.);
      float rim=pow(1.-max(dot(n,-rd),0.),3.);
      return base*(.40+diff*.91)+rim*vec3(.16,.18,.35);
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy/uResolution)*2.-1.;
      uv.x*=uResolution.x/uResolution.y;
      vec3 center=vec3(.35,.08,-.8);
      vec3 origin=center+vec3(sin(uYaw)*uZoom,.50+uPitch,cos(uYaw)*uZoom);
      vec3 forward=normalize(center-origin);
      vec3 right=normalize(cross(forward,vec3(0,1,0)));
      vec3 up=cross(right,forward);
      vec3 ray=normalize(uv.x*right+uv.y*up+forward*1.56);
      vec3 bg=sky(ray);
      float t=.02,mat=-1.,halo=0.;
      vec3 hit=origin;
      for(int i=0;i<58;i++){
        hit=origin+ray*t;
        vec2 result=world(hit);
        vec3 q=hit-vec3(1.42,.02,-.82);
        float ring=abs(length(vec2(length(q.xy)-1.56,q.z))-.10);
        halo+=exp(-ring*8.)*.008;
        if(result.x<.006){mat=result.y;break;}
        t+=max(result.x*.85,.014);
        if(t>30.)break;
      }
      vec3 col=bg;
      if(mat>0. && t<=30.){
        vec3 norm=normalAt(hit);
        vec3 surface=material(hit,mat,norm,ray);
        float fog=1.-exp(-t*.027);
        col=mix(surface,bg,fog*.53);
        if(mat>1.5 && mat<4.5)col+=vec3(.14,.15,.3);
      }
      col+=min(halo,.26)*vec3(.15,.41,.9);
      col*=1.-smoothstep(.86,2.2,length(uv))*.35;
      col=col/(vec3(1.)+col*.24);
      outColor=vec4(pow(max(col,0.),vec3(.87)),1.);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("UGN 3D scene compilation failed", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, vert);
  const fragment = compile(gl.FRAGMENT_SHADER, frag);
  if (!vertex || !fragment) {
    canvas.hidden = true;
    window.UGNScene = { available: false, setActive() {} };
    return;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.hidden = true;
    console.warn("UGN 3D scene link failed", gl.getProgramInfoLog(program));
    window.UGNScene = { available: false, setActive() {} };
    return;
  }
  document.documentElement.classList.add("webgl-ready");
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.useProgram(program);
  const loc = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    yaw: gl.getUniformLocation(program, "uYaw"),
    pitch: gl.getUniformLocation(program, "uPitch"),
    zoom: gl.getUniformLocation(program, "uZoom")
  };

  let yaw = -.10;
  let pitch = 0;
  let zoom = 5.25;
  let width = 0, height = 0;
  let dragging = false, px = 0, py = 0, frame = 0, last = -Infinity;
  let active = true, lost = false;
  const started = performance.now();
  const ratio = touchDevice ? .44 : .57;
  const fps = reducedMotion ? 1 : touchDevice ? 24 : 30;
  function resize() {
    const rect = root.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.25) * ratio;
    const w = Math.min(1152, Math.max(1, Math.round(rect.width * scale)));
    const h = Math.min(720, Math.max(1, Math.round(rect.height * scale)));
    if (w === width && h === height) return;
    width = canvas.width = w;
    height = canvas.height = h;
    gl.viewport(0, 0, width, height);
  }
  function draw(now) {
    frame = 0;
    if (!active || lost) return;
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - last < 1000 / fps) return;
    last = now;
    resize();
    gl.uniform2f(loc.resolution, width, height);
    gl.uniform1f(loc.time, reducedMotion ? 0 : (now - started) * .001);
    gl.uniform1f(loc.yaw, yaw);
    gl.uniform1f(loc.pitch, pitch);
    gl.uniform1f(loc.zoom, zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function start() {
    if (active && !lost && !frame) frame = requestAnimationFrame(draw);
  }
  window.UGNScene = {
    available: true,
    setActive(value) {
      active = Boolean(value);
      if (!active && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else start();
    }
  };
  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a,button,input,dialog")) return;
    dragging = true;
    px = event.clientX;
    py = event.clientY;
  });
  window.addEventListener("pointerup", () => { dragging = false; });
  window.addEventListener("pointercancel", () => { dragging = false; });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    yaw = Math.max(-.9, Math.min(.9, yaw - (event.clientX - px) * .0027));
    pitch = Math.max(-1.2, Math.min(1.4, pitch + (event.clientY - py) * .007));
    px = event.clientX;
    py = event.clientY;
  });
  root.addEventListener("wheel", (event) => {
    if (event.target.closest("dialog") || event.ctrlKey) return;
    if (Math.abs(event.deltaY) > 0) {
      zoom = Math.max(3.1, Math.min(8.7, zoom + event.deltaY * .002));
    }
  }, { passive: true });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    active = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    document.documentElement.classList.remove("webgl-ready");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    // Context resources must be recreated; show the CSS fallback instead.
    canvas.hidden = true;
    window.UGNScene.available = false;
  });
  start();
})();