// File: src/ai/homeMatchChat.ts

export type Msg = { role: "user" | "assistant"; content: string };

export type PropertyType = "house" | "townhouse" | "condo" | "land" | "investment" | "any";

export type HomeMatchState = {
  budgetMax?: number; // dollars
  bedsMin?: number;
  propertyType?: PropertyType;

  areaSlug?: string;
  areaName?: string;
  areaLocked?: boolean;

  mustHaves: string[];
  dealbreakers: string[];

  stage: "discover" | "areas" | "types" | "listings";
  asked: {
    budgetBeds?: boolean;
    focusArea?: boolean;
    propertyType?: boolean;
    mustHaveDealbreaker?: boolean;
  };

  shownAreas: string[];
  shownTypes: string[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr || []) {
    const k = String(x || "").trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(String(x).trim());
  }
  return out;
}

/* ---------------- parsing ---------------- */

function normalizeMoneyToNumber(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base) || base <= 0) return null;
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1;
  return Math.round(base * mult);
}

function normalizeMoneyWordsToNumber(text: string): number | null {
  // Handles: "2 million", "2.5 million", "900 thousand", "2m" already handled elsewhere
  const t = text.toLowerCase();

  const w = t.match(/\b(\d+(?:\.\d+)?)\s*(million|mill|mn|thousand|k)\b/);
  if (w) {
    const n = Number(w[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = w[2];
    const mult =
      unit === "million" || unit === "mill" || unit === "mn" ? 1_000_000 :
      unit === "thousand" || unit === "k" ? 1_000 :
      1;
    return Math.round(n * mult);
  }

  return null;
}

function extractBudget(text: string): number | null {
  const t = text.toLowerCase();

  // 1) “up to / under / max …”
  const m = t.match(/\b(?:under|upto|up to|max|budget|<=|<)\s*\$?\s*(\d[\d,]*(?:\.\d+)?\s*[km]?)\b/i);
  if (m) return normalizeMoneyToNumber(m[1].trim());

  // 2) $900k / $450000
  const m2 = t.match(/\$\s*(\d[\d,]*(?:\.\d+)?\s*[km]?)\b/i);
  if (m2) return normalizeMoneyToNumber(m2[1].trim());

  // 3) 900k / 1.2m
  const m3 = t.match(/\b(\d+(?:\.\d+)?\s*[km])\b/i);
  if (m3) return normalizeMoneyToNumber(m3[1].trim());

  // 4) “2 million”, “900 thousand”
  const mw = normalizeMoneyWordsToNumber(t);
  if (mw != null) return mw;

  // 5) Plain digits only like “2000000”
  const digitsOnly = t.match(/^\s*(\d{5,})\s*$/);
  if (digitsOnly) {
    const n = Number(digitsOnly[1]);
    if (Number.isFinite(n) && n >= 50_000) return Math.round(n);
  }

  // 6) Embedded plain digits e.g. “budget 2000000”
  const embedded = t.match(/\b(\d{6,})\b/);
  if (embedded) {
    const n = Number(embedded[1]);
    if (Number.isFinite(n) && n >= 50_000) return Math.round(n);
  }

  return null;
}

function extractBeds(text: string, expectingNumberOnly: boolean): number | null {
  const t = text.toLowerCase().trim();

  if (expectingNumberOnly) {
    // "3" or "3+"
    const only = t.match(/^\s*(\d{1,2})\s*\+?\s*$/);
    if (only) {
      const n = Number(only[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }

    // ✅ common variants: "min 3", "minimum 3", "at least 3", "3 min"
    const minish = t.match(/\b(?:min|minimum|at\s*least)\s*(\d{1,2})\b/);
    if (minish) {
      const n = Number(minish[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }

    const trailingMin = t.match(/\b(\d{1,2})\s*(?:min|minimum)\b/);
    if (trailingMin) {
      const n = Number(trailingMin[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }

    // ✅ last-resort: if they typed a short message containing a single 1-2 digit number
    // (only enabled when we’re explicitly waiting for a bedroom number)
    const lone = t.match(/^\s*[^\d]*?(\d{1,2})[^\d]*?\s*$/);
    if (lone) {
      const n = Number(lone[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }
  }

  // Normal bed patterns: "3 bed", "3 bedrooms", "3+ beds"
  const m = t.match(/\b(\d{1,2})\s*\+?\s*(?:bed|beds|bedroom|bedrooms)\b/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  return null;
}

function extractType(text: string): PropertyType | null {
  const t = text.toLowerCase();
  if (/(rental|investment|income|cap rate|cashflow|cash flow)/.test(t)) return "investment";
  if (/(condo|apartment|flat)/.test(t)) return "condo";
  if (/(townhouse|townhome|row ?house)/.test(t)) return "townhouse";
  if (/(land|lot|acreage)/.test(t)) return "land";
  if (/(house|home|detached|single family)/.test(t)) return "house";
  return null;
}

function looksLikeNoPreference(text: string) {
  const t = text.toLowerCase();
  return /(no specific|no preference|any area|anywhere|doesn'?t matter|whatever|open to|all good|doesnt matter)/.test(t);
}

function extractMustHaves(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];

  if (/(garage|heated garage|double garage|attached garage)/.test(t)) out.push("garage");
  if (/(yard|backyard|big yard|fenced)/.test(t)) out.push("yard");
  if (/(suite|basement suite|income suite|mortgage helper)/.test(t)) out.push("suite");
  if (/(views?|mountain view|view lot)/.test(t)) out.push("views");
  if (/(ski ?in|ski ?out|walk to lifts|on hill)/.test(t)) out.push("near skiing");
  if (/(walkable|downtown|close to town|walk to shops)/.test(t)) out.push("walkable");
  if (/(new build|brand new|modern)/.test(t)) out.push("newer/modern");

  const mh = t.match(/\bmust have\s+(.+?)$/);
  if (mh && mh[1]) {
    const v = mh[1].trim().replace(/[.!,]+$/, "");
    if (v && v.length <= 60) out.push(v);
  }

  return uniq(out);
}

function extractDealbreakers(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];

  if (/(no str|no short[- ]term|no airbnb|not str)/.test(t)) out.push("no STR");
  if (/(no hoa|no strata|avoid strata)/.test(t)) out.push("avoid strata");
  if (/(not busy road|no highway|avoid noise)/.test(t)) out.push("avoid busy roads");
  if (/(no reno|no fixer|turnkey only)/.test(t)) out.push("no renos");

  const m = t.match(/\bdealbreaker[s]?:\s*(.+)$/);
  if (m && m[1]) {
    const v = m[1].trim().replace(/[.!,]+$/, "");
    if (v && v.length <= 80) out.push(v);
  }

  if (/(no dealbreakers|none|nothing really)/.test(t)) return [];

  return uniq(out);
}

/* ---- small conservative area recognizer (stops obvious loops) ---- */
const KNOWN_AREAS: Array<{ slug: string; name: string; re: RegExp }> = [
  { slug: "montane", name: "Montane", re: /\bmontane\b/i },
  { slug: "the-cedars", name: "The Cedars", re: /\bcedars?\b/i },
  { slug: "downtown", name: "Downtown", re: /\bdowntown\b/i },
  { slug: "west-fernie", name: "West Fernie", re: /\bwest\s+fernie\b/i },
  { slug: "ridgemont", name: "Ridgemont", re: /\bridgemont\b/i },
  { slug: "annex", name: "Annex", re: /\bannex\b/i },
  { slug: "skihill", name: "Ski Hill Area", re: /\b(ski ?hill|fernie alpine)\b/i },
];

function extractArea(text: string): { slug: string; name: string } | null {
  for (const a of KNOWN_AREAS) {
    if (a.re.test(text)) return { slug: a.slug, name: a.name };
  }
  return null;
}

/* ---------------- robustness: derive "asked" from history ---------------- */

function deriveAskedFromHistory(history: Msg[] | undefined): HomeMatchState["asked"] {
  const asked: HomeMatchState["asked"] = {};
  const h = (history || []).filter(Boolean);

  for (const m of h) {
    if (m.role !== "assistant") continue;
    const t = String(m.content || "").toLowerCase();

    if (t.includes("what type are you looking for")) asked.propertyType = true;
    if (t.includes("max budget") || t.includes("minimum bedrooms") || t.includes("how many bedrooms")) asked.budgetBeds = true;
    if (t.includes("must-haves") || t.includes("must haves") || t.includes("dealbreakers")) asked.mustHaveDealbreaker = true;
    if (t.includes("preferred neighbourhood") || t.includes("preferred neighborhood") || t.includes("any preferred neighbourhood")) asked.focusArea = true;
  }

  return asked;
}

function lastAssistantText(history: Msg[] | undefined): string {
  const h = (history || []).filter(Boolean);
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].role === "assistant") return String(h[i].content || "");
  }
  return "";
}

/* ---------------- state merge ---------------- */

function mergeState(prev: HomeMatchState | null, next: Partial<HomeMatchState>): HomeMatchState {
  const base: HomeMatchState = prev || {
    mustHaves: [],
    dealbreakers: [],
    stage: "discover",
    asked: {},
    shownAreas: [],
    shownTypes: [],
  };

  return {
    ...base,
    ...next,
    asked: { ...(base.asked || {}), ...(next.asked || {}) },
    mustHaves: uniq([...(base.mustHaves || []), ...((next.mustHaves as any) || [])]),
    dealbreakers: uniq([...(base.dealbreakers || []), ...((next.dealbreakers as any) || [])]),
    shownAreas: uniq([...(base.shownAreas || []), ...((next.shownAreas as any) || [])]),
    shownTypes: uniq([...(base.shownTypes || []), ...((next.shownTypes as any) || [])]),
  };
}

/* ---------------- next prompt ---------------- */

function decideNextPrompt(state: HomeMatchState, meta: { lastAssistant: string; justAskedBudgetBeds: boolean }) {
  const haveBudget = !!state.budgetMax;
  const haveBeds = !!state.bedsMin;
  const haveType = !!state.propertyType && state.propertyType !== "any";

  // 1) Always gather type first if missing (keeps the flow sensible)
  if (!haveType) {
    return {
      reply: `What type are you looking for (house, condo, townhouse, land, investment)?`,
      askedPatch: { propertyType: true },
    };
  }

  // 2) Budget + beds (smart split + anti-loop wording)
  if (!haveBudget || !haveBeds) {
    // If they’ve given ONE of the two, only ask for the missing piece.
    if (haveBudget && !haveBeds) {
      return {
        reply: `How many bedrooms minimum? (Examples: "3", "min 3", or "3+ beds")`,
        askedPatch: { budgetBeds: true },
      };
    }
    if (!haveBudget && haveBeds) {
      return {
        reply: `What’s your max budget? (Examples: "$900k", "900000", or "2 million")`,
        askedPatch: { budgetBeds: true },
      };
    }

    // neither provided yet
    // If we already asked this exact combo very recently and still didn't get it, change the wording.
    if (meta.justAskedBudgetBeds) {
      return {
        reply: `Quick one - what’s your max budget (e.g., "900000" or "2 million") and minimum bedrooms (e.g., "3")?`,
        askedPatch: { budgetBeds: true },
      };
    }

    return {
      reply: `What’s your max budget and minimum bedrooms? (Example: "$900k and 3+ beds")`,
      askedPatch: { budgetBeds: true },
    };
  }

  if (!state.asked.mustHaveDealbreaker) {
    return {
      reply: `Tell me 1 - 2 must-haves (and any dealbreakers). (Examples: "garage", "yard", "suite", "walkable")`,
      askedPatch: { mustHaveDealbreaker: true },
    };
  }

  if (!state.asked.focusArea) {
    return {
      reply: `Any preferred neighbourhood / area? (Example: "Montane" or "no preference")`,
      askedPatch: { focusArea: true },
    };
  }

  return {
    reply: `Perfect. Want me to suggest a few neighbourhoods that fit, or jump straight to current listings?`,
  };
}

/* ---------------- main ---------------- */

export async function runHomeMatchChat(args: {
  message: string;
  history?: Msg[];
  state?: HomeMatchState | null;
}): Promise<{ reply: string; state: HomeMatchState }> {
  const message = String(args.message || "").trim();
  const history = Array.isArray(args.history) ? args.history : [];
  const prev = args.state || null;

  // If state is missing/empty, infer what we've already asked from history.
  const askedFromHistory = deriveAskedFromHistory(history);
  const seededPrev: HomeMatchState | null = prev
    ? { ...prev, asked: { ...(askedFromHistory || {}), ...(prev.asked || {}) } }
    : {
        mustHaves: [],
        dealbreakers: [],
        stage: "discover",
        asked: askedFromHistory || {},
        shownAreas: [],
        shownTypes: [],
      };

  const lastA = lastAssistantText(history).toLowerCase();
  const justAskedBudgetBeds =
    lastA.includes("max budget") &&
    (lastA.includes("minimum bedrooms") || lastA.includes("how many bedrooms"));

  // expecting "3" reply?
  const expectingBedsNumberOnly =
    !!seededPrev?.asked?.budgetBeds &&
    !seededPrev?.bedsMin &&
    // only enter this mode if we already have budget OR the assistant just asked for beds
    (!!seededPrev?.budgetMax || justAskedBudgetBeds);

  const budget = extractBudget(message);
  const type = extractType(message);
  const area = extractArea(message);
  const beds = extractBeds(message, expectingBedsNumberOnly);
  const musts = extractMustHaves(message);
  const deals = extractDealbreakers(message);
  const noPref = looksLikeNoPreference(message);

  const patch: Partial<HomeMatchState> = {};

  if (budget != null) patch.budgetMax = clamp(budget, 50_000, 25_000_000);
  if (beds != null) patch.bedsMin = clamp(beds, 1, 10);
  if (type) patch.propertyType = type;

  if (area) {
    patch.areaSlug = area.slug;
    patch.areaName = area.name;
    patch.areaLocked = true;
  } else if (noPref) {
    patch.areaSlug = undefined;
    patch.areaName = undefined;
    patch.areaLocked = false;
    patch.asked = { ...(patch.asked || {}), focusArea: true };
  }

  if (musts.length) {
    patch.mustHaves = musts;
    patch.asked = { ...(patch.asked || {}), mustHaveDealbreaker: true };
  }

  if (deals.length || /(no dealbreakers|none|nothing really)/i.test(message)) {
    patch.dealbreakers = deals;
    patch.asked = { ...(patch.asked || {}), mustHaveDealbreaker: true };
  }

  if (/(thats all|that's all|nothing else|no more|that’s it)/i.test(message)) {
    patch.asked = { ...(patch.asked || {}), mustHaveDealbreaker: true };
  }

  // Merge + final asked tightening
  const state = mergeState(seededPrev, patch);

  if (state.budgetMax && state.bedsMin) state.asked.budgetBeds = true;
  if (state.propertyType) state.asked.propertyType = true;
  if (area || noPref) state.asked.focusArea = true;

  // Decide next prompt (and set asked flags when we ask)
  const decision = decideNextPrompt(state, { lastAssistant: lastA, justAskedBudgetBeds });
  if (decision.askedPatch) {
    state.asked = { ...(state.asked || {}), ...(decision.askedPatch || {}) };
  }

  return { reply: decision.reply, state };
}
