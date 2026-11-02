"use strict";
/* ---------- constants ---------- */
const SUBJ=[{k:'phy',n:'Physics',e:'⚛️',bio:0},{k:'chem',n:'Chemistry',e:'🧪',bio:0},{k:'zoo',n:'Zoology',e:'🐸',bio:1},{k:'bot',n:'Botany',e:'🌿',bio:1}];
const SBY=Object.fromEntries(SUBJ.map(s=>[s.k,s]));
const MTYPES=[{k:'concept',n:'Concept gap',e:'🧠',c:'var(--phy)'},{k:'silly',n:'Silly mistake',e:'🤦',c:'var(--chem)'},{k:'norev',n:'Did not revise',e:'📕',c:'var(--bot)'},{k:'time',n:'Time pressure',e:'⏱️',c:'var(--red)'}];
const DAY=864e5, LSKEY='neet27-planner-v1';

/* ---------- dates (all dates stored as day numbers) ---------- */
const pad=n=>String(n).padStart(2,'0');
function toDn(iso){const [y,m,d]=iso.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/DAY)}
function toIso(dn){return new Date(dn*DAY).toISOString().slice(0,10)}
function today(){const t=new Date();return Math.round(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/DAY)}
const wd=dn=>new Date(dn*DAY).getUTCDay();
/* Date text is cached: building it is slow and the same dates repeat on every screen. */
const FMTF=new Map(),FMTC=new Map();
function fmt(dn,o){const ok=JSON.stringify(o),key=dn+ok;let v=FMTC.get(key);if(v===undefined){let f=FMTF.get(ok);if(!f){f=new Intl.DateTimeFormat('en-IN',Object.assign({timeZone:'UTC'},o));FMTF.set(ok,f)}v=f.format(new Date(dn*DAY));FMTC.set(key,v)}return v}
const fShort=dn=>fmt(dn,{weekday:'short',day:'numeric',month:'short'});
const fDM=dn=>fmt(dn,{day:'numeric',month:'short'});
const fLong=dn=>fmt(dn,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function ymBounds(ym){const [y,m]=ym.split('-').map(Number);return {f:Math.round(Date.UTC(y,m-1,1)/DAY),l:Math.round(Date.UTC(y,m,0)/DAY)}}
function shiftYm(ym,d){const [y,m]=ym.split('-').map(Number);return new Date(Date.UTC(y,m-1+d,1)).toISOString().slice(0,7)}
function ymLabel(ym){const [y,m]=ym.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'})}
/* A week runs Monday→Sunday and belongs to the month that holds 4 or more of its 7 days,
   which is always the month its Thursday falls in. Every week belongs to exactly one month. */
const monOf=dn=>dn-((wd(dn)+6)%7);
function weeksOf(ym){const {f,l}=ymBounds(ym);let th=f+((11-wd(f))%7);const out=[];let i=1;while(th<=l){out.push({i,start:th-3,end:th+3});th+=7;i++}return out}
const planYmOf=dn=>toIso(monOf(dn)+3).slice(0,7);
/* Until Nov 2026 a week belonged to the month of its Sunday. Plans saved under that rule are moved once to the matching new week. */
const WEEK_RULE=2;
function oldWeeksOf(ym){const {f,l}=ymBounds(ym);let su=f+((7-wd(f))%7);const out=[];let i=1;while(su<=l){out.push({i,start:su-6,end:su});su+=7;i++}return out}
function migrateWeeks(st){if((st.settings.weekRule||1)>=WEEK_RULE)return false;const nw={};
  Object.keys(st.plans).forEach(ym=>{const p=st.plans[ym]||{};const W=oldWeeksOf(ym);Object.keys(p.weeks||{}).forEach(i=>{const src=p.weeks[i]||{};const w=W.find(x=>x.i===+i);
    const to=w?{ym:planYmOf(w.start),i:weeksOf(planYmOf(w.start)).find(x=>w.start>=x.start&&w.start<=x.end).i}:{ym,i:+i};
    const d=((nw[to.ym]=nw[to.ym]||{})[to.i]=nw[to.ym][to.i]||{t:{},rev:[]});
    Object.entries(src.t||{}).forEach(([id,n])=>d.t[id]=(+d.t[id]||0)+(+n||0));(src.rev||[]).forEach(id=>{if(!d.rev.includes(id))d.rev.push(id)})})});
  Object.keys(st.plans).forEach(ym=>{if(st.plans[ym])st.plans[ym].weeks=nw[ym]||{}});
  Object.keys(nw).forEach(ym=>{if(!st.plans[ym])st.plans[ym]={newCh:[],rev:[],old:[],weeks:nw[ym]}});
  st.settings.weekRule=WEEK_RULE;return true}
function weekOfDn(dn){const ym=planYmOf(dn);const w=weeksOf(ym).find(w=>dn>=w.start&&dn<=w.end);return {ym,i:w.i}}
function monthRange(ym){const W=weeksOf(ym);return {a:W[0].start,b:W[W.length-1].end}}

/* ---------- helpers ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pct=(a,b)=>b?Math.round(100*a/b):0;
const L2=n=>pad(n);
function $(id){return document.getElementById(id)}
function numOrNull(v){if(v===''||v==null)return null;const n=Number(v);return isFinite(n)?n:null}
const EARLY=1; /* date used for progress done before using the app */
const fWhen=dn=>dn===EARLY?'earlier':fDM(dn);
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function stable(v){if(v===null||v===undefined||typeof v!=='object')return JSON.stringify(v??null);if(Array.isArray(v))return'['+v.map(stable).join(',')+']';return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}'}
/* Speed: results are remembered until the data changes. GEN goes up on every tap, save and sync. */
let GEN=0;const MEMO={g:-1,m:{}};
function memo(name){if(MEMO.g!==GEN){MEMO.g=GEN;MEMO.m={}}return MEMO.m[name]||(MEMO.m[name]=new Map())}

/* ---------- state ---------- */
function fresh(){return{
  settings:{examDate:'',theme:'auto',sound:true,vol:0.7,plannerLoaded:false,plannerVer:1,ncertLoaded:false,src:{
    phy:{dpp:'PW DPP',qb:'NEETprep Questions'},chem:{dpp:'PW DPP',qb:'NEETprep Questions'},
    zoo:{dpp:'PW DPP',qb:'NEETprep Questions',combo:'Combo Master Class QB'},bot:{dpp:'PW DPP',qb:'NEETprep Questions',combo:'Combo Master Class QB'}}},
  ch:{phy:[],chem:[],zoo:[],bot:[]},tests:[],plans:{},days:{},mis:{}}}
let S=fresh();
function normalize(st){const f=fresh();const o=Object.assign(f,st||{});
  o.settings=Object.assign(fresh().settings,(st||{}).settings||{});o.settings.src=Object.assign(fresh().settings.src,o.settings.src||{});
  o.ch=Object.assign(fresh().ch,o.ch||{});o.tests=o.tests||[];o.plans=o.plans||{};o.days=o.days||{};o.mis=o.mis||{};return o}

/* ---------- saving ---------- */
function docKeys(){const k=['settings','tests','plans',...SUBJ.map(s=>'ch-'+s.k)];Object.keys(S.days).forEach(m=>k.push('days-'+m));Object.keys(S.mis).forEach(m=>k.push('mis-'+m));return k}
function getDocVal(k){if(k==='settings')return S.settings;if(k==='tests')return S.tests;if(k==='plans')return S.plans;
  if(k.startsWith('ch-'))return S.ch[k.slice(3)]||[];if(k.startsWith('days-'))return S.days[k.slice(5)]??null;if(k.startsWith('mis-'))return S.mis[k.slice(4)]??null;return null}
function applyDoc(k,v){GEN++;v=clone(v);
  if(k.startsWith('days-')){const m=k.slice(5);if(v==null)delete S.days[m];else S.days[m]=v;return}
  if(k.startsWith('mis-')){const m=k.slice(4);if(v==null)delete S.mis[m];else S.mis[m]=v;return}
  if(v==null)return;
  if(k==='settings'){S.settings=normalize({settings:v}).settings;return}
  if(k==='tests'){S.tests=v;return} if(k==='plans'){S.plans=v;return}
  if(k.startsWith('ch-')&&SBY[k.slice(3)])S.ch[k.slice(3)]=v;
}
/* Old single-copy storage. Only used if this browser cannot open IndexedDB, and read once to move older data in. */
function saveLocal(){try{localStorage.setItem(LSKEY,JSON.stringify(S))}catch(e){}}
function loadLocal(){try{const t=localStorage.getItem(LSKEY);if(t){S=normalize(JSON.parse(t));GEN++;return true}}catch(e){}return false}
/* Every change is written to this device first (only the parts that changed), then sent to your account when you are signed in.
   local = parts waiting to be written on this device · dirty = parts waiting to be sent to your account */
const store={mode:'pending',dirty:new Set(),local:new Set(),timer:null,ltimer:null,busy:false,last:{},at:{},err:0,idb:true,cursor:null,pulling:false,synced:0,
  mark(...keys){GEN++;const now=Date.now();keys.forEach(k=>{this.local.add(k);this.at[k]=now;if(this.mode==='cloud')this.dirty.add(k)});this.saveSoon();
    if(this.mode==='cloud'){saveUi('saving');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),700)}else if(this.mode==='local')saveUi()},
  markAll(){const ks=new Set([...docKeys(),...Object.keys(this.at)]);this.mark(...ks)},
  saveSoon(){clearTimeout(this.ltimer);this.ltimer=setTimeout(()=>this.writeLocal(),250)},
  async writeLocal(){clearTimeout(this.ltimer);if(!this.local.size&&!this.metaDirty)return;const keys=[...this.local];this.local.clear();this.metaDirty=false;
    if(!this.idb){saveLocal();return}
    try{await IDB.putMany('docs',keys.map(k=>{const v=getDocVal(k);return[k,v==null?undefined:{v,at:this.at[k]||Date.now()}]}));
      await IDB.putMany('meta',[['pending',[...this.dirty]],['cursor',this.cursor]])}
    catch(e){console.error(e);this.idb=false;saveLocal()}},
  async flush(){if(this.mode!=='cloud'||this.busy||!CLOUD.sess)return;if(!navigator.onLine){saveUi('offline');return}this.busy=true;let keys=[];
    try{while(this.dirty.size){keys=[...this.dirty].slice(0,20);keys.forEach(k=>this.dirty.delete(k));
        const rows=keys.map(k=>{const v=getDocVal(k);this.last[k]=stable(v);return{user_id:CLOUD.sess.uid,k,v:v===undefined?null:v,at:this.at[k]||Date.now()}});
        await CLOUD.push(rows);keys=[]}
      this.err=0;this.synced=Date.now();this.metaDirty=true;this.saveSoon();saveUi('saved')}
    catch(e){keys.forEach(k=>this.dirty.add(k));this.metaDirty=true;this.saveSoon();this.err++;
      if(!navigator.onLine){saveUi('offline')}
      else if(e&&e.code==='auth'){saveUi('error');toast('⚠️ Please sign in again in ⚙️ Settings to keep syncing.','err')}
      else{saveUi('error',e);setTimeout(()=>this.flush(),Math.min(30000,3000*this.err))}}
    finally{this.busy=false;if(this.dirty.size&&!this.err)this.flush()}},
  /* Bring in changes made on your other devices. Parts you changed here and have not sent yet are kept. */
  async pull(){if(this.mode!=='cloud'||this.pulling||!CLOUD.sess||!navigator.onLine)return;this.pulling=true;
    try{const rows=await CLOUD.pull(this.cursor);let ch=false;const put=[];
      rows.forEach(r=>{if(r.updated_at&&(!this.cursor||r.updated_at>this.cursor))this.cursor=r.updated_at;const k=r.k;if(this.dirty.has(k)||this.local.has(k))return;
        const js=stable(r.v??null);if(this.last[k]===js)return;if(this.at[k]&&r.at<this.at[k]&&this.last[k]!==undefined)return;
        this.last[k]=js;this.at[k]=r.at;applyDoc(k,r.v);put.push(k);ch=true});
      if(put.length){put.forEach(k=>this.local.add(k))}this.metaDirty=true;await this.writeLocal();this.synced=Date.now();
      if(ch){applyTheme();softRender()}else saveUi(this.dirty.size?'saving':'saved')}
    catch(e){console.error(e);if(e&&e.code==='auth')saveUi('error')}
    finally{this.pulling=false}},
  /* First sign-in on this device: if your account is empty, this device's data is sent up; otherwise your account's data is loaded here. */
  async connect(){const rows=await CLOUD.pull(null);this.mode='cloud';
    if(!rows.length){if(SUBJ.some(s=>S.ch[s.k].length)||S.tests.length)this.markAll()}
    else{const keep={};this.dirty.forEach(k=>keep[k]=clone(getDocVal(k)));const old=Object.keys(this.at);S=fresh();GEN++;this.at={};
      rows.forEach(r=>{if(!this.cursor||r.updated_at>this.cursor)this.cursor=r.updated_at;this.last[r.k]=stable(r.v??null);this.at[r.k]=r.at;applyDoc(r.k,r.v)});
      Object.keys(keep).forEach(k=>applyDoc(k,keep[k]));old.forEach(k=>this.local.add(k));Object.keys(this.at).forEach(k=>this.local.add(k));
      if(migrateWeeks(S))this.mark('plans','settings');await this.writeLocal()}
    this.synced=Date.now();applyTheme();render();if(this.dirty.size)this.flush()}
};
function saveUi(state){const el=$('topsub');if(!el)return;
  const ex=examDays();const cd=ex!=null?`⏳ ${ex} days to NEET · `:'';
  if(state==null&&store.mode==='cloud')state=!navigator.onLine&&store.dirty.size?'offline':store.dirty.size?'saving':'saved';
  let s;if(store.mode==='cloud')s=state==='offline'?'📴 Offline · saved on this device, syncs later':state==='saving'?'Saving…':state==='error'?'⚠️ Not synced yet, retrying':'☁️ Synced to your account';
  else if(store.mode==='local')s='📱 Saved on this device only';else s='Opening…';
  el.textContent=cd+s;
  const b=$('savebtn'),l=$('savelbl');if(b&&l){const dirty=UNSAVED||state==='saving'||(state!=='offline'&&store.dirty.size>0);const bad=state==='error';
    l.textContent=bad?'Retry':state==='saving'&&!UNSAVED?'Saving…':dirty?'Save':'Saved';b.className='savebtn '+(bad?'bad':dirty?'dirty':'done');
    b.title=bad?'Not saved yet. Tap to try again':dirty?'Save the change now':'All changes are saved'}}
let UNSAVED=false; /* true while a typed field has not been committed yet */
document.addEventListener('input',e=>{const el=e.target.closest('[data-chg]');if(el&&/INPUT|TEXTAREA/.test(el.tagName)&&el.type!=='file'&&!UNSAVED){UNSAVED=true;saveUi()}});
document.addEventListener('change',e=>{if(e.target.closest('[data-chg]')&&UNSAVED){UNSAVED=false;setTimeout(()=>saveUi(store.dirty.size?'saving':'saved'),0)}},true);
async function saveNow(){const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))a.blur();UNSAVED=false;
  await store.writeLocal();
  if(store.mode==='cloud'){clearTimeout(store.timer);if(!navigator.onLine){saveUi('offline');toast('Saved on this device 📱 It syncs when you are online.','save');return}
    saveUi('saving');let n=0;while(store.busy&&n++<100)await new Promise(r=>setTimeout(r,100));await store.flush();
    if(!store.dirty.size&&!store.err){saveUi('saved');toast('All changes saved ☁️','save')}else toast('⚠️ Saved on this device, not synced yet. Check your internet and tap Save again.','err')}
  else{saveUi();toast(store.mode==='local'?'Saved on this device 📱':'Saved ✅','save')}}

/* ---------- chapters ---------- */
const steps=s=>SBY[s].bio?['w','l','d','q','c']:['w','l','d','q'];
function stepName(s,st){const src=S.settings.src[s]||{};return{w:'🎬 Watch lecture',l:'📖 Learn lecture',d:'📝 '+(src.dpp||'DPP'),q:'❓ '+(src.qb||'Question bank'),c:'🧩 '+(src.combo||'Combo Master Class QB')}[st]}
function stepShort(s,st){const src=S.settings.src[s]||{};return{w:'Watch',l:'Learn',d:src.dpp||'DPP',q:src.qb||'QB',c:src.combo||'Combo'}[st]}
function findCh(id){const m=memo("ch");if(!m.size)SUBJ.forEach(s=>S.ch[s.k].forEach(c=>{if(!m.has(c.id))m.set(c.id,{c,s:s.k})}));return m.get(id)||null}
function lecDone(c,s,n){const p=c.p[n];if(!p)return 0;let mx=0;for(const st of steps(s)){if(!p[st])return 0;mx=Math.max(mx,p[st])}return mx}
function chStats(c,s){let done=0,any=!!c.sheet;for(let n=1;n<=c.lec;n++){if(lecDone(c,s,n))done++;if(c.p[n]&&Object.keys(c.p[n]).length)any=true}return{done,total:c.lec,any,allLec:c.lec>0&&done>=c.lec}}
const chPct=(c,s)=>c.lec?pct(chStats(c,s).done,c.lec):0;
function testChapters(t){const m=memo("tc");if(m.has(t))return m.get(t);const out=[];m.set(t,out);SUBJ.forEach(s=>{const es=t.syl?.[s.k]||[];if(!es.length)return;const sets=es.map(e=>entryChIds(s.k,e));S.ch[s.k].forEach(c=>{if(sets.some(z=>z.has(c.id)))out.push({c,s:s.k})})});return out}
/* Which of your chapters one syllabus line matches. Kept until a chapter is added, renamed or removed. */
const ECM=new Map();
function chSig(s){const m=memo("sig");let v=m.get(s);if(v===undefined){v=S.ch[s].map(c=>c.id+""+c.name).join("");m.set(s,v)}return v}
function entryChIds(s,e){const sig=chSig(s),k=s+""+e;let x=ECM.get(k);if(!x||x.sig!==sig){x={sig,ids:new Set(S.ch[s].filter(c=>entryMatches(e,c.name)).map(c=>c.id))};ECM.set(k,x)}return x.ids}
function chStatus(c,s){if(c.done)return'done';return chStats(c,s).any?'prog':'none'}
function nextLec(c,s){for(let n=1;n<=c.lec;n++)if(!lecDone(c,s,n))return n;return 0}
function doneInRange(c,s,a,b){let k=0;for(let n=1;n<=c.lec;n++){const d=lecDone(c,s,n);if(d&&d>=a&&d<=b)k++}return k}
const revIn=(c,a,b)=>(c.revs||[]).some(d=>d>=a&&d<=b);
function chLabel(id){const f=findCh(id);return f?f.c.name:'(deleted chapter)'}
const NNM=new Map();function normName(x){x=String(x);let v=NNM.get(x);if(v===undefined){v=normName0(x);NNM.set(x,v)}return v}
function normName0(x){return String(x).toLowerCase().replace(/isation/g,'ization').replace(/\(complete chapter\)/g,' ').replace(/&/g,' ').split(/[^a-z]+/).filter(w=>w&&!['of','and','the','in','a','an','its','their'].includes(w)).map(w=>w.length>3&&w.endsWith('s')?w.slice(0,-1):w).join('')}
const NAME_ALIAS={[normName('Centre of mass and System of Particles')]:normName('System of Particles and Rotational Motion')};
const EMM=new Map();function entryMatches(entry,chName){const k=entry+""+chName;let v=EMM.get(k);if(v===undefined){v=entryMatches0(entry,chName);EMM.set(k,v)}return v}
function entryMatches0(entry,chName){const cn=normName(chName);if(cn.length<4)return false;let full=normName(entry),key=normName(String(entry).split(':')[0]);full=NAME_ALIAS[full]||full;key=NAME_ALIAS[key]||key;
  if(full.startsWith('organicchemistry')&&cn.startsWith('organicchemistry'))return true;return key===cn||full.includes(cn)||(full.length>=8&&cn.includes(full))}
/* Every chapter named in a set of tests, per subject, matched to your chapter list where possible. */
const sylBase=e=>String(e).split(':')[0].replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
function sylNotes(e,all){const s=String(e),n=[];(s.match(/\(([^)]*)\)/g)||[]).forEach(p=>{const t=p.slice(1,-1).trim();if(t&&!/^complete chapter$/i.test(t))n.push(t)});
  const i=s.indexOf(':');if(i>=0){let r=s.slice(i+1).replace(/\([^)]*\)/g,'').trim();if(!all&&r.length>160)r=r.slice(0,157)+'…';if(r)n.push(r)}return n}
/* Kept per syllabus line until a chapter is added, renamed or removed. */
const MCH=new Map();
function matchCh(s,e){const sig=chSig(s),k=s+""+e;let x=MCH.get(k);if(x&&x.sig===sig)return x.id?findCh(x.id)?.c||null:null;
  let hit=S.ch[s].find(c=>entryMatches(e,c.name));if(!hit){const b=normName(sylBase(e));hit=b.length>=8?S.ch[s].find(c=>normName(c.name).includes(b))||null:null}MCH.set(k,{sig,id:hit?hit.id:null});return hit||null}
function monthSyllabus(tests){const out={full:{},total:0};
  SUBJ.forEach(s=>{const map=new Map();
    tests.forEach(t=>(t.syl?.[s.k]||[]).forEach(e=>{if(/full syllabus/i.test(e)){(out.full[s.k]=out.full[s.k]||[]).includes(t.name)||out.full[s.k].push(t.name);return}
      const ch=matchCh(s.k,e),base=sylBase(e)||String(e),key=ch?ch.id:'n:'+normName(base);
      let x=map.get(key);if(!x){x={ch,base,notes:[],tests:[]};map.set(key,x)}
      sylNotes(e).forEach(n=>{if(!x.notes.includes(n))x.notes.push(n)});if(!x.tests.includes(t.name))x.tests.push(t.name)}));
    out[s.k]=[...map.values()].sort((a,b)=>a.ch&&b.ch?S.ch[s.k].indexOf(a.ch)-S.ch[s.k].indexOf(b.ch):a.ch?-1:b.ch?1:0);out.total+=out[s.k].length});
  return out}
