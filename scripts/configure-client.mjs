import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const root=process.argv[2] || "../upstream";
const input=process.argv[3] || "./server-config.json";
const configPath=path.join(root,"config.json");
const config=JSON.parse(fs.readFileSync(configPath,"utf8"));
const custom=JSON.parse(fs.readFileSync(input,"utf8"));
const hostOk=(host)=>typeof host==="string" && host.length<=253 &&
  (net.isIP(host)===4 || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) && host.includes("."));
const portOk=(n)=>Number.isInteger(Number(n)) && Number(n)>0 && Number(n)<=65535;
const urlOk=(s)=>typeof s==="string" && /^(?:https|wss):\/\/[a-z0-9.-]+(?::\d{2,5})?(?:\/[a-z0-9/_-]*)?$/i.test(s);
const featured=custom.featuredServer || {};
const displayed=[];
if(featured.enabled){
  if(!hostOk(featured.host)||!portOk(featured.port)){
    throw new Error("UGN featured server enabled but host/port invalid. Update server-config.json.");
  }
  displayed.push({
    ip:featured.host+":"+(Number(featured.port)),
    name:String(featured.name || "UGN Java").slice(0,70),
    description:String(featured.description || "Official UGN browser world").slice(0,160)
  });
}
const extra=Array.isArray(custom.extraServers)?custom.extraServers:[];
for(const item of extra.slice(0,16)){
  if(!hostOk(item.host)||!portOk(item.port))throw new Error("Invalid custom server entry.");
  displayed.push({
    ip:item.host+":"+Number(item.port),
    name:String(item.name || item.host).slice(0,70),
    description:String(item.description || "").slice(0,160)
  });
}
// Make it UGN-only by default: no third-party promoted servers or public proxy list.
config.promoteServers=displayed;
config.defaultHost="";
config.defaultProxy="";
config.defaultProxies=[];
config.defaultUsername="UGNPlayer{0-9999}";
config.rightSideText="UGN JAVA | MC BROWSER EDITION";
config.splashText="ONE NETWORK. YOUR NEXT ADVENTURE.";
config.splashTextFallback="WELCOME TO UGN JAVA.";
const existingSettings = config.defaultSettings || {};
const existingForced = config.forceSettings || {};
// GitHub Pages can lack headers needed by the WASM worker path on some browsers.
// Start with the renderer's supported JavaScript mesher; override previously saved
// WASM preferences via the native appConfig forceSettings mechanism.
// Empty string means "use the connected world's Minecraft version" in
// src/index.ts and ResourcesManager: texturesVersion defaults to version.
// The upstream default "latest" instead uses newer texture mappings for 1.19.4.
config.defaultSettings = {
  ...existingSettings,
  rendererMesher: "legacy-js",
  mouseRawInput: false,
  useVersionsTextures: "",
  disableAssets: false,
  enabledResourcepack: null
};
config.forceSettings = {
  ...existingForced,
  rendererMesher: true,
  mouseRawInput: true,
  useVersionsTextures: true,
  disableAssets: true
};
// Don't force enabledResourcepack: allow players to use their own packs.
// On launch, a saved pack can be removed from Game Settings if corrupt.

config.pauseLinks=[
  [
    {type:"url",url:"https://universalgaming.us/",text:"UGN Website"},
    {type:"url",url:"https://github.com/Universal-Gaming/UGN-Bedrock",text:"UGN GitHub"}
  ]
];
// Do not promote upstream map, P2P or other hosted services by default.
config.mapsProvider="";
config.p2pRelayServer="";

const relay=custom.relay?.url || "";
if(relay){
  if(!urlOk(relay))throw new Error("Relay must be an https:// or wss:// URL pointing to your controlled service.");
  config.defaultProxy=relay;
  config.defaultProxies=[relay];
}
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+"\n");
console.log("UGN client configured: "+displayed.length+" promoted servers; UGN relay "+(relay?"configured":"not yet configured")+".");
