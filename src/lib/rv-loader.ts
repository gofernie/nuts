// src/lib/rv-loader.ts
const RV_SRC = "https://cdn.realtyvis.com/js/embed.js";

declare global {
  interface Window {
    __rvLoading?: boolean;
    __rvLoaded?: boolean;
    RealtyVis?: any;
  }
}

const waitUntil = (cond: () => boolean, timeoutMs = 8000) =>
  new Promise<void>((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      if (cond()) return resolve();
      if (performance.now() - start > timeoutMs) return reject(new Error("timeout"));
      requestAnimationFrame(tick);
    };
    tick();
  });

export async function ensureRVLoaded(): Promise<void> {
  if (window.__rvLoaded || window.RealtyVis) return;

  if (window.__rvLoading) {
    await waitUntil(() => !!window.RealtyVis);
    window.__rvLoaded = true;
    return;
  }

  window.__rvLoading = true;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = RV_SRC;
    s.async = true;
    s.onload = () => { window.__rvLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("Failed to load RealtyVis"));
    document.head.appendChild(s);
  });

  window.addEventListener("pageshow", (e: PageTransitionEvent) => {
    if ((e as any).persisted && window.RealtyVis) window.__rvLoaded = true;
  });
}

export function initRV(root?: HTMLElement | Document = document) {
  try {
    (window.RealtyVis?.init && window.RealtyVis.init(root)) || void 0;
  } catch {}
}