function plannerNames(s){const set=new Set();S.tests.forEach(t=>(t.syl?.[s]||[]).forEach(x=>{if(/\(Complete Chapter\)\s*$/i.test(x))set.add(x.replace(/\s*\(Complete Chapter\)\s*$/i,''))}));return[...set]}

/* ---------- tests ---------- */
const tDn=t=>t.date?toDn(t.date):null;
const byDate=(a,b)=>(tDn(a)??-1e9)-(tDn(b)??-1e9);
const testById=id=>S.tests.find(t=>t.id===id);
function pendingOld(ref){ref=ref??today();const m=memo("po");let r=m.get(ref);if(!r){r=S.tests.filter(t=>!t.given&&(!t.date||tDn(t)<ref)).sort(byDate);m.set(ref,r)}return r}
function upcomingTests(){const td=today();return S.tests.filter(t=>!t.given&&t.date&&tDn(t)>=td).sort(byDate)}
function testsInRange(a,b){if(a===b){const m=memo("td");if(!m.size){m.set("x",1);S.tests.forEach(t=>{if(t.date){const d=tDn(t);(m.get(d)||m.set(d,[]).get(d)).push(t)}})}return(m.get(a)||[]).slice()}
  return S.tests.filter(t=>t.date&&tDn(t)>=a&&tDn(t)<=b).sort(byDate)}
function scorePct(t){const m=t.m||{};return m.score!=null&&m.max?Math.round(1000*m.score/m.max)/10:null}
function satTest(dn){if(wd(dn)!==6)return null;const r=dayRec(dn);
  if(r&&r.oldTest){const t=testById(r.oldTest);if(t)return t}
  const g=S.tests.find(t=>t.given===dn&&t.date&&tDn(t)<dn);if(g)return g;
  const p=S.plans[planYmOf(dn)];const planned=(p?.old||[]).map(testById).filter(t=>t&&!t.given).sort(byDate);
  if(planned.length)return planned[0];return pendingOld(dn)[0]||null}
function dayTests(dn){const out=testsInRange(dn,dn).map(t=>({t,kind:'up'}));const st=satTest(dn);if(st&&!out.some(x=>x.t===st))out.unshift({t:st,kind:'old'});return out}
function weekSat(ym,w){const sat=w.end-1,td=today();if(sat<=td)return{t:satTest(sat),sat,proj:false};
  const p=S.plans[ym];const planned=(p?.old||[]).map(testById).filter(t=>t&&!t.given).sort(byDate);
  const fut=weeksOf(ym).map(x=>x.end-1).filter(s=>s>td);let off=0;
  if(wd(td)===6){const tt=satTest(td);if(tt&&!tt.given&&planned.includes(tt))off=1}
  return{t:planned[fut.indexOf(sat)+off]||null,sat,proj:true}}

/* ---------- days ---------- */
function dayRec(dn,create){const iso=toIso(dn),m=iso.slice(0,7);let M=S.days[m];if(!M){if(!create)return null;M=S.days[m]={}}
  let r=M[iso];if(!r&&create)r=M[iso]={items:[],note:''};return r||null}
const dayKey=dn=>'days-'+toIso(dn).slice(0,7);
function itemUnits(it,dn){const f=findCh(it.ch);if(!f)return[];const c=f.c;
  if(it.k==='lec')return it.st.map(st=>{const v=c.p[it.n]?.[st];return!!v&&v<=dn});
  if(it.k==='sheet')return[!!c.sheet&&c.sheet<=dn];
  if(it.k==='done')return[!!c.done&&c.done<=dn];
  if(it.k==='rev')return[(c.revs||[]).includes(dn)];return[]}
function dayUnits(dn){const r=dayRec(dn);const U=[];(r?.items||[]).forEach(it=>U.push(...itemUnits(it,dn)));dayTests(dn).forEach(x=>U.push(!!x.t.given&&x.t.given<=dn));return U}
function dayPct(dn){const m=memo("dp");if(m.has(dn))return m.get(dn);const U=dayUnits(dn);const r=U.length?pct(U.filter(Boolean).length,U.length):null;m.set(dn,r);return r}
function streak(){const td=today();let d=dayPct(td)===100?td:td-1,k=0;while(k<3000&&dayPct(d)===100){k++;d--}return k}
function examDays(){if(!S.settings.examDate)return null;return toDn(S.settings.examDate)-today()}

/* ---------- plans ---------- */
function plan(ym,create){let p=S.plans[ym];if(!p&&create)p=S.plans[ym]={newCh:[],rev:[],old:[],weeks:{}};
  if(p){p.newCh=p.newCh||[];p.rev=p.rev||[];p.old=p.old||[];p.weeks=p.weeks||{}}return p||{newCh:[],rev:[],old:[],weeks:{}}}
function wkOf(p,i){return p.weeks[i]||(p.weeks[i]={t:{},rev:[]})}
function prevLeft(ym,id){const pym=shiftYm(ym,-1),pp=S.plans[pym];if(!pp)return 0;const it=(pp.newCh||[]).find(x=>x.id===id);if(!it)return 0;
  const f=findCh(id);if(!f)return 0;let t=0;weeksOf(pym).forEach(w=>t+=+(pp.weeks?.[w.i]?.t?.[id]||0));if(!t)t=+it.target||0;
  const r=monthRange(pym);return Math.max(0,t-doneInRange(f.c,f.s,r.a,r.b))}
function prevLeftovers(ym){const pp=S.plans[shiftYm(ym,-1)];if(!pp)return[];const cur=plan(ym);
  return(pp.newCh||[]).filter(x=>!cur.newCh.some(y=>y.id===x.id)).map(x=>({id:x.id,left:prevLeft(ym,x.id),kind:x.kind})).filter(x=>x.left>0&&findCh(x.id)&&!findCh(x.id).c.done)}
function lecWeek(ym,i,id){const f=findCh(id);if(!f)return null;const p=plan(ym),W=weeksOf(ym);let cumT=0,cumD=0;
  for(const w of W){if(w.i>=i)break;cumT+=+(p.weeks[w.i]?.t?.[id]||0);cumD+=doneInRange(f.c,f.s,w.start,w.end)}
  const carry=prevLeft(ym,id);const back=Math.max(0,carry+cumT-cumD);const w=W.find(x=>x.i===i);
  const tgt=+(p.weeks[i]?.t?.[id]||0);const done=doneInRange(f.c,f.s,w.start,w.end);return{f,tgt,back,done,need:tgt+back}}
function revWeek(ym,i){const p=plan(ym),W=weeksOf(ym),w=W.find(x=>x.i===i);const cur=[...(p.weeks[i]?.rev||[])];const back=[];
  W.filter(x=>x.i<i).forEach(x=>(p.weeks[x.i]?.rev||[]).forEach(id=>{const f=findCh(id);if(f&&!revIn(f.c,x.start,w.start-1)&&!cur.includes(id)&&!back.includes(id))back.push(id)}));
  return{cur,back,w}}
function weekProgress(ym,i){const p=plan(ym),W=weeksOf(ym),w=W.find(x=>x.i===i);let ln=0,ld=0;
  p.newCh.forEach(it=>{const r=lecWeek(ym,i,it.id);if(r){ln+=r.need;ld+=Math.min(r.done,r.need)}});
  const rv=revWeek(ym,i);const rAll=[...rv.cur,...rv.back];const rd=rAll.filter(id=>{const f=findCh(id);return f&&revIn(f.c,w.start,w.end)}).length;
  const ts=testsInRange(w.start,w.end);const sat=weekSat(ym,w);const tl=[...ts];if(sat.t&&!tl.includes(sat.t))tl.push(sat.t);
  const td=tl.filter(t=>t.given).length;
  const tot=ln+rAll.length+tl.length,dn=ld+rd+td;return{ln,ld,rn:rAll.length,rd,tn:tl.length,td,pc:tot?pct(dn,tot):null}}
function monthProgress(ym){const p=plan(ym),r=monthRange(ym);let ln=0,ld=0;
  p.newCh.forEach(it=>{const f=findCh(it.id);if(!f)return;const t=+it.target||0;ln+=t;ld+=Math.min(t,doneInRange(f.c,f.s,r.a,r.b))});
  const rd=p.rev.filter(id=>{const f=findCh(id);return f&&revIn(f.c,r.a,r.b)}).length;
  const tl=[...testsInRange(r.a,r.b)];p.old.forEach(id=>{const t=testById(id);if(t&&!tl.includes(t))tl.push(t)});
  const td=tl.filter(t=>t.given).length;const tot=ln+p.rev.length+tl.length;
  return{ln,ld,rn:p.rev.length,rd,tn:tl.length,td,pc:tot?pct(ld+rd+td,tot):null}}

/* ---------- sounds (made in the browser, no files) ---------- */
/* Voices: soft UI clicks (filtered noise), glassy bell notes (sine + bright partial), smooth glides. All through one compressor. */
const SND={ctx:null,out:null,nz:null,played:false,demo:false,
  get(){if(S.settings.sound===false||!(S.settings.vol>0))return null;try{if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const c=this.ctx=new AC();
      const comp=c.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.2;
      this.out=c.createGain();this.out.gain.value=.9;this.out.connect(comp);comp.connect(c.destination);
      const b=c.createBuffer(1,Math.floor(c.sampleRate*.25),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nz=b}
    if(this.ctx.state==='suspended')this.ctx.resume();return this.ctx}catch(e){return null}},
  lv(v){return Math.max(0.0002,v*(S.settings.vol??0.7))},
  env(g,now,v,a,d){g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(this.lv(v),now+a);g.gain.exponentialRampToValueAtTime(0.0001,now+d)},
  bell(f,t0,d,v){const c=this.ctx,now=c.currentTime+t0;[[1,1,'sine'],[2.01,.28,'sine'],[3.98,.08,'triangle']].forEach(([m,a,ty])=>{const o=c.createOscillator(),g=c.createGain();o.type=ty;o.frequency.setValueAtTime(f*m,now);this.env(g,now,v*a,.006,m>1?d*.55:d);o.connect(g);g.connect(this.out);o.start(now);o.stop(now+d+.05)})},
  glide(f1,f2,t0,d,v,ty){const c=this.ctx,now=c.currentTime+t0;const o=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;o.type=ty||'sine';o.frequency.setValueAtTime(f1,now);o.frequency.exponentialRampToValueAtTime(f2,now+d*.8);this.env(g,now,v,.008,d);o.connect(lp);lp.connect(g);g.connect(this.out);o.start(now);o.stop(now+d+.05)},
  click(t0,f,v,d){const c=this.ctx,now=c.currentTime+t0;const s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nz;bp.type='bandpass';bp.frequency.value=f;bp.Q.value=1.4;this.env(g,now,v,.002,d||.035);s.connect(bp);bp.connect(g);g.connect(this.out);s.start(now);s.stop(now+(d||.035)+.02)},
  whoosh(t0,f1,f2,d,v){const c=this.ctx,now=c.currentTime+t0;const s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nz;s.loop=true;bp.type='bandpass';bp.Q.value=.9;bp.frequency.setValueAtTime(f1,now);bp.frequency.exponentialRampToValueAtTime(f2,now+d);this.env(g,now,v,d*.4,d);s.connect(bp);bp.connect(g);g.connect(this.out);s.start(now);s.stop(now+d+.03)},
  play(kind){this.played=true;if(!this.demo&&FX.cele[kind])FX.burst(FX.cele[kind]);if(kind==='on'||kind==='lecture'||kind==='chapter')try{navigator.vibrate&&navigator.vibrate(kind==='on'?8:[12,40,18])}catch(e){}
    const c=this.get();if(!c)return;const B=(...a)=>this.bell(...a),G=(...a)=>this.glide(...a),K=(...a)=>this.click(...a);
    try{switch(kind){
      case 'nav':K(0,2600,.16,.03);B(1318,.005,.09,.035);break;
      case 'tap':K(0,3400,.13,.025);break;
      case 'on':K(0,3000,.14,.02);G(620,1240,0,.09,.13);B(1568,.06,.22,.07);break;
      case 'off':K(0,1800,.11,.02);G(760,380,0,.13,.09);break;
      case 'rev':B(1047,0,.35,.09);B(1568,.08,.45,.08);break;
      case 'add':B(784,0,.22,.08);B(1175,.07,.3,.08);K(0,2800,.08,.02);break;
      case 'remove':G(420,150,0,.18,.12,'triangle');K(0,900,.12,.05);break;
      case 'lecture':[1047,1319,1568,2093].forEach((f,i)=>B(f,i*.075,.45,.085));B(3136,.32,.5,.025);break;
      case 'chapter':[523,659,784].forEach(f=>B(f,0,.7,.06));[1047,1319,1568,2093].forEach((f,i)=>B(f,.14+i*.09,.6,.08));[2637,3136,3520].forEach((f,i)=>B(f,.55+i*.06,.5,.025));this.whoosh(0,600,4200,.5,.05);break;
      case 'test':[784,988,1175].forEach(f=>B(f,0,.8,.05));B(1568,.16,.8,.08);B(1976,.3,.9,.07);this.whoosh(0,800,3000,.4,.04);break;
      case 'up':K(0,3600,.12,.02);B(1760,.004,.06,.03);break;
      case 'down':K(0,2200,.12,.02);B(1175,.004,.06,.03);break;
      case 'open':this.whoosh(0,500,2200,.18,.07);B(988,.05,.18,.04);break;
      case 'close':this.whoosh(0,2000,500,.15,.06);break;
      case 'save':B(1319,0,.25,.07);B(1976,.07,.35,.07);break;
      case 'err':G(330,300,0,.16,.1,'triangle');G(262,240,.15,.22,.1,'triangle');break;
    }}catch(e){}}};
