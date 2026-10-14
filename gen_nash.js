// Generates push/fold Nash ranges (chip EV, no ante) for N = 2..10 players, all pusher positions,
// stack grid in BB. Output: nash.json { S:[...], keys:[169], d: { "N": [ posIdx: [ sIdx: {p:hex, c:[hex per caller]} ] ] } }
const {keys,M}=require('./matrix.json');const ADV=require('./advice.js');
const n=keys.length;const W=keys.map(k=>k.length===2?6:k[2]==='s'?4:12);
const Mf=Float64Array.from(M);
function eqVs(h,rng,wsum){let s=0;const base=h*n;for(let x=0;x<n;x++){const a=rng[x];if(a)s+=a*Mf[base+x];}return s/wsum;}
function blindOf(p){return p==='SB'||p==='SB/BTN'?0.5:p==='BB'?1:0;}
function solve(N,idx,S){
  const pos=ADV.positions(N);const bh=blindOf(pos[idx]);const callers=pos.slice(idx+1);
  const push=new Float64Array(n).fill(0.3);const calls=callers.map(()=>new Float64Array(n).fill(0.1));
  const T=300;const wp=new Float64Array(n),wc=callers.map(()=>new Float64Array(n));
  for(let t=1;t<=T;t++){
    const lr=1/(t+1);
    let ws=0;for(let x=0;x<n;x++){wp[x]=W[x]*push[x];ws+=wp[x];}
    callers.forEach((c,j)=>{const bc=blindOf(c);const pot=2*S+1.5-bh-bc;
      for(let h=0;h<n;h++){const br=ws>0&&eqVs(h,wp,ws)*pot>S-bc?1:0;calls[j][h]+=lr*(br-calls[j][h]);}});
    const pc=[],wcs=[];
    callers.forEach((c,j)=>{let s=0;for(let x=0;x<n;x++){wc[j][x]=W[x]*calls[j][x];s+=wc[j][x];}wcs.push(s);pc.push(s/1326);});
    for(let h=0;h<n;h++){
      let pNone=1,ev=0;
      for(let j=0;j<callers.length;j++){const bc=blindOf(callers[j]);const pot=2*S+1.5-bh-bc;const pj=pNone*pc[j];if(pj>0)ev+=pj*eqVs(h,wc[j],wcs[j])*pot;pNone*=(1-pc[j]);}
      ev+=pNone*(S-bh+1.5);
      push[h]+=lr*((ev>S-bh?1:0)-push[h]);
    }
  }
  return {push,calls};
}
function hex(r){let bits='';for(let x=0;x<n;x++)bits+=r[x]>=0.5?'1':'0';while(bits.length%4)bits+='0';let h='';for(let i=0;i<bits.length;i+=4)h+=parseInt(bits.substr(i,4),2).toString(16);return h;}
const SG=[2,3,4,5,6,7,8,9,10,12,14,16,18,20];
const out={S:SG,keys,d:{}};let t=Date.now();
for(let N=2;N<=10;N++){
  const pos=ADV.positions(N);out.d[N]=[];
  for(let i=0;i<pos.length-1;i++){out.d[N][i]=SG.map(S=>{const r=solve(N,i,S);return {p:hex(r.push),c:r.calls.map(hex)};});}
  console.log('N',N,'done',((Date.now()-t)/1000).toFixed(0)+'s');
}
require('fs').writeFileSync('nash.json',JSON.stringify(out));
