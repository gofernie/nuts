// src/lib/sheets.ts

const PUB_ID = import.meta.env.PUBLIC_SHEETS_ID;
const USE_TEST = import.meta.env.PUBLIC_USE_TEST_DATA === "true";

const GIDS: Record<string, string | undefined> = {
  issues: USE_TEST ? import.meta.env.PUBLIC_GID_ISSUES_TEST : import.meta.env.PUBLIC_GID_ISSUES,
  signals: USE_TEST ? import.meta.env.PUBLIC_GID_SIGNALS_TEST : import.meta.env.PUBLIC_GID_SIGNALS,
  sections: USE_TEST ? import.meta.env.PUBLIC_GID_SECTIONS_TEST : import.meta.env.PUBLIC_GID_SECTIONS,
  issue_index: USE_TEST
    ? import.meta.env.PUBLIC_GID_ISSUE_INDEX_TEST
    : import.meta.env.PUBLIC_GID_ISSUE_INDEX,

  // In test mode, point this at your gridexport_3yrx gid
  sales: USE_TEST ? import.meta.env.PUBLIC_GID_SALES_TEST : import.meta.env.PUBLIC_GID_SALES,

  game_cards: USE_TEST
    ? import.meta.env.PUBLIC_GID_GAME_CARDS_TEST
    : import.meta.env.PUBLIC_GID_GAME_CARDS,
};

function expectedEnvName(sheetName: string) {
  const key = sheetName.toUpperCase();
  return USE_TEST ? `PUBLIC_GID_${key}_TEST` : `PUBLIC_GID_${key}`;
}