/* Motion helpers: count-from-previous rings and bars, confetti, tap pop. */
const FX={cele:{lecture:1,chapter:2,test:2},x:innerWidth/2,y:innerHeight/2,mem:{},i:0,ctx:'r',
  reduced(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}},
  from(v){const k=this.ctx+'|'+V.tab+'|'+V.day+'|'+V.ym+'|'+V.wk+'|'+V.tt+'|'+V.syl+'|'+V.misF+'|'+(this.i++);const f=this.mem[k];this.mem[k]=v;return f==null?0:f},
  burst(size){if(this.reduced())return;let L=document.querySelector('.fx');if(!L){L=document.createElement('div');L.className='fx';document.body.appendChild(L)}
    const cols=['var(--brand1)','var(--phy)','var(--chem)','var(--zoo)','var(--bot)','var(--warn)'],n=size>1?70:30;
    for(let k=0;k<n;k++){const p=document.createElement('i');p.style.left=this.x+'px';p.style.top=this.y+'px';p.style.background=cols[k%cols.length];if(k%3===0)p.style.borderRadius='50%';L.appendChild(p);
      const a=Math.random()*Math.PI*2,sp=(size>1?220:140)*(.4+Math.random()),dx=Math.cos(a)*sp,dy=Math.sin(a)*sp-(size>1?160:90),r=(Math.random()*720-360);
      const an=p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy+260}px)) rotate(${r}deg) scale(.6)`,opacity:0}],{duration:900+Math.random()*700,easing:'cubic-bezier(.15,.6,.35,1)'});an.onfinish=()=>p.remove()}}};
document.addEventListener('pointerdown',e=>{FX.x=e.clientX;FX.y=e.clientY},{passive:true});
/* Chart tooltip: hover on desktop, tap on phone. Any element with data-tip shows it. */
const TIP={el:null,cur:null,
  show(t,x,y){if(!this.el){this.el=document.createElement('div');this.el.className='tip';this.el.setAttribute('role','status');document.body.appendChild(this.el)}
    this.el.textContent=t;this.el.hidden=false;const r=this.el.getBoundingClientRect();let L=Math.min(Math.max(8,x-r.width/2),innerWidth-r.width-8),T=y-r.height-14;if(T<8)T=y+18;this.el.style.left=L+'px';this.el.style.top=T+'px';this.el.classList.add('on')},
  hide(){if(this.el){this.el.classList.remove('on');this.el.hidden=true}this.cur&&this.cur.classList.remove('tipon');this.cur=null}};
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const t=e.target.closest('[data-tip]');if(!t){TIP.hide();return}if(TIP.cur!==t){TIP.cur&&TIP.cur.classList.remove('tipon');TIP.cur=t;t.classList.add('tipon')}const b=t.getBoundingClientRect();TIP.show(t.dataset.tip,b.left+b.width/2,b.top)});
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const t=e.target.closest('[data-tip]');if(!t){TIP.hide();return}TIP.cur&&TIP.cur.classList.remove('tipon');TIP.cur=t;t.classList.add('tipon');const b=t.getBoundingClientRect();TIP.show(t.dataset.tip,b.left+b.width/2,b.top)},{passive:true});
addEventListener('scroll',()=>TIP.hide(),{passive:true});
const DEFSND={go:'nav',day:'nav',ym:'nav',wk:'nav',tt:'nav',misf:'tap',syl:'tap',gosyl:'nav',addtask:'open',addrev:'open',marks:'open',edittest:'open',addmis:'open',opench:'open',pickold:'open',addnew:'open',addrevm:'open',mtab:'nav',wkadd:'add',wkrm:'remove',mplanas:'add',mkind:'tap',mpf:'tap',wkpick:'open',wkpsave:'add',mrevsave:'add',mnewsave:'add',glass:'tap',
  closem:'close',rmitem:'remove',rmold:'remove',rmnew:'remove',rmrevm:'remove',rmmis:'remove',unrevwk:'remove',msavetask:'add',mrevpick:'add',mrevadd:'add',addch:'add',addleft:'add',addrevid:'add',revwk:'add',mnewsave:'add',mrmsave:'add',carry:'add',
  moldsave:'save',msavetest:'save',msavemis:'save',gsavech:'save',split:'save',export:'save',mdoimport:'save',theme:'tap',movech:'tap',mset:'tap',mstep:'tap',copybk:'tap',mungiven:'off',sndtest:'lecture',snd:'tap'};

/* ---------- view state ---------- */
const V={tab:'today',day:today(),ym:planYmOf(today()),wk:weekOfDn(today()).i,tt:'up',syl:'phy',misF:'all',dv:'ov',rg:8,rvF:'all',mt:'tests'};
let M=null; // open modal
let hostTheme=null;

/* ---------- small renderers ---------- */
const bar=(p,c)=>{const v=clamp(p||0,0,100),f=FX.from(v);return`<div class="bar" ${c?`style="--c:${c}"`:''}><i style="--w0:${f}%;--s0:${v?(f/v).toFixed(3):0};width:${v}%"></i></div>`};
const RC=2*Math.PI*28;
const ring=(p,c,cls)=>{const v=clamp(p||0,0,100),f=FX.from(v);return`<div class="ring ${cls||''}" style="${c?'--c:'+c:''}"><svg viewBox="0 0 68 68" aria-hidden="true"><circle class="tr" cx="34" cy="34" r="28"/><circle class="vl" cx="34" cy="34" r="28" stroke-dasharray="${RC.toFixed(2)}" style="--o0:${(RC*(1-f/100)).toFixed(2)};--o1:${(RC*(1-v/100)).toFixed(2)}"/></svg><span>${p==null?'–':p+'%'}</span></div>`};
const sc=s=>'c-'+s;
function emptyBox(msg,btn){return`<div class="empty">${msg}${btn?`<div style="margin-top:10px">${btn}</div>`:''}</div>`}
function chOptions(filter,sel){return SUBJ.map(s=>{const cs=S.ch[s.k].filter(c=>filter(c,s.k));if(!cs.length)return'';
  return`<optgroup label="${s.e} ${s.n}">${cs.map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('')}</optgroup>`}).join('')}
const sylCount=t=>SUBJ.reduce((a,s)=>a+(t.syl?.[s.k]||[]).length,0);
function sylHtml(t){const b=SUBJ.map(s=>{const a=t.syl?.[s.k]||[];if(!a.length)return'';
    return`<div class="sylsub ${sc(s.k)}"><div class="sylh"><span>${s.e}</span><b>${s.n}</b><span class="grow"></span><span class="pill">${a.length} chapter${a.length>1?'s':''}</span></div><ol>${a.map(e=>{const n=sylNotes(e,1);const full=/\(complete chapter\)/i.test(e);
      return`<li><b>${esc(sylBase(e)||e)}</b>${full?' <span class="tagc">Complete chapter</span>':''}${n.length?`<div class="small muted">${n.map(esc).join(' · ')}</div>`:''}</li>`}).join('')}</ol></div>`}).join('');
  return`<div class="syl">${b||'<div class="muted">No syllabus entered.</div>'}</div>`}
function testLine(t){const d=tDn(t);return`${d!=null?fShort(d):'No date'} · ${esc(t.type||'')}${t.pattern?' · '+esc(t.pattern):''}`}
function testMeta(t){const a=[];if(t.alt)a.push('📄 '+esc(t.alt));if(t.qs)a.push(t.qs+' questions');if(t.mins)a.push(t.mins+' min');if(t.max)a.push('max '+t.max);if(t.start)a.push('starts '+esc(t.start));return a.length?`<div class="small muted">${a.join(' · ')}</div>`:''}
function readyHtml(t){const tc=testChapters(t);if(!tc.length)return'';const withLec=tc.filter(x=>x.c.lec);const avg=withLec.length?Math.round(withLec.reduce((a,x)=>a+(x.c.done?100:chPct(x.c,x.s)),0)/withLec.length):null;
  const unset=tc.length-withLec.length;
  return`<details class="ready-d"><summary><span class="pill ink">📚 Readiness ${avg==null?'–':avg+'%'}</span> <span class="small muted">${tc.length} of your chapters in this test${unset?` · ${unset} without lecture count`:''}</span></summary><div class="ready">${tc.map(x=>{const p=x.c.done?100:chPct(x.c,x.s);return`<span class="pill ${sc(x.s)}" style="color:var(--c)">${esc(x.c.name)} ${x.c.lec?p+'%':'?'}</span>`}).join('')}</div></details>`}

/* ---------- TODAY ---------- */
function vToday(){const dn=V.day,td=today(),r=dayRec(dn),items=r?.items||[];const p=dayPct(dn);const isT=dn===td;
  const stk=streak(),ex=examDays();const nowH=new Date().getHours()+new Date().getMinutes()/60;
  const blocks=[[7,10,'🏫 7–10 AM','Tuition'],[12,16,'☀️ 12–4 PM','Study block 1'],[16,20,'🌇 4–8 PM','Study block 2'],[20.5,22.5,'🌙 8:30–10:30 PM','Revision']];
  let h=`<div class="hero">
    <div class="hero-top"><div class="grow"><div class="eyebrow">${isT?'Today':dn<td?'Past day':'Planning ahead'}${wd(dn)===6?' · Old test day':wd(dn)===0?' · Test day':''}</div>
      <h1>${fLong(dn)}</h1>
      <div class="hchips"><span class="hchip">🔥 <b class="num">${stk}</b> day streak</span>${ex!=null?`<span class="hchip">⏳ <b class="num">${ex}</b> days to NEET</span>`:''}</div></div>
      ${ring(p,null,'onb')}</div>
    <div class="daynav">
      <button class="hbtn" data-act="day" data-d="-1">‹ Prev</button>
      ${isT?'':`<button class="hbtn solid" data-act="day" data-d="0">Today</button>`}
      <button class="hbtn" data-act="day" data-d="1">Next ›</button></div>
  </div>
  <div class="row carryrow"><button class="btn sm ghost" data-act="carry">↪️ Bring unfinished from previous day</button></div>
  <div class="sched">${blocks.map(b=>`<div class="${isT&&nowH>=b[0]&&nowH<b[1]?'now':''}"><b>${b[2]}</b>${b[3]}</div>`).join('')}</div>`;
  // tests
  const dt=dayTests(dn);
  if(dt.length||wd(dn)===0||wd(dn)===6){h+=`<section class="sec"><div class="sec-h"><h2>🎯 Test${dt.length>1?'s':''}</h2></div><div class="stack">`;
    if(!dt.length)h+=wd(dn)===6?emptyBox('No pending old test left. 🎉'):emptyBox('No upcoming test on this Sunday in your test list.');
    dt.forEach(x=>{const t=x.t,g=t.given&&t.given<=dn;const m=t.m||{};
      h+=`<div class="card test ${x.kind==='old'?'old':''} ${g?'given':''}">
        <div class="small muted" style="font-weight:700">${x.kind==='old'?'🟠 Saturday · Give pending old test':'🔵 Give upcoming test'}</div>
        <div style="font-size:17px;font-weight:700;margin-top:2px">${esc(t.name)}</div>
        <div class="small muted">${testLine(t)}</div>${testMeta(t)}${t.given?'':readyHtml(t)}
        ${x.kind==='old'&&!t.given?`<label class="f" style="margin-top:8px">Change which old test
          <select data-chg="satpick" data-dn="${dn}">${pendingOld(dn).map(o=>`<option value="${o.id}" ${o===t?'selected':''}>${esc(o.name)}${o.date?' ('+fDM(tDn(o))+')':''}</option>`).join('')}</select></label>`:''}
        <details data-lazy="syl" data-id="${t.id}"><summary>📋 Syllabus · ${sylCount(t)} chapter${sylCount(t)===1?'':'s'}</summary></details>
        <div class="ticks" style="margin-top:10px">
          <button class="tick ${g?'on':''}" data-act="marks" data-id="${t.id}" data-dn="${dn}"><span class="box">✓</span><span class="lbl">Test given${g&&m.score!=null?` — ${m.score}${m.max?' / '+m.max:''}`:''}</span><span class="when">${g?'Edit marks':'Tap to enter marks'}</span></button>
        </div></div>`});
    h+=`</div></section>`}
  // subjects
  h+=`<section class="sec"><div class="sec-h"><h2>📘 Lectures &amp; practice</h2><span class="sub">You choose today's lectures</span></div><div class="stack">`;
  SUBJ.forEach(s=>{const its=items.map((it,i)=>({it,i})).filter(x=>x.it.k!=='rev'&&findCh(x.it.ch)?.s===s.k);
    h+=`<div class="subj ${sc(s.k)}"><div class="subj-h"><span style="font-size:18px">${s.e}</span><h3>${s.n}</h3><span class="grow"></span>${its.length?`<span class="pill">${its.length} task${its.length>1?'s':''}</span>`:''}</div><div class="subj-b">`;
    its.forEach(({it,i})=>h+=taskHtml(it,i,dn));
    h+=`<button class="add" data-act="addtask" data-s="${s.k}">＋ Add ${s.n} lecture / practice sheet</button></div></div>`});
  h+=`</div></section>`;
  // revision
  const revs=items.map((it,i)=>({it,i})).filter(x=>x.it.k==='rev');
  h+=`<section class="sec"><div class="sec-h"><h2>🌙 R-Q Session · Revision</h2><span class="sub">8:30–10:30 PM</span></div><div class="card stack">`;
  if(!revs.length)h+=`<div class="muted small">No revision chapter added for this day.</div>`;
  let lastS=null;[...revs].sort((a,b)=>SUBJ.findIndex(s=>s.k===findCh(a.it.ch)?.s)-SUBJ.findIndex(s=>s.k===findCh(b.it.ch)?.s)).forEach(({it,i})=>{const f=findCh(it.ch);if(!f)return;const on=(f.c.revs||[]).includes(dn);
    if(f.s!==lastS){lastS=f.s;h+=`<div class="sgl ${sc(f.s)}">${SBY[f.s].e} ${SBY[f.s].n}</div>`}
    h+=`<div class="row ${sc(f.s)}" style="flex-wrap:nowrap"><button class="tick ${on?'on':''} grow" data-act="tickrev" data-i="${i}" data-dn="${dn}"><span class="box">✓</span><span class="lbl">${SBY[f.s].e} Revise <b>${esc(f.c.name)}</b></span><span class="when">${on?`✅ Revision #${[...(f.c.revs||[])].sort((a,b)=>a-b).indexOf(dn)+1}`:`Revision #${(f.c.revs||[]).filter(x=>x<dn).length+1} · not done yet`}</span></button><button class="x" data-act="rmitem" data-i="${i}" aria-label="Remove">✕</button></div>`});
  h+=`<button class="add" data-act="addrev">＋ Add revision chapter</button></div></section>`;
  h+=`<section class="sec"><label class="f">📝 Note for this day<textarea id="daynote" data-chg="daynote" data-dn="${dn}" placeholder="e.g. Utilize the time as much as possible">${esc(r?.note||'')}</textarea></label><div class="savebar"><button class="btn pri" data-act="savenow">💾 Save the change</button></div></section>`;
  return h}
function taskHtml(it,i,dn){const f=findCh(it.ch);if(!f)return'';const c=f.c,s=f.s;
  if(it.k==='lec'){return`<div class="task"><div class="task-h"><div class="t">Lecture ${L2(it.n)} <small>${esc(c.name)}</small></div><button class="x" data-act="rmitem" data-i="${i}" aria-label="Remove">✕</button></div><div class="ticks">
    ${steps(s).filter(st=>it.st.includes(st)).map(st=>{const v=c.p[it.n]?.[st];return`<button class="tick ${v?'on':''}" data-act="tick" data-i="${i}" data-st="${st}" data-dn="${dn}"><span class="box">✓</span><span class="lbl">${esc(stepName(s,st))}</span>${v&&v!==dn?`<span class="when">done ${fWhen(v)}</span>`:''}</button>`}).join('')}</div></div>`}
  const st=chStats(c,s);
  if(it.k==='sheet'){const on=!!c.sheet;return`<div class="task"><div class="task-h"><div class="t">📄 Practice Sheet <small>${esc(c.name)} · lectures done ${st.done}/${st.total}</small></div><button class="x" data-act="rmitem" data-i="${i}" aria-label="Remove">✕</button></div>
    <button class="tick ${on?'on':''}" data-act="ticksheet" data-i="${i}" data-dn="${dn}"><span class="box">✓</span><span class="lbl">Practice sheet solved</span>${on&&c.sheet!==dn?`<span class="when">done ${fWhen(c.sheet)}</span>`:''}</button></div>`}
  if(it.k==='done'){const on=!!c.done;return`<div class="task"><div class="task-h"><div class="t">🏁 Mark chapter COMPLETE <small>${esc(c.name)} · ${st.done}/${st.total} lectures · sheet ${c.sheet?'✅':'❌'}</small></div><button class="x" data-act="rmitem" data-i="${i}" aria-label="Remove">✕</button></div>
    <button class="tick ${on?'on':''}" data-act="tickdone" data-i="${i}" data-dn="${dn}"><span class="box">✓</span><span class="lbl">Chapter complete</span></button></div>`}
  return''}

/* ---------- WEEK ---------- */
function monthBar(){return`<div class="monthbar"><button class="iconbtn" data-act="ym" data-d="-1" aria-label="Previous month">‹</button><h1>${ymLabel(V.ym)}</h1><button class="iconbtn" data-act="ym" data-d="1" aria-label="Next month">›</button></div>`}
/* Chapters are always listed under their subject: Physics, Chemistry, Zoology, Botany. */
function bySubj(list,idOf){const g={};list.forEach(x=>{const f=findCh(idOf?idOf(x):x);if(f)(g[f.s]=g[f.s]||[]).push({x,f})});return g}
function sgroups(g,row){return`<div class="sgrid">${SUBJ.filter(s=>g[s.k]?.length).map(s=>`<div class="subj ${sc(s.k)}"><div class="subj-h"><span>${s.e}</span><h3>${s.n}</h3><span class="grow"></span><span class="pill">${g[s.k].length} chapter${g[s.k].length===1?'':'s'}</span></div><div class="sublist">${g[s.k].map(row).join('')}</div></div>`).join('')}</div>`}
const isBk=it=>it&&it.kind==='bk';
const kindPill=it=>isBk(it)?'<span class="pill bk">🎯 Backlog chapter</span>':'<span class="pill planp">📘 Class schedule</span>';
/* Lectures of one chapter given to other weeks of the month, and what is still free to plan. */
function wkPlanInfo(ym,i,id){const p=plan(ym),it=p.newCh.find(x=>x.id===id);const target=+(it?.target)||0;let other=0;
  Object.keys(p.weeks).forEach(k=>{if(+k!==+i)other+=+(p.weeks[k]?.t?.[id]||0)});return{target,other,left:Math.max(0,target-other)}}
function vWeek(){const ym=V.ym,W=weeksOf(ym);if(!W.find(w=>w.i===V.wk))V.wk=1;const w=W.find(x=>x.i===V.wk),p=plan(ym),td=today();const now=weekOfDn(td);
  let h=monthBar()+`<div class="wkchips">${W.map(x=>`<button data-act="wk" data-i="${x.i}" aria-pressed="${x.i===V.wk}" class="${now.ym===ym&&now.i===x.i?'now':''}"><b>Week ${x.i}</b><small>${fDM(x.start)} – ${fDM(x.end)}</small></button>`).join('')}</div>`;
  const pr=weekProgress(ym,V.wk);
  h+=`<div class="card row" style="margin-top:12px;gap:14px">${ring(pr.pc)}<div class="grow stack" style="gap:6px">
     <div style="font-weight:700">Week ${V.wk} progress vs target</div>
     <div class="small">📘 Lectures <b class="num">${pr.ld}/${pr.ln}</b> · 🔁 Revision <b class="num">${pr.rd}/${pr.rn}</b> · 🎯 Tests <b class="num">${pr.td}/${pr.tn}</b></div></div></div>`;
  // tests
  const ts=testsInRange(w.start,w.end),sat=weekSat(ym,w);
  h+=`<section class="sec"><div class="sec-h"><h2>🎯 Tests this week</h2></div><div class="stack cgrid">`;
  h+=`<div class="card test old ${sat.t&&sat.t.given?'given':''}"><div class="small muted" style="font-weight:700">🟠 Saturday ${fDM(sat.sat)} · Pending old test${sat.proj?' (planned)':''}</div>
    ${sat.t?`<div style="font-weight:700">${esc(sat.t.name)} ${sat.t.given?'<span class="pill ok">✅ Given</span>':sat.sat<td?'<span class="pill red">Not given</span>':''}</div>`:`<div class="muted">No old test planned. Choose old tests in 📆 Month.</div>`}</div>`;
  ts.forEach(t=>{const miss=!t.given&&tDn(t)<td;h+=`<div class="card test ${t.given?'given':miss?'missed':''}"><div class="small muted" style="font-weight:700">🔵 ${fShort(tDn(t))} · Upcoming test (must give)</div><div style="font-weight:700">${esc(t.name)} ${t.given?'<span class="pill ok">✅ Given</span>':miss?'<span class="pill red">Missed → moved to old tests</span>':''}</div></div>`});
  if(!ts.length)h+=`<div class="muted small">No upcoming test dated this week.</div>`;
  h+=`</div></section>`;
  // lectures: only the chapters you picked for this week, plus unfinished lectures from earlier weeks
  const wt=p.weeks[V.wk]?.t||{};
  const shown=p.newCh.filter(it=>{if(it.id in wt)return true;const r=lecWeek(ym,V.wk,it.id);return r&&r.back>0&&r.done<r.need&&!r.f.c.done});
  const canAdd=p.newCh.filter(it=>!(it.id in wt)&&findCh(it.id)&&!findCh(it.id).c.done);
  h+=`<section class="sec"><div class="sec-h"><h2>📘 Lectures this week</h2><span class="sub">Pick from this month's planned chapters</span></div>`;
  if(!p.newCh.length)h+=emptyBox('No new chapters planned for this month yet.',`<button class="btn pri" data-act="mtab" data-v="new">📆 Open Month plan</button>`);
  else{h+=`<div class="addline">${canAdd.length?`<button class="btn pri" data-act="wkpick">☑️ Pick chapters for Week ${V.wk}</button><span class="small muted">${plural(canAdd.length,'chapter')} of this month not in this week yet</span>`:`<div class="small muted grow">All of this month's chapters are already in this week.</div>`}</div>`;
    if(!shown.length)h+=`<div class="muted small" style="margin-top:10px">No chapters picked for Week ${V.wk} yet. Tap “Pick chapters” above.</div>`;
    else h+=sgroups(bySubj(shown,it=>it.id),({x:it,f})=>{const r=lecWeek(ym,V.wk,it.id),k=wkPlanInfo(ym,V.wk,it.id),picked=it.id in wt,c=f.c,wc=weekCap(ym,V.wk,it.id);
      return`<div class="lrow ${r.back&&r.done<r.need?'backlog':''}"><div class="lmain"><b>${esc(c.name)}</b><div class="pills">${isBk(it)?kindPill(it):''}${c.done?'<span class="pill ok">✅ Complete</span>':''}${r.back?`<span class="pill red">🔴 Backlog +${r.back}</span>`:''}</div>
        <div class="small muted">Month target ${k.target} · other weeks ${k.other} · this week ${r.tgt} · left to plan ${Math.max(0,k.left-r.tgt)}</div></div>
        <div class="lside">${picked?`<button class="x" data-act="wkrm" data-id="${it.id}" aria-label="Remove from this week" title="Remove from this week">✕</button>`:''}</div>
        <div class="lfoot"><div class="row">${picked?`<span class="small muted">This week</span><span class="stepper"><button data-act="wkt" data-id="${it.id}" data-d="-1" aria-label="Less">−</button><span>${r.tgt}</span><button data-act="wkt" data-id="${it.id}" data-d="1" aria-label="More" ${r.tgt>=wc?'disabled':''}>＋</button></span><span class="small muted">max ${wc}</span>${r.tgt>wc?`<span class="pill warnp">⚠️ Only ${wc} left</span>`:''}`:`<span class="small lab">Unfinished from earlier weeks</span><button class="btn sm" data-act="wkadd" data-id="${it.id}">Pick for this week</button>`}<span class="grow"></span><b class="num">${r.done}/${r.need} done</b></div>${bar(pct(r.done,r.need||1))}</div></div>`})}
  if(V.wk===1){const lo=prevLeftovers(ym);if(lo.length)h+=`<div class="stack" style="margin-top:12px">${lo.map(x=>{const f=findCh(x.id);return`<div class="card backlog ${sc(f.s)}"><div class="row"><span class="dot"></span><div class="grow"><span class="lab">🔴 Unfinished from last month:</span> <b>${esc(f.c.name)}</b> — ${x.left} lecture${x.left>1?'s':''} left</div><button class="btn sm" data-act="addleft" data-id="${x.id}" data-n="${x.left}" data-kind="${x.kind||''}">Add to this month</button></div></div>`}).join('')}</div>`}
  h+=`</section>`;
  // revision
  const rv=revWeek(ym,V.wk);const unassigned=p.rev.filter(id=>!rv.cur.includes(id)&&!rv.back.includes(id));
  h+=`<section class="sec"><div class="sec-h"><h2>🔁 Revision this week</h2></div>`;
  const rows=[...rv.back.map(id=>({id,back:true})),...rv.cur.map(id=>({id,back:false}))];
  if(rows.length)h+=sgroups(bySubj(rows,x=>x.id),({x,f})=>{const d=revIn(f.c,w.start,w.end);
    return x.back?`<div class="lrow ${d?'':'backlog'}"><div class="lmain"><b>${esc(f.c.name)}</b><div class="pills">${d?'<span class="pill ok">✅ Revised</span>':'<span class="pill red">🔴 Backlog · not revised</span>'}</div></div><div class="lside"></div></div>`
      :`<div class="lrow"><div class="lmain"><b>${esc(f.c.name)}</b><div class="pills"><span class="pill planp">📌 Planned</span>${d?'<span class="pill ok">✅ Revised</span>':'<span class="pill warnp">⏳ Not revised yet</span>'}</div></div><div class="lside"><button class="x" data-act="unrevwk" data-id="${x.id}" aria-label="Remove from week">✕</button></div></div>`});
  else h+=`<div class="muted small">No revision chapters assigned to this week.</div>`;
  if(unassigned.length){const g=bySubj(unassigned);h+=`<div class="card stack" style="margin-top:12px"><div class="small muted">Tap to assign from this month's revision list:</div>${SUBJ.filter(s=>g[s.k]).map(s=>`<div class="chiprow ${sc(s.k)}"><span class="chiplab">${s.e} ${s.n}</span><div class="chips">${g[s.k].map(({x:id,f})=>`<button class="chip ${sc(s.k)}" data-act="revwk" data-id="${id}">＋ ${esc(f.c.name)}</button>`).join('')}</div></div>`).join('')}</div>`}
  else if(!p.rev.length)h+=`<div class="small muted" style="margin-top:8px">Add chapters to revise in 📆 Month first.</div>`;
  h+=`</section>`;return h}

/* ---------- MONTH ---------- */
/* The next upcoming test whose syllabus has this chapter (shown on backlog chapters). */
function nextTestFor(id){return upcomingTests().find(t=>testChapters(t).some(x=>x.c.id===id))||null}
function vMonth(){const ym=V.ym,p=plan(ym),r=monthRange(ym),td=today(),W=weeksOf(ym);const pr=monthProgress(ym);
  let h=monthBar()+`<div class="small muted" style="text-align:center;margin-top:4px">Plan covers ${fDM(r.a)} – ${fDM(r.b)} · ${W.length} weeks (Mon–Sun · a week counts in the month that has 4+ of its days)</div>`;
  h+=`<div class="card row" style="margin-top:12px;gap:14px">${ring(pr.pc)}<div class="grow stack" style="gap:7px"><div style="font-weight:700">Month progress</div>
     <div class="small">📘 Lectures <b class="num">${pr.ld}/${pr.ln}</b></div>${bar(pct(pr.ld,pr.ln))}
     <div class="small">🔁 Revised <b class="num">${pr.rd}/${pr.rn}</b> · 🎯 Tests given <b class="num">${pr.td}/${pr.tn}</b></div></div></div>`;
  const up=testsInRange(r.a,r.b),oldT=p.old.map(testById).filter(Boolean).sort(byDate);
  const tabs=[['tests',`🎯 Tests`,up.length+oldT.length],['new',`📘 New chapters`,p.newCh.length],['rev',`🔁 Revise`,p.rev.length]];
  h+=`<div class="seg mtabs" role="tablist" style="margin-top:14px">${tabs.map(([k,n,c])=>`<button role="tab" data-act="mtab" data-v="${k}" aria-pressed="${V.mt===k}">${n} <span class="cnt">${c}</span></button>`).join('')}</div>`;
  return h+`<div class="mbody">${V.mt==='new'?mNew(ym,p,r):V.mt==='rev'?mRev(ym,p,r):mTests(ym,p,r,up,oldT,W,td)}</div>`}
function mTests(ym,p,r,up,oldT,W,td){let h='';const sats=W.length;
  h+=`<section class="sec"><div class="sec-h"><h2>🎯 Tests this month</h2></div><div class="stack cgrid">`;
  {const L=[];up.forEach(t=>L.push(()=>{const miss=!t.given&&tDn(t)<td;return`<div class="card test ${t.given?'given':miss?'missed':''}"><div class="row"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${testLine(t)}</div></div>${t.given?'<span class="pill ok">✅ Given</span>':miss?'<span class="pill red">Missed</span>':'<span class="pill ink">🔒 Must give</span>'}</div></div>`}));h+=MORE.list(L,4)}
  if(!up.length)h+=`<div class="muted small">No upcoming tests dated in this month.</div>`;
  h+=`</div></section><section class="sec"><div class="sec-h"><h2>🟠 Old tests <span class="sub">1 per Saturday · ${sats} Saturdays</span></h2><button class="btn sm" data-act="pickold">Choose old tests</button></div><div class="stack cgrid">`;
  if(p.old.length>sats)h+=`<div class="err">You picked ${p.old.length} old tests but this month has only ${sats} Saturdays. The extra ones will carry to next month.</div>`;
  oldT.forEach(t=>h+=`<div class="card test old ${t.given?'given':''} row"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${testLine(t)}</div></div>${t.given?'<span class="pill ok">✅ Given</span>':''}<button class="x" data-act="rmold" data-id="${t.id}" aria-label="Remove">✕</button></div>`);
  if(!oldT.length)h+=`<div class="muted small">No old tests chosen. Pending old tests: <b>${pendingOld().length}</b>.</div>`;
  h+=`</div></section>`;
  // chapters in this month's test syllabus (dated tests of the month + old tests chosen for it); drawn just after the first screen
  h+=MORE.list([()=>{let h='';const mtests=[...up,...oldT];const MS=monthSyllabus(mtests);
  h+=`<section class="sec"><div class="sec-h"><h2>🧾 Syllabus of this month's tests</h2><span class="sub">${mtests.length} test${mtests.length===1?'':'s'} · ${MS.total} chapter${MS.total===1?'':'s'}</span></div>`;
  if(!mtests.length)h+=emptyBox('No tests in this month yet. Choose old tests above to see their chapters here.');
  else{h+=`<div class="legend"><span><i class="lg plan"></i>📌 Planned = you chose it for this month</span><span><i class="lg done"></i>✅ Done = only after you tick it on Today</span></div><div class="sgrid">`;
    SUBJ.forEach(s=>{const rows=MS[s.k];if(!rows.length&&!MS.full[s.k])return;
      h+=`<div class="subj ${sc(s.k)}"><div class="subj-h"><span>${s.e}</span><h3>${s.n}</h3><span class="grow"></span><span class="pill">${rows.length} chapter${rows.length===1?'':'s'}</span></div><div class="sylist">`;
      if(MS.full[s.k])h+=`<div class="syrow"><div class="grow"><b>Full syllabus</b><div class="small muted">In: ${MS.full[s.k].map(esc).join(', ')}</div></div></div>`;
      {const L=[];rows.forEach(x=>L.push(()=>{const c=x.ch;const isRev=!!c&&p.rev.includes(c.id),nw=c?p.newCh.find(y=>y.id===c.id):null,isNew=!!nw;
        const stt=c?chStatus(c,s.k):'none',fresh=stt==='none';const rv=c?(c.revs||[]):[];
        const prog=stt==='done'?'<span class="pill ok">✅ Studied</span>':stt==='prog'?`<span class="pill warnp">⏳ ${c.lec?chPct(c,s.k)+'% studied':'Started'}</span>`:'<span class="pill">⬜ Never touched</span>';
        const revp=rv.length?`<span class="pill ok">🔁 Revised ${rv.length}× · last ${fDM(Math.max(...rv))}</span>`:'';
        const key=c?c.id:'n:'+normName(x.base);
        return`<div class="syrow"><div class="grow"><b>${esc(c?c.name:x.base)}</b><div class="pills">${prog}${revp}${c?'':'<span class="pill">Not in your chapter list yet</span>'}</div>
          ${x.notes.length?`<div class="small muted">Topics: ${x.notes.map(esc).join(' · ')}</div>`:''}<div class="small muted">In: ${x.tests.map(esc).join(', ')}</div></div><div class="sychoice">
          ${stt==='done'?'':`<button class="pbtn study ${fresh&&!isRev&&!isNew?'hint':''}" data-act="mtoggle" data-k="new" data-id="${esc(key)}" data-s="${s.k}" data-name="${esc(c?c.name:x.base)}" aria-pressed="${isNew}">${isNew?(isBk(nw)?'📌 Backlog planned':'📌 Study planned'):'📘 Plan study'}</button>`}
          <button class="pbtn rev ${!fresh&&!isRev&&!isNew?'hint':''}" data-act="mtoggle" data-k="rev" data-id="${esc(key)}" data-s="${s.k}" aria-pressed="${isRev}">${isRev?'📌 Revision planned':'🔁 Plan revision'}</button></div></div>`}));h+=MORE.list(L,3)}
      h+=`</div></div>`});
    h+=`</div><div class="small muted" style="margin-top:8px">The glowing button is the suggestion: study for chapters you never touched, revise for chapters you started or finished.</div>`}
  return h+`</section>`}],0);return h}
/* New chapters: two lists, class-schedule chapters and backlog chapters (old chapters you study because they come in tests). */
function mNew(ym,p,r){let h='';const left=prevLeftovers(ym);
  if(left.length){h+=`<section class="sec"><div class="sec-h"><h2>🔴 Unfinished from last month</h2></div><div class="stack cgrid">`;
    left.forEach(x=>{const f=findCh(x.id);h+=`<div class="card backlog row ${sc(f.s)}"><span class="dot"></span><div class="grow"><b>${esc(f.c.name)}</b> — ${x.left} lecture${x.left>1?'s':''} not done</div><button class="btn sm" data-act="addleft" data-id="${x.id}" data-n="${x.left}" data-kind="${x.kind||''}">Add</button></div>`});h+=`</div></section>`}
  const row=({x:it,f})=>{const st=chStats(f.c,f.s);const dm=doneInRange(f.c,f.s,r.a,r.b),t=+it.target||0,cap=monthCap(ym,it.id);const nt=isBk(it)?nextTestFor(it.id):null;
    return`<div class="lrow"><div class="lmain"><b>${esc(f.c.name)}</b><div class="small muted">${st.done}/${st.total} lectures done overall</div>
      <div class="pills">${f.c.done?'<span class="pill ok">✅ Studied</span>':dm?`<span class="pill warnp">⏳ ${dm} lecture${dm>1?'s':''} done this month</span>`:'<span class="pill">Not started this month</span>'}${nt?`<span class="pill bk">🎯 In ${esc(nt.name)} · ${fDM(tDn(nt))}</span>`:''}</div></div>
      <div class="lside"><button class="x" data-act="rmnew" data-id="${it.id}" aria-label="Remove">✕</button></div>
      <div class="lfoot"><div class="row"><span class="small muted">Lectures this month</span><span class="stepper"><button data-act="mt" data-id="${it.id}" data-d="-1" aria-label="Less">−</button><span>${t}</span><button data-act="mt" data-id="${it.id}" data-d="1" aria-label="More" ${t>=cap?'disabled':''}>＋</button></span>${f.c.lec?`<span class="small muted">max ${cap}</span>`:`<button class="btn sm" data-act="opench" data-id="${it.id}">🔢 Set lectures</button>`}${t>cap?`<span class="pill warnp">⚠️ Only ${cap} left</span>`:''}<span class="grow"></span><b class="num">${Math.min(dm,t)}/${t}</b></div>${bar(pct(Math.min(dm,t),t))}<div class="lmove"><button class="linkbtn" data-act="mkind" data-id="${it.id}">${isBk(it)?'⇄ Move to class schedule':'⇄ Move to backlog chapters'}</button></div></div></div>`};
  const sch=p.newCh.filter(it=>!isBk(it)),bk=p.newCh.filter(isBk);
  h+=`<section class="sec"><div class="sec-h"><h2>📘 Class schedule chapters</h2><button class="btn sm" data-act="addnew" data-kind="sch">＋ Add chapter</button></div><div class="small muted" style="margin:-4px 0 10px">Chapters as per your batch's class schedule.</div>`;
  h+=sch.length?sgroups(bySubj(sch,it=>it.id),row):emptyBox('No class-schedule chapters planned. Add the chapters your batch is teaching this month.');
  h+=`</section><section class="sec"><div class="sec-h"><h2>🎯 Backlog chapters</h2><button class="btn sm bkbtn" data-act="addnew" data-kind="bk">＋ Add backlog chapter</button></div><div class="small muted" style="margin:-4px 0 10px">Old chapters you study outside the class schedule because they come in your tests.</div>`;
  h+=bk.length?sgroups(bySubj(bk,it=>it.id),row):emptyBox('No backlog chapters planned. Add old chapters that are coming in your tests.');
  return h+`</section>`}
function mRev(ym,p,r){let h=`<section class="sec"><div class="sec-h"><h2>🔁 Chapters to revise</h2><button class="btn sm" data-act="addrevm">＋ Add chapter</button></div>`;
  h+=p.rev.length?sgroups(bySubj(p.rev),({x:id,f})=>{const d=revIn(f.c,r.a,r.b);const rv=f.c.revs||[];
    return`<div class="lrow"><div class="lmain"><b>${esc(f.c.name)}</b><div class="pills"><span class="pill planp">📌 Planned</span>${d?'<span class="pill ok">✅ Revised</span>':'<span class="pill warnp">⏳ Not revised yet</span>'}${rv.length?`<span class="pill">🔁 ${rv.length}× in total</span>`:''}</div></div><div class="lside"><button class="x" data-act="rmrevm" data-id="${id}" aria-label="Remove">✕</button></div></div>`}):emptyBox('No revision chapters yet. Add chapters here or plan them from Tests → syllabus.');
  return h+`</section>`}

/* Plan study from a test syllabus: choose which list the chapter goes to. */
function mPlanAs(d){d=Object.assign({},d);openM({title:'📘 Plan study',st:{d},body(){return`<div class="stack"><div><b style="font-size:17px">${esc(d.name||'')}</b><div class="small muted">Which list should this chapter go to?</div></div>
  <button class="btn pri full choice" data-act="mplanas" data-kind="sch"><span>📘 Class schedule</span><small>Your batch is teaching it now</small></button>
  <button class="btn full choice bkbtn" data-act="mplanas" data-kind="bk"><span>🎯 Backlog chapter</span><small>Old chapter you study because it is coming in a test</small></button></div>`}})}

/* ---------- TESTS ---------- */
function vTests(){const td=today();const up=upcomingTests(),old=pendingOld(),giv=S.tests.filter(t=>t.given).sort((a,b)=>b.given-a.given);
  let h=`<div class="card row" style="gap:14px"><div class="big num" style="color:var(--warn)">${old.length}</div><div class="grow"><div style="font-weight:700">Pending old tests remaining</div><div class="small muted">One every Saturday. ${up.length} upcoming test${up.length===1?'':'s'} left.</div></div><button class="btn sm pri" data-act="edittest">＋ Add test</button></div>`;
  h+=`<section class="sec"><div class="sec-h"><h2>📈 Score trend</h2><span class="sub">Score as % of total marks</span></div><div class="card">${chartHtml()}</div></section>`;
  h+=`<section class="sec"><div class="seg" role="group">
    <button data-act="tt" data-v="up" aria-pressed="${V.tt==='up'}">📅 Upcoming (${up.length})</button>
    <button data-act="tt" data-v="old" aria-pressed="${V.tt==='old'}">🟠 Old (${old.length})</button>
    <button data-act="tt" data-v="giv" aria-pressed="${V.tt==='giv'}">✅ Given (${giv.length})</button></div><div class="stack cgrid" style="margin-top:12px">`;
  const list=V.tt==='up'?up:V.tt==='old'?old:giv;
  if(!list.length)h+=emptyBox(V.tt==='giv'?'No test marked as given yet.':V.tt==='old'?'No pending old tests. 🎉':'No upcoming tests.');
  {const L=[];list.forEach(t=>L.push(()=>{let h='';const d=tDn(t),miss=!t.given&&d!=null&&d<td;const m=t.m||{};const sp=scorePct(t);
    h+=`<div class="card test ${t.given?'given':miss?'old':''}">
      <div class="row"><div class="grow"><div style="font-size:16.5px;font-weight:700">${esc(t.name)}</div><div class="small muted">${testLine(t)}</div></div>
      ${t.given?`<span class="pill ok">✅ ${fDM(t.given)}</span>`:miss?`<span class="pill red">Not given</span>`:d!=null?`<span class="pill ${d===td?'ink':''}">${d===td?'Today':'in '+(d-td)+' day'+(d-td===1?'':'s')}</span>`:''}</div>
      ${t.given?`<div class="row" style="margin-top:8px;gap:6px">${m.score!=null?`<span class="pill ink">${m.score}${m.max?' / '+m.max:''}${sp!=null?' · '+sp+'%':''}</span>`:''}${SUBJ.map(s=>m[s.k]!=null?`<span class="pill ${sc(s.k)}" style="color:var(--c)">${s.e} ${m[s.k]}</span>`:'').join('')}</div>`:''}
      ${testMeta(t)}${t.given?'':readyHtml(t)}
      <details data-lazy="syl" data-id="${t.id}"><summary>📋 Syllabus · ${sylCount(t)} chapter${sylCount(t)===1?'':'s'}${t.sylSrc?' (official)':''}</summary></details>
      <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm ${t.given?'':'pri'}" data-act="marks" data-id="${t.id}">${t.given?'✏️ Edit marks':'✅ Mark as given'}</button><button class="btn sm ghost" data-act="edittest" data-id="${t.id}">Edit test</button></div></div>`;return h}));h+=MORE.list(L,4)}
  h+=`</div></section>`;return h}
function chartHtml(){const g=S.tests.filter(t=>t.given&&scorePct(t)!=null).sort((a,b)=>a.given-b.given);
  if(!g.length)return`<div class="muted small">Your graph appears here after you enter marks (score and total) for a test.</div>`;
  const ph=innerWidth<600;const W=ph?360:640,H=ph?250:230,pl=ph?46:38,pr=ph?34:18,pt=22,pb=44,n=g.length,cut=ph?9:12;const x=i=>n===1?(pl+(W-pl-pr)/2):pl+i*(W-pl-pr)/(n-1);const y=v=>pt+(100-v)*(H-pt-pb)/100;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Test score trend">`;
  [0,25,50,75,100].forEach(v=>s+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}%</text>`);
  const pts=g.map((t,i)=>[x(i),y(scorePct(t))]);
  if(n>1){s+=`<path class="ar" d="M${pts[0][0]},${y(0)} ${pts.map(p=>'L'+p[0]+','+p[1]).join(' ')} L${pts[n-1][0]},${y(0)} Z"/><path class="ln" d="${pts.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ')}"/>`}
  const every=Math.ceil(n/(ph?4:8));
  g.forEach((t,i)=>{const [px,py]=pts[i];s+=`<circle class="pt" cx="${px}" cy="${py}" r="${i===n-1?6:4.5}"/>`;
    if(i%every===0||i===n-1){s+=`<text class="vl" x="${px}" y="${py-10}" text-anchor="middle">${scorePct(t)}%</text><text x="${px}" y="${H-24}" text-anchor="middle">${esc(t.name.length>cut?t.name.slice(0,cut-1)+'…':t.name)}</text><text x="${px}" y="${H-10}" text-anchor="middle">${fDM(t.given)}</text>`}});
  return s+`</svg>`}

/* ---------- DASHBOARD ---------- */
function vDash(){const seg=`<div class="seg" role="group" aria-label="Stats view">${[['ov','📊 Overview'],['ch','📈 Progress'],['rv','🔁 Revisions']].map(([k,n])=>`<button data-act="dv" data-v="${k}" aria-pressed="${V.dv===k}">${n}</button>`).join('')}</div>`;
  return seg+`<div class="dvbody">${V.dv==='ch'?vCharts():V.dv==='rv'?vRevs():vOverview()}</div>`}

/* ---------- PROGRESS CHARTS ---------- */
const STEPN={w:'🎬 Watch',l:'📖 Learn',d:'📝 DPP',q:'❓ Question bank',c:'🧩 Combo QB'};
function actMap(a,b){const m={};const R=d=>m[d]||(m[d]={n:0,step:0,rev:0,sheet:0,test:0,lec:{},st:{}});const ok=d=>!!d&&d!==EARLY&&d>=a&&d<=b;
  SUBJ.forEach(s=>S.ch[s.k].forEach(c=>{
    Object.keys(c.p||{}).forEach(n=>{const p=c.p[n];Object.keys(p).forEach(st=>{const d=p[st];if(ok(d)){const r=R(d);r.n++;r.step++;r.st[st]=(r.st[st]||0)+1}});
      const ld=+n<=c.lec?lecDone(c,s.k,+n):0;if(ok(ld)){const r=R(ld);r.lec[s.k]=(r.lec[s.k]||0)+1}});
    if(ok(c.sheet)){const r=R(c.sheet);r.n++;r.sheet++}
    (c.revs||[]).forEach(d=>{if(ok(d)){const r=R(d);r.n++;r.rev++}})}));
  S.tests.forEach(t=>{if(ok(t.given)){const r=R(t.given);r.n++;r.test++}});return m}
const topBar=(x,y,w,h,r)=>{if(h<=0)return'';r=Math.min(r,h,w/2);return`M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`};
function niceMax(v){if(v<=4)return 4;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return(f<=2?2:f<=5?5:10)*p}
function vCharts(){const td=today(),wk=V.rg,end=td+((7-wd(td))%7),a=end-7*wk+1;const m=actMap(a,end);const ph=innerWidth<600;
  const days=Object.values(m);const tot=k=>days.reduce((x,r)=>x+r[k],0);const active=Object.keys(m).filter(d=>m[d].n>0).length;
  const lecs=days.reduce((x,r)=>x+Object.values(r.lec).reduce((y,z)=>y+z,0),0);
  let h=`<div class="rangebar"><span class="small muted">Showing</span><div class="seg sm">${[4,8,12].map(n=>`<button data-act="rg" data-v="${n}" aria-pressed="${wk===n}">${n} weeks</button>`).join('')}</div></div>`;
  h+=`<div class="grid2 kpis">
    <div class="card"><div class="small muted">✅ Tasks ticked</div><div class="big num">${tot('n')}</div><div class="small muted">steps, sheets, revisions, tests</div></div>
    <div class="card"><div class="small muted">🎬 Lectures fully done</div><div class="big num">${lecs}</div><div class="small muted">all steps ticked</div></div>
    <div class="card"><div class="small muted">🔁 Revisions</div><div class="big num">${tot('rev')}</div><div class="small muted">chapter revisions</div></div>
    <div class="card"><div class="small muted">📅 Active days</div><div class="big num">${active}<span class="unit">/${Math.min(wk*7,td-a+1)}</span></div><div class="small muted">days with any tick</div></div></div>`;
  // heatmap
  const mx=Math.max(4,...days.map(r=>r.n));let cells='',mons='';
  for(let w=0;w<wk;w++){const ws=a+w*7;const firstOfMonth=[0,1,2,3,4,5,6].some(i=>fmt(ws+i,{day:'numeric'})==='1');mons+=`<span>${w===0||firstOfMonth?fmt(ws+6,{month:'short'}):''}</span>`;
    for(let i=0;i<7;i++){const d=ws+i,r=m[d],n=r?r.n:0;const lv=d>td?'fut':n===0?0:Math.min(4,Math.ceil(4*n/mx));
      const tip=d>td?`${fShort(d)} · upcoming`:`${fShort(d)} · ${n} task${n===1?'':'s'} ticked${r?` (${[r.step&&r.step+' steps',r.sheet&&r.sheet+' sheet',r.rev&&r.rev+' revision'+(r.rev>1?'s':''),r.test&&r.test+' test'].filter(Boolean).join(', ')})`:''}`;
      cells+=`<i class="lv${lv}${d===td?' now':''}" data-tip="${esc(tip)}"></i>`}}
  h+=`<section class="sec"><div class="sec-h"><h2>🟪 Daily activity</h2><span class="sub">Each square is one day · darker = more ticks</span></div><div class="card"><div class="heat" style="--wk:${wk}">
    <div class="hm">${mons}</div><div class="hd">${['Mon','','Wed','','Fri','','Sun'].map(x=>`<span>${x}</span>`).join('')}</div><div class="hg">${cells}</div></div>
    <div class="hleg"><span>Less</span><i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>More</span></div></div></section>`;
  // daily checklist %
  const N=14,W=ph?360:640,H=190,pl=44,pr=8,pt=18,pb=34,bw=(W-pl-pr)/N;const y=v=>pt+(100-v)*(H-pt-pb)/100;
  let s=`<svg class="chart vbar" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Checklist completion for the last 14 days">`;
  [0,50,100].forEach(v=>s+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}%</text>`);
  let planned=0,full=0;
  for(let k=0;k<N;k++){const d=td-N+1+k,p=dayPct(d),x=pl+k*bw+2,w=bw-4;if(p!=null){planned++;if(p===100)full++}
    s+=`<rect class="hit" x="${pl+k*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" data-tip="${esc(fShort(d)+' · '+(p==null?'nothing planned':p+'% of checklist done'))}"/>`;
    if(p==null)s+=`<line class="none" x1="${x+w/2-4}" x2="${x+w/2+4}" y1="${y(0)-1}" y2="${y(0)-1}"/>`;else s+=`<path class="bfill${d===td?' today':''}" d="${topBar(x,y(Math.max(p,2)),w,y(0)-y(Math.max(p,2)),4)}" pointer-events="none"/>`;
    const stp=ph?3:2;if(k===N-1||(k%stp===(N-1)%stp&&N-1-k>=stp))s+=`<text x="${x+w/2}" y="${H-12}" text-anchor="middle">${d===td?'Today':fmt(d,{day:'numeric'})}</text>`}
  s+=`</svg>`;
  h+=`<section class="sec"><div class="sec-h"><h2>📋 Checklist completion</h2><span class="sub">Last 14 days · ${full} of ${planned} planned days at 100%</span></div><div class="card">${s}</div></section>`;
  // weekly lectures stacked by subject
  const wkS=[];for(let w=0;w<wk;w++){const ws=a+w*7;const v={};SUBJ.forEach(x=>v[x.k]=0);for(let i=0;i<7;i++){const r=m[ws+i];if(r)SUBJ.forEach(x=>v[x.k]+=r.lec[x.k]||0)}wkS.push({ws,v,t:SUBJ.reduce((q,x)=>q+v[x.k],0)})}
  const ymx=niceMax(Math.max(1,...wkS.map(x=>x.t)));const H2=210,pb2=34,bw2=(W-pl-pr)/wk;const y2=v=>pt+(ymx-v)*(H2-pt-pb2)/ymx;
  let s2=`<svg class="chart vbar" viewBox="0 0 ${W} ${H2}" width="100%" role="img" aria-label="Lectures completed per week by subject">`;
  [0,ymx/2,ymx].forEach(v=>s2+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${y2(v)}" y2="${y2(v)}"/><text x="${pl-6}" y="${y2(v)+4}" text-anchor="end">${v}</text>`);
  wkS.forEach((x,k)=>{const bx=pl+k*bw2+Math.max(2,bw2*.18),bwid=bw2-2*Math.max(2,bw2*.18);let base=y2(0);const segs=SUBJ.filter(q=>x.v[q.k]>0);
    segs.forEach((q,j)=>{const hgt=y2(0)-y2(x.v[q.k]);const top=base-hgt;const gap=j<segs.length-1?0:0;s2+=j===segs.length-1?`<path class="sg ${sc(q.k)}" d="${topBar(bx,top,bwid,hgt-(j?2:0),4)}"/>`:`<rect class="sg ${sc(q.k)}" x="${bx}" y="${top+(j?0:0)}" width="${bwid}" height="${Math.max(0,hgt-(j?2:0))}"/>`;base=top});
    s2+=`<rect class="hit" x="${pl+k*bw2}" y="${pt}" width="${bw2}" height="${H2-pt-pb2}" data-tip="${esc(`Week ${fDM(x.ws)}–${fDM(x.ws+6)} · ${x.t} lecture${x.t===1?'':'s'}${x.t?': '+SUBJ.filter(q=>x.v[q.k]).map(q=>q.n+' '+x.v[q.k]).join(', '):''}`)}"/>`;
    const ls=ph?(wk<=4?1:wk<=8?2:3):(wk<=8?1:2),lab=(wk-1-k)%ls===0;
    if(x.t&&(ph?wk<=8:wk<=12))s2+=`<text class="vl" x="${pl+k*bw2+bw2/2}" y="${y2(x.t)-6}" text-anchor="middle">${x.t}</text>`;
    if(lab)s2+=`<text x="${pl+k*bw2+bw2/2}" y="${H2-12}" text-anchor="middle">${fDM(x.ws)}</text>`});
  s2+=`</svg>`;
  h+=`<section class="sec"><div class="sec-h"><h2>🎬 Lectures completed per week</h2><span class="sub">${lecs} in ${wk} weeks</span></div><div class="card"><div class="vleg">${SUBJ.map(q=>`<span class="${sc(q.k)}"><i></i>${q.e} ${q.n}</span>`).join('')}</div>${s2}</div></section>`;
  // steps breakdown
  const st={};days.forEach(r=>Object.keys(r.st).forEach(k=>st[k]=(st[k]||0)+r.st[k]));const smx=Math.max(1,...Object.values(st));
  h+=`<section class="sec"><div class="sec-h"><h2>🧭 Where your effort went</h2><span class="sub">Steps ticked in ${wk} weeks</span></div><div class="card hbars">${Object.keys(STEPN).map(k=>`<div class="hb" data-tip="${esc(STEPN[k]+': '+(st[k]||0)+' ticked')}"><span class="hl">${STEPN[k]}</span><div class="ht"><i style="width:${pct(st[k]||0,smx)}%"></i></div><b class="num">${st[k]||0}</b></div>`).join('')}
    <div class="hb" data-tip="${esc('Practice sheets solved: '+tot('sheet'))}"><span class="hl">📄 Practice sheets</span><div class="ht"><i style="width:${pct(tot('sheet'),smx)}%"></i></div><b class="num">${tot('sheet')}</b></div>
    <div class="hb" data-tip="${esc('Tests given: '+tot('test'))}"><span class="hl">🎯 Tests given</span><div class="ht"><i style="width:${pct(tot('test'),smx)}%"></i></div><b class="num">${tot('test')}</b></div></div></section>`;
  // subject completion this range
  h+=`<section class="sec"><div class="sec-h"><h2>📚 Syllabus by subject</h2><span class="sub">Lectures done of all lectures set</span></div><div class="card stack">${SUBJ.map(q=>{let u=0,d=0;S.ch[q.k].forEach(c=>{u+=c.lec;d+=chStats(c,q.k).done});return`<div class="${sc(q.k)}" data-tip="${esc(q.n+': '+d+' of '+u+' lectures done')}"><div class="row"><span>${q.e}</span><b class="grow">${q.n}</b><span class="num small"><b>${pct(d,u)}%</b> · ${d}/${u}</span></div><div style="margin-top:5px">${bar(pct(d,u))}</div></div>`}).join('')}</div></section>`;
  return h}

