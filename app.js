// Tavolo Poker — dealer UI: timer, table with blinds arrows, pot manager, ranking, settings.
var TP = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'tavolo-poker-v1';
  var st = null, history = [], listeners = [];

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) {}
    var t = DL.newTournament({});
    t.cfg.sound = true; t.cfg.vibe = true;
    return t;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} listeners.forEach(function (f) { f(st); }); }
  function snapshot() { history.push(JSON.stringify(st)); if (history.length > 60) history.shift(); }
  function undo() { if (!history.length) return; st = JSON.parse(history.pop()); save(); renderAll(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('it-IT'); }
  function bbOf(stack, bb) { return bb ? stack / bb : 0; }
  function phase(m) { return m >= 15 ? 'calma' : m >= 8 ? 'attacco' : 'urgenza'; }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

  st = load();

  // ---------------- navigation
  var views = ['tavolo', 'piatto', 'classifica', 'calc', 'impostazioni'];
  function show(v) {
    views.forEach(function (x) { $('v-' + x).hidden = x !== v; });
    Array.prototype.forEach.call(document.querySelectorAll('.nav button'), function (b) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    try { localStorage.setItem(KEY + '-view', v); } catch (e) {}
    renderAll();
    window.scrollTo(0, 0);
    if (v === 'calc' && window.CALC) CALC.syncFromTable();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.nav button'), function (b) { b.onclick = function () { show(b.dataset.view); }; });

  // ---------------- sound, vibration, wake lock
  var actx = null;
  function audio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
  function beep(times, freq) {
    if (!st.cfg.sound || !actx) return;
    for (var i = 0; i < times; i++) {
      var o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.32;
      o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.start(t0); o.stop(t0 + 0.27);
    }
  }
  function vibe(p) { try { if (st.cfg.vibe && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  var lock = null;
  function wake(on) {
    try {
      if (on && !lock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {});
      if (!on && lock) { lock.release(); lock = null; }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.timer.running) wake(true); });

  function banner(text, cls) {
    var host = $('bannerHost');
    host.innerHTML = '<div class="banner ' + (cls || '') + '" role="alert"><span>' + esc(text) + '</span><button type="button">Ok</button></div>';
    var el = host.firstChild; el.querySelector('button').onclick = function () { host.innerHTML = ''; };
    clearTimeout(banner.t); banner.t = setTimeout(function () { if (host.firstChild === el) host.innerHTML = ''; }, 12000);
  }

  // ---------------- timer
  function tick() {
    var before = st.timer.level;
    var changed = DL.timerNow(st, Date.now());
    var t = st.timer, dur = st.cfg.minutes * 60000;
    if (changed) {
      var b = DL.levelBlinds(st);
      banner('Livello ' + (t.level + 1) + ': i bui salgono a ' + fmt(b.sb) + ' / ' + fmt(b.bb) + ' dalla prossima mano', 'up');
      beep(3, 880); vibe([300, 120, 300, 120, 300]);
      t.warned = -1; save();
    }
    if (t.running && t.remaining <= 60000 && t.warned !== t.level && t.level < st.cfg.levels.length - 1) {
      t.warned = t.level;
      var nb = DL.levelBlinds(st, t.level + 1);
      banner('Manca 1 minuto: poi i bui salgono a ' + fmt(nb.sb) + ' / ' + fmt(nb.bb));
      beep(2, 660); vibe([200, 100, 200]); save();
    }
    renderTimer();
    if (before !== st.timer.level) renderAll();
  }
  function renderTimer() {
    var t = st.timer, L = st.cfg.levels, b = DL.levelBlinds(st), dur = st.cfg.minutes * 60000;
    var last = t.level >= L.length - 1;
    $('tLevel').textContent = 'Livello ' + (t.level + 1) + ' di ' + L.length + (last ? ' (ultimo)' : '') + ' · piccolo / grande buio';
    $('tBlinds').textContent = fmt(b.sb) + ' / ' + fmt(b.bb);
    var rem = t.remaining, clock = $('tClock');
    clock.textContent = last && t.running ? '∞' : mmss(rem);
    clock.className = 'clock num' + (!t.running ? ' paused' : rem <= 60000 && !last ? ' warn' : '');
    $('tProg').style.width = last ? '100%' : Math.min(100, (1 - rem / dur) * 100).toFixed(1) + '%';
    $('tNext').innerHTML = last ? 'Ultimo livello: i bui restano fissi' : 'Prossimo livello: <b>' + fmt(L[t.level + 1][0]) + ' / ' + fmt(L[t.level + 1][1]) + '</b>';
    $('tPlay').textContent = t.running ? 'Pausa' : (t.remaining < dur ? 'Riprendi' : 'Avvia timer');
    $('tPrev').disabled = t.level === 0; $('tNextLv').disabled = last;
    $('topBlinds').textContent = fmt(b.sb) + '/' + fmt(b.bb);
    $('topClock').textContent = last && t.running ? '∞' : mmss(rem);
    $('topClock').className = 'pill num' + (t.running && rem <= 60000 && !last ? ' warn' : '');
    $('tDur').value = st.cfg.minutes; $('tDurOut').textContent = st.cfg.minutes + ' min';
    var h = st.hand;
    $('tHandNote').textContent = h && (h.bb !== b.bb) ? 'Mano in corso con bui ' + fmt(h.sb) + '/' + fmt(h.bb) : '';
  }
  $('tPlay').onclick = function () {
    audio();
    if (st.timer.running) { DL.timerPause(st, Date.now()); wake(false); } else { DL.timerStart(st, Date.now()); wake(true); }
    save(); renderTimer();
  };
  $('tReset').onclick = function () { DL.timerReset(st, Date.now()); st.timer.warned = -1; save(); renderAll(); };
  $('tPrev').onclick = function () { DL.timerSetLevel(st, st.timer.level - 1, Date.now()); st.timer.warned = -1; save(); renderAll(); };
  $('tNextLv').onclick = function () { DL.timerSetLevel(st, st.timer.level + 1, Date.now()); st.timer.warned = -1; save(); renderAll(); };
  $('tDur').oninput = function () {
    var m = +$('tDur').value, old = st.cfg.minutes * 60000, now = Date.now();
    var t = st.timer, rem = t.running ? t.endAt - now : t.remaining, elapsed = old - rem;
    st.cfg.minutes = m;
    var nr = Math.max(1000, m * 60000 - elapsed);
    if (t.running) t.endAt = now + nr; else t.remaining = nr;
    save(); renderTimer(); renderLevels();
  };

  // ---------------- table
  var ARROW = '<svg class="arr" viewBox="0 0 16 16"><path d="M2 8h9M8 4l4 4-4 4" fill="none" stroke="#0d1714" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderTable() {
    var wrap = $('tableWrap');
    Array.prototype.slice.call(wrap.querySelectorAll('.seat,.marker')).forEach(function (e) { e.remove(); });
    var P = st.players, n = P.length, h = st.hand, s = DL.seats(st), names = DL.positionNames(st);
    var b = h ? { sb: h.sb, bb: h.bb } : DL.levelBlinds(st);
    var started = st.handNo > 0;
    var many = n >= 8 && wrap.clientWidth < 560;
    wrap.classList.toggle('many', many);
    var tall = wrap.clientHeight > wrap.clientWidth;
    var rx = many ? 39 : 40, ry = many ? 42 : tall ? 39 : 37;
    P.forEach(function (p, i) {
      var ang = Math.PI / 2 + i * 2 * Math.PI / n;
      var x = 50 + rx * Math.cos(ang), y = 50 + ry * Math.sin(ang);
      var seat = document.createElement('button'); seat.type = 'button';
      var bet = h && h.bets[p.id];
      var m = bbOf(p.stack, b.bb);
      seat.className = 'seat' + (p.out ? ' out' : '') + (h && h.toAct === i && st.cfg.trackChips ? ' toact' : '') + (bet && bet.folded ? ' folded' : '');
      seat.style.left = x + '%'; seat.style.top = y + '%';
      seat.innerHTML = '<span class="nm">' + esc(p.name) + '</span>' +
        (p.out ? '<span class="tag">' + p.place + '° posto</span>' :
          '<span class="stk num">' + fmt(p.stack) + '</span>' +
          '<span class="bbn">' + (names[i] ? names[i] + ' · ' : '') + '<b class="phase-' + phase(m) + '">' + (Math.round(m * 10) / 10).toString().replace('.', ',') + ' BB</b></span>' +
          (bet && bet.allin ? '<span class="tag" style="color:var(--call)">All-in</span>' : bet && bet.folded ? '<span class="tag">Fold</span>' : ''));
      seat.setAttribute('aria-label', p.name + (p.out ? ', eliminato' : ', ' + fmt(p.stack) + ' fiches'));
      seat.onclick = function () { seatSheet(i); };
      wrap.appendChild(seat);
      if (p.out) return;
      function marker(html, f, dAng) {
        var a = ang + (dAng || 0), mk = document.createElement('div');
        mk.className = 'marker'; mk.style.left = (50 + rx * f * Math.cos(a)) + '%'; mk.style.top = (50 + ry * f * Math.sin(a)) + '%';
        mk.innerHTML = html; wrap.appendChild(mk); return mk;
      }
      var deg = ang * 180 / Math.PI;
      if (i === s.dealer) marker('<div class="dbtn" title="Mazziere">D</div>', tall ? 0.7 : 0.66, n > 6 ? 0.22 : 0.3);
      if (DL.alive(st).length >= 2) {
        if (i === s.sb) marker('<div class="blindtag sb"><span class="arr" style="transform:rotate(' + deg + 'deg)">' + ARROW + '</span>SB ' + fmt(b.sb) + '</div>', many ? 0.54 : tall ? 0.64 : 0.6);
        if (i === s.bb) marker('<div class="blindtag bb"><span class="arr" style="transform:rotate(' + deg + 'deg)">' + ARROW + '</span>BB ' + fmt(b.bb) + '</div>', many ? 0.54 : tall ? 0.64 : 0.6);
      }
    });
    // centre
    var a = DL.alive(st);
    $('cHand').textContent = st.handNo ? 'Mano ' + st.handNo : 'Pronti a iniziare';
    $('cPot').textContent = st.cfg.trackChips && h ? 'Piatto ' + fmt(DL.potTotal(st)) : 'Bui ' + fmt(b.sb) + ' / ' + fmt(b.bb);
    var first = h && st.cfg.trackChips && h.toAct != null ? h.toAct : s.firstPre;
    $('cFirst').textContent = a.length >= 2 ? (h && st.cfg.trackChips && h.toAct != null ? 'Tocca a: ' : 'Parla per primo: ') + P[first].name : '';
    $('cMeta').textContent = a.length >= 2 ? 'Mazziere ' + P[s.dealer].name : (a.length === 1 ? 'Vince ' + a[0].name + '!' : '');
    // buttons
    var nb = $('nextHand');
    if (a.length < 2) { nb.textContent = 'Torneo concluso'; nb.disabled = true; }
    else {
      nb.disabled = false;
      if (st.handNo === 0) nb.textContent = 'Inizia la prima mano';
      else if (st.cfg.trackChips && h) nb.textContent = h.done ? 'Assegna il piatto' : 'Gestisci la mano';
      else nb.textContent = 'Mano successiva';
    }
    $('goPot').hidden = !st.cfg.trackChips;
    // stats
    var T = DL.totals(st), bb = DL.levelBlinds(st).bb;
    $('sAlive').textContent = T.alive + '/' + P.length;
    $('sAvg').innerHTML = fmt(T.avg) + ' <small style="font-size:13px;color:var(--muted)">' + (Math.round(T.avg / bb * 10) / 10).toString().replace('.', ',') + ' BB</small>';
    var ok = T.chips === T.expected;
    $('sCheck').innerHTML = '<span class="' + (ok ? 'ok' : 'bad') + '">' + fmt(T.chips) + (ok ? ' ✓' : ' ≠ ' + fmt(T.expected)) + '</span>';
  }
  $('nextHand').onclick = function () {
    var h = st.hand;
    if (st.cfg.trackChips && h && st.handNo > 0) { show('piatto'); return; }
    snapshot();
    if (!st.cfg.trackChips && h) st.hand = null;
    DL.startHand(st, { keepButton: st.handNo === 0 });
    save(); renderAll();
  };
  $('goPot').onclick = function () { show('piatto'); };

  function renderLevels() {
    var L = st.cfg.levels, t = st.timer, html = '<tr><th>Liv.</th><th>Piccolo</th><th>Grande</th><th class="r">Inizia</th><th class="r">Stack iniziale</th></tr>';
    L.forEach(function (l, i) {
      html += '<tr' + (i === t.level ? ' style="background:rgba(214,178,106,.12)"' : '') + '><td>' + (i + 1) + (i === t.level ? ' ◂' : '') + '</td><td class="num">' + fmt(l[0]) + '</td><td class="num">' + fmt(l[1]) + '</td><td class="r num">' + (i * st.cfg.minutes) + '′</td><td class="r num">' + (Math.round(st.cfg.startStack / l[1] * 10) / 10).toString().replace('.', ',') + ' BB</td></tr>';
    });
    $('lvTable').innerHTML = html;
  }

  // ---------------- seat sheet
  function sheet(html, bind) {
    var host = $('sheetHost');
    host.innerHTML = '<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">' + html + '</div></div>';
    var scrim = host.firstChild;
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    function close() { host.innerHTML = ''; }
    bind(scrim.firstChild, close);
  }
  function seatSheet(i) {
    var p = st.players[i], bb = DL.levelBlinds(st).bb;
    sheet('<h2>' + esc(p.name) + '</h2>' +
      '<label class="field"><span class="lbl">Nome</span><input id="ssName" value="' + esc(p.name) + '"></label>' +
      (p.out ? '<p class="note">Eliminato al ' + p.place + '° posto.</p><label class="field"><span class="lbl">Rientra con fiches</span><input id="ssRe" type="number" inputmode="numeric" value="' + st.cfg.startStack + '"></label>' :
        '<label class="field"><span class="lbl">Fiches</span><input id="ssStack" type="number" inputmode="numeric" value="' + p.stack + '"></label>' +
        '<div class="quick"><button class="btn" data-d="-' + bb + '">−' + fmt(bb) + '</button><button class="btn" data-d="' + bb + '">+' + fmt(bb) + '</button><button class="btn" data-d="-' + (bb * 5) + '">−' + fmt(bb * 5) + '</button><button class="btn" data-d="' + (bb * 5) + '">+' + fmt(bb * 5) + '</button></div>') +
      '<div class="row">' + (p.out ? '<button class="btn" id="ssRevive">Riammetti</button>' : '<button class="btn" id="ssDealer">Metti qui il mazziere</button><button class="btn danger" id="ssOut">Elimina</button>') +
      '<span class="spacer"></span><button class="btn primary" id="ssSave">Salva</button></div>',
      function (el, close) {
        Array.prototype.forEach.call(el.querySelectorAll('[data-d]'), function (b) { b.onclick = function () { var inp = el.querySelector('#ssStack'); inp.value = Math.max(0, (+inp.value || 0) + (+b.dataset.d)); }; });
        el.querySelector('#ssSave').onclick = function () {
          snapshot();
          p.name = el.querySelector('#ssName').value.trim() || p.name;
          var sInp = el.querySelector('#ssStack'); if (sInp) DL.setStack(st, i, +sInp.value || 0);
          save(); close(); renderAll();
        };
        var d = el.querySelector('#ssDealer'); if (d) d.onclick = function () { snapshot(); st.button = i; if (st.hand && !st.cfg.trackChips) st.hand = null; save(); close(); renderAll(); };
        var o = el.querySelector('#ssOut');
        if (o) o.onclick = function () {
          if (o.dataset.confirm) { snapshot(); DL.setStack(st, i, 0); if (st.hand && st.hand.bets[p.id]) st.hand.bets[p.id].folded = true; save(); close(); renderAll(); }
          else { o.dataset.confirm = 1; o.textContent = 'Conferma eliminazione'; }
        };
        var r = el.querySelector('#ssRevive'); if (r) r.onclick = function () { snapshot(); DL.revive(st, i, +el.querySelector('#ssRe').value || st.cfg.startStack); p.name = el.querySelector('#ssName').value.trim() || p.name; save(); close(); renderAll(); };
      });
  }

  // ---------------- pot manager
  var raiseOpen = null;
  function renderPot() {
    var h = st.hand;
    var has = !!(h && st.cfg.trackChips);
    $('potNoHand').hidden = has; $('potHand').hidden = !has;
    if (!st.cfg.trackChips) { $('potNoHandMsg').textContent = 'La gestione delle fiches è spenta (Impostazioni). Usa la schermata Tavolo per bui, frecce e timer.'; $('potStart').hidden = true; return; }
    $('potStart').hidden = DL.alive(st).length < 2;
    $('potNoHandMsg').textContent = 'Inizia una mano: i bui vengono messi nel piatto in automatico.';
    if (!has) return;
    var P = st.players, s = DL.seats(st), maxS = DL.maxStreet(st), tot = DL.potTotal(st);
    $('pHandLbl').textContent = 'Mano ' + h.no + ' · bui ' + fmt(h.sb) + '/' + fmt(h.bb);
    Array.prototype.forEach.call($('pStreets').children, function (e, k) { e.className = k === h.street ? 'on' : ''; });
    $('pTot').textContent = fmt(tot); $('pMax').textContent = fmt(maxS); $('pMin').textContent = fmt(DL.minRaiseTo(st));
    $('pNextStreet').hidden = h.street >= 3 || h.done;
    $('pNextStreet').textContent = ['Gira il flop', 'Gira il turn', 'Gira il river'][h.street] || '';
    $('pUndo').disabled = !history.length;
    // players in action order for this street
    var first = h.street === 0 ? s.firstPre : s.firstPost, order = [], i = first, n = P.length;
    for (var k = 0; k < n; k++) { var j = (first + k) % n; if (!P[j].out && h.bets[P[j].id]) order.push(j); }
    var html = '';
    order.forEach(function (j) {
      var p = P[j], b = h.bets[p.id], call = Math.min(p.stack, maxS - b.street);
      var mk = (j === s.dealer ? '<span class="mk d">D</span>' : '') + (j === s.sb ? '<span class="mk sb">SB</span>' : '') + (j === s.bb ? '<span class="mk bb">BB</span>' : '');
      html += '<div class="pl' + (h.toAct === j && !h.done ? ' toact' : '') + (b.folded ? ' folded' : '') + '">' +
        '<div class="who"><b>' + esc(p.name) + '</b>' + mk + '</div>' +
        '<div class="amt num">' + fmt(b.street) + '<small>in questa fase · ' + fmt(p.stack) + ' dietro</small></div>';
      if (b.folded) html += '<div class="status" style="grid-column:1/-1">Ha passato (fold)</div>';
      else if (b.allin) html += '<div class="status" style="grid-column:1/-1;color:var(--call)">All-in · ' + fmt(b.total) + ' nella mano</div>';
      else if (!h.done) {
        html += '<div class="acts"><button class="btn fold" data-a="fold" data-i="' + j + '">Fold</button>' +
          '<button class="btn call" data-a="call" data-i="' + j + '">' + (call > 0 ? 'Chiama ' + fmt(call) : 'Check') + '</button>' +
          '<button class="btn" data-a="raiseopen" data-i="' + j + '">' + (maxS > 0 ? 'Rilancia' : 'Punta') + '</button>' +
          '<button class="btn allin" data-a="allin" data-i="' + j + '">All-in</button></div>';
        if (raiseOpen === j) {
          var minTo = Math.min(p.stack + b.street, DL.minRaiseTo(st));
          var potAfterCall = tot + (maxS - b.street);
          var half = Math.max(minTo, maxS + Math.round(potAfterCall / 2)), full = Math.max(minTo, maxS + potAfterCall);
          var cap = p.stack + b.street;
          html += '<div class="raisebox"><span class="lbl">' + (maxS > 0 ? 'Rilancia a (totale in questa fase)' : 'Punta') + '</span>' +
            '<input class="inp num" id="raiseTo" type="number" inputmode="numeric" value="' + Math.min(cap, minTo) + '">' +
            '<div class="quick"><button class="btn" data-set="' + Math.min(cap, minTo) + '">Minimo</button><button class="btn" data-set="' + Math.min(cap, half) + '">½ piatto</button><button class="btn" data-set="' + Math.min(cap, full) + '">Piatto</button><button class="btn primary" data-a="raise" data-i="' + j + '">Conferma</button></div></div>';
        }
      }
      html += '</div>';
    });
    $('pPlayers').innerHTML = html;
    Array.prototype.forEach.call($('pPlayers').querySelectorAll('[data-a]'), function (btn) {
      btn.onclick = function () {
        var j = +btn.dataset.i, a = btn.dataset.a;
        if (a === 'raiseopen') { raiseOpen = raiseOpen === j ? null : j; renderPot(); var inp = $('raiseTo'); if (inp) inp.focus(); return; }
        snapshot();
        if (a === 'raise') { var v = +$('raiseTo').value || 0; DL.act(st, j, v >= st.players[j].stack + h.bets[st.players[j].id].street ? 'allin' : 'raise', v); }
        else DL.act(st, j, a);
        raiseOpen = null; save(); renderAll();
      };
    });
    Array.prototype.forEach.call($('pPlayers').querySelectorAll('[data-set]'), function (btn) { btn.onclick = function () { $('raiseTo').value = btn.dataset.set; }; });
    // pots & winners
    var pots = DL.pots(st);
    if (!renderPot.sel || renderPot.selHand !== h.no) { renderPot.sel = {}; renderPot.selHand = h.no; }
    var sel = renderPot.sel, ph = '';
    pots.forEach(function (pot, k) {
      var label = pots.length === 1 ? 'Piatto' : (k === 0 ? 'Piatto principale' : 'Piatto laterale ' + k);
      if (pot.eligible.length === 1) sel[k] = [pot.eligible[0]];
      ph += '<div class="potline"><div class="h"><span class="lbl">' + label + '</span><b class="num">' + fmt(pot.amount) + '</b></div><div class="chips">';
      pot.eligible.forEach(function (id) {
        var on = (sel[k] || []).indexOf(id) >= 0;
        ph += '<button class="chip" type="button" data-pot="' + k + '" data-id="' + id + '" aria-pressed="' + on + '">' + esc(P.filter(function (q) { return q.id === id; })[0].name) + '</button>';
      });
      ph += '</div>' + (pot.eligible.length === 1 ? '<span class="note">Unico giocatore rimasto: il piatto è suo.</span>' : '<span class="note">Tocca il vincitore (due o più per dividere).</span>') + '</div>';
    });
    $('pPots').innerHTML = ph;
    Array.prototype.forEach.call($('pPots').querySelectorAll('[data-pot]'), function (c) {
      c.onclick = function () { var k = +c.dataset.pot, id = +c.dataset.id, a = sel[k] || (sel[k] = []), x = a.indexOf(id); if (x >= 0) a.splice(x, 1); else a.push(id); renderPot(); };
    });
    var ready = pots.length > 0 && pots.every(function (p, k) { return (sel[k] || []).length > 0; });
    $('pAward').disabled = !ready;
  }
  $('potStart').onclick = function () { snapshot(); DL.startHand(st, { keepButton: st.handNo === 0 }); save(); renderAll(); };
  $('pUndo').onclick = undo;
  $('pNextStreet').onclick = function () { snapshot(); DL.nextStreet(st); raiseOpen = null; save(); renderAll(); };
  $('pAward').onclick = function () {
    var pots = DL.pots(st), w = pots.map(function (p, k) { return renderPot.sel[k] || []; });
    snapshot();
    var busted = DL.award(st, w);
    var alive = DL.alive(st);
    if (busted.length) banner(busted.map(function (p) { return p.name + ' eliminato (' + p.place + '°)'; }).join(' · '));
    if (alive.length >= 2) DL.startHand(st);
    else banner('Torneo finito: vince ' + alive[0].name + '!');
    save(); show(alive.length >= 2 ? 'tavolo' : 'classifica');
  };

  // ---------------- ranking & prizes
  function renderRank() {
    var P = st.players, pr = DL.prizes(st), bb = DL.levelBlinds(st).bb;
    var pool = st.cfg.buyIn * P.length;
    $('poolTot').textContent = pool.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    var ph = '<tr><th>Posto</th><th class="r">Quota</th><th class="r">Premio</th><th>Assegnato a</th></tr>';
    pr.forEach(function (x) {
      var who = P.filter(function (p) { return p.place === x.place; })[0];
      ph += '<tr><td>' + x.place + '°</td><td class="r num">' + x.pct + '%</td><td class="r num">' + x.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) + '</td><td>' + (who ? esc(who.name) : '—') + '</td></tr>';
    });
    $('prizeTable').innerHTML = ph;
    var alive = P.filter(function (p) { return !p.out; }).sort(function (a, b) { return b.stack - a.stack; });
    var out = P.filter(function (p) { return p.out; }).sort(function (a, b) { return a.place - b.place; });
    var h = '<tr><th>#</th><th>Giocatore</th><th class="r">Fiches</th><th class="r">BB</th><th class="r">Premio</th></tr>';
    alive.forEach(function (p, k) {
      var m = bbOf(p.stack, bb);
      h += '<tr><td>' + (k + 1) + '</td><td class="pname">' + esc(p.name) + '</td><td class="r num">' + fmt(p.stack) + '</td><td class="r num phase-' + phase(m) + '">' + (Math.round(m * 10) / 10).toString().replace('.', ',') + '</td><td class="r">' + (alive.length === 1 && pr[0] ? pr[0].amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '') + '</td></tr>';
    });
    out.forEach(function (p) {
      var x = pr[p.place - 1];
      h += '<tr class="out"><td>' + p.place + '°</td><td class="pname">' + esc(p.name) + '</td><td class="r">eliminato</td><td></td><td class="r">' + (x ? x.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '') + '</td></tr>';
    });
    $('rankTable').innerHTML = h;
    var wc = $('winnerCard');
    wc.hidden = alive.length !== 1;
    if (alive.length === 1) { $('winnerName').textContent = alive[0].name; $('winnerPrize').textContent = pr[0] ? 'Premio ' + pr[0].amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : ''; }
  }

  // ---------------- settings
  var draft = null;
  function makeDraft() { draft = { names: st.players.map(function (p) { return p.name; }), start: st.cfg.startStack, dirty: false }; }
  makeDraft();
  function renderSettings() {
    var pl = $('sPlayers'), html = '';
    draft.names.forEach(function (nm, i) {
      html += '<div class="pr"><span class="n">' + (i + 1) + '</span><input data-i="' + i + '" id="pname' + i + '" value="' + esc(nm) + '" aria-label="Nome giocatore ' + (i + 1) + '">' +
        '<button type="button" data-up="' + i + '" aria-label="Sposta su"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-down="' + i + '" aria-label="Sposta giù"' + (i === draft.names.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" data-del="' + i + '" aria-label="Rimuovi"' + (draft.names.length <= 2 ? ' disabled' : '') + '>✕</button></div>';
    });
    pl.innerHTML = html;
    Array.prototype.forEach.call(pl.querySelectorAll('input'), function (inp) {
      inp.oninput = function () {
        var i = +inp.dataset.i; draft.names[i] = inp.value;
        if (!draft.dirty && st.players[i]) { st.players[i].name = inp.value.trim() || st.players[i].name; save(); }
      };
    });
    function mv(i, d) { var a = draft.names, t = a[i]; a[i] = a[i + d]; a[i + d] = t; draft.dirty = true; renderSettings(); }
    Array.prototype.forEach.call(pl.querySelectorAll('[data-up]'), function (b) { b.onclick = function () { mv(+b.dataset.up, -1); }; });
    Array.prototype.forEach.call(pl.querySelectorAll('[data-down]'), function (b) { b.onclick = function () { mv(+b.dataset.down, 1); }; });
    Array.prototype.forEach.call(pl.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { draft.names.splice(+b.dataset.del, 1); draft.dirty = true; renderSettings(); }; });
    $('sAddP').disabled = draft.names.length >= 10;
    $('sStart').value = draft.start; $('sBuy').value = st.cfg.buyIn;
    // payout
    var po = $('sPayout'), ph = '';
    st.cfg.payout.forEach(function (x, i) { ph += '<label class="lbl" style="display:flex;gap:6px;align-items:center">' + (i + 1) + '° <input type="number" inputmode="numeric" data-po="' + i + '" value="' + x + '" aria-label="Percentuale ' + (i + 1) + '° posto">%</label>'; });
    ph += '<button class="chip" type="button" id="poAdd">+ posto</button>' + (st.cfg.payout.length > 1 ? '<button class="chip" type="button" id="poDel">− posto</button>' : '');
    var sum = st.cfg.payout.reduce(function (a, b) { return a + b; }, 0);
    ph += '<span class="note" style="' + (sum === 100 ? '' : 'color:var(--fold)') + '">Totale ' + sum + '%</span>';
    po.innerHTML = ph;
    Array.prototype.forEach.call(po.querySelectorAll('[data-po]'), function (inp) { inp.onchange = function () { st.cfg.payout[+inp.dataset.po] = Math.max(0, +inp.value || 0); save(); renderSettings(); }; });
    $('poAdd').onclick = function () { st.cfg.payout.push(0); save(); renderSettings(); };
    var pd = $('poDel'); if (pd) pd.onclick = function () { st.cfg.payout.pop(); save(); renderSettings(); };
    // levels
    var lv = $('sLevels'), lh = '';
    st.cfg.levels.forEach(function (l, i) {
      lh += '<div class="lr"><span>Liv. ' + (i + 1) + '</span><input type="number" inputmode="numeric" data-l="' + i + '" data-k="0" value="' + l[0] + '" aria-label="Piccolo buio livello ' + (i + 1) + '"><input type="number" inputmode="numeric" data-l="' + i + '" data-k="1" value="' + l[1] + '" aria-label="Grande buio livello ' + (i + 1) + '"><button type="button" data-ldel="' + i + '" aria-label="Rimuovi livello"' + (st.cfg.levels.length <= 1 ? ' disabled' : '') + '>✕</button></div>';
    });
    lv.innerHTML = '<div class="lr"><span></span><span class="lbl">Piccolo</span><span class="lbl">Grande</span><span></span></div>' + lh;
    Array.prototype.forEach.call(lv.querySelectorAll('input'), function (inp) {
      inp.onchange = function () {
        var i = +inp.dataset.l, k = +inp.dataset.k, v = Math.max(1, Math.round(+inp.value || 1));
        st.cfg.levels[i][k] = v; if (k === 0 && st.cfg.levels[i][1] < v) st.cfg.levels[i][1] = v * 2;
        save(); renderAll();
      };
    });
    Array.prototype.forEach.call(lv.querySelectorAll('[data-ldel]'), function (b) { b.onclick = function () { st.cfg.levels.splice(+b.dataset.ldel, 1); if (st.timer.level >= st.cfg.levels.length) st.timer.level = st.cfg.levels.length - 1; save(); renderAll(); }; });
    $('optSound').checked = !!st.cfg.sound; $('optVibe').checked = !!st.cfg.vibe; $('optChips').checked = !!st.cfg.trackChips;
    $('sDirty').hidden = !draft.dirty;
  }
  $('sAddP').onclick = function () { draft.names.push('Giocatore ' + (draft.names.length + 1)); draft.dirty = true; renderSettings(); };
  $('sStart').onchange = function () { draft.start = Math.max(1, Math.round(+$('sStart').value || 1000)); draft.dirty = draft.start !== st.cfg.startStack || draft.dirty; renderSettings(); };
  $('sBuy').onchange = function () { st.cfg.buyIn = Math.max(0, +String($('sBuy').value).replace(',', '.') || 0); save(); renderAll(); };
  $('sAddL').onclick = function () { var L = st.cfg.levels, l = L[L.length - 1]; L.push([l[0] + (L.length > 1 ? l[0] - L[L.length - 2][0] : l[0]), l[1] + (L.length > 1 ? l[1] - L[L.length - 2][1] : l[1])]); save(); renderAll(); };
  $('presetOurs').onclick = function () { st.cfg.levels = DL.PRESET_LEVELS.map(function (l) { return l.slice(); }); st.timer.level = Math.min(st.timer.level, 4); save(); renderAll(); };
  $('presetDouble').onclick = function () { st.cfg.levels = [[20, 40], [40, 80], [80, 160], [160, 320], [320, 640]]; save(); renderAll(); };
  $('optSound').onchange = function () { st.cfg.sound = $('optSound').checked; audio(); save(); };
  $('optVibe').onchange = function () { st.cfg.vibe = $('optVibe').checked; save(); };
  $('optChips').onchange = function () { st.cfg.trackChips = $('optChips').checked; if (!st.cfg.trackChips && st.hand) { /* return chips in the pot to their owners */ for (var k in st.hand.bets) { st.players.forEach(function (p) { if (p.id === +k) p.stack += st.hand.bets[k].total; }); st.hand.bets[k].total = 0; st.hand.bets[k].street = 0; } } save(); renderAll(); };
  $('sNew').onclick = function () {
    var inProgress = st.handNo > 0;
    var names = draft.names.map(function (n, i) { return n.trim() || 'Giocatore ' + (i + 1); });
    sheet('<h2>Nuovo torneo</h2><p class="note">' + names.length + ' giocatori, ' + fmt(draft.start) + ' fiches a testa, livelli da ' + st.cfg.minutes + ' minuti.' + (inProgress ? ' Il torneo in corso verrà cancellato.' : '') + '</p><div class="row"><button class="btn" id="nCancel">Annulla</button><span class="spacer"></span><button class="btn primary" id="nOk">Inizia</button></div>',
      function (el, close) {
        el.querySelector('#nCancel').onclick = close;
        el.querySelector('#nOk').onclick = function () {
          var c = st.cfg;
          st = DL.newTournament({ names: names, startStack: draft.start, levels: c.levels, minutes: c.minutes, buyIn: c.buyIn, payout: names.length !== st.players.length ? DL.defaultPayout(names.length) : c.payout, trackChips: c.trackChips });
          st.cfg.sound = c.sound; st.cfg.vibe = c.vibe;
          history = []; makeDraft(); save(); close(); show('tavolo');
        };
      });
  };

  function renderAll() { renderTimer(); renderTable(); renderLevels(); renderPot(); renderRank(); renderSettings(); }
  window.addEventListener('resize', function () { clearTimeout(renderAll.r); renderAll.r = setTimeout(renderTable, 120); });

  renderAll();
  var v0 = 'tavolo'; try { v0 = localStorage.getItem(KEY + '-view') || 'tavolo'; } catch (e) {}
  if (views.indexOf(v0) < 0) v0 = 'tavolo';
  show(v0);
  setInterval(tick, 250);
  if (st.timer.running) wake(true);

  return { get state() { return st; }, onChange: function (f) { listeners.push(f); }, show: show };
})();
