/* Ancien service worker de la v2 (portée v2/) : il se désinscrit et supprime ses caches.
   Les anciennes installations de « Life Hub 2 » passent ainsi à l'application principale. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k.indexOf('life-hub-2-')===0).map(k=>caches.delete(k))))
      .then(()=>self.registration.unregister())
  );
});
