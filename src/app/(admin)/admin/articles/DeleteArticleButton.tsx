"use client";

/**
 * "Supprimer" — permanently deletes an article (and, by cascade, its
 * versions/sources/social-post records). Asks for confirmation first.
 * Added 2026-11-05 at Hicham's request.
 */
export function DeleteArticleButton({ action, title }: { action: () => Promise<void>; title: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer définitivement cet article ?\n\n« ${title} »\n\nCette action est irréversible.`)) {
          e.preventDefault();
        }
      }}
      style={{ marginTop: "0.5rem", display: "inline-block" }}
    >
      <button
        type="submit"
        style={{
          background: "#b00020",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "0.35rem 0.8rem",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        🗑 Supprimer
      </button>
    </form>
  );
}
