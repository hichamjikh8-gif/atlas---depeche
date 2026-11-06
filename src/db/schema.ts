/**
 * Phase 0 schema — just enough to prove the migration pipeline and to give
 * later phases (ingest, verification, editorial) a real foundation.
 *
 * Full model (claims, evidence, agent_runs, audit_logs, etc. — see
 * docs/MASTER_PROMPT.md section 15) lands incrementally in Phase 1/2.
 */
export * from "./schema-advertising"; // advertising tables — isolated module, no FK to editorial
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- sources ---------------------------------------------------------

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(), // rss | api | html | html_list | document | social | x
    url: text("url").notNull(),
    language: text("language").notNull(), // ar | fr | en
    country: text("country").notNull().default("MA"),
    category: text("category"),
    pollingFrequencySeconds: integer("polling_frequency_seconds"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),
    status: text("status").notNull().default("active"), // active | paused | error
    robotsPolicy: text("robots_policy"),
    tosNotes: text("tos_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sources_url_idx").on(table.url),
    index("sources_status_idx").on(table.status),
  ],
);

// --- events ------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    location: text("location"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    // Time window during which this event's facts are considered current —
    // e.g. a weather alert valid today only, or a temporary road closure.
    // Null/null means "no defined validity window" (most news events).
    // Added 2026-09-18 (architecture add-on Addition 4, temporal knowledge)
    // — no connector populates these yet, reserved for future time-bound
    // sources (weather bulletins).
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    // See src/lib/event-state-machine.ts for the full state vocabulary and
    // legal transitions — this text column is intentionally unconstrained
    // at the DB level (matches this schema's existing style for status-like
    // fields), validated at the application layer via transitionEvent().
    // candidate | verifying | confirmed | conflicted | rejected | published
    // | updated | resolved | superseded | archived
    status: text("status").notNull().default("candidate"),
    // breaking | developing | important | routine
    priority: text("priority").notNull().default("routine"),
    confidenceInternal: integer("confidence_internal"),
    // How many concerns the Adversarial Agent raised (any severity) on
    // this event's most recent verdict — 0 means a clean pass. Null until
    // verify has actually run. Phase 6's confidence-based automation path
    // (src/lib/automation-policy.ts) requires this to be exactly 0, not
    // just "no high-severity" ones — zero tolerance for that path.
    adversarialConcernCount: integer("adversarial_concern_count"),
    // sha1(category + normalized title) — see src/ingest/normalize.ts.
    // Used by the radar's dedup engine to decide "new event" vs "attach to
    // this one". Nullable because non-radar event creation (Phase 2+) may
    // not always populate it the same way.
    fingerprint: text("fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_detected_at_idx").on(table.detectedAt),
    index("events_status_idx").on(table.status),
    index("events_category_idx").on(table.category),
    index("events_fingerprint_idx").on(table.fingerprint),
  ],
);

// --- source_items (raw radar ingest, pre-event) -------------------------

export const sourceItems = pgTable(
  "source_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    // RSS guid/link, or sha256(page text) for the generic HTML connector.
    // Unique per source so re-polling an unchanged item/page is a no-op
    // (upsert just touches fetchedAt) instead of creating a duplicate.
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    // og:image (HTML sources) or RSS enclosure/media:content/first inline
    // <img> (RSS sources) — the photo shown on the free-aggregator homepage
    // card. Null when the source/article has none; the card falls back to
    // a plain text layout in that case, never a fabricated placeholder.
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // sha256(normalized title + summary) at ingest time — lets a future
    // re-poll of the "same" externalId detect that the source silently
    // edited the content (title/summary aren't otherwise mutated once
    // created — see radar.ts). Added 2026-09-18 (architecture add-on
    // Addition 4: "immutable observations ... content hash").
    contentHash: text("content_hash"),
    // Which connector code produced this row, e.g. "rss@1", "html_list@1"
    // — added 2026-09-18 (Addition 4: "connector version"), for future
    // debugging when a connector's extraction logic changes.
    connectorVersion: text("connector_version"),
    // original | same_wire_copy | cites | republishes | same_official_statement
    // — null means "not yet classified" (distinct from "original", which is
    // a positive claim of independence). Added 2026-09-18 (architecture
    // add-on Addition 1: source independence and lineage) — populated by
    // src/ingest/dedup.ts's lineage heuristic when a second+ item attaches
    // to an already-existing event; the FIRST item on an event is always
    // "original" (nothing to compare it against yet).
    lineageType: text("lineage_type"),
    // The id of the earlier source_items row this one was classified as a
    // copy/derivative of, when lineageType isn't "original". Not an
    // enforced FK (kept a plain uuid to avoid self-referential migration
    // ordering complexity for what is an informational-only pointer);
    // nullable because most rows either are original or aren't classified.
    derivedFromSourceItemId: uuid("derived_from_source_item_id"),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    // Manual moderation (src/app/(admin)/admin/moderate): set when the
    // admin removes an item from the public aggregator/Instagram-eligible
    // pool. Not a delete — keeps the row (and its social_posts history if
    // already posted) for audit, just excluded from
    // getFilteredRadarItems (public-site.ts) going forward.
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("source_items_source_external_idx").on(
      table.sourceId,
      table.externalId,
    ),
    index("source_items_event_id_idx").on(table.eventId),
    index("source_items_fetched_at_idx").on(table.fetchedAt),
    // getFilteredRadarItems (public-site.ts — every homepage/ticker/
    // Instagram-worker request) sorts by coalesce(published_at,
    // fetched_at), not fetched_at alone. Without an index matching that
    // exact expression, Postgres can't use the plain fetched_at index to
    // satisfy the ORDER BY and has to sort the matched rows itself on
    // every request — fine today, gets slower as source_items grows.
    // Added 2026-09-19 alongside the retention cleanup (src/workers/
    // cleanup.ts) so growth is bounded on both fronts, not just one.
    index("source_items_sort_idx").on(
      sql`coalesce(${table.publishedAt}, ${table.fetchedAt})`,
    ),
  ],
);

