"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { articles, articleVersions, auditLogs, events } from "@/db/schema";
import { transitionEvent } from "@/lib/event-state-machine";
import { slugify } from "@/lib/slugify";
import { requireAdminSession } from "@/lib/require-admin";
import { MANUAL_CATEGORY_VALUES } from "./manual-categories";

/**
 * ASSISTED mode's human-approval step (MASTER_PROMPT section 11) — and,
 * for v0, the publish gate itself: in ASSISTED mode "prepare content,
 * require human approval" IS the authorization to go live, so approving
 * here sets status "published" + publishedAt directly rather than adding a
 * separate manual publish click. Only moves articles still draft/review —
 * never re-touches anything already approved/published/rejected/archived.
 * No auth yet (see CLAUDE.md — Security): this is safe only because
 * nothing here is deployed.
 */
export async function approveEventArticles(eventId: string) {
  await requireAdminSession();
  await db
    .update(articles)
    .set({ status: "published", publishedAt: sql`now()` })
    .where(and(eq(articles.eventId, eventId), inArray(articles.status, ["draft", "review"])));

  // confirmed -> published on the event itself — the human-approval
  // equivalent of write.ts's automated-path transition. A second approval
  // click (nothing left to move) correctly no-ops here.
  await transitionEvent({
    db,
    eventId,
    from: "confirmed",
    to: "published",
    actorType: "human",
    reason: "approved in /admin/articles",
  });

  revalidatePath("/admin/articles");
  revalidatePath("/[locale]", "layout");
}

/**
 * HUMAN_ONLY manual publish — added 2026-09-18. A human picks a real,
 * already-collected event and writes+publishes an article by hand, no AI
 * involved at all (no Anthropic cost). Requested directly by Hicham after
 * he paused all AI spend but still wanted a real way to get real articles
 * live. Skips straight from the event's current status to "published" —
 * see event-state-machine.ts's "candidate -> published" exception, added
 * specifically for this path.
 */
export async function createManualArticle(formData: FormData) {
  await requireAdminSession();
  const eventIdRaw = formData.get("eventId");
  const locale = formData.get("locale");
  const title = formData.get("title");
  const body = formData.get("body");
  const imageUrlRaw = formData.get("imageUrl");
  const videoUrlRaw = formData.get("videoUrl");
  const categoryRaw = formData.get("category");
  const locationRaw = formData.get("location");
  const imageUrl = typeof imageUrlRaw === "string" && imageUrlRaw.trim() ? imageUrlRaw.trim() : null;
  const videoUrl = typeof videoUrlRaw === "string" && videoUrlRaw.trim() ? videoUrlRaw.trim() : null;

  if (locale !== "ar" && locale !== "fr") return;
  if (typeof title !== "string" || !title.trim()) return;
  if (typeof body !== "string" || !body.trim()) return;

  // "Article libre" — no radar event picked. Every article belongs to an
  // event (one event -> one article per locale), so create a dedicated
  // event for it, authored by a human. Added 2026-11-05 at Hicham's
  // request: write about any subject, WordPress-style, without first
  // needing the radar to have collected it.
  let eventId = typeof eventIdRaw === "string" ? eventIdRaw.trim() : "";
  if (!eventId) {
    const category =
      typeof categoryRaw === "string" && MANUAL_CATEGORY_VALUES.has(categoryRaw) ? categoryRaw : "news";
    const location = typeof locationRaw === "string" && locationRaw.trim() ? locationRaw.trim() : null;
    const [created] = await db
      .insert(events)
      .values({ title: title.trim(), category, location, status: "candidate" })
      .returning({ id: events.id });
    if (!created) return;
    eventId = created.id;
    await db.insert(auditLogs).values({
      entityType: "event",
      entityId: eventId,
      action: "manual_event_create",
      actorType: "human",
      details: { category, location, reason: "free article written in CMS (no radar event)" },
    });
  }

  const [event] = await db
    .select({ id: events.id, status: events.status })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return;

  const existing = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.eventId, eventId), eq(articles.locale, locale)))
    .limit(1);
  if (existing.length > 0) return; // one article per event+locale — edit via "Correct this article" instead

  const slugBase = slugify(title);
  const slug = `${slugBase || "article"}-${eventId.slice(0, 8)}`;

  const [article] = await db
    .insert(articles)
    .values({
      eventId,
      locale,
      status: "published",
      title,
      slug,
      body,
      imageUrl,
      videoUrl,
      publicationMode: "human_only",
      publishedAt: sql`now()`,
    })
    .returning({ id: articles.id });
  if (!article) return;

  await db.insert(articleVersions).values({
    articleId: article.id,
    version: 1,
    title,
    body,
    editedBy: "human",
  });

  await db.insert(auditLogs).values({
    entityType: "article",
    entityId: article.id,
    action: "manual_publish",
    actorType: "human",
    details: { eventId, locale },
  });

  if (event.status === "candidate" || event.status === "confirmed") {
    await transitionEvent({
      db,
      eventId,
      from: event.status,
      to: "published",
      actorType: "human",
      reason: "hand-written article published directly (HUMAN_ONLY, no AI)",
    });
  }

  revalidatePath("/admin/articles");
  revalidatePath("/[locale]", "layout");
}

