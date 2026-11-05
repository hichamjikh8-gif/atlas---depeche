import { describe, expect, it } from "vitest";
import {
  PARTNER_SITES,
  buildPartnerBody,
  cleanExcerpt,
  detectLocale,
  isLikelyImageUrl,
  parseArticleMeta,
  parseNewsSitemap,
  partnerFingerprint,
} from "./partners";

const souss = PARTNER_SITES.find((s) => s.id === "souss-actualites")!;
const rexfoot = PARTNER_SITES.find((s) => s.id === "rexfoot")!;

describe("partners", () => {
  it("only Souss Actualités and RexFoot are partners", () => {
    expect(PARTNER_SITES.map((s) => s.id)).toEqual(["souss-actualites", "rexfoot"]);
  });

  it("detects Arabic vs French titles", () => {
    expect(detectLocale("كابوس الساعة المضافة ينتهي")).toBe("ar");
    expect(detectLocale("Agadir : le port en chantier")).toBe("fr");
  });

  it("fingerprint is stable per URL and namespaced", () => {
    const a = partnerFingerprint("https://rexfoot.com/news/x");
    expect(a).toBe(partnerFingerprint(" https://rexfoot.com/news/x "));
    expect(a).not.toBe(partnerFingerprint("https://rexfoot.com/news/y"));
    expect(a.startsWith("partner:")).toBe(true);
  });

  it("cleans WordPress excerpts and caps length", () => {
    expect(cleanExcerpt("<p>Bonjour&nbsp; le   monde [&#8230;]</p>")).toBe("Bonjour le monde");
    expect(cleanExcerpt("Texte. The post Titre appeared first on Souss Actualités.")).toBe("Texte.");
    const long = cleanExcerpt("mot ".repeat(200), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
    expect(cleanExcerpt(undefined)).toBe("");
  });

  it("builds excerpt + credited read-more link in the right language", () => {
    const item = { url: "https://rexfoot.com/news/a", title: "T", excerpt: "Résumé", imageUrl: null, publishedAt: null };
    expect(buildPartnerBody(rexfoot, item, "fr")).toBe(
      "Résumé\n\n[Lire l'article complet sur RexFoot →](https://rexfoot.com/news/a)",
    );
    expect(buildPartnerBody(souss, { ...item, excerpt: "" }, "ar")).toBe(
      "[اقرأ المقال كاملاً على سوس أكتواليتي ←](https://rexfoot.com/news/a)",
    );
  });

  it("parses a Google News sitemap", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url><loc>https://rexfoot.com/news/a</loc><news:news><news:publication><news:name>RexFoot</news:name></news:publication>
      <news:publication_date>2026-11-05T11:52:27.881Z</news:publication_date><news:title>L’équipe nationale</news:title></news:news></url>
      <url><loc>https://rexfoot.com/news/b</loc></url></urlset>`;
    const out = parseNewsSitemap(xml);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: "https://rexfoot.com/news/a", title: "L’équipe nationale" });
    expect(out[0]!.publishedAt?.toISOString()).toBe("2026-11-05T11:52:27.881Z");
  });

  it("reads og:description and og:image", () => {
    const html = `<html><head><meta property="og:description" content=" Desc "><meta property="og:image" content="https://x/i.jpg"></head></html>`;
    expect(parseArticleMeta(html)).toEqual({ description: "Desc", image: "https://x/i.jpg" });
    expect(parseArticleMeta("<html></html>")).toEqual({ description: null, image: null });
  });

  it("rejects video enclosures as photos", () => {
    expect(isLikelyImageUrl("https://souss-actualites.com/wp-content/uploads/2026/11/x.mp4")).toBe(false);
    expect(isLikelyImageUrl("https://souss-actualites.com/wp-content/uploads/2026/11/x.jpg")).toBe(true);
    expect(isLikelyImageUrl("https://x.ma/image?id=1")).toBe(true);
    expect(isLikelyImageUrl(null)).toBe(false);
  });
});
