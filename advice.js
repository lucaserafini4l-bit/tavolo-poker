// Decision logic (pure functions). Depends on PE and PREFLOP table.
var ADV = (function () {
  var PE_ = typeof PE !== 'undefined' ? PE : require('./engine.js');
  var T = typeof PREFLOP !== 'undefined' ? PREFLOP : require('./preflop.json');
  var RANKS = PE_.RANKS;
  var NAMES_PL = ['Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci', 'Jack', 'Donne', 'Re', 'Assi'];
  var NAMES_SG = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  // Ranking of the 169 starting hands: blend of equity vs 1, 3 and 6 random opponents,
  // each normalised by the fair share. Percentile = cumulative share of the 1326 combos.
  function combos(k) { return k.length === 2 ? 6 : k[2] === 's' ? 4 : 12; }
  // Playability bonus: raw equity undervalues pocket pairs (set value) and suited connectors.
  function score(k) {
    var e = T[k], base = (e[0] / 50 + e[2] / 25 + e[5] / (100 / 7)) / 3;
    if (k.length === 2) return base + PAIR_B;
    if (k[2] === 's') { var gap = RANKS.indexOf(k[0]) - RANKS.indexOf(k[1]) - 1; base += SUIT_B + (gap === 0 ? CONN_B : gap === 1 ? CONN_B / 2 : 0); }
    return base;
  }
  var PAIR_B = 0.10, SUIT_B = 0.0, CONN_B = 0.05;
  var order = Object.keys(T).sort(function (a, b) { return score(b) - score(a); });
  var PCT = {}, cum = 0;
  order.forEach(function (k) { cum += combos(k); PCT[k] = cum / 1326 * 100; });

  // Opening range (% of hands) by number of players still to act behind you, unopened pot.
  // Anchored to standard solver-style RFI ranges: BTN ~45%, CO ~27%, HJ ~20%, LJ ~16%, UTG 9-max ~11%.
  var RFI = { 1: 40, 2: 45, 3: 27, 4: 20, 5: 16, 6: 14, 7: 12, 8: 11, 9: 10 };

  function positions(n) {
    if (n === 2) return ['SB/BTN', 'BB'];
    var k = n - 2, late = ['LJ', 'HJ', 'CO', 'BTN'], nb;
    if (k <= 4) { nb = late.slice(4 - k); if (k >= 2) nb[0] = 'UTG'; }
    else { nb = []; for (var i = 0; i < k - 4; i++) nb.push(i === 0 ? 'UTG' : 'UTG+' + i); nb = nb.concat(late); }
    return nb.concat(['SB', 'BB']);
  }
  function behind(n, idx) { return positions(n).length - 1 - idx; }

  function fmtPct(x) { return (x < 10 ? x.toFixed(1) : Math.round(x)) + '%'; }

  // ctx: 'open' (nobody entered), 'limp', 'raise'
  function preflop(key, n, posIdx, ctx) {
    var pct = PCT[key], pos = positions(n), p = pos[posIdx], bh = behind(n, posIdx);
    var isBB = p === 'BB', isPair = key.length === 2, isSuited = key[2] === 's';
    var rfi = RFI[Math.min(9, Math.max(1, bh))];
    var top = 'top ' + fmtPct(pct);
    if (ctx === 'open' && isBB) ctx = 'limp';
    var r;
    if (ctx === 'open') {
      if (n === 2 || p === 'SB/BTN') rfi = 80;
      if (pct <= rfi) r = { act: 'raise', label: 'Rilancia', size: 'Apri a 2,5–3 BB',
        why: key + ' è nel ' + top + ' delle mani. Da ' + p + ' si apre circa il top ' + rfi + '%.' };
      else r = { act: 'fold', label: 'Fold', why: key + ' è nel ' + top + ': fuori dal range di apertura da ' + p + ' (top ' + rfi + '%).' };
    } else if (ctx === 'limp') {
      var iso = Math.max(5, rfi * 0.55);
      if (pct <= iso) r = { act: 'raise', label: 'Rilancia', size: '3–4 BB + 1 BB per ogni limper',
        why: key + ' (' + top + ') è abbastanza forte per isolare i limper.' };
      else if (isBB) r = { act: 'check', label: 'Check', why: 'Sei in BB: vedi il flop gratis. ' + key + ' (' + top + ') non vale un rilancio.' };
      else if (pct <= rfi * 1.2 && (isPair || isSuited)) r = { act: 'call', label: 'Chiama', size: 'Limp dietro',
        why: key + ' è una mano speculativa: con più giocatori nel piatto il prezzo è buono per cercare tris, colore o scala.' };
      else r = { act: 'fold', label: 'Fold', why: key + ' (' + top + ') non è abbastanza forte né speculativa per entrare da ' + p + '.' };
    } else {
      var callT = isBB ? 18 : (p === 'BTN' || p === 'CO' || p === 'SB/BTN') ? 10 : 7;
      if (pct <= 4.3) r = { act: 'raise', label: '3-Bet', size: '3× il rilancio (4× se sei fuori posizione)',
        why: key + ' è nel ' + top + ': rilancia per valore.' };
      else if (pct <= callT) r = { act: 'call', label: 'Chiama',
        why: key + ' (' + top + ') regge un rilancio da ' + p + ', ma non vale un 3-bet.' };
      else r = { act: 'fold', label: 'Fold', why: 'Contro un rilancio da ' + p + ' si continua con circa il top ' + callT + '%. ' + key + ' è nel ' + top + '.' };
    }
    r.pct = pct; r.pos = p; r.rfi = rfi;
    return r;
  }

  // Describe hero's made hand relative to the board.
  function describe(hero, board) {
    var all = hero.concat(board), sc = PE_.evaluate(all, all.length), cat = PE_.category(sc);
    var main = (sc >> 16) & 15, sec = (sc >> 12) & 15;
    var bRanks = board.map(function (c) { return c >> 2; }).sort(function (a, b) { return b - a; });
    var hR = [hero[0] >> 2, hero[1] >> 2];
    var txt;
    switch (cat) {
      case 0: txt = 'Carta alta ' + NAMES_SG[main]; break;
      case 1:
        txt = 'Coppia di ' + NAMES_PL[main];
        if (hR[0] === hR[1] && main === hR[0] && main > bRanks[0]) txt = 'Overpair (' + NAMES_PL[main] + ')';
        else if (hR[0] === hR[1] && main === hR[0]) txt = 'Coppia in mano (' + NAMES_PL[main] + ') sotto il board';
        else if (hR.indexOf(main) < 0) txt = 'Coppia sul board: giochi le carte alte';
        else if (main === bRanks[0]) { var k = hR[0] === main ? hR[1] : hR[0]; txt = 'Top pair (' + NAMES_PL[main] + '), kicker ' + NAMES_SG[k]; }
        else if (main === bRanks[bRanks.length - 1]) txt = 'Bottom pair (' + NAMES_PL[main] + ')';
        else txt = 'Middle pair (' + NAMES_PL[main] + ')';
        break;
      case 2: txt = 'Doppia coppia: ' + NAMES_PL[main] + ' e ' + NAMES_PL[sec]; break;
      case 3: txt = (hR[0] === hR[1] && hR[0] === main ? 'Set di ' : 'Tris di ') + NAMES_PL[main]; break;
      case 4: txt = 'Scala al ' + NAMES_SG[sc & 15]; break;
      case 5: txt = 'Colore, carta alta ' + NAMES_SG[main]; break;
      case 6: txt = 'Full: ' + NAMES_PL[main] + ' e ' + NAMES_PL[sec]; break;
      case 7: txt = 'Poker di ' + NAMES_PL[main]; break;
      default: txt = 'Scala colore';
    }
    if (board.length === 5 && PE_.evaluate(board, 5) === sc) txt += ' (giochi il board)';
    return { cat: cat, text: txt };
  }

  // Postflop decision. e = equity 0..1 vs nOpp random hands. pot = pot before your call
  // (including opponents' bets), call = amount to call (0 = nobody bet). o = outs object or null.
  function postflop(e, nOpp, street, pot, call, o) {
    var fair = 1 / (nOpp + 1), R = e / fair;
    var tier = R >= 1.6 ? 'value' : R >= 1.15 ? 'medium' : 'weak';
    var strongOuts = o ? o.strong.length : 0;
    var r = { tier: tier, fair: fair, R: R };
    var hasPot = pot > 0;
    if (!(call > 0)) {
      if (tier === 'value' && o && strongOuts >= 8 && o.currentCat <= 1) r = Object.assign(r, { act: 'raise', label: 'Punta (semi-bluff)',
        size: hasPot ? 'Circa ' + fmtN(pot * 0.6) + ' (60% del piatto)' : '50–75% del piatto',
        why: 'Non hai ancora punto, ma con ' + strongOuts + ' outs forti hai il ' + fmtPct(e * 100) + ' di equity (quota equa ' + fmtPct(fair * 100) + '): punta e fai foldare le mani migliori della tua.' });
      else if (tier === 'value') r = Object.assign(r, { act: 'raise', label: 'Punta',
        size: hasPot ? 'Circa ' + fmtN(pot * 0.6) + ' (60% del piatto)' : '50–75% del piatto',
        why: 'Equity ' + fmtPct(e * 100) + ' contro una quota equa del ' + fmtPct(fair * 100) + ': sei favorito, fai pagare le mani peggiori.' });
      else if (tier === 'medium') r = Object.assign(r, { act: 'check', label: 'Check o puntata piccola',
        size: hasPot ? 'Se punti: circa ' + fmtN(pot / 3) + ' (1/3 del piatto)' : 'Se punti: 1/3 del piatto',
        why: 'Sei leggermente sopra la quota equa (' + fmtPct(fair * 100) + '): controlla la dimensione del piatto.' });
      else if (strongOuts >= 8 && street !== 'river') r = Object.assign(r, { act: 'check', label: 'Check o semi-bluff',
        why: 'Mano debole ora, ma hai ' + strongOuts + ' outs forti: una puntata può far foldare gli avversari e hai ancora carte per migliorare.' });
      else r = Object.assign(r, { act: 'check', label: 'Check', why: 'Equity ' + fmtPct(e * 100) + ' sotto la quota equa (' + fmtPct(fair * 100) + '): non costruire il piatto.' });
      return r;
    }
    var need = call / (pot + call), ev = e * (pot + call) - call;
    r.need = need; r.ev = ev;
    var drawing = o && strongOuts >= 8 && o.currentCat <= 1;
    if (tier === 'value' && e > need && drawing) r = Object.assign(r, { act: 'raise', label: 'Rilancia (semi-bluff)',
      size: 'Circa ' + fmtN(call * 3) + ' (3× la puntata)',
      why: 'Non hai ancora punto, ma con ' + strongOuts + ' outs forti la tua equity (' + fmtPct(e * 100) + ') supera il ' + fmtPct(need * 100) + ' richiesto: il rilancio vince subito o ti lascia comunque ben piazzato.' });
    else if (tier === 'value' && e > need) r = Object.assign(r, { act: 'raise', label: 'Rilancia',
      size: 'Circa ' + fmtN(call * 3) + ' (3× la puntata)',
      why: 'Equity ' + fmtPct(e * 100) + ' contro il ' + fmtPct(need * 100) + ' richiesto dal prezzo: sei favorito, rilancia per valore.' });
    else if (e >= need + 0.05) r = Object.assign(r, { act: 'call', label: 'Chiama',
      why: 'Il prezzo richiede il ' + fmtPct(need * 100) + ' di equity, tu hai il ' + fmtPct(e * 100) + '. Chiamata con valore atteso positivo.' });
    else if (e >= need) r = Object.assign(r, { act: 'call', label: 'Chiamata al limite',
      why: 'Equity ' + fmtPct(e * 100) + ' appena sopra il ' + fmtPct(need * 100) + ' richiesto. Chi punta di solito ha più di una mano casuale: fold se l’avversario è tight.' });
    else {
      var implied = street !== 'river' && e > 0 ? call / e - pot - call : 0;
      r = Object.assign(r, { act: 'fold', label: 'Fold',
        why: 'Servirebbe il ' + fmtPct(need * 100) + ' di equity, hai il ' + fmtPct(e * 100) + '.' +
          (implied > 0 && strongOuts >= 4 ? ' Chiama solo se sei sicuro di vincere almeno altri ' + fmtN(implied) + ' quando chiudi il progetto.' : '') });
    }
    return r;
  }
  function fmtN(x) { return x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10).replace('.', ','); }

  return { PCT: PCT, order: order, positions: positions, behind: behind, preflop: preflop,
    postflop: postflop, describe: describe, fmtPct: fmtPct, fmtN: fmtN, RFI: RFI };
})();
if (typeof module !== 'undefined') module.exports = ADV;
