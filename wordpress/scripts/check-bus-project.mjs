// Real-browser checks; all external services are blocked and project data is mocked.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

const tab = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', {method: 'PUT'})).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
let sequence = 0, fixture, requests = 0, failure = false;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, {resolve, reject});
  ws.send(JSON.stringify({id, method, params}));
});
ws.onmessage = async event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const pair = pending.get(message.id);
    pending.delete(message.id);
    message.error ? pair.reject(message.error) : pair.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Fetch.requestPaused') {
    requests++;
    await send('Fetch.fulfillRequest', {
      requestId: message.params.requestId, responseCode: failure ? 503 : 200,
      responseHeaders: [{name: 'Content-Type', value: 'application/json'}],
      body: Buffer.from(JSON.stringify(failure ? {message: 'Unavailable'} : fixture)).toString('base64')
    });
  }
};
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = () => ({project_id: 184020, donated_cents: 312550, goal_cents: 800000,
  open_cents: 487450, donations_count: 49, percentage: 39, status: 'active', can_donate: true,
  fetched_at: new Date().toISOString(), stale: false});
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Network.setBlockedURLs', {urls: ['*betterplace.org/*', '*raisenow.io/*', '*youtube*', '*google*', '*paypal*', '*s.w.org/*']});
await send('Fetch.enable', {patterns: [{urlPattern: '*bkw/v1/bus-project*'}]});
await send('Page.addScriptToEvaluateOnNewDocument', {source: `
  window.__busOffset = 0;
  const realNow = Date.now;
  Date.now = () => realNow() + window.__busOffset;
  const interval = window.setInterval;
  window.setInterval = (callback, ms, ...args) => {
    if (ms === 60000) window.__busTick = callback;
    return interval(callback, ms, ...args);
  };
`});
async function navigate(page = '', width = 1440) {
  const before = requests;
  await send('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: 'http://localhost:8766/' + page});
  for (let i = 0; i < 80; i++) {
    if (requests > before && await evaluate('document.readyState === "complete"')) break;
    await delay(100);
  }
  assert.ok(requests > before, 'Project data not requested');
  await delay(150);
}
const state = () => evaluate(`(() => {
  const panel = document.querySelector('.current-panel-body');
  const appeal = document.querySelector('.appeal');
  const bar = document.querySelector('.campaign-meter');
  const card = document.querySelector('.bus-card-body');
  return {
    card: card ? {
      amount: card.querySelector('.bus-progress-head b').textContent,
      percentage: card.querySelector('.bus-progress-head span').textContent,
      stamp: card.querySelector('.launcher-label').textContent,
      stats: [...card.querySelectorAll('.bus-stats b')].map(e => e.textContent),
      progress: card.querySelector('.bus-progress').getAttribute('aria-valuenow'),
      width: card.querySelector('.bus-progress i').style.width,
      link: card.querySelector('.bus-cta').textContent
    } : null,
    amount: panel.querySelector('.current-progress-head span').textContent,
    percentage: panel.querySelector('.current-progress-head strong').textContent,
    stamp: panel.querySelector('.mini').textContent,
    status: panel.querySelector('.donation-security').textContent,
    stats: [...panel.querySelectorAll('.current-stats b')].map(e => e.textContent),
    link: panel.querySelector('.current-link').textContent,
    main: appeal?.querySelector('.campaign-meta p').textContent,
    target: appeal?.querySelector('.pct').dataset.target,
    animated: appeal?.querySelector('.pct').textContent,
    progress: bar?.getAttribute('aria-valuenow'),
    width: bar ? bar.querySelector('i').getBoundingClientRect().width / bar.getBoundingClientRect().width : null
  };
})()`);
try {
  fixture = base();
  for (const width of [1440, 390]) {
    for (const page of ['', 'projekte/', 'mitgliedschaft/', 'sponsoren/']) {
      await navigate(page, width);
      const result = await state();
      assert.match(result.amount, /3\.125,50/);
      assert.match(result.stats[1], /4\.874,50/);
      assert.equal(result.stats[2], '49');
      assert.equal(result.percentage, '39 %');
      assert.equal(result.status, 'Spendenaktion läuft');
      if (page === 'projekte/') {
        assert.match(result.card.amount, /3\.125,50/);
        assert.equal(result.card.percentage, '39 %');
        assert.deepEqual(result.card.stats, result.stats);
        assert.equal(result.card.progress, '39');
        assert.equal(result.card.width, '39%');
        assert.match(result.card.stamp, /Spendenaktion läuft/);
      }
      if (!page) {
        assert.equal(result.target, '39');
        assert.equal(result.progress, '39');
      }
    }
  }
  fixture = {...base(), donated_cents: 0, open_cents: 800000, percentage: 0, donations_count: 0};
  await navigate();
  await evaluate('document.querySelector(".appeal").scrollIntoView()');
  await delay(2700);
  assert.equal((await state()).animated, '0 %');
  fixture = {...base(), donated_cents: 800000, open_cents: 0, percentage: 100, status: 'funded'};
  await navigate();
  await evaluate('document.querySelector(".appeal").scrollIntoView()');
  await delay(2700);
  const funded = await state();
  assert.equal(funded.animated, '100 %');
  assert.ok(Math.abs(funded.width - 1) < 0.01);
  assert.equal(funded.status, 'Spendenziel erreicht');
  for (const [status, label] of [['paused', 'Spenden derzeit pausiert'], ['closed', 'Spendenaktion beendet']]) {
    fixture = {...base(), status, can_donate: false};
    await navigate();
    assert.equal((await state()).status, label);
    assert.match((await state()).link, /Projekt bei Betterplace ansehen/);
  }
  fixture = {...base(), stale: true};
  await navigate();
  assert.match((await state()).stamp, /Aktualisierung derzeit nicht möglich/);
  fixture = base();
  await navigate();
  failure = true;
  await evaluate('window.__busOffset = 16 * 60000; window.__busTick()');
  await delay(200);
  assert.match((await state()).amount, /3\.125,50/);
  assert.match((await state()).stamp, /Aktualisierung derzeit nicht möglich/);
  await navigate();
  assert.match((await state()).stamp, /28\.08\.2026.*Aktualisierung derzeit nicht möglich/);
  assert.match((await state()).main, /Stand 28\.08\.2026/);
  failure = false;
  for (const [status, label] of [['paused', 'Spenden derzeit pausiert'], ['closed', 'Spendenaktion beendet'], ['funded', 'Spendenziel erreicht']]) {
    fixture = {...base(), status, can_donate: status === 'funded'};
    await navigate('projekte/', 390);
    assert.ok((await state()).card.stamp.includes(label));
    if (status !== 'funded') assert.match((await state()).card.link, /Projekt bei Betterplace ansehen/);
  }
  fixture = {...base(), stale: true};
  await navigate('projekte/');
  assert.match((await state()).card.stamp, /Aktualisierung derzeit nicht möglich/);
  failure = true;
  await navigate('projekte/');
  assert.match((await state()).card.stamp, /28\.08\.2026.*Aktualisierung derzeit nicht möglich/);
  failure = false;
  fixture = base();
  await navigate('', 390);
  await mkdir('/tmp/bk-bus-project-check', {recursive: true});
  await evaluate('document.querySelector(".appeal").scrollIntoView()');
  await delay(2700);
  const screenshot = await send('Page.captureScreenshot', {format: 'png'});
  await writeFile('/tmp/bk-bus-project-check/mobile.png', Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(errors, []);
  console.log('PASS: four pages at desktop/mobile widths; cents, 0/100% animation, project states, stale data, and outage fallback.');
} finally {
  await send('Page.close');
  ws.close();
}
