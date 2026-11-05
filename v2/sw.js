/* Life Hub 2 : service worker de la nouvelle version (portée : dossier v2/ seulement).
   Change VERSION à chaque mise à jour des fichiers pour renouveler le cache. */
const PREFIX='life-hub-2-';
const VERSION=PREFIX+'v6';
const CORE=['./','index.html','manifest.json','../config.js','icons/icon-32.png','icons/icon-192.png','icons/icon-512.png','icons/icon-512-maskable.png','icons/apple-touch-icon.png'];

/* Installation : mise en cache des fichiers de base.
   La première visite de v2/ passe encore par le service worker de l'ancienne version, qui a pu
   copier cette page à la place de sa propre page hors ligne : on lui remet sa vraie page. */
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(VERSION)
      .then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>null))))
      .then(repairV1)
      .then(()=>self.skipWaiting())
  );
});
function repairV1(){
  const v1=new URL('../index.html',self.registration.scope).href;
  return caches.keys().then(ks=>Promise.all(ks.filter(k=>!k.startsWith(PREFIX)).map(k=>caches.open(k).then(c=>c.match(v1).then(hit=>{
    if(!hit)return null;
    return fetch(v1,{cache:'no-store'}).then(r=>r.ok?c.put(v1,r):null).catch(()=>null);
  }))))).catch(()=>null);
}

/* Activation : suppression des anciens caches de CETTE version uniquement. */
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==VERSION).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

/* Requêtes : pages = réseau d'abord (copie en cache pour le hors ligne), le reste = cache d'abord puis mise à jour.
   Les appels à la base de données (autre domaine) ne passent jamais par le cache. */
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  const fonts=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  if(!sameOrigin&&!fonts)return;
  if(req.mode==='navigate'){
    e.respondWith(
      fetch(req).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put('index.html',cp));return r;})
        .catch(()=>caches.open(VERSION).then(c=>c.match('index.html').then(r=>r||c.match('./'))))
    );
    return;
  }
  e.respondWith(caches.open(VERSION).then(c=>c.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r;}).catch(()=>hit);
    return hit||net;
  })));
});
