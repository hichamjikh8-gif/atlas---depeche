"use client";

import { useRef, useState } from "react";

/**
 * Photo field for the CMS: paste a URL, or pick a photo from the phone
 * (gallery or camera) or the computer. The photo is resized in the browser
 * (max 1600 px, JPEG) and uploaded to /api/admin/images; the returned URL
 * fills the field, which posts with the form as before. Added 2026-11-06.
 */
const MAX_SIDE = 1600;

async function resizeToJpeg(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file; // keep animations
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ?? file;
}

export function ImageUpload({ name = "imageUrl", defaultValue = "" }: { name?: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    setMessage("Envoi de la photo…");
    try {
      const blob = await resizeToJpeg(file);
      const body = new FormData();
      body.append("file", blob, file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/gif" ? ".gif" : ".jpg"));
      const res = await fetch("/api/admin/images", { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `Erreur ${res.status}`);
      setUrl(data.url);
      setStatus("idle");
      setMessage("Photo ajoutée ✓");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ border: "1px dashed #bbb", borderRadius: 6, padding: "0.6rem", background: "#fafafa" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={status === "uploading"}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 6,
            border: "none",
            background: "#1d7fd8",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          📷 Ajouter une photo (téléphone / ordinateur)
        </button>
        <span style={{ fontSize: "0.85em", color: status === "error" ? "#b00020" : "#2a6" }}>{message}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <input
        name={name}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="… ou collez l'adresse d'une photo (https://...)"
        style={{ width: "100%", padding: "0.4rem", marginTop: "0.5rem", boxSizing: "border-box" }}
      />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Aperçu"
          style={{ display: "block", maxWidth: "100%", maxHeight: 180, marginTop: "0.5rem", borderRadius: 4 }}
        />
      )}
    </div>
  );
}