/* ---------- REVISIONS ---------- */
function vRevs(){const td=today(),f=V.rvF;const rows=[];SUBJ.forEach(s=>{if(f!=='all'&&f!==s.k)return;S.ch[s.k].forEach(c=>{const r=c.revs||[];const studied=chStats(c,s.k).any||!!c.done;if(!r.length&&!studied)return;rows.push({c,s:s.k,n:r.length,last:r.length?Math.max(...r):0,studied})})});
  const rev=rows.filter(x=>x.n).sort((a,b)=>b.n-a.n||b.last-a.last),never=rows.filter(x=>!x.n);const tot=rev.reduce((q,x)=>q+x.n,0),mx=Math.max(1,...rev.map(x=>x.n));
  let h=`<div class="chips" style="margin-top:2px"><button class="chip" data-act="rvf" data-v="all" aria-pressed="${f==='all'}">All</button>${SUBJ.map(s=>`<button class="chip ${sc(s.k)}" data-act="rvf" data-v="${s.k}" aria-pressed="${f===s.k}">${s.e} ${s.n}</button>`).join('')}</div>`;
  h+=`<div class="grid2 kpis" style="margin-top:12px">
    <div class="card"><div class="small muted">🔁 Total revisions</div><div class="big num">${tot}</div></div>
    <div class="card"><div class="small muted">📗 Chapters revised</div><div class="big num">${rev.length}</div><div class="small muted">at least once</div></div>
    <div class="card"><div class="small muted">⚠️ Studied, never revised</div><div class="big num" style="color:var(--warn)">${never.length}</div></div>
    <div class="card"><div class="small muted">📈 Average</div><div class="big num">${rev.length?(tot/rev.length).toFixed(1):'–'}<span class="unit">×</span></div><div class="small muted">per revised chapter</div></div></div>`;
  h+=`<section class="sec"><div class="sec-h"><h2>🔁 How many times you revised each chapter</h2><span class="sub">Most revised first</span></div><div class="card revlist">`;
  if(!rev.length)h+=`<div class="muted small">No revisions ticked yet. Revisions count when you tick them in Today → R-Q Session.</div>`;
  {const L=[];rev.forEach(x=>L.push(()=>{let h='';const ago=td-x.last;h+=`<div class="rvrow ${sc(x.s)}" data-tip="${esc(x.c.name+': revised '+x.n+' time'+(x.n>1?'s':'')+' · dates: '+[...x.c.revs].sort((a,b)=>a-b).map(fDM).join(', '))}"><div class="rvn"><span class="dot"></span><b>${esc(x.c.name)}</b></div>
    <div class="rvb"><i style="width:${pct(x.n,mx)}%"></i></div><div class="rvc"><b class="num">${x.n}×</b><span class="small muted">${ago===0?'today':ago===1?'yesterday':ago+' days ago'}</span></div></div>`;return h}));h+=MORE.list(L,8)}
  h+=`</div></section>`;
  if(never.length)h+=`<section class="sec"><div class="sec-h"><h2>⚠️ Studied but never revised</h2><span class="sub">Revise these before the next test</span></div><div class="card stack">${never.map(x=>`<div class="row ${sc(x.s)}"><span class="dot"></span><span class="grow">${esc(x.c.name)}</span><span class="pill warnp">0×</span></div>`).join('')}</div></section>`;
  return h}