function sheetCsvUrl(sheetName: string) {
  const gid = GIDS[sheetName];
  if (!gid) {
    throw new Error(
      `Missing ${expectedEnvName(sheetName)} for "${sheetName}". Add it to your env vars using the gid from that tab URL.`
    );
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    PUB_ID
  )}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every((v) => (v ?? "").trim() === "")) rows.pop();
  if (!rows.length) return [];

  const headers = rows[0].map((h) => (h ?? "").trim());
  const data = rows.slice(1);

  return data
    .filter((r) => r.some((v) => (v ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

export async function fetchSheet<T extends Record<string, string>>(sheetName: string): Promise<T[]> {
  if (!PUB_ID) throw new Error("Missing PUBLIC_SHEETS_ID in env vars");

  const url = sheetCsvUrl(sheetName);
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch sheet "${sheetName}" - ${res.status} ${res.statusText}\n` +
        `URL: ${url}\n\n` +
        text
    );
  }

  const csv = await res.text();

  if (csv.trim().startsWith("<!DOCTYPE html")) {
    throw new Error(
      `Google returned HTML for "${sheetName}". Usually this means the sheet is not published or not publicly readable.\nURL: ${url}`
    );
  }

  return parseCsv(csv) as T[];
}

export type GameCard = {
  address: string;
  listPrice: number;
  soldPrice: number;
  result: "over" | "at" | "under";
  image: string;
  insight: string;
  active: boolean;
};

type GameCardRow = {
  address?: string;
  list_price?: string;
  sold_price?: string;
  image?: string;
  insight?: string;
  active?: string;
};

function parseMoney(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getGameResult(listPrice: number, soldPrice: number): "over" | "at" | "under" {
  if (soldPrice > listPrice) return "over";
  if (soldPrice < listPrice) return "under";
  return "at";
}

function isTruthy(value: unknown): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export async function fetchGameCards(): Promise<GameCard[]> {
  const rows = await fetchSheet<GameCardRow>("game_cards");

  return rows
    .filter((row) => isTruthy(row.active))
    .map((row) => {
      const listPrice = parseMoney(row.list_price);
      const soldPrice = parseMoney(row.sold_price);

      return {
        address: String(row.address ?? "").trim(),
        listPrice,
        soldPrice,
        result: getGameResult(listPrice, soldPrice),
        image: String(row.image ?? "").trim(),
        insight: String(row.insight ?? "").trim(),
        active: true,
      };
    })
    .filter(
      (row) =>
        !!row.address &&
        !!row.image &&
        row.listPrice > 0 &&
        row.soldPrice > 0
    );
}

export type Issue = {
  slug: string;
  number?: string;
  date?: string;
  readTime?: string;
  title?: string;
  dek?: string;
  pulseIntro?: string;
  closing_tone_line?: string;
  sales_game_cards?: string;
  latest_new_listings?: string;
  latest_price_cuts?: string;
  price_cut_watch_cards?: string;
  price_cut_watch?: string;
  hero_stats_json?: string;
  hero_new_listings_note?: string;
  hero_sales_note?: string;
  hero_absorption_note?: string;
  hero_median_sold_note?: string;
  detached_sales_90d?: string;
  condo_sales_90d?: string;
  townhome_sales_90d?: string;
  land_sales_90d?: string;
  other_sales_90d?: string;
  sales_mix_90d?: string;
  signals: string[];
  sections: { h: string; html: string; tone?: string }[];
};

export async function fetchIssuesJoined(): Promise<Issue[]> {
  const [issuesRes, signalsRes, sectionsRes, indexRes] = await Promise.allSettled([
    fetchSheet<any>("issues"),
    fetchSheet<any>("signals"),
    fetchSheet<any>("sections"),
    fetchSheet<any>("issue_index"),
  ]);

  if (issuesRes.status === "rejected") throw issuesRes.reason;
  if (signalsRes.status === "rejected") throw signalsRes.reason;
  if (sectionsRes.status === "rejected") throw sectionsRes.reason;

  const issuesRaw = issuesRes.value;
  const signalsRaw = signalsRes.value;
  const sectionsRaw = sectionsRes.value;

  const issueIndexRaw = indexRes.status === "fulfilled" ? indexRes.value : [];
  if (indexRes.status === "rejected") {
    console.warn(
      `[sheets] issue_index fetch failed - falling back to sorting by issue number.\n${String(
        indexRes.reason?.message ?? indexRes.reason
      )}`
    );
  }

  const signalsById = new Map<string, { order: number; text: string }[]>();
  for (const s of signalsRaw) {
    const id = String(s.issue_id || s.slug || "").trim();
    const text = String(s.text || "").trim();
    if (!id || !text) continue;
    const order = Number(s.order || s.sort || 0);
    const list = signalsById.get(id) ?? [];
    list.push({ order, text });
    signalsById.set(id, list);
  }
  for (const [, list] of signalsById) list.sort((a, b) => (a.order || 0) - (b.order || 0));

  const sectionsById = new Map<string, { order: number; h: string; html: string; tone?: string }[]>();
  for (const s of sectionsRaw) {
    const id = String(s.issue_id || s.slug || "").trim();
    if (!id) continue;
    const h = String(s.heading || s.h || "").trim();
    const html = String(s.html || "").trim();
    const tone = String(s.tone || "").trim() || undefined;
    if (!h && !html) continue;

    const order = Number(s.order || s.sort || 0);
    const list = sectionsById.get(id) ?? [];
    list.push({ order, h, html, tone });
    sectionsById.set(id, list);
  }
  for (const [, list] of sectionsById) list.sort((a, b) => (a.order || 0) - (b.order || 0));

  const orderBySlug = new Map<string, number>();
  for (const r of issueIndexRaw) {
    const slug = String(r.slug || "").trim();
    if (!slug) continue;
    orderBySlug.set(slug, Number(r.order || r.sort || 9999));
  }

  const issues: (Issue & { _order: number | null })[] = issuesRaw
    .map((i: any) => {
      const slug = String(i.slug || i.issue_id || "").trim();
      if (!slug) return null;

      const issueId = String(i.issue_id || slug).trim();

      return {
        slug,
        number: String(i.number || slug).trim(),
        date: String(i.date || "").trim(),
        readTime: String(i.readTime || i.read_time || "").trim(),
        title: String(i.title || "").trim(),
        dek: String(i.dek || "").trim(),
        pulseIntro: String(i.pulseIntro || i.pulse_intro || "").trim(),
        closing_tone_line: String(i.closing_tone_line || i.closingToneLine || "").trim(),
        sales_game_cards: String(i.sales_game_cards || i.salesGameCards || "").trim(),
        latest_new_listings: String(i.latest_new_listings || i.latestNewListings || "").trim(),
        latest_price_cuts: String(i.latest_price_cuts || i.latestPriceCuts || "").trim(),
        price_cut_watch_cards: String(i.price_cut_watch_cards || i.priceCutWatchCards || "").trim(),
        price_cut_watch: String(i.price_cut_watch || i.priceCutWatch || "").trim(),
        hero_stats_json: String(i.hero_stats_json || i.heroStatsJson || "").trim(),
        hero_new_listings_note: String(i.hero_new_listings_note || i.heroNewListingsNote || "").trim(),
        hero_sales_note: String(i.hero_sales_note || i.heroSalesNote || "").trim(),
        hero_absorption_note: String(i.hero_absorption_note || i.heroAbsorptionNote || "").trim(),
        hero_median_sold_note: String(i.hero_median_sold_note || i.heroMedianSoldNote || "").trim(),
        detached_sales_90d: String(i.detached_sales_90d || "").trim(),
        condo_sales_90d: String(i.condo_sales_90d || "").trim(),
        townhome_sales_90d: String(i.townhome_sales_90d || "").trim(),
        land_sales_90d: String(i.land_sales_90d || "").trim(),
        other_sales_90d: String(i.other_sales_90d || "").trim(),
        sales_mix_90d: String(i.sales_mix_90d || "").trim(),
        signals: (signalsById.get(issueId) ?? signalsById.get(slug) ?? []).map((x) => x.text),
        sections: (sectionsById.get(issueId) ?? sectionsById.get(slug) ?? []).map((x) => ({
          h: x.h,
          html: x.html,
          tone: x.tone,
        })),
        _order: orderBySlug.has(slug) ? (orderBySlug.get(slug) as number) : null,
      };
    })
    .filter(Boolean) as (Issue & { _order: number | null })[];

  const hasIndex = issues.some((x) => x._order !== null);
  if (hasIndex) issues.sort((a, b) => (a._order ?? 9999) - (b._order ?? 9999));
  else issues.sort((a, b) => Number(b.number || 0) - Number(a.number || 0));

  return issues.map(({ _order, ...rest }) => rest);
}