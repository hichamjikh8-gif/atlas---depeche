import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SUPPORTED_LOCALES,
  LOCALE_DIR,
  isLocale,
  getDictionary,
  type Locale,
} from "@/i18n/locales";
import { inter, lora } from "@/lib/fonts";
import { notoNaskhArabic } from "@/lib/fonts-ar";
import { ShareLinks } from "@/components/ShareLinks";
import { BreakingTicker } from "@/components/BreakingTicker";
import { RubriqueNav } from "@/components/RubriqueNav";
import { AdFlash } from "@/components/AdFlash";
import "@/app/globals.css";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Second root layout (route group) alongside (admin) — each defines its
 * own <html>/<body>, per Next.js's documented "multiple root layouts"
 * pattern. This one owns the public, bilingual product.
 */

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: dict.siteName, template: `%s — ${dict.siteName}` },
    description: dict.tagline,
    alternates: {
      languages: {
        ar: "/ar",
        fr: "/fr",
      },
    },
    // Google Search Console property verification — the user's own code,
    // pasted from Search Console's "HTML tag" verification method
    // 2026-09-19. Renders as <meta name="google-site-verification"
    // content="..."> in <head>, present on every public page since this
    // is the shared layout for both locales.
    verification: {
      google: "P5EuzNYo5LfEOnDdWUHlV1eHQUOpjZAeKwkuV4z86X4",
    },
    // "Add to Home Screen" behavior on iOS Safari, which doesn't read
    // manifest.ts the way Android/Chrome does — this is the separate,
    // Apple-specific config that makes the icon open standalone (no
    // Safari chrome) instead of just bookmarking the URL.
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: dict.siteName,
    },
  };
}

