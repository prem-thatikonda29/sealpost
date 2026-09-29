"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CertPreview } from "@/components/CertPreview";
import { FontPicker, type FontSelection } from "@/components/FontPicker";
import { fitFontSize, useFontFace } from "@/lib/fonts";
import {
  fontFileUrl,
  listFonts,
  templateUrl,
  uploadFont,
  uploadTemplate,
  type Event,
  type FontEntry,
} from "@/lib/api";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  font_size: z.coerce.number().min(8).max(300),
  font_style: z.string(),
  font_color: z.string(),
  max_text_width: z.coerce.number().min(100),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<Event>;
  onSave: (data: Partial<Event>) => Promise<void>;
  saving?: boolean;
}

// ─── Canvas overlay text renderer ─────────────────────────────────────────────

interface OverlayProps {
  templateUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  posX: number;
  posY: number;
  /** The size asked for. */
  fontSize: number;
  /** The size the PDF will actually use, after fit_font's shrink. */
  fittedSize: number;
  fontStyle: string;
  fontColor: string;
  fontFamily: string | null;
  maxTextWidth: number;
  sampleText: string;
  onPositionChange: (x: number, y: number) => void;
}

/* Keyboard nudge. Shift is the coarse step for crossing a wide certificate
   quickly; 1px is fine enough to centre a name exactly. */
const NUDGE_FINE = 1;
const NUDGE_COARSE = 10;

const NUDGE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/* Never clamp to exactly 0: "0" is this app's sentinel for *no position*, so a
   nudge to the left or top edge would make the name disappear instead of
   sitting against the border. 1px is inside the frame and still placed. */
const clampTo = (v: number, max: number) => Math.max(1, Math.min(max - 1, v));

