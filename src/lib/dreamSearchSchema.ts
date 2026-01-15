// File: src/lib/dreamSearchSchema.ts

export type DreamCriteria = {
  keywords?: string[];
  exclude_keywords?: string[];

  min_price?: number | null;
  max_price?: number | null;

  min_beds?: number | null;
  min_baths?: number | null;

  // Extra filters you discovered
  size_min?: number | null;
  size_max?: number | null;
  lot_min?: number | null;
  lot_max?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  story_min?: number | null;
  story_max?: number | null;
  dom_min?: number | null;
  dom_max?: number | null;

  property_types?: Array<"house" | "townhouse" | "condo" | "land" | "commercial">;

  areas?: string[];
  lifestyle?: string[];
  notes?: string;
};

const ALLOWED_TYPES = new Set(["house", "townhouse", "condo", "land", "commercial"]);

const toNum = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const toStrArr = (v: any) =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

const clamp = (n: number | null, min: number, max: number) =>
  n == null ? null : Math.min(max, Math.max(min, n));

function swapIfInverted(obj: any, a: string, b: string) {
  if (obj[a] != null && obj[b] != null && obj[a] > obj[b]) {
    const t = obj[a];
    obj[a] = obj[b];
    obj[b] = t;
  }
}

export function sanitizeCriteria(input: any): DreamCriteria {
  const c: DreamCriteria = {
    keywords: toStrArr(input?.keywords).slice(0, 12),
    exclude_keywords: toStrArr(input?.exclude_keywords).slice(0, 12),

    min_price: clamp(toNum(input?.min_price), 0, 50_000_000),
    max_price: clamp(toNum(input?.max_price), 0, 50_000_000),

    min_beds: clamp(toNum(input?.min_beds), 0, 20),
    min_baths: clamp(toNum(input?.min_baths), 0, 20),

    size_min: clamp(toNum(input?.size_min), 0, 50_000),
    size_max: clamp(toNum(input?.size_max), 0, 50_000),

    lot_min: clamp(toNum(input?.lot_min), 0, 10_000_000),
    lot_max: clamp(toNum(input?.lot_max), 0, 10_000_000),

    year_min: clamp(toNum(input?.year_min), 1800, 2100),
    year_max: clamp(toNum(input?.year_max), 1800, 2100),

    story_min: clamp(toNum(input?.story_min), 0, 30),
    story_max: clamp(toNum(input?.story_max), 0, 30),

    dom_min: clamp(toNum(input?.dom_min), 0, 5000),
    dom_max: clamp(toNum(input?.dom_max), 0, 5000),

    property_types: toStrArr(input?.property_types)
      .map((t) => t.toLowerCase())
      .filter((t) => ALLOWED_TYPES.has(t))
      .slice(0, 4) as any,

    areas: toStrArr(input?.areas).slice(0, 8),
    lifestyle: toStrArr(input?.lifestyle).slice(0, 10),
    notes: String(input?.notes ?? "").trim().slice(0, 260),
  };

  // If user says "no condo" / "no strata", remove condos from property_types if present
  const ex = (c.exclude_keywords || []).map((s) => s.toLowerCase());
  const blocksCondo = ex.some((x) => x.includes("condo") || x.includes("strata"));
  if (blocksCondo && Array.isArray(c.property_types)) {
    c.property_types = c.property_types.filter((t) => t !== "condo");
  }

  // Swap inverted ranges
  swapIfInverted(c, "min_price", "max_price");
  swapIfInverted(c, "size_min", "size_max");
  swapIfInverted(c, "lot_min", "lot_max");
  swapIfInverted(c, "year_min", "year_max");
  swapIfInverted(c, "story_min", "story_max");
  swapIfInverted(c, "dom_min", "dom_max");

  return c;
}

/**
 * Map DreamCriteria to Fernie search params (confirmed keys).
 * Delta-only: returns only the override params; base bbox/layout/location live in PUBLIC_REALTYVIS_DEFAULT_PARAMS.
 */
export function coerceDreamCriteriaToRealtyVisParams(c: DreamCriteria) {
  const params: Record<string, any> = {};

  // Fernie keys
  if (c.min_price) params.priceMin = c.min_price;
  if (c.max_price) params.priceMax = c.max_price;

  if (c.min_beds) params.bedMin = c.min_beds;
  if (c.min_baths) params.bathMin = c.min_baths;

  if (c.size_min) params.sizeMin = c.size_min;
  if (c.size_max) params.sizeMax = c.size_max;

  if (c.lot_min) params.lotMin = c.lot_min;
  if (c.lot_max) params.lotMax = c.lot_max;

  if (c.year_min) params.yearMin = c.year_min;
  if (c.year_max) params.yearMax = c.year_max;

  if (c.story_min) params.storyMin = c.story_min;
  if (c.story_max) params.storyMax = c.story_max;

  if (c.dom_min) params.domMin = c.dom_min;
  if (c.dom_max) params.domMax = c.dom_max;

  // types: Fernie uses label strings like House, Condo, Townhouse, comma-separated
  const typeMap: Record<string, string> = {
    house: "House",
    condo: "Condo",
    townhouse: "Townhouse",
    land: "Land",
    commercial: "Commercial",
  };

  if (c.property_types?.length) {
    const mapped = c.property_types
      .map((t) => typeMap[String(t).toLowerCase()])
      .filter(Boolean);

    if (mapped.length) params.types = mapped.join(",");
  }

  // keywords: Fernie uses comma-separated string
  const inc = Array.isArray(c.keywords) ? c.keywords.map(String).map(s => s.trim()).filter(Boolean) : [];
  if (inc.length) params.keywords = inc.join(", ");

  // Note: no confirmed exclude keyword param, so we do not send exclude_keywords.

  return params;
}
