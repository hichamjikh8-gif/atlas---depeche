import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  PARTNER_SITES,
  buildPartnerBody,
  detectLocale,
  fetchPartnerItems,
  partnerFingerprint,
} from "@/ingest/partners";
import { slugify } from "@/lib/slugify";

/**
 * One import pass over the partner sites (Souss Actualités + RexFoot) —
 * shared by the CLI worker (src/workers/partners.ts) and the in-process
 * scheduler (src/instrumentation.ts). See src/ingest/partners.ts.
 */
export interface PartnerImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

export async function runPartnerImport(
  options: { dryRun?: boolean; maxAgeDays?: number } = {},
): Promise<PartnerImportResult> {
  const DRY_RUN = options.dryRun ?? false;
  const MAX_AGE_DAYS = options.maxAgeDays ?? 7;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const site of PARTNER_SITES) {
    let items;
    try {
      items = await fetchPartnerItems(site);
    } catch (err) {
      failed++;
      console.error(`[partners] ${site.id}: fetch failed:`, err instanceof Error ? err.message : err);
      continue;
    }
    console.log(`[partners] ${site.id}: ${items.length} item(s) in feed`);

    // Oldest first, so publishedAt order on Atlas Dépêche matches the original.
    const fresh = items
      .filter((i) => !i.publishedAt || i.publishedAt.getTime() >= cutoff)
      .sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));

    for (const item of fresh) {
      const locale = site.locale ?? detectLocale(item.title);
      const fingerprint = partnerFingerprint(item.url);
      const body = buildPartnerBody(site, item, locale);

      if (DRY_RUN) {
        console.log(`  [dry-run] ${locale} | ${item.title}\n    ${item.url}\n    image=${item.imageUrl ?? "-"}`);
        continue;
      }

      try {
        const { db } = await import("@/db/client");
        const { events, articles, auditLogs } = await import("@/db/schema");
        const { transitionEvent } = await import("@/lib/event-state-machine");

        const existing = await db
          .select({ id: events.id })
          .from(events)
          .where(eq(events.fingerprint, fingerprint))
          .limit(1);
        if (existing.length > 0) {
          skipped++;
          // Backfill a photo found later (e.g. via og:image) onto an article imported without one.
          if (item.imageUrl) {
            await db
              .update(articles)
              .set({ imageUrl: item.imageUrl })
              .where(
                and(
                  eq(articles.eventId, existing[0]!.id),
                  or(isNull(articles.imageUrl), sql`${articles.imageUrl} ~* '\\.(mp4|m4v|mov|webm|mp3)$'`),
                ),
              );
          }
          if (item.videoUrl) {
            await db
              .update(articles)
              .set({ videoUrl: item.videoUrl })
              .where(and(eq(articles.eventId, existing[0]!.id), isNull(articles.videoUrl)));
          }
          continue;
        }

        const [event] = await db
          .insert(events)
          .values({
            title: item.title,
            category: site.category,
            status: "candidate",
            fingerprint,
            occurredAt: item.publishedAt ?? undefined,
          })
          .returning({ id: events.id });
        if (!event) throw new Error("event insert returned nothing");

        const slug = `${slugify(item.title) || "article"}-${event.id.slice(0, 8)}`;
        const [article] = await db
          .insert(articles)
          .values({
            eventId: event.id,
            locale,
            status: "published",
            title: item.title,
            slug,
            body,
            imageUrl: item.imageUrl,
            videoUrl: item.videoUrl ?? null,
            publicationMode: "human_only",
            publishedAt: item.publishedAt ?? new Date(),
          })
          .returning({ id: articles.id });
        if (!article) throw new Error("article insert returned nothing");

        await db.insert(auditLogs).values({
          entityType: "article",
          entityId: article.id,
          action: "partner_import",
          actorType: "system",
          details: { partner: site.id, sourceUrl: item.url, locale },
        });

        await transitionEvent({
          db,
          eventId: event.id,
          from: "candidate",
          to: "published",
          actorType: "system",
          reason: `partner import from ${site.name.fr} (owner's own publication)`,
        });

        imported++;
        console.log(`  + ${locale} | ${item.title}`);
      } catch (err) {
        failed++;
        console.error(`  ! ${item.url}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`[partners] done: ${imported} imported, ${skipped} already there, ${failed} error(s)${DRY_RUN ? " (dry run)" : ""}`);
  return { imported, skipped, failed };
}

/**
 * "Only Souss Actualités + RexFoot" (Hicham, 2026-11-05): every external
 * radar source in the `sources` table is set to `paused`, so the radar
 * worker (src/workers/radar.ts, which only polls `active` sources) imports
 * nothing more — even if a radar cron is still scheduled elsewhere.
 * Nothing is deleted; to bring a source back, set its status to "active"
 * and set PARTNERS_ONLY=false so this doesn't pause it again.
 */
export async function pauseRadarSources(): Promise<number> {
  if (process.env.PARTNERS_ONLY === "false") return 0;
  const { db } = await import("@/db/client");
  const { sources } = await import("@/db/schema");
  const paused = await db
    .update(sources)
    .set({ status: "paused" })
    .where(eq(sources.status, "active"))
    .returning({ id: sources.id });
  if (paused.length > 0) console.log(`[partners] paused ${paused.length} external radar source(s)`);
  return paused.length;
}
