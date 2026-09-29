"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loading a font file into the document, and the client-side half of the
 * render contract.
 *
 * The PDF is rendered by Pillow (`backend/cert_engine.py`). The editor's canvas
 * is rendered by the browser. They are two different text engines, so the
 * canvas can only ever approximate the PDF — but it should approximate it
 * using the *same typeface at the same fitted size*, rather than a system font
 * at the un-fitted size. That is what this module provides. `CertPreview`
 * remains the authoritative render.
 */

// Each loaded face gets a fresh family name. React re-invokes effects in dev,
// and re-selecting a font after re-uploading a file under the same path would
// otherwise hand back the stale face the browser cached first.
let faceSequence = 0;

export interface FontFaceState {
  /** CSS family name to use, or null while loading / on failure. */
  family: string | null;
  error: string | null;
}

/**
 * Fetch a font file and register it with the document.
 *
 * Fetched as bytes rather than pointed at with `new FontFace(name, "url(...)")`
 * on purpose: a cross-origin `FontFace` rejection is a DOMException carrying no
 * status, so a 404, a CORS refusal, and a corrupt file are indistinguishable.
 * Reading the bytes through `fetch` gives a real status and a real message.
 */
export function useFontFace(url: string | null | undefined): FontFaceState {
  const [state, setState] = useState<FontFaceState>({ family: null, error: null });
  const faceRef = useRef<FontFace | null>(null);

  useEffect(() => {
    if (!url) {
      setState({ family: null, error: null });
      return;
    }
    if (typeof document === "undefined" || typeof FontFace === "undefined") return;

    let cancelled = false;
    const name = `certface-${++faceSequence}`;

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load the font (HTTP ${res.status}).`);
        const buffer = await res.arrayBuffer();
        const face = new FontFace(name, buffer);
        await face.load();
        if (cancelled) return;
        document.fonts.add(face);
        faceRef.current = face;
        setState({ family: name, error: null });
      } catch (e: any) {
        if (cancelled) return;
        // The canvas falls back to a system face rather than going blank, so
        // say so instead of leaving the user to notice the typeface is wrong.
        setState({
          family: null,
          error: e?.message ?? "Could not load the font.",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (faceRef.current) {
        document.fonts.delete(faceRef.current);
        faceRef.current = null;
      }
    };
  }, [url]);

  return state;
}

// ─── Fitting ──────────────────────────────────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    // `EventForm` is prerendered, so this runs on the server too. Today the
    // family is always null at that point — it arrives with a client fetch —
    // and the early return below means the context is never asked for. That
    // ordering is load-bearing and invisible, so it isn't relied on.
    measureCtx = typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

const cssStyle = (style: string) =>
  `${style === "italic" || style === "bold_italic" ? "italic " : ""}${
    style === "bold" || style === "bold_italic" ? "700" : "400"
  }`;

/**
 * The size the name will actually render at, mirroring `cert_engine.fit_font`.
 *
 * Same 2px steps, same floor of 10, and — importantly — the same *ink* width:
 * Pillow's `getbbox()` measures ink while `measureText().width` measures
 * advance, and the two differ by a few pixels that grow with size. Returns a
 * size in template pixels; multiply by the canvas scale for display.
 */
export function fitFontSize(
  text: string,
  baseSize: number,
  maxWidth: number,
  family: string | null,
  style: string
): number {
  if (!family || !text) return baseSize;
  const ctx = getMeasureContext();
  if (!ctx) return baseSize;

  let size = baseSize;
  while (size >= 10) {
    ctx.font = `${cssStyle(style)} ${size}px "${family}"`;
    const m = ctx.measureText(text);
    const ink = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0);
    const width = ink > 0 ? ink : m.width;
    if (width <= maxWidth) return size;
    size -= 2;
  }
  // fit_font returns the floor size whether or not it fits; a name longer than
  // max_width is truncated by the template edge in both renderers.
  return 10;
}
