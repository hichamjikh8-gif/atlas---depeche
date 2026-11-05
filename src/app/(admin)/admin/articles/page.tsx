import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { articleSources, articles, events } from "@/db/schema";
import { renderArticleBody } from "@/lib/article-format";
import { approveEventArticles, correctArticle, createManualArticle } from "./actions";
import { RichEditor } from "./RichEditor";
import { MANUAL_CATEGORIES } from "./manual-categories";

export const metadata: Metadata = {
  title: "CMS Articles",
  robots: { index: false, follow: false },
};

/**
 * CMS v0 — protected by middleware (admin auth). Lets a human review
 * matching ar/fr drafts and approve them together. ASSISTED mode.
 */
export const dynamic = "force-dynamic";

async function getEventsWithArticles() {
  const rows = await db
    .select({
      eventId: events.id,
      eventTitle: events.title,
      eventCategory: events.category,
      eventConfidence: events.confidenceInternal,
      articleId: articles.id,
      locale: articles.locale,
      status: articles.status,
      title: articles.title,
      body: articles.body,
      imageUrl: articles.imageUrl,
      videoUrl: articles.videoUrl,
      slug: articles.slug,
      publicationMode: articles.publicationMode,
    })
    .from(articles)
    .innerJoin(events, eq(articles.eventId, events.id))
    .orderBy(desc(events.detectedAt));

  const byEvent = new Map<
    string,
    { eventTitle: string; eventCategory: string; eventConfidence: number | null; articles: typeof rows }
  >();

  for (const row of rows) {
    const existing = byEvent.get(row.eventId);
    if (existing) {
      existing.articles.push(row);
    } else {
      byEvent.set(row.eventId, {
        eventTitle: row.eventTitle,
        eventCategory: row.eventCategory,
        eventConfidence: row.eventConfidence,
        articles: [row],
      });
    }
  }

  return byEvent;
}

async function getSourceCount(articleId: string) {
  const rows = await db
    .select({ id: articleSources.id })
    .from(articleSources)
    .where(eq(articleSources.articleId, articleId));
  return rows.length;
}

async function getRecentEventsForManualWrite() {
  return db
    .select({ id: events.id, title: events.title, category: events.category, status: events.status })
    .from(events)
    .orderBy(desc(events.detectedAt))
    .limit(40);
}

export default async function AdminArticlesPage() {
  const byEvent = await getEventsWithArticles();
  const recentEvents = await getRecentEventsForManualWrite();

  const groups = await Promise.all(
    Array.from(byEvent.entries()).map(async ([eventId, group]) => ({
      eventId,
      ...group,
      articlesWithSources: await Promise.all(
        group.articles.map(async (a) => ({ ...a, sourceCount: await getSourceCount(a.articleId) })),
      ),
    })),
  );

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 1100 }}>
      <h1>CMS — drafts pending review</h1>
      <p>ASSISTED mode: approving publishes immediately to the public site.</p>

      <section style={{ border: "2px solid #2a6", borderRadius: 8, padding: "1rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Écrire un article / كتابة مقال</h2>
        <p style={{ fontSize: "0.9em", color: "#555" }}>
          Écrivez votre article et publiez-le directement — sans IA, gratuit. Choisissez
          « Article libre » pour écrire sur n&apos;importe quel sujet, ou rattachez-le à un
          événement détecté par le radar.
        </p>
        <form action={createManualArticle}>
          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Événement / الحدث :{" "}
              <select name="eventId" defaultValue="" style={{ width: "100%", padding: "0.4rem" }}>
                <option value="">✍ Article libre (sans événement) / مقال حر</option>
                {recentEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.category}/{e.status}] {e.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <label>
              Language:{" "}
              <select name="locale" required>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </label>{" "}
            <label style={{ marginInlineStart: "1rem" }}>
              Rubrique (article libre) :{" "}
              <select name="category" defaultValue="news">
                {MANUAL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label style={{ marginInlineStart: "1rem" }}>
              Lieu :{" "}
              <input name="location" placeholder="ex. Agadir" style={{ padding: "0.2rem 0.4rem" }} />
            </label>
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              name="title"
              placeholder="Article title"
              required
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <RichEditor name="body" required placeholder="Texte de l'article / نص المقال" />
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              name="imageUrl"
              type="url"
              placeholder="Photo URL (optionnel) — https://..."
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              name="videoUrl"
              type="url"
              placeholder="Vidéo URL (optionnel) — YouTube, Vimeo..."
              style={{ width: "100%", padding: "0.4rem" }}
            />
          </div>
          <button type="submit">Publish now</button>
        </form>
      </section>

      {groups.length === 0 && <p>No articles yet — run `npm run write:once`, or write one by hand above.</p>}

      {groups.map((g) => {
        const canApprove = g.articlesWithSources.some((a) => a.status === "draft" || a.status === "review");
        return (
          <section key={g.eventId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem" }}>
              {g.eventTitle} <span style={{ color: "#666", fontWeight: "normal" }}>({g.eventCategory}, confidence={g.eventConfidence ?? "?"}%)</span>
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {(["ar", "fr"] as const).map((locale) => {
                const article = g.articlesWithSources.find((a) => a.locale === locale);
                return (
                  <div key={locale} dir={locale === "ar" ? "rtl" : "ltr"} style={{ border: "1px solid #eee", padding: "0.75rem" }}>
                    <strong>{locale.toUpperCase()}</strong>
                    {!article && <p><em>not written yet</em></p>}
                    {article && (
                      <>
                        <div style={{ fontSize: "0.85em", color: "#666" }}>
                          status={article.status} · mode={article.publicationMode} · {article.sourceCount} source(s) cited
                        </div>
                        <h3>{article.title}</h3>
                        {article.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.imageUrl}
                            alt=""
                            style={{ maxWidth: "100%", maxHeight: 160, display: "block", marginBottom: "0.5rem" }}
                          />
                        )}
                        {article.videoUrl && (
                          <p style={{ fontSize: "0.85em" }}>
                            🎬 <a href={article.videoUrl} target="_blank" rel="noopener noreferrer">{article.videoUrl}</a>
                          </p>
                        )}
                        <div>{renderArticleBody(article.body)}</div>
                        {(article.status === "published" || article.status === "corrected") && (
                          <details>
                            <summary>Correct this article</summary>
                            <form action={correctArticle.bind(null, article.articleId)} style={{ marginTop: "0.5rem" }}>
                              <input
                                name="title"
                                defaultValue={article.title}
                                style={{ width: "100%", marginBottom: "0.5rem" }}
                              />
                              <div style={{ marginBottom: "0.5rem" }}>
                                <RichEditor name="body" defaultValue={article.body} rows={10} required />
                              </div>
                              <input
                                name="imageUrl"
                                type="url"
                                defaultValue={article.imageUrl ?? ""}
                                placeholder="Photo URL"
                                style={{ width: "100%", marginBottom: "0.5rem" }}
                              />
                              <input
                                name="videoUrl"
                                type="url"
                                defaultValue={article.videoUrl ?? ""}
                                placeholder="Vidéo URL"
                                style={{ width: "100%", marginBottom: "0.5rem" }}
                              />
                              <button type="submit">Save correction</button>
                            </form>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {canApprove && (
              <form action={approveEventArticles.bind(null, g.eventId)} style={{ marginTop: "0.75rem" }}>
                <button type="submit">Approve &amp; publish both (ar+fr)</button>
              </form>
            )}
          </section>
        );
      })}
    </main>
  );
}
