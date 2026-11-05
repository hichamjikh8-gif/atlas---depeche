import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

describe("articleOriginName", () => {
  it("credits partners only for imported articles", async () => {
    const { articleOriginName } = await import("./public-site");
    expect(
      articleOriginName("Résumé\n\n[Lire l'article complet sur Souss Actualités →](https://souss-actualites.com/2026/x/)"),
    ).toBe("Souss Actualités");
    expect(articleOriginName("[Lire l'article complet sur RexFoot →](https://rexfoot.com/news/a)")).toBe("RexFoot");
    expect(articleOriginName("[اقرأ المقال كاملاً على سوس أكتواليتي ←](https://souss-actualites.com/a/)")).toBe(
      "Souss Actualités",
    );
    expect(articleOriginName("Il revient sur souss-actualites.com, en français et en arabe.")).toBe("Atlas Dépêche");
  });
});
