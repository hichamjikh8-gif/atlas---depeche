"use client";

import { useRef, useState } from "react";
import { renderArticleBody } from "@/lib/article-format";

/**
 * Body editor for hand-written articles: a plain <textarea name="body">
 * (so it posts with the surrounding Server Action form unchanged) plus a
 * small toolbar that inserts the formatting understood by
 * src/lib/article-format.tsx, and a live preview of how it will look.
 */

type Props = {
  name?: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
};

const btn: React.CSSProperties = {
  padding: "0.25rem 0.6rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  fontSize: "0.9rem",
};

export function RichEditor({ name = "body", defaultValue = "", rows = 14, required, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  function update(next: string, selStart: number, selEnd: number) {
    setValue(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  // Wrap the selection: **bold**, *italic*
  function wrap(marker: string, fallback: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || fallback;
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    update(next, s + marker.length, s + marker.length + selected.length);
  }

  // Prefix every selected line: ## , ### , > , - , 1.
  function prefixLines(prefix: string | ((i: number) => string), fallback: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const lineEndIdx = value.indexOf("\n", e);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const chunk = value.slice(lineStart, lineEnd) || fallback;
    const replaced = chunk
      .split("\n")
      .map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l.replace(/^(#{2,3}\s|>\s?|[-*]\s|\d+[.)]\s)/, ""))
      .join("\n");
    // Blocks must be separated by a blank line to be recognised.
    const before = value.slice(0, lineStart);
    const after = value.slice(lineEnd);
    const sepBefore = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const sepAfter = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const next = before + sepBefore + replaced + sepAfter + after;
    const start = before.length + sepBefore.length;
    update(next, start, start + replaced.length);
  }

  function link() {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt("Lien (https://...) / الرابط");
    if (!url || !/^https?:\/\//.test(url)) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = value.slice(s, e) || "texte du lien";
    const md = `[${text}](${url})`;
    update(value.slice(0, s) + md + value.slice(e), s + 1, s + 1 + text.length);
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 6, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          padding: "0.4rem",
          background: "#f4f4f4",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button type="button" style={{ ...btn, fontWeight: 700 }} title="Gras" onClick={() => wrap("**", "texte en gras")}>
          B
        </button>
        <button type="button" style={{ ...btn, fontStyle: "italic" }} title="Italique" onClick={() => wrap("*", "texte en italique")}>
          I
        </button>
        <button type="button" style={btn} title="Intertitre" onClick={() => prefixLines("## ", "Intertitre")}>
          H2
        </button>
        <button type="button" style={btn} title="Sous-titre" onClick={() => prefixLines("### ", "Sous-titre")}>
          H3
        </button>
        <button type="button" style={btn} title="Citation" onClick={() => prefixLines("> ", "Citation")}>
          « »
        </button>
        <button type="button" style={btn} title="Liste à puces" onClick={() => prefixLines("- ", "Élément")}>
          • Liste
        </button>
        <button type="button" style={btn} title="Liste numérotée" onClick={() => prefixLines((i) => `${i + 1}. `, "Élément")}>
          1. Liste
        </button>
        <button type="button" style={btn} title="Lien" onClick={link}>
          🔗 Lien
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={{ ...btn, background: preview ? "#2a6" : "#fff", color: preview ? "#fff" : "inherit" }}
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "✎ Écrire" : "👁 Aperçu"}
        </button>
      </div>

      {/* Textarea stays mounted (hidden in preview) so the form always posts the body. */}
      <textarea
        ref={ref}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={rows}
        required={required}
        placeholder={placeholder}
        dir="auto"
        style={{
          display: preview ? "none" : "block",
          width: "100%",
          padding: "0.6rem",
          border: "none",
          fontFamily: "system-ui",
          fontSize: "1rem",
          lineHeight: 1.6,
          boxSizing: "border-box",
          resize: "vertical",
        }}
      />
      {preview && (
        <div dir="auto" style={{ padding: "0.8rem 1rem", minHeight: "10rem", lineHeight: 1.7, background: "#fff" }}>
          {value.trim() ? renderArticleBody(value) : <p style={{ color: "#888" }}>Rien à afficher.</p>}
        </div>
      )}
      <p style={{ margin: 0, padding: "0.35rem 0.6rem", fontSize: "0.8rem", color: "#666", background: "#fafafa" }}>
        Laissez une ligne vide entre deux paragraphes. Sélectionnez du texte puis cliquez sur un bouton.
      </p>
    </div>
  );
}
