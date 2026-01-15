// FILE: src/pages/api/home-match.ts
import type { APIRoute } from "astro";
import { HOME_MATCH_SYSTEM_PROMPT } from "../../ai/homeMatchPrompt";

const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;
const MODEL = "gpt-5.1";

const NEIGH_URL = import.meta.env.PUBLIC_SHEET_JSON; // neighbourhoods sheet (for lifestyle_tags)

/* ---------------- helpers ---------------- */

const cleanField = (v: unknown): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

const normalizeToken = (v: string): string =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const KNOWN_NEIGHBOURHOODS = [
  { slug: "montane", aliases: ["montane", "montane-fernie"] },
  { slug: "the-cedars", aliases: ["the-cedars", "cedars", "the cedars", "the-cedars-fernie"] },
  { slug: "ridgemont", aliases: ["ridgemont"] },
  { slug: "west-fernie", aliases: ["west-fernie", "west", "west fernie"] },
  { slug: "downtown", aliases: ["downtown", "town"] },
  { slug: "the-annex", aliases: ["the-annex", "annex", "the annex"] },
  { slug: "skihill", aliases: ["skihill", "ski-hill", "ski hill", "the hill", "fernie alpine resort"] },
  { slug: "the-airport", aliases: ["the-airport", "airport", "airport area", "the airport"] },
  { slug: "parkland-terraces", aliases: ["parkland-terraces", "parkland", "parklands", "parkland terraces"] },
  { slug: "riverside", aliases: ["riverside"] },
  { slug: "alpine-trails", aliases: ["alpine-trails", "alpine trails"] },
];

// IMPORTANT: map AI "types" to the slugs that actually exist in YOUR Types sheet
const KNOWN_PROPERTY_TYPES = [
  {
    slug: "homes-for-sale-in-fernie-bc",
    aliases: ["single-family-homes", "single family homes", "detached", "houses", "family homes", "homes", "house"],
  },
  {
    slug: "condos-and-townhomes-for-sale-in-fernie-bc",
    aliases: [
      "condos",
      "condo",
      "apartments",
      "apartment",
      "townhomes",
      "townhome",
      "townhouse",
      "townhouses",
      "ski-hill-condos",
      "ski hill condos",
      "ski hill condo",
    ],
  },
  { slug: "lots-and-land-for-sale-in-fernie-bc", aliases: ["acreages", "acreage", "land", "lots", "lot", "vacant land"] },
  {
    slug: "investment-properties-for-sale-in-fernie-bc",
    aliases: ["investment-properties", "investment", "rental", "rental income", "income property"],
  },
  { slug: "luxury-homes-for-sale-in-fernie-bc", aliases: ["luxury homes", "luxury", "high end", "high-end", "premium"] },
  {
    slug: "starter-homes-for-sale-in-fernie-bc",
    aliases: ["starter homes", "starter", "entry level", "entry-level", "first home", "first-time"],
  },
  { slug: "commercial-real-estate-fernie", aliases: ["commercial", "commercial listings", "commercial real estate"] },
  { slug: "new-listings-fernie", aliases: ["new listings", "new-listings", "just listed", "fresh listings"] },
];

function mapToKnown(raw: string[], table: { slug: string; aliases: string[] }[]): string[] {
  const out = new Set<string>();

  for (const item of raw || []) {
    const token = normalizeToken(String(item || ""));
    if (!token) continue;

    const exact = table.find((t) => normalizeToken(t.slug) === token);
    if (exact) {
      out.add(exact.slug);
      continue;
    }

    const aliasHit = table.find((t) => t.aliases.some((a) => normalizeToken(a) === token));
    if (aliasHit) {
      out.add(aliasHit.slug);
      continue;
    }
  }

  return Array.from(out);
}

function extractJsonBlock(text: string) {
  const startTag = "<fh_json>";
  const endTag = "</fh_json>";

  const start = text.indexOf(startTag);
  const end = text.indexOf(endTag);

  if (start === -1 || end === -1 || end <= start) {
    return { stripped: text.trim(), meta: null as null | any };
  }

  const before = text.slice(0, start).trimEnd();
  const jsonChunk = text.slice(start + startTag.length, end).trim();
  const after = text.slice(end + endTag.length).trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonChunk);
  } catch (e) {
    console.error("Failed to parse <fh_json> block:", e);
  }

  const stripped = [before, after].filter(Boolean).join("\n\n").trim();
  return { stripped, meta: parsed };
}

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------------- lifestyle_tags support (server) ---------------- */

