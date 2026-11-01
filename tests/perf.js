/* Lag test. Open the app on localhost, then in the browser console:
     await import('./tests/perf.js'); await PERF.load(); // replaces this browser's data with fake data
     await PERF.run();                                     // prints timings
   Never run this on a device that holds your real data without exporting a backup first. */
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[rnd(0,a.length-1)];
/* unique letter-only names, because chapter matching ignores digits */
const word=i=>{const L='bcdfghjklmnprstvz',V='aeiou';let w='';i+=37;for(let k=0;k<3;k++){w+=L[i%L.length]+V[(i>>2)%V.length];i=Math.floor(i/L.length)+k*7}return w[0].toUpperCase()+w.slice(1)};
window.PERF={
  fake(){const st=fresh();const td=today(),from=td-420;let ticks=0,revs=0;
    SUBJ.forEach(s=>{for(let i=0;i<60;i++){const lec=rnd(12,30);const c={id:'c-f'+s.k+i,name:`${word(SUBJ.indexOf(s)*100+i)} ${word(SUBJ.indexOf(s)*100+i+500)} Dynamics`,lec,p:{},sheet:0,done:0,revs:[],cls:i<30?11:12,no:i%30+1};
      const doneN=rnd(0,lec);for(let n=1;n<=doneN;n++){c.p[n]={};steps(s.k).forEach(x=>{c.p[n][x]=rnd(from,td);ticks++})}
      const r=rnd(0,12);for(let k=0;k<r;k++){c.revs.push(rnd(from,td));revs++}if(doneN===lec){c.sheet=rnd(from,td);if(Math.random()<.6)c.done=td-rnd(0,30)}st.ch[s.k].push(c)}});
    const all=SUBJ.flatMap(s=>st.ch[s.k].map(c=>({c,s:s.k})));
    for(let i=0;i<320;i++){const d=td-300+i*2;const syl={};SUBJ.forEach(s=>syl[s.k]=Array.from({length:rnd(2,6)},()=>pick(st.ch[s.k]).name+(Math.random()<.5?' (Complete Chapter)':': topic a, topic b')));
      const given=d<td&&Math.random()<.85?d:0;st.tests.push({id:'t-f'+i,name:'Fake test '+(i+1),date:toIso(d),type:'Part Test',pattern:'NEET',syl,given,m:given?{score:rnd(300,690),max:720,phy:rnd(60,170),chem:rnd(60,170),zoo:rnd(80,180),bot:rnd(80,180),note:''}:null,src:'me'})}
    let items=0;for(let d=from;d<=td+30;d++){const iso=toIso(d),m=iso.slice(0,7);const M=st.days[m]||(st.days[m]={});const its=[];
      for(let k=0;k<6;k++){const x=pick(all);if(k<4&&x.c.lec)its.push({k:'lec',ch:x.c.id,n:rnd(1,x.c.lec),st:steps(x.s)});else its.push({k:'rev',ch:x.c.id})}items+=its.length;M[iso]={items:its,note:'Fake note for '+iso}}
    let mis=0;for(let i=0;i<4000;i++){const d=rnd(from,td),m=toIso(d).slice(0,7);const x=pick(all);(st.mis[m]=st.mis[m]||[]).push({id:'m'+i,d,s:x.s,ch:x.c.name,chId:x.c.id,topic:'Fake topic '+i,type:pick(MTYPES).k,src:'DPP'});mis++}
    for(let k=-14;k<=2;k++){const ym=shiftYm(planYmOf(td),k);const p={newCh:[],rev:[],old:[],weeks:{}};all.slice(0,12).forEach(x=>p.newCh.push({id:x.c.id,target:rnd(3,10)}));p.rev=all.slice(12,24).map(x=>x.c.id);
      p.old=st.tests.filter(t=>!t.given).slice(0,4).map(t=>t.id);weeksOf(ym).forEach(w=>p.weeks[w.i]={t:Object.fromEntries(p.newCh.map(x=>[x.id,rnd(0,3)])),rev:p.rev.slice(0,3)});st.plans[ym]=p}
    st.settings=Object.assign(fresh().settings,{examDate:'2027-05-02',plannerLoaded:true,ncertLoaded:true,plannerVer:9,weekRule:2,sound:false});
    const records=ticks+revs+st.tests.length+items+mis;return{st,counts:{chapters:all.length,lectureTicks:ticks,revisions:revs,tests:st.tests.length,dayTasks:items,mistakes:mis,total:records}}},
  async load(){const {st,counts}=this.fake();S=st;GEN++;store.markAll();await store.writeLocal();this.counts=counts;try{localStorage.setItem('perfCounts',JSON.stringify(counts))}catch(e){}render();return counts},
  frame:()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),
  /* each timing is the middle of 5 tries; the data is marked as changed before each try, so nothing is reused from the try before */
  med(a){a=[...a].sort((x,y)=>x-y);return +a[a.length>>1].toFixed(1)},
  settle:()=>new Promise(r=>setTimeout(r,250)),
  async timeRender(tab){const js=[],ps=[];for(let k=0;k<5;k++){V.tab=tab;ENTER=null;GEN++;window.scrollTo(0,0);const t0=performance.now();render();const t1=performance.now();await this.frame();js.push(t1-t0);ps.push(performance.now()-t0);await this.settle()}return{js:this.med(js),toScreen:this.med(ps)}},
  async scroll(){const H=document.documentElement.scrollHeight-innerHeight;if(H<200)return{frames:0,note:'page too short'};window.scrollTo(0,0);await this.frame();
    const gaps=[];let last=performance.now();const N=150;for(let i=1;i<=N;i++){window.scrollTo(0,H*i/N);await new Promise(r=>requestAnimationFrame(r));const now=performance.now();gaps.push(now-last);last=now}
    gaps.sort((a,b)=>a-b);const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;return{frames:N,avgMs:+avg.toFixed(1),fps:Math.round(1000/avg),p95Ms:+gaps[Math.floor(N*.95)].toFixed(1),slowFrames:gaps.filter(g=>g>33).length}},
  async tap(sel,again){const js=[],ps=[];for(let k=0;k<5;k++){const el=document.querySelector(sel);if(!el)return null;const t0=performance.now();el.click();const t1=performance.now();await this.frame();js.push(t1-t0);ps.push(performance.now()-t0);await this.settle();if(again){document.querySelector(again).click();await this.settle()}}return{js:this.med(js),toScreen:this.med(ps)}},
  async run(){let c=this.counts;try{c=c||JSON.parse(localStorage.getItem('perfCounts'))}catch(e){}const out={records:c};SND.played=true;S.settings.sound=false;
    V.tt='up';for(const tab of ['today','week','month','tests','dash','mistakes','syllabus','settings']){out['open '+tab]=await this.timeRender(tab)}
    V.dv='ch';out['open stats › progress']=await this.timeRender('dash');V.dv='rv';out['open stats › revisions']=await this.timeRender('dash');V.dv='ov';
    V.tab='today';V.day=today();render();
    /* tick a lecture step on Today (add one first) */
    const ch=S.ch.phy.find(c=>c.lec&&nextLec(c,'phy'));V.day=today();addItem({k:'lec',ch:ch.id,n:nextLec(ch,'phy'),st:steps('phy')});render();await this.frame();
    out['tick + untick a box (Today)']=await this.tap('.tick[data-act="tick"]');
    out['next day']=await this.tap('[data-act="day"][data-d="1"]','[data-act="day"][data-d="-1"]');
    V.tab='week';render();await this.frame();out['week target + then −']=await this.tap('[data-act="wkt"][data-d="1"]','[data-act="wkt"][data-d="-1"]');
    V.tab='month';render();await this.frame();out['month: plan revision on/off']=await this.tap('[data-act="mtoggle"][data-k="rev"]');
    V.tt='giv';out['tests › given list']=await this.timeRender('tests');out['open a test syllabus']=await (async()=>{const ds=[...document.querySelectorAll('details[data-lazy]')].slice(0,5);const ts=[];for(const d of ds){const t0=performance.now();d.open=true;await new Promise(r=>d.addEventListener('toggle',r,{once:true}));await this.frame();ts.push(performance.now()-t0);await this.settle()}return{toScreen:this.med(ts)}})();
    for(const tab of ['today','tests','syllabus','mistakes']){V.tab=tab;if(tab==='tests')V.tt='giv';render();await this.frame();out['scroll '+tab]=await this.scroll()}
    {const t0=performance.now();store.mark('ch-phy','tests');await store.writeLocal();out['save to device (2 big parts)']={ms:+(performance.now()-t0).toFixed(1)}}
    {const t0=performance.now();const docs=await IDB.all('docs');out['read all data from device']={ms:+(performance.now()-t0).toFixed(1),kb:Math.round(JSON.stringify(docs).length/1024)}}
    console.table(out);return out}
};
