// Behavioural harness for the nwjs/chromium.src bootstrap scripts
// chrome/browser/resources/nwjs/newwin.js (NW2) and default.js (NW1).
// Usage: node splash_harness.js <new newwin.js> <new default.js> <orig newwin.js> <orig default.js>
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const [newwinPath, defaultPath, newwinOrigPath, defaultOrigPath] = process.argv.slice(2);
const src = p => fs.readFileSync(p, 'utf8');

// ---------- fake clock / timers ----------
function makeClock() {
  let now = 1000;
  let timers = [];
  return {
    now: () => now,
    setTimeout: (fn, ms) => { timers.push({ at: now + (ms || 0), fn }); return timers.length; },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers.find(t => t.at <= end);
        if (!t) break;
        timers = timers.filter(x => x !== t);
        now = t.at;
        t.fn();
      }
      now = end;
    },
    pending: () => timers.length
  };
}

function makeEvent() {
  const ls = [];
  return {
    addListener: f => ls.push(f),
    removeListener: f => { const i = ls.indexOf(f); if (i !== -1) ls.splice(i, 1); },
    fire: (...a) => ls.slice().forEach(f => f(...a)),
    count: () => ls.length
  };
}

// ---------- NW2: chrome.windows / chrome.tabs ----------
function runNW2(code, manifest, opts = {}) {
  const clock = makeClock();
  const log = [];
  let nextId = 10;
  const pendingCreates = [];
  const chrome = {
    runtime: { getManifest: () => manifest },
    tabs: { onUpdated: makeEvent() },
    windows: {
      onRemoved: makeEvent(),
      create(options, cb) {
        const call = { options: JSON.parse(JSON.stringify(options)), cb };
        log.push(['create', call.options]);
        pendingCreates.push(call);
      },
      update(id, props) { log.push(['update', id, JSON.parse(JSON.stringify(props))]); },
      remove(id) { log.push(['remove', id]); }
    }
  };
  // Resolve a pending create: returns the window object (or undefined to simulate failure)
  const resolve = (pred, fail) => {
    const i = pendingCreates.findIndex(c => pred(c.options));
    assert.ok(i !== -1, 'no pending create matching');
    const [c] = pendingCreates.splice(i, 1);
    const win = fail ? undefined : { id: nextId++, tabs: [{ id: 100 + nextId }] };
    if (c.cb) c.cb(win);
    return win;
  };
  const imageSize = opts.image; // {w,h} | 'error' | undefined
  class Image {
    set src(v) {
      this._src = v;
      log.push(['image', v]);
      clock.setTimeout(() => {
        if (imageSize === 'error' || !imageSize) this.onerror && this.onerror();
        else { this.naturalWidth = imageSize.w; this.naturalHeight = imageSize.h; this.onload && this.onload(); }
      }, 5);
    }
  }
  const ctx = { chrome, Image, setTimeout: clock.setTimeout, Date: { now: clock.now }, Math, isFinite, JSON };
  vm.runInNewContext(code, ctx, { filename: 'nwjs-bootstrap.js' });
  return { chrome, log, clock, resolve, pending: pendingCreates,
           loaded: (winId, extra) => chrome.tabs.onUpdated.fire(1, Object.assign({ nwstatus: 'complete' }, extra || {}), { windowId: winId }) };
}

// ---------- NW1: chrome.app.window ----------
function runNW1(code, manifest, opts = {}) {
  const clock = makeClock();
  const log = [];
  const pendingCreates = [];
  const chrome = {
    runtime: { getManifest: () => manifest },
    app: { window: {
      create(url, options, cb) {
        const call = { url, options: JSON.parse(JSON.stringify(options || {})), cb };
        log.push(['create', url, call.options]);
        pendingCreates.push(call);
      }
    } }
  };
  const makeAppWin = (name, readyState) => {
    const loadLs = [];
    const w = {
      name,
      onClosed: makeEvent(),
      contentWindow: { document: { readyState: readyState || 'loading' },
                       addEventListener: (ev, f) => { if (ev === 'load') loadLs.push(f); } },
      show() { log.push(['show', name]); },
      close() { log.push(['close', name]); w.onClosed.fire(); },
      fireLoad() { w.contentWindow.document.readyState = 'complete'; loadLs.forEach(f => f()); }
    };
    return w;
  };
  const resolve = (pred, name, fail, readyState) => {
    const i = pendingCreates.findIndex(c => pred(c));
    assert.ok(i !== -1, 'no pending create matching');
    const [c] = pendingCreates.splice(i, 1);
    const win = fail ? undefined : makeAppWin(name, readyState);
    if (c.cb) c.cb(win);
    return win;
  };
  const imageSize = opts.image;
  class Image {
    set src(v) {
      log.push(['image', v]);
      clock.setTimeout(() => {
        if (imageSize === 'error' || !imageSize) this.onerror && this.onerror();
        else { this.naturalWidth = imageSize.w; this.naturalHeight = imageSize.h; this.onload && this.onload(); }
      }, 5);
    }
  }
  const ctx = { chrome, Image, setTimeout: clock.setTimeout, Date: { now: clock.now }, Math, isFinite, JSON };
  vm.runInNewContext(code, ctx, { filename: 'nwjs-bootstrap.js' });
  return { log, clock, resolve, pending: pendingCreates };
}

