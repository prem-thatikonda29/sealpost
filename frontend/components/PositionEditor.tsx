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

  // Position of the crosshair in display pixels
  const crossX = naturalWidth ? (value.x / naturalWidth) * imgSize.w : 0;
  const crossY = naturalHeight ? (value.y / naturalHeight) * imgSize.h : 0;

  return (
    <div className="relative inline-block max-w-full" style={{ maxWidth: 900 }}>
      {/* Template image */}
      <img
        ref={imgRef}
        src={templateUrl}
        alt="Certificate template"
        className="block w-full select-none"
        draggable={false}
      />

      {/* Click overlay */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onClick={handleClick}
      />

      {/* Crosshair marker at current position */}
      {value.x > 0 && value.y > 0 && imgSize.w > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: crossX,
            top: crossY,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Horizontal bar */}
          <div className="absolute bg-red-500 opacity-90"
            style={{ width: 24, height: 2, top: -1, left: -12 }} />
          {/* Vertical bar */}
          <div className="absolute bg-red-500 opacity-90"
            style={{ width: 2, height: 24, top: -12, left: -1 }} />
          {/* Centre dot */}
          <div className="absolute bg-red-500 rounded-full"
            style={{ width: 6, height: 6, top: -3, left: -3 }} />
        </div>
      )}

      {/* Coordinate hint */}
      {value.x > 0 && value.y > 0 && (
        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded pointer-events-none">
          {value.x}, {value.y}
        </span>
      )}
    </div>
  );
}
