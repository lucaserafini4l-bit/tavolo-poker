// Inserimento rapido per il dealer (sezione Piatto):
//  - solo il giocatore di turno, in grande, con 4 pulsanti; si passa da soli al successivo
//  - rilanci con importi pronti (un tocco) o con le fiches del vostro set
//  - cambio fase automatico quando il giro di puntate e' finito (in app.js, TP.act)
//  - carte in tavola con una griglia di 52 carte: un tocco per carta
// Si spegne in Impostazioni ("Inserimento rapido"): torna la lista classica.
var QK = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var RT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SY = ['♠', '♥', '♦', '♣'], SC = ['cs', 'ch', 'cd', 'cc'];
  var raiseOpen = false, custom = null, gridOpen = false;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('it-IT'); }
  function st() { return TP.state; }
  function on() { return st().cfg.quick !== false && st().cfg.trackChips; }
  function chips() { var c = st().cfg.chips; return c && c.length ? c : [25, 50, 100, 500, 1000]; }
  function unit() { return Math.min.apply(null, chips()); }
  function roundUp(x, u) { return Math.ceil(x / u) * u; }

  // importi pronti (totale nella fase), arrotondati alla fiche piu' piccola e mai sotto il minimo
  function presets(i) {
    var S = st(), h = S.hand, p = S.players[i], b = h.bets[p.id], max = DL.maxStreet(S), tot = DL.potTotal(S);
    var cap = p.stack + b.street, min = Math.min(cap, DL.minRaiseTo(S)), u = unit(), out = [];
    function add(lbl, v) { v = Math.max(min, roundUp(v, u)); if (v >= cap) return; if (!out.some(function (o) { return o.v === v; })) out.push({ l: lbl, v: v }); }
    var potAfterCall = tot + (max - b.street);
    if (max > 0) { add('Minimo', min); add('2,5×', max * 2.5); add('3×', max * 3); add('Piatto', max + potAfterCall); }
    else { add('½ piatto', tot / 2); add('⅔ piatto', tot * 2 / 3); add('Piatto', tot); add('Minimo', min); }
    return { list: out, cap: cap, min: min };
  }

  function cardHtml(c, cls) { return '<span class="qcard ' + SC[c & 3] + (cls ? ' ' + cls : '') + '">' + RT[c >> 2] + SY[c & 3] + '</span>'; }

  function render() {
    var host = $('potHand'); if (!host) return;
    var panel = $('qPanel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'qPanel'; panel.className = 'view'; host.insertBefore(panel, $('pPlayers')); }
    var S = st(), h = S.hand, active = on() && h;
    panel.hidden = !active; $('pPlayers').hidden = !!active;
    $('pNextStreet').classList.toggle('qsmall', !!active);
    if (!active) return;
    var html = '';
    // ---- carte in tavola
    var need = DL.cardsNeeded(S), bd = h.board || [];
    var missing = need - bd.length;
    if (need > 0 || bd.length || gridOpen) html += '<div class="card"><div class="row"><span class="lbl">Carte in tavola</span><span class="spacer"></span>' +
      '<button class="btn" id="qGridT" type="button">' + (gridOpen || missing > 0 ? 'Chiudi' : 'Modifica') + '</button></div>' +
      '<div class="qboard">' + [0, 1, 2, 3, 4].map(function (k) { return bd[k] != null ? cardHtml(bd[k]) : '<span class="qcard empty">' + (k < need ? '?' : '') + '</span>'; }).join('') + '</div>' +
      (missing > 0 ? '<p class="note" style="color:var(--call)">Tocca ' + (missing === 1 ? 'la carta' : 'le ' + missing + ' carte') + ' ' + ['', 'del flop', 'del turn', 'del river'][h.street] + '</p>' : '');
    if (gridOpen || missing > 0) {
      html += '<div class="qgrid">';
      for (var s = 0; s < 4; s++) for (var r = 12; r >= 0; r--) {
        var c = r * 4 + s, used = bd.indexOf(c) >= 0;
        html += '<button type="button" class="qg ' + SC[s] + (used ? ' on' : '') + '" data-c="' + c + '" aria-pressed="' + used + '" aria-label="' + RT[r] + ' di ' + ['picche', 'cuori', 'quadri', 'fiori'][s] + '">' + RT[r] + '<small>' + SY[s] + '</small></button>';
      }
      html += '</div>';
    }
    if (need > 0 || bd.length || gridOpen) html += '</div>';
    // ---- giocatore di turno
    var done = h.done || DL.inHand(S).length <= 1 || (h.street === 3 && DL.roundComplete(S)) || h.toAct == null;
    if (done) {
      html += '<div class="card qturn"><span class="lbl">Mano finita</span><b class="qname">Scegli chi vince qui sotto</b></div>';
    } else {
      var i = h.toAct, p = S.players[i], b = h.bets[p.id], max = DL.maxStreet(S), tc = Math.min(p.stack, max - b.street);
      var isJev = S.cfg.jevSeat === i;
      html += '<div class="card qturn"><div class="row"><span class="lbl">Tocca a</span><span class="spacer"></span><span class="lbl">' +
        ['Pre-flop', 'Flop', 'Turn', 'River'][h.street] + ' · piatto ' + fmt(DL.potTotal(S)) + '</span></div>' +
        '<b class="qname">' + esc(p.name) + (isJev ? ' <small>(Sistema)</small>' : '') + '</b>' +
        '<div class="note">' + fmt(p.stack) + ' fiches · ' + (h.bb ? (Math.round(p.stack / h.bb * 10) / 10).toString().replace('.', ',') + ' BB' : '') +
        (b.street ? ' · già puntato ' + fmt(b.street) + ' in questa fase' : '') + '</div>' +
        '<div class="qacts">' +
        (tc > 0 ? '<button class="btn big qfold" data-q="fold" type="button">Fold</button>' : '') +
        '<button class="btn big qcall" data-q="call" type="button">' + (tc > 0 ? (tc >= p.stack ? 'Chiama all-in ' + fmt(tc) : 'Chiama ' + fmt(tc)) : 'Check') + '</button>' +
        (p.stack > tc ? '<button class="btn big qraise" data-q="raise" type="button">' + (max > 0 ? 'Rilancia' : 'Punta') + '</button>' : '') +
        (p.stack > tc ? '<button class="btn big qallin" data-q="allin" type="button">All-in ' + fmt(p.stack + b.street) + '</button>' : '') +
        '</div>';
      if (raiseOpen) {
        var P = presets(i);
        if (custom == null) custom = max;          // si parte dalla puntata da pareggiare e si aggiungono fiches
        html += '<div class="raisebox"><span class="lbl">' + (max > 0 ? 'Rilancia a (totale in questa fase)' : 'Punta') + ' · un tocco registra</span><div class="qpre">' +
          P.list.map(function (o) { return '<button class="btn qp" data-v="' + o.v + '" type="button">' + o.l + '<b>' + fmt(o.v) + '</b></button>'; }).join('') + '</div>' +
          '<span class="lbl">Altro importo: tocca le fiches</span>' +
          '<div class="qchips">' + chips().map(function (c) { return '<button class="qchip" data-add="' + c + '" type="button">+' + fmt(c) + '</button>'; }).join('') + '<button class="qchip zero" data-add="0" type="button">Azzera</button></div>' +
          '<div class="row"><b class="num qcustom">' + fmt(custom) + '</b><span class="note">metti ' + fmt(Math.max(0, Math.min(custom, P.cap) - b.street)) + '</span><span class="spacer"></span><button class="btn primary" id="qCustomOk" type="button"' + (custom < P.min ? ' disabled' : '') + '>Conferma ' + fmt(Math.min(custom, P.cap)) + '</button></div>' +
          (custom < P.min ? '<p class="note">Il minimo è ' + fmt(P.min) + '.</p>' : '') + '</div>';
      }
      html += '</div>';
      // altri giocatori, compatti
      html += '<div class="qothers">' + S.players.map(function (q, j) {
        var bj = h.bets[q.id]; if (q.out || !bj) return '';
        var st_ = bj.folded ? 'fold' : bj.allin ? 'all-in' : bj.street ? fmt(bj.street) : '–';
        return '<span class="qo' + (j === h.toAct ? ' now' : '') + (bj.folded ? ' f' : '') + '">' + esc(q.name) + ' <b>' + st_ + '</b></span>';
      }).join('') + '</div>';
    }
    panel.innerHTML = html;
    bind();
  }

  function bind() {
    var S = st(), h = S.hand;
    var gt = $('qGridT'); if (gt) gt.onclick = function () { gridOpen = !gridOpen; render(); };
    Array.prototype.forEach.call(document.querySelectorAll('#qPanel .qg'), function (b) {
      b.onclick = function () {
        var c = +b.dataset.c;
        TP.update(function (s) { var bd = s.hand.board || (s.hand.board = []), k = bd.indexOf(c); if (k >= 0) bd.splice(k, 1); else if (bd.length < 5) bd.push(c); });
        var need = DL.cardsNeeded(st()); if ((st().hand.board || []).length >= need) gridOpen = false;
        render();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#qPanel [data-q]'), function (b) {
      b.onclick = function () {
        var i = st().hand.toAct, a = b.dataset.q;
        if (a === 'raise') { raiseOpen = !raiseOpen; custom = null; render(); return; }
        raiseOpen = false; TP.act(i, a);
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#qPanel .qp'), function (b) {
      b.onclick = function () { var i = st().hand.toAct; raiseOpen = false; TP.act(i, 'raise', +b.dataset.v); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#qPanel [data-add]'), function (b) {
      b.onclick = function () { var v = +b.dataset.add; custom = v === 0 ? DL.maxStreet(st()) : (custom || 0) + v; render(); };
    });
    var ok = $('qCustomOk');
    if (ok) ok.onclick = function () {
      var i = st().hand.toAct, p = st().players[i], bt = st().hand.bets[p.id], cap = p.stack + bt.street;
      raiseOpen = false; TP.act(i, custom >= cap ? 'allin' : 'raise', Math.min(custom, cap));
    };
  }

  // ---- impostazioni: interruttore e fiches
  function settings() {
    var host = $('v-impostazioni'); if (!host || $('qkCard')) return;
    var c = document.createElement('section'); c.className = 'card'; c.id = 'qkCard';
    host.insertBefore(c, host.firstChild); renderSettings();
  }
  function renderSettings() {
    var c = $('qkCard'); if (!c) return;
    c.innerHTML = '<h2 style="margin:0 0 6px">Inserimento rapido</h2>' +
      '<label class="switch" for="qkOn"><span>Mostra solo chi deve parlare, con importi pronti e cambio fase automatico</span><input type="checkbox" id="qkOn"' + (st().cfg.quick !== false ? ' checked' : '') + '></label>' +
      '<label class="field"><span class="lbl">Valori delle vostre fiches</span><input id="qkChips" value="' + chips().join(', ') + '"></label>' +
      '<p class="note">I rilanci pronti si arrotondano alla fiche più piccola (' + unit() + ').</p>';
    $('qkOn').onchange = function () { var v = $('qkOn').checked; TP.update(function (s) { s.cfg.quick = v; }); };
    $('qkChips').onchange = function () {
      var v = $('qkChips').value.split(/[^0-9]+/).map(Number).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
      if (v.length) TP.update(function (s) { s.cfg.chips = v; });
    };
  }

  TP.onChange(function () { render(); renderSettings(); });
  settings(); render();
  return { render: render, presets: presets };
})();
