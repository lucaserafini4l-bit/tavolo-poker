// Test nel browser con il server acceso: posto del Sistema, registrazione automatica della sua azione.
//   node test_auto_browser.js http://127.0.0.1:8770/
const { chromium } = require('playwright'); const assert = require('assert');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.click('.nav button[data-view="impostazioni"]');
  await page.waitForSelector('#sjSeat', { timeout: 10000 });          // scheda Sistema Jev presente (server collegato)
  await page.selectOption('#sjSeat', '3'); await page.check('#sjAuto');
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(TP.state)));
  let s = await S(); assert.strictEqual(s.cfg.jevSeat, 3); assert.strictEqual(s.cfg.jevAuto, true);
  await page.click('.nav button[data-view="piatto"]'); await page.click('#potStart');
  s = await S(); assert.strictEqual(s.hand.toAct, 3, 'il Sistema (UTG) parla per primo');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => fetch('/api/carte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carte: [48, 49] }) }).then(x => x.json()));
  assert.ok(r.ok, 'carte registrate');
  await page.waitForFunction(() => (TP.state.hand.acts || []).length >= 1, null, { timeout: 8000 });
  await page.waitForTimeout(2500);                                     // altri cicli di poll: niente doppie registrazioni
  s = await S();
  assert.strictEqual(s.hand.acts.length, 1, 'azione registrata una sola volta');
  assert.strictEqual(s.hand.acts[0].i, 3); assert.ok(['raise', 'allin'].includes(s.hand.acts[0].t), 'con AA il Sistema rilancia: ' + s.hand.acts[0].t);
  console.log('Sistema con A♠A♥ da UTG:', s.hand.acts[0].t, 'a', s.hand.acts[0].to, '(multiplo di 25:', s.hand.acts[0].to % 25 === 0, ')');
  assert.strictEqual(s.hand.acts[0].to % 25, 0);
  assert.ok(await page.isVisible('#qPanel .qturn'), 'il dealer prosegue con il prossimo giocatore');
  const txt = await page.textContent('#sjPanel'); console.log('pannello Sistema:', txt.replace(/\s+/g, ' ').slice(0, 80));
  assert.ok(!/motivo|migliore|probabilit|A♠|A♥/i.test((await page.textContent('#sjPanel')) + (await page.textContent('#qPanel'))), 'nessun motivo, forza o carta del Sistema a schermo');
  await page.screenshot({ path: '/tmp/claude-0/auto.png' });
  assert.deepStrictEqual(errors, []); console.log('TEST AUTO OK'); await b.close();
})().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
