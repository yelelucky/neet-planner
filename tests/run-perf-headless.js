/* Run: node tests/run-perf-headless.js [cpuSlowdown=4]
   Starts a hidden Chrome, opens the app from the local test server (python -m http.server 5173 in this folder),
   loads 20,000+ fake records and prints how fast each screen opens, taps respond, saves finish and pages scroll.
   cpuSlowdown 4 ≈ a mid-range Android phone; 1 = this PC. Uses its own empty browser profile, never your data. */
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const rate=+(process.argv[2]||4),glass=process.argv[3]||'full',URL_='http://localhost:5173/',PORT=9333;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const prof=fs.mkdtempSync(path.join(os.tmpdir(),'neetperf-'));
const ch=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu-vsync=false','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let tgt;for(let i=0;i<40&&!tgt;i++){await sleep(250);try{tgt=(await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t=>t.type==='page')}catch(e){}}
  if(!tgt)throw new Error('Chrome did not start');
  const ws=new WebSocket(tgt.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const wait={};
  ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&wait[d.id]){wait[d.id](d);delete wait[d.id]}};
  const send=(method,params={})=>new Promise(r=>{const i=++id;wait[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,400));return r.result?.result?.value};
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:2,mobile:true});
  await send('Page.enable');await send('Page.navigate',{url:URL_});await sleep(2500);
  /* first open with fake data already saved on the device */
  await ev(`import('/tests/perf.js').then(()=>PERF.load())`);
  await send('Emulation.setCPUThrottlingRate',{rate});
  const t0=Date.now();await send('Page.reload');await sleep(300);
  const boot=await ev(`new Promise(r=>{const c=()=>document.documentElement.classList.contains('app-ready')?r(performance.now()):setTimeout(c,10);c()})`);
  const warm=await ev(`new Promise(r=>{const c=()=>warmUp.done?r(warmUp.done):setTimeout(c,50);c()})`); /* background prep, while Today is on screen */
  await ev(`S.settings.glass='${glass}';applyTheme();true`);
  const res=await ev(`import('/tests/perf.js').then(async()=>{return PERF.run()})`);
  res['app opens (to first screen)']={ms:Math.round(boot)};res['background prep finished']={atMs:Math.round(warm)};
  console.log(`\nCPU slowdown ${rate}x (${rate>1?'phone-like':'this PC'}) · viewport 375x812\n`);
  for(const [k,v] of Object.entries(res))console.log(k.padEnd(32),JSON.stringify(v));
  ws.close();ch.kill();process.exit(0)})().catch(e=>{console.error(e);ch.kill();process.exit(1)});
