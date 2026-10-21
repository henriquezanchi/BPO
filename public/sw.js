/*
 * Service worker do Portal (PWA) — 2026-10-21.
 * Recebe as notificações push e, ao tocar, abre (ou traz para frente) a
 * tela indicada. Não guarda páginas em cache: o Portal mostra dados de
 * contribuição e cadastro, que precisam vir sempre atualizados do servidor.
 * Sem conexão, a navegação cai numa página simples de "sem internet".
 */
const CACHE = "portal-na-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data ? event.data.text() : "" };
  }
  const titulo = dados.title || "Portal Nova Acrópole";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/pwa-icon-192",
      badge: "/pwa-badge",
      tag: dados.tag || undefined,
      renotify: !!dados.tag,
      data: { url: dados.url || "/portal" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/portal", self.location.origin);
  event.waitUntil(
    (async () => {
      // Link externo (ex.: chamada de vídeo do encontro): abre direto.
      if (destino.origin !== self.location.origin) return self.clients.openWindow(destino.href);
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (aberta) {
        await aberta.focus();
        return aberta.navigate(destino.href);
      }
      return self.clients.openWindow(destino.href);
    })(),
  );
});