function vOverview(){const td=today();const ex=examDays();const stk=streak();const dp=dayPct(td);
  let h=`<div class="grid2">
    <div class="card brandc"><div class="small muted">⏳ NEET 2027 countdown</div>${ex!=null?`<div class="big num">${ex}</div><div class="small muted">days left · ${fLong(toDn(S.settings.examDate))}</div>`:`<div style="margin-top:6px"><button class="btn sm" data-act="go" data-tab="settings">Set exam date</button></div>`}</div>
    <div class="card"><div class="small muted">🔥 Study streak</div><div class="big num">${stk}</div><div class="small muted">days of 100% checklist</div></div>
    <div class="card"><div class="small muted">📋 Today</div><div class="big num">${dp==null?'–':dp+'%'}</div><div class="small muted">checklist done</div></div>
    <div class="card"><div class="small muted">🟠 Old tests left</div><div class="big num" style="color:var(--warn)">${pendingOld().length}</div><div class="small muted">one per Saturday</div></div></div>`;
  // syllabus completion
  let tu=0,td2=0;const rows=SUBJ.map(s=>{let u=0,d=0;S.ch[s.k].forEach(c=>{const st=chStats(c,s.k);u+=c.lec+1;d+=st.done+(c.sheet?1:0)});tu+=u;td2+=d;return{s,u,d}});
  h+=`<section class="sec"><div class="sec-h"><h2>📚 Syllabus completion</h2><span class="sub">Lectures + practice sheets · overall <b>${pct(td2,tu)}%</b></span></div><div class="card stack">`;
  rows.forEach(({s,u,d})=>h+=`<div class="${sc(s.k)}"><div class="row"><span>${s.e}</span><b class="grow" style="color:var(--c)">${s.n}</b><span class="num small"><b>${pct(d,u)}%</b> · ${d}/${u}</span></div><div style="margin-top:5px">${bar(pct(d,u))}</div></div>`);
  if(!tu)h+=`<div class="muted small">Add your chapters in 📚 Syllabus to see progress.</div>`;
  h+=`</div></section>`;
  // chapter status
  const cs={done:0,prog:0,none:0};SUBJ.forEach(s=>S.ch[s.k].forEach(c=>cs[chStatus(c,s.k)]++));const tot=cs.done+cs.prog+cs.none;
  h+=`<section class="sec"><div class="sec-h"><h2>🧩 Chapters</h2></div><div class="card"><div class="grid2" style="grid-template-columns:repeat(3,1fr)">
    <div><div class="big num" style="color:var(--ok)">${cs.done}</div><div class="small muted">✅ Completed</div></div>
    <div><div class="big num" style="color:var(--warn)">${cs.prog}</div><div class="small muted">⏳ In progress</div></div>
    <div><div class="big num">${cs.none}</div><div class="small muted">⬜ Not started</div></div></div>
    ${tot?`<div class="stack-bar" style="margin-top:12px"><i style="width:${pct(cs.done,tot)}%;background:var(--ok)"></i><i style="width:${pct(cs.prog,tot)}%;background:var(--warn)"></i></div>`:''}</div></section>`;
  // week
  const nw=weekOfDn(td),wp=weekProgress(nw.ym,nw.i),w=weeksOf(nw.ym).find(x=>x.i===nw.i);
  h+=`<section class="sec"><div class="sec-h"><h2>🗓️ This week vs target</h2><span class="sub">${ymLabel(nw.ym)} · Week ${nw.i} (${fDM(w.start)} – ${fDM(w.end)})</span></div><div class="card stack">
    <div class="row"><span class="grow">📘 Lectures</span><b class="num">${wp.ld}/${wp.ln}</b></div>${bar(pct(wp.ld,wp.ln))}
    <div class="row"><span class="grow">🔁 Revisions</span><b class="num">${wp.rd}/${wp.rn}</b></div>${bar(pct(wp.rd,wp.rn))}
    <div class="row"><span class="grow">🎯 Tests</span><b class="num">${wp.td}/${wp.tn}</b></div>${bar(pct(wp.td,wp.tn))}
    ${wp.ln+wp.rn+wp.tn===0?`<div class="muted small">Nothing planned for this week yet. Set targets in 🗓️ Week.</div>`:''}</div></section>`;
  const nx=upcomingTests()[0];const last=S.tests.filter(t=>t.given&&scorePct(t)!=null).sort((a,b)=>b.given-a.given)[0];
  h+=`<section class="sec"><div class="grid2">
    <div class="card"><div class="small muted">🔵 Next upcoming test</div>${nx?`<div style="font-weight:700;font-size:17px">${esc(nx.name)}</div><div class="small muted">${fShort(tDn(nx))} · ${tDn(nx)===td?'today':'in '+(tDn(nx)-td)+' days'}</div>`:'<div class="muted">None</div>'}</div>
    <div class="card"><div class="small muted">📈 Last score</div>${last?`<div style="font-weight:700;font-size:17px">${scorePct(last)}%</div><div class="small muted">${esc(last.name)}</div>`:'<div class="muted">No marks entered yet</div>'}</div></div></section>`;
  const top=mistakeRank().slice(0,3);
  h+=`<section class="sec"><div class="sec-h"><h2>🔍 Revise these first</h2><span class="sub">Most mistakes</span></div><div class="card stack">${top.length?top.map(x=>`<div class="row ${sc(x.s)}"><span class="dot"></span><span class="grow">${esc(x.name)}</span><b class="num">${x.n}</b></div>`).join(''):'<div class="muted small">No mistakes logged yet.</div>'}</div></section>`;
  return h}

/* ---------- MISTAKES ---------- */
function allMis(){return Object.values(S.mis).flat().filter(Boolean)}
function mistakeRank(filter){const m={};allMis().filter(x=>!filter||filter==='all'||x.s===filter).forEach(x=>{const k=x.s+'|'+x.ch;(m[k]=m[k]||{s:x.s,name:x.ch,n:0,t:{}}).n++;m[k].t[x.type]=(m[k].t[x.type]||0)+1});return Object.values(m).sort((a,b)=>b.n-a.n)}
function vMistakes(){const f=V.misF;const rank=mistakeRank(f);const all=allMis().filter(x=>f==='all'||x.s===f).sort((a,b)=>b.d-a.d);
  let h=`<div class="row"><h1 class="grow" style="font-size:22px">🔍 Mistake log</h1><button class="btn pri" data-act="addmis">＋ Log a mistake</button></div>
  <div class="chips" style="margin-top:12px"><button class="chip" data-act="misf" data-v="all" aria-pressed="${f==='all'}">All</button>${SUBJ.map(s=>`<button class="chip ${sc(s.k)}" data-act="misf" data-v="${s.k}" aria-pressed="${f===s.k}">${s.e} ${s.n}</button>`).join('')}</div>`;
  const tc={};all.forEach(x=>tc[x.type]=(tc[x.type]||0)+1);
  h+=`<section class="sec"><div class="grid2">${MTYPES.map(t=>`<div class="card"><div class="small muted">${t.e} ${t.n}</div><div class="big num" style="color:${t.c}">${tc[t.k]||0}</div></div>`).join('')}</div></section>`;
  const mx=rank[0]?.n||1;
  h+=`<section class="sec"><div class="sec-h"><h2>📌 Chapters with most mistakes</h2><span class="sub">Revise from the top</span></div><div class="card stack">`;
  if(!rank.length)h+=`<div class="muted small">Nothing logged yet. After a test or DPP, log each mistake here.</div>`;
  rank.slice(0,12).forEach(x=>h+=`<div class="${sc(x.s)}"><div class="row"><span class="dot"></span><span class="grow">${esc(x.name)}</span><b class="num">${x.n}</b></div><div class="stack-bar" style="margin-top:5px;width:${Math.max(8,pct(x.n,mx))}%">${MTYPES.map(t=>x.t[t.k]?`<i style="width:${pct(x.t[t.k],x.n)}%;background:${t.c}" title="${t.n}"></i>`:'').join('')}</div></div>`);
  if(rank.length)h+=`<div class="chips small">${MTYPES.map(t=>`<span class="pill"><span class="dot" style="background:${t.c}"></span>${t.n}</span>`).join('')}</div>`;
  h+=`</div></section><section class="sec"><div class="sec-h"><h2>🗒️ Recent mistakes</h2></div><div class="stack cgrid">`;
  if(!all.length)h+=emptyBox('No mistakes logged.');
  {const L=[];all.slice(0,60).forEach(x=>L.push(()=>{let h='';const t=MTYPES.find(m=>m.k===x.type)||MTYPES[0];h+=`<div class="card ${sc(x.s)}"><div class="row" style="flex-wrap:nowrap"><span class="dot"></span><div class="grow"><b>${esc(x.ch)}</b>${x.topic?` · ${esc(x.topic)}`:''}<div class="small muted">${t.e} ${t.n} · ${esc(x.src||'')} · ${fDM(x.d)}</div></div><button class="x" data-act="rmmis" data-id="${x.id}" data-m="${toIso(x.d).slice(0,7)}" aria-label="Delete">✕</button></div></div>`;return h}));h+=MORE.list(L,8)}
  return h+`</div></section>`}

/* ---------- SYLLABUS ---------- */
function vSyllabus(){const s=V.syl;const cs=S.ch[s];let u=0,d=0;cs.forEach(c=>{u+=c.lec;d+=chStats(c,s).done});const noLec=cs.filter(c=>!c.lec).length;
  let h=`<h1 style="font-size:22px">📚 Syllabus</h1><p class="small muted" style="margin:4px 0 0">NCERT chapters are listed for you. Open a chapter to set its lectures and mark the part you already finished.</p>
  <div class="chips" style="margin-top:12px">${SUBJ.map(x=>`<button class="chip ${sc(x.k)}" data-act="syl" data-v="${x.k}" aria-pressed="${s===x.k}">${x.e} ${x.n} (${S.ch[x.k].length})</button>`).join('')}</div>
  <div class="card ${sc(s)}" style="margin-top:12px"><div class="row"><b class="grow" style="color:var(--c)">${SBY[s].e} ${SBY[s].n}</b><span class="small num">${d}/${u} lectures done</span></div><div style="margin-top:6px">${bar(pct(d,u))}</div>
   <div class="small muted" style="margin-top:8px">Per lecture: ${steps(s).map(st=>esc(stepShort(s,st))).join(' → ')} · then Practice Sheet → Complete</div>
   ${noLec?`<div class="small" style="margin-top:6px;color:var(--warn);font-weight:600">⚠️ ${noLec} chapter${noLec>1?'s':''} still need the number of lectures.</div>`:''}</div>`;
  h+=`<section class="sec"><div class="stack cgrid">`;
  if(!cs.length)h+=emptyBox(`No ${SBY[s].n} chapters yet.`,`<button class="btn pri" data-act="loadncert">Load NCERT chapters</button>`);
  let grp=null;
  {const L=[];cs.forEach((c,i)=>L.push(()=>{let h='';const g=c.cls?'c'+c.cls:'own';if(g!==grp){grp=g;const n=cs.filter(x=>(x.cls?'c'+x.cls:'own')===g).length;h+=`<div class="clshead">${g==='c11'?'📗 Class 11':g==='c12'?'📘 Class 12':'➕ Added by you'} <span>${n} chapter${n>1?'s':''}</span></div>`}
    const st=chStats(c,s);const status=chStatus(c,s);
    h+=`<div class="card ${sc(s)}"><div class="row" style="flex-wrap:nowrap"><span class="dot"></span><div class="grow"><b>${c.cls?`<span class="muted num">${L2(c.no)}</span> `:''}${esc(c.name)}</b><div class="small muted">${c.lec?`${st.done}/${st.total} lectures · ${chPct(c,s)}%`:'Lectures not set'} · sheet ${c.sheet?'✅':'—'} · 🔁 revised ${(c.revs||[]).length}×</div></div>
      ${!c.lec?'<span class="pill" style="color:var(--warn)">🔢 Set lectures</span>':status==='done'?'<span class="pill ok">✅ Complete</span>':status==='prog'?'<span class="pill" style="color:var(--warn)">⏳ In progress</span>':'<span class="pill">⬜ Not started</span>'}</div>
      ${c.lec?`<div style="margin-top:8px">${bar(chPct(c,s))}</div>`:''}
      <div class="row" style="margin-top:8px;gap:6px"><button class="btn sm ${c.lec?'':'pri'}" data-act="opench" data-id="${c.id}">${c.lec?'Open checklist':'Set lectures & progress'}</button><span class="grow"></span>
      <button class="x" data-act="movech" data-id="${c.id}" data-d="-1" ${i===0?'disabled':''} aria-label="Move up">↑</button><button class="x" data-act="movech" data-id="${c.id}" data-d="1" ${i===cs.length-1?'disabled':''} aria-label="Move down">↓</button></div></div>`;return h}));h+=MORE.list(L,14)}
  h+=`</div></section>`;
  h+=`<section class="sec"><div class="card stack ${sc(s)}"><b>＋ Add another chapter</b><div class="small muted">For batch chapters not in the NCERT list (for example Mathematical Tools).</div>
    <div class="fgrid" style="grid-template-columns:2fr 1fr"><label class="f">Chapter name<input type="text" id="newch" list="dl-${s}" placeholder="Type chapter name"></label><label class="f">Lectures<input type="number" id="newlec" min="1" max="200" inputmode="numeric" placeholder="e.g. 8"></label></div>
    <datalist id="dl-${s}">${plannerNames(s).filter(n=>!cs.some(c=>normName(c.name)===normName(n))).map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>
    <div id="newcherr" class="err" hidden></div>
    <button class="btn pri" data-act="addch">Add chapter</button></div></section>`;
  return h}

