import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { auditLogs, uploadedImages } from "@/db/schema";
import { isAdminSession } from "@/lib/require-admin";
import { getSiteUrl } from "@/lib/site-url";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, ensureUploadedImagesTable, sniffImageType } from "@/lib/uploaded-images";

/**
 * Photo upload for the CMS (phone or computer) — POST multipart field "file".
 * Admin session required. Returns { url } pointing at /media/<id>.
 */
export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image trop lourde (6 Mo maximum)" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(bytes);
  if (!mimeType || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Format non accepté (JPEG, PNG, WebP ou GIF)" }, { status: 415 });
  }

  await ensureUploadedImagesTable();
  const [row] = await db
    .insert(uploadedImages)
    .values({ mimeType, data: Buffer.from(bytes), byteSize: bytes.length })
    .returning({ id: uploadedImages.id });
  if (!row) return NextResponse.json({ error: "Échec de l'enregistrement" }, { status: 500 });

  await db.insert(auditLogs).values({
    entityType: "image",
    entityId: row.id,
    action: "uploaded",
    actorType: "human",
    details: { mimeType, byteSize: bytes.length, originalName: file.name.slice(0, 200) },
  });

  return NextResponse.json({ url: `${getSiteUrl()}/media/${row.id}` });
}
