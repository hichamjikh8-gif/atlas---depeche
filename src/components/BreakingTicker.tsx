import { getDictionary, type Locale } from "@/i18n/locales";
import { getHomeArticles } from "@/lib/public-site";
import { getWorldHeadlines } from "@/lib/world-headlines";

const TICKER_ITEM_COUNT = 30;
// Speed is now tied to the amount of text, not a fixed duration: with 30
// world headlines a fixed 160s loop scrolled far too fast (reported
// 2026-11-06). ~4 characters per second reads calmly; never under 160s.
const TICKER_CHARS_PER_SECOND = 4;
const TICKER_MIN_DURATION_SECONDS = 160;

/**
 * Scrolling headline strip at the top of the page. Direction follows each
 * locale's own reading direction, not a fixed convention — Arabic scrolls
 * right-to-left, French left-to-right (both explicitly requested). See the
 * `ticker-scroll` keyframe in globals.css for how one keyframe drives both
 * directions via `animation-direction`.
 *
 * Headlines: world news of the last 24 hours (see getWorldHeadlines below),
 * with Atlas Dépêche's own articles as a fallback.
 */
export async function BreakingTicker({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  // Since 2026-11-06: world headlines of the last 24 hours (France 24, RFI,
  // Le Monde, BBC… — see src/lib/world-headlines.ts), each linking to the
  // original article. Falls back to Atlas Dépêche's own articles if every
  // feed is unreachable.
  const world = await getWorldHeadlines(locale === "ar" ? "ar" : "fr").catch(() => []);
  const headlines: Array<{ id: string; title: string; url: string; source: string | null }> =
    world.length > 0
      ? world.slice(0, TICKER_ITEM_COUNT).map((w) => ({ id: w.id, title: w.title, url: w.url, source: w.source }))
      : (await getHomeArticles(locale, 1)).items
          .slice(0, TICKER_ITEM_COUNT)
          .map((a) => ({ id: a.id, title: a.title, url: a.url, source: null }));

  if (headlines.length === 0) return null;

  const textLength = headlines.reduce((n, h) => n + h.title.length + (h.source?.length ?? 0) + 6, 0);
  const durationSeconds = Math.max(TICKER_MIN_DURATION_SECONDS, Math.round(textLength / TICKER_CHARS_PER_SECOND));

  const headlineLink = (item: (typeof headlines)[number], keyPrefix: string) => (
    <a
      key={`${keyPrefix}-${item.id}`}
      href={item.url}
      {...(item.source ? { target: "_blank", rel: "noopener nofollow" } : {})}
      dir={locale === "ar" ? "rtl" : "ltr"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "var(--color-text)",
        textDecoration: "none",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        // The scroll track around this is forced direction: ltr so the
        // marquee animation math stays predictable (see below) — but that
        // also forces every headline's own text into an ltr base
        // paragraph, which can misorder Arabic (numbers, punctuation) even
        // though individual RTL runs still shape right-to-left on their
        // own. `dir` + isolate here give each headline its own correct
        // reading-direction context without touching the outer scroll math.
        unicodeBidi: "isolate",
      }}
    >
      {item.source && (
        <span
          style={{
            color: "var(--color-breaking)",
            fontWeight: 700,
            fontSize: "var(--text-xs)",
            marginInlineEnd: "var(--space-2)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {item.source}
        </span>
      )}
      {item.title}
      <span
        aria-hidden="true"
        style={{
          color: "var(--color-breaking)",
          marginInline: "var(--space-6)",
          fontWeight: 700,
        }}
      >
        •
      </span>
    </a>
  );

  return (
    <div
      role="region"
      aria-label={dict.breakingLabel}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBlockEnd: "1px solid var(--color-border)",
        background: "var(--color-bg-subtle)",
        // Moved back to the OTHER side again, explicitly requested — this
        // is now each locale's own natural dir-driven "start" edge, badge
        // first in DOM order, no direction/flexDirection override needed:
        // right for Arabic (dir="rtl", inherited from <html>), left for
        // French (dir="ltr").
      }}
    >
      <div
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="breaking-badge"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          paddingInline: "var(--space-4)",
          color: "#ffffff",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        <span className="breaking-dot" aria-hidden="true" />
        {dict.breakingLabel}
      </div>
      {/* direction: ltr is forced here — without it, the Arabic page's
          dir="rtl" mirrors this flex row (items anchor to the right,
          overflow extends left instead of right), which flips which way
          the loop actually scrolls versus what animationDirection below
          assumes. Forcing ltr makes both locales lay out identically, so
          animationDirection alone reliably controls the visible direction —
          confirmed necessary after the first version scrolled backwards. */}
      <div style={{ overflow: "hidden", flex: 1, direction: "ltr" }}>
        <div
          className="ticker-track"
          style={{
            display: "flex",
            alignItems: "center",
            width: "max-content",
            whiteSpace: "nowrap",
            paddingBlock: "var(--space-2)",
            paddingInlineStart: "var(--space-6)",
            animationName: "ticker-scroll",
            animationDuration: `${durationSeconds}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            // Track content is the SAME list rendered twice (below), so
            // translateX(-50%) is exactly one full loop. Both locales share
            // the same forced-ltr physical layout (anchored left, overflow
            // to the right): "normal" (0 → -50%) moves content
            // right-to-left on screen; "reverse" (-50% → 0) moves it
            // left-to-right.
            //
            // Which one to use per locale is NOT about matching the
            // overall sweep to the reading direction — it's about which
            // edge of an incoming headline box is the LEADING edge (the
            // one that crosses into view first), because that has to be
            // the box's own "beginning" edge or the headline reveals
            // backwards (its ending visible first, its start filling in
            // last as the rest scrolls in). A box's leading edge is its
            // own right edge when the box moves rightward, and its own
            // left edge when it moves leftward — regardless of which side
            // of the *screen* it's entering from. For French (dir=ltr per
            // headline, "beginning" = the box's left edge), that means
            // LEFTWARD motion ("normal"). For Arabic (dir=rtl per
            // headline, "beginning" = the box's right edge), that means
            // RIGHTWARD motion ("reverse") — confirmed live 2026-09-20
            // after a report that headlines in both locales were readable
            // starting from their end, not their start; the previous
            // assignment here had them swapped.
            animationDirection: locale === "ar" ? "reverse" : "normal",
          }}
        >
          {headlines.map((item) => headlineLink(item, "a"))}
          {headlines.map((item) => headlineLink(item, "b"))}
        </div>
      </div>
    </div>
  );
}
