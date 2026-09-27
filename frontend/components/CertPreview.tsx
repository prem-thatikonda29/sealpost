"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPreview } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
        setError(e?.message ?? "Preview failed");
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

  if (!params.template_path || !params.text_position_x || !params.text_position_y) {
    return (
      <div className="flex items-center justify-center h-40 rounded-md border border-dashed text-muted-foreground text-sm">
        Set a template and position to see a preview
      </div>
    );
  }

  if (loading) return <Skeleton className="w-full aspect-video rounded-md" />;
  if (error) return <Badge variant="destructive">{error}</Badge>;
  if (!src) return null;

  return (
    <img
      src={src}
      alt="Certificate preview"
      className="w-full rounded-md border shadow-sm"
    />
  );
}
