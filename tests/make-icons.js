/* Run: node tests/make-icons.js — draws the PNG icons from icons/icon.svg and icons/maskable.svg using Edge (headless). */
const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const dir=path.join(__dirname,'..','icons'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'neeticon-'));
const jobs=[['icon.svg','icon-192.png',192],['icon.svg','icon-512.png',512],['maskable.svg','maskable-192.png',192],['maskable.svg','maskable-512.png',512],['maskable.svg','apple-touch-icon.png',180],['icon.svg','favicon-32.png',32]];
for(const [src,out,n] of jobs){const svg=fs.readFileSync(path.join(dir,src),'utf8');const html=path.join(tmp,out+'.html');
  fs.writeFileSync(html,`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${n}px;height:${n}px}</style></head><body>${svg}</body></html>`);
  execFileSync(EDGE,['--headless=new','--disable-gpu','--hide-scrollbars','--default-background-color=00000000',`--window-size=${n},${n}`,`--screenshot=${path.join(dir,out)}`,'file:///'+html.split(path.sep).join('/')],{stdio:'ignore'});
  console.log(out,fs.statSync(path.join(dir,out)).size,'bytes')}
