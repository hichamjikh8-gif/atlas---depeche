/**
 * Categories offered when writing a free article (no radar event) in
 * /admin/articles. Values match the category vocabulary already used by
 * sources/events (see src/db/seed-sources.ts and
 * src/lib/automation-policy.ts); labels are for the CMS UI only.
 */
export const MANUAL_CATEGORIES = [
  { value: "news", label: "Actualité / أخبار" },
  { value: "politics", label: "Politique / سياسة" },
  { value: "economy", label: "Économie / اقتصاد" },
  { value: "society", label: "Société / مجتمع" },
  { value: "sports", label: "Sport / رياضة" },
  { value: "culture", label: "Culture / ثقافة" },
  { value: "diaspora", label: "Diaspora / الجالية" },
  { value: "institutional", label: "Institutionnel / مؤسسات" },
  { value: "personalities", label: "Personnalités / شخصيات" },
  { value: "international", label: "International / دولي" },
] as const;

export const MANUAL_CATEGORY_VALUES: ReadonlySet<string> = new Set(MANUAL_CATEGORIES.map((c) => c.value));
