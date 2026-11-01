/* Run: node tests/week-rule.test.js — checks the 4-or-more-days week rule against app.js itself. */
const fs=require('fs'),path=require('path');const s=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const T=new Function('const DAY=864e5;'+s.slice(s.indexOf('/* ---------- dates'),s.indexOf('/* ---------- helpers'))+';return{weeksOf,planYmOf,weekOfDn,toDn,toIso,migrateWeeks}')();
let bad=0;const chk=(start,exp,why)=>{const d=T.toDn(start),got=T.planYmOf(d),wk=T.weekOfDn(d);const ok=got===exp&&[0,1,2,3,4,5,6].every(i=>T.planYmOf(d+i)===exp);if(!ok)bad++;
  console.log((ok?'✔':'✘'),start,'week →',got,'Week',wk.i,'·',why)};
console.log('Your examples (Mon–Sun weeks, 2026):');
chk('2026-10-26','2026-10','26 Oct–1 Nov: 6 Oct + 1 Nov');chk('2026-09-28','2026-10','28 Sep–4 Oct: 3 Sep + 4 Oct');chk('2026-11-30','2026-12','30 Nov–6 Dec: 1 Nov + 6 Dec');
console.log('Year end and leap years:');
chk('2026-12-28','2026-12','28 Dec 2026–3 Jan 2027: 4 Dec + 3 Jan');chk('2025-12-29','2026-01','29 Dec 2025–4 Jan 2026: 3 Dec + 4 Jan');
chk('2027-12-27','2027-12','27 Dec 2027–2 Jan 2028: 5 Dec + 2 Jan');chk('2028-02-28','2028-03','28 Feb–5 Mar 2028 (leap): 2 Feb + 5 Mar');chk('2024-02-26','2024-02','26 Feb–3 Mar 2024 (leap): 4 Feb + 3 Mar');
let prevEnd=null;const seen=new Set();let sweep=0;
for(let y=2024;y<=2032;y++)for(let m=1;m<=12;m++){const ym=y+'-'+String(m).padStart(2,'0');const W=T.weeksOf(ym);if(W.length<4||W.length>5)sweep++;
  W.forEach((w,i)=>{if(w.i!==i+1||w.end-w.start!==6||new Date(w.start*864e5).getUTCDay()!==1)sweep++;if(prevEnd!=null&&w.start!==prevEnd+1)sweep++;prevEnd=w.end;
    let c=0;for(let d=w.start;d<=w.end;d++){if(seen.has(d))sweep++;seen.add(d);if(T.toIso(d).slice(0,7)===ym)c++}if(c<4)sweep++})}
console.log((sweep?'✘':'✔'),'2024–2032: every week in exactly one month, no gaps, no repeats, always 4+ days in its month');bad+=sweep;
const st={settings:{},plans:{'2026-11':{newCh:[{id:'c1',target:6}],rev:['r1'],old:[],weeks:{'1':{t:{c1:2},rev:['r1']},'2':{t:{c1:3},rev:[]}}}}};T.migrateWeeks(st);
const okM=st.plans['2026-10']?.weeks?.[5]?.t?.c1===2&&st.plans['2026-11'].weeks[1]?.t?.c1===3&&st.settings.weekRule===2;if(!okM)bad++;
console.log((okM?'✔':'✘'),'Old plan migration: Nov Week 1 (26 Oct–1 Nov) → Oct Week 5; Nov Week 2 → Nov Week 1');
console.log(bad?`✘ ${bad} problem(s)`:'All week-rule checks passed');process.exit(bad?1:0);
