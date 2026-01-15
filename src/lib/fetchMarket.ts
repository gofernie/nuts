// File: src/lib/fetchMarket.ts
import { getJson } from "./fetchJson";

type MarketRow = Record<string, any>;

export async function getMarketRows(): Promise<MarketRow[]> {
  const url = import.meta.env.PUBLIC_NEIGHBOURHOOD_MARKET_JSON;
  if (!url) return [];

  const raw = await getJson<any>(url);
  const rs: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
        ? raw.rows
        : [];

  return rs;
}