/* ---------- SETTINGS ---------- */
function vSettings(){const st=S.settings;
  let h=`<h1 style="font-size:22px">⚙️ Settings</h1>
  <section class="sec"><div class="card stack"><label class="f">📅 NEET 2027 exam date<input type="date" id="exam" data-chg="exam" value="${esc(st.examDate)}"></label><div class="small muted">Enter the official date when it is announced.</div><button class="btn pri" data-act="savenow">💾 Save the change</button></div></section>
  <section class="sec"><div class="sec-h"><h2>📝 Question bank names</h2></div><div class="stack">${SUBJ.map(s=>`<div class="card ${sc(s.k)} stack"><b style="color:var(--c)">${s.e} ${s.n}</b><div class="fgrid">
    <label class="f">DPP source<input type="text" data-chg="src" data-s="${s.k}" data-f="dpp" value="${esc(st.src[s.k]?.dpp||'')}"></label>
    <label class="f">Question bank<input type="text" data-chg="src" data-s="${s.k}" data-f="qb" value="${esc(st.src[s.k]?.qb||'')}"></label>
    ${s.bio?`<label class="f">Combo question bank<input type="text" data-chg="src" data-s="${s.k}" data-f="combo" value="${esc(st.src[s.k]?.combo||'')}"></label>`:''}</div></div>`).join('')}<button class="btn pri" data-act="savenow">💾 Save the change</button></div></section>
  <section class="sec"><div class="sec-h"><h2>🌓 Look</h2></div><div class="seg">${['auto','light','dark'].map(t=>`<button data-act="theme" data-v="${t}" aria-pressed="${st.theme===t}">${t==='auto'?'🖥️ Auto':t==='light'?'☀️ Light':'🌙 Dark'}</button>`).join('')}</div></section>
  <section class="sec"><div class="sec-h"><h2>✨ Glass effect</h2></div><div class="seg">${[['full','💎 Full blur'],['lite','🪶 Light']].map(([v,n])=>`<button data-act="glass" data-v="${v}" aria-pressed="${(st.glass||'full')===v}">${n}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px">For computers. Full: every card is frosted glass. Light: only the bars and pop-ups blur. On phones, cards always skip the blur (it looks the same over the soft background) so scrolling stays smooth.</div></section>
  <section class="sec"><div class="sec-h"><h2>🔊 Sounds</h2><button class="btn sm" data-act="sndtest">▶️ Test</button></div><div class="seg">${[[0,'🔇 Off'],[0.35,'🔉 Soft'],[0.7,'🔊 Normal'],[1,'📢 Loud']].map(([v,n])=>`<button data-act="snd" data-v="${v}" aria-pressed="${(st.sound===false?0:st.vol)===v}">${n}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px">Different sounds for ticking ✓, unticking, a finished lecture 🎉, a completed chapter 🏆, a saved test 🎯, adding, deleting, switching screens and mistakes ⚠️.</div></section>
  ${accountHtml()}
  <section class="sec"><div class="sec-h"><h2>💾 Backup</h2></div><div class="card stack">
    <div class="small">${store.mode==='cloud'?'☁️ Your data is saved on this device and synced to your account. Sign in on phone and laptop and you see the same data.':'📱 Right now your data is saved only on this device. Use backups to be safe, or sign in above to sync.'}</div>
    <button class="btn" data-act="export">⬇️ Export all my data (backup file)</button>
    <label class="f">⬆️ Import a backup file<input type="file" id="impfile" accept=".json,application/json,text/plain" data-chg="impfile"></label>
    <details><summary>Or paste backup text</summary><textarea id="imptext" placeholder="Paste backup text here"></textarea><button class="btn sm" data-act="imptext" style="margin-top:8px">Import pasted text</button></details></div></section>
  <section class="sec"><div class="sec-h"><h2>🎯 Test list</h2></div><div class="card stack"><div class="small">Adds any missing tests from the Yakeen NEET 2027 test planner. Your marks are not changed.</div><button class="btn" data-act="loadplanner">Load Yakeen NEET 2027 tests</button></div></section>
  <section class="sec"><div class="sec-h"><h2>📚 NCERT chapters</h2></div><div class="card stack"><div class="small">Adds any missing NCERT Class 11 and 12 chapters (Physics, Chemistry, Zoology, Botany). Your progress is not changed.</div><button class="btn" data-act="loadncert">Load NCERT chapters</button></div></section>
  <section class="sec"><div class="sec-h"><h2>🗑️ Reset</h2></div><div class="card backlog stack"><div class="lab">This deletes ALL your chapters, plans, ticks, marks and mistakes. It cannot be undone.</div>
    <label class="f">Type RESET to confirm<input type="text" id="resetin" autocomplete="off"></label>
    <label class="row small"><input type="checkbox" id="resetload" checked> Load the Yakeen NEET 2027 test list again after reset</label>
    <button class="btn danger" data-act="reset">Reset everything</button></div></section>`;
  return h}

/* Sync account: sign in once per device with the same email and password. */
function accountHtml(){if(!CLOUD.on)return'';const se=CLOUD.sess;const ago=store.synced?Math.max(0,Math.round((Date.now()-store.synced)/60000)):null;
  return`<section class="sec"><div class="sec-h"><h2>☁️ Sync account</h2></div><div class="card stack">${se?`
    <div class="small">Signed in as <b>${esc(se.email)}</b>. Changes sync between all your signed-in devices.${ago!=null?` Last synced ${ago<1?'just now':ago+' min ago'}.`:''}${navigator.onLine?'':' 📴 You are offline right now.'}</div>
    <div class="row"><button class="btn pri" data-act="syncnow">🔄 Sync now</button><button class="btn ghost" data-act="signout">Sign out</button></div>`:`
    <div class="small">Sign in to keep phone and laptop in step. Use the same email and password on each device.</div>
    <div class="fgrid"><label class="f">Email<input type="email" id="acemail" autocomplete="email" inputmode="email"></label><label class="f">Password<input type="password" id="acpw" autocomplete="current-password"></label></div>
    <div id="acerr" class="err" hidden></div>
    <div class="row"><button class="btn pri" data-act="signin">Sign in</button><button class="btn" data-act="signup">Create account</button></div>
    <div class="small muted">First time: tap Create account, open the email you get and tap its link, then come back and Sign in.</div>`}</div></section>`}

/* ---------- render ---------- */
const VIEWS={today:vToday,week:vWeek,month:vMonth,tests:vTests,dash:vDash,mistakes:vMistakes,syllabus:vSyllabus,settings:vSettings};
let ENTER='up'; /* set by navigation; the next render plays one entrance */
/* Long lists: the first cards are drawn at once and the rest are added a moment later, so screens open without waiting. */
const MORE={q:[],n:0,tok:0,
  /* items are small functions that build one card each; only the first few are built now */
  html(a){return a.map(f=>f()||'').join('')},
  list(items,first){if(items.length<=first)return this.html(items);const id='mo'+(++this.n);this.q.push({id,items:items.slice(first)});return this.html(items.slice(0,first))+`<i data-more="${id}" hidden></i>`},
  step(){const j=this.q[0];if(!j)return false;const mk=document.querySelector(`[data-more="${j.id}"]`);if(!mk){this.q.shift();return this.q.length>0}
    mk.insertAdjacentHTML('beforebegin',this.html(j.items.splice(0,8)));if(!j.items.length){mk.remove();this.q.shift()}return this.q.length>0},
  fill(y){const tok=++this.tok;/* only when returning to a scrolled-down spot must the rest be drawn first, so the page can scroll back there */
    if(y>0)while(this.q.length&&document.documentElement.scrollHeight<y+innerHeight*1.3)this.step();
    const go=()=>{if(tok!==this.tok)return;if(this.step())setTimeout(go,0)};if(this.q.length)requestAnimationFrame(()=>setTimeout(go,0))}};
function render(){TIP.hide();const y=window.scrollY;const m=$('main');FX.ctx='r';FX.i=0;MORE.q=[];m.innerHTML=VIEWS[V.tab]();MORE.fill(y);
  {const wc=m.querySelector('.wkchips'),b=wc&&wc.querySelector('[aria-pressed="true"]');if(b&&wc.scrollWidth>wc.clientWidth)wc.scrollLeft=b.offsetLeft-wc.offsetLeft-(wc.clientWidth-b.offsetWidth)/2} /* phones: keep the chosen week in view */
  if(ENTER){m.className='wrap';void m.offsetWidth;m.classList.add('enter');if(ENTER!=='up')m.classList.add(ENTER);[...m.children].forEach((c,i)=>c.style.animationDelay=Math.min(i,10)*40+'ms');clearTimeout(render.t);render.t=setTimeout(()=>{m.className='wrap'},900);ENTER=null}
  document.querySelectorAll('[data-act="go"]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===V.tab?'page':'false'));saveUi(store.dirty.size?'saving':'saved');window.scrollTo(0,y)}
let pendingRender=false;
function softRender(){const a=document.activeElement;if(M||(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))){pendingRender=true;return}render()}
document.addEventListener('focusout',()=>{if(pendingRender&&!M){setTimeout(()=>{const a=document.activeElement;if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))){pendingRender=false;render()}},50)}});
function go(tab){V.tab=tab;ENTER='up';window.scrollTo(0,0);render()}
let tTimer;function toast(msg,kind){if(kind)SND.play(kind);const t=$('toast');t.textContent=msg;t.classList.toggle('bad',kind==='err');t.hidden=false;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(tTimer);tTimer=setTimeout(()=>{t.classList.remove('show');tTimer=setTimeout(()=>t.hidden=true,300)},2600)}
function applyTheme(){const t=S.settings.theme;const r=document.documentElement;r.classList.toggle('glass-lite',S.settings.glass==='lite');if(t==='light'||t==='dark')r.setAttribute('data-theme',t);else if(hostTheme)r.setAttribute('data-theme',hostTheme);else r.removeAttribute('data-theme');
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=getComputedStyle(r).getPropertyValue('--bar').trim()||m.content}

/* ---------- modal ---------- */
function openM(m){M=m;M.st=M.st||{};renderM()}
function renderM(){if(!M){$('modal').innerHTML='';return}const old=$('modal').querySelector('.sheet');const top=old?old.scrollTop:0;FX.ctx='m';FX.i=0;
  $('modal').innerHTML=`<div class="scrim ${old?'':'in'}" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(M.title)}"><div class="sheet-h"><h2>${M.title}</h2><button class="x" data-act="closem" aria-label="Close">✕</button></div>${M.body()}</div></div>`;FX.ctx='r';
  if(old)$('modal').querySelector('.sheet').scrollTop=top}
function closeM(){const sc=$('modal').querySelector('.scrim');if(sc&&!FX.reduced()){const g=sc.cloneNode(true);g.classList.remove('in');g.classList.add('out');g.removeAttribute('data-act');g.querySelectorAll('[data-act],[data-chg],[id]').forEach(x=>{x.removeAttribute('data-act');x.removeAttribute('data-chg');x.removeAttribute('id')});document.body.appendChild(g);setTimeout(()=>g.remove(),260)}
  M=null;renderM();if(pendingRender){pendingRender=false}render()}

function addItem(it){const r=dayRec(V.day,true);
  if(r.items.some(x=>x.k===it.k&&x.ch===it.ch&&(it.k!=='lec'||x.n===it.n))){const ex=r.items.find(x=>x.k===it.k&&x.ch===it.ch&&x.n===it.n);if(it.k==='lec'&&ex){ex.st=[...new Set([...ex.st,...it.st])]}else{toast('Already on this day','err');return false}}
  else r.items.push(it);store.mark(dayKey(V.day));return true}

/* marks */
function mMarks(id,dn){const t=testById(id);if(!t)return;const m=t.m||{};
  openM({title:`🎯 ${esc(t.name)}`,body(){return`<div class="stack"><div class="small muted">${testLine(t)}</div>
    <label class="f">Date given<input type="date" id="mgd" value="${toIso(t.given||dn||today())}"></label>
    <div class="fgrid"><label class="f">Marks scored<input type="number" id="mscore" inputmode="decimal" value="${m.score??''}" placeholder="e.g. 520"></label><label class="f">Total marks<input type="number" id="mmax" inputmode="decimal" value="${m.max??t.max??''}" placeholder="e.g. 720"></label></div>
    <div class="f small" style="font-weight:600;color:var(--muted)">Subject-wise marks (optional)</div>
    <div class="fgrid">${SUBJ.map(s=>`<label class="f ${sc(s.k)}"><span style="color:var(--c)">${s.e} ${s.n}</span><input type="number" id="ms-${s.k}" inputmode="decimal" value="${m[s.k]??''}"></label>`).join('')}</div>
    <label class="f">Note<input type="text" id="mnote" value="${esc(m.note||'')}" placeholder="optional"></label>
    <div id="merr" class="err" hidden></div>
    <button class="btn pri full" data-act="msavemarks" data-id="${t.id}">✅ Save — test given</button>
    ${t.given?`<button class="btn danger full" data-act="mungiven" data-id="${t.id}">Mark as NOT given</button>`:''}
    <button class="btn ghost full" data-act="addmis" data-src="${esc('Test: '+t.name)}">🔍 Log mistakes from this test</button></div>`}})}
/* edit/add test */
function mEditTest(id){const t=id?testById(id):null;
  openM({title:t?'Edit test':'＋ Add test',body(){return`<div class="stack">
    <label class="f">Test name<input type="text" id="tname" value="${esc(t?.name||'')}" placeholder="e.g. NEET-7"></label>
    <div class="fgrid"><label class="f">Date<input type="date" id="tdate" value="${esc(t?.date||'')}"></label><label class="f">Type<input type="text" id="ttype" value="${esc(t?.type||'')}" placeholder="e.g. Part Test"></label></div>
    <div class="small muted">A test with a past date (or no date) counts as a pending old test.</div>
    ${SUBJ.map(s=>`<label class="f ${sc(s.k)}"><span style="color:var(--c)">${s.e} ${s.n} syllabus (one per line)</span><textarea id="tsyl-${s.k}">${esc((t?.syl?.[s.k]||[]).join('\n'))}</textarea></label>`).join('')}
    <div id="terr" class="err" hidden></div>
    <button class="btn pri full" data-act="msavetest" data-id="${t?.id||''}">Save test</button>
    ${t?`<button class="btn danger full" data-act="mdeltest" data-id="${t.id}">${this.st.del?'Tap again to delete for good':'Delete test'}</button>`:''}</div>`}})}
