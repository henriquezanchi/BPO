"use client";

import { useEffect } from "react";

/** Registra o service worker do PWA (public/sw.js) em todas as páginas. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => console.error("Service worker não registrado:", e));
  }, []);
  return null;
}
