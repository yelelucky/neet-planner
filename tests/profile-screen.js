/* Run: node tests/profile-screen.js month [cpuSlowdown=4]
   Opens the app in a hidden Chrome with fake data and lists where the time goes when one screen is drawn 10 times. */
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const tab=process.argv[2]||'month',rate=+(process.argv[3]||4),PORT=9334,interval=200;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const ch=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'neetprof-'))}`,'--no-first-run','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let tgt;for(let i=0;i<40&&!tgt;i++){await sleep(250);try{tgt=(await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t=>t.type==='page')}catch(e){}}
  const ws=new WebSocket(tgt.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const wait={};
  ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&wait[d.id]){wait[d.id](d);delete wait[d.id]}};
  const send=(method,params={})=>new Promise(r=>{const i=++id;wait[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async expr=>(await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true})).result?.result?.value;
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:2,mobile:true});
  await send('Page.enable');await send('Page.navigate',{url:'http://localhost:5173/'});await sleep(2500);
  await ev(`import('/tests/perf.js').then(()=>PERF.load())`);await send('Page.reload');await sleep(1500);
  await ev(`new Promise(r=>{const c=()=>warmUp.done?r():setTimeout(c,50);c()})`);
  await send('Emulation.setCPUThrottlingRate',{rate});
  await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:200});await send('Profiler.start');
  const ms=await ev(`(async()=>{const t=[];for(let i=0;i<10;i++){V.tab='${tab}';GEN++;window.scrollTo(0,0);const a=performance.now();render();document.body.offsetHeight;t.push(performance.now()-a);await new Promise(r=>setTimeout(r,250))}return t.sort((a,b)=>a-b)[5]})()`);
  const prof=(await send('Profiler.stop')).result.profile;const self={},byId={};prof.nodes.forEach(n=>byId[n.id]=n);
  prof.samples.forEach((s,i)=>{const n=byId[s],f=n.callFrame;const k=(f.functionName||'(anon)')+' '+(f.url.split('/').pop()||'')+(f.url?':'+(f.lineNumber+1):'');self[k]=(self[k]||0)+(prof.timeDeltas[i]||0)/1000});
  console.log(`${tab}: median render+layout ${ms.toFixed(1)} ms at ${rate}x. Top self time over 10 renders:`);
  Object.entries(self).filter(([k])=>!/^\(idle\)|^\(program\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,18).forEach(([k,v])=>console.log(v.toFixed(1).padStart(8),'ms ',k));
  ws.close();ch.kill();process.exit(0)})().catch(e=>{console.error(e);ch.kill();process.exit(1)});
