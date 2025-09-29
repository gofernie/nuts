// src/lib/fetchJson.ts
export async function getJson<T = any>(url: string): Promise<T> {
  const bust = (url.includes("?") ? "&" : "?") + "ts=" + Date.now();
  const res = await fetch(url + bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}
