import { useEffect, useRef } from "react";

/**
 * NarrativeField — a canvas of short "ink-stroke" stripes that drift slowly
 * and orient themselves around the cursor like iron filings on a magnet.
 * Conceptually: fragments of a narrative reacting to the reader's attention.
 *
 * Visual character:
 *  - Each particle is a short, slightly-rounded line (a "stripe").
 *  - Particles have a base drift; cursor-near particles rotate to be tangent
 *    to a circle around the cursor (creates a swirling-flow effect) and
 *    brighten slightly.
 *  - Pure canvas, no deps. Respects prefers-reduced-motion.
 */
export function NarrativeField({
  density = 0.00018,
  className = "",
}: {
  density?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const cursorRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Particle = {
      x: number;
      y: number;
      len: number;       // base stripe length
      angle: number;     // current orientation
      baseAngle: number; // drift orientation
      vx: number;
      vy: number;
      alpha: number;
      hueShift: number;  // 0..1 — boosts toward accent near cursor
    };

    let particles: Particle[] = [];

    const seed = () => {
      const count = Math.max(60, Math.floor(width * height * density));
      particles = new Array(count).fill(0).map(() => {
        const baseAngle = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          len: 8 + Math.random() * 14,
          angle: baseAngle,
          baseAngle,
          vx: Math.cos(baseAngle) * (0.05 + Math.random() * 0.08),
          vy: Math.sin(baseAngle) * (0.05 + Math.random() * 0.08),
          alpha: 0.18 + Math.random() * 0.22,
          hueShift: 0,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursorRef.current.x = e.clientX - rect.left;
      cursorRef.current.y = e.clientY - rect.top;
      cursorRef.current.active = true;
    };
    const onLeave = () => {
      cursorRef.current.active = false;
      cursorRef.current.x = -9999;
      cursorRef.current.y = -9999;
    };

    const isDark = () =>
      document.documentElement.classList.contains("dark");

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const cursor = cursorRef.current;
      const dark = isDark();
      const baseColor = dark ? "229, 231, 235" : "9, 9, 11";       // text-like
      const accentColor = dark ? "165, 180, 252" : "79, 70, 229";  // indigo

      const INFLUENCE = 180;       // px radius of cursor influence
      const INFLUENCE_SQ = INFLUENCE * INFLUENCE;

      for (const p of particles) {
        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        // Cursor influence
        let targetAngle = p.baseAngle;
        let hueTarget = 0;
        let alphaBoost = 0;

        if (cursor.active) {
          const dx = p.x - cursor.x;
          const dy = p.y - cursor.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < INFLUENCE_SQ) {
            const dist = Math.sqrt(distSq);
            const influence = 1 - dist / INFLUENCE; // 0..1
            // Tangent to circle around cursor — swirling
            const tangent = Math.atan2(dy, dx) + Math.PI / 2;
            targetAngle = lerpAngle(p.baseAngle, tangent, influence);
            hueTarget = influence;
            alphaBoost = influence * 0.45;
          }
        }

        // Smoothly track target angle / hue
        p.angle = lerpAngle(p.angle, targetAngle, 0.08);
        p.hueShift += (hueTarget - p.hueShift) * 0.12;

        // Slow drift of baseAngle for organic motion
        p.baseAngle += (Math.random() - 0.5) * 0.004;
        p.vx = Math.cos(p.baseAngle) * 0.07;
        p.vy = Math.sin(p.baseAngle) * 0.07;

        // Draw stripe
        const length = p.len * (1 + p.hueShift * 0.35);
        const halfLen = length / 2;
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);
        const x1 = p.x - cosA * halfLen;
        const y1 = p.y - sinA * halfLen;
        const x2 = p.x + cosA * halfLen;
        const y2 = p.y + sinA * halfLen;

        // Blend between base and accent color based on hueShift
        const color = blendRgb(baseColor, accentColor, p.hueShift);

        ctx.strokeStyle = `rgba(${color}, ${Math.min(0.95, p.alpha + alphaBoost)})`;
        ctx.lineWidth = 1 + p.hueShift * 0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      if (!reduceMotion) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    resize();
    if (reduceMotion) {
      draw();
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
    />
  );
}

/* ------------------------------------------------------------------ */

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function blendRgb(a: string, b: string, t: number): string {
  const [ar, ag, ab] = a.split(",").map((v) => parseInt(v.trim(), 10));
  const [br, bg, bb] = b.split(",").map((v) => parseInt(v.trim(), 10));
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `${r}, ${g}, ${bl}`;
}
