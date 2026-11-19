import fs from 'node:fs';
import path from 'node:path';

/*
 * UGN migration: old builds saved an empty proxy list locally after UGN
 * disabled upstream defaults. Saved list wins over config.defaultProxies.
 * Replace only empty legacy lists; keep all nonempty user-chosen proxies.
 */
const root=process.argv[2];
if(!root)throw new Error('Usage: node restore-proxy-presets.mjs <upstream>');
const file=path.join(root,'src/react/ServersList.tsx');
let s=fs.readFileSync(file,'utf8');
const old=[
  "export const getProxiesData = (): SavedProxiesData => {",
  "  if (appStorage.proxiesData) return appStorage.proxiesData",
  "  const proxies = getDefaultProxies()",
  "  return { proxies, selected: proxies[0] ?? '', isAutoSelect: proxies.length > 1 }",
  "}"
].join('\n');
const replacement=[
  "export const getProxiesData = (): SavedProxiesData => {",
  "  const defaults = getDefaultProxies()",
  "  const saved = appStorage.proxiesData",
  "  // UGN 0.1.0 shipped no default proxies. Restore only empty saved lists.",
  "  if (saved?.proxies?.length) return saved",
  "  if (defaults.length) {",
  "    return { proxies: defaults, selected: defaults[0]!, isAutoSelect: defaults.length > 1 }",
  "  }",
  "  return saved ?? { proxies: [], selected: '', isAutoSelect: false }",
  "}"
].join('\n');
if(s.split(old).length!==2)throw new Error('Upstream proxy selection changed; review patch safely.');
s=s.replace(old,replacement);
fs.writeFileSync(file,s);
console.log('[UGN proxies] Restored relays for new users and legacy empty saved lists.');
