import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Makes sure the uploaded_images table exists (same DDL as
 * drizzle/0013_modern_dark_beast.sql). Migrations are applied explicitly on
 * this project, so the first upload after deploy creates the table itself if
 * nobody ran the migration yet. Idempotent; runs once per server process.
 */
let ensured: Promise<void> | null = null;

export function ensureUploadedImagesTable(): Promise<void> {
  ensured ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS "uploaded_images" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "mime_type" text NOT NULL,
        "data" bytea NOT NULL,
        "byte_size" integer NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )`,
    )
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      throw err;
    });
  return ensured;
}

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Checks the real file signature, not just the declared type. */
export function sniffImageType(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP")
    return "image/webp";
  if (buf.length >= 6 && String.fromCharCode(...buf.slice(0, 4)) === "GIF8") return "image/gif";
  return null;
}
