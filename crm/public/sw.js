/* Service worker do CRM: só recebe as notificações (vendas, pautas, pontos do dia) e abre a tela
   certa ao tocar. Não guarda cópia das telas nem dos dados. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { title: "IA News CRM", body: event.data ? event.data.text() : "" };
  }
  const titulo = String(dados.title || "IA News CRM").slice(0, 120);
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: String(dados.body || "").slice(0, 300),
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: dados.tag || undefined,
      renotify: !!dados.tag,
      requireInteraction: !!dados.urgente,
      data: { url: typeof dados.url === "string" ? dados.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let destino = self.location.origin + "/";
  try {
    const url = new URL(event.notification.data && event.notification.data.url, self.location.origin);
    // Só abre telas do próprio CRM.
    if (url.origin === self.location.origin) destino = url.href;
  } catch {
    /* fica no início */
  }
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
