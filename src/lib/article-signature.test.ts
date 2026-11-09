import { describe, expect, it } from "vitest";
import { applySignature, extractSignature, signerName } from "./article-signature";
import { stripArticleFormatting } from "./article-format";

describe("article signatures", () => {
  it("leaves unsigned bodies untouched", () => {
    expect(extractSignature("Texte\n\nSuite")).toEqual({ body: "Texte\n\nSuite", signer: null });
  });

  it("appends and reads back a signature", () => {
    const stored = applySignature("Texte de l'article\n", "hicham");
    expect(stored).toBe("Texte de l'article\n\n[[signature:hicham]]");
    expect(extractSignature(stored)).toEqual({ body: "Texte de l'article", signer: "hicham" });
  });

  it("replaces an existing signature and can remove it", () => {
    const signed = applySignature("Texte", "hicham");
    expect(extractSignature(applySignature(signed, "redouane")).signer).toBe("redouane");
    expect(applySignature(signed, null)).toBe("Texte");
  });

  it("keeps the marker out of meta descriptions", () => {
    expect(stripArticleFormatting(applySignature("Un **texte**", "redouane"))).toBe("Un texte");
  });

  it("uses the Arabic spelling for ar", () => {
    expect(signerName("hicham", "ar")).toBe("هشام جيخ شداد");
    expect(signerName("redouane", "fr")).toBe("Redouane Jikh");
  });
});
