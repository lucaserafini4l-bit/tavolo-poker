// Banco di prova del collegamento app <-> Sistema Jev (serve il server acceso: python live/server_tavolo.py).
// Gioca tornei completi con la logica vera del dealer (dealer.js): 5 giocatori finti + il Sistema al posto JEV.
// Controlla: fiches conservate, decisioni sempre presenti e regolari, importi coerenti con lo stato dell'app.
//   node test_sistema.js [tornei] [porta]
const DL = require('./dealer.js'), PE = require('./engine.js'), assert = require('assert');
const N = +(process.argv[2] || 3), PORT = +(process.argv[3] || 8765), URL = 'http://127.0.0.1:' + PORT;
const JEV = 2;
let seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
async function api(path, body) {
  const r = await fetch(URL + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  return r.json();
}
const stats = { decisioni: 0, fold: 0, call: 0, raise: 0, allin: 0, mani: 0, tornei: 0, vinti: 0, posti: [], errori: [], ms: [] };

function roundOver(st, actedSince) {
  const h = st.hand, max = DL.maxStreet(st);
  const live = st.players.map((p, i) => i).filter(i => { const b = h.bets[st.players[i].id]; return b && !b.folded && !b.allin; });
  const inHand = DL.inHand(st);
  if (inHand.length <= 1) return true;
  if (live.length === 1) return h.bets[st.players[live[0]].id].street >= max;   // nessuno contro cui puntare
  return live.every(i => actedSince.has(i) && h.bets[st.players[i].id].street === max);
}
function botMove(st, i) {             // giocatori finti: semplici ma imprevedibili
  const h = st.hand, b = h.bets[st.players[i].id], tc = DL.maxStreet(st) - b.street, p = st.players[i], x = rnd();
  if (tc > 0 && x < 0.30) return ['fold'];
  if (x < 0.85) return ['call'];
  if (x < 0.97) { const to = Math.min(p.stack + b.street, DL.minRaiseTo(st) + Math.floor(rnd() * 3) * h.bb); return to >= p.stack + b.street ? ['allin'] : ['raise', to]; }
  return ['allin'];
}
async function playHand(st, deck) {
  const h = st.hand; let k = 0;
  const hole = {}; st.players.forEach((p, i) => { if (!p.out) hole[i] = [deck[k++], deck[k++]]; });
  const board = deck.slice(k, k + 5);
  await api('/api/stato', { st });
  if (hole[JEV]) assert.ok((await api('/api/carte', { carte: hole[JEV] })).ok);
  for (let street = 0; street < 4; street++) {
    if (street > 0) { DL.nextStreet(st); }
    // carte in tavola: nelle mani pari dalla griglia del dealer, nelle dispari dal telefono del Sistema
    if (h.no % 2 === 0) h.board = board.slice(0, [0, 3, 4, 5][street]);
    else await api('/api/board', { carte: board.slice(0, [0, 3, 4, 5][street]) });
    const acted = new Set(); let guard = 0;
    while (true) {
      const mine = roundOver(st, acted), theirs = DL.roundComplete(st);
      // controllo incrociato: la logica del cambio fase automatico deve coincidere con questa, indipendente
      assert.strictEqual(theirs, mine, `roundComplete diverso (mano ${h.no}, fase ${street}): app ${theirs}, banco ${mine}`);
      stats.controlli = (stats.controlli || 0) + 1;
      if (mine || h.toAct == null || guard++ >= 200) break;
      const i = h.toAct, before = DL.maxStreet(st);
      await api('/api/stato', { st });
      if (i === JEV) {
        const t0 = Date.now(); const d = await api('/api/decisione'); stats.ms.push(Date.now() - t0);
        if (d.stato !== 'decisione') { stats.errori.push('mano ' + h.no + ': ' + d.stato + ' ' + d.testo); throw new Error(d.testo); }
        const b = h.bets[st.players[i].id], p = st.players[i], tc = Math.min(p.stack, before - b.street);
        assert.strictEqual(d.da_chiamare, tc, 'da chiamare');
        assert.strictEqual(d.piatto, DL.potTotal(st), 'piatto');
        assert.ok(!('motivo' in d), 'il motivo non deve uscire durante la mano');
        stats.decisioni++; stats[d.azione]++;
        if (process.env.CONSIGLIERE) {
          // il consigliere riceve solo quello che un giocatore vede e digita (stili "non so")
          const order = []; { const sx = DL.seats(st); let q = sx.firstPre; while (order.length < DL.alive(st).length) { order.push(q); q = DL.nextAlive(st, q); } }
          const nr = (h.acts || []).filter(a => a.s === h.street && a.up).length;
          const x = { carte: hole[i], tavolo: (h.board && h.board.length ? h.board : board.slice(0, [0, 3, 4, 5][street])), giocatori: DL.alive(st).length,
            posizione: order.indexOf(i), bb: h.bb, sb: h.sb, stack: p.stack, piatto: DL.potTotal(st), da_chiamare: tc, gia_puntato: b.street,
            avversari: DL.inHand(st).length - 1, rilanci: Math.min(nr, 3), fiche: 25, parametri: process.env.PARAMETRI || 'auto' };
          const c1 = await api('/api/consiglio', x), c2 = await api('/api/consiglio', x);
          const cat = a => a === 'allin' ? 'raise' : a;           // all-in conta come rilancio
          stats.cons = stats.cons || { n: 0, uguali: 0, uguali_cat: 0, stesso_due_volte: 0, diff: {} };
          stats.cons.n++; if (c1.azione === d.azione) stats.cons.uguali++; if (cat(c1.azione) === cat(d.azione)) stats.cons.uguali_cat++;
          if (c1.azione === c2.azione) stats.cons.stesso_due_volte++;
          if (cat(c1.azione) !== cat(d.azione)) { const k = d.azione + '->' + c1.azione + (h.street ? ' postflop' : ' preflop'); stats.cons.diff[k] = (stats.cons.diff[k] || 0) + 1; }
        }
        if (d.azione === 'raise') {
          assert.ok(d.a >= DL.minRaiseTo(st), `rilancio sotto il minimo: ${d.a} < ${DL.minRaiseTo(st)}`);
          assert.ok(d.a < p.stack + b.street, 'rilancio oltre lo stack');
          DL.act(st, i, 'raise', d.a);
        } else if (d.azione === 'allin') DL.act(st, i, 'allin');
        else if (d.azione === 'fold') { assert.ok(tc > 0, 'fold quando poteva fare check'); DL.act(st, i, 'fold'); }
        else DL.act(st, i, 'call');
      } else { const m = botMove(st, i); DL.act(st, i, m[0], m[1]); }
      if (DL.maxStreet(st) > before) acted.clear();
      acted.add(i);
    }
    if (DL.inHand(st).length <= 1) break;
  }
  // showdown con il valutatore dell'app
  const pots = DL.pots(st), id2i = {}; st.players.forEach((p, i) => id2i[p.id] = i);
  const score = id => PE.evaluate(hole[id2i[id]].concat(board), 7);
  const winners = pots.map(pot => { const best = Math.max(...pot.eligible.map(score)); return pot.eligible.filter(id => score(id) === best); });
  DL.award(st, winners);
  stats.mani++;
  assert.strictEqual(DL.totals(st).chips, st.cfg.startStack * st.players.length, 'fiches non conservate');
  await api('/api/stato', { st });
}
(async () => {
  for (let t = 0; t < N; t++) {
    const st = DL.newTournament({ names: ['Anna', 'Bruno', 'Sistema', 'Dario', 'Elisa', 'Fede'], startStack: 1000 });
    st.cfg.jevSeat = JEV; st.button = t % 6;
    let hands = 0;
    while (DL.alive(st).length > 1 && hands < 400) {
      st.timer.level = Math.min(4, Math.floor(hands / 5));                 // ~5 mani per livello
      DL.startHand(st, { keepButton: hands === 0 });
      const deck = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      await playHand(st, deck); hands++;
    }
    const place = st.players[JEV].place || 1;
    stats.tornei++; stats.posti.push(place); if (place === 1) stats.vinti++;
    console.log(`torneo ${t + 1}: ${hands} mani, Sistema ${place}°, letture registrate: ${(await api('/api/sistema')).letture.length}`);
  }
  const ms = stats.ms.sort((a, b) => a - b);
  console.log('controlli incrociati del cambio fase:', stats.controlli);
  if (stats.cons) console.log('CONSIGLIERE vs SISTEMA:', JSON.stringify(stats.cons));
  console.log(JSON.stringify({ tornei: stats.tornei, mani: stats.mani, decisioni: stats.decisioni, fold: stats.fold, call: stats.call, raise: stats.raise, allin: stats.allin,
    vinti: stats.vinti, posto_medio: (stats.posti.reduce((a, b) => a + b, 0) / stats.posti.length).toFixed(2),
    tempo_decisione_ms: { mediana: ms[ms.length >> 1], p95: ms[Math.floor(ms.length * 0.95)] }, errori: stats.errori.length }));
  console.log('TEST SISTEMA OK');
})().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
