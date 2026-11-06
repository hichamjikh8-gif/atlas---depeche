import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { uploadedImages } from "@/db/schema";
import { ensureUploadedImagesTable } from "@/lib/uploaded-images";

/** Serves a CMS-uploaded photo (see src/app/api/admin/images/route.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  await ensureUploadedImagesTable();
  const [img] = await db
    .select({ mimeType: uploadedImages.mimeType, data: uploadedImages.data })
    .from(uploadedImages)
    .where(eq(uploadedImages.id, id))
    .limit(1);
  if (!img) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
