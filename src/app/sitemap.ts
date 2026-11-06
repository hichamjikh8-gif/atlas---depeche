import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { RUBRIQUES } from "@/lib/rubriques";
import { getSiteUrl } from "@/lib/site-url";

// Rendered per request (reads the DB), never at build time — the build has no database.
export const dynamic = "force-dynamic";

/**
 * Sitemap: home + legal pages per locale, plus every published article
 * (Souss Actualités / RexFoot imports and hand-written ones). Updated
 * 2026-11-05 so Google can discover the articles directly.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = getSiteUrl();

  const staticPages: MetadataRoute.Sitemap = SUPPORTED_LOCALES.flatMap((locale) => [
    { url: `${SITE_URL}/${locale}`, lastModified: new Date(), changeFrequency: "hourly" as const, priority: 1.0 },
    { url: `${SITE_URL}/${locale}/legal/mentions`, changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${SITE_URL}/${locale}/legal/privacy`, changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${SITE_URL}/${locale}/legal/corrections`, changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${SITE_URL}/${locale}/contact`, changeFrequency: "monthly" as const, priority: 0.3 },
    ...RUBRIQUES.map((r) => ({
      url: `${SITE_URL}/${locale}/rubrique/${r.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
  ]);

  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const { db } = await import("@/db/client");
    const { articles } = await import("@/db/schema");
    const { desc, inArray } = await import("drizzle-orm");
    const rows = await db
      .select({
        locale: articles.locale,
        slug: articles.slug,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(inArray(articles.status, ["published", "corrected"]))
      .orderBy(desc(articles.publishedAt))
      .limit(5000);
    articlePages = rows.map((r) => ({
      url: `${SITE_URL}/${r.locale}/${r.slug}`,
      lastModified: r.updatedAt ?? r.publishedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.error("[sitemap] could not list articles:", err instanceof Error ? err.message : err);
  }

  return [...staticPages, ...articlePages];
}
