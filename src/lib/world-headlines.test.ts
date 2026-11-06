import { describe, expect, it } from "vitest";
import { selectRecentHeadlines, type WorldHeadline } from "./world-headlines";

const now = Date.parse("2026-11-06T20:00:00Z");
const h = (title: string, hoursAgo: number, source = "RFI"): WorldHeadline => ({
  id: title,
  title,
  url: "https://example.com/" + encodeURIComponent(title),
  source,
  publishedAt: new Date(now - hoursAgo * 3600_000),
});

describe("selectRecentHeadlines", () => {
  it("keeps only the last 24 hours, newest first", () => {
    const out = selectRecentHeadlines([h("old", 30), h("a", 5), h("b", 1), h("edge", 23.9)], now);
    expect(out.map((i) => i.title)).toEqual(["b", "a", "edge"]);
  });

  it("drops duplicates and items dated in the future", () => {
    const out = selectRecentHeadlines([h("Même titre", 2, "RFI"), h("même  titre", 1, "France 24"), h("futur", -3)], now);
    expect(out).toHaveLength(1);
  });

  it("caps each source so one site cannot fill the ticker", () => {
    const many = Array.from({ length: 20 }, (_, i) => h(`t${i}`, i * 0.5, "Le Monde"));
    expect(selectRecentHeadlines(many, now)).toHaveLength(8);
  });
});
