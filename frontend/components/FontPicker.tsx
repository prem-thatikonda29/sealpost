"use client";

import { useMemo, useState } from "react";
import { useFontFace } from "@/lib/fonts";
import type { FontEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface FontSelection {
  path: string;
  url: string;
  label: string;
  styles: string[];
  /** True for a user-uploaded file, which has no catalog entry. */
  uploaded?: boolean;
}

interface Props {
  catalog: FontEntry[];
  value: FontSelection | null;
  onChange: (selection: FontSelection | null) => void;
  onUpload: (file: File) => Promise<void>;
  uploading?: boolean;
  uploadError?: string | null;
}

/** A family name rendered in its own face — the only honest way to choose one. */
function FontSample({
  url,
  text,
  className,
}: {
  url: string | null;
  text: string;
  className?: string;
}) {
  const { family } = useFontFace(url);
  return (
    <span
      className={className}
      style={{ fontFamily: family ? `"${family}", var(--font-sans)` : undefined }}
    >
      {text}
    </span>
  );
}

const CATEGORY_ORDER = ["Serif", "Sans", "Display", "Other"];

export function FontPicker({
  catalog,
  value,
  onChange,
  onUpload,
  uploading,
  uploadError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? catalog.filter((f) => f.label.toLowerCase().includes(q))
      : catalog;
    const byCategory = new Map<string, FontEntry[]>();
    for (const font of matching) {
      const list = byCategory.get(font.category) ?? [];
      list.push(font);
      byCategory.set(font.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => [
      c,
      byCategory.get(c)!,
    ] as const);
  }, [catalog, query]);

  const select = (font: FontEntry) => {
    onChange({
      path: font.path,
      url: font.url,
      label: font.label,
      styles: font.styles,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors duration-150 hover:border-hair-hover hover:bg-surface-raised"
          />
        }
      >
        {value ? (
          <FontSample
            url={value.url}
            text={value.label}
            className="truncate text-[15px] text-foreground"
          />
        ) : (
          <span className="text-[13px] text-muted-foreground">Choose a font</span>
        )}
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {value ? "Change" : "Browse"}
        </span>
      </DialogTrigger>

      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b border-border p-4 pr-12">
          <DialogTitle className="font-serif text-lg font-normal tracking-[-0.02em]">
            Font
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {catalog.length} families, loaded from this machine — no network
            needed. Or upload your own.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search families"
            aria-label="Search font families"
            className="h-8 flex-1 text-[13px]"
          />
          <label className="shrink-0 cursor-pointer">
            <span className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors duration-150 hover:border-hair-hover hover:bg-surface-raised">
              {uploading ? "Uploading…" : "Upload a font"}
            </span>
            <input
              type="file"
              accept=".ttf,.otf"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // Reset so re-selecting the same file fires onChange again.
                e.target.value = "";
                if (file) await onUpload(file);
              }}
            />
          </label>
        </div>

        {uploadError && (
          <p
            role="alert"
            className="border-b border-border bg-rose px-4 py-2.5 text-[13px] text-rose-ink"
          >
            {uploadError}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {grouped.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No family matches “{query}”. Upload a .ttf or .otf to use your own.
            </p>
          )}

          {grouped.map(([category, fonts]) => (
            <section key={category}>
              <p className="label-mono sticky top-0 border-b border-border bg-muted px-4 py-2">
                {category}
              </p>
              <ul>
                {fonts.map((font) => {
                  const selected = value?.path === font.path;
                  return (
                    <li key={font.id}>
                      <button
                        type="button"
                        onClick={() => select(font)}
                        aria-pressed={selected}
                        className={`flex w-full items-baseline justify-between gap-4 border-b border-border px-4 py-3 text-left transition-colors duration-150 ${
                          selected ? "bg-terra/40" : "hover:bg-surface-raised"
                        }`}
                      >
                        <FontSample
                          url={font.url}
                          text={font.label}
                          className="min-w-0 truncate text-[20px] leading-tight text-foreground"
                        />
                        <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                          {font.styles.join(" · ")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-4 py-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Families marked without <span className="font-mono">bold</span> or{" "}
            <span className="font-mono">italic</span> only ship one weight — the
            style buttons will say so.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            disabled={!value}
          >
            Use default
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
