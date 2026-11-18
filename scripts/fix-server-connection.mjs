import fs from "node:fs";
import path from "node:path";

/**
 * Prevent an unconfigured browser-to-TCP relay from leaving the game in a
 * broken loading state. This does not fake multiplayer functionality.
 * Apply to the pinned upstream revision before compiling.
 */
const root=process.argv[2];
if(!root)throw new Error("Usage: node fix-server-connection.mjs <upstream>");
const file=path.join(root,"src/index.ts");
let s=fs.readFileSync(file,"utf8");
const old=`    const parsedProxy = parseServerAddress(connectOptions.proxy, false)
    const proxy = { host: parsedProxy.host, port: parsedProxy.port }`;
const next=`    // UGN Java: browsers cannot connect to an ordinary Java TCP address
    // without a compatible HTTPS/WebSocket relay. Report this clearly and
    // tear down the attempted session instead of parsing an undefined proxy.
    if (!connectOptions.proxy) {
      handleError(new Error('The UGN Java server requires a secure browser relay. The server address is configured, but multiplayer is not available until a relay is online. Singleplayer remains available.'), 'UGN Browser Connection')
      appStatusState.showReconnect = false
      return
    }
    const parsedProxy = parseServerAddress(connectOptions.proxy, false)
    const proxy = { host: parsedProxy.host, port: parsedProxy.port }`;
const count=s.split(old).length-1;
if(count!==1)throw new Error("Upstream proxy connection changed: expected one match, found "+count);
s=s.replace(old,next);
const oldNoProxy=`        setLoadingScreenStatus(message, true)
        return`;
const nextNoProxy=`        handleError(new Error(message), 'UGN Browser Relay')
        appStatusState.showReconnect = false
        return`;
if(s.split(oldNoProxy).length-1!==1)throw new Error("Unexpected upstream no-proxy error handling");
s=s.replace(oldNoProxy,nextNoProxy);
fs.writeFileSync(file,s);
console.log("[UGN relay] Missing proxy now produces a clean client error, no TCP startup loop.");
