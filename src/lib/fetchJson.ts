// src/lib/fetchJson.ts
// Retry + in-memory TTL cache; NEVER throws (returns null on failure)

type Opts = { ttl?: number; tries?: number; timeout?: number };
const memo = new Map<string, { t: number; data: any }>();

export async function getJson<T = any>(url: string, opts: Opts = {}): Promise<T | null> {
  const ttl = opts.ttl ?? 10 * 60 * 1000; // 10 minutes
  const tries = Math.max(1, opts.tries ?? 3);
  const timeout = opts.timeout ?? 9000;

  const hit = memo.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.data as T;

  let lastErr: any;
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
      // retry on rate limit / server errors
      if (res.status === 429 || res.status >= 500) {
        await delay(backoff(i));
        continue;
      }
      lastErr = new Error(`HTTP ${res.status}`);
      break;
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? new Error("timeout") : e;
      await delay(backoff(i));
    }
  }
  console.warn("[getJson] returning null:", lastErr?.message || lastErr);
  return null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (i: number) => Math.pow(2, i) * 400 + Math.random() * 250;
