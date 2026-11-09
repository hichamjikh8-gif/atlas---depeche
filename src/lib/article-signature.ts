/**
 * Article signatures — added 2026-11-09 at Hicham's request: an article can
 * be signed by Hicham Jikh Cheddad or Redouane Jikh, shown at the bottom in
 * the same gold handwritten style as the names on the "Mentions légales"
 * page.
 *
 * Stored as a marker on its own last line of `articles.body`
 * ("[[signature:hicham]]"), not a new DB column: no migration, nothing to
 * change on existing rows. The admin form manages the marker (a select), so
 * editors never type it; the public renderer turns it into the signature.
 */

export type SignerId = "hicham" | "redouane";

export const SIGNERS: Record<SignerId, { fr: string; ar: string }> = {
  hicham: { fr: "Hicham Jikh Cheddad", ar: "هشام جيخ شداد" },
  redouane: { fr: "Redouane Jikh", ar: "رضوان جيخ" },
};

export function isSignerId(value: unknown): value is SignerId {
  return value === "hicham" || value === "redouane";
}

const MARKER_LINE = /^[ \t]*\[\[signature:(hicham|redouane)\]\][ \t]*$/gm;

/** Splits a stored body into the text the editor sees and its signer. */
export function extractSignature(body: string): { body: string; signer: SignerId | null } {
  let signer: SignerId | null = null;
  const stripped = body.replace(MARKER_LINE, (_m, id: string) => {
    if (isSignerId(id)) signer = id;
    return "";
  });
  return { body: signer ? stripped.replace(/\s+$/, "") : body, signer };
}

/** Body to store: any old marker removed, the chosen one appended. */
export function applySignature(body: string, signer: SignerId | null): string {
  const clean = extractSignature(body).body.replace(/\s+$/, "");
  return signer ? `${clean}\n\n[[signature:${signer}]]` : clean;
}

export function signerName(signer: SignerId, locale: string): string {
  return locale === "ar" ? SIGNERS[signer].ar : SIGNERS[signer].fr;
}