function CertCanvas({
  templateUrl,
  naturalWidth,
  naturalHeight,
  posX,
  posY,
  fontSize,
  fittedSize,
  fontStyle,
  fontColor,
  fontFamily,
  maxTextWidth,
  sampleText,
  onPositionChange,
}: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [focused, setFocused] = useState(false);

  // Click on canvas → compute original-space coords
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!naturalWidth || !naturalHeight) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / naturalWidth;
    const ox = Math.round((e.clientX - rect.left) / scale);
    const oy = Math.round((e.clientY - rect.top) / scale);
    onPositionChange(ox, oy);
  };

  // For text overlay we need a reactive scale — track container width via state
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.getBoundingClientRect().width));
    ro.observe(el);
    setContainerW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const scale = naturalWidth > 0 && containerW > 0 ? containerW / naturalWidth : 0;
  const textDisplayX = posX * scale;
  const textDisplayY = posY * scale;
  const displayFontSize = Math.max(fittedSize * scale, 8);

  const isBold = fontStyle === "bold" || fontStyle === "bold_italic";
  const isItalic = fontStyle === "italic" || fontStyle === "bold_italic";
  const hasPosition = posX > 0 && posY > 0;

  // fit_font only shrinks once the name would overflow max_text_width, so a
  // fitted size below the asked-for one means the limit is doing something.
  const atLimit = fittedSize < fontSize;

  /* The name is centred on the anchor, so the width it may occupy runs half of
     maxTextWidth either side of it. These are those two lines — not a box:
     max_text_width bounds the span horizontally and says nothing about height,
     and a box would imply a vertical limit the renderer does not have.

     Near an edge the limit runs off the template. Clamping to the canvas and
     drawing those lines solid is the difference between "the boundary is
     exactly here" and "the boundary carries on past this edge" — without it a
     placed-near-the-edge name would show one line and look broken. */
  const halfSpan = (maxTextWidth * scale) / 2;
  const rawLeft = textDisplayX - halfSpan;
  const rawRight = textDisplayX + halfSpan;
  const guides = [
    { at: Math.max(0, rawLeft), clipped: rawLeft < 0 },
    { at: Math.min(containerW, rawRight), clipped: rawRight > containerW },
  ];

  /* Centre is the keyboard equivalent of "where the pointer would have
     clicked" — the neutral starting point when nothing is placed yet. */
  const centre = () => ({
    x: Math.round(naturalWidth / 2),
    y: Math.round(naturalHeight / 2),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!naturalWidth || !naturalHeight) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const c = centre();
      onPositionChange(c.x, c.y);
      return;
    }

    const dir = NUDGE_KEYS[e.key];
    if (!dir) return;

    // Arrow keys must not scroll the page — this element owns them while focused.
    e.preventDefault();

    const step = e.shiftKey ? NUDGE_COARSE : NUDGE_FINE;
    const from = hasPosition ? { x: posX, y: posY } : centre();
    onPositionChange(
      clampTo(from.x + dir[0] * step, naturalWidth),
      clampTo(from.y + dir[1] * step, naturalHeight)
    );
  };

  return (
    <div
      ref={containerRef}
      role="application"
      tabIndex={0}
      aria-label="Certificate name position"
      aria-describedby={hintId}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space"
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={
        naturalWidth && naturalHeight
          ? { aspectRatio: `${naturalWidth} / ${naturalHeight}` }
          : { minHeight: 320 }
      }
      onClick={handleClick}
    >
      {/* Keyboard path. The hint is read on focus; the readout announces each
          nudge, so a non-visual user gets the same feedback as the coordinate
          display gives a sighted one. */}
      <span id={hintId} className="sr-only">
        Certificate name position. Use the arrow keys to move the name, or hold
        Shift with an arrow key to move ten pixels at a time. Press Enter to
        place it at the centre. The two vertical lines mark the widest the name
        may run; a longer name is shrunk to stay inside them.
      </span>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {hasPosition ? `${posX} by ${posY} pixels` : "Not placed yet"}
      </span>
      {/* Template image — normal flow, sizes the container via aspect-ratio */}
      {templateUrl ? (
        <img
          src={templateUrl}
          alt="Certificate template"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hair-hover bg-muted">
          <p className="text-[13px] text-muted-foreground">
            No template yet
          </p>
          <p className="text-[12px] text-muted-foreground">
            Upload a JPEG or PNG to start placing the name
          </p>
        </div>
      )}

      {/* Max-width guides. Drawn under the name so the type always reads on
          top of them, and only once placed — the span is centred on the
          anchor, so before placement there is nothing to centre it on. They
          brighten when the name is actually being shrunk, which is the moment
          the number in the sidebar stops being abstract. */}
      {hasPosition && templateUrl && scale > 0 && maxTextWidth > 0 && (
        <>
          {guides.map((g, i) => (
            <div
              key={i}
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 border-l transition-colors duration-150 ${
                g.clipped
                  ? "border-solid border-terra-ink"
                  : atLimit
                    ? "border-dashed border-terra-ink"
                    : "border-dashed border-terra-ink/45"
              }`}
              style={{ left: g.at }}
            />
          ))}
        </>
      )}

      {/* Live text overlay — only render once we have a valid scale */}
      {hasPosition && templateUrl && scale > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: textDisplayX,
            top: textDisplayY,
            transform: "translate(-50%, -50%)",
            fontSize: displayFontSize,
            fontWeight: isBold ? 700 : 400,
            fontStyle: isItalic ? "italic" : "normal",
            color: fontColor,
            // The real face, from the same file the PDF renders with. Only
            // falls back while the file is loading, or if it failed to load.
            fontFamily: fontFamily ? `"${fontFamily}", var(--font-sans)` : undefined,
            whiteSpace: "nowrap",
            // Pillow's "mm" anchor centres on the ascent/descent midline, which
            // an em box (line-height 1) approximates. No text shadow: the PDF
            // has none, and adding one here would be a preview that lies.
            lineHeight: 1,
          }}
        >
          {sampleText || "Sample Name"}
        </div>
      )}

      {/* Anchor marker at the placement point */}
      {hasPosition && templateUrl && (
        <div
          className="pointer-events-none absolute"
          style={{ left: textDisplayX, top: textDisplayY }}
        >
          <div
            className="absolute rounded-full border border-canvas bg-terra-ink"
            style={{ width: 8, height: 8, transform: "translate(-50%, -50%)" }}
          />
        </div>
      )}

      {/* Click hint when no position set */}
      {!hasPosition && templateUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <span className="max-w-[90%] rounded-[3px] bg-ink/75 px-2.5 py-1 text-center font-mono text-[11px] tracking-[0.08em] text-canvas uppercase">
            {focused
              ? "Arrow keys to place · Enter for centre"
              : "Click to place the name"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main EventForm ────────────────────────────────────────────────────────────

const SIZE_PRESETS = [24, 36, 48, 64];
const COLOR_PRESETS = [
  "#000000",
  "#ffffff",
  "#1a1a2e",
  "#c8a96e",
  "#2c3e50",
  "#e74c3c",
];

/* The id of the family to fall back to when an event has no font saved yet.
   Pinning the default to a real file (rather than letting font_path stay empty
   and the PDF use the server's own fallback) is what keeps the canvas honest:
   an empty font_path means the canvas and the PDF would render different
   typefaces. */
const DEFAULT_FONT_ID = "inter";

const ALL_STYLES = ["normal", "bold", "italic"] as const;

/** Whether a family ships a real file for this style. `_load_font` silently
 *  falls back to the regular face when a variant is missing, so offering a
 *  style that does not exist produces a canvas and a PDF that disagree. */
function styleAvailable(styles: string[], style: string): boolean {
  if (style === "normal") return true;
  if (style === "bold_italic") return styles.includes("bold") && styles.includes("italic");
  return styles.includes(style);
}

/** `uploads/fonts/<uuid>_Inter.ttf` → `Inter`. Used for fonts that were
 *  uploaded in a previous session, where the response's `family` is long gone. */
function uploadedFontLabel(path: string): string {
  const filename = path.split("/").pop() ?? "";
  const bare = filename.length > 37 ? filename.slice(37) : filename;
  return bare.replace(/\.(ttf|otf)$/i, "") || "Uploaded font";
}

export function EventForm({ initial, onSave, saving }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      font_size: initial?.font_size ?? 48,
      font_style: initial?.font_style ?? "normal",
      font_color: initial?.font_color ?? "#000000",
      max_text_width: initial?.max_text_width ?? 1400,
    },
  });

  const [templatePath, setTemplatePath] = useState(initial?.template_path ?? "");
  const [templateNW, setTemplateNW] = useState(initial?.template_natural_width ?? 0);
  const [templateNH, setTemplateNH] = useState(initial?.template_natural_height ?? 0);
  const [templateDisplayUrl, setTemplateDisplayUrl] = useState(
    initial?.template_path ? templateUrl(initial.template_path) : ""
  );
  const [fontSelection, setFontSelection] = useState<FontSelection | null>(null);
  const [catalog, setCatalog] = useState<FontEntry[] | null>(null);
  const [uploadingFont, setUploadingFont] = useState(false);
  const [fontUploadError, setFontUploadError] = useState<string | null>(null);
  const [posX, setPosX] = useState(initial?.text_position_x ?? 0);
  const [posY, setPosY] = useState(initial?.text_position_y ?? 0);
  const [sampleText, setSampleText] = useState("Sample Name");
  const [uploading, setUploading] = useState(false);

  const formValues = watch();

  // The face actually registered in the document, and whether it failed. The
  // canvas falls back to a system font on failure, so the error has to be shown
  // somewhere — otherwise the only symptom is a subtly wrong typeface.
  const { family: fontFamily, error: fontFaceError } = useFontFace(
    fontSelection?.url ?? null
  );

  // Measured once here and shared by the canvas and the caption beneath it, so
  // the two cannot disagree about whether the name is being shrunk. Returns
  // the size asked for until the face has loaded — measuring against the
  // fallback face would give a size for the wrong typeface.
  const fittedSize = fitFontSize(
    sampleText || "Sample Name",
    formValues.font_size,
    formValues.max_text_width,
    fontFamily,
    formValues.font_style
  );

  // Fetch the vendored catalog once. Held as `null` until it lands so the
  // selection effect below can tell "no fonts" from "not loaded yet".
  useEffect(() => {
    let cancelled = false;
    listFonts()
      .then((fonts) => {
        if (!cancelled) setCatalog(fonts);
      })
      .catch(() => {
        // Not fatal: uploaded fonts resolve without the catalog, and the picker
        // renders an empty list with its upload affordance still available.
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve the saved font_path once — into a selection the picker and the
  // canvas can both use. Runs again when the catalog arrives, because a
  // vendored path cannot be turned into a URL without it.
  const initialFontResolved = useRef(false);
  useEffect(() => {
    if (initialFontResolved.current || catalog === null) return;

    const saved = initial?.font_path ?? "";
    if (saved) {
      const entry = catalog.find((f) => f.path === saved);
      const url = entry?.url ?? fontFileUrl(saved, catalog);
      if (url) {
        initialFontResolved.current = true;
        setFontSelection(
          entry
            ? {
                path: entry.path,
                url: entry.url,
                label: entry.label,
                styles: entry.styles,
              }
            : {
                path: saved,
                url,
                label: uploadedFontLabel(saved),
                // An upload is a single file; nothing probes for siblings, so
                // the regular face is all this typeface can actually render.
                styles: ["normal"],
                uploaded: true,
              }
        );
        return;
      }
    }

    const fallback = catalog.find((f) => f.id === DEFAULT_FONT_ID) ?? catalog[0];
    if (!fallback) return;
    initialFontResolved.current = true;
    setFontSelection({
      path: fallback.path,
      url: fallback.url,
      label: fallback.label,
      styles: fallback.styles,
    });
  }, [catalog, initial?.font_path]);

  // A style the selected family has no file for renders as the regular weight
  // in the PDF while the canvas fakes it with CSS. Snap the form back to a
  // style that exists rather than letting the two disagree.
  useEffect(() => {
    if (!fontSelection) return;
    if (!styleAvailable(fontSelection.styles, formValues.font_style)) {
      setValue("font_style", "normal");
    }
  }, [fontSelection, formValues.font_style, setValue]);

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadTemplate(file);
      // Use the server's path rather than rebuilding it from `file.name`: the
      // route strips any directory components before writing, so a browser
      // that reports a path would otherwise leave the two disagreeing.
      setTemplatePath(res.path);
      setTemplateNW(res.natural_width);
      setTemplateNH(res.natural_height);
      setTemplateDisplayUrl(templateUrl(res.path));
      // Reset position when template changes
      setPosX(0);
      setPosY(0);
    } finally {
      setUploading(false);
    }
  };

  const handleFontUpload = async (file: File) => {
    setUploadingFont(true);
    setFontUploadError(null);
    try {
      const res = await uploadFont(file);
      setFontSelection({
        path: res.path,
        url: res.url,
        label: res.family || file.name.replace(/\.(ttf|otf)$/i, ""),
        styles: ["normal"],
        uploaded: true,
      });
    } catch (e: any) {
      // The old handler had a `finally` but no `catch`, so a rejected upload
      // left the sidebar silently unchanged and font_path empty forever.
      const detail = e?.response?.data?.detail;
      setFontUploadError(
        typeof detail === "string" ? detail : (e?.message ?? "Could not upload that font.")
      );
    } finally {
      setUploadingFont(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    await onSave({
      ...values,
      template_path: templatePath || undefined,
      template_natural_width: templateNW || undefined,
      template_natural_height: templateNH || undefined,
      font_path: fontSelection?.path || undefined,
      text_position_x: posX || undefined,
      text_position_y: posY || undefined,
    });
  };

  // ── Layout: full-width canvas + fixed right sidebar ──────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ── Identity bar ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="event-name" className="label-mono block">
              Event name
            </label>
            <Input
              id="event-name"
              {...register("name")}
              placeholder="e.g. Hackathon 2026 — Finalists"
              aria-invalid={!!errors.name}
              className="mt-1.5 h-9 rounded-none border-0 border-b border-transparent bg-transparent px-0 text-[15px] font-semibold shadow-none focus-visible:border-ring focus-visible:ring-0"
            />
            {errors.name && (
              <p className="mt-1 text-[12px] text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <label htmlFor="event-description" className="label-mono block">
              Description
            </label>
            <Input
              id="event-description"
              {...register("description")}
              placeholder="Optional — for your own reference"
              className="mt-1.5 h-9 rounded-none border-0 border-b border-transparent bg-transparent px-0 text-[13px] shadow-none focus-visible:border-ring focus-visible:ring-0"
            />
          </div>
        </div>

        <Button type="submit" disabled={saving || uploading || uploadingFont} size="sm">
          {saving ? "Saving…" : "Save event"}
        </Button>
      </div>

      {/* ── Editor split ────────────────────────────────────────────────────── */}
      <div className="flex min-h-[540px] overflow-hidden rounded-lg border border-border">
        {/* ── Left: canvas ──────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-surface-raised p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <span className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[13px] font-medium transition-colors duration-150 hover:border-hair-hover hover:bg-surface-raised">
                {uploading
                  ? "Uploading…"
                  : templateDisplayUrl
                    ? "Replace template"
                    : "Upload template"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="hidden"
                onChange={handleTemplateUpload}
                disabled={uploading}
              />
            </label>

            {templateNW > 0 && (
              <span className="font-mono text-[12px] text-muted-foreground tabular">
                {templateNW} × {templateNH}
              </span>
            )}

            {posX > 0 && posY > 0 && (
              <span className="ml-auto font-mono text-[12px] text-muted-foreground tabular">
                x {posX} · y {posY}
              </span>
            )}
          </div>

          <CertCanvas
            templateUrl={templateDisplayUrl}
            naturalWidth={templateNW}
            naturalHeight={templateNH}
            posX={posX}
            posY={posY}
            fontSize={formValues.font_size}
            fittedSize={fittedSize}
            fontStyle={formValues.font_style}
            fontColor={formValues.font_color}
            fontFamily={fontFamily}
            maxTextWidth={formValues.max_text_width}
            sampleText={sampleText}
            onPositionChange={(x, y) => {
              setPosX(x);
              setPosY(y);
            }}
          />

          <p className="max-w-[70ch] text-[12px] leading-relaxed text-muted-foreground">
            Click the template to place the name — or tab to it and nudge with
            the arrow keys. Hold Shift for 10px steps.
          </p>

          {/* Says in words what the guides show. The number lives in the
              sidebar, but whether it is currently costing the user anything is
              only visible here. */}
          {templatePath && posX > 0 && posY > 0 && (
            <p className="max-w-[70ch] text-[12px] leading-relaxed text-muted-foreground">
              {fittedSize < formValues.font_size ? (
                <>
                  The name is wider than {formValues.max_text_width}px, so it is
                  being shrunk to fit —{" "}
                  <span className="font-mono tabular text-terra-ink">
                    {formValues.font_size}px → {fittedSize}px
                  </span>
                  . Raise Max width, or shorten the name, to keep it larger.
                </>
              ) : (
                <>
                  The dashed lines mark the {formValues.max_text_width}px width
                  limit. A name wider than that is shrunk to stay inside them.
                </>
              )}
            </p>
          )}

          {fontFaceError && (
            <p role="alert" className="text-[12px] leading-relaxed text-rose-ink">
              {fontFaceError} The canvas is showing a fallback face
              {fontSelection?.label ? `; the certificate still uses ${fontSelection.label}` : ""}.
            </p>
          )}

          {/* The canvas is the browser's text engine and the PDF is Pillow's.
              They cannot be made to agree glyph for glyph, so the honest move
              is to offer the real render rather than claim the canvas is
              exact. Mounted only once there is something to render, so opening
              the disclosure is never a dead end. */}
          {templatePath && posX > 0 && posY > 0 && (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase transition-colors duration-150 hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">
                  ▸
                </span>
                Check exact output
              </summary>
              <div className="mt-3">
                <CertPreview
                  params={{
                    template_path: templatePath,
                    text_position_x: posX,
                    text_position_y: posY,
                    font_path: fontSelection?.path,
                    font_size: formValues.font_size,
                    font_style: formValues.font_style,
                    font_color: formValues.font_color,
                    max_text_width: formValues.max_text_width,
                    sample_name: sampleText,
                  }}
                />
              </div>
            </details>
          )}
        </div>

        {/* ── Right: properties ─────────────────────────────────────────────── */}
        <div className="flex w-64 shrink-0 flex-col border-l border-border bg-card">
          <div className="border-b border-border px-4 py-2.5">
            <p className="label-mono">Text &amp; style</p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Preview name */}
            <div className="space-y-1.5">
              <label htmlFor="sample-text" className="label-mono block">
                Preview name
              </label>
              <Input
                id="sample-text"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder="Sample Name"
                className="h-8 text-[13px]"
              />
            </div>

            <Separator />

            {/* Font — placed first, because the chosen family governs what the
                size and style controls below can actually offer. */}
            <div className="space-y-1.5">
              <span className="label-mono block">Font</span>
              <FontPicker
                catalog={catalog ?? []}
                value={fontSelection}
                onChange={setFontSelection}
                onUpload={handleFontUpload}
                uploading={uploadingFont}
                uploadError={fontUploadError}
              />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Bundled with the app — the preview and the certificate render
                from the same file, and no font is fetched while sending.
              </p>
            </div>

            <Separator />

            {/* Font size */}
            <div className="space-y-2">
              <label htmlFor="font-size" className="label-mono block">
                Size
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="font-size"
                  type="number"
                  {...register("font_size")}
                  min={8}
                  max={300}
                  className="h-8 w-16 text-[13px] tabular"
                />
                <span className="text-[12px] text-muted-foreground">px</span>
                <div className="ml-auto flex gap-1">
                  {SIZE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setValue("font_size", s)}
                      className={`h-7 w-8 rounded-[3px] border font-mono text-[11px] tabular transition-colors duration-150 ${
                        formValues.font_size === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-hair-hover hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Font style */}
            <div className="space-y-2">
              <span className="label-mono block">Style</span>
              <div
                role="group"
                aria-label="Font style"
                className="flex gap-1.5"
              >
                {ALL_STYLES.map((s) => {
                  // Disabled rather than hidden: the style exists as a concept
                  // and the user should see that this family simply ships one
                  // weight, not wonder where the button went.
                  const available = styleAvailable(
                    fontSelection?.styles ?? ["normal", "bold", "italic"],
                    s
                  );
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!available}
                      aria-pressed={formValues.font_style === s}
                      onClick={() => setValue("font_style", s)}
                      title={
                        available
                          ? s
                          : `${fontSelection?.label ?? "This font"} has no ${s} face`
                      }
                      className={`h-8 flex-1 rounded-[3px] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
                        s === "italic" ? "italic" : ""
                      } ${s === "bold" ? "font-bold" : ""} ${
                        formValues.font_style === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-hair-hover hover:text-foreground"
                      }`}
                    >
                      {s === "normal" ? "Aa" : s === "bold" ? "B" : "I"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font color */}
            <div className="space-y-2">
              <label htmlFor="font-color" className="label-mono block">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  {...register("font_color")}
                  aria-label="Font colour picker"
                  className="size-8 shrink-0 cursor-pointer rounded-[3px] border border-border bg-card p-0.5"
                />
                <Input
                  id="font-color"
                  {...register("font_color")}
                  placeholder="#000000"
                  className="h-8 flex-1 font-mono text-[12px]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("font_color", c)}
                    title={c}
                    className="size-6 rounded-[3px] border border-border transition-shadow duration-150 hover:ring-2 hover:ring-ring hover:ring-offset-1 hover:ring-offset-card"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Max text width */}
            <div className="space-y-1.5">
              <label htmlFor="max-text-width" className="label-mono block">
                Max width
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-text-width"
                  type="number"
                  {...register("max_text_width")}
                  min={100}
                  className="h-8 w-24 text-[13px] tabular"
                />
                <span className="text-[12px] text-muted-foreground">px</span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                The name auto-shrinks past this width, so long names stay inside
                the frame.
              </p>
            </div>

          </div>
        </div>
      </div>
    </form>
  );
}