/* mistake */
function mMistake(src){const s0=V.misF!=='all'?V.misF:'phy';
  openM({title:'🔍 Log a mistake',st:{s:s0,type:'concept',ch:''},body(){const st=this.st;const cs=S.ch[st.s];
    const srcs=['DPP','Practice sheet',...S.tests.filter(t=>t.given).sort((a,b)=>b.given-a.given).map(t=>'Test: '+t.name),'Other'];if(src&&!srcs.includes(src))srcs.unshift(src);
    return`<div class="stack"><div class="chips">${SUBJ.map(s=>`<button class="chip ${sc(s.k)}" data-act="mset" data-k="s" data-v="${s.k}" aria-pressed="${st.s===s.k}">${s.e} ${s.n}</button>`).join('')}</div>
      <label class="f">Chapter<select id="mmch" data-chg="mset" data-k="ch">${cs.map(c=>`<option value="${c.id}" ${st.ch===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}<option value="__other" ${st.ch==='__other'||!cs.length?'selected':''}>Other (type name)</option></select></label>
      ${st.ch==='__other'||!cs.length?`<label class="f">Chapter name<input type="text" id="mmchtxt" list="dl-m"></label><datalist id="dl-m">${plannerNames(st.s).map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>`:''}
      <label class="f">Question topic<input type="text" id="mmtopic" placeholder="e.g. Relative velocity in rain problems"></label>
      <div class="f small" style="font-weight:600;color:var(--muted)">Type of mistake</div>
      <div class="chips">${MTYPES.map(t=>`<button class="chip" data-act="mset" data-k="type" data-v="${t.k}" aria-pressed="${st.type===t.k}">${t.e} ${t.n}</button>`).join('')}</div>
      <div class="fgrid"><label class="f">From<select id="mmsrc">${srcs.map(x=>`<option ${x===src?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="f">Date<input type="date" id="mmdate" value="${toIso(today())}"></label></div>
      <div id="mmerr" class="err" hidden></div><button class="btn pri full" data-act="msavemis">Save mistake</button></div>`}})}
/* chapter checklist */
function mChapter(id){const f0=findCh(id);openM({title:'📖 Chapter checklist',st:{edit:!!f0&&!f0.c.lec,del:false},body(){const f=findCh(id);if(!f)return'<div>Deleted.</div>';const c=f.c,s=f.s,st=this.st,cs=chStats(c,s),td=today();
  const head=`<div><b style="font-size:17px">${esc(c.name)}</b><div class="small muted">${SBY[s].e} ${SBY[s].n}${c.cls?` · NCERT Class ${c.cls} · Ch ${L2(c.no)}`:''} · ${c.lec?`${cs.done}/${cs.total} lectures done (${chPct(c,s)}%)`:'lectures not set'}</div></div>`;
  const edit=st.edit?`<div class="card stack"><b>${c.lec?'✏️ Edit chapter':'🔢 How many lectures does this chapter have?'}</b><div class="fgrid" style="grid-template-columns:2fr 1fr"><label class="f">Name<input type="text" id="ecname" value="${esc(c.name)}"></label><label class="f">Lectures<input type="number" id="eclec" min="1" max="200" inputmode="numeric" value="${c.lec||''}" placeholder="e.g. 8"></label></div><div id="ecerr" class="err" hidden></div><button class="btn pri" data-act="gsavech" data-id="${c.id}">Save</button></div>`:'';
  if(!c.lec)return`<div class="stack ${sc(s)}">${head}${edit}<div class="small muted">Enter the number of lectures in your batch for this chapter. Then you can tick lectures or mark the part you already finished.</div></div>`;
  return`<div class="stack ${sc(s)}">${head}
    <div class="card stack"><b>✍️ Already done before using this app</b>
      <div class="row"><span class="grow">Lectures done (all steps)</span><span class="stepper"><button data-act="early" data-id="${c.id}" data-d="-1" aria-label="One less">−</button><span>${cs.done}</span><button data-act="early" data-id="${c.id}" data-d="1" aria-label="One more">＋</button></span></div>
      ${bar(chPct(c,s))}
      <div class="row small"><span class="muted">Quick set:</span><div class="chips">${[25,50,60,75,100].map(p=>`<button class="chip" data-act="earlyp" data-id="${c.id}" data-p="${p}">${p}%</button>`).join('')}</div></div>
      <div class="small muted">These are saved as "done earlier", so they don't count as this week's work. Practice sheet: ${c.sheet?'✅ done':`<button class="btn sm" data-act="gsheetearly" data-id="${c.id}">Mark done earlier</button>`}</div></div>
    <div class="tbl"><table><thead><tr><th>Lecture</th>${steps(s).map(x=>`<th>${esc(stepShort(s,x))}</th>`).join('')}</tr></thead><tbody>
    ${Array.from({length:c.lec},(_,i)=>i+1).map(n=>`<tr><td>${lecDone(c,s,n)?'✅ ':''}L-${L2(n)}</td>${steps(s).map(x=>{const v=c.p[n]?.[x];return`<td><button class="mini ${v?'on':''}" data-act="gtick" data-id="${c.id}" data-n="${n}" data-st="${x}" title="${v?'Done '+fWhen(v):'Not done'}" aria-label="Lecture ${n} ${esc(stepShort(s,x))}">✓</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="small muted">Ticks in this table are dated today (${fDM(td)}).</div>
    <button class="tick ${c.sheet?'on':''}" data-act="gsheet" data-id="${c.id}"><span class="box">✓</span><span class="lbl">📄 Practice sheet solved</span>${c.sheet?`<span class="when">${fWhen(c.sheet)}</span>`:''}</button>
    <button class="tick ${c.done?'on':''}" data-act="gdone" data-id="${c.id}"><span class="box">✓</span><span class="lbl">🏁 Chapter COMPLETE</span>${c.done?`<span class="when">${fWhen(c.done)}</span>`:''}</button>
    <div class="small muted">🔁 Revised ${(c.revs||[]).length} time${(c.revs||[]).length===1?'':'s'}${(c.revs||[]).length?' · last '+fDM(Math.max(...c.revs)):''}</div>
    ${edit||`<button class="btn" data-act="mset" data-k="edit" data-v="1">✏️ Edit name / lectures</button>`}
    <button class="btn danger" data-act="gdelch" data-id="${c.id}">${st.del?'Tap again to delete this chapter and its ticks':'🗑️ Delete chapter'}</button></div>`}})}
function mPickOld(){const p=plan(V.ym,true);const list=[...new Set([...p.old.map(testById).filter(Boolean),...pendingOld()])].sort(byDate);
  openM({title:'🟠 Old tests for this month',st:{sel:new Set(p.old)},body(){const st=this.st;
    return`<div class="stack"><div class="small muted">${weeksOf(V.ym).length} Saturdays this month · picked ${st.sel.size}</div>
    ${list.length?list.map(t=>`<button class="tick ${st.sel.has(t.id)?'on':''}" data-act="moldtog" data-id="${t.id}"><span class="box">✓</span><span class="lbl"><b>${esc(t.name)}</b> <span class="small muted">${t.date?fDM(tDn(t)):''}${t.given?' · given':''}</span></span></button>`).join(''):emptyBox('No pending old tests.')}
    <button class="btn pri full" data-act="moldsave">Save</button></div>`}})}
/* ---------- tick-box chapter pickers ----------
   Every "add chapter" sheet lists chapters by subject with a tick box each, so several can be added at once.
   Ticks live in st.pick (a Set); st.pf is the subject filter; extra(x) draws controls under a ticked chapter. */
function pickList(st,list,extra){const f=st.pf||'all';const subs=SUBJ.filter(s=>list.some(x=>x.s===s.k));
  if(!list.length)return'';
  let h=subs.length>1?`<div class="chips pickf"><button class="chip" data-act="mpf" data-v="all" aria-pressed="${f==='all'}">All (${list.length})</button>${subs.map(s=>`<button class="chip ${sc(s.k)}" data-act="mpf" data-v="${s.k}" aria-pressed="${f===s.k}">${s.e} ${s.n}</button>`).join('')}</div>`:'';
  h+=`<div class="picklist">${subs.filter(s=>f==='all'||f===s.k).map(s=>`<div class="sgl ${sc(s.k)}">${s.e} ${s.n}</div>`+list.filter(x=>x.s===s.k).map(x=>{const on=st.pick.has(x.c.id);
    return`<div class="pickrow ${sc(s.k)} ${on?'on':''}"><button class="tick ${on?'on':''}" data-act="mpick" data-id="${x.c.id}"><span class="box">✓</span><span class="lbl">${x.tag||''}${esc(x.c.name)}${x.note?`<small class="pnote">${x.note}</small>`:''}</span></button>${on&&extra?`<div class="pickx">${extra(x)}</div>`:''}</div>`}).join('')).join('')}</div>`;
  return h}
const pickBar=(st,act,label)=>`<div class="pickbar"><span class="small muted">${st.pick.size} selected</span><button class="btn pri" data-act="${act}" ${st.pick.size?'':'disabled'}>${label(st.pick.size)}</button></div>`;
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
/* a stepper for a number kept in st.t[id], limited to st.cap[id] */
const capStepper=(st,id,label)=>{const v=st.t[id]||0,cap=st.cap[id]||0;return`<div class="row"><span class="small muted">${label}</span><span class="stepper"><button data-act="mpt" data-id="${id}" data-d="-1" aria-label="Less" ${v<=0?'disabled':''}>−</button><span>${v}</span><button data-act="mpt" data-id="${id}" data-d="1" aria-label="More" ${v>=cap?'disabled':''}>＋</button></span><span class="small muted">max ${cap}</span></div>`};

/* Lectures still to study in a chapter when a period starts: total lectures minus those finished before it. */
function lecLeftAt(c,s,dn){if(!c.lec)return 0;let k=0;for(let n=1;n<=c.lec;n++){const d=lecDone(c,s,n);if(d&&d<dn)k++}return c.lec-k}
/* Most lectures that can be planned for a chapter in a month, and in one week of it (what other weeks already hold is taken off). */
function monthCap(ym,id){const f=findCh(id);return f?lecLeftAt(f.c,f.s,monthRange(ym).a):0}
function weekCap(ym,i,id){return Math.max(0,monthCap(ym,id)-wkPlanInfo(ym,i,id).other)}

/* add task (lecture / sheet / complete) for one subject; several chapters can be ticked */
function mAddTask(s){const cs=S.ch[s].filter(c=>!c.done&&c.lec>0);const noLec=S.ch[s].filter(c=>!c.done&&!c.lec).length;
  openM({title:`${SBY[s].e} Add ${SBY[s].n} task`,st:{k:'lec',pick:new Set(),sel:{}},body(){const st=this.st;
    if(!cs.length)return emptyBox(noLec?`Set the number of lectures for your ${SBY[s].n} chapters first (📚 Syllabus → Open).`:`No open ${SBY[s].n} chapters. Add chapters first.`,`<button class="btn pri" data-act="gosyl" data-s="${s}">📚 Open Syllabus</button>`);
    const SS=steps(s);
    const block=({c})=>{const cst=chStats(c,s);
      if(st.k==='sheet')return`<div class="small muted">${cst.allLec?'✅ All lectures done. Time for the practice sheet.':`⚠️ Only ${cst.done}/${cst.total} lectures done. Your ritual says: practice sheet after all lectures.`}</div>`;
      if(st.k==='done')return`<div class="small muted">${cst.allLec&&c.sheet?'✅ Everything is done. Mark the chapter complete.':`⚠️ Needs all lectures (${cst.done}/${cst.total}) and the practice sheet (${c.sheet?'✅':'❌'}) first.`}</div>`;
      const sel=st.sel[c.id]||(st.sel[c.id]={});const open=Array.from({length:c.lec},(_,i)=>i+1).filter(n=>!lecDone(c,s,n));
      const grid=open.length?`<div class="tbl ${sc(s)}"><table><thead><tr><th>Lecture</th>${SS.map(x=>`<th>${esc(stepShort(s,x))}</th>`).join('')}</tr></thead><tbody>
        ${open.map(n=>`<tr><td><button class="rowbtn" data-act="mrow" data-ch="${c.id}" data-n="${n}" title="Pick all steps of this lecture">L-${L2(n)}</button></td>${SS.map(x=>c.p[n]?.[x]?`<td><span class="mini on done" title="Done ${fWhen(c.p[n][x])}">✓</span></td>`:`<td><button class="mini ${(sel[n]||[]).includes(x)?'on':''}" data-act="mcell" data-ch="${c.id}" data-n="${n}" data-v="${x}" aria-label="Lecture ${n} ${esc(stepShort(s,x))}">✓</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${cst.done?`<div class="small muted">${cst.done} finished lecture${cst.done>1?'s are':' is'} hidden.</div>`:''}`:emptyBox('All lectures of this chapter are done.');
      return`<div class="f small" style="font-weight:700;color:var(--muted)">Quick pick: next lectures, all steps</div>
        <div class="chips ${sc(s)}">${[1,2,3,4,5].filter(k=>k<=open.length).map(k=>`<button class="chip" data-act="mquick" data-ch="${c.id}" data-v="${k}">${plural(k,'lecture')}</button>`).join('')}<button class="chip" data-act="mclear" data-ch="${c.id}">Clear</button></div>
        <div class="f small" style="font-weight:700;color:var(--muted)">Or tick exactly what you will do</div>${grid}`};
    const cnt=st.k==='lec'?SS.map(x=>[x,Object.values(st.sel).reduce((a,sel)=>a+Object.values(sel).filter(v=>v.includes(x)).length,0)]).filter(x=>x[1]):[];
    return`<div class="stack"><div class="seg">${[['lec','🎬 Lecture'],['sheet','📄 Practice Sheet'],['done','🏁 Complete']].map(([k,n])=>`<button data-act="mset" data-k="k" data-v="${k}" aria-pressed="${st.k===k}">${n}</button>`).join('')}</div>
      <div class="small muted">Tick one or more chapters:</div>
      ${pickList(st,cs.map(c=>({c,s,note:`${chStats(c,s).done}/${c.lec} lectures`})),block)}
      ${st.k==='lec'?`<div class="plansum"><b>Plan:</b> ${cnt.length?cnt.map(([x,k])=>`${k} × ${esc(stepShort(s,x))}`).join(' · '):'nothing picked yet'}</div>`:''}
      <button class="btn pri full" data-act="msavetask" data-s="${s}" ${st.pick.size?'':'disabled'}>Add to ${V.day===today()?'today':fShort(V.day)}</button></div>`}})}
/* revision chapters for the R-Q session: this week's plan first (🔴 = backlog), then every chapter */
function mAddRev(){const ym=planYmOf(V.day);const rv=revWeek(ym,weekOfDn(V.day).i);const any=SUBJ.some(s=>S.ch[s.k].length);
  const list=[];SUBJ.forEach(s=>{const cs=S.ch[s.k];const rank=c=>rv.back.includes(c.id)?0:rv.cur.includes(c.id)?1:2;
    [...cs].sort((a,b)=>rank(a)-rank(b)).forEach(c=>list.push({c,s:s.k,tag:rv.back.includes(c.id)?'🔴 ':rv.cur.includes(c.id)?'📌 ':'',note:rv.back.includes(c.id)?'backlog this week':rv.cur.includes(c.id)?'planned this week':''}))});
  openM({title:'🔁 Add revision chapters',st:{pick:new Set()},body(){const st=this.st;if(!any)return emptyBox('No chapters yet.',`<button class="btn pri" data-act="gosyl" data-s="phy">📚 Open Syllabus</button>`);
    return`<div class="stack"><div class="small muted">📌 = in this week's revision plan · 🔴 = revision backlog</div>${pickList(st,list)}${pickBar(st,'mrevsave',n=>`Add ${plural(n,'chapter')} to R-Q session`)}</div>`}})}
function mAddNew(kind){const p=plan(V.ym,true);
  const list=[];SUBJ.forEach(s=>S.ch[s.k].forEach(c=>{if(!c.done&&!p.newCh.some(x=>x.id===c.id))list.push({c,s:s.k,note:c.lec?`${chStats(c,s.k).done}/${c.lec} lectures done`:'lectures not set yet'})}));
  openM({title:kind==='bk'?'🎯 Add backlog chapters':'📘 Add class-schedule chapters',st:{pick:new Set(),t:{},cap:{},kind},body(){const st=this.st;
    if(!list.length)return emptyBox('No open chapters left to add. Add chapters in Syllabus.',`<button class="btn pri" data-act="gosyl" data-s="phy">📚 Open Syllabus</button>`);
    return`<div class="stack"><div class="small muted">Tick the chapters, then set how many lectures of each you will study in ${ymLabel(V.ym)}.</div>
      ${pickList(st,list,x=>x.c.lec?capStepper(st,x.c.id,'Lectures this month'):`<div class="small warnt">🔢 Set this chapter's number of lectures in 📚 Syllabus to plan its lectures. It is added with 0 for now.</div>`)}
      ${pickBar(st,'mnewsave',n=>`Add ${plural(n,'chapter')} to ${ymLabel(V.ym)}`)}</div>`}})}
function mAddRevM(){const p=plan(V.ym,true);const list=[];SUBJ.forEach(s=>S.ch[s.k].forEach(c=>{if(!p.rev.includes(c.id))list.push({c,s:s.k,note:(c.revs||[]).length?`revised ${c.revs.length}×`:''})}));
  openM({title:'🔁 Add chapters to revise',st:{pick:new Set()},body(){const st=this.st;if(!list.length)return emptyBox('No chapters available.');
    return`<div class="stack">${pickList(st,list)}${pickBar(st,'mrmsave',n=>`Add ${plural(n,'chapter')} to revise`)}</div>`}})}
/* Week: tick this month's planned chapters; each ticked one gets a lecture count (suggested, never above what is left) */
function mWkPick(){const ym=V.ym,p=plan(ym,true),wt=p.weeks[V.wk]?.t||{},W=weeksOf(ym),wl=Math.max(1,W.filter(x=>x.i>=V.wk).length);
  const list=p.newCh.filter(it=>!(it.id in wt)&&findCh(it.id)&&!findCh(it.id).c.done).map(it=>{const f=findCh(it.id),k=wkPlanInfo(ym,V.wk,it.id);return{c:f.c,s:f.s,it,tag:isBk(it)?'🎯 ':'',note:`${k.left} of ${k.target} lectures left to plan`}});
  openM({title:`☑️ Chapters for Week ${V.wk}`,st:{pick:new Set(),t:{},cap:{}},body(){const st=this.st;
    if(!list.length)return emptyBox("All of this month's chapters are already in this week.");
    return`<div class="stack"><div class="small muted">Only chapters planned for ${ymLabel(ym)} are listed. 🎯 = backlog chapter.</div>
      ${pickList(st,list,x=>capStepper(st,x.c.id,'Lectures this week'))}${pickBar(st,'wkpsave',n=>`Add ${plural(n,'chapter')} to Week ${V.wk}`)}</div>`},
    init:{ym,wl}})}
/* a newly ticked chapter gets its starting lecture count */
function pickDefaults(id){const st=M.st;const f=findCh(id);if(!f)return;
  if(M.init){const k=wkPlanInfo(M.init.ym,V.wk,id);st.cap[id]=weekCap(M.init.ym,V.wk,id);st.t[id]=Math.min(st.cap[id],Math.ceil(k.left/M.init.wl));return}
  if(st.cap){st.cap[id]=lecLeftAt(f.c,f.s,monthRange(V.ym).a);st.t[id]=st.cap[id]}
  if(st.sel&&!st.sel[id]){const n0=nextLec(f.c,f.s);st.sel[id]={};if(n0)st.sel[id][n0]=steps(f.s).filter(x=>!f.c.p[n0]?.[x])}}

/* ---------- actions ---------- */
const A={
  go:d=>{if(M)closeM();go(d.tab)},
  closem:()=>closeM(), scrim:(d,el)=>{}, savenow:()=>saveNow(),
  dv:d=>{if(V.dv===d.v)return;ENTER='up';V.dv=d.v;render();SND.play('nav')}, rg:d=>{V.rg=+d.v;ENTER='up';render();SND.play('tap')}, rvf:d=>{V.rvF=d.v;render();SND.play('tap')},
  day:d=>{const nd=+d.d===0?today():V.day+ +d.d;ENTER=nd>V.day?'l':'r';V.day=nd;render()},
  ym:d=>{ENTER=+d.d>0?'l':'r';V.ym=shiftYm(V.ym,+d.d);V.wk=1;const n=weekOfDn(today());if(n.ym===V.ym)V.wk=n.i;render()},
  wk:d=>{ENTER=+d.i>V.wk?'l':+d.i<V.wk?'r':null;V.wk=+d.i;render()},
  tt:d=>{V.tt=d.v;render()}, misf:d=>{V.misF=d.v;render()}, syl:d=>{V.syl=d.v;render()},
  gosyl:d=>{V.syl=d.s;closeM();go('syllabus')},
  addtask:d=>mAddTask(d.s), addrev:()=>mAddRev(),
  mset:(d)=>{const v=d.v;M.st[d.k]=d.k==='n'?+v:v;if(d.k==='ch'||d.k==='n'){M.st.sts=null;M.st.sel=null}if(d.k==='s')M.st.ch='';if(d.k==='edit')M.st.edit=true;renderM()},
  mstep:d=>{const s=M.st.sts;const i=s.indexOf(d.v);if(i>=0)s.splice(i,1);else s.push(d.v);renderM()},
  mcell:d=>{const sel=M.st.sel[d.ch]||(M.st.sel[d.ch]={}),n=d.n,a=sel[n]||(sel[n]=[]);const i=a.indexOf(d.v);if(i>=0)a.splice(i,1);else a.push(d.v);if(!a.length)delete sel[n];renderM();SND.play(i>=0?'off':'on')},
  mrow:d=>{const f=findCh(d.ch);if(!f)return;const sel=M.st.sel[d.ch]||(M.st.sel[d.ch]={});const n=d.n,left=steps(f.s).filter(x=>!f.c.p[n]?.[x]);const has=(sel[n]||[]).length===left.length;if(has)delete sel[n];else sel[n]=left;renderM();SND.play(has?'off':'on')},
  mquick:d=>{const f=findCh(d.ch);if(!f)return;const sel={};let k=+d.v;for(let n=1;n<=f.c.lec&&k>0;n++){if(lecDone(f.c,f.s,n))continue;sel[n]=steps(f.s).filter(x=>!f.c.p[n]?.[x]);k--}M.st.sel[d.ch]=sel;renderM();SND.play('add')},
  mclear:d=>{M.st.sel[d.ch]={};renderM();SND.play('off')},
  msavetask:d=>{const st=M.st;const ids=[...st.pick];if(!ids.length){toast('Tick at least one chapter','err');return}
    if(st.k==='lec'){let k=0;ids.forEach(id=>{const f=findCh(id);if(!f)return;Object.entries(st.sel[id]||{}).filter(([,a])=>a.length).sort((a,b)=>a[0]-b[0]).forEach(([n,a])=>{addItem({k:'lec',ch:id,n:+n,st:steps(f.s).filter(x=>a.includes(x))});k++})});
      if(!k){toast('Tick at least one lecture step','err');return}closeM();toast(`Added ${plural(k,'lecture')} ✅`);return}
    let k=0;ids.forEach(id=>{if(addItem({k:st.k,ch:id}))k++});if(k){closeM();toast(`Added ${plural(k,'task')} ✅`)}},
  mpick:d=>{const st=M.st;const on=!st.pick.has(d.id);if(on){st.pick.add(d.id);pickDefaults(d.id)}else st.pick.delete(d.id);renderM();SND.play(on?'on':'off')},
  mpf:d=>{M.st.pf=d.v;renderM()},
  mpt:d=>{const st=M.st,cap=st.cap[d.id]||0,v=(st.t[d.id]||0)+ +d.d;if(+d.d>0&&v>cap){toast(`Only ${plural(cap,'lecture')} left to plan in this chapter`,'err');return}st.t[d.id]=clamp(v,0,cap);renderM()},
  mrevsave:()=>{let k=0;[...M.st.pick].forEach(id=>{if(addItem({k:'rev',ch:id}))k++});closeM();if(k)toast(`${plural(k,'chapter')} added to R-Q session`)},
  rmitem:d=>{const r=dayRec(V.day);if(!r)return;r.items.splice(+d.i,1);store.mark(dayKey(V.day));render()},
  tick:d=>{const dn=+d.dn,r=dayRec(dn);const it=r.items[+d.i];const f=findCh(it.ch);const p=f.c.p[it.n]||(f.c.p[it.n]={});const was=!!p[d.st];if(was)delete p[d.st];else p[d.st]=dn;if(!Object.keys(p).length)delete f.c.p[it.n];store.mark('ch-'+f.s);render();
    if(!was&&lecDone(f.c,f.s,it.n)){SND.play('lecture');toast(`Lecture ${L2(it.n)} fully done 🎉`)}else SND.play(was?'off':'on')},
  ticksheet:d=>{const dn=+d.dn,it=dayRec(dn).items[+d.i],f=findCh(it.ch);f.c.sheet=f.c.sheet?0:dn;store.mark('ch-'+f.s);render();SND.play(f.c.sheet?'lecture':'off')},
  tickdone:d=>{const dn=+d.dn,it=dayRec(dn).items[+d.i],f=findCh(it.ch);if(!f.c.done){const st=chStats(f.c,f.s);if(!st.allLec||!f.c.sheet){toast('Finish all lectures and the practice sheet first','err');return}f.c.done=dn;toast('Chapter complete 🏆','chapter')}else{f.c.done=0;SND.play('off')}store.mark('ch-'+f.s);render()},
  tickrev:d=>{const dn=+d.dn,it=dayRec(dn).items[+d.i],f=findCh(it.ch);f.c.revs=f.c.revs||[];const i=f.c.revs.indexOf(dn);if(i>=0)f.c.revs.splice(i,1);else f.c.revs.push(dn);store.mark('ch-'+f.s);render();SND.play(i>=0?'off':'rev')},
  carry:()=>{const prev=V.day-1,pr=dayRec(prev);if(!pr||!pr.items.length){toast('Nothing planned on the previous day','err');return}let k=0;
    pr.items.forEach(it=>{const f=findCh(it.ch);if(!f)return;if(it.k==='lec'){const left=it.st.filter(st=>!f.c.p[it.n]?.[st]);if(left.length){addItem({k:'lec',ch:it.ch,n:it.n,st:left});k++}}
      else if(itemUnits(it,prev).some(x=>!x)){const r=dayRec(V.day,true);if(!r.items.some(x=>x.k===it.k&&x.ch===it.ch)){r.items.push({k:it.k,ch:it.ch});k++}}});
    store.mark(dayKey(V.day));render();toast(k?`Brought ${k} unfinished task${k>1?'s':''} ↪️`:'Everything was finished 🎉')},
  marks:d=>mMarks(d.id,d.dn?+d.dn:today()),
  msavemarks:d=>{const t=testById(d.id);const g=$('mgd').value;const e=$('merr');const sc=numOrNull($('mscore').value),mx=numOrNull($('mmax').value);
    const sub={};SUBJ.forEach(s=>sub[s.k]=numOrNull($('ms-'+s.k).value));
    if(!g){e.textContent='Enter the date you gave the test.';e.hidden=false;return}
    let score=sc;const subs=SUBJ.map(s=>sub[s.k]).filter(v=>v!=null);if(score==null&&subs.length)score=subs.reduce((a,b)=>a+b,0);
    if(score!=null&&mx!=null&&score>mx){e.textContent='Marks scored cannot be more than total marks.';e.hidden=false;return}
    if(mx!=null&&mx<=0){e.textContent='Total marks must be more than 0.';e.hidden=false;return}
    t.given=toDn(g);t.m=Object.assign({score,max:mx,note:$('mnote').value.trim()},sub);store.mark('tests');closeM();toast('Test saved ✅','test')},
  mungiven:d=>{const t=testById(d.id);t.given=0;store.mark('tests');closeM();toast('Marked as not given')},
  edittest:d=>mEditTest(d.id),
  msavetest:d=>{const name=$('tname').value.trim(),e=$('terr');if(!name){e.textContent='Enter a test name.';e.hidden=false;return}
    const syl={};SUBJ.forEach(s=>syl[s.k]=$('tsyl-'+s.k).value.split('\n').map(x=>x.trim()).filter(Boolean));
    let t=d.id?testById(d.id):null;if(!t){t={id:'t-'+uid(),given:0,m:null,src:'me'};S.tests.push(t)}
    Object.assign(t,{name,date:$('tdate').value||'',type:$('ttype').value.trim(),syl});store.mark('tests');closeM();toast('Test saved')},
  mdeltest:d=>{if(!M.st.del){M.st.del=true;renderM();return}S.tests=S.tests.filter(t=>t.id!==d.id);Object.values(S.plans).forEach(p=>p.old=(p.old||[]).filter(x=>x!==d.id));store.mark('tests','plans');closeM();toast('Test deleted')},
  addmis:d=>{const src=d.src;if(M)M=null;mMistake(src)},
  msavemis:()=>{const st=M.st,e=$('mmerr');let name='',chId=null;const sel=$('mmch')?.value;
    if(sel&&sel!=='__other'){chId=sel;name=findCh(sel)?.c.name||''}else name=($('mmchtxt')?.value||'').trim();
    if(!name){e.textContent='Choose or type the chapter.';e.hidden=false;return}const dd=$('mmdate').value;if(!dd){e.textContent='Enter a date.';e.hidden=false;return}
    const dn=toDn(dd),m=dd.slice(0,7);(S.mis[m]=S.mis[m]||[]).push({id:uid(),d:dn,s:st.s,ch:name,chId,topic:$('mmtopic').value.trim(),type:st.type,src:$('mmsrc').value});
    store.mark('mis-'+m);closeM();toast('Mistake logged 🔍')},
  rmmis:d=>{const a=S.mis[d.m];if(!a)return;S.mis[d.m]=a.filter(x=>x.id!==d.id);store.mark('mis-'+d.m);render()},
  addch:()=>{const s=V.syl,n=$('newch').value.trim(),l=parseInt($('newlec').value,10),e=$('newcherr');
    if(!n){e.textContent='Enter the chapter name.';e.hidden=false;return}if(!(l>=1&&l<=200)){e.textContent='Enter number of lectures (1 to 200).';e.hidden=false;return}
    if(S.ch[s].some(c=>normName(c.name)===normName(n))){e.textContent='This chapter is already added.';e.hidden=false;return}
    S.ch[s].push({id:'c-'+uid(),name:n,lec:l,p:{},sheet:0,done:0,revs:[]});store.mark('ch-'+s);render();toast('Chapter added ✅')},
  opench:d=>mChapter(d.id),
  movech:d=>{const f=findCh(d.id);const a=S.ch[f.s];const i=a.indexOf(f.c),j=i+ +d.d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];store.mark('ch-'+f.s);render()},
  gtick:d=>{const f=findCh(d.id),p=f.c.p[d.n]||(f.c.p[d.n]={});const was=!!p[d.st];if(was)delete p[d.st];else p[d.st]=today();if(!Object.keys(p).length)delete f.c.p[d.n];store.mark('ch-'+f.s);renderM();SND.play(was?'off':lecDone(f.c,f.s,+d.n)?'lecture':'on')},
  early:d=>{const f=findCh(d.id),c=f.c,st=steps(f.s);if(+d.d>0){const n=nextLec(c,f.s);if(!n){toast('All lectures are already done');return}const p=c.p[n]||(c.p[n]={});st.forEach(x=>{if(!p[x])p[x]=EARLY});SND.play('up')}
    else{let n=0;for(let k=c.lec;k>=1;k--){if(c.p[k]&&Object.values(c.p[k]).includes(EARLY)){n=k;break}}if(!n){toast('No "done earlier" lectures to remove. Use the table to untick.','err');return}Object.keys(c.p[n]).forEach(x=>{if(c.p[n][x]===EARLY)delete c.p[n][x]});if(!Object.keys(c.p[n]).length)delete c.p[n];SND.play('down')}
    store.mark('ch-'+f.s);renderM()},
  earlyp:d=>{const f=findCh(d.id),c=f.c,st=steps(f.s);const tgt=Math.round(+d.p/100*c.lec);for(let n=1;n<=c.lec;n++){if(n<=tgt){const p=c.p[n]||(c.p[n]={});st.forEach(x=>{if(!p[x])p[x]=EARLY})}else if(c.p[n]){Object.keys(c.p[n]).forEach(x=>{if(c.p[n][x]===EARLY)delete c.p[n][x]});if(!Object.keys(c.p[n]).length)delete c.p[n]}}
    store.mark('ch-'+f.s);renderM();SND.play('save');toast(`${chStats(c,f.s).done} of ${c.lec} lectures marked as done earlier`)},
  gsheetearly:d=>{const f=findCh(d.id);f.c.sheet=EARLY;store.mark('ch-'+f.s);renderM();SND.play('on')},
  gsheet:d=>{const f=findCh(d.id);f.c.sheet=f.c.sheet?0:today();store.mark('ch-'+f.s);renderM();SND.play(f.c.sheet?'lecture':'off')},
  gdone:d=>{const f=findCh(d.id);if(!f.c.done){const st=chStats(f.c,f.s);if(!st.allLec||!f.c.sheet){toast('Finish all lectures and the practice sheet first','err');return}f.c.done=today();SND.play('chapter')}else{f.c.done=0;SND.play('off')}store.mark('ch-'+f.s);renderM()},
  gsavech:d=>{const f=findCh(d.id),n=$('ecname').value.trim(),l=parseInt($('eclec').value,10),e=$('ecerr');if(!n||!(l>=1&&l<=200)){e.textContent='Enter a name and 1 to 200 lectures.';e.hidden=false;return}
    f.c.name=n;f.c.lec=l;Object.keys(f.c.p).forEach(k=>{if(+k>l)delete f.c.p[k]});M.st.edit=false;store.mark('ch-'+f.s);renderM()},
  gdelch:d=>{if(!M.st.del){M.st.del=true;renderM();return}const f=findCh(d.id);S.ch[f.s]=S.ch[f.s].filter(c=>c.id!==d.id);
    Object.values(S.plans).forEach(p=>{p.newCh=(p.newCh||[]).filter(x=>x.id!==d.id);p.rev=(p.rev||[]).filter(x=>x!==d.id);Object.values(p.weeks||{}).forEach(w=>{delete w.t[d.id];w.rev=(w.rev||[]).filter(x=>x!==d.id)})});
    store.mark('ch-'+f.s,'plans');closeM();toast('Chapter deleted')},
  wkt:d=>{const p=plan(V.ym,true),w=wkOf(p,V.wk),cap=weekCap(V.ym,V.wk,d.id),v=(+w.t[d.id]||0)+ +d.d;if(+d.d>0&&v>cap){toast(cap?`Only ${plural(cap,'lecture')} left to plan in this chapter`:'No lectures left to plan in this chapter','err');return}w.t[d.id]=clamp(v,0,cap);store.mark('plans');render()},
  split:()=>{const p=plan(V.ym,true),W=weeksOf(V.ym),td=today();const open=W.filter(w=>w.end>=td);const useW=open.length?open:W;
    p.newCh.forEach(it=>{const used=W.filter(w=>!useW.includes(w)).reduce((a,w)=>a+(+p.weeks[w.i]?.t?.[it.id]||0),0);const rem=Math.max(0,(+it.target||0)-used);
      const base=Math.floor(rem/useW.length),extra=rem%useW.length;useW.forEach((w,k)=>{wkOf(p,w.i).t[it.id]=base+(k<extra?1:0)})});store.mark('plans');render();toast('Targets split across weeks ⚖️')},
  revwk:d=>{const p=plan(V.ym,true),w=wkOf(p,V.wk);if(!w.rev.includes(d.id))w.rev.push(d.id);store.mark('plans');render()},
  unrevwk:d=>{const p=plan(V.ym,true),w=wkOf(p,V.wk);w.rev=w.rev.filter(x=>x!==d.id);store.mark('plans');render()},
  addleft:d=>{const p=plan(V.ym,true);if(!p.newCh.some(x=>x.id===d.id))p.newCh.push(Object.assign({id:d.id,target:Math.min(+d.n,monthCap(V.ym,d.id))},d.kind==='bk'?{kind:'bk'}:{}));store.mark('plans');render();toast('Added to this month')},
  pickold:()=>mPickOld(),
  moldtog:d=>{const s=M.st.sel;const h=s.has(d.id);h?s.delete(d.id):s.add(d.id);renderM();SND.play(h?'off':'on')},
  moldsave:()=>{const p=plan(V.ym,true);p.old=[...M.st.sel];store.mark('plans');closeM()},
  rmold:d=>{const p=plan(V.ym,true);p.old=p.old.filter(x=>x!==d.id);store.mark('plans');render()},
  addnew:d=>mAddNew(d.kind),
  mnewt:d=>{M.st.t=Math.max(0,(M.st.t||0)+ +d.d);renderM()},
  mnewsave:()=>{const p=plan(V.ym,true),st=M.st;let k=0;[...st.pick].forEach(id=>{if(!p.newCh.some(x=>x.id===id)){p.newCh.push(Object.assign({id,target:st.t[id]||0},st.kind==='bk'?{kind:'bk'}:{}));k++}});store.mark('plans');closeM();if(k)toast(`${plural(k,'chapter')} added ${st.kind==='bk'?'to backlog chapters 🎯':'to class schedule 📘'}`)},
  rmnew:d=>{const p=plan(V.ym,true);p.newCh=p.newCh.filter(x=>x.id!==d.id);store.mark('plans');render()},
  mt:d=>{const p=plan(V.ym,true),it=p.newCh.find(x=>x.id===d.id),cap=monthCap(V.ym,d.id),v=(+it.target||0)+ +d.d;if(+d.d>0&&v>cap){toast(cap?`This chapter has only ${plural(cap,'lecture')} left`:'Set the number of lectures in 📚 Syllabus first','err');return}it.target=clamp(v,0,cap);store.mark('plans');render()},
  addrevm:()=>mAddRevM(),
  mtoggle:d=>{if(d.k==='new'&&!d.kind){const p=plan(V.ym,true);const c=d.id.startsWith('n:')?null:findCh(d.id)?.c;if(!(c&&p.newCh.some(x=>x.id===c.id))){mPlanAs(d);return}}planToggle(d)},
  mplanas:d=>{const x=Object.assign({},M.st.d,{kind:d.kind});closeM();planToggle(x)},
  mkind:d=>{const it=plan(V.ym,true).newCh.find(x=>x.id===d.id);if(!it)return;if(isBk(it))delete it.kind;else it.kind='bk';store.mark('plans');render();toast(isBk(it)?'Moved to backlog chapters 🎯':'Moved to class-schedule chapters 📘')},
  mtab:d=>{V.mt=d.v;ENTER='up';if(V.tab!=='month'){go('month');return}render()},
  wkadd:d=>{const id=d.id;if(!id)return;const p=plan(V.ym,true),W=weeksOf(V.ym),k=wkPlanInfo(V.ym,V.wk,id);
    const wl=Math.max(1,W.filter(x=>x.i>=V.wk).length),n=Math.min(Math.ceil(k.left/wl),weekCap(V.ym,V.wk,id));wkOf(p,V.wk).t[id]=n;store.mark('plans');render();toast(`Added to Week ${V.wk} · ${plural(n,'lecture')} suggested`)},
  wkpick:()=>mWkPick(),
  wkpsave:()=>{const p=plan(V.ym,true),w=wkOf(p,V.wk),st=M.st;const ids=[...st.pick];ids.forEach(id=>w.t[id]=Math.min(st.t[id]||0,weekCap(V.ym,V.wk,id)));store.mark('plans');closeM();toast(`${plural(ids.length,'chapter')} added to Week ${V.wk}`)},
  wkrm:d=>{const p=plan(V.ym,true),w=wkOf(p,V.wk);delete w.t[d.id];store.mark('plans');render()},
};
function planToggle(d){const p=plan(V.ym,true);let id=d.id;
    if(id.startsWith('n:')){const s=d.s;const row=(monthSyllabus([...testsInRange(monthRange(V.ym).a,monthRange(V.ym).b),...p.old.map(testById).filter(Boolean)])[s]||[]).find(x=>!x.ch&&'n:'+normName(x.base)===id);if(!row||!SBY[s])return;
      let c=S.ch[s].find(y=>normName(y.name)===normName(row.base));if(!c){c={id:'c-'+uid(),name:row.base,lec:0,p:{},sheet:0,done:0,revs:[]};S.ch[s].push(c);store.mark('ch-'+s)}id=c.id;d={k:d.k,id,kind:d.kind}}
    const f=findCh(id);if(!f)return;let on;
    if(d.k==='rev'){on=!p.rev.includes(d.id);p.rev=on?[...p.rev,d.id]:p.rev.filter(x=>x!==d.id)}
    else{on=!p.newCh.some(x=>x.id===d.id);if(on)p.newCh.push(Object.assign({id:d.id,target:Math.max(0,f.c.lec-chStats(f.c,f.s).done)},d.kind==='bk'?{kind:'bk'}:{}));else{p.newCh=p.newCh.filter(x=>x.id!==d.id);Object.values(p.weeks||{}).forEach(w=>{if(w.t)delete w.t[d.id]})}}
    store.mark('plans');render();SND.play(on?'add':'off');toast(on?(d.k==='rev'?'📌 Revision planned. Tick it on Today when done':(d.kind==='bk'?'🎯 Backlog chapter planned. ':'📌 Study planned. ')+(f.c.lec?'Tick lectures on Today when done':'Set its lecture count in 📚 Syllabus')):'Removed from this month\'s plan')}
const A2={
  mrmsave:()=>{const p=plan(V.ym,true);let k=0;[...M.st.pick].forEach(id=>{if(!p.rev.includes(id)){p.rev.push(id);k++}});store.mark('plans');closeM();if(k)toast(`${plural(k,'chapter')} added to revise`)},
  addrevid:d=>{const p=plan(V.ym,true);if(!p.rev.includes(d.id))p.rev.push(d.id);store.mark('plans');render()},
  rmrevm:d=>{const p=plan(V.ym,true);p.rev=p.rev.filter(x=>x!==d.id);store.mark('plans');render()},
  theme:d=>{S.settings.theme=d.v;applyTheme();store.mark('settings');render()},
  glass:d=>{S.settings.glass=d.v;applyTheme();store.mark('settings');render()},
  export:async()=>{const data=JSON.stringify({app:'neet2027-planner',version:1,exported:new Date().toISOString(),state:S});const fn=`neet2027-backup-${toIso(today())}.json`;
    try{const file=new File([data],fn,{type:'application/json'});
      if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:fn});toast('Backup saved ⬇️');return}
      const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast('Backup saved ⬇️');return}
    catch(e){if(e&&e.name==='AbortError'){toast('Save cancelled');return}}
    openM({title:'⬇️ Backup text',body(){return`<div class="stack"><div class="small muted">Copy this text and keep it safe (e.g. in a note or email to yourself). Paste it in Settings → Import to restore.</div><textarea id="bk" style="min-height:200px" readonly>${esc(data)}</textarea><button class="btn pri" data-act="copybk">Copy</button></div>`}})},
  copybk:async()=>{const t=$('bk');try{await navigator.clipboard.writeText(t.value);toast('Copied')}catch(e){t.select();toast('Text selected. Press copy.')}},
  imptext:()=>tryImport($('imptext').value),
  mdoimport:()=>{S=normalize(M.st.data.state);GEN++;migrateWeeks(S);applyTheme();store.markAll();closeM();toast('Backup restored ✅')},
  signin:async()=>{const em=$('acemail').value.trim(),pw=$('acpw').value,e=$('acerr');e.hidden=true;if(!em||!pw){e.textContent='Enter your email and password.';e.hidden=false;return}
    try{await CLOUD.signIn(em,pw);toast('Signed in. Syncing… ☁️');await store.connect();toast('Synced ☁️','save')}
    catch(err){e.textContent=/confirm/i.test(err.message)?'Open the confirm email first, then sign in.':/invalid/i.test(err.message)?'Wrong email or password.':'Could not sign in: '+err.message;e.hidden=false;SND.play('err')}},
  signup:async()=>{const em=$('acemail').value.trim(),pw=$('acpw').value,e=$('acerr');e.hidden=true;if(!em||pw.length<8){e.textContent='Enter your email and a password of at least 8 characters.';e.hidden=false;return}
    try{const r=await CLOUD.signUp(em,pw);if(r&&r.access_token){await CLOUD.keep(r);await store.connect();toast('Account ready. Syncing ☁️','save')}else toast('📧 Check your email and tap the link, then Sign in here.','save')}
    catch(err){e.textContent='Could not create the account: '+err.message;e.hidden=false;SND.play('err')}},
  signout:async()=>{await store.writeLocal();if(store.dirty.size&&navigator.onLine)await store.flush();await CLOUD.signOut();store.mode='local';store.dirty.clear();store.cursor=null;store.metaDirty=true;await store.writeLocal();render();toast('Signed out. Your data stays on this device.')},
  syncnow:async()=>{await store.writeLocal();await store.flush();await store.pull();render();toast(store.dirty.size?'⚠️ Not synced yet. Check your internet.':'Synced ☁️',store.dirty.size?'err':'save')},
  loadplanner:()=>syncShared(true),
  loadncert:()=>syncShared(true,true),
  snd:d=>{const v=+d.v;S.settings.sound=v>0;S.settings.vol=v>0?v:S.settings.vol;store.mark('settings');render();if(v>0)SND.play('on')},
  sndtest:()=>{const ks=['on','off','lecture','chapter','test','add','remove','err'];SND.demo=true;ks.forEach((k,i)=>setTimeout(()=>SND.play(k),i*650));setTimeout(()=>SND.demo=false,ks.length*650);SND.played=true},
  reset:async()=>{if($('resetin').value.trim()!=='RESET'){toast('Type RESET first','err');return}const reload=$('resetload').checked;const theme=S.settings.theme;
    S=fresh();S.settings.theme=theme;if(!reload)S.settings.plannerLoaded=true;store.markAll();await syncShared(false);V.day=today();render();toast('Everything was reset')},
};
Object.assign(A,A2);
const C={
  satpick:el=>{const r=dayRec(+el.dataset.dn,true);r.oldTest=el.value;store.mark(dayKey(+el.dataset.dn));render()},
  daynote:el=>{const r=dayRec(+el.dataset.dn,true);r.note=el.value;store.mark(dayKey(+el.dataset.dn))},
  mset:el=>{M.st[el.dataset.k]=el.dataset.k==='n'?+el.value:el.value;if(el.dataset.k==='ch'||el.dataset.k==='n'){M.st.sts=null;M.st.sel=null}renderM()},
  mnewch:el=>{M.st.id=el.value;M.st.t=null;renderM()},
  exam:el=>{S.settings.examDate=el.value;store.mark('settings');saveUi()},
  src:el=>{const s=el.dataset.s;S.settings.src[s]=S.settings.src[s]||{};S.settings.src[s][el.dataset.f]=el.value.trim();store.mark('settings')},
  impfile:el=>{const f=el.files&&el.files[0];if(!f)return;const r=new FileReader();r.onload=()=>tryImport(String(r.result));r.readAsText(f)},
};
function tryImport(text){let o;try{o=JSON.parse(text)}catch(e){toast('This is not a valid backup file','err');return}
  if(!o||o.app!=='neet2027-planner'||!o.state||!o.state.ch){toast('This file is not a NEET planner backup','err');return}
  const n=SUBJ.reduce((a,s)=>a+(o.state.ch[s.k]||[]).length,0);
  openM({title:'⬆️ Restore backup?',st:{data:o},body(){return`<div class="stack"><div>Backup from <b>${esc((o.exported||'').slice(0,10))}</b>: ${n} chapters, ${(o.state.tests||[]).length} tests.</div><div class="backlog card lab">This replaces ALL current data.</div><button class="btn pri" data-act="mdoimport">Yes, restore</button><button class="btn" data-act="closem">Cancel</button></div>`}})}
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const act=el.dataset.act;if(act==='scrim'){if(e.target===el){SND.play('close');closeM()}return}const fn=A[act];if(!fn)return;e.preventDefault();GEN++;
  SND.played=false;try{const r=fn(el.dataset,el);if(r&&r.catch)r.catch(err=>{console.error(err);toast('⚠️ That did not work. Please try again.','err')})}catch(err){console.error(err);toast('⚠️ That did not work. Please try again.','err');return}
  if(!SND.played){let k=DEFSND[act];if(!k&&el.dataset.d)k=+el.dataset.d>0?'up':'down';if(k)SND.play(k)}
  if(/^(tick|ticksheet|tickdone|tickrev|gtick|gsheet|gdone|moldtog|mstep|marks|mcell)$/.test(act)){const ds=Object.entries(el.dataset);
    const twin=[...document.querySelectorAll(`[data-act="${act}"]`)].find(x=>ds.every(([k,v])=>x.dataset[k]===v));if(twin){twin.classList.remove('pop');void twin.offsetWidth;twin.classList.add('pop')}}});
window.addEventListener('error',e=>{console.error(e.error||e.message)});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(el&&C[el.dataset.chg]){GEN++;C[el.dataset.chg](el)}});
/* Test syllabus is built only when you open it. */
document.addEventListener('toggle',e=>{const d=e.target;if(d.open&&d.dataset&&d.dataset.lazy==='syl'&&!d.dataset.done){const t=testById(d.dataset.id);if(t){d.insertAdjacentHTML('beforeend',sylHtml(t));d.dataset.done='1'}}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M)closeM()});

/* ---------- shared lists: Yakeen 2027 tests + NCERT chapters ---------- */
function plannerTest(t){return{id:'y27-'+pad(t.sno),name:t.name,date:t.date,type:t.type,pattern:t.pattern,syl:clone(t.syl),alt:t.alt||'',qs:t.qs||null,mins:t.mins||null,max:t.max||null,start:t.start||'',sylSrc:t.sylSrc||'',given:0,m:null,src:'planner'}}
function mergeNcert(list){let add=0,fix=0;const touched=new Set();
  list.forEach(x=>{const a=S.ch[x.s];if(!a)return;const ex=a.find(c=>normName(c.name)===normName(x.name)&&(!c.cls||c.cls===x.cls));
    if(ex){if(ex.name!==x.name||ex.cls!==x.cls||ex.no!==x.no){ex.name=x.name;ex.cls=x.cls;ex.no=x.no;fix++;touched.add(x.s)}}
    else{a.push({id:'c-'+uid(),name:x.name,lec:0,p:{},sheet:0,done:0,revs:[],cls:x.cls,no:x.no});add++;touched.add(x.s)}});
  touched.forEach(s=>{S.ch[s].sort((a,b)=>((a.cls||99)-(b.cls||99))||((a.no||999)-(b.no||999)));store.mark('ch-'+s)});return{add,fix}}
async function syncShared(force,ncertOnly){const SH=window.SHARED||{};
  const msgs=[];
  try{if(!ncertOnly){const P=SH.yakeen?clone(SH.yakeen):null;
      if(P){const ver=P.ver||1;let k=0,u=0,was=S.settings.plannerLoaded&&(S.settings.plannerVer||1)>=ver;
        if(!S.settings.plannerLoaded||force){(P.tests||[]).forEach(t=>{if(!S.tests.some(x=>x.id==='y27-'+pad(t.sno))){S.tests.push(plannerTest(t));k++}});S.settings.plannerLoaded=true}
        if((S.settings.plannerVer||1)<ver||force){(P.tests||[]).forEach(t=>{const x=S.tests.find(y=>y.id==='y27-'+pad(t.sno));if(x&&x.src==='planner'){const n=plannerTest(t);['syl','alt','qs','mins','max','start','sylSrc','date','type','pattern'].forEach(f=>x[f]=n[f]);u++}});S.settings.plannerVer=ver}
        if(!was||k||u)store.mark('tests','settings');if(k)msgs.push(`🎯 ${k} tests added`);else if(force)msgs.push('🎯 Test list is up to date')}
      else if(force)msgs.push('Test list not found')}
    if(!S.settings.ncertLoaded||ncertOnly){const n=SH.ncert?clone(SH.ncert):null;
      if(n){const r=mergeNcert(n.chapters||[]);S.settings.ncertLoaded=true;store.mark('settings');if(r.add)msgs.push(`📚 ${r.add} NCERT chapters added`);else if(ncertOnly)msgs.push('📚 All NCERT chapters are already there')}}
    render();if(msgs.length)toast(msgs.join(' · '),force?'save':null)}
  catch(e){console.error(e);if(force)toast('Could not load the lists. Try again.','err')}}

/* ---------- boot ----------
   1. Open this device's copy (IndexedDB) and show it at once.  2. If signed in, send unsynced changes and fetch changes from other devices. */
async function boot(){let docs=null,meta={};
  try{docs=await IDB.all('docs');meta=await IDB.all('meta')}catch(e){console.error(e);store.idb=false}
  if(docs&&Object.keys(docs).length){S=fresh();GEN++;Object.entries(docs).forEach(([k,d])=>{applyDoc(k,d&&d.v);store.at[k]=d&&d.at||0})}
  else if(loadLocal()&&store.idb){store.markAll()} /* older copy saved in this browser: move it into IndexedDB */
  (meta.pending||[]).forEach(k=>store.dirty.add(k));store.cursor=meta.cursor||null;
  if(CLOUD.on&&meta.session){CLOUD.sess=meta.session;store.mode='cloud'}else store.mode='local';
  if(migrateWeeks(S))store.mark('plans','settings');
  {const h=location.hash.slice(1);if(VIEWS[h])V.tab=h}
  applyTheme();render();document.documentElement.classList.add('app-ready');
  await syncShared(false);
  if(store.mode==='cloud'){if(store.dirty.size)store.flush();store.pull()}
  render();warmUp()}
/* While the app sits idle, work out which of your chapters each test covers, so Tests and Month open without waiting. */
function warmUp(){const jobs=[];S.tests.forEach(t=>SUBJ.forEach(s=>(t.syl?.[s.k]||[]).forEach(e=>jobs.push([s.k,e]))));let i=0;
  const idle=window.requestIdleCallback||(f=>setTimeout(()=>f({timeRemaining:()=>8}),50));
  const run=dl=>{while(i<jobs.length&&dl.timeRemaining()>3){const [s,e]=jobs[i++];entryChIds(s,e);matchCh(s,e)}if(i<jobs.length)idle(run);else warmUp.done=performance.now()};idle(run)}
/* Keep devices in step: when the app comes back on screen, when the internet returns, and every minute while open. */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){store.flush();store.pull()}else store.writeLocal()});
addEventListener('online',()=>{store.flush();store.pull()});addEventListener('offline',()=>saveUi());
addEventListener('pagehide',()=>store.writeLocal());
setInterval(()=>{if(document.visibilityState==='visible')store.pull()},60000);
boot();
