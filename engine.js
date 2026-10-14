// Texas Hold'em equity engine. Card = 0..51, rank = c>>2 (0='2' .. 12='A'), suit = c&3.
var PE = (function () {
  var RANKS = '23456789TJQKA';
  var SUITS = 'shdc';
  // popcount + straight table over 13-bit rank masks
  var POP = new Uint8Array(8192), STR = new Int8Array(8192), TOP5 = new Int32Array(8192);
  for (var m = 0; m < 8192; m++) {
    var p = 0; for (var b = 0; b < 13; b++) if (m & (1 << b)) p++;
    POP[m] = p;
    var s = -1;
    for (var t = 12; t >= 4; t--) { var w = 31 << (t - 4); if ((m & w) === w) { s = t; break; } }
    if (s < 0 && (m & 0x100F) === 0x100F) s = 3; // wheel A-2-3-4-5, top = '5'
    STR[m] = s;
    // top 5 ranks packed as kickers
    var k = 0, n = 0;
    for (var r = 12; r >= 0 && n < 5; r--) if (m & (1 << r)) { k = (k << 4) | r; n++; }
    while (n < 5) { k <<= 4; n++; }
    TOP5[m] = k;
  }
  function topN(mask, n) { // pack top n ranks from mask into kicker bits (left aligned to 5 slots)
    var k = 0, c = 0;
    for (var r = 12; r >= 0 && c < n; r--) if (mask & (1 << r)) { k = (k << 4) | r; c++; }
    while (c < 5) { k <<= 4; c++; }
    return k;
  }
  var cnt = new Int8Array(13), sm = new Int32Array(4);
  // Evaluate best 5-of-N (N = 5..7). Returns category*2^20 + kickers. Higher is better.
  function evaluate(cards, len) {
    for (var i = 0; i < 13; i++) cnt[i] = 0;
    sm[0] = sm[1] = sm[2] = sm[3] = 0;
    var all = 0;
    for (i = 0; i < len; i++) { var c = cards[i], r = c >> 2; cnt[r]++; sm[c & 3] |= 1 << r; all |= 1 << r; }
    for (i = 0; i < 4; i++) if (POP[sm[i]] >= 5) {
      var sf = STR[sm[i]];
      if (sf >= 0) return 8 * 1048576 + sf;
      return 5 * 1048576 + TOP5[sm[i]];
    }
    var quad = -1, t1 = -1, t2 = -1, p1 = -1, p2 = -1, p3 = -1;
    for (r = 12; r >= 0; r--) {
      var n = cnt[r];
      if (n === 4) quad = r;
      else if (n === 3) { if (t1 < 0) t1 = r; else if (t2 < 0) t2 = r; }
      else if (n === 2) { if (p1 < 0) p1 = r; else if (p2 < 0) p2 = r; else if (p3 < 0) p3 = r; }
    }
    if (quad >= 0) return 7 * 1048576 + (quad << 16) + (topN(all & ~(1 << quad), 1) >> 4);
    if (t1 >= 0 && (t2 >= 0 || p1 >= 0)) { var pr = t2 > p1 ? t2 : p1; return 6 * 1048576 + (t1 << 16) + (pr << 12); }
    var st = STR[all];
    if (st >= 0) return 4 * 1048576 + st;
    if (t1 >= 0) return 3 * 1048576 + (t1 << 16) + (topN(all & ~(1 << t1), 2) >> 4);
    if (p2 >= 0) return 2 * 1048576 + (p1 << 16) + (p2 << 12) + (topN(all & ~(1 << p1) & ~(1 << p2), 1) >> 8);
    if (p1 >= 0) return 1 * 1048576 + (p1 << 16) + (topN(all & ~(1 << p1), 3) >> 4);
    return TOP5[all];
  }
  function category(score) { return Math.floor(score / 1048576); }
  var CAT_IT = ['Carta alta', 'Coppia', 'Doppia coppia', 'Tris', 'Scala', 'Colore', 'Full', 'Poker', 'Scala colore'];

  // xorshift RNG
  var seed = (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
  function rnd() { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed; }

  // Monte Carlo equity: hero 2 cards, board 0..5 known, nOpp random opponents.
  // Returns {win, tie, lose, equity, iters}. equity counts split pots as share.
  function equity(hero, board, nOpp, iters) {
    var dead = new Uint8Array(52), deck = [], i, j;
    for (i = 0; i < hero.length; i++) dead[hero[i]] = 1;
    for (i = 0; i < board.length; i++) dead[board[i]] = 1;
    for (i = 0; i < 52; i++) if (!dead[i]) deck.push(i);
    var D = deck.length, need = 5 - board.length, draw = need + 2 * nOpp;
    var d = new Int32Array(deck), h = new Int32Array(7), o = new Int32Array(7), bd = new Int32Array(5);
    for (i = 0; i < board.length; i++) bd[i] = board[i];
    var win = 0, tie = 0, eq = 0;
    for (var it = 0; it < iters; it++) {
      // partial Fisher-Yates for the first `draw` cards
      for (i = 0; i < draw; i++) { j = i + (rnd() % (D - i)); var tmp = d[i]; d[i] = d[j]; d[j] = tmp; }
      for (i = 0; i < need; i++) bd[board.length + i] = d[i];
      for (i = 0; i < 5; i++) { h[i] = bd[i]; o[i] = bd[i]; }
      h[5] = hero[0]; h[6] = hero[1];
      var hs = evaluate(h, 7), best = hs, nBest = 1, heroBest = true;
      for (var k = 0; k < nOpp; k++) {
        o[5] = d[need + 2 * k]; o[6] = d[need + 2 * k + 1];
        var os = evaluate(o, 7);
        if (os > best) { best = os; nBest = 1; heroBest = false; }
        else if (os === best) nBest++;
        if (os > hs) { heroBest = false; }
      }
      if (heroBest && best === hs) {
        if (nBest === 1) { win++; eq += 1; } else { tie++; eq += 1 / nBest; }
      }
    }
    return { win: win / iters, tie: tie / iters, lose: 1 - (win + tie) / iters, equity: eq / iters, iters: iters };
  }

  // Outs: unseen cards that improve hero's made-hand category in a way that uses hero's hole cards.
  function outs(hero, board) {
    if (board.length < 3 || board.length > 4) return null;
    var known = hero.concat(board), used = {};
    known.forEach(function (c) { used[c] = 1; });
    var cur = category(evaluate(known, known.length));
    var boardRanks = {}; board.forEach(function (c) { boardRanks[c >> 2] = 1; });
    var list = [], byCat = {}, catOf = {};
    for (var c = 0; c < 52; c++) {
      if (used[c]) continue;
      var nk = known.concat([c]), nb = board.concat([c]);
      var nc = category(evaluate(nk, nk.length));
      if (nc <= cur) continue;
      var bc = board.length + 1 >= 5 ? category(evaluate(nb, nb.length)) : boardCatSmall(nb);
      if (nc <= bc) continue; // the board improves as much as we do
      if (boardRanks[c >> 2] && nc < 4) {
        var holdsRank = (hero[0] >> 2) === (c >> 2) || (hero[1] >> 2) === (c >> 2);
        if (!(nc >= 3 && holdsRank)) continue; // board pair: helps everyone
      }
      list.push(c); catOf[c] = nc;
      byCat[nc] = (byCat[nc] || 0) + 1;
    }
    var unseen = 52 - known.length;
    function prob(o) {
      return board.length === 3 ? 1 - ((unseen - o) * (unseen - o - 1)) / (unseen * (unseen - 1)) : o / unseen;
    }
    // strong = trips or better (straight, flush, set...), weak = pair / two pair improvements
    var strong = list.filter(function (c) { return catOf[c] >= 3; });
    var weak = list.filter(function (c) { return catOf[c] < 3; });
    return { cards: list, strong: strong, weak: weak, byCat: byCat, currentCat: cur,
      pStrongNext: strong.length / unseen, pStrongRiver: prob(strong.length),
      pAllNext: list.length / unseen, pAllRiver: prob(list.length), unseen: unseen };
  }
  // category of a 4-card board (pairs/trips/quads only matter)
  function boardCatSmall(b) {
    var cnt = {}, mx = 0, pairs = 0;
    b.forEach(function (c) { var r = c >> 2; cnt[r] = (cnt[r] || 0) + 1; });
    for (var r in cnt) { if (cnt[r] > mx) mx = cnt[r]; if (cnt[r] === 2) pairs++; }
    if (mx === 4) return 7; if (mx === 3) return 3; if (pairs === 2) return 2; if (pairs === 1) return 1; return 0;
  }

  function parse(s) { return RANKS.indexOf(s[0].toUpperCase()) * 4 + SUITS.indexOf(s[1].toLowerCase()); }
  function name(c) { return RANKS[c >> 2] + SUITS[c & 3]; }
  // 169-class key: 'AKs', 'AKo', 'TT'
  function handKey(a, b) {
    var ra = a >> 2, rb = b >> 2;
    if (ra < rb) { var t = ra; ra = rb; rb = t; }
    if (ra === rb) return RANKS[ra] + RANKS[rb];
    return RANKS[ra] + RANKS[rb] + ((a & 3) === (b & 3) ? 's' : 'o');
  }
  return { evaluate: evaluate, category: category, CAT_IT: CAT_IT, equity: equity, outs: outs,
    parse: parse, name: name, handKey: handKey, RANKS: RANKS, SUITS: SUITS };
})();
if (typeof module !== 'undefined') module.exports = PE;
