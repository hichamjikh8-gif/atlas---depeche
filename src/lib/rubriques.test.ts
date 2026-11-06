import { describe, expect, it } from "vitest";
import { RUBRIQUES, getRubrique, mapPartnerCategories, rubriqueForCategory } from "./rubriques";

describe("rubriques", () => {
  it("has the six requested sections", () => {
    expect(RUBRIQUES.map((r) => r.slug)).toEqual(["actualite", "international", "sport", "crypto", "divers", "publicite"]);
    expect(getRubrique("sport")?.fr).toBe("Sport");
    expect(getRubrique("nope")).toBeUndefined();
  });

  it("maps event categories to rubriques, unknown → Actualité", () => {
    expect(rubriqueForCategory("sports").slug).toBe("sport");
    expect(rubriqueForCategory("international").slug).toBe("international");
    expect(rubriqueForCategory("culture").slug).toBe("divers");
    expect(rubriqueForCategory("whatever").slug).toBe("actualite");
  });

  it("maps Souss Actualités WordPress categories (FR + AR)", () => {
    expect(mapPartnerCategories(["International"], "news")).toBe("international");
    expect(mapPartnerCategories(["L'Actu du jour", "Sport"], "news")).toBe("sports");
    expect(mapPartnerCategories(["دولي"], "news")).toBe("international");
    expect(mapPartnerCategories(["Culture"], "news")).toBe("culture");
    expect(mapPartnerCategories(["Actualités"], "news")).toBe("news");
    expect(mapPartnerCategories([], "sports")).toBe("sports");
  });
});