let n = 0;
const ok = msg => { n++; console.log('  ok -', msg); };
const NEW2 = src(newwinPath), ORIG2 = src(newwinOrigPath), NEW1 = src(defaultPath), ORIG1 = src(defaultOrigPath);
const isMain = o => o.url === 'index.html';
const isSplash = o => o.url !== 'index.html';

// ======================= NW2 =======================
console.log('NW2 newwin.js');
const regressionManifests = [
  { main: 'index.html' },
  { main: 'index.html', window: {} },
  { main: 'index.html', window: { width: 800, height: 600, frame: false, resizable: false, show: false, kiosk: true,
      fullscreen: true, show_in_taskbar: false, always_on_top: true, visible_on_all_workspaces: true, transparent: true,
      position: 'center', icon: 'a.png', title: 'T', id: 'w', min_width: 1, max_width: 2, min_height: 3, max_height: 4 } },
  { main: 'index.html', window: { splash: '' } },
  { main: 'index.html', window: { splash: {} } },
  { main: 'index.html', window: { splash: { url: 5 } } },
  { main: 'index.html', window: { splash: 42 } },
  { main: 'index.html', window: { splash: null, show: true } }
];
for (const m of regressionManifests) {
  const a = runNW2(ORIG2, m), b = runNW2(NEW2, m);
  assert.deepStrictEqual(b.log, a.log, JSON.stringify(m));
  assert.strictEqual(b.log.length, 1);
}
ok(`no/invalid splash: identical chrome.windows.create calls to the original (${regressionManifests.length} manifests)`);

{ // basic html splash, min_duration 0
  const r = runNW2(NEW2, { main: 'index.html', window: { width: 800, height: 600, splash: 'splash.html' } });
  assert.strictEqual(r.log[0][0], 'create');
  assert.strictEqual(r.log[0][1].url, 'index.html');
  assert.strictEqual(r.log[0][1].hidden, true);
  assert.strictEqual(r.log[0][1].width, 800);
  assert.deepStrictEqual(r.log[1], ['create', { url: 'splash.html', type: 'popup', frameless: true, resizable: false,
    width: 400, height: 300, position: 'center', alwaysOnTop: true, showInTaskbar: false }]);
  ok('string splash: main created hidden first, splash popup frameless/centered/on-top/not-in-taskbar 400x300');
  const main = r.resolve(isMain), sp = r.resolve(isSplash);
  r.clock.advance(10000);
  assert.ok(!r.log.some(e => e[0] === 'update' || e[0] === 'remove'), 'nothing before main loaded');
  r.loaded(999); // another window
  r.clock.advance(10);
  assert.ok(!r.log.some(e => e[0] === 'update' || e[0] === 'remove'), 'other window load ignored');
  r.chrome.tabs.onUpdated.fire(1, { status: 'complete' }, { windowId: main.id });
  r.clock.advance(10);
  assert.ok(!r.log.some(e => e[0] === 'update'), 'plain status=complete is not the nw loaded signal');
  ok('splash stays until the main window loads; other windows / non-nwstatus updates ignored');
  r.loaded(main.id);
  r.clock.advance(0);
  const tail = r.log.slice(-2);
  assert.deepStrictEqual(tail, [['update', main.id, { show: true }], ['remove', sp.id]]);
  assert.strictEqual(r.chrome.tabs.onUpdated.count(), 0);
  assert.strictEqual(r.chrome.windows.onRemoved.count(), 0);
  r.loaded(main.id); r.clock.advance(100);
  assert.strictEqual(r.log.filter(e => e[0] === 'update').length, 1);
  ok('on load: main shown, then splash removed, listeners detached; repeated loads ignored');
}

{ // min_duration
  const r = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 'splash.html', width: 320, height: 200, min_duration: 3000 } } });
  const sp0 = r.log[1][1];
  assert.strictEqual(sp0.width, 320); assert.strictEqual(sp0.height, 200);
  const main = r.resolve(isMain), sp = r.resolve(isSplash);
  r.clock.advance(500); r.loaded(main.id);
  r.clock.advance(2499);
  assert.ok(!r.log.some(e => e[0] === 'update'), 'not before min_duration');
  r.clock.advance(1);
  assert.deepStrictEqual(r.log.slice(-2), [['update', main.id, { show: true }], ['remove', sp.id]]);
  ok('min_duration: main shown and splash closed exactly min_duration ms after the splash appeared');
  const r2 = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 'splash.html', min_duration: 1000 } } });
  const m2 = r2.resolve(isMain); r2.resolve(isSplash);
  r2.clock.advance(5000); r2.loaded(m2.id); r2.clock.advance(0);
  assert.strictEqual(r2.log.filter(e => e[0] === 'update').length, 1);
  ok('min_duration already elapsed when main loads: no extra delay');
}