// --- articles ------------------------------------------------------------

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(), // ar | fr
    // draft | verifying | verified | review | approved | published |
    // updated | corrected | archived
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    // breaking | standard | mobile | social | seo -> headline text. See the
    // Headline Agent, MASTER_PROMPT section 7 — titles must stay faithful
    // to verified facts, no bait, so these are generated alongside `title`
    // by the same writer call, not a separate unconstrained pass.
    headlines: jsonb("headlines").$type<Record<string, string>>(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    // Cover photo URL for the article page — added 2026-09-20, requested
    // directly ("donde anado la foto"). A plain public URL, same pattern
    // as source_items.imageUrl elsewhere in the app — no upload/storage
    // bucket exists, so there's nothing to upload TO yet.
    imageUrl: text("image_url"),
    // Optional video to embed below the body — a YouTube/Vimeo URL.
    // [locale]/[slug]/page.tsx converts a plain watch URL to an embeddable
    // one; anything it doesn't recognize renders as a plain link instead.
    videoUrl: text("video_url"),
    // shadow | assisted | automated | human_only — the mode this article
    // was produced under, for audit (see src/lib/publication-mode.ts).
    publicationMode: text("publication_mode").notNull().default("shadow"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("articles_locale_slug_idx").on(table.locale, table.slug),
    index("articles_event_id_idx").on(table.eventId),
    index("articles_status_idx").on(table.status),
    index("articles_locale_idx").on(table.locale),
  ],
);

// --- article_versions / article_sources (Phase 3) -------------------------

export const articleVersions = pgTable(
  "article_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // e.g. "agent:writer", "human" — v0 doesn't have per-user identity yet
    // (no auth/users table), so this tracks agent-vs-human, not who.
    editedBy: text("edited_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("article_versions_article_id_idx").on(table.articleId),
    uniqueIndex("article_versions_article_version_idx").on(
      table.articleId,
      table.version,
    ),
  ],
);

// Which source_items an article actually cites — lets the CMS show "this
// citation is real" the same way evidence.sourceItemId does for claims.
export const articleSources = pgTable(
  "article_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    sourceItemId: uuid("source_item_id")
      .notNull()
      .references(() => sourceItems.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("article_sources_article_source_idx").on(
      table.articleId,
      table.sourceItemId,
    ),
  ],
);

// --- claims / evidence (Phase 2) -----------------------------------------

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    // who | what | when | where | how_many | quote | other
    category: text("category").notNull().default("other"),
    // unverified | supported | contradicted | disputed | unconfirmed
    status: text("status").notNull().default("unverified"),
    confidence: integer("confidence"), // 0-100, null until an agent scores it
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("claims_event_id_idx").on(table.eventId),
    index("claims_status_idx").on(table.status),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    // The specific source_items row this excerpt was taken from — this is
    // the link back to a stored source, never a bare LLM assertion.
    sourceItemId: uuid("source_item_id")
      .notNull()
      .references(() => sourceItems.id, { onDelete: "cascade" }),
    excerpt: text("excerpt").notNull(),
    stance: text("stance").notNull(), // supports | contradicts | neutral
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("evidence_claim_id_idx").on(table.claimId),
    index("evidence_source_item_id_idx").on(table.sourceItemId),
  ],
);

