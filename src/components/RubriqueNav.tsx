"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUBRIQUES } from "@/lib/rubriques";

/**
 * Section bar under the masthead (Accueil + the rubriques of
 * src/lib/rubriques.ts). Scrolls horizontally on small screens; the current
 * section is highlighted. Added 2026-11-06.
 */
export function RubriqueNav({ locale }: { locale: "fr" | "ar" }) {
  const pathname = usePathname() ?? "";
  const items = [
    { href: `/${locale}`, label: locale === "ar" ? "الرئيسية" : "Accueil", color: null as string | null },
    ...RUBRIQUES.map((r) => ({
      href: `/${locale}/rubrique/${r.slug}`,
      label: locale === "ar" ? r.ar : r.fr,
      color: r.color as string | null,
    })),
  ];

  return (
    <nav
      aria-label={locale === "ar" ? "الأقسام" : "Rubriques"}
      style={{
        borderBlockEnd: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated, transparent)",
      }}
    >
      <ul
        className="rubrique-nav"
        style={{
          listStyle: "none",
          margin: "0 auto",
          maxWidth: "var(--max-width-page)",
          display: "flex",
          gap: "var(--space-1)",
          overflowX: "auto",
          scrollbarWidth: "none",
          paddingBlock: "var(--space-2)",
          paddingInline: "var(--space-6)",
          whiteSpace: "nowrap",
        }}
      >
        {items.map((item) => {
          const active = item.href === `/${locale}` ? pathname === `/${locale}` : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-block",
                  paddingBlock: "var(--space-1)",
                  paddingInline: "var(--space-3)",
                  borderRadius: "999px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  letterSpacing: locale === "ar" ? 0 : "0.02em",
                  textTransform: locale === "ar" ? "none" : "uppercase",
                  textDecoration: "none",
                  // Each rubrique has its own colour: coloured text + thin coloured
                  // underline when idle, filled pill when it's the current page.
                  color: active ? "#ffffff" : (item.color ?? "var(--color-text-secondary, var(--color-text))"),
                  backgroundColor: active && item.color ? item.color : "transparent",
                  backgroundImage: active && !item.color ? "linear-gradient(135deg, var(--color-accent), #D62976)" : "none",
                  boxShadow: !active && item.color ? `inset 0 -2px 0 ${item.color}` : "none",
                  transition: "color var(--transition-fast), background-color var(--transition-fast)",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
