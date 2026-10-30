// Tournament / dealer logic. Pure functions on a plain JSON state (easy to save and undo).
var DL = (function () {
  var PRESET_LEVELS = [[20, 40], [40, 80], [60, 120], [80, 160], [100, 200]];
  var PRESET_50 = []; for (var q = 1; q <= 30; q++) PRESET_50.push([50 * q, 100 * q]);

  function defaultPayout(n) {
    if (n <= 4) return [100];
    if (n <= 6) return [65, 35];
    return [50, 30, 20];
  }

  function newTournament(cfg) {
    var names = cfg.names && cfg.names.length ? cfg.names : ['Giocatore 1', 'Giocatore 2', 'Giocatore 3', 'Giocatore 4', 'Giocatore 5', 'Giocatore 6'];
    var start = cfg.startStack || 1000;
    return {
      v: 1,
      cfg: {
        startStack: start,
        levels: (cfg.levels || PRESET_LEVELS).map(function (l) { return [l[0], l[1]]; }),
        minutes: cfg.minutes || 10,
        buyIn: cfg.buyIn == null ? 10 : cfg.buyIn,
        payout: cfg.payout || defaultPayout(names.length),
        trackChips: cfg.trackChips !== false
      },
      players: names.map(function (n, i) { return { id: i, name: n, stack: start, out: false, place: null }; }),
      button: 0,
      timer: { running: false, level: 0, remaining: (cfg.minutes || 10) * 60000, endAt: null },
      hand: null,
      handNo: 0,
      log: []
    };
  }

  function alive(st) { return st.players.filter(function (p) { return !p.out; }); }
  function nextAlive(st, i) {
    var n = st.players.length;
    for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (!st.players[j].out) return j; }
    return i;
  }
  function seats(st) {
    // Dealer, small blind, big blind and first to act pre-flop / post-flop.
    var a = alive(st).length, d = st.players[st.button].out ? nextAlive(st, st.button) : st.button;
    if (a < 2) return { dealer: d, sb: d, bb: d, firstPre: d, firstPost: d };
    if (a === 2) { var o = nextAlive(st, d); return { dealer: d, sb: d, bb: o, firstPre: d, firstPost: o }; }
    var sb = nextAlive(st, d), bb = nextAlive(st, sb);
    return { dealer: d, sb: sb, bb: bb, firstPre: nextAlive(st, bb), firstPost: sb };
  }
  // Position names for the calculator (UTG ... BTN, SB, BB) for every alive seat.
  function positionNames(st) {
    var s = seats(st), a = alive(st).length, names = {};
    if (a < 2) return names;
    if (a === 2) { names[s.dealer] = 'SB/BTN'; names[s.bb] = 'BB'; return names; }
    var order = [], i = s.firstPre;
    while (order.length < a) { order.push(i); i = nextAlive(st, i); }
    var labels = posLabels(a);
    order.forEach(function (idx, k) { names[idx] = labels[k]; });
    return names;
  }
  function posLabels(n) {
    if (n === 2) return ['SB/BTN', 'BB'];
    var k = n - 2, late = ['LJ', 'HJ', 'CO', 'BTN'], nb;
    if (k <= 4) { nb = late.slice(4 - k); if (k >= 2) nb[0] = 'UTG'; }
    else { nb = []; for (var i = 0; i < k - 4; i++) nb.push(i === 0 ? 'UTG' : 'UTG+' + i); nb = nb.concat(late); }
    return nb.concat(['SB', 'BB']);
  }

  function levelBlinds(st, lv) {
    var L = st.cfg.levels, l = L[Math.min(lv == null ? st.timer.level : lv, L.length - 1)];
    return { sb: l[0], bb: l[1] };
  }

  // ---- timer (wall-clock based: survives reloads and background tabs)
  function timerNow(st, now) {
    var t = st.timer, dur = st.cfg.minutes * 60000, changed = 0;
    if (t.running) {
      while (t.endAt - now <= 0) {
        if (t.level < st.cfg.levels.length - 1) { t.level++; changed++; }
        t.endAt += dur;
      }
      t.remaining = t.endAt - now;
    }
    return changed;
  }
  function timerStart(st, now) { var t = st.timer; if (!t.running) { t.running = true; t.endAt = now + t.remaining; } }
  function timerPause(st, now) { var t = st.timer; if (t.running) { t.remaining = Math.max(0, t.endAt - now); t.running = false; t.endAt = null; } }
  function timerSetLevel(st, lv, now) {
    var t = st.timer; t.level = Math.max(0, Math.min(st.cfg.levels.length - 1, lv));
    t.remaining = st.cfg.minutes * 60000; if (t.running) t.endAt = now + t.remaining;
  }
  function timerReset(st, now) { timerSetLevel(st, st.timer.level, now); }

  // ---- hands
  function startHand(st, opts) {
    opts = opts || {};
    if (alive(st).length < 2) return st;
    if (st.handNo > 0 && !opts.keepButton) st.button = nextAlive(st, st.button);
    else if (st.players[st.button].out) st.button = nextAlive(st, st.button);
    st.handNo++;
    var b = levelBlinds(st), s = seats(st);
    var h = { no: st.handNo, sb: b.sb, bb: b.bb, street: 0, bets: {}, toAct: s.firstPre, lastRaise: b.bb, startStacks: {}, done: false,
      dealer: s.dealer, sbSeat: s.sb, bbSeat: s.bb, acts: [] };
    alive(st).forEach(function (p) { h.bets[p.id] = { street: 0, total: 0, folded: false, allin: false }; h.startStacks[p.id] = p.stack; });
    st.hand = h;
    if (st.cfg.trackChips) { put(st, s.sb, b.sb); put(st, s.bb, b.bb); }
    return st;
  }
  function put(st, i, amt) {
    var p = st.players[i], bet = st.hand.bets[p.id];
    var a = Math.max(0, Math.min(amt, p.stack));
    p.stack -= a; bet.street += a; bet.total += a;
    if (p.stack === 0) bet.allin = true;
    return a;
  }
  function maxStreet(st) {
    var m = 0, b = st.hand.bets; for (var k in b) if (b[k].street > m) m = b[k].street; return m;
  }
  function inHand(st) { return alive(st).filter(function (p) { var b = st.hand && st.hand.bets[p.id]; return b && !b.folded; }); }
  function toCall(st, i) { var b = st.hand.bets[st.players[i].id]; return Math.min(st.players[i].stack, maxStreet(st) - b.street); }
  function minRaiseTo(st) { return maxStreet(st) + Math.max(st.hand.lastRaise, st.hand.bb); }

  function advance(st, from) {
    var n = st.players.length;
    for (var k = 1; k <= n; k++) {
      var j = (from + k) % n, p = st.players[j], b = st.hand.bets[p.id];
      if (!p.out && b && !b.folded && !b.allin) { st.hand.toAct = j; return; }
    }
    st.hand.toAct = null;
  }
  // type: fold | call (check if 0) | raise (to = total street amount) | allin
  function act(st, i, type, to) {
    var h = st.hand, p = st.players[i], b = h.bets[p.id];
    if (!h || !b || b.folded) return st;
    var before = maxStreet(st), tc = Math.min(p.stack, before - b.street), stBefore = b.street, lastBefore = h.lastRaise;
    var nr = 0; (h.acts || []).forEach(function (a) { if (a.s === h.street && a.up) nr++; });
    var added = 0;
    if (type === 'fold') b.folded = true;
    else if (type === 'call') added = put(st, i, before - b.street);
    else if (type === 'raise') { added = put(st, i, Math.max(0, to - b.street)); }
    else if (type === 'allin') added = put(st, i, p.stack);
    var after = maxStreet(st);
    if (after > before) h.lastRaise = Math.max(h.lastRaise, after - before);
    // registro delle azioni (statistiche degli avversari per il Sistema Jev): s fase, t tipo, tc da chiamare,
    // nr rilanci gia' fatti nella fase, up = ha alzato la puntata, full = rilancio completo (>= rilancio minimo)
    if (!h.acts) h.acts = [];
    h.acts.push({ i: i, s: h.street, t: type, tc: tc, nr: nr, amt: added, to: b.street, from: stBefore,
      up: after > before, full: after - before >= lastBefore });
    advance(st, i);
    if (inHand(st).length === 1) h.done = true;
    return st;
  }
  function nextStreet(st) {
    var h = st.hand; if (!h || h.street >= 3) return st;
    h.street++;
    for (var k in h.bets) h.bets[k].street = 0;
    h.lastRaise = h.bb;
    var s = seats(st);
    var first = s.firstPost, p = st.players[first], b = h.bets[p.id];
    if (p.out || !b || b.folded || b.allin) advance(st, first); else h.toAct = first;
    return st;
  }

  // Main pot + side pots from total contributions. Folded players' chips stay in, but they can't win.
  function pots(st) {
    var h = st.hand; if (!h) return [];
    var contrib = [];
    for (var k in h.bets) if (h.bets[k].total > 0) contrib.push({ id: +k, amt: h.bets[k].total, folded: h.bets[k].folded });
    var levels = contrib.filter(function (c) { return !c.folded; }).map(function (c) { return c.amt; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var out = [], prev = 0;
    levels.forEach(function (lv) {
      var amount = 0, elig = [];
      contrib.forEach(function (c) { amount += Math.max(0, Math.min(c.amt, lv) - prev); if (!c.folded && c.amt >= lv) elig.push(c.id); });
      if (amount > 0) out.push({ amount: amount, eligible: elig });
      prev = lv;
    });
    // chips from folded players above the highest live level (rare) go to the last pot
    var extra = 0; contrib.forEach(function (c) { if (c.amt > prev) extra += c.amt - prev; });
    if (extra && out.length) out[out.length - 1].amount += extra;
    // an uncalled excess (one eligible player only) is returned, not won: it still goes to that player
    return out;
  }
  function potTotal(st) { var t = 0, h = st.hand; if (!h) return 0; for (var k in h.bets) t += h.bets[k].total; return t; }

  // winners: array (one per pot) of arrays of player ids. Returns list of newly eliminated players.
  function award(st, winners) {
    var h = st.hand, ps = pots(st), byId = {};
    st.players.forEach(function (p, i) { byId[p.id] = i; });
    var s = seats(st), n = st.players.length;
    ps.forEach(function (pot, k) {
      var w = (winners[k] && winners[k].length ? winners[k] : pot.eligible).filter(function (id) { return pot.eligible.indexOf(id) >= 0; });
      if (!w.length) w = pot.eligible;
      // odd chips go to the first winner clockwise from the dealer
      w.sort(function (a, b) { return ((byId[a] - s.dealer + n) % n) - ((byId[b] - s.dealer + n) % n); });
      var share = Math.floor(pot.amount / w.length), rest = pot.amount - share * w.length;
      w.forEach(function (id, j) { st.players[byId[id]].stack += share + (j < rest ? 1 : 0); });
    });
    st.log.push({ hand: h.no, pots: ps.map(function (p, k) { return { amount: p.amount, winners: winners[k] || p.eligible }; }) });
    // archivio compatto delle mani finite (per le statistiche del Sistema Jev)
    if (!st.hands) st.hands = [];
    st.hands.push({ no: h.no, sb: h.sb, bb: h.bb, dealer: h.dealer, players: Object.keys(h.bets).map(Number), acts: h.acts || [] });
    st.hand = null;
    return eliminate(st, h.startStacks);
  }
  function eliminate(st, startStacks) {
    var aliveBefore = alive(st).length;
    var busted = st.players.filter(function (p) { return !p.out && p.stack <= 0; });
    busted.sort(function (a, b) { return (startStacks[a.id] || 0) - (startStacks[b.id] || 0); }); // smaller stack busts "first"
    busted.forEach(function (p, k) { p.out = true; p.stack = 0; p.place = aliveBefore - k; });
    var left = alive(st);
    if (left.length === 1) left[0].place = 1;
    return busted;
  }
  function setStack(st, i, v) {
    var p = st.players[i]; p.stack = Math.max(0, Math.round(v));
    if (p.stack === 0 && !p.out) { var a = alive(st).length; p.out = true; p.place = a; var left = alive(st); if (left.length === 1) left[0].place = 1; }
    return st;
  }
  function revive(st, i, stack) {
    var p = st.players[i]; if (!p.out) return st;
    // shift places of players eliminated after (better place than) this one
    st.players.forEach(function (q) { if (q.out && q.place != null && q.place > p.place) q.place--; });
    p.out = false; p.place = null; p.stack = stack;
    st.players.forEach(function (q) { if (!q.out) q.place = null; });
    return st;
  }

  function totals(st) {
    var chips = 0; st.players.forEach(function (p) { chips += p.stack; });
    chips += potTotal(st);
    var a = alive(st);
    return { chips: chips, expected: st.cfg.startStack * st.players.length, alive: a.length, avg: a.length ? chips / a.length : 0 };
  }
  function prizes(st) {
    var pool = st.cfg.buyIn * st.players.length, pay = st.cfg.payout, sum = 0;
    pay.forEach(function (x) { sum += x; });
    return pay.map(function (pct, i) { return { place: i + 1, pct: pct, amount: sum ? Math.round(pool * pct / sum * 100) / 100 : 0 }; });
  }

  return { PRESET_LEVELS: PRESET_LEVELS, PRESET_50: PRESET_50, defaultPayout: defaultPayout, newTournament: newTournament, alive: alive, nextAlive: nextAlive,
    seats: seats, positionNames: positionNames, posLabels: posLabels, levelBlinds: levelBlinds, timerNow: timerNow, timerStart: timerStart,
    timerPause: timerPause, timerSetLevel: timerSetLevel, timerReset: timerReset, startHand: startHand, act: act, nextStreet: nextStreet,
    pots: pots, potTotal: potTotal, award: award, setStack: setStack, revive: revive, totals: totals, prizes: prizes,
    maxStreet: maxStreet, toCall: toCall, minRaiseTo: minRaiseTo, inHand: inHand };
})();
if (typeof module !== 'undefined') module.exports = DL;
