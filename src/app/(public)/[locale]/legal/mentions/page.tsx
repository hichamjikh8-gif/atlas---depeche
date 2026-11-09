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
      <p style={p}>
        <strong>{c.founderLabel} :</strong> {c.founderName}
      </p>
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
    </div>
  );
}
