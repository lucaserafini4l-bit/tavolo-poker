// Collegamento al Sistema Jev. Si attiva SOLO quando l'app e' aperta dal server sul portatile
// (http://IP:8765/). Su GitHub Pages resta spento e l'app funziona come sempre.
var SJ = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var on = false, timer = null, lastDec = null;
  if (typeof location === 'undefined' || location.protocol !== 'http:') return { active: false };

  function api(path, body) {
    return fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}).then(function (r) { return r.json(); });
  }
  function seat() { var s = TP.state.cfg.jevSeat; return s === undefined || s === null || s === '' ? null : +s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function push() { clearTimeout(timer); timer = setTimeout(function () { api('/api/stato', { st: TP.state }).catch(function () {}); }, 150); }

  // ---------- impostazioni: scelta del posto del Sistema
  function settingsCard() {
    var host = $('v-impostazioni'); if (!host || $('sjCard')) return;
    var c = document.createElement('section'); c.className = 'card'; c.id = 'sjCard';
    host.insertBefore(c, host.firstChild);
    renderSettings();
  }
  function renderSettings() {
    var c = $('sjCard'); if (!c) return;
    var s = seat(), opts = '<option value="">Nessuno</option>';
    TP.state.players.forEach(function (p, i) { opts += '<option value="' + i + '"' + (s === i ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
    c.innerHTML = '<h2 style="margin:0 0 6px">Sistema Jev</h2>' +
      '<p class="note">Collegato al portatile. Scegli il posto in cui gioca il Sistema: la sua decisione comparirà nella sezione Piatto quando tocca a lui.</p>' +
      '<label class="field"><span class="lbl">Posto del Sistema</span><select id="sjSeat">' + opts + '</select></label>' +
      '<p class="note">Sul telefono del Sistema apri <b>' + esc(location.host) + '/sistema</b> per fotografare le sue carte.</p>';
    $('sjSeat').onchange = function () { var v = $('sjSeat').value; TP.update(function (st) { st.cfg.jevSeat = v === '' ? null : +v; }); };
  }

  // ---------- piatto: decisione del Sistema
  function panel() {
    var host = $('potHand'); if (!host) return null;
    var p = $('sjPanel');
    if (!p) { p = document.createElement('div'); p.id = 'sjPanel'; p.className = 'card'; p.style.borderColor = 'var(--brass)'; host.insertBefore(p, host.firstChild); }
    return p;
  }
  function renderPanel(d) {
    var s = seat(), h = TP.state.hand, p = panel(); if (!p) return;
    if (s === null || !h) { p.hidden = true; return; }
    p.hidden = false;
    var name = esc(TP.state.players[s].name);
    if (!d || d.stato !== 'decisione') {
      p.innerHTML = '<span class="lbl">Sistema Jev · ' + name + '</span><div class="note" style="margin-top:6px">' + esc((d && d.testo) || 'In attesa') + '</div>';
      return;
    }
    var col = d.azione === 'fold' ? 'var(--fold)' : d.azione === 'call' ? 'var(--call)' : 'var(--raise)';
    p.innerHTML = '<span class="lbl">Sistema Jev · ' + name + '</span>' +
      '<div style="font:700 34px/1.1 var(--display);text-transform:uppercase;color:' + col + ';margin:6px 0">' + esc(d.testo) + '</div>' +
      '<div class="row"><button class="btn primary" id="sjDo" type="button">Registra l\'azione del Sistema</button></div>';
    $('sjDo').onclick = function () {
      var t = d.azione === 'raise' ? 'raise' : d.azione === 'allin' ? 'allin' : d.azione === 'fold' ? 'fold' : 'call';
      TP.act(s, t, d.a);
    };
  }
  function poll() {
    var s = seat(), h = TP.state.hand;
    if (s === null || !h || h.toAct !== s || h.done) { renderPanel(s === null || !h ? null : { stato: 'attesa', testo: h && h.toAct != null ? 'Tocca a ' + TP.state.players[h.toAct].name : 'In attesa' }); return; }
    api('/api/decisione').then(function (d) { lastDec = d; renderPanel(d); }).catch(function () { renderPanel({ stato: 'errore', testo: 'Server del Sistema non raggiungibile' }); });
  }

  api('/api/ping').then(function (r) {
    if (!r || !r.ok) return;
    on = true;
    TP.onChange(function () { push(); renderSettings(); });
    settingsCard(); push(); poll(); setInterval(poll, 1000);
  }).catch(function () {});
  return { get active() { return on; } };
})();
