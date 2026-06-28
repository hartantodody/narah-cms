import { useMemo } from "react";

/**
 * SiteAvatar — derived from siteId hash so the same site always gets the same
 * color, even before logo uploads land. Initials taken from the name.
 *
 * Renders a square with a subtle gradient (two stops from the same hue) and
 * 2-char initials in a high-contrast font.
 */
export function SiteAvatar({
  name,
  id,
  size = 40,
  rounded = "md",
}: {
  name: string;
  id: string;
  size?: number;
  rounded?: "sm" | "md" | "lg" | "full";
}) {
  const initials = useMemo(() => deriveInitials(name), [name]);
  const { from, to, fg } = useMemo(() => colorFromId(id), [id]);

  const radius =
    rounded === "full"
      ? "9999px"
      : rounded === "lg"
        ? "12px"
        : rounded === "md"
          ? "8px"
          : "6px";

  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        color: fg,
        fontSize: Math.round(size * 0.38),
        letterSpacing: "-0.02em",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {initials}
    </span>
  );
}

function deriveInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function colorFromId(id: string): { from: string; to: string; fg: string; hue: number } {
  // Simple FNV-1a-ish over the id → hue
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const hue = h % 360;
  // Saturated but not neon. Two stops give a tasteful gradient.
  return {
    from: `hsl(${hue} 70% 48%)`,
    to: `hsl(${(hue + 28) % 360} 65% 38%)`,
    fg: "#ffffff",
    hue,
  };
}
