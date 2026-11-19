'use strict';
const HOME = 'https://universal-gaming.github.io/UGN-Bedrock/';
const base = new URL(HOME);
function isUGNPage(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      url.origin === base.origin &&
      (url.pathname === '/UGN-Bedrock' || url.pathname.startsWith('/UGN-Bedrock/'));
  } catch { return false; }
}
function canOpenExternal(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !isUGNPage(raw);
  } catch { return false; }
}
module.exports = { HOME, isUGNPage, canOpenExternal };
