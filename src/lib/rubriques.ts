/**
 * Public sections ("rubriques") of Atlas Dépêche — added 2026-11-06 at
 * Hicham's request. Each rubrique groups one or more event categories
 * (events.category); any category not listed falls under "actualite".
 */
export interface Rubrique {
  slug: "actualite" | "international" | "sport" | "crypto" | "divers" | "publicite";
  fr: string;
  ar: string;
  /** Signature colour of the rubrique (nav pill, page title, card accents). */
  color: string;
  categories: readonly string[];
}

export const RUBRIQUES: readonly Rubrique[] = [
  {
    slug: "actualite",
    fr: "Actualité",
    ar: "مستجدات",
    color: "#E63946",
    categories: ["news", "politics", "society", "economy", "institutional", "justice", "security"],
  },
  { slug: "international", fr: "International", ar: "دولي", color: "#1D7FD8", categories: ["international", "diplomacy"] },
  { slug: "sport", fr: "Sport", ar: "رياضة", color: "#2BA84A", categories: ["sports"] },
  { slug: "crypto", fr: "Crypto-monnaie", ar: "العملات الرقمية", color: "#F7931A", categories: ["crypto"] },
  {
    slug: "divers",
    fr: "Divers",
    ar: "متفرقات",
    color: "#8E44AD",
    categories: ["culture", "personalities", "personalities-intl", "diaspora", "tourism", "divers"],
  },
  { slug: "publicite", fr: "Publicité", ar: "إشهار", color: "#C9A227", categories: ["publicite"] },
];

export function getRubrique(slug: string): Rubrique | undefined {
  return RUBRIQUES.find((r) => r.slug === slug);
}

/** Which rubrique an event category belongs to (unknown → Actualité). */
export function rubriqueForCategory(category: string): Rubrique {
  return RUBRIQUES.find((r) => r.categories.includes(category)) ?? RUBRIQUES[0]!;
}

/** All event categories that belong to a rubrique — for "Actualité" this also
 *  means "anything not claimed by another rubrique" (see getRubriqueArticles). */
export function categoriesClaimedElsewhere(slug: Rubrique["slug"]): string[] {
  return RUBRIQUES.filter((r) => r.slug !== slug).flatMap((r) => r.categories);
}

/**
 * Maps a partner site's own category names (Souss Actualités WordPress
 * categories, French or Arabic) to an Atlas Dépêche event category.
 * Order matters: the first match wins.
 */
const PARTNER_CATEGORY_RULES: Array<[RegExp, string]> = [
  [/international|monde|دولي|عالم/i, "international"],
  [/sport|foot|رياضة/i, "sports"],
  [/crypto|bitcoin|blockchain|عملات رقمية|كريبتو/i, "crypto"],
  [/publicit|annonce|sponsor|إشهار|اعلان|إعلان/i, "publicite"],
  [/culture|tourisme|tendance|vid[ée]o|musique|cin[ée]ma|ثقافة|سياحة|توجهات|فيديو/i, "culture"],
  [/[ée]conomie|business|entreprise|اقتصاد|أعمال/i, "economy"],
  [/politique|سياسة/i, "politics"],
  [/soci[ée]t[ée]|social|مجتمع/i, "society"],
];

export function mapPartnerCategories(names: readonly string[] | undefined, fallback: string): string {
  if (!names || names.length === 0) return fallback;
  for (const [pattern, category] of PARTNER_CATEGORY_RULES) {
    if (names.some((n) => pattern.test(n))) return category;
  }
  return fallback;
}
