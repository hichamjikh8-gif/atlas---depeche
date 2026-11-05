import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { renderArticleBody, stripArticleFormatting } from "@/lib/article-format";
import { getPublishedArticleBySlug } from "@/lib/public-site";
import { toEmbeddableVideoUrl } from "@/lib/video-embed";

export const dynamic = "force-dynamic";

type Params = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const article = await getPublishedArticleBySlug(locale, slug);
  if (!article) return {};

  const description = stripArticleFormatting(article.body).slice(0, 160);

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      locale,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const article = await getPublishedArticleBySlug(locale, slug);
  if (!article) notFound();

  const isCorrected = article.status === "corrected";
  const embedVideoUrl = article.videoUrl ? toEmbeddableVideoUrl(article.videoUrl) : null;
  // A direct video file (e.g. the .mp4 Souss Actualités attaches to a post) plays inline.
  const directVideoUrl =
    article.videoUrl && !embedVideoUrl && /^https:\/\/.+\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(article.videoUrl)
      ? article.videoUrl
      : null;
  const publishedDate = article.publishedAt?.toISOString().slice(0, 10);
  const updatedDate = article.updatedAt.toISOString().slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    inLanguage: locale,
  };

  return (
    <article
      style={{
        maxInlineSize: "var(--max-width-article)",
        marginInline: "auto",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-4xl)",
          fontWeight: 700,
          lineHeight: 1.15,
          marginBlockEnd: "var(--space-4)",
        }}
      >
        {article.title}
      </h1>

      {article.imageUrl && (
        // Arbitrary external domains — same reasoning as the homepage's
        // radar cards (src/app/(public)/[locale]/page.tsx): a fixed
        // next/image remotePatterns allowlist isn't practical here either.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            maxHeight: "28rem",
            objectFit: "cover",
            borderRadius: "4px",
            marginBlockEnd: "var(--space-6)",
            background: "var(--color-bg-subtle)",
          }}
        />
      )}

      {embedVideoUrl && (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            marginBlockEnd: "var(--space-6)",
            borderRadius: "4px",
            overflow: "hidden",
            background: "var(--color-bg-subtle)",
          }}
        >
          <iframe
            src={embedVideoUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}
      {directVideoUrl && (
        <video
          src={directVideoUrl}
          controls
          playsInline
          preload="metadata"
          poster={article.imageUrl ?? undefined}
          style={{ width: "100%", borderRadius: "4px", marginBlockEnd: "var(--space-6)", background: "#000" }}
        />
      )}
      {article.videoUrl && !embedVideoUrl && !directVideoUrl && (
        <p style={{ marginBlockEnd: "var(--space-6)" }}>
          <a href={article.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>
            {locale === "ar" ? "▶ مشاهدة الفيديو" : "▶ Voir la vidéo"}
          </a>
        </p>
      )}

      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-secondary)",
          marginBlockEnd: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        {publishedDate && (
          <time dateTime={article.publishedAt?.toISOString()}>
            {locale === "ar" ? "نشر في" : "Publié le"} {publishedDate}
          </time>
        )}
        {updatedDate !== publishedDate && (
          <time dateTime={article.updatedAt.toISOString()}>
            {locale === "ar" ? "آخر تحديث" : "Mis à jour le"} {updatedDate}
          </time>
        )}
      </div>

      {isCorrected && (
        <div
          role="alert"
          style={{
            background: "var(--color-correction-bg)",
            borderInlineStart: "3px solid var(--color-correction)",
            paddingBlock: "var(--space-3)",
            paddingInline: "var(--space-4)",
            marginBlockEnd: "var(--space-6)",
            borderRadius: "0 4px 4px 0",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--color-correction)",
              margin: 0,
            }}
          >
            {locale === "ar"
              ? `تم تصحيح هذا المقال بتاريخ ${updatedDate}`
              : `Cet article a été corrigé le ${updatedDate}`}
          </p>
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-lg)",
          lineHeight: 1.8,
          color: "var(--color-text)",
        }}
      >
        {renderArticleBody(article.body)}
      </div>

      <aside
        aria-label={locale === "ar" ? "المصادر" : "Sources"}
        style={{
          marginBlockStart: "var(--space-8)",
          paddingBlock: "var(--space-4)",
          paddingInline: "var(--space-4)",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          background: "var(--color-bg-subtle)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text-secondary)",
            marginBlockEnd: "var(--space-2)",
          }}
        >
          {locale === "ar" ? "المصادر" : "Sources"}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-tertiary)",
            margin: 0,
          }}
        >
          {locale === "ar"
            ? "يتم التحقق من جميع الادعاءات والمعلومات من مصادر موثوقة."
            : "Toutes les affirmations et informations sont vérifiées à partir de sources fiables."}
        </p>
      </aside>

      <div
        style={{
          marginBlockStart: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
        }}
      >
        <Link
          href={`/${locale}/legal/corrections`}
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          {locale === "ar" ? "سياسات التصحيحات" : "Politique de correction"}
        </Link>
      </div>

      <div
        style={{
          marginBlockStart: "var(--space-12)",
          paddingBlockStart: "var(--space-6)",
          borderBlockStart: "1px solid var(--color-border)",
        }}
      >
        <Link
          href={`/${locale}`}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            color: "var(--color-accent)",
            textDecoration: "none",
          }}
        >
          {locale === "ar" ? "← العودة إلى الرئيسية" : "← Retour à l'accueil"}
        </Link>
      </div>
    </article>
  );
}
