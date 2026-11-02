/* Run: node tests/build-css.js — app.css = new colour tokens + original layout rules + redesign layer. */
const fs=require('fs'),p=require('path'),d=p.join(__dirname,'..','_orig');
const o=fs.readFileSync(p.join(d,'orig.css'),'utf8').split('\n');let rest=o.slice(24).join('\n');
const rep=(a,b)=>{if(!rest.includes(a))throw new Error('missing '+a.slice(0,50));rest=rest.split(a).join(b)};
rep('backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);','');
rep('backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);','');
rep('/* Button colour by job: purple save/main','/* Button colour by job: mint save/main');
rep(':root{--v-phy:#2f6bff;--v-chem:#ef6a17;--v-zoo:#12a150;--v-bot:#9a4ce0}',':root{--v-phy:#3a72e6;--v-chem:#df6d27;--v-zoo:#1b9654;--v-bot:#8d4fd4}');
rep('--v-phy:#5585f7;--v-chem:#d9752c;--v-zoo:#26a35f;--v-bot:#9d68e3','--v-phy:#5f8ef2;--v-chem:#e07d36;--v-zoo:#2fae67;--v-bot:#a171e6');
fs.writeFileSync(p.join(__dirname,'..','app.css'),fs.readFileSync(p.join(d,'tokens.css'),'utf8')+rest+'\n}\n'+fs.readFileSync(p.join(d,'redesign.css'),'utf8')+fs.readFileSync(p.join(d,'glass.css'),'utf8'));
console.log('app.css written');