// --- fact_packs (architecture add-on, Addition 5) --------------------------

/**
 * The durable, frozen factual package between verification and writing —
 * added 2026-09-18 per the architecture add-on's Addition 5. Before this,
 * write.ts queried `claims`/`evidence` fresh for each locale call; in
 * practice both ar/fr calls already saw the same data (no concurrency in
 * that worker), but there was no durable, inspectable record of exactly
 * what facts a given article was written from — which Addition 14
 * (multi-language fact consistency) needs to check "did the ar/fr articles
 * actually come from the same facts," and corrections need to check
 * "did the underlying facts change since this was written."
 *
 * One event can have more than one fact_packs row over time (a later
 * verification pass, or new evidence, can produce a new one) — `version`
 * + `supersededAt` track that; `status` distinguishes the currently-active
 * pack from old ones kept for history, never deleted (Addition 4: "never
 * silently overwrite the past").
 */
export const factPacks = pgTable(
  "fact_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // active | superseded
    status: text("status").notNull().default("active"),
    // Frozen snapshot — see FactPackClaim/FactPackSource in
    // src/lib/fact-pack.ts for the shape. Not a live join: this is exactly
    // what both the ar and fr Writer Agent calls are given.
    claims: jsonb("claims").notNull(),
    sources: jsonb("sources").notNull(),
    // Reserved for future agents (entity extraction, timeline building,
    // Addition 3's Contradiction Engine) — null until something populates
    // them; declaring the columns now is the add-on's Addition 15
    // ("architectural ownership is established now"), not fabricated data.
    entities: jsonb("entities"),
    timeline: jsonb("timeline"),
    contradictions: jsonb("contradictions"),
    confidence: integer("confidence"),
    unresolvedNotes: text("unresolved_notes"),
    publicationRestrictions: jsonb("publication_restrictions"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fact_packs_event_id_idx").on(table.eventId),
    uniqueIndex("fact_packs_event_version_idx").on(table.eventId, table.version),
    index("fact_packs_status_idx").on(table.status),
  ],
);

// --- agent_runs / audit_logs (Phase 2) ------------------------------------

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // verification | adversarial | research | ... (Phase 3 adds writer/editorial)
    agentType: text("agent_type").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull(), // success | error
    output: jsonb("output"), // parsed structured result, null on error
    errorMessage: text("error_message"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costEstimateUsd: numeric("cost_estimate_usd", { precision: 10, scale: 4 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_runs_event_id_idx").on(table.eventId),
    index("agent_runs_agent_type_idx").on(table.agentType),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // event | claim | article | source
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    actorType: text("actor_type").notNull(), // agent | human | system
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// --- gazetteer (Morocco Knowledge Base v0, Phase 2) -----------------------

export const gazetteerEntries = pgTable(
  "gazetteer_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // region | city | province | institution | agency | ministry | company
    // | club | place | event | figure | terminology
    type: text("type").notNull(),
    nameAr: text("name_ar").notNull(),
    nameFr: text("name_fr").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    verified: boolean("verified").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("gazetteer_entries_type_idx").on(table.type),
    uniqueIndex("gazetteer_entries_type_name_fr_idx").on(table.type, table.nameFr),
  ],
);

// --- social_posts (Phase 5 — distribution) ---------------------------------

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Exactly one of articleId / sourceItemId is set, enforced at the
    // application layer (src/workers/*.ts), not a DB constraint. articleId
    // was the only case in Phase 5 (an AI-written, published article);
    // sourceItemId was added 2026-09-19 for Instagram, which posts straight
    // from the free-aggregator radar items (src/workers/instagram-publish.ts)
    // — there is no `articles` row to attach to for that content path.
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "cascade" }),
    sourceItemId: uuid("source_item_id").references(() => sourceItems.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // x | telegram | instagram
    // pending | posted | disabled | error — "disabled" means the channel's
    // feature flag was off when the worker ran, not a failure.
    status: text("status").notNull().default("pending"),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    errorMessage: text("error_message"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("social_posts_article_channel_idx").on(table.articleId, table.channel),
    uniqueIndex("social_posts_source_item_channel_idx").on(table.sourceItemId, table.channel),
    index("social_posts_status_idx").on(table.status),
  ],
);


// --- uploaded_images ---------------------------------------------------
// Photos uploaded from the CMS (phone or computer) — added 2026-11-06.
// Stored in Postgres so they survive redeploys (the web container's disk is
// ephemeral); served publicly by src/app/media/[id]/route.ts. Images are
// resized client-side before upload (max 1600px JPEG), so rows stay small.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const uploadedImages = pgTable("uploaded_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
