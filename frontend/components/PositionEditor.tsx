"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  templateUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  value: { x: number; y: number };
  onChange: (x: number, y: number) => void;
}

export function PositionEditor({
  templateUrl,
  naturalWidth,
  naturalHeight,
  value,
  onChange,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        setImgSize({ w: rect.width, h: rect.height });
      }
    };
    const observer = new ResizeObserver(update);
    if (imgRef.current) observer.observe(imgRef.current);
    update();
    return () => observer.disconnect();
  }, [templateUrl]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !imgSize.w || !imgSize.h) return;
    const rect = imgRef.current.getBoundingClientRect();
    const ox = Math.round(((e.clientX - rect.left) / imgSize.w) * naturalWidth);
    const oy = Math.round(((e.clientY - rect.top) / imgSize.h) * naturalHeight);
    onChange(ox, oy);
  };

  // Position of the marker in display pixels
  const markX = naturalWidth ? (value.x / naturalWidth) * imgSize.w : 0;
  const markY = naturalHeight ? (value.y / naturalHeight) * imgSize.h : 0;

  const hasPosition = value.x > 0 && value.y > 0;

  return (
    <div className="relative inline-block max-w-full" style={{ maxWidth: 900 }}>
      <img
        ref={imgRef}
        src={templateUrl}
        alt="Certificate template"
        className="block w-full select-none rounded-lg border border-border"
        draggable={false}
      />

      {/* Click target */}
      <div className="absolute inset-0 cursor-crosshair" onClick={handleClick} />

      {/* Placement marker */}
      {hasPosition && imgSize.w > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: markX,
            top: markY,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="absolute bg-terra-ink"
            style={{ width: 24, height: 1, top: 0, left: -12 }}
          />
          <div
            className="absolute bg-terra-ink"
            style={{ width: 1, height: 24, top: -12, left: 0 }}
          />
          <div
            className="absolute rounded-full border border-canvas bg-terra-ink"
            style={{ width: 6, height: 6, top: -3, left: -3 }}
          />
        </div>
      )}

      {/* Coordinate readout */}
      {hasPosition && (
        <span className="pointer-events-none absolute right-2 bottom-2 rounded-[3px] bg-ink/75 px-2 py-0.5 font-mono text-[11px] text-canvas tabular">
          {value.x}, {value.y}
        </span>
      )}
    </div>
  );
}
