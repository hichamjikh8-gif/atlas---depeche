import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/locales";
import { getRubriqueArticles } from "@/lib/public-site";
import { getRubrique } from "@/lib/rubriques";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; rubrique: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, rubrique: slug } = await params;
  const rubrique = getRubrique(slug);
  if (!isLocale(locale) || !rubrique) return {};
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const name = locale === "ar" ? rubrique.ar : rubrique.fr;
  const path = `/${locale}/rubrique/${rubrique.slug}${page > 1 ? `?page=${page}` : ""}`;
  return {
    title: page > 1 ? `${name} — ${locale === "ar" ? `صفحة ${page}` : `page ${page}`}` : name,
    description:
      locale === "ar"
        ? `آخر مقالات قسم «${name}» على أطلس ديبيش.`
        : `Les derniers articles de la rubrique « ${name} » sur Atlas Dépêche.`,
    alternates: {
      canonical: path,
      languages: { ar: `/ar/rubrique/${rubrique.slug}`, fr: `/fr/rubrique/${rubrique.slug}` },
    },
  };
}

export default async function RubriquePage({ params, searchParams }: Props) {
  const { locale, rubrique: slug } = await params;
  const rubrique = getRubrique(slug);
  if (!isLocale(locale) || !rubrique) notFound();

  const { page: pageParam } = await searchParams;
  const { items, page, totalPages } = await getRubriqueArticles(
    locale as Locale,
    rubrique,
    Math.max(1, Number(pageParam) || 1),
  );
  const name = locale === "ar" ? rubrique.ar : rubrique.fr;

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-3xl)",
          marginBlockEnd: "var(--space-8)",
          backgroundImage: "linear-gradient(135deg, var(--color-accent), #D62976)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        {name}
      </h1>

      {items.length === 0 ? (
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-lg)",
            color: "var(--color-text-secondary)",
            paddingBlock: "var(--space-12)",
            textAlign: "center",
          }}
        >
          {locale === "ar"
            ? "لا توجد مقالات في هذا القسم حالياً. عودوا قريباً."
            : "Aucun article dans cette rubrique pour le moment. Revenez bientôt."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))",
            gap: "var(--space-6)",
            marginBlockEnd: "var(--space-8)",
          }}
        >
          {items.map((item) => {
            const date = item.publishedAt ?? item.fetchedAt;
            return (
              <article
                key={item.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "2px solid #D4AF37",
                  borderRadius: "6px",
                  overflow: "hidden",
                  background: "var(--color-bg-elevated)",
                }}
              >
                <Link href={item.url} aria-label={item.title} style={{ display: "block" }}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      style={{
                        width: "100%",
                        aspectRatio: "16 / 9",
                        objectFit: "cover",
                        display: "block",
                        background: "var(--color-bg-subtle)",
                      }}
                    />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "16 / 9", background: "var(--color-bg-subtle)" }} />
                  )}
                </Link>
                <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", flex: 1 }}>
                  <Link
                    href={item.url}
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "var(--text-lg)",
                      fontWeight: 600,
                      lineHeight: 1.3,
                      textDecoration: "none",
                      color: "var(--color-text)",
                      marginBlockEnd: "var(--space-2)",
                    }}
                  >
                    {item.title}
                  </Link>
                  <div
                    style={{
                      marginBlockStart: "auto",
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "var(--space-2)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    <span>{item.sourceName}</span>
                    {date && <time dateTime={date.toISOString()}>{date.toISOString().slice(0, 10)}</time>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label={locale === "ar" ? "الصفحات" : "Pagination"}
          style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)" }}
        >
          {page > 1 ? (
            <Link href={`/${locale}/rubrique/${rubrique.slug}?page=${page - 1}`} style={{ color: "var(--color-accent)" }}>
              {locale === "ar" ? "← السابق" : "← Précédent"}
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--color-text-tertiary)" }}>
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/${locale}/rubrique/${rubrique.slug}?page=${page + 1}`} style={{ color: "var(--color-accent)" }}>
              {locale === "ar" ? "التالي →" : "Suivant →"}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
