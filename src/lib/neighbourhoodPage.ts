export const RESERVED = new Set(["index", "page", "pages", "all", "view", "list"]);

export const get = (r: any, k: string) =>
  (r?.[k] ?? r?.[k?.toLowerCase?.()] ?? r?.[k?.toUpperCase?.()] ?? "").toString().trim();

export const slugify = (v: string) =>
  (v ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const visible = (r: any) => {
  const s = get(r, "status").toLowerCase();
  const rawSlug = get(r, "slug").toLowerCase();
  return s !== "hidden" && s !== "inactive" && rawSlug !== "index" && !RESERVED.has(rawSlug);
};

/* HTML sanitizers (minimal) */
export const stripScripts = (html: string = "") =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

export const stripTags = (s: string = "") =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;\s]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const stripMeta = (s: string = "") => stripTags(s);

/* pipe helpers */
export const listFromPipe = (s: string = "", max = 3) =>
  s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

/* url helpers */
export const isAbs = (s: string = "") => /^https?:\/\//i.test(s);
export const pick = (...vals: string[]) => vals.find((v) => v && v.length > 0) || "";

/* Best-for icons */
export function iconForBestFor(text: string) {
  const t = (text || "").toLowerCase();
  if (t.includes("afford") || t.includes("value") || t.includes("budget") || t.includes("entry")) return "💲";
  if (t.includes("ski") || t.includes("hill") || t.includes("lifts") || t.includes("snow")) return "⛷️";
  if (t.includes("short-term") || t.includes("short term") || t.includes("str") || t.includes("airbnb") || t.includes("rental")) return "🗝️";
  if (t.includes("lock-and-leave") || t.includes("lock and leave") || t.includes("low-maintenance") || t.includes("low maintenance")) return "🧳";
  if (t.includes("trail") || t.includes("hike") || t.includes("hiking") || t.includes("bike") || t.includes("biking")) return "🥾";
  if (t.includes("walk") || t.includes("walkable") || t.includes("cafes") || t.includes("downtown")) return "🚶";
  if (t.includes("family") || t.includes("kids") || t.includes("school") || t.includes("parks")) return "👪";
  if (t.includes("quiet") || t.includes("privacy")) return "🤫";
  if (t.includes("new") || t.includes("newer") || t.includes("modern")) return "🏡";
  if (t.includes("river") || t.includes("water")) return "🌊";
  if (t.includes("view") || t.includes("views") || t.includes("scenic") || t.includes("mountain")) return "🏔️";
  if (t.includes("access") || t.includes("commute") || t.includes("highway")) return "🚗";
  return "⭐";
}

/* access parsing */
export type AccessEntry = { label: string; walk?: string; drive?: string };

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export function parseAccessTimes(raw: string): Record<string, AccessEntry> {
  const out: Record<string, AccessEntry> = {};
  const parts = (raw || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  const re = /^(.+?)\s*\((.+?)\)\s*$/;

  for (const p of parts) {
    const m = p.match(re);
    if (!m) continue;

    const label = m[1].trim();
    const inside = m[2].trim();
    const insideN = norm(inside);

    const mode = insideN.includes("walk") ? "walk" : insideN.includes("drive") ? "drive" : null;
    if (!mode) continue;

    const time = inside.replace(/\bwalk\b/i, "").replace(/\bdrive\b/i, "").trim();

    const key = norm(label);
    out[key] = out[key] || { label };
    (out[key] as any)[mode] = time;
  }

  return out;
}

export function pickAccess(map: Record<string, AccessEntry>, keys: string[]): AccessEntry | null {
  for (const k of keys) {
    const hit = map[norm(k)];
    if (hit && (hit.walk || hit.drive)) return hit;
  }
  return null;
}
