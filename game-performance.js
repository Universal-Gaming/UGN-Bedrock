/* UGN Java opt-in in-game diagnostics. No telemetry, storage writes or world inspection. */
(() => {
  'use strict';
  if (window.__UGN_PERF_DIAGNOSTICS__) return;
  window.__UGN_PERF_DIAGNOSTICS__ = true;
  const frames = [];
  const longTasks = [];
  let active = false, raf = 0, previous = 0, started = 0, timer = 0, observer;
  let root, host, output, button;
  const MAX_FRAMES = 600, MAX_TASKS = 120;
  const sample = now => {
    if (!active) return;
    raf = requestAnimationFrame(sample);
    if (document.visibilityState !== 'visible') { previous = 0; return; }
    if (previous) {
      const delta = now - previous;
      // Long inactive intervals are not gameplay frames.
      if (delta > 0 && delta < 1000) {
        frames.push(delta);
        if (frames.length > MAX_FRAMES) frames.shift();
      }
    }
    previous = now;
  };
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : null;
  const fmt = (value, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : 'N/A';
  const safeNumber = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
  function snapshot () {
    const ordered = frames.slice().sort((a, b) => a - b);
    const total = frames.reduce((s, n) => s + n, 0);
    const fps = total && frames.length ? 1000 * frames.length / total : null;
    const mem = performance.memory;
    return {
      sampleSeconds: safeNumber(total / 1000),
      frames: frames.length,
      averageFps: safeNumber(fps),
      medianFrameMs: safeNumber(quantile(ordered, 0.5)),
      p95FrameMs: safeNumber(quantile(ordered, 0.95)),
      p99FrameMs: safeNumber(quantile(ordered, 0.99)),
      framesOver50msPercent: frames.length ? 100 * frames.filter(n => n > 50).length / frames.length : null,
      longTasksObserved: longTasks.length,
      longTaskTotalMs: safeNumber(longTasks.reduce((sum, n) => sum + n, 0)),
      jsHeapUsedMB: safeNumber(mem?.usedJSHeapSize / 1048576),
      jsHeapLimitMB: safeNumber(mem?.jsHeapSizeLimit / 1048576),
      visibility: document.visibilityState,
      screen: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      // Browser cannot measure server TPS or WebSocket RTT from RAF.
      networkRttMs: null,
      serverTps: null,
      scope: 'Browser rendering frame pacing only. Not server TPS, network RTT or guaranteed game simulation FPS.'
    };
  }
  function render () {
    if (!active || !output) return;
    const s = snapshot();
    output.textContent = [
      'FPS (observed): ' + fmt(s.averageFps, 1),
      'Frame median / p95 / p99: ' + fmt(s.medianFrameMs, 1) + ' / ' + fmt(s.p95FrameMs, 1) + ' / ' + fmt(s.p99FrameMs, 1) + ' ms',
      'Frames over 50 ms: ' + fmt(s.framesOver50msPercent, 1) + '%',
      'Long tasks: ' + s.longTasksObserved + ' (' + fmt(s.longTaskTotalMs) + ' ms)',
      'JS heap (where supported): ' + fmt(s.jsHeapUsedMB) + ' / ' + fmt(s.jsHeapLimitMB) + ' MB',
      'Sample length: ' + fmt(s.sampleSeconds, 1) + ' seconds',
      'Network RTT / server TPS: not measured',
      document.hidden ? 'TAB BACKGROUNDED — PAUSED' : 'LIVE · no data sent'
    ].join('\n');
  }
  function exportReport () {
    const payload = { tool: 'UGN Java in-game performance diagnostics', capturedAt: new Date().toISOString(), ...snapshot() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = 'ugn-game-performance.json';
    anchor.href = url;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function stop () {
    active = false;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    observer?.disconnect();
    previous = 0;
    if (host) host.hidden = true;
  }
  function show () {
    if (!host) mount();
    if (!host) return;
    host.hidden = false;
    frames.length = 0; longTasks.length = 0; started = performance.now(); previous = 0;
    active = true;
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
          observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              longTasks.push(entry.duration);
              if (longTasks.length > MAX_TASKS) longTasks.shift();
            }
          });
          observer.observe({ type: 'longtask', buffered: false });
        }
      } catch { /* Long task API is optional. */ }
    }
    raf = requestAnimationFrame(sample);
    timer = setInterval(render, 1000); render();
  }
  function toggle () { active ? stop() : show(); }
  function mount () {
    host = document.createElement('div');
    host.id = 'ugn-performance-overlay';
    host.hidden = true;
    host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483640;width:min(360px,calc(100vw - 24px));pointer-events:auto';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{color:#e7f6ff;background:#081329f2;border:1px solid #5bdfff;border-radius:10px;box-shadow:0 9px 35px #000a;padding:15px;font:12px/1.5 system-ui,sans-serif}h2{margin:0 0 8px;color:#8ceeff;font-size:13px;letter-spacing:.1em}pre{white-space:pre-wrap;margin:8px 0 12px;font:11px/1.6 ui-monospace,monospace}button{cursor:pointer;border:1px solid #72ceec;background:#153657;color:white;border-radius:5px;padding:7px 9px;margin-right:6px}small{display:block;margin-top:8px;color:#a6bed8}';
    const section = document.createElement('section');
    const title = document.createElement('h2'); title.textContent = 'UGN · GAME PERFORMANCE';
    output = document.createElement('pre');
    const save = document.createElement('button'); save.type = 'button'; save.textContent = 'SAVE REPORT';
    save.addEventListener('click', exportReport);
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'CLOSE';
    close.addEventListener('click', stop);
    const note = document.createElement('small'); note.textContent = 'Ctrl+Shift+F8 to toggle. Reporting only; no automatic gameplay changes. Reports exclude worlds, usernames and tokens.';
    section.append(title, output, save, close, note); root.append(style, section);
    document.body.append(host);
  }
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey && event.shiftKey && event.code === 'F8') || event.repeat) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggle();
  }, true);
  document.addEventListener('visibilitychange', () => { previous = 0; });
  window.addEventListener('pagehide', stop);
  // A callable entrypoint for automated smoke tests; no secret data exposed.
  window.UGNPerformance = Object.freeze({ getSnapshot: snapshot, toggle });
})();