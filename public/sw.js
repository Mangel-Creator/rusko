// Organizy · service worker (26/10/2026). Solo para los avisos con sonido de la web
// instalada (Web Push): los recibe aunque la web esté cerrada y, al tocarlos, abre la
// pantalla que toca. No guarda nada en caché ni toca las peticiones, así que la web se
// sigue actualizando sola como siempre (src/services/actualizacionWeb.ts).
//
// Cada aviso llega cifrado desde la función avisos-web de Supabase como JSON:
// { id, titulo, cuerpo, url } (url relativa a la raíz de la app, por ejemplo "/evento?id=…").

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { titulo: evento.data ? evento.data.text() : 'Rusko' };
  }
  const raiz = self.registration.scope; // "https://…/rusko/"
  const url = new URL(String(datos.url || '/').replace(/^\//, ''), raiz).href;
  // Siempre se enseña un aviso: Safari deja de mandarlos si llega alguno sin enseñar.
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'Rusko', {
      body: datos.cuerpo || '',
      tag: datos.id || undefined,
      icon: `${raiz}icono-app.png`,
      lang: 'es',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || self.registration.scope;
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const ventana of ventanas) {
        if (!('focus' in ventana)) continue;
        await ventana.focus();
        if ('navigate' in ventana) await ventana.navigate(url).catch(() => null);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