/**
 * Right-of-reply / corrections as a first-class CMS state — MASTER_PROMPT
 * section 36. Only touches an article that is already published/corrected
 * (never silently "corrects" a draft — that's just editing). Every
 * correction is versioned (article_versions) and logged (audit_logs) with
 * the previous text, so nothing is corrected silently — see
 * docs — legal/corrections page describes this same workflow publicly.
 */
/**
 * Takes an article off the public site (status "archived") without deleting
 * it — added 2026-11-05 (e.g. to remove a duplicate). Logged in audit_logs.
 */
export async function unpublishArticle(articleId: string) {
  await requireAdminSession();
  const [article] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article || (article.status !== "published" && article.status !== "corrected")) return;
  await db.update(articles).set({ status: "archived", updatedAt: sql`now()` }).where(eq(articles.id, articleId));
  await db.insert(auditLogs).values({
    entityType: "article",
    entityId: articleId,
    action: "unpublished",
    actorType: "human",
    details: { previousStatus: article.status },
  });
  revalidatePath("/admin/articles");
  revalidatePath("/[locale]", "layout");
}

/**
 * Permanently deletes an article (cascade: versions, sources, social posts).
 * The audit_logs row keeps a copy of the title/body. The parent event is
 * kept, so a deleted partner import is not re-imported (same fingerprint).
 */
export async function deleteArticle(articleId: string) {
  await requireAdminSession();
  const [article] = await db
    .select({ title: articles.title, body: articles.body, locale: articles.locale, status: articles.status })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) return;
  await db.insert(auditLogs).values({
    entityType: "article",
    entityId: articleId,
    action: "deleted",
    actorType: "human",
    details: { title: article.title, body: article.body, locale: article.locale, status: article.status },
  });
  await db.delete(articles).where(eq(articles.id, articleId));
  revalidatePath("/admin/articles");
  revalidatePath("/[locale]", "layout");
}

export async function correctArticle(articleId: string, formData: FormData) {
  await requireAdminSession();
  const newTitle = formData.get("title");
  const newBody = formData.get("body");
  const imageUrlRaw = formData.get("imageUrl");
  const videoUrlRaw = formData.get("videoUrl");
  // "Modification mineure" (added 2026-11-05): an editorial touch-up (style,
  // wording, layout) rather than a factual correction — still versioned and
  // audit-logged, but the article keeps its status, so no public
  // "corrigé le…" notice. Real factual corrections must leave it unchecked.
  const minor = formData.get("minor") === "on";
  // Lets the editor take back a "corrigé le…" notice set by mistake (e.g. a
  // style edit saved without ticking "Modification mineure"). Only with minor.
  const removeNotice = minor && formData.get("removeNotice") === "on";
  const newImageUrl = typeof imageUrlRaw === "string" && imageUrlRaw.trim() ? imageUrlRaw.trim() : null;
  const newVideoUrl = typeof videoUrlRaw === "string" && videoUrlRaw.trim() ? videoUrlRaw.trim() : null;
  if (typeof newTitle !== "string" || typeof newBody !== "string" || !newTitle.trim() || !newBody.trim()) {
    return;
  }

  const [article] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article || (article.status !== "published" && article.status !== "corrected")) {
    return;
  }

  const [versionRow] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${articleVersions.version}), 0)` })
    .from(articleVersions)
    .where(eq(articleVersions.articleId, articleId));

  await db.insert(articleVersions).values({
    articleId,
    version: (versionRow?.maxVersion ?? 0) + 1,
    title: newTitle,
    body: newBody,
    editedBy: "human",
  });

  await db
    .update(articles)
    .set({
      title: newTitle,
      body: newBody,
      imageUrl: newImageUrl,
      videoUrl: newVideoUrl,
      ...(minor ? (removeNotice ? { status: "published" } : {}) : { status: "corrected" }),
      updatedAt: sql`now()`,
    })
    .where(eq(articles.id, articleId));

  await db.insert(auditLogs).values({
    entityType: "article",
    entityId: articleId,
    action: minor ? (removeNotice ? "minor_edit_notice_removed" : "minor_edit") : "corrected",
    actorType: "human",
    details: { previousTitle: article.title, previousBody: article.body },
  });

  // published -> updated the first correction; updated -> updated (a valid
  // self-loop, see event-state-machine.ts) every correction after that —
  // read the event's current status rather than assume, since a second
  // correction on the same event would otherwise try an illegal
  // published -> updated transition it's no longer in.
  const [currentEvent] = await db
    .select({ status: events.status })
    .from(events)
    .where(eq(events.id, article.eventId))
    .limit(1);
  if (currentEvent && !minor) {
    await transitionEvent({
      db,
      eventId: article.eventId,
      from: currentEvent.status === "updated" ? "updated" : "published",
      to: "updated",
      actorType: "human",
      reason: "article corrected",
    });
  }

  revalidatePath("/admin/articles");
  revalidatePath("/[locale]", "layout");
}
