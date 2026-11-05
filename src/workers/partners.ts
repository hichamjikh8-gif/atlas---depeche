import "dotenv/config";

/**
 * Partner import worker — `npm run partners:once` (manual run; the site itself also runs it
 * every 30 min — see src/instrumentation.ts). Publishes new articles from Souss
 * Actualités and RexFoot on Atlas Dépêche as title + photo + excerpt +
 * read-more link. See src/ingest/partners.ts for the why.
 *
 * Idempotent: each original URL maps to one event (events.fingerprint =
 * partnerFingerprint(url)); already-imported URLs are skipped.
 *
 * Flags: --dry-run (fetch + print, write nothing, no DB needed),
 *        --max-age-days N (ignore older items, default 7).
 */

import { runPartnerImport } from "@/ingest/partner-import";

const args = process.argv.slice(2);
const maxAgeIdx = args.indexOf("--max-age-days");

async function main() {
  await runPartnerImport({
    dryRun: args.includes("--dry-run"),
    maxAgeDays: maxAgeIdx >= 0 ? Number(args[maxAgeIdx + 1]) || 7 : 7,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[partners] fatal:", err);
    process.exit(1);
  });
