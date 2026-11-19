import fs from 'node:fs';
import path from 'node:path';

/*
 * UGN migration: old builds saved an empty proxy list locally after UGN
 * disabled upstream defaults. Saved list wins over config.defaultProxies.
 * Add new candidates to saved lists without changing manual choices.
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
  "  // Add new candidates without changing a manually selected proxy.",
  "  if (saved?.proxies?.length) {",
  "    const missing = defaults.filter(p => !saved.proxies.includes(p))",
  "    if (!missing.length) return saved",
  "    return { ...saved, proxies: [...saved.proxies, ...missing] }",
  "  }",
  "  if (defaults.length) {",
  "    return { proxies: defaults, selected: defaults[0]!, isAutoSelect: defaults.length > 1 }",
  "  }",
  "  return saved ?? { proxies: [], selected: '', isAutoSelect: false }",
  "}"
].join('\n');
if(s.split(old).length!==2)throw new Error('Upstream proxy selection changed; review patch safely.');
s=s.replace(old,replacement);
const autoOption = "{ value: AUTO_OPTION, label: 'Auto-select' }";
const autoDisplay = "selectedValue === AUTO_OPTION ? 'Auto-select' :";
if (s.split(autoOption).length !== 2 || s.split(autoDisplay).length !== 2) throw new Error('Upstream auto label changed');
s=s.replace(autoOption,"{ value: AUTO_OPTION, label: 'Auto · Lowest ping' }");
s=s.replace(autoDisplay,"selectedValue === AUTO_OPTION ? 'Auto · Lowest ping' :");
fs.writeFileSync(file,s);
console.log('[UGN proxies] Restored relays for new users and legacy empty saved lists.');
