// Test nel browser (Chromium + Playwright) dell'inserimento rapido del dealer.
//   node test_rapida_browser.js http://127.0.0.1:8801/
const { chromium } = require('playwright');
const assert = require('assert');
const URL = process.argv[2] || 'http://127.0.0.1:8801/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // telefono
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(TP.state)));
  // nuovo torneo pulito
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.click('.nav button[data-view="piatto"]');
  await page.click('#potStart');
  let s = await S();
  assert.ok(s.hand && s.hand.no === 1, 'mano iniziata');
  assert.ok(await page.isVisible('#qPanel'), 'pannello rapido visibile');
  assert.ok(await page.isHidden('#pPlayers'), 'lista classica nascosta');
  const tapQ = async (q) => { await page.click(`#qPanel [data-q="${q}"]`); };
  // pre-flop: UTG rilancia con il pulsante pronto 2,5x, tutti chiamano o foldano
  const first = s.hand.toAct;
  await tapQ('raise');
  const pre = await page.$$eval('#qPanel .qp', els => els.map(e => e.textContent));
  console.log('importi pronti pre-flop:', pre.join(' | '));
  await page.click('#qPanel .qp:nth-child(2)');                 // 2,5x
  s = await S();
  const raiseTo = s.hand.bets[s.players[first].id].street;
  assert.strictEqual(raiseTo % 25, 0, 'rilancio multiplo di 25'); assert.ok(raiseTo >= 80, 'almeno il minimo');
  let taps = 0;
  while ((await S()).hand.street === 0) { await tapQ('call'); taps++; if (taps > 10) throw new Error('il flop non arriva'); }
  s = await S();
  assert.strictEqual(s.hand.street, 1, 'cambio fase automatico al flop'); console.log('flop arrivato da solo dopo', taps, 'chiamate');
  // griglia: 3 tocchi per il flop
  assert.ok(await page.isVisible('#qPanel .qgrid'), 'griglia carte aperta da sola');
  for (const c of [48, 45, 30]) await page.click(`#qPanel .qg[data-c="${c}"]`);   // A♠ Q♥ 9♦
  s = await S(); assert.deepStrictEqual(s.hand.board, [48, 45, 30]);
  assert.ok(await page.isHidden('#qPanel .qgrid'), 'griglia chiusa dopo 3 carte');
  // flop: check, poi una puntata con le fiches (+100 +25) e conferma, poi chiamano
  await tapQ('call');
  await tapQ('raise');
  await page.click('#qPanel [data-add="100"]'); await page.click('#qPanel [data-add="25"]');
  await page.click('#qCustomOk');
  s = await S(); const bettor = s.hand.acts[s.hand.acts.length - 1];
  assert.strictEqual(bettor.t, 'raise'); assert.strictEqual(bettor.to, 125, 'puntata 125 con le fiches');
  taps = 0; while ((await S()).hand.street === 1) { await tapQ('call'); if (++taps > 10) throw new Error('turn non arriva'); }
  s = await S(); assert.strictEqual(s.hand.street, 2); assert.strictEqual(s.hand.board.length, 3);
  await page.click('#qPanel .qg[data-c="0"]'); s = await S(); assert.deepStrictEqual(s.hand.board, [48, 45, 30, 0]);
  // Annulla: torna indietro di un'azione (anche il cambio fase automatico)
  const before = (await S()).hand.acts.length;
  await tapQ('call'); await page.click('#pUndo');
  s = await S(); assert.strictEqual(s.hand.acts.length, before, 'annulla');
  // tutti check fino alla fine: al river compare "Mano finita"
  taps = 0;
  while (!(await page.isVisible('#qPanel .qturn .qname:has-text("Scegli chi vince")'))) {
    s = await S();
    if (s.hand.street === 3 && s.hand.board.length < 5) await page.click('#qPanel .qg[data-c="51"]');
    await tapQ('call'); if (++taps > 20) throw new Error('fine mano non arriva');
  }
  s = await S(); assert.strictEqual(s.hand.street, 3);
  const tot = await page.evaluate(() => DL.totals(TP.state));
  assert.strictEqual(tot.chips, tot.expected, 'fiches conservate');
  // impostazioni: interruttore e fiches
  await page.click('.nav button[data-view="impostazioni"]');
  assert.ok(await page.isVisible('#qkCard'));
  assert.strictEqual(await page.inputValue('#qkChips'), '25, 50, 100, 500, 1000');
  await page.uncheck('#qkOn'); s = await S(); assert.strictEqual(s.cfg.quick, false);
  await page.click('.nav button[data-view="piatto"]');
  assert.ok(await page.isHidden('#qPanel') && await page.isVisible('#pPlayers'), 'modalita classica tornata');
  await page.screenshot({ path: '/tmp/claude-0/classica.png' });
  await page.click('.nav button[data-view="impostazioni"]'); await page.check('#qkOn');
  await page.click('.nav button[data-view="piatto"]');
  await page.screenshot({ path: '/tmp/claude-0/rapida.png', fullPage: true });
  assert.deepStrictEqual(errors, [], 'errori JavaScript: ' + errors.join('; '));
  console.log('TEST BROWSER OK');
  await browser.close();
})().catch(async e => { console.error('ERRORE:', e.message); process.exit(1); });
