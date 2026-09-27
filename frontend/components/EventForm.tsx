"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { uploadTemplate, templateUrl, type Event } from "@/lib/api";

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
  fontSize: number;
  fontStyle: string;
  fontColor: string;
  fontFamily: string;
  sampleText: string;
  onPositionChange: (x: number, y: number) => void;
}

function CertCanvas({
  templateUrl,
  naturalWidth,
  naturalHeight,
  posX,
  posY,
  fontSize,
  fontStyle,
  fontColor,
  fontFamily,
  sampleText,
  onPositionChange,
}: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
  const displayFontSize = Math.max(fontSize * scale, 8);

  const isBold = fontStyle === "bold" || fontStyle === "bold_italic";
  const isItalic = fontStyle === "italic" || fontStyle === "bold_italic";

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg"
      style={
        naturalWidth && naturalHeight
          ? { aspectRatio: `${naturalWidth} / ${naturalHeight}` }
          : { minHeight: 320 }
      }
      onClick={handleClick}
    >
      {/* Template image — normal flow, sizes the container via aspect-ratio */}
      {templateUrl ? (
        <img
          src={templateUrl}
          alt="Certificate template"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40 border-2 border-dashed border-muted-foreground/30 rounded-lg">
          <p className="text-muted-foreground text-sm">Upload a template to begin</p>
        </div>
      )}

      {/* Live text overlay — only render once we have a valid scale */}
      {posX > 0 && posY > 0 && templateUrl && scale > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: textDisplayX,
            top: textDisplayY,
            transform: "translate(-50%, -50%)",
            fontSize: displayFontSize,
            fontWeight: isBold ? 700 : 400,
            fontStyle: isItalic ? "italic" : "normal",
            color: fontColor,
            fontFamily: fontFamily || "system-ui, sans-serif",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
            textShadow: "0 0 4px rgba(0,0,0,0.15)",
          }}
        >
          {sampleText || "Sample Name"}
        </div>
      )}

      {/* Crosshair dot at position */}
      {posX > 0 && posY > 0 && templateUrl && (
        <div
          className="absolute pointer-events-none"
          style={{ left: textDisplayX, top: textDisplayY }}
        >
          <div className="absolute bg-white/80 border border-primary rounded-full"
            style={{ width: 8, height: 8, transform: "translate(-50%, -50%)" }} />
        </div>
      )}

      {/* Click hint when no position set */}
      {(!posX || !posY) && templateUrl && (
        <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
          <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            Click to place text
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main EventForm ────────────────────────────────────────────────────────────

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
  const [fontPath, setFontPath] = useState(initial?.font_path ?? "");
  const [posX, setPosX] = useState(initial?.text_position_x ?? 0);
  const [posY, setPosY] = useState(initial?.text_position_y ?? 0);
  const [sampleText, setSampleText] = useState("Sample Name");
  const [uploading, setUploading] = useState(false);

  const formValues = watch();

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadTemplate(file);
      setTemplatePath(`uploads/${res.template_id}_${file.name}`);
      setTemplateNW(res.natural_width);
      setTemplateNH(res.natural_height);
      setTemplateDisplayUrl(res.url);
      // Reset position when template changes
      setPosX(0);
      setPosY(0);
    } finally {
      setUploading(false);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadTemplate(file);
      setFontPath(`uploads/${res.template_id}_${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    await onSave({
      ...values,
      template_path: templatePath || undefined,
      template_natural_width: templateNW || undefined,
      template_natural_height: templateNH || undefined,
      font_path: fontPath || undefined,
      text_position_x: posX || undefined,
      text_position_y: posY || undefined,
    });
  };

  // ── Layout: full-width canvas + fixed right sidebar ──────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-4 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <Input
              {...register("name")}
              placeholder="Event name"
              className="text-base font-medium border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent"
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <Input
            {...register("description")}
            placeholder="Description (optional)"
            className="text-sm border-0 shadow-none px-0 focus-visible:ring-0 bg-transparent text-muted-foreground w-64"
          />
        </div>
        <Button type="submit" disabled={saving || uploading} size="sm">
          {saving ? "Saving…" : "Save Event"}
        </Button>
      </div>

      {/* ── Main split ──────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border rounded-xl overflow-hidden bg-muted/20 min-h-[540px]">

        {/* ── Left: Canvas area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
          {/* Template upload row */}
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 bg-background hover:bg-muted transition-colors">
                {uploading ? "Uploading…" : templateDisplayUrl ? "Replace template" : "Upload template"}
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
              <span className="text-xs text-muted-foreground">
                {templateNW} × {templateNH}px
              </span>
            )}
            {posX > 0 && posY > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                Position: ({posX}, {posY})
              </span>
            )}
          </div>

          {/* Canvas */}
          <CertCanvas
            templateUrl={templateDisplayUrl}
            naturalWidth={templateNW}
            naturalHeight={templateNH}
            posX={posX}
            posY={posY}
            fontSize={formValues.font_size}
            fontStyle={formValues.font_style}
            fontColor={formValues.font_color}
            fontFamily="system-ui, sans-serif"
            sampleText={sampleText}
            onPositionChange={(x, y) => {
              setPosX(x);
              setPosY(y);
            }}
          />
        </div>

        {/* ── Right: Property sidebar ───────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l flex flex-col bg-background">

          <div className="px-4 py-2.5 border-b">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text & Style</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <>
                {/* Sample text (what shows in canvas preview) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Preview name
                  </Label>
                  <Input
                    value={sampleText}
                    onChange={(e) => setSampleText(e.target.value)}
                    placeholder="Sample Name"
                    className="text-sm h-8"
                  />
                </div>

                <Separator />

                {/* Font size */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Size
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      {...register("font_size")}
                      min={8}
                      max={300}
                      className="h-8 text-sm w-20"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                    {/* Quick size presets */}
                    <div className="flex gap-1 ml-auto">
                      {[24, 36, 48, 64].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setValue("font_size", s)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                            formValues.font_size === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Font style */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Style
                  </Label>
                  <div className="flex gap-1.5">
                    {(["normal", "bold", "italic"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setValue("font_style", s)}
                        className={`flex-1 h-8 text-xs border rounded transition-colors capitalize ${
                          s === "bold" ? "font-bold" : ""
                        } ${s === "italic" ? "italic" : ""} ${
                          formValues.font_style === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {s === "normal" ? "Aa" : s === "bold" ? "B" : "I"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font color */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      {...register("font_color")}
                      className="w-8 h-8 rounded border cursor-pointer p-0.5 shrink-0"
                    />
                    <Input
                      {...register("font_color")}
                      className="font-mono text-xs h-8 flex-1"
                      placeholder="#000000"
                    />
                  </div>
                  {/* Preset swatches */}
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {["#000000", "#ffffff", "#1a1a2e", "#c8a96e", "#2c3e50", "#e74c3c"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setValue("font_color", c)}
                        className="w-6 h-6 rounded border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Max text width */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Max width
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      {...register("max_text_width")}
                      min={100}
                      className="h-8 text-sm w-24"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Font auto-shrinks if the name exceeds this width
                  </p>
                </div>

                <Separator />

                {/* Custom font upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Custom font
                  </Label>
                  <label className="cursor-pointer block">
                    <span className="inline-flex items-center text-xs border rounded-md px-2.5 py-1.5 bg-background hover:bg-muted transition-colors w-full justify-center">
                      {fontPath ? fontPath.split("/").pop() : "Upload OTF / TTF"}
                    </span>
                    <input
                      type="file"
                      accept=".otf,.ttf"
                      className="hidden"
                      onChange={handleFontUpload}
                      disabled={uploading}
                    />
                  </label>
                  {fontPath && (
                    <button
                      type="button"
                      onClick={() => setFontPath("")}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove custom font
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground leading-snug">
                    Preview uses system font; actual cert uses uploaded font
                  </p>
                </div>
            </>
          </div>
        </div>
      </div>
    </form>
  );
}