{ // show:false
  const r = runNW2(NEW2, { main: 'index.html', window: { show: false, splash: 'splash.html' } });
  const main = r.resolve(isMain), sp = r.resolve(isSplash);
  r.loaded(main.id); r.clock.advance(0);
  assert.ok(!r.log.some(e => e[0] === 'update'));
  assert.deepStrictEqual(r.log[r.log.length - 1], ['remove', sp.id]);
  ok('show:false: splash closes after load, main window left hidden for the app to show');
}

{ // image auto-size, partial size, error, transparent
  const r = runNW2(NEW2, { main: 'index.html', window: { splash: 'img/splash.PNG?v=2' } }, { image: { w: 640, h: 360 } });
  assert.strictEqual(r.log.filter(e => e[0] === 'create').length, 1, 'splash waits for image size');
  r.clock.advance(5);
  const spOpts = r.log.filter(e => e[0] === 'create')[1][1];
  assert.strictEqual(spOpts.width, 640); assert.strictEqual(spOpts.height, 360);
  ok('image splash without size: window sized to the image natural size (640x360)');
  const r2 = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 'a.gif', width: 500 } } }, { image: { w: 640, h: 360 } });
  r2.clock.advance(5);
  const s2 = r2.log.filter(e => e[0] === 'create')[1][1];
  assert.strictEqual(s2.width, 500); assert.strictEqual(s2.height, 360);
  const r3 = runNW2(NEW2, { main: 'index.html', window: { splash: 'missing.png' } }, { image: 'error' });
  r3.clock.advance(5);
  const s3 = r3.log.filter(e => e[0] === 'create')[1][1];
  assert.strictEqual(s3.width, 400); assert.strictEqual(s3.height, 300);
  const r4 = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 'x.png', width: 10, height: 20, transparent: true } } }, { image: { w: 1, h: 1 } });
  assert.ok(!r4.log.some(e => e[0] === 'image'), 'no image probe when both sizes given');
  const s4 = r4.log.filter(e => e[0] === 'create')[1][1];
  assert.strictEqual(s4.alphaEnabled, true); assert.strictEqual(s4.width, 10); assert.strictEqual(s4.height, 20);
  const r5 = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 's.html', width: -5, height: 'x', min_duration: NaN } } });
  const s5 = r5.log.filter(e => e[0] === 'create')[1][1];
  assert.strictEqual(s5.width, 400); assert.strictEqual(s5.height, 300); assert.strictEqual(s5.alphaEnabled, undefined);
  ok('partial size + image, image load error -> 400x300, transparent -> alphaEnabled, invalid numbers ignored');
}

{ // load event before main create callback
  const r = runNW2(NEW2, { main: 'index.html', window: { splash: 'splash.html' } });
  r.resolve(isSplash);
  r.loaded(10); // window id 10 will be assigned to main below? ids are assigned in resolve order
  // splash got id 10 above; main will get 11 -> fire for 11 before resolving main
  r.loaded(11);
  const main = r.resolve(isMain);
  assert.strictEqual(main.id, 11);
  r.clock.advance(0);
  assert.deepStrictEqual(r.log.slice(-2), [['update', 11, { show: true }], ['remove', 10]]);
  ok('main window load reported before its create callback is still honoured');
}

