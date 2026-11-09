/* Life Hub : service worker. Change VERSION à chaque mise à jour des fichiers pour renouveler le cache. */
const VERSION='life-hub-v11';
const CORE=['./','index.html','manifest.json','config.js','icons/icon-32.png','icons/icon-192.png','icons/icon-512.png','icons/icon-512-maskable.png','icons/apple-touch-icon.png'];

/* Installation : mise en cache des fichiers de base. Un fichier manquant n'empêche pas l'installation. */
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(VERSION)
      .then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>null))))
      .then(()=>self.skipWaiting())
  );
});

/* Activation : suppression de tous les anciens caches (anciennes versions comprises). */
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
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
  /* Liste des matchs de Karmine Corp : toujours le réseau d'abord, pour ne pas lire une liste périmée. */
  if(url.pathname.indexOf('/data/')>=0){
    e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.open(VERSION).then(c=>c.match(req))));
    return;
  }
  e.respondWith(caches.open(VERSION).then(c=>c.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r;}).catch(()=>hit);
    return hit||net;
  })));
});