type NeighRow = { slug: string; lifestyle_tags: string[] };

const getField = (r: any, k: string) =>
  (r?.[k] ?? r?.[k?.toLowerCase?.()] ?? r?.[k?.toUpperCase?.()] ?? "").toString().trim();

const normalizeSlugServer = (v: any) =>
  String(v ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .pop()
    ?.toLowerCase() || "";

const parseLifestyleTags = (v: any): string[] => {
  const raw = String(v ?? "")
    .replace(/\r?\n/g, " ")
    .trim();
  if (!raw) return [];
  const parts = raw.split(/[,|;]+/g).map((s) => s.trim()).filter(Boolean);
  const out = parts
    .map((s) =>
      s
        .replace(/^"+|"+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
  return Array.from(new Set(out));
};

async function fetchNeighbourhoodLifestyleRows(): Promise<NeighRow[]> {
  if (!NEIGH_URL) return [];
  try {
    const res = await fetch(NEIGH_URL);
    const raw = await res.json().catch(() => null);

    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
      ? raw.rows
      : [];

    const cleaned = (rows || [])
      .map((r: any) => {
        const slug = normalizeSlugServer(getField(r, "slug"));
        if (!slug) return null;

        // only keep slugs you allow
        const allowed = KNOWN_NEIGHBOURHOODS.some((n) => n.slug === slug);
        if (!allowed) return null;

        const tags = parseLifestyleTags(getField(r, "lifestyle_tags"));
        return { slug, lifestyle_tags: tags };
      })
      .filter(Boolean) as NeighRow[];

    return cleaned;
  } catch (e) {
    console.error("Failed fetching neighbourhood lifestyle tags:", e);
    return [];
  }
}

function scoreNeighbourhoodsFromTags(text: string, neighRows: NeighRow[]) {
  const t = normalizeToken(text || "").replace(/-/g, " "); // loose tokenization aid
  const score = new Map<string, number>();

  const bump = (slug: string, pts: number) => score.set(slug, (score.get(slug) || 0) + pts);

  // 1) direct tag matches (from your sheet)
  for (const row of neighRows) {
    for (const tag of row.lifestyle_tags || []) {
      const tagNorm = String(tag || "").toLowerCase().trim();
      if (!tagNorm) continue;

      // simple contains match: if visitor text contains the tag phrase, boost that neighbourhood
      if (t.includes(tagNorm)) bump(row.slug, 6);

      // single-token tags: match normalized tokens too
      const tagTok = normalizeToken(tagNorm).replace(/-/g, " ");
      if (tagTok && (t.includes(tagTok) || normalizeToken(text).includes(normalizeToken(tagNorm)))) {
        bump(row.slug, 3);
      }
    }
  }

  // 2) extra safety heuristics (helps even if tags are sparse)
  const s = (text || "").toLowerCase();

  if (/\bfamily|kids|school|playground|yard\b/.test(s)) {
    bump("the-cedars", 4);
    bump("montane", 3);
    bump("ridgemont", 2);
  }

  if (/\bski|snow|hill|resort|powder\b/.test(s)) {
    bump("skihill", 5);
    bump("alpine-trails", 3);
  }

  if (/\bwalk|downtown|coffee|remote|bike|trail|shops\b/.test(s)) {
    bump("downtown", 4);
    bump("the-annex", 3);
    bump("riverside", 2);
    bump("montane", 1);
  }

  if (/\bquiet|retire|peace|view|space\b/.test(s)) {
    bump("ridgemont", 3);
    bump("west-fernie", 3);
    bump("the-cedars", 2);
  }

  // return in descending score order
  return Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
}

function pickFallbackNeighbourhoods(
  situation: string,
  budget: string,
  timing: string,
  neighRows: NeighRow[]
): string[] {
  const combined = `${situation} ${budget} ${timing}`.toLowerCase();

  // start with lifestyle-tag-driven candidates
  const ranked = scoreNeighbourhoodsFromTags(combined, neighRows);

  const out: string[] = [];
  const push = (slug: string) => {
    if (!slug) return;
    if (out.includes(slug)) return;
    out.push(slug);
  };

  // take top scored first
  ranked.forEach((s) => push(s));

  // then apply your existing keyword buckets as a safety net
  if (/\bski|snow|hill|resort\b/.test(combined)) {
    ["skihill", "alpine-trails", "montane", "the-annex"].forEach(push);
  } else if (/\bwalk|downtown|coffee|remote|bike|trail\b/.test(combined)) {
    ["downtown", "the-annex", "montane", "riverside"].forEach(push);
  } else if (/\bquiet|retire|peace|view|space\b/.test(combined)) {
    ["ridgemont", "west-fernie", "montane", "the-cedars"].forEach(push);
  } else {
    ["montane", "the-cedars", "ridgemont", "west-fernie"].forEach(push);
  }

  // enforce allowed list and length
  const allowed = new Set(KNOWN_NEIGHBOURHOODS.map((n) => n.slug));
  return out.filter((s) => allowed.has(s)).slice(0, 4);
}

function pickFallbackTypes(situation: string, budget: string, timing: string): string[] {
  const s = `${situation} ${budget} ${timing}`.toLowerCase();

  if (/\binvest|rental|income\b/.test(s)) {
    return ["investment-properties-for-sale-in-fernie-bc"].slice(0, 3);
  } else if (/\bcondo|townhome|apartment\b/.test(s)) {
    return ["condos-and-townhomes-for-sale-in-fernie-bc"].slice(0, 3);
  } else if (/\bland|lot|acreage\b/.test(s)) {
    return ["lots-and-land-for-sale-in-fernie-bc"].slice(0, 3);
  } else {
    return ["homes-for-sale-in-fernie-bc"].slice(0, 3);
  }
}

/* ---------------- route ---------------- */

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!OPENAI_API_KEY) return json({ error: "Service unavailable" }, 503);

    const body = await request.json().catch(() => ({} as any));
    const situation = cleanField(body.situation);
    const budget = cleanField(body.budget);
    const timing = cleanField(body.timing);

    const userPrompt = `
Visitor details:
- Situation: ${situation || "not provided"}
- Budget: ${budget || "not provided"}
- Timing: ${timing || "not provided"}

Formatting rules for the visible answer:
- Use Markdown headings and bullet lists.
- Keep it practical and conservative - do NOT overreach on geography or claim proximity unless you're sure.
- NEVER include slugs or any bracketed/JSON identifiers next to names (no (\`slug\`), no {"slug":...}).
- Do NOT invent URLs or paths. Links are handled by the UI.

Then append the <fh_json> block exactly as instructed.
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: HOME_MATCH_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text().catch(() => "");
      console.error("OpenAI error:", txt);
      return json({ error: "Home Match unavailable - try again shortly." }, 502);
    }

    const data = await openaiRes.json();

    const rawText: string =
      (typeof data?.output_text === "string" && data.output_text) ||
      (data?.output?.[0]?.content?.[0]?.text ?? "") ||
      "";

    if (!rawText) return json({ error: "Empty assistant response." }, 500);

    const { stripped, meta } = extractJsonBlock(rawText);

    let neighbourhoodSlugs: string[] = [];
    let propertyTypeSlugs: string[] = [];

    if (meta && typeof meta === "object") {
      const rawNeigh = Array.isArray(meta.neighbourhoods) ? meta.neighbourhoods : [];
      const rawTypes = Array.isArray(meta.property_types) ? meta.property_types : [];

      neighbourhoodSlugs = mapToKnown(rawNeigh.map(String), KNOWN_NEIGHBOURHOODS).slice(0, 4);
      propertyTypeSlugs = mapToKnown(rawTypes.map(String), KNOWN_PROPERTY_TYPES).slice(0, 3);
    }

    // Fallback - if the model failed to return a usable machine block,
    // choose safe defaults based on lifestyle_tags + keywords (never return empty).
    if (neighbourhoodSlugs.length === 0) {
      const neighRows = await fetchNeighbourhoodLifestyleRows();
      neighbourhoodSlugs = pickFallbackNeighbourhoods(situation, budget, timing, neighRows);
    }

    if (propertyTypeSlugs.length === 0) {
      propertyTypeSlugs = pickFallbackTypes(situation, budget, timing);
    }

    return json({
      answer: (stripped || rawText.trim()).trim(),
      neighbourhoodSlugs,
      propertyTypeSlugs,
    });
  } catch (err) {
    console.error("Home Match API crash:", err);
    return json({ error: "Something went wrong - try again." }, 500);
  }
};
