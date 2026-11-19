'use strict';
// Transport options originally included by zardoy/minecraft-web-client.
// These are independent community relays, NOT UGN-operated infrastructure.
// Player traffic is passed through the selected provider. Choose explicitly.
const { HOME } = require('./url-policy.cjs');
const UGN_PROXY = Object.freeze({
  name: 'UGN Private (requires own server deployment)',
  url: 'https://proxy.universalgaming.us'
});
const COMMUNITY_PROXIES = Object.freeze([
  Object.freeze({ name: 'Community relay 1 · mcraft.fun', url: 'https://proxy.mcraft.fun' }),
  Object.freeze({ name: 'Community relay 2 · mcraft.fun', url: 'https://proxy2.mcraft.fun' }),
  Object.freeze({ name: 'Community relay 3 · mcraft.fun', url: 'https://proxy3.mcraft.fun' }),
  Object.freeze({ name: 'Community relay 4 · koyeb', url: 'https://pwc.koyeb.app' })
]);
const ALL_PROXIES = Object.freeze([...COMMUNITY_PROXIES, UGN_PROXY]);
function gameWithProxy(value) {
  if (!ALL_PROXIES.some(item => item.url === value)) {
    throw new TypeError('Proxy URL is not in the shipped allowlist');
  }
  const url = new URL('client/index.html', HOME);
  url.searchParams.set('proxy', value);
  return url.href;
}
function proxyIsCommunity(value) {
  return COMMUNITY_PROXIES.some(item => item.url === value);
}
module.exports = { UGN_PROXY, COMMUNITY_PROXIES, ALL_PROXIES, gameWithProxy, proxyIsCommunity };
