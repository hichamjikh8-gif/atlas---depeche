import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { politeFetch } from "./fetch-utils";
import { fetchRssItems } from "./rss";

/**
 * Partner syndication — added 2026-11-05 at Hicham's request.
 *
 * Atlas Dépêche automatically republishes ONLY the articles of the two
 * sites Hicham owns: Souss Actualités and RexFoot. Each one appears on
 * Atlas Dépêche as title + photo + short excerpt + a visible "read more"
 * link back to the original (traffic goes to the original site; the full
 * text is not copied). Other radar sources are no longer imported (their
 * schedules are turned off in .github/workflows) — see CLAUDE.md.
 *
 * These are the owner's own publications, already edited and published by
 * a human there, so they skip the verify/write AI pipeline entirely (zero
 * Anthropic cost) and are recorded as publicationMode "human_only".
 */

export type PartnerLocale = "ar" | "fr";

export interface PartnerSite {
  id: "souss-actualites" | "rexfoot";
  name: { fr: string; ar: string };
  kind: "rss" | "news-sitemap";
  url: string;
  category: string;
  /** Fixed locale, or null to detect it per article from the title. */
  locale: PartnerLocale | null;
}

export const PARTNER_SITES: readonly PartnerSite[] = [
  {
    id: "souss-actualites",
    name: { fr: "Souss Actualités", ar: "سوس أكتواليتي" },
    kind: "rss",
    url: "https://souss-actualites.com/feed/",
    category: "news",
    locale: null,
  },
  {
    id: "rexfoot",
    name: { fr: "RexFoot", ar: "ريكس فوت" },
    kind: "news-sitemap",
    url: "https://rexfoot.com/news-sitemap.xml",
    category: "sports",
    locale: "fr",
  },
];

/** True unless the URL is clearly a video/audio file (feeds sometimes put an .mp4 in <enclosure>). */
export function isLikelyImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return !/\.(mp4|m4v|mov|webm|avi|mkv|mp3|m4a|wav|ogg)(\?|#|$)/i.test(url);
}

export interface PartnerItem {
  url: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  /** Direct video file attached to the original post (e.g. an .mp4 enclosure), shown on the article page. */
  videoUrl?: string | null;
  /** The partner site's own category names (Souss Actualités WordPress categories). */
  categories?: string[];
  publishedAt: Date | null;
}

const ARABIC = /[؀-ۿ]/;

export function detectLocale(text: string): PartnerLocale {
  return ARABIC.test(text) ? "ar" : "fr";
}

/** Stable dedup key stored in events.fingerprint — one event per original URL. */
export function partnerFingerprint(url: string): string {
  return `partner:${createHash("sha1").update(url.trim()).digest("hex")}`;
}

/** Collapse whitespace, drop WordPress "[…]" / "The post … appeared first on" tails, cap length on a word boundary. */
export function cleanExcerpt(raw: string | undefined | null, max = 320): string {
  if (!raw) return "";
  let text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/The post .* appeared first on .*$/s, "")
    .replace(/L’article .* est apparu en premier sur .*$/s, "")
    .replace(/\[(…|&#8230;|\.\.\.)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max) {
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }
  return text;
}

/** The Atlas Dépêche article body: excerpt + credited read-more link (Markdown link, see src/lib/article-format.tsx). */
export function buildPartnerBody(site: PartnerSite, item: PartnerItem, locale: PartnerLocale): string {
  const linkText =
    locale === "ar" ? `اقرأ المقال كاملاً على ${site.name.ar}` : `Lire l'article complet sur ${site.name.fr}`;
  const arrow = locale === "ar" ? "←" : "→";
  return [item.excerpt, `[${linkText} ${arrow}](${item.url})`].filter(Boolean).join("\n\n");
}

/** Parse a Google News sitemap (urlset with news:news entries). */
export function parseNewsSitemap(xml: string): Array<{ url: string; title: string; publishedAt: Date | null }> {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Array<{ url: string; title: string; publishedAt: Date | null }> = [];
  $("url").each((_, el) => {
    const url = $(el).find("loc").first().text().trim();
    const title = $(el).find("news\\:title").first().text().trim();
    const date = $(el).find("news\\:publication_date").first().text().trim();
    if (!url || !title) return;
    const parsed = date ? new Date(date) : null;
    out.push({ url, title, publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null });
  });
  return out;
}

/** og:description / og:image from an article page. */
export function parseArticleMeta(html: string): { description: string | null; image: string | null } {
  const $ = cheerio.load(html);
  const description =
    $('meta[property="og:description"]').attr("content") ?? $('meta[name="description"]').attr("content") ?? null;
  const image = $('meta[property="og:image"]').attr("content") ?? null;
  return { description: description?.trim() || null, image: image?.trim() || null };
}

export async function fetchPartnerItems(site: PartnerSite): Promise<PartnerItem[]> {
  if (site.kind === "rss") {
    const items = await fetchRssItems(site.url);
    const out: PartnerItem[] = [];
    for (const i of items) {
      let imageUrl = isLikelyImageUrl(i.imageUrl) ? i.imageUrl : null;
      // Souss Actualités' feed often carries no usable image (or a video in
      // <enclosure>) — fall back to the article page's own og:image.
      if (!imageUrl) {
        try {
          const og = parseArticleMeta(await politeFetch(i.url)).image;
          imageUrl = isLikelyImageUrl(og) ? og : null;
        } catch {
          // no photo then — the card shows a neutral placeholder
        }
      }
      out.push({
        url: i.url,
        title: i.title,
        excerpt: cleanExcerpt(i.summary),
        imageUrl,
        videoUrl: i.imageUrl && !isLikelyImageUrl(i.imageUrl) ? i.imageUrl : null,
        categories: i.categories,
        publishedAt: i.publishedAt ?? null,
      });
    }
    return out;
  }

  const entries = parseNewsSitemap(await politeFetch(site.url));
  const items: PartnerItem[] = [];
  for (const entry of entries) {
    let meta: { description: string | null; image: string | null } = { description: null, image: null };
    try {
      meta = parseArticleMeta(await politeFetch(entry.url));
    } catch {
      // Page unreachable — still publish title + link, just without excerpt/photo.
    }
    items.push({
      url: entry.url,
      title: entry.title,
      excerpt: cleanExcerpt(meta.description),
      imageUrl: isLikelyImageUrl(meta.image) ? meta.image : null,
      publishedAt: entry.publishedAt,
    });
  }
  return items;
}
