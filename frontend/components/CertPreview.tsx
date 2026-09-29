"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPreview } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface PreviewParams {
  template_path?: string;
  text_position_x?: number;
  text_position_y?: number;
  font_path?: string;
  font_size?: number;
  font_style?: string;
  font_color?: string;
  max_text_width?: number;
  sample_name?: string;
}

/**
 * Pull the API's `detail` out of a failed request.
 *
 * The preview is requested with `responseType: "blob"`, so an error body is a
 * Blob rather than parsed JSON — `e.response.data.detail` is undefined and the
 * user sees only "Request failed with status code 422".
 */
async function readError(e: any): Promise<string> {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.detail) return String(parsed.detail);
    } catch {
      /* not JSON — fall through */
    }
  }
  if (typeof data?.detail === "string") return data.detail;
  return e?.message ?? "Preview failed";
}

/**
 * The server's own render of the certificate.
 *
 * This is the authoritative preview: it runs the same `fit_font` shrink and the
 * same Pillow text shaping as the generated PDF, so nothing here can drift from
 * the output. The editor's canvas approximates it for instant feedback; this is
 * what "check the exact output" means.
 */
export function CertPreview({ params }: { params: PreviewParams }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !params.template_path ||
      !params.text_position_x ||
      !params.text_position_y
    ) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const url = await fetchPreview({
          template_path: params.template_path!,
          text_position_x: params.text_position_x!,
          text_position_y: params.text_position_y!,
          font_path: params.font_path,
          font_size: params.font_size ?? 48,
          font_style: params.font_style ?? "normal",
          font_color: params.font_color ?? "#000000",
          max_text_width: params.max_text_width ?? 1400,
          sample_name: params.sample_name ?? "Sample Name",
        });
        // Revoke old blob URL to prevent memory leaks
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setSrc(url);
      } catch (e: any) {
        setError(await readError(e));
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    params.template_path,
    params.text_position_x,
    params.text_position_y,
    params.font_path,
    params.font_size,
    params.font_style,
    params.font_color,
    params.max_text_width,
    params.sample_name,
  ]);

  // Revoke on unmount. The effect above only revokes the *previous* URL when a
  // new one arrives, so the last preview of a closed editor stayed alive for
  // the life of the page.
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    };
  }, []);

  if (!params.template_path || !params.text_position_x || !params.text_position_y) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-hair-hover px-6 text-center">
        <p className="text-[13px] text-muted-foreground">
          Set a template and a name position to see the generated certificate.
        </p>
      </div>
    );
  }

  if (loading) return <Skeleton className="aspect-video w-full rounded-lg" />;

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md bg-rose px-3 py-2 text-[13px] text-rose-ink"
      >
        {error}
      </p>
    );
  }

  if (!src) return null;

  return (
    <img
      src={src}
      alt="Generated certificate preview"
      className="w-full rounded-lg border border-border"
    />
  );
}
