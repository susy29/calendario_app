self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
  });
  
  self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon.png' // Asegúrate de tener este ícono
      })
    );
  });