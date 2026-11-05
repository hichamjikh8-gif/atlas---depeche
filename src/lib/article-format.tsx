import type { ReactNode } from "react";
import { linkifyText } from "@/lib/linkify";

/**
 * Article body formatting — a small, safe Markdown subset used by the
 * hand-written article editor in /admin/articles.
 *
 * Supported (everything else stays plain text, so old plain-text bodies
 * render exactly as before):
 *   blocks, separated by a blank line:
 *     ## Title            -> <h2>
 *     ### Subtitle        -> <h3>
 *     > quote             -> <blockquote>
 *     - item / * item     -> <ul>
 *     1. item             -> <ol>
 *     anything else       -> <p> (single line breaks kept as <br>)
 *   inline:
 *     **bold**, *italic*, [text](https://link), bare URLs (linkified)
 *
 * Never emits raw HTML: every piece of text goes through React, so a body
 * containing "<script>" is shown as text, not executed. Links only accept
 * http(s) URLs.
 */

const INLINE_PATTERN = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  text.split(INLINE_PATTERN).forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
      return;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
      return;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      nodes.push(
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>
          {link[1]}
        </a>,
      );
      return;
    }
    linkifyText(part).forEach((n, j) => nodes.push(typeof n === "string" ? n : <span key={`${key}-${j}`}>{n}</span>));
  });
  return nodes;
}

function renderLines(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split("\n").forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br-${i}`} />);
    out.push(...renderInline(line, `${keyPrefix}-${i}`));
  });
  return out;
}

export function renderArticleBody(body: string): ReactNode[] {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return blocks
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((block, i) => {
      const key = `b${i}`;
      if (block.startsWith("### ")) {
        return (
          <h3 key={key} style={{ fontSize: "var(--text-xl)", marginBlock: "var(--space-6) var(--space-3)" }}>
            {renderInline(block.slice(4), key)}
          </h3>
        );
      }
      if (block.startsWith("## ")) {
        return (
          <h2 key={key} style={{ fontSize: "var(--text-2xl)", marginBlock: "var(--space-6) var(--space-3)" }}>
            {renderInline(block.slice(3), key)}
          </h2>
        );
      }
      const lines = block.split("\n");
      if (lines.every((l) => l.startsWith(">"))) {
        const inner = lines.map((l) => l.replace(/^>\s?/, "")).join("\n");
        return (
          <blockquote
            key={key}
            style={{
              borderInlineStart: "4px solid var(--color-accent)",
              paddingInlineStart: "var(--space-4)",
              marginInline: 0,
              marginBlockEnd: "var(--space-4)",
              fontStyle: "italic",
            }}
          >
            {renderLines(inner, key)}
          </blockquote>
        );
      }
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return (
          <ul key={key} style={{ marginBlockEnd: "var(--space-4)", paddingInlineStart: "1.5em" }}>
            {lines.map((l, j) => (
              <li key={j}>{renderInline(l.replace(/^[-*]\s+/, ""), `${key}-${j}`)}</li>
            ))}
          </ul>
        );
      }
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
        return (
          <ol key={key} style={{ marginBlockEnd: "var(--space-4)", paddingInlineStart: "1.5em" }}>
            {lines.map((l, j) => (
              <li key={j}>{renderInline(l.replace(/^\d+[.)]\s+/, ""), `${key}-${j}`)}</li>
            ))}
          </ol>
        );
      }
      return (
        <p key={key} style={{ marginBlockEnd: "var(--space-4)" }}>
          {renderLines(block, key)}
        </p>
      );
    });
}

/** Plain-text version of a formatted body — for meta descriptions/excerpts. */
export function stripArticleFormatting(body: string): string {
  return body
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
