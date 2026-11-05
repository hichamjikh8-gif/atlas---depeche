/**
 * Public base URL of the site, without trailing slash. Uses SITE_URL when it
 * is a real public address; falls back to the production domain otherwise
 * (an unset or localhost SITE_URL in production made robots.txt and the
 * sitemap point Google at http://localhost:3000 — found 2026-11-05).
 */
export const PRODUCTION_SITE_URL = "https://www.xn--atlasdpche-g7an.com";

export function getSiteUrl(): string {
  const env = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (env && !/localhost|127\.0\.0\.1|code\.run/.test(env)) return env;
  if (process.env.NODE_ENV !== "production" && env) return env;
  return PRODUCTION_SITE_URL;
}
