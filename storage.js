"use strict";
/* ---------- device storage (IndexedDB) ----------
   One record per data document ('settings', 'tests', 'plans', 'ch-phy', 'days-2026-11', 'mis-2026-11', …).
   Only documents that changed are written. 'meta' holds the sign-in session, sync cursor and unsynced keys. */
const IDB={db:null,
  open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{let r;try{r=indexedDB.open('neet27',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('docs'))d.createObjectStore('docs');if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta')};
    r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'))})},
  async all(store){const d=await this.open();return new Promise((res,rej)=>{const out={};const tx=d.transaction(store,'readonly');const c=tx.objectStore(store).openCursor();
    c.onsuccess=()=>{const cur=c.result;if(cur){out[cur.key]=cur.value;cur.continue()}else res(out)};c.onerror=()=>rej(c.error)})},
  async get(store,k){const d=await this.open();return new Promise((res,rej)=>{const r=d.transaction(store,'readonly').objectStore(store).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async putMany(store,entries){if(!entries.length)return;const d=await this.open();return new Promise((res,rej)=>{const tx=d.transaction(store,'readwrite');const os=tx.objectStore(store);
    entries.forEach(([k,v])=>v===undefined?os.delete(k):os.put(v,k));tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})},
  async clear(store){const d=await this.open();return new Promise((res,rej)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
};

/* ---------- cloud sync (Supabase, plain HTTPS calls) ----------
   Table planner_docs(user_id, k, v, at, updated_at). Each signed-in person only sees their own rows (row-level security). */
const CLOUD={sess:null,
  get on(){return!!(window.NEET_CFG&&NEET_CFG.url&&NEET_CFG.key)},
  async call(path,opt={},auth=true){const h=Object.assign({apikey:NEET_CFG.key,'Content-Type':'application/json'},opt.headers||{});
    if(auth){const t=await this.token();if(!t)throw Object.assign(new Error('Not signed in'),{code:'auth'});h.Authorization='Bearer '+t}
    const r=await fetch(NEET_CFG.url+path,Object.assign({},opt,{headers:h}));const txt=await r.text();let body=null;try{body=txt?JSON.parse(txt):null}catch(e){body=txt}
    if(!r.ok){const m=(body&&(body.msg||body.message||body.error_description||body.error))||('HTTP '+r.status);throw Object.assign(new Error(m),{code:r.status===401?'auth':'http',status:r.status})}return body},
  keep(b){this.sess={at:b.access_token,rt:b.refresh_token,exp:Date.now()+((b.expires_in||3600)-60)*1000,email:b.user?.email||this.sess?.email||'',uid:b.user?.id||this.sess?.uid||''};return IDB.putMany('meta',[['session',this.sess]])},
  async token(){if(!this.sess)return null;if(Date.now()<this.sess.exp)return this.sess.at;
    const b=await this.call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:this.sess.rt})},false);await this.keep(b);return this.sess.at},
  async signIn(email,pw){const b=await this.call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:pw})},false);await this.keep(b);return b},
  async signUp(email,pw){return this.call('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:pw})},false)},
  async signOut(){try{await this.call('/auth/v1/logout',{method:'POST'})}catch(e){}this.sess=null;await IDB.putMany('meta',[['session',undefined],['cursor',undefined]])},
  /* rows changed at or after `since` (ISO time), oldest first; rows already seen are skipped by the caller */
  async pull(since){const q='/rest/v1/planner_docs?select=k,v,at,updated_at&order=updated_at.asc'+(since?'&updated_at=gte.'+encodeURIComponent(since):'');return this.call(q)},
  async push(rows){return this.call('/rest/v1/planner_docs?on_conflict=user_id,k',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)})}
};
