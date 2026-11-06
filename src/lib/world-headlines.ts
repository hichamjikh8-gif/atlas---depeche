import Parser from "rss-parser";
import { politeFetch } from "@/ingest/fetch-utils";

/**
 * World headlines for the "EN DIRECT" ticker — added 2026-11-06 at
 * Hicham's request. Titles only, each linking to the ORIGINAL article on the
 * source site (nothing is copied or published as an Atlas Dépêche article).
 * Only items published in the last 24 hours are shown; older ones drop out
 * on their own. Fetched server-side, cached in memory for 10 minutes.
 */
export interface WorldHeadline {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
}

interface Feed {
  source: string;
  url: string;
}

export const WORLD_FEEDS: Record<"fr" | "ar", readonly Feed[]> = {
  fr: [
    { source: "France 24", url: "https://www.france24.com/fr/rss" },
    { source: "RFI", url: "https://www.rfi.fr/fr/rss" },
    { source: "Le Monde", url: "https://www.lemonde.fr/international/rss_full.xml" },
    { source: "BBC Afrique", url: "https://www.bbc.com/afrique/index.xml" },
  ],
  ar: [
    { source: "فرانس 24", url: "https://www.france24.com/ar/rss" },
    { source: "بي بي سي عربي", url: "https://feeds.bbci.co.uk/arabic/rss.xml" },
    {
      source: "الجزيرة",
      url: "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9",
    },
  ],
};

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 10 * 60 * 1000;
const PER_SOURCE = 8;
const TOTAL = 30;

const parser = new Parser();

/** Keep only last-24h items with a real date, newest first, de-duplicated, capped per source. */
export function selectRecentHeadlines(items: WorldHeadline[], now = Date.now()): WorldHeadline[] {
  const seen = new Set<string>();
  const perSource = new Map<string, number>();
  return items
    .filter((i) => {
      const t = i.publishedAt.getTime();
      return Number.isFinite(t) && t <= now + 5 * 60 * 1000 && now - t <= MAX_AGE_MS;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter((i) => {
      const key = i.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      const n = perSource.get(i.source) ?? 0;
      if (n >= PER_SOURCE) return false;
      seen.add(key);
      perSource.set(i.source, n + 1);
      return true;
    })
    .slice(0, TOTAL);
}

async function fetchFeed(feed: Feed): Promise<WorldHeadline[]> {
  const xml = await politeFetch(feed.url, { timeoutMs: 8000 });
  const parsed = await parser.parseString(xml);
  return (parsed.items ?? [])
    .filter((i) => i.title && i.link && (i.isoDate || i.pubDate))
    .map((i) => ({
      id: `${feed.source}:${i.guid ?? i.link}`,
      title: i.title!.replace(/\s+/g, " ").trim(),
      url: i.link!,
      source: feed.source,
      publishedAt: new Date(i.isoDate ?? i.pubDate!),
    }))
    .filter((i) => /^https?:\/\//.test(i.url));
}

const cache = new Map<string, { at: number; items: WorldHeadline[] }>();
const inflight = new Map<string, Promise<WorldHeadline[]>>();

async function refresh(locale: "fr" | "ar"): Promise<WorldHeadline[]> {
  const results = await Promise.allSettled(WORLD_FEEDS[locale].map(fetchFeed));
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const items = selectRecentHeadlines(all);
  // Keep the previous list if every feed failed this time.
  if (items.length > 0 || !cache.has(locale)) cache.set(locale, { at: Date.now(), items });
  return cache.get(locale)!.items;
}

export async function getWorldHeadlines(locale: "fr" | "ar"): Promise<WorldHeadline[]> {
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    // Re-filter on read so nothing older than 24h is ever shown, even from cache.
    return selectRecentHeadlines(hit.items);
  }
  let p = inflight.get(locale);
  if (!p) {
    p = refresh(locale).finally(() => inflight.delete(locale));
    inflight.set(locale, p);
  }
  // A stale list is served immediately while the refresh runs; first load waits (max ~8s).
  if (hit) return selectRecentHeadlines(hit.items);
  return p.catch(() => []);
}
