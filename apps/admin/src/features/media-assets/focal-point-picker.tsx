import { useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import type { FocalPoint } from "./media-asset.types";

/**
 * FocalPointPicker — click anywhere on the image to set the focal point.
 * The point is rendered as a crosshair + dot. Coordinates are normalized 0..1.
 */
export function FocalPointPicker({
  src,
  alt,
  value,
  onChange,
  disabled,
  className,
}: {
  src: string;
  alt?: string;
  value: FocalPoint;
  onChange: (next: FocalPoint) => void;
  disabled?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onChange({ x, y });
  };

  return (
    <div
      ref={wrapRef}
      onClick={handleClick}
      className={cn(
        "relative select-none overflow-hidden rounded-lg border border-border bg-muted/40",
        disabled ? "cursor-default" : "cursor-crosshair",
        className,
      )}
    >
      <img
        src={src}
        alt={alt ?? ""}
        className="block size-full object-contain"
        draggable={false}
      />

      {/* Crosshair guides */}
      <div
        className="pointer-events-none absolute inset-x-0 h-px bg-white/70 mix-blend-difference"
        style={{ top: `${value.y * 100}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-white/70 mix-blend-difference"
        style={{ left: `${value.x * 100}%` }}
      />

      {/* Focal dot */}
      <div
        aria-hidden
        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(225,29,72,0.9),0_0_16px_rgba(225,29,72,0.6)]"
        style={{
          left: `${value.x * 100}%`,
          top: `${value.y * 100}%`,
          background: "var(--narah-accent)",
        }}
      />
    </div>
  );
}
