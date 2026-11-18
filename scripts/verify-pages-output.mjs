import fs from "node:fs";
import path from "node:path";

/**
 * Catch missing game assets and incorrect project-page URLs before deployment.
 * This validates files in the *actual* GitHub Pages artifact, not merely
 * the upstream source tree. A green result is not a live-browser test.
 */
const output=path.resolve(process.argv[2] || "./public");
const client=path.join(output,"client");
const errors=[];
const checked=[];
function requireFile(location,minBytes=1){
  try {
    const stat=fs.statSync(location);
    if(!stat.isFile() || stat.size<minBytes)throw new Error("empty or too small");
    checked.push({file:path.relative(output,location),bytes:stat.size});
  }catch(e){errors.push("Missing packaged asset: "+path.relative(output,location)+" ("+e.message+")")}
}
function readJson(file){
  requireFile(file,5);
  try{return JSON.parse(fs.readFileSync(file,"utf8"))}
  catch(e){errors.push("Bad JSON: "+path.relative(output,file)+" "+e.message);return null}
}
requireFile(path.join(output,"index.html"),100);
requireFile(path.join(output,"app.js"),500);
requireFile(path.join(output,"landing.css"),500);
requireFile(path.join(client,"index.html"),500);
requireFile(path.join(client,"mesher.js"),1000);
requireFile(path.join(client,"lightOwnerWorker.js"),500);
const manifest=readJson(path.join(client,"ugn-build.json"));
const cfg=readJson(path.join(output,"server-config.json"));
const vanilla=readJson(path.join(client,"ugn-vanilla-assets.json"));
if(manifest?.client!=="minecraft-web-client")errors.push("Unexpected game bundle identifier");
if(!vanilla?.versions?.some(x=>x.version==="1.19.4"&&x.dataReady)) errors.push("Java 1.19.4 vanilla data unverified");
if(cfg?.featuredServer?.enabled){
  const expected=cfg.featuredServer.host+":"+cfg.featuredServer.port;
  console.log("[UGN Pages verify] Featured Java server:",expected);
  const builtConfig=path.resolve(process.argv[3]||"./upstream/config.json");
  const embedded=readJson(builtConfig);
  if(embedded?.defaultHost!==expected)errors.push("Featured server differs from client defaultHost");
  if(!embedded?.promoteServers?.some(x=>x.ip===expected))errors.push("Featured server absent from game menu");
  if(!cfg.relay?.url)console.warn("[UGN Pages verify] The featured address cannot be joined from a browser until a secure relay is configured.");
}
const htmlFile=path.join(client,"index.html");
if(fs.existsSync(htmlFile)){
  const html=fs.readFileSync(htmlFile,"utf8");
  const refs=[];
  for(const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
    const match=tag[0].match(/\b(?:src|href)=["']([^"']+)["']/i);
    if(match)refs.push(match[1]);
  }
  let js=0,css=0;
  for(const ref of refs){
    if(/^(?:https?:|data:|\/\/|#)/i.test(ref))continue;
    if(ref.startsWith("/")){
      errors.push("Asset URL starts at domain root (breaks /UGN-Bedrock/ GitHub Pages): "+ref);
      continue;
    }
    const asset=path.resolve(client,decodeURIComponent(ref.split("?")[0].split("#")[0]));
    if(!asset.startsWith(client+path.sep)) {
      errors.push("Asset escapes client folder: "+ref);
      continue;
    }
    requireFile(asset);
    if(ref.includes("static/js/"))js++;
    if(ref.includes("static/css/"))css++;
  }
  if(js<2||css<1)errors.push("Client entrypoint missing compiled JavaScript or CSS references.");
  console.log("[UGN Pages verify] Client entry references:",js,"JavaScript,",css,"stylesheets");
}
if(errors.length){
  console.error("[UGN Pages verify] FAILED:\n- "+errors.join("\n- "));
  process.exitCode=1;
}else{
  console.log("[UGN Pages verify] Passed: "+checked.length+" critical files and entrypoint links verified.");
  console.log("[UGN Pages verify] This does not replace GitHub Pages Source=GitHub Actions or real gameplay tests.");
}
