import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const events = new Map();
const children = [];
let scheduled = 0, intervals = 0, writes = 0;
function element (tag) {
  return {
    tag, style: {}, hidden: false,
    children: [],
    append(...items) { this.children.push(...items); },
    attachShadow() { return element('shadow'); },
    addEventListener() {},
    remove() {},
    click() {},
    set textContent(value) { this.text = value; },
    get textContent() { return this.text; }
  };
}
const body = element('body');
body.append = x => children.push(x);
const document = {
  visibilityState: 'visible', hidden: false,
  head: element('head'), documentElement: element('html'), body,
  createElement: element,
  addEventListener(name, cb) { events.set(name, cb); }
};
const context = {
  document,
  window: {
    addEventListener() {},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1
  },
  navigator: { deviceMemory: 8 },
  localStorage: { getItem: () => null, setItem: () => { writes++; } },
  matchMedia: () => ({ matches: false }),
  performance: { now: () => 1000 },
  requestAnimationFrame: () => { scheduled++; return scheduled; },
  cancelAnimationFrame: () => {},
  setInterval: () => { intervals++; return intervals; },
  clearInterval: () => {},
  URL, Blob, Date
};
const src=fs.readFileSync(new URL('../game-performance.js', import.meta.url),'utf8');
vm.runInNewContext(src, context, { filename: 'game-performance.js' });
assert.equal(typeof context.window.UGNPerformance.toggle, 'function');
assert.equal(scheduled, 0, 'off by default: no sampling animation');
assert.equal(intervals, 0, 'off by default: no interval');
assert.equal(writes, 0, 'must not write world/browser storage');
const ev={ ctrlKey:true, shiftKey:true, code:'F8', repeat:false, preventDefault(){}, stopImmediatePropagation(){} };
events.get('keydown')(ev);
assert.equal(scheduled, 1);
assert.equal(intervals, 1);
const snapshot=context.window.UGNPerformance.getSnapshot();
assert.equal(snapshot.networkRttMs, null);
assert.equal(snapshot.serverTps, null);
assert.equal(typeof snapshot.scope,'string');
events.get('keydown')(ev);
assert.equal(writes, 0);
console.log('UGN overlay isolation smoke test: PASS');