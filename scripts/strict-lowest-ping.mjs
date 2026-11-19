import fs from 'node:fs';
import path from 'node:path';

// Choose the lowest measured ping among healthy relays, not first responder.
const root=process.argv[2];
if(!root)throw new Error('Usage: node strict-lowest-ping.mjs <upstream>');
const chooseFile=path.join(root,'src/core/proxyAutoSelect.ts');
const pingFile=path.join(root,'src/core/pingProxy.ts');
let choose=fs.readFileSync(chooseFile,'utf8');
let ping=fs.readFileSync(pingFile,'utf8');
function replaceOnce(source,oldText,newText,label){
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(label+': expected 1 upstream anchor, got '+count);
  return source.replace(oldText,newText);
}
const oldComment = 'Pings all proxies and resolves with the first one that responded (or null if all failed). Other pings keep running';
if(!choose.includes(oldComment))throw new Error('Proxy selection upstream comment changed');
choose=choose.replace(oldComment,'Pings all candidates and chooses the lowest measured latency from healthy responses');
const functionStart='async function pingProxies (proxies: string[]): Promise<string | null> {';
const functionEnd='\nexport function cancelProxyPinging () {';
const a=choose.indexOf(functionStart);
const b=choose.indexOf(functionEnd,a);
if(a<0||b<=a)throw new Error('Proxy selection function moved');
const old=choose.slice(a,b);
if(!old.includes('return await Promise.any(pingPromises)')||
   !old.includes('pingProxyServer(normalizedProxy, abortController.signal)')||
   !old.includes('proxyPingState.proxyStatus[proxy]')) {
  throw new Error('Upstream selection behavior changed; refusing unsafe edit');
}
const replacement=[
  'async function pingProxies (proxies: string[]): Promise<string | null> {',
  '  cancelProxyPinging()',
  '  const abortController = new AbortController()',
  '  currentPingAbortController = abortController',
  '  proxyPingState.checkStarted = true',
  '  proxyPingState.selectedProxy = null',
  "  for (const proxy of proxies) proxyPingState.proxyStatus[proxy] = { status: 'checking' }",
  '  // All checks run concurrently; wait for every success or timeout.',
  '  const attempts = proxies.map(async (proxy) => {',
  '    const normalized = normalizeProxyUrl(proxy)',
  '    try {',
  '      const result = await pingProxyServer(normalized, abortController.signal)',
  '      if (abortController.signal.aborted) return',
  '      if (!result.success || !Number.isFinite(result.latency)) {',
  "        proxyPingState.proxyStatus[proxy] = { status: 'error', error: result.error ?? 'Invalid latency measurement' }",
  '        return',
  '      }',
  "      proxyPingState.proxyStatus[proxy] = { status: 'success', latency: result.latency }",
  '    } catch (error) {',
  '      if (abortController.signal.aborted) return',
  "      proxyPingState.proxyStatus[proxy] = { status: 'error', error: String(error) }",
  '    }',
  '  })',
  '  await Promise.allSettled(attempts)',
  '  if (currentPingAbortController === abortController) {',
  '    currentPingAbortController = null',
  '    proxyPingState.checkStarted = false',
  '  }',
  '  if (abortController.signal.aborted) return null',
  '  let selected: string | null = null',
  '  let lowestLatency = Number.POSITIVE_INFINITY',
  '  for (const proxy of proxies) {',
  '    const status = proxyPingState.proxyStatus[proxy]',
  "    if (status?.status !== 'success' || !Number.isFinite(status.latency)) continue",
  '    if (status.latency! < lowestLatency) {',
  '      lowestLatency = status.latency!',
  '      selected = normalizeProxyUrl(proxy)',
  '    }',
  '  }',
  '  proxyPingState.selectedProxy = selected',
  '  return selected',
  '}',
  ''
].join('\n');
choose=choose.slice(0,a)+replacement+choose.slice(b);
const oldPing=[
  '            resolve({',
  '              roundTripTime,',
  '              serverProcessingTime: parseFloat(serverProcessingTime),',
  '              networkLatency: roundTripTime - parseFloat(serverProcessingTime)',
  '            })'
].join('\n');
const newPing=[
  '            // Some relays reply with pong:id (no processing time).',
  '            const parsedProcessing = Number.parseFloat(serverProcessingTime)',
  '            const processingMs = Number.isFinite(parsedProcessing) ? Math.max(0, parsedProcessing) : 0',
  '            resolve({',
  '              roundTripTime,',
  '              serverProcessingTime: processingMs,',
  '              networkLatency: Math.max(0, roundTripTime - processingMs)',
  '            })'
].join('\n');
ping=replaceOnce(ping,oldPing,newPing,'ping processing time');
fs.writeFileSync(chooseFile,choose);
fs.writeFileSync(pingFile,ping);
console.log('[UGN proxies] Lowest measured ping among healthy relays; offline relays skipped.');
