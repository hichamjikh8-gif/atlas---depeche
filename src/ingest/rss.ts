import Parser from "rss-parser";
import { politeFetch } from "./fetch-utils";
import type { RawItem } from "./types";

// media:content / media:thumbnail (MRSS namespace) aren't parsed by
// rss-parser by default — only the plain RSS `<enclosure>` is. Most Moroccan
// feeds (Hespress included) carry their photo as media:content, so both are
// requested here; whichever the feed actually uses, the mapping below picks
// the first that resolves to a usable URL.
const parser = new Parser<object, { mediaContent?: unknown; mediaThumbnail?: unknown }>({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

/**
 * xml2js renders a single occurrence of a namespaced tag as
 * `{ $: { url: "..." } }` and multiple occurrences as an array of those —
 * this normalizes either shape to the first attribute url found, without
 * assuming which shape a given feed will produce.
 */
function firstAttrUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const url = (candidate as { $?: { url?: string } })?.$?.url;
    if (url) return url;
  }
  return undefined;
}

/** Fallback for feeds with no enclosure/media tag: the first <img src> in
 *  the item's HTML content (content:encoded or description). */
function firstInlineImage(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

export async function fetchRssItems(feedUrl: string): Promise<RawItem[]> {
  const xml = await politeFetch(feedUrl);
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).map((item): RawItem => {
    const url = item.link ?? feedUrl;
    const imageUrl =
      (item.enclosure?.type?.startsWith("image/") ? item.enclosure.url : undefined) ??
      firstAttrUrl(item.mediaContent) ??
      firstAttrUrl(item.mediaThumbnail) ??
      item.enclosure?.url ??
      firstInlineImage(item.content) ??
      firstInlineImage(item.contentSnippet);

    return {
      externalId: item.guid ?? url,
      url,
      title: (item.title ?? "(untitled)").trim(),
      summary: item.contentSnippet?.trim() || item.content?.trim() || undefined,
      publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
      imageUrl,
      categories: Array.isArray(item.categories)
        ? item.categories.map((c) => (typeof c === "string" ? c : String((c as { _?: string })?._ ?? ""))).filter(Boolean)
        : undefined,
    };
  });
}
