import { useEffect, useRef } from "react";

/**
 * StarField — sparse star canvas.
 *
 * - Stars are placed at low density.
 * - Each star has its own twinkle phase + speed, so they pulse one-by-one
 *   instead of all together.
 * - A subset of stars are "luminaries" with a wider glow halo.
 * - Cursor gently boosts brightness of nearby stars (kept subtle).
 * - White core with crimson-tinted glow.
 */
export function StarField({
  density = 0.00004, // stars per pixel — sparse
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

    type Star = {
      x: number;
      y: number;
      r: number;            // core radius
      glow: number;         // glow radius
      phase: number;        // twinkle phase
      speed: number;        // twinkle speed
      isLuminary: boolean;  // brighter star with stronger glow
      drift: number;        // tiny vertical drift
    };

    let stars: Star[] = [];
    let startTime = performance.now();

    const seed = () => {
      const count = Math.max(40, Math.floor(width * height * density));
      stars = new Array(count).fill(0).map(() => {
        const isLuminary = Math.random() < 0.18;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: isLuminary ? 1.2 + Math.random() * 1.0 : 0.6 + Math.random() * 0.8,
          glow: isLuminary ? 22 + Math.random() * 18 : 8 + Math.random() * 10,
          phase: Math.random() * Math.PI * 2,
          // Slow, varied — so they don't pulse in sync
          speed: 0.4 + Math.random() * 1.4,
          isLuminary,
          drift: (Math.random() - 0.5) * 0.015,
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Only active when inside the canvas
      if (x >= 0 && y >= 0 && x <= width && y <= height) {
        cursorRef.current.x = x;
        cursorRef.current.y = y;
        cursorRef.current.active = true;
      } else {
        cursorRef.current.active = false;
      }
    };
    const onLeave = () => {
      cursorRef.current.active = false;
    };

    const CURSOR_INFLUENCE = 140;
    const CURSOR_INFLUENCE_SQ = CURSOR_INFLUENCE * CURSOR_INFLUENCE;

    const draw = (now: number) => {
      const t = (now - startTime) / 1000;
      ctx.clearRect(0, 0, width, height);

      const cursor = cursorRef.current;

      for (const s of stars) {
        // Each star has its own phase + speed -> staggered twinkle.
        // Use a sharp pulse curve so brightness sits low most of the time
        // and "flashes" briefly — gives a "one at a time" feel.
        const raw = Math.sin(t * s.speed + s.phase);
        const pulse = Math.pow(Math.max(0, raw), 4); // 0..1, mostly low
        let baseAlpha = 0.18 + pulse * 0.75;

        // Cursor proximity boost
        if (cursor.active) {
          const dx = s.x - cursor.x;
          const dy = s.y - cursor.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CURSOR_INFLUENCE_SQ) {
            const k = 1 - Math.sqrt(distSq) / CURSOR_INFLUENCE;
            baseAlpha = Math.min(1, baseAlpha + k * 0.4);
          }
        }

        // Slow vertical drift for life
        s.y += s.drift;
        if (s.y < -10) s.y = height + 10;
        else if (s.y > height + 10) s.y = -10;

        const glowAlpha = baseAlpha * (s.isLuminary ? 0.55 : 0.32);

        // Glow halo — crimson tint
        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.glow);
        gradient.addColorStop(0, `rgba(255, 230, 230, ${glowAlpha})`);
        gradient.addColorStop(0.35, `rgba(225, 29, 72, ${glowAlpha * 0.55})`);
        gradient.addColorStop(1, `rgba(225, 29, 72, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.glow, 0, Math.PI * 2);
        ctx.fill();

        // White core
        ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Cross flare for luminaries at peak
        if (s.isLuminary && pulse > 0.6) {
          const flareLen = s.r * 8 * pulse;
          ctx.strokeStyle = `rgba(255, 230, 235, ${pulse * 0.35})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - flareLen, s.y);
          ctx.lineTo(s.x + flareLen, s.y);
          ctx.moveTo(s.x, s.y - flareLen);
          ctx.lineTo(s.x, s.y + flareLen);
          ctx.stroke();
        }
      }

      if (!reduceMotion) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    resize();
    if (reduceMotion) {
      draw(performance.now());
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
