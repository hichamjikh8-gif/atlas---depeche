import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.xn--atlasdpche-g7an.com";
const DIRECTOR_PHOTO = "/equipe/redouane-jikh-directeur-publication-atlas-depeche.jpg";

const CONTENT = {
  fr: {
    title: "Mentions légales",
    teamTitle: "Direction",
    founderLabel: "Fondateur",
    founderName: "Hicham Jikh Cheddad",
    directorLabel: "Directeur de la publication",
    directorName: "Redouane Jikh",
    photoAlt: "Redouane Jikh, directeur de la publication d'Atlas Dépêche",
    body: [
      "Responsable du site : la personne légalement désignée comme responsable du site et de son contenu.",
      "Hébergement : le site est hébergé chez un prestataire d'hébergement externe.",
      "Pour toute question ou demande de contact, merci de consulter la page Contact.",
    ],
  },
  ar: {
    title: "الإشعار القانوني",
    teamTitle: "الإدارة",
    founderLabel: "المؤسس",
    founderName: "هشام جيخ شداد",
    directorLabel: "مدير النشر",
    directorName: "رضوان جيخ",
    photoAlt: "رضوان جيخ، مدير نشر أطلس ديبيش",
    body: [
      "المسؤول عن الموقع: المسؤول المعيّن قانونيًا عن الموقع ومحتواه.",
      "الاستضافة: يتم استضافة الموقع لدى مزود خدمات استضافة خارجي.",
      "لأي استفسار أو تواصل، يرجى مراجعة صفحة اتصل بنا.",
    ],
  },
};

export default async function MentionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = CONTENT[locale];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: "Atlas Dépêche",
    url: SITE_URL,
    founder: {
      "@type": "Person",
      name: "Hicham Jikh Cheddad",
      alternateName: ["Hicham Jikh", "هشام جيخ شداد"],
    },
    employee: {
      "@type": "Person",
      name: "Redouane Jikh",
      alternateName: "رضوان جيخ",
      jobTitle: "Directeur de la publication",
      image: SITE_URL + DIRECTOR_PHOTO,
      url: `${SITE_URL}/${locale}/legal/mentions`,
    },
  };

  const p = { fontFamily: "var(--font-serif)", fontSize: "var(--text-base)", lineHeight: 1.8, marginBlockEnd: "var(--space-4)" };

  return (
    <div style={{ maxInlineSize: "var(--max-width-content)", marginInline: "auto" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-3xl)", marginBlockEnd: "var(--space-6)" }}>
        {c.title}
      </h1>

      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-xl)", marginBlockEnd: "var(--space-4)" }}>
        {c.teamTitle}
      </h2>
      <figure style={{ margin: 0, marginBlockEnd: "var(--space-6)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DIRECTOR_PHOTO}
          alt={c.photoAlt}
          width={800}
          height={1067}
          style={{ display: "block", inlineSize: "100%", maxInlineSize: "420px", blockSize: "auto", borderRadius: "8px" }}
        />
        <figcaption style={{ ...p, marginBlockStart: "var(--space-2)" }}>
          <strong>{c.directorLabel} :</strong> {c.directorName}
        </figcaption>
      </figure>

      {c.body.map((line, i) => (
        <p key={i} style={p}>
          {line}
        </p>
      ))}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Aref+Ruqaa:wght@700&display=swap');
        .ad-founder { margin-block-start: var(--space-8, 3rem); text-align: center; }
        .ad-founder summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          inline-size: 34px; block-size: 34px; border-radius: 50%; border: 1px solid rgba(212,175,55,.55);
          color: #d4af37; font-size: 22px; line-height: 1; opacity: .7; transition: transform .35s ease, opacity .35s ease; user-select: none; }
        .ad-founder summary::-webkit-details-marker { display: none; }
        .ad-founder summary:hover { opacity: 1; }
        .ad-founder[open] summary { transform: rotate(45deg); opacity: 1; }
        .ad-founder .ad-founder-txt { margin-block-start: var(--space-4, 1rem); animation: adFade .6s ease both; }
        .ad-founder .ad-founder-lbl { display: block; font-family: var(--font-serif); font-size: .8rem; letter-spacing: .25em; text-transform: uppercase; color: #b9b3a0; }
        .ad-founder .ad-founder-name { display: block; font-family: 'Great Vibes', cursive; font-size: 2.6rem; color: #d4af37; line-height: 1.3; }
        .ad-founder .ad-founder-name.ar { font-family: 'Aref Ruqaa', serif; font-size: 2.2rem; }
        @keyframes adFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      <details className="ad-founder">
        <summary aria-label={c.founderLabel}>+</summary>
        <div className="ad-founder-txt">
          <span className="ad-founder-lbl">{c.founderLabel}</span>
          <span className={locale === "ar" ? "ad-founder-name ar" : "ad-founder-name"}>{c.founderName}</span>
        </div>
      </details>
    </div>
  );
}
