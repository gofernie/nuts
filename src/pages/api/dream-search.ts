// File: src/pages/api/dream-search.ts
import type { APIRoute } from "astro";
import { DREAM_SEARCH_SYSTEM_PROMPT } from "../../ai/dreamSearchPrompt";
import {
  coerceDreamCriteriaToRealtyVisParams,
  sanitizeCriteria
} from "../../lib/dreamSearchSchema";

function tryParseJson(txt: string) {
  try {
    return JSON.parse(txt);
  } catch {
    // fallback: attempt to extract the first {...} block
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

/**
 * Parse money inputs like:
 * - 2000000
 * - 2m / 2M / 2 million
 * - 900k / 900K
 * - $1.2m
 *
 * Returns integer dollars or null.
 */
function parseMoneyToDollars(v: any): number | null {
  if (v === null || v === undefined) return null;

  // If already a number, treat it as dollars
  if (typeof v === "number") {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }

  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  const cleaned = s
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // "2 million" / "2.5 million"
  const millionWord = cleaned.match(/^(\d+(\.\d+)?)\s*million$/i);
  if (millionWord) {
    const n = Number(millionWord[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 1_000_000);
  }

  // "900k" / "1.2m"
  const suffix = cleaned.match(/^(\d+(\.\d+)?)(k|m)$/i);
  if (suffix) {
    const n = Number(suffix[1]);
    const unit = suffix[3].toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * (unit === "m" ? 1_000_000 : 1_000));
  }

  // plain number string: "2000000"
  const plain = cleaned.match(/^(\d+(\.\d+)?)$/);
  if (plain) {
    const n = Number(plain[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }

  return null;
}

/* ---------------- year handling (deterministic) ---------------- */

function clampYear(y: number): number | null {
  const n = Math.round(y);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(n)) return null;
  if (n < 1800 || n > currentYear + 2) return null;
  return n;
}

function normalizeYearRange(a: number, b: number) {
  const y1 = clampYear(a);
  const y2 = clampYear(b);
  if (!y1 || !y2) return null;
  return y1 <= y2 ? { year_min: y1, year_max: y2 } : { year_min: y2, year_max: y1 };
}

function extractMaxAgeYears(text: string): number | null {
  const t = (text || "").toLowerCase();

  let m =
    t.match(/less than\s+(\d{1,3})\s+years?\s+old/) ||
    t.match(/under\s+(\d{1,3})\s+years?\s+old/) ||
    t.match(/no older than\s+(\d{1,3})\s+years?/) ||
    t.match(/not older than\s+(\d{1,3})\s+years?/);

  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return Math.round(n);
}

type YearConstraint = { year_min?: number; year_max?: number };

function extractYearConstraints(text: string): YearConstraint | null {
  const t = (text || "").toLowerCase();

  // 1) Between X and Y (strongest)
  const between =
    t.match(/between\s+(19\d{2}|20\d{2})\s+and\s+(19\d{2}|20\d{2})/) ||
    t.match(/from\s+(19\d{2}|20\d{2})\s+to\s+(19\d{2}|20\d{2})/);
  if (between) {
    const r = normalizeYearRange(Number(between[1]), Number(between[2]));
    if (r) return r;
  }

  // 2) Exact year: "built in 2000", "year 2000", "built 2000"
  const exact =
    t.match(/built\s+in\s+(19\d{2}|20\d{2})/) ||
    t.match(/\byear\s+(19\d{2}|20\d{2})\b/) ||
    t.match(/built\s+(19\d{2}|20\d{2})\b/);
  if (exact) {
    const y = clampYear(Number(exact[1]));
    if (y) return { year_min: y, year_max: y };
  }

  // 3) After / since / newer than: "built after 2000", "since 2000"
  const after =
    t.match(/built\s+after\s+(19\d{2}|20\d{2})/) ||
    t.match(/newer\s+than\s+(19\d{2}|20\d{2})/) ||
    t.match(/\bsince\s+(19\d{2}|20\d{2})\b/) ||
    t.match(/\bafter\s+(19\d{2}|20\d{2})\b/);
  if (after) {
    const y = clampYear(Number(after[1]));
    if (y) return { year_min: y }; // inclusive (>= year)
  }

  // 4) Age based: "less than / no older than N years"
  const maxAge = extractMaxAgeYears(text);
  if (maxAge) {
    const currentYear = new Date().getFullYear();
    const y = clampYear(currentYear - maxAge);
    if (y) return { year_min: y }; // year_max intentionally omitted
  }

  return null;
}

async function callModelJSON(payload: any) {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  const base = import.meta.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = import.meta.env.OPENAI_MODEL_DREAM_SEARCH || "gpt-5.2";

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: DREAM_SEARCH_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) }
      ],
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Model call failed - ${res.status} - ${t.slice(0, 220)}`);
  }

  const data = await res.json();
  const txt = data?.choices?.[0]?.message?.content || "{}";
  const parsed = tryParseJson(txt);
  if (!parsed) throw new Error("Model returned non-JSON content");
  return parsed;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const dreamText = String(body?.dreamText ?? "").trim();
    if (!dreamText) {
      return new Response(JSON.stringify({ error: "Missing dreamText" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // UI inputs (maxPrice may be "2m" or "900k" or 2000000)
    const maxPriceRaw = body?.maxPrice ?? null;
    const minBedsRaw = body?.minBeds ?? null;
    const minBathsRaw = body?.minBaths ?? null;

    const maxPriceDollars = parseMoneyToDollars(maxPriceRaw);

    const minBeds =
      typeof minBedsRaw === "number" && Number.isFinite(minBedsRaw) && minBedsRaw > 0
        ? Math.round(minBedsRaw)
        : null;

    const minBaths =
      typeof minBathsRaw === "number" && Number.isFinite(minBathsRaw) && minBathsRaw > 0
        ? Math.round(minBathsRaw)
        : null;

    const modelPayload = {
      market: "Fernie, BC",
      dreamText,
      hints: {
        maxPrice_dollars: maxPriceDollars,
        minBeds,
        minBaths
      }
    };

    const raw = await callModelJSON(modelPayload);

    const criteria: any = sanitizeCriteria(raw?.criteria || raw || {});

    // Force UI values to win (deterministic)
    if (typeof maxPriceDollars === "number" && Number.isFinite(maxPriceDollars) && maxPriceDollars > 0) {
      criteria.max_price = maxPriceDollars;
    }
    if (typeof minBeds === "number" && Number.isFinite(minBeds) && minBeds > 0) {
      criteria.min_beds = minBeds;
    }
    if (typeof minBaths === "number" && Number.isFinite(minBaths) && minBaths > 0) {
      criteria.min_baths = minBaths;
    }

    // Deterministic year handling from the user's text
    const yc = extractYearConstraints(dreamText);
    if (yc) {
      if (typeof yc.year_min === "number") criteria.year_min = yc.year_min;
      if (typeof yc.year_max === "number") criteria.year_max = yc.year_max;
      if (yc.year_max == null) delete criteria.year_max; // age/after rules shouldn't set max
    }

    // Strip placeholder / junk years (handles "1800" as string too)
    const yMin = Number(criteria.year_min);
    const yMax = Number(criteria.year_max);

    if (!Number.isFinite(yMin) || yMin <= 1800) delete criteria.year_min;
    if (!Number.isFinite(yMax) || yMax <= 1800) delete criteria.year_max;

    // If year_min > year_max for any reason, swap
    if (criteria.year_min != null && criteria.year_max != null) {
      const a = Number(criteria.year_min);
      const b = Number(criteria.year_max);
      if (Number.isFinite(a) && Number.isFinite(b) && a > b) {
        criteria.year_min = b;
        criteria.year_max = a;
      }
    }

    const realtyvis_params = coerceDreamCriteriaToRealtyVisParams(criteria);

    return new Response(JSON.stringify({ criteria, realtyvis_params }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e || "Dream search failed") }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