{ // main removed before load / before splash exists; main create failure; splash create failure
  const r = runNW2(NEW2, { main: 'index.html', window: { splash: 'splash.html' } });
  const main = r.resolve(isMain), sp = r.resolve(isSplash);
  r.chrome.windows.onRemoved.fire(sp.id + 100);
  assert.ok(!r.log.some(e => e[0] === 'remove'));
  r.chrome.windows.onRemoved.fire(main.id);
  assert.deepStrictEqual(r.log[r.log.length - 1], ['remove', sp.id]);
  r.loaded(main.id); r.clock.advance(100);
  assert.ok(!r.log.some(e => e[0] === 'update'));
  assert.strictEqual(r.chrome.tabs.onUpdated.count(), 0);
  ok('main window closed before loading: splash removed, nothing shown later');
  const r2 = runNW2(NEW2, { main: 'index.html', window: { splash: 'splash.html' } });
  const m2 = r2.resolve(isMain);
  r2.chrome.windows.onRemoved.fire(m2.id);
  const s2 = r2.resolve(isSplash);
  assert.deepStrictEqual(r2.log[r2.log.length - 1], ['remove', s2.id]);
  ok('main window closed before the splash exists: splash removed as soon as it is created');
  const r3 = runNW2(NEW2, { main: 'index.html', window: { splash: 'splash.html' } });
  r3.resolve(isMain, true);
  const s3 = r3.resolve(isSplash);
  assert.deepStrictEqual(r3.log[r3.log.length - 1], ['remove', s3.id]);
  assert.strictEqual(r3.chrome.tabs.onUpdated.count(), 0);
  ok('main window creation failure: splash removed');
  const r4 = runNW2(NEW2, { main: 'index.html', window: { splash: { url: 'bad.html', min_duration: 5000 } } });
  const m4 = r4.resolve(isMain); r4.resolve(isSplash, true);
  r4.loaded(m4.id); r4.clock.advance(0);
  assert.deepStrictEqual(r4.log[r4.log.length - 1], ['update', m4.id, { show: true }]);
  assert.ok(!r4.log.some(e => e[0] === 'remove'));
  ok('splash creation failure: main window still shown on load, without min_duration delay');
}

// ======================= NW1 =======================
console.log('NW1 default.js');
for (const m of regressionManifests) {
  const a = runNW1(ORIG1, m), b = runNW1(NEW1, m);
  assert.deepStrictEqual(b.log, a.log, JSON.stringify(m));
  assert.strictEqual(b.log.length, 1);
}
ok(`no/invalid splash: identical chrome.app.window.create calls to the original (${regressionManifests.length} manifests)`);

{
  const r = runNW1(NEW1, { main: 'index.html', window: { width: 800, splash: { url: 'splash.html', min_duration: 2000 } } });
  assert.strictEqual(r.log[0][1], 'index.html'); assert.strictEqual(r.log[0][2].hidden, true);
  assert.deepStrictEqual(r.log[1], ['create', 'splash.html', { frame: 'none', resizable: false, alwaysOnTop: true,
    show_in_taskbar: false, innerBounds: { width: 400, height: 300 } }]);
  const main = r.resolve(c => c.url === 'index.html', 'main');
  r.resolve(c => c.url === 'splash.html', 'splash');
  r.clock.advance(100); main.fireLoad();
  r.clock.advance(1899);
  assert.ok(!r.log.some(e => e[0] === 'show'));
  r.clock.advance(1);
  assert.deepStrictEqual(r.log.slice(-2), [['show', 'main'], ['close', 'splash']]);
  ok('object splash: main hidden, splash frameless/on-top, main shown + splash closed after load and min_duration');
}
{
  const r = runNW1(NEW1, { main: 'index.html', window: { show: false, splash: 'splash.svg' } }, { image: { w: 300, h: 150 } });
  r.clock.advance(5);
  assert.deepStrictEqual(r.log.filter(e => e[0] === 'create')[1][2].innerBounds, { width: 300, height: 150 });
  r.resolve(c => c.url === 'index.html', 'main', false, 'complete');
  r.resolve(c => c.url === 'splash.svg', 'splash');
  r.clock.advance(0);
  assert.ok(!r.log.some(e => e[0] === 'show'));
  assert.deepStrictEqual(r.log[r.log.length - 1], ['close', 'splash']);
  ok('image auto-size, already-loaded main, show:false -> splash closed, main left hidden');
}
{
  const r = runNW1(NEW1, { main: 'index.html', window: { splash: { url: 's.html', transparent: true } } });
  assert.strictEqual(r.log[1][2].alphaEnabled, true);
  const main = r.resolve(c => c.url === 'index.html', 'main');
  const sp = r.resolve(c => c.url === 's.html', 'splash');
  main.close();
  assert.deepStrictEqual(r.log[r.log.length - 1], ['close', 'splash']);
  main.fireLoad(); r.clock.advance(100);
  assert.ok(!r.log.some(e => e[0] === 'show'));
  const r2 = runNW1(NEW1, { main: 'index.html', window: { splash: 's.html' } });
  r2.resolve(c => c.url === 'index.html', 'main', true);
  r2.resolve(c => c.url === 's.html', 'splash');
  assert.deepStrictEqual(r2.log[r2.log.length - 1], ['close', 'splash']);
  const r3 = runNW1(NEW1, { main: 'index.html', window: { splash: { url: 's.html', min_duration: 9000 } } });
  const m3 = r3.resolve(c => c.url === 'index.html', 'main');
  r3.resolve(c => c.url === 's.html', 'splash', true);
  m3.fireLoad(); r3.clock.advance(0);
  assert.deepStrictEqual(r3.log[r3.log.length - 1], ['show', 'main']);
  ok('transparent -> alphaEnabled; main closed/failed -> splash closed; splash failure -> main shown immediately');
}

console.log(`\n${n} checks passed`);
