/**
 * Runs once when the Next.js server starts (see Next.js `instrumentation`
 * file convention). Starts the partner import loop inside the web server
 * itself — Souss Actualités + RexFoot every 30 min — so it works on the
 * always-on Northflank service with the DATABASE_URL it already has, with
 * no GitHub Actions secret or separate cron job to configure.
 * Added 2026-11-05. Disable with PARTNERS_AUTO_IMPORT=false.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PARTNERS_AUTO_IMPORT === "false") return;
  if (!process.env.DATABASE_URL) return;

  const intervalMin = Number(process.env.PARTNERS_IMPORT_INTERVAL_MIN ?? 30) || 30;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { pauseRadarSources, runPartnerImport } = await import("./ingest/partner-import");
      await pauseRadarSources();
      await runPartnerImport();
    } catch (err) {
      console.error("[partners] scheduled import failed:", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };

  // Don't block server startup: first pass 1 minute after boot, then on the interval.
  setTimeout(() => void tick(), 60_000).unref?.();
  setInterval(() => void tick(), intervalMin * 60_000).unref?.();
}
