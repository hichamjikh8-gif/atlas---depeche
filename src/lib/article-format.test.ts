import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderArticleBody, stripArticleFormatting } from "./article-format";

const html = (body: string) => renderToStaticMarkup(createElement(Fragment, null, ...renderArticleBody(body)));

describe("renderArticleBody", () => {
  it("keeps plain-text paragraphs as before", () => {
    expect(html("Un.\n\nDeux.")).toBe(
      '<p style="margin-block-end:var(--space-4)">Un.</p><p style="margin-block-end:var(--space-4)">Deux.</p>',
    );
  });

  it("renders headings, bold, italic, links, lists and quotes", () => {
    const out = html("## Titre\n\n**gras** et *ital* [lien](https://a.ma/x)\n\n- a\n- b\n\n1. un\n2. deux\n\n> cité");
    expect(out).toContain("<h2");
    expect(out).toContain("<strong>gras</strong>");
    expect(out).toContain("<em>ital</em>");
    expect(out).toContain('href="https://a.ma/x"');
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out).toContain("<blockquote");
  });

  it("never emits raw HTML or non-http links", () => {
    const out = html('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain('href="javascript');
  });
});

describe("stripArticleFormatting", () => {
  it("returns plain text", () => {
    expect(stripArticleFormatting("## T\n\n**a** *b* [c](https://x.ma)")).toBe("T a b c");
  });
});
