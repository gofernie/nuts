// src/lib/fetchJson.ts
type Opts = { ttl?: number; tries?: number; timeout?: number };
const memo = new Map<string, { t: number; data: any }>();

export async function getJson<T=any>(url: string, opts: Opts = {}): Promise<T> {
  const ttl = opts.ttl ?? 10 * 60 * 1000;   // 10 minutes
  const tries = Math.max(1, opts.tries ?? 3);
  const timeout = opts.timeout ?? 9000;

  const hit = memo.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.data as T;

  let last: any;
  for (let i = 0; i < tries; i++) {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), timeout);
      const res = await fetch(url, { signal: ac.signal, headers: { "cache-control": "no-cache" } });
      clearTimeout(to);

      if (res.ok) {
        const data = (await res.json()) as T;
        memo.set(url, { t: Date.now(), data });
        return data;
      }
      if (res.status === 429 || res.status >= 500) { await delay(backoff(i)); continue; }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e?.name === "AbortError" ? new Error("timeout") : e;
      await delay(backoff(i));
    }
  }
  throw new Error(`Fetch failed after retries: ${last?.message ?? last}`);
}
const delay = (ms:number)=>new Promise(r=>setTimeout(r, ms));
const backoff = (i:number)=>Math.pow(2,i)*400 + Math.random()*250;
