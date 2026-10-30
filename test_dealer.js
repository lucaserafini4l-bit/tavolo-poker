const DL=require('./dealer.js');const assert=require('assert');
let st=DL.newTournament({names:['A','B','C','D','E','F']});
// first hand: button at 0 -> SB 1, BB 2, first 3
DL.startHand(st);let s=DL.seats(st);assert.deepStrictEqual([s.dealer,s.sb,s.bb,s.firstPre],[0,1,2,3]);
assert.strictEqual(st.players[1].stack,980);assert.strictEqual(st.players[2].stack,960);assert.strictEqual(DL.potTotal(st),60);
console.log('pos',JSON.stringify(DL.positionNames(st)));
// everyone folds to BB
[3,4,5,0,1].forEach(i=>DL.act(st,i,'fold'));assert.ok(st.hand.done);
DL.award(st,[[2]]);assert.strictEqual(st.players[2].stack,1020);assert.strictEqual(DL.totals(st).chips,6000);
// hand 2: button moves to 1
DL.startHand(st);s=DL.seats(st);assert.deepStrictEqual([s.dealer,s.sb,s.bb],[1,2,3]);
// side pots: set stacks small for C (2) and D (3)
// D is BB posted 40 (stack 960). Make all-in scenario: E (4) all-in 1000, F folds, A calls, B folds, C all-in (980), D calls all-in
DL.act(st,4,'allin');DL.act(st,5,'fold');DL.act(st,0,'call');DL.act(st,1,'fold');DL.act(st,2,'allin');DL.act(st,3,'allin');
const P=DL.pots(st);console.log('pots',JSON.stringify(P));
assert.strictEqual(P.reduce((a,p)=>a+p.amount,0),DL.potTotal(st));
// winners: main pot D(3), side pots to A(0)
const ids=st.players.map(p=>p.id);
const busted=DL.award(st,P.map((p,k)=>k===0?[3]:[0]));console.log('busted',busted.map(p=>p.name+'#'+p.place).join(','),'stacks',st.players.map(p=>p.name+':'+p.stack).join(' '));
assert.strictEqual(DL.totals(st).chips,6000);
// heads-up check
let h=DL.newTournament({names:['X','Y']});DL.startHand(h);s=DL.seats(h);assert.deepStrictEqual([s.dealer,s.sb,s.bb,s.firstPre,s.firstPost],[0,0,1,0,1]);
// split pot odd chip
let t=DL.newTournament({names:['A','B','C']});DL.startHand(t);// btn0 sb1 bb2
DL.act(t,0,'raise',101);DL.act(t,1,'call');DL.act(t,2,'call');DL.act(t,1,'fold'); // B folds? already called; folded after contributions
console.log('tot',DL.potTotal(t),JSON.stringify(DL.pots(t)));
DL.award(t,[[0,2]]);console.log(t.players.map(p=>p.stack).join(' '),'sum',DL.totals(t).chips);
// timer
let tm=DL.newTournament({minutes:10});DL.timerStart(tm,0);DL.timerNow(tm,10*60000+5);assert.strictEqual(tm.timer.level,1);DL.timerNow(tm,100*60000);assert.strictEqual(tm.timer.level,4);
DL.timerPause(tm,100*60000);console.log('remaining',tm.timer.remaining);
console.log('prizes',JSON.stringify(DL.prizes(st)));
// registro azioni (Sistema Jev)
let r=DL.newTournament({names:['A','B','C','D']});DL.startHand(r);// btn0 sb1 bb2, primo a parlare 3
DL.act(r,3,'raise',100);DL.act(r,0,'call');DL.act(r,1,'fold');DL.act(r,2,'raise',300);DL.act(r,3,'call');DL.act(r,0,'fold');
let A=r.hand.acts;
assert.deepStrictEqual(A.map(a=>[a.i,a.t,a.tc,a.nr,a.up]),[[3,'raise',40,0,true],[0,'call',100,1,false],[1,'fold',80,1,false],[2,'raise',60,1,true],[3,'call',200,2,false],[0,'fold',200,2,false]]);
assert.strictEqual(A[3].full,true);
DL.nextStreet(r);DL.act(r,2,'call');DL.act(r,3,'raise',200);DL.act(r,2,'fold');
assert.deepStrictEqual(r.hand.acts.slice(6).map(a=>[a.i,a.s,a.t,a.tc,a.nr,a.up]),[[2,1,'call',0,0,false],[3,1,'raise',0,0,true],[2,1,'fold',200,1,false]]);
DL.award(r,[[3]]);assert.strictEqual(r.hands.length,1);assert.strictEqual(r.hands[0].acts.length,9);assert.deepStrictEqual(r.hands[0].players,[0,1,2,3]);
assert.strictEqual(r.hands[0].dealer,0);assert.strictEqual(DL.totals(r).chips,4000);
// all-in incompleto: full=false
let q=DL.newTournament({names:['A','B','C'],startStack:1000});q.players[0].stack=1000;DL.startHand(q);// btn0 sb1 bb2
DL.act(q,0,'raise',200);q.players[1].stack=230-20;DL.act(q,1,'allin');// sb mette in tutto 230: rilancio di 30 < 160
assert.strictEqual(q.hand.acts[1].up,true);assert.strictEqual(q.hand.acts[1].full,false);
console.log('ALL OK');
