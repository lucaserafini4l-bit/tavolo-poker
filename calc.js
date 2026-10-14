// Calcolatore di probabilità + modalità torneo (all-in o fold) per i giocatori.
var CALC = (function () {
  var SUIT_SYM = ['♠', '♥', '♦', '♣'], SUIT_CLS = ['cs', 'ch', 'cd', 'cc'], SUIT_NAME = ['picche', 'cuori', 'quadri', 'fiori'];
  var RANK_TXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var $ = function (id) { return document.getElementById(id); };
  var S = { n: 6, pos: 3, ctx: 'open', shover: null, opp: 5, cards: [null, null, null, null, null, null, null], active: 0, rank: null, suit: null, me: '' };
  var KEY = 'tavolo-poker-calc';
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) { S.n = sv.n || 6; S.pos = sv.pos || 0; S.opp = S.n - 1; S.me = sv.me || ''; $('tStack').value = sv.stack || ''; $('tBB').value = sv.bb || ''; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ n: S.n, pos: S.pos, me: S.me, stack: $('tStack').value, bb: $('tBB').value })); } catch (e) {} }

  // ---------- Nash push/fold tables
  var W = NASH.keys.map(function (k) { return k.length === 2 ? 6 : k[2] === 's' ? 4 : 12; });
  var cache = {};
  function bits(hex) {
    if (cache[hex]) return cache[hex];
    var b = ''; for (var i = 0; i < hex.length; i++) b += ('000' + parseInt(hex[i], 16).toString(2)).slice(-4);
    return (cache[hex] = b.slice(0, 169));
  }
  function inR(hex, key) { return bits(hex)[NASH.keys.indexOf(key)] === '1'; }
  function pctR(hex) { var b = bits(hex), s = 0; for (var i = 0; i < 169; i++) if (b[i] === '1') s += W[i]; return s / 1326 * 100; }
  function sIdx(bb) { var g = NASH.S, best = 0; for (var i = 0; i < g.length; i++) if (Math.abs(g[i] - bb) < Math.abs(g[best] - bb)) best = i; return best; }

  function num(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) && v > 0 ? v : 0; }
  function tour() {
    var stack = num('tStack'), bb = num('tBB');
    if (!stack || !bb) return null;
    var eff = stack, tp = window.TP && TP.state;
    if (tp && S.me !== '') {
      var others = tp.players.filter(function (p, i) { return !p.out && String(i) !== S.me; }).map(function (p) { return p.stack; });
      if (others.length) eff = Math.min(stack, Math.max.apply(null, others));
    }
    return { stack: stack, bb: bb, m: stack / bb, eff: eff / bb };
  }
  function phaseOf(m) { return m >= 15 ? ['Calma', 'phase-calma', 'Gioca poche mani forti, rilancia a 2–2,5 BB.'] : m >= 8 ? ['Attacco', 'phase-attacco', 'Solo all-in o fold.'] : ['Urgenza', 'phase-urgenza', 'All-in con molte più mani: i bui ti stanno mangiando.']; }

  function light(key, n, bbEff) {
    var d = NASH.d[n]; if (!d) return null;
    var si = sIdx(Math.min(20, bbEff)), L = d.length;
    if (inR(d[0][si].p, key)) return ['verde', 'Verde · all-in da qualsiasi posto'];
    var late = Math.max(0, L - 2);
    if (L >= 2 && inR(d[late][si].p, key)) return ['giallo', 'Giallo · all-in dagli ultimi posti'];
    if (inR(d[L - 1][si].p, key)) return ['arancione', 'Arancione · all-in solo da piccolo buio'];
    return ['rosso', 'Rosso · lascia la mano'];
  }

  // ---------- slots & keypad
  var slotEls = [];
  function buildSlots() {
    for (var i = 0; i < 7; i++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.dataset.i = i;
      b.addEventListener('click', onSlot); slotEls.push(b);
      if (i < 2) $('heroSlots').appendChild(b);
      else { if (i === 5 || i === 6) { var g = document.createElement('span'); g.className = 'gap'; $('boardSlots').appendChild(g); } $('boardSlots').appendChild(b); }
    }
  }
  var PH = ['', '', 'Flop', 'Flop', 'Flop', 'Turn', 'River'];
  function renderSlots() {
    slotEls.forEach(function (el, i) {
      var c = S.cards[i];
      el.classList.toggle('filled', c !== null); el.classList.toggle('active', S.active === i);
      if (c === null) { el.innerHTML = '<span class="ph">' + PH[i] + '</span>'; el.setAttribute('aria-label', (i < 2 ? 'Tua carta ' + (i + 1) : PH[i]) + ', vuoto'); }
      else { var r = c >> 2, s = c & 3; el.innerHTML = '<span class="' + SUIT_CLS[s] + '" style="display:grid;justify-items:center"><span class="r">' + RANK_TXT[r] + '</span><span class="su">' + SUIT_SYM[s] + '</span></span>'; el.setAttribute('aria-label', RANK_TXT[r] + ' di ' + SUIT_NAME[s] + ', tocca per cambiare'); }
    });
  }
  function onSlot(e) { var i = +e.currentTarget.dataset.i; S.cards[i] = null; S.active = i; S.rank = S.suit = null; renderAll(); schedule(); }
  var rankEls = [], suitEls = [];
  function buildPad() {
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].forEach(function (r) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'key'; b.textContent = RANK_TXT[r];
      b.addEventListener('click', function () { S.rank = S.rank === r ? null : r; tryPlace(); });
      rankEls[r] = b; $('ranks').appendChild(b);
    });
    [0, 1, 2, 3].forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'key suit ' + SUIT_CLS[s]; b.textContent = SUIT_SYM[s]; b.setAttribute('aria-label', SUIT_NAME[s]);
      b.addEventListener('click', function () { S.suit = S.suit === s ? null : s; tryPlace(); });
      suitEls[s] = b; $('suits').appendChild(b);
    });
    var cl = document.createElement('button'); cl.type = 'button'; cl.className = 'key clear'; cl.textContent = 'Svuota board';
    cl.addEventListener('click', function () { for (var i = 2; i < 7; i++) S.cards[i] = null; S.active = S.cards[0] === null ? 0 : S.cards[1] === null ? 1 : 2; S.rank = S.suit = null; renderAll(); schedule(); });
    $('suits').appendChild(cl);
  }
  function used(c) { return S.cards.indexOf(c) >= 0; }
  function tryPlace() {
    if (S.rank !== null && S.suit !== null) {
      var c = S.rank * 4 + S.suit;
      if (!used(c) && S.active !== null) {
        S.cards[S.active] = c; var next = null;
        for (var k = 1; k <= 7; k++) { var j = (S.active + k) % 7; if (S.cards[j] === null) { next = j; break; } }
        S.active = next; schedule();
      }
      S.rank = S.suit = null;
    }
    renderAll();
  }
  function renderPad() {
    for (var r = 0; r < 13; r++) {
      var all = true; for (var s = 0; s < 4; s++) if (!used(r * 4 + s)) all = false;
      rankEls[r].disabled = all || S.active === null; rankEls[r].setAttribute('aria-pressed', S.rank === r);
    }
    for (s = 0; s < 4; s++) { suitEls[s].disabled = S.active === null || (S.rank !== null && used(S.rank * 4 + s)); suitEls[s].setAttribute('aria-pressed', S.suit === s); }
  }

  // ---------- settings
  function renderSettings() {
    $('nVal').textContent = S.n; $('oVal').textContent = S.opp;
    $('nMinus').disabled = S.n <= 2; $('nPlus').disabled = S.n >= 10;
    $('oMinus').disabled = S.opp <= 1; $('oPlus').disabled = S.opp >= Math.min(9, S.n - 1);
    var pos = ADV.positions(S.n), box = $('posChips');
    if (S.pos >= pos.length) S.pos = pos.length - 1;
    box.innerHTML = '';
    pos.forEach(function (p, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = p; b.setAttribute('aria-pressed', i === S.pos);
      b.addEventListener('click', function () { S.pos = i; S.shover = null; save(); renderAll(); schedule(); }); box.appendChild(b);
    });
    Array.prototype.forEach.call($('ctxChips').children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.ctx === S.ctx);
      b.disabled = (b.dataset.ctx === 'raise' || b.dataset.ctx === 'shove') && S.pos === 0;
    });
    if (S.pos === 0 && (S.ctx === 'raise' || S.ctx === 'shove')) S.ctx = 'open';
    var t = tour(), sg = $('shoverGroup');
    sg.hidden = !(S.ctx === 'shove' || (S.ctx === 'raise' && t && t.m <= 20));
    if (!sg.hidden) {
      sg.firstElementChild.textContent = S.ctx === 'shove' ? 'Chi è andato all-in?' : 'Chi ha rilanciato?';
      var sc = $('shoverChips'); sc.innerHTML = '';
      if (S.shover === null || S.shover >= S.pos) S.shover = S.pos - 1;
      pos.slice(0, S.pos).forEach(function (p, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = p; b.setAttribute('aria-pressed', i === S.shover);
        b.onclick = function () { S.shover = i; renderAll(); schedule(); }; sc.appendChild(b);
      });
    }
    // tournament box
    var tm = $('tMagic');
    tm.hidden = !t;
    if (t) {
      var ph = phaseOf(t.m);
      $('tMagicN').textContent = (Math.round(t.m * 10) / 10).toString().replace('.', ',');
      $('tPhase').textContent = ph[0]; $('tPhase').className = 'ph ' + ph[1]; $('tPhaseTxt').textContent = ph[2];
    }
    // "io sono" select
    var tp = window.TP && TP.state, sel = $('tMe'), opts = '<option value="">—</option>';
    if (tp) tp.players.forEach(function (p, i) { if (!p.out) opts += '<option value="' + i + '"' + (String(i) === S.me ? ' selected' : '') + '>' + p.name.replace(/</g, '&lt;') + '</option>'; });
    if (sel.innerHTML !== opts) sel.innerHTML = opts;
    sel.value = S.me;
  }
  $('nMinus').onclick = function () { S.n--; S.opp = Math.min(S.opp, S.n - 1); save(); renderAll(); schedule(); };
  $('nPlus').onclick = function () { var full = S.opp === S.n - 1; S.n++; if (full) S.opp = Math.min(9, S.n - 1); save(); renderAll(); schedule(); };
  $('oMinus').onclick = function () { S.opp--; renderAll(); schedule(); };
  $('oPlus').onclick = function () { S.opp++; renderAll(); schedule(); };
  Array.prototype.forEach.call($('ctxChips').children, function (b) { b.onclick = function () { S.ctx = b.dataset.ctx; renderAll(); schedule(); }; });
  ['pot', 'call'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['tStack', 'tBB'].forEach(function (id) { $(id).addEventListener('input', function () { save(); renderAll(); schedule(); }); });
  $('tMe').onchange = function () { S.me = $('tMe').value; save(); syncFromTable(); };

  // Pull seats, stack and blinds from the dealer screen on this device.
  function syncFromTable() {
    var tp = window.TP && TP.state;
    if (tp && S.me !== '' && tp.players[+S.me] && !tp.players[+S.me].out) {
      var i = +S.me, alive = DL.alive(tp).length, names = DL.positionNames(tp), lab = names[i];
      S.n = Math.max(2, alive); S.opp = Math.max(1, alive - 1);
      var idx = ADV.positions(S.n).indexOf(lab); if (idx >= 0) S.pos = idx;
      $('tStack').value = tp.players[i].stack + (tp.hand && tp.hand.bets[tp.players[i].id] ? tp.hand.bets[tp.players[i].id].total : 0);
    } else if (tp && S.me !== '') { S.me = ''; }
    if (tp && (!$('tBB').value || S.me !== '')) $('tBB').value = (tp.hand ? tp.hand.bb : DL.levelBlinds(tp).bb);
    save(); renderAll(); schedule();
  }
  if (window.TP) TP.onChange(function () { if (S.me !== '') syncFromTable(); });

  $('newhand').onclick = function () {
    S.cards = [null, null, null, null, null, null, null]; S.active = 0; S.rank = S.suit = null; S.ctx = 'open'; S.shover = null;
    S.opp = Math.min(9, S.n - 1);
    if (window.TP && S.me !== '') syncFromTable();
    else { var L = ADV.positions(S.n).length; S.pos = (S.pos - 1 + L) % L; }
    $('pot').value = ''; $('call').value = ''; save(); renderAll(); schedule();
  };

  // ---------- compute
  var timer = null, gen = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(compute, 40); }
  function compute() {
    var g = ++gen;
    var hero = S.cards.slice(0, 2), board = S.cards.slice(2).filter(function (c) { return c !== null; });
    var pot = num('pot'), call = num('call');
    $('ctxGroup').style.opacity = board.length === 0 ? 1 : 0.45;
    if (hero[0] === null || hero[1] === null) { $('tLight').hidden = true; return idle('Scegli le carte', 'Inserisci le tue due carte per ricevere il consiglio.'); }
    if (board.length > 0 && board.length < 3) return idle('Completa il flop', 'Servono tutte e tre le carte del flop.');
    if (board.length === 0) return showPreflop(hero, pot, call);
    var total = Math.max(8000, Math.min(60000, Math.round(320000 / (S.opp + 1)))), chunk = 4000, done = 0, acc = { win: 0, tie: 0, equity: 0 };
    var o = board.length < 5 ? PE.outs(hero, board) : null;
    $('streetLbl').textContent = streetName(board.length) + ' · calcolo…';
    (function step() {
      if (g !== gen) return;
      var n = Math.min(chunk, total - done), r = PE.equity(hero, board, S.opp, n);
      acc.win += r.win * n; acc.tie += r.tie * n; acc.equity += r.equity * n; done += n;
      showPostflop(hero, board, { win: acc.win / done, tie: acc.tie / done, equity: acc.equity / done, iters: done }, o, pot, call, done >= total);
      if (done < total) setTimeout(step, 0);
    })();
  }
  function streetName(n) { return n === 0 ? 'Pre-flop' : n === 3 ? 'Flop' : n === 4 ? 'Turn' : 'River'; }
  function idle(label, why) {
    $('streetLbl').textContent = streetName(S.cards.slice(2).filter(function (c) { return c !== null; }).length);
    setAction('idle', label); $('size').textContent = ''; $('why').textContent = why;
    $('eqVal').textContent = '—'; $('eqSub').textContent = ''; $('stats').innerHTML = '';
    meter(0, null, null); $('made').hidden = true; $('outs').hidden = true; $('podds').hidden = true;
  }
  function setAction(cls, label) { var a = $('action'); a.className = 'action ' + cls + (label.length > 12 ? ' long' : ''); a.textContent = label; }
  function meter(e, fair, need) {
    $('meterFill').style.width = (e * 100).toFixed(1) + '%';
    var f = $('meterFair'), n = $('meterNeed');
    f.hidden = fair === null; if (fair !== null) f.style.left = (fair * 100) + '%';
    n.hidden = need === null; $('lgNeed').hidden = need === null; if (need !== null) n.style.left = (need * 100) + '%';
  }
  function stat(label, val) { return '<div class="stat"><span class="lbl">' + label + '</span><b class="num">' + val + '</b></div>'; }
  var fp = ADV.fmtPct;
  function fmtC(x) { return Math.round(x).toLocaleString('it-IT'); }
  function roundChips(x, bb) { var u = bb >= 200 ? 50 : bb >= 80 ? 20 : 10; return Math.max(u, Math.round(x / u) * u); }
  function potOdds(e, pot, call) {
    var box = $('podds');
    if (!(call > 0)) { box.hidden = true; return null; }
    var need = call / (pot + call), ev = e * (pot + call) - call;
    box.hidden = false;
    box.innerHTML = stat('Prob. richiesta', fp(need * 100)) + stat('Quota', (pot / call).toFixed(1).replace('.', ',') + ' : 1') +
      '<div class="stat"><span class="lbl">Guadagno medio</span><b class="num ' + (ev >= 0 ? 'ev-pos' : 'ev-neg') + '">' + (ev >= 0 ? '+' : '−') + ADV.fmtN(Math.abs(ev)) + '</b></div>';
    return need;
  }

  function showPreflop(hero, pot, call) {
    var key = PE.handKey(hero[0], hero[1]);
    var e = PREFLOP[key][S.opp - 1] / 100, fair = 1 / (S.opp + 1);
    var t = tour(), pos = ADV.positions(S.n), me = pos[S.pos];
    var lt = $('tLight');
    if (t && t.m <= 20) {
      var L = light(key, S.n, t.eff);
      lt.hidden = !L; if (L) { lt.className = 'light ' + L[0]; lt.querySelector('span').textContent = L[1]; }
    } else lt.hidden = true;
    var r;
    if (t && t.eff <= 20 && NASH.d[S.n]) r = nashAdvice(key, t, pos, me);
    else {
      r = ADV.preflop(key, S.n, S.pos, S.ctx === 'shove' ? 'raise' : S.ctx);
      if (t && r.act === 'raise' && S.ctx === 'open') r.size = 'Rilancia a ' + fmtC(roundChips(2.2 * t.bb, t.bb)) + ' (2,2 BB)';
      if (t && r.act === 'raise' && S.ctx === 'limp') r.size = 'Rilancia a ' + fmtC(roundChips(3 * t.bb, t.bb)) + ' + ' + fmtC(t.bb) + ' per ogni limper';
      if (t && r.label === '3-Bet') r.size = 'Rilancia a circa 3 volte la sua puntata (4 volte se parli prima di lui dopo il flop)';
    }
    $('streetLbl').textContent = 'Pre-flop · ' + key + ' da ' + me;
    setAction(r.act, r.label); $('size').textContent = r.size || ''; $('why').textContent = r.why;
    $('eqVal').textContent = fp(e * 100); $('eqSub').textContent = 'contro ' + S.opp + (S.opp === 1 ? ' avversario' : ' avversari');
    var need = potOdds(e, pot, call);
    meter(e, fair, need);
    $('stats').innerHTML = stat('Classifica mano', 'Top ' + fp(ADV.PCT[key])) + stat('Quota equa', fp(fair * 100)) + stat('Testa a testa', fp(PREFLOP[key][0]));
    $('made').hidden = true; $('outs').hidden = true;
  }

  function nashAdvice(key, t, pos, me) {
    var d = NASH.d[S.n], si = sIdx(t.eff), sTxt = NASH.S[si] + ' BB', all = 'Metti tutte le tue ' + fmtC(t.stack) + ' fiches';
    var bbTxt = (Math.round(t.eff * 10) / 10).toString().replace('.', ',');
    if (S.ctx === 'open' || S.ctx === 'limp') {
      if (me === 'BB') {
        var tight = d[0][si].p;
        if (inR(tight, key)) return { act: 'raise', label: 'All-in', size: all, why: 'Sei in grande buio e chi è entrato ha solo pagato: con ' + key + ' vai all-in, è tra le mani più forti a ' + bbTxt + ' BB.' };
        return { act: 'check', label: 'Check', why: 'Sei in grande buio: guarda il flop senza aggiungere fiches.' };
      }
      var spot = d[S.pos][si].p, pr = pctR(spot);
      if (inR(spot, key)) return { act: 'raise', label: 'All-in', size: all, why: 'Con ' + bbTxt + ' BB da ' + me + ' si va all-in con il ' + fp(pr) + ' delle mani' + (S.ctx === 'limp' ? ' (chi ha solo pagato di solito non ha una mano forte)' : '') + ': ' + key + ' è dentro.' };
      return { act: 'fold', label: 'Fold', why: 'Con ' + bbTxt + ' BB da ' + me + ' si va all-in solo con il ' + fp(pr) + ' delle mani: ' + key + ' resta fuori. Aspetta una posizione migliore.' };
    }
    var sh = S.shover === null ? S.pos - 1 : S.shover, ci = S.pos - sh - 1;
    var cr = d[sh] && d[sh][si].c[ci];
    if (!cr) return { act: 'fold', label: 'Fold', why: 'Combinazione di posizioni non disponibile.' };
    var cp = pctR(cr), inC = inR(cr, key);
    if (S.ctx === 'shove') {
      if (inC) return { act: 'call', label: 'Chiama', size: 'Chiama l’all-in', why: 'Contro un all-in da ' + pos[sh] + ' con ' + sTxt + ' si chiama con il ' + fp(cp) + ' delle mani: ' + key + ' è abbastanza forte.' };
      return { act: 'fold', label: 'Fold', why: 'Contro un all-in da ' + pos[sh] + ' si chiama solo con il ' + fp(cp) + ' delle mani: ' + key + ' non basta.' };
    }
    if (inC) return { act: 'raise', label: 'All-in', size: all, why: 'Con poche fiches non si chiama un rilancio: o tutto o niente. ' + key + ' è tra le mani che reggono contro ' + pos[sh] + ' (top ' + fp(cp) + ').' };
    return { act: 'fold', label: 'Fold', why: 'Contro un rilancio da ' + pos[sh] + ' con ' + bbTxt + ' BB si va all-in solo con il top ' + fp(cp) + ': ' + key + ' resta fuori.' };
  }

  function showPostflop(hero, board, res, o, pot, call, final) {
    var street = board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
    var r = ADV.postflop(res.equity, S.opp, street, pot, call, o), d = ADV.describe(hero, board), t = tour();
    // short stacks: commit fully instead of small bets / calls
    if (t && pot > 0) {
      var spr = t.stack / pot;
      if (r.act === 'raise' && spr < 3) { r.label = 'All-in'; r.size = 'Le tue fiches (' + fmtC(t.stack) + ') valgono meno di 3 volte il piatto: metti tutto.'; }
      else if (r.act === 'call' && call >= t.stack * 0.4) { r.label = 'All-in'; r.size = 'Chiamando metteresti quasi metà delle tue fiches: vai direttamente all-in.'; }
    }
    $('tLight').hidden = true;
    $('streetLbl').textContent = streetName(board.length) + (final ? ' · ' + res.iters.toLocaleString('it-IT') + ' simulazioni' : ' · calcolo…');
    setAction(r.act, r.label); $('size').textContent = r.size || ''; $('why').textContent = r.why;
    $('eqVal').textContent = fp(res.equity * 100); $('eqSub').textContent = 'contro ' + S.opp + (S.opp === 1 ? ' avversario' : ' avversari');
    var need = potOdds(res.equity, pot, call);
    meter(res.equity, r.fair, need);
    $('stats').innerHTML = stat('Vinci', fp(res.win * 100)) + stat('Pareggi', fp(res.tie * 100)) + stat('Quota equa', fp(r.fair * 100));
    $('made').hidden = false; $('made').textContent = d.text;
    var ob = $('outs');
    if (o && (o.strong.length || o.weak.length)) {
      ob.hidden = false;
      var mini = function (c) { return '<span class="mini ' + SUIT_CLS[c & 3] + '">' + RANK_TXT[c >> 2] + SUIT_SYM[c & 3] + '</span>'; };
      var html = '';
      if (o.strong.length) html += '<div><b>' + o.strong.length + ' carte che ti danno un punto forte</b>: ' + fp(o.pStrongNext * 100) + ' alla prossima carta' + (street === 'flop' ? ', ' + fp(o.pStrongRiver * 100) + ' entro il river' : '') + '</div><div class="list">' + o.strong.map(mini).join('') + '</div>';
      if (o.weak.length) html += '<div class="calcsmall">+ ' + o.weak.length + ' carte che ti danno coppia o doppia coppia: ' + o.weak.map(function (c) { return RANK_TXT[c >> 2] + SUIT_SYM[c & 3]; }).join(' ') + '</div>';
      ob.innerHTML = html;
    } else ob.hidden = true;
  }

  function renderAll() { renderSettings(); renderSlots(); renderPad(); }
  buildSlots(); buildPad(); renderAll();
  S.cards[0] = 12 * 4 + 1; S.cards[1] = 11 * 4 + 1; S.active = 2; renderAll(); compute();
  return { syncFromTable: syncFromTable };
})();
