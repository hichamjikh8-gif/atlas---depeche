"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Plays a short, soft "news" chime when new headlines appear in the
 * EN DIRECT ticker (requested 2026-11-09). The ticker is refreshed in the
 * background every 5 minutes so new headlines show up without a reload.
 *
 * Browsers block sound until the visitor has interacted with the page
 * (click/tap/key), so a chime due before that is kept and played on the
 * first interaction. Seen headline ids are remembered per visitor in
 * localStorage so the same headlines never chime twice.
 */
const STORAGE_KEY = "ad_ticker_seen_v1";
const REFRESH_MS = 5 * 60 * 1000;

function readSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 200)));
  } catch {
    /* storage unavailable: ignore */
  }
}

let audioCtx: AudioContext | null = null;

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === "suspended") return false;
    const ctx = audioCtx;
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    // Three soft bell notes (E6, G#6, B6) — a bright, pleasant "news" chime.
    [1318.5, 1661.2, 1975.5].forEach((freq, i) => {
      const start = t0 + i * 0.12;
      [1, 2.76].forEach((mult, k) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(k === 0 ? 0.9 : 0.15, start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, start + (k === 0 ? 1.4 : 0.5));
        osc.connect(g).connect(master);
        osc.start(start);
        osc.stop(start + 1.5);
      });
    });
    return true;
  } catch {
    return false;
  }
}

export function TickerChime({ ids }: { ids: string[] }) {
  const router = useRouter();
  const pending = useRef(false);
  const key = ids.join("|");

  // Detect new headlines whenever the list changes.
  useEffect(() => {
    if (ids.length === 0) return;
    const seen = readSeen();
    const hasNew = seen !== null && ids.some((id) => !seen.has(id));
    writeSeen(ids);
    if (hasNew && !playChime()) pending.current = true;
  }, [key]);

  // Unlock audio on first interaction and play a waiting chime.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          audioCtx = audioCtx ?? new Ctx();
          void audioCtx.resume().then(() => {
            if (pending.current && playChime()) pending.current = false;
          });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Refresh the ticker in the background so new headlines arrive live.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [router]);

  return null;
}