export default async function PublicLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const otherLocale: Locale = locale === "ar" ? "fr" : "ar";

  // Apply font variables conditionally based on locale
  const fontClasses =
    locale === "ar"
      ? `${inter.variable} ${lora.variable} ${notoNaskhArabic.variable}`
      : `${inter.variable} ${lora.variable}`;

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]} className={fontClasses}>
      <body>
        {/* Skip link for keyboard navigation — WCAG 2.2 AA */}
        <a href="#main-content" className="skip-link">
          {locale === "ar" ? "تخطي إلى المحتوى" : "Aller au contenu principal"}
        </a>

        {/* ── Masthead ─────────────────────────────────────── */}
        <header
          role="banner"
          style={{
            borderBlockEnd: "1px solid var(--color-border)",
            paddingBlock: "var(--space-4)",
            paddingInline: "var(--space-6)",
          }}
        >
          <div
            className="masthead-row"
            style={{
              maxWidth: "var(--max-width-page)",
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              // justify-content lives in globals.css (.masthead-row), NOT
              // here — an inline style value here would always beat the
              // mobile media query override below it, no matter what the
              // CSS says (inline style beats any stylesheet rule, media
              // query or not). That was the actual bug the first time.
              alignItems: "center",
              rowGap: "var(--space-3)",
            }}
          >
            <Link
              href={`/${locale}`}
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 700,
                fontSize: "var(--text-2xl)",
                textDecoration: "none",
                letterSpacing: "-0.02em",
                backgroundImage: "linear-gradient(135deg, var(--color-accent), #D62976)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                // Without this, some mobile browsers keep the fallback
                // `color` instead of clipping to the gradient — the
                // gradient showed on desktop but rendered plain/blank on
                // mobile. WebkitTextFillColor is the actual color mobile
                // WebKit paints the glyphs with; color: transparent alone
                // isn't enough there.
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {dict.siteName}
            </Link>

            <nav aria-label={locale === "ar" ? "التنقل" : "Navigation"} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <ShareLinks locale={locale} />
              <Link
                href={`/${otherLocale}`}
                style={{
                  color: "#ffffff",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  textDecoration: "none",
                  paddingBlock: "var(--space-1)",
                  paddingInline: "var(--space-3)",
                  borderRadius: "999px",
                  border: "none",
                  backgroundImage: "linear-gradient(135deg, var(--color-accent), #4F5BD5)",
                  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.25)",
                  transition: "box-shadow var(--transition-fast), transform var(--transition-fast)",
                }}
              >
                {dict.otherLocaleLabel}
              </Link>
            </nav>
          </div>
        </header>

        <RubriqueNav locale={locale} />

        <BreakingTicker locale={locale} />

        {/* ── Main content ────────────────────────────────── */}
        <main
          id="main-content"
          role="main"
          style={{
            maxWidth: "var(--max-width-page)",
            marginInline: "auto",
            paddingInline: "var(--space-6)",
            paddingBlock: "var(--space-8)",
          }}
        >
          {children}
        </main>

        {/* ── Footer ──────────────────────────────────────── */}
        {/* Explicitly requested redesign, footer only: a background tint
            to separate it from the page (most real newspaper sites do
            this — the old footer just blended into the page with a thin
            top border), a proper two-column layout with a section heading
            over the legal links, and the copyright moved into its own
            bottom strip instead of trailing as a loose paragraph. Same
            content as before — tagline+flag, the 4 legal links, copyright
            — nothing added, nothing removed, nothing else on the page
            touched. */}
        <footer
          role="contentinfo"
          style={{
            background: "var(--color-bg-subtle)",
            borderBlockStart: "1px solid var(--color-border)",
            marginTop: "var(--space-16)",
          }}
        >
          <div
            style={{
              maxWidth: "var(--max-width-page)",
              margin: "0 auto",
              paddingInline: "var(--space-6)",
              paddingBlockStart: "var(--space-12)",
              paddingBlockEnd: "var(--space-8)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
              gap: "var(--space-8)",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontWeight: 700,
                  fontSize: "var(--text-xl)",
                  letterSpacing: "-0.02em",
                  marginBlockEnd: "var(--space-3)",
                  backgroundImage: "linear-gradient(135deg, var(--color-accent), #D62976)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {dict.siteName}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.7,
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  maxInlineSize: "24rem",
                }}
              >
                <span>{dict.taglineParts.before}</span>
                {/* A real flag image, not the 🇲🇦 emoji — Windows renders
                    regional-indicator flag emoji as plain letter codes
                    ("MA") instead of a flag, so an <img> is the only
                    reliable option across platforms. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://flagcdn.com/ma.svg"
                  alt={locale === "ar" ? "علم المغرب" : "Drapeau du Maroc"}
                  style={{ height: "1em", width: "auto", borderRadius: "2px", flexShrink: 0 }}
                />
                <span>{dict.taglineParts.after}</span>
              </p>
            </div>

            <div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-tertiary)",
                  marginBlockEnd: "var(--space-4)",
                }}
              >
                {locale === "ar" ? "معلومات قانونية" : "Informations légales"}
              </p>
              <nav
                aria-label={locale === "ar" ? "روابط قانونية" : "Legal links"}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                {[
                  { href: `/${locale}/legal/mentions`, label: dict.legal.mentions },
                  { href: `/${locale}/legal/privacy`, label: dict.legal.privacy },
                  { href: `/${locale}/legal/corrections`, label: dict.legal.corrections },
                  { href: `/${locale}/contact`, label: dict.legal.contact },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-secondary)",
                      textDecoration: "none",
                      transition: "color var(--transition-fast)",
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div
            style={{
              borderBlockStart: "1px solid var(--color-border-subtle)",
            }}
          >
            <p
              style={{
                maxWidth: "var(--max-width-page)",
                margin: "0 auto",
                paddingInline: "var(--space-6)",
                paddingBlock: "var(--space-4)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-tertiary)",
              }}
            >
              {locale === "ar"
                ? "© 2026 Atlas Dépêche. جميع الحقوق محفوظة."
                : "© 2026 Atlas Dépêche. Tous droits réservés."}
            </p>
          </div>
        </footer>

        <AdFlash locale={locale} />
      </body>
    </html>
  );
}
