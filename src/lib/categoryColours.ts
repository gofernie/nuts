// File: src/lib/categoryColours.ts

/**
 * Fernie.homes primary brand accent
 * Used everywhere unless explicitly overridden at a page level.
 */
export const DEFAULT_ACCENT = "#0E7490";

/**
 * Top-level section accents (headers, pills, etc.)
 * Intentionally unified to reinforce a single brand system.
 */
export const CATEGORY_COLOURS: Record<string, string> = {
  browse: DEFAULT_ACCENT,
  neighbourhoods: DEFAULT_ACCENT,
  types: DEFAULT_ACCENT,
  buildings: DEFAULT_ACCENT,
  lifestyle: DEFAULT_ACCENT,
};

/**
 * Explicit type slug -> accent mapping
 * Kept for API compatibility but intentionally neutralized.
 * If you later want page-level moods, this is where they go.
 */
export const TYPE_ACCENTS: Record<string, string> = {};

/**
 * Clean + normalize a slug so lookups are stable.
 */
const clean = (s: string) =>
  (s || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^types\//i, "")
    .toLowerCase();

/**
 * Accent for property-type pages or cards
 * Currently always returns the Fernie.homes brand colour.
 */
export function accentForTypeSlug(slug: string) {
  const key = clean(slug);
  return TYPE_ACCENTS[key] || DEFAULT_ACCENT;
}

/**
 * Accent for neighbourhood pages or cards
 * Locked to brand colour to avoid MLS-style rainbow UI.
 */
export function accentForNeighbourhoodSlug(_slug: string) {
  return DEFAULT_ACCENT;
}
