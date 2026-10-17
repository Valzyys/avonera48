import { useEffect, useRef } from "react";
import type { LoopClock } from "../useLoopClock";

interface Props {
  clock: LoopClock;
  /** 0 = calm; 1 = beams converge to the centre and burn bright (final seconds). */
  intensity: number;
  reducedMotion: boolean;
  /** Paused (hidden / off screen): draw nothing. */
  paused: boolean;
  colors: { bg: string; primary: string; accent: string };
}

/** Small smooth noise: a few incommensurate sines, cheap and organic enough for dust. */
const noise = (x: number, y: number) => Math.sin(x * 1.7 + Math.sin(y * 0.9)) * 0.5 + Math.sin(y * 1.3 + Math.sin(x * 1.1) * 1.4) * 0.5;

interface Mote {
  x: number;
  y: number;
  r: number;
  seed: number;
  warm: boolean;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The stage behind the text: a dark gradient, volumetric beams swaying from
 * the rig, drifting golden dust with soft bokeh, film grain and a vignette.
 * Driven by the pre-show's clock; lowers its own quality when frames run
 * long, and holds still for reduced motion.
 */
export function StageCanvas({ clock, intensity, reducedMotion, paused, colors }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ intensity, reducedMotion, paused });
  useEffect(() => {
    live.current = { intensity, reducedMotion, paused };
  }, [intensity, reducedMotion, paused]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const small = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;
    let maxMotes = small ? 35 : 80;
    let grainOn = true;
    const motes: Mote[] = Array.from({ length: 80 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      seed: i * 13.37,
      warm: Math.random() < 0.75,
    }));
    // Grain: one noise tile, drawn with a random offset each frame.
    const grain = document.createElement("canvas");
    grain.width = grain.height = 128;
    const g = grain.getContext("2d")!;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const pattern = ctx.createPattern(grain, "repeat");
    const [pr, pg, pb] = hexToRgb(colors.primary);
    const [ar, ag, ab] = hexToRgb(colors.accent);

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let avg = 16;
    const frame = (stamp: number) => {
      raf = requestAnimationFrame(frame);
      const { intensity: k, reducedMotion: still, paused: off } = live.current;
      if (off) {
        last = stamp;
        return;
      }
      // Frame budget: drop dust and grain when we keep missing ~45 fps.
      avg = avg * 0.95 + (stamp - last) * 0.05;
      last = stamp;
      if (avg > 22 && maxMotes > 20) {
        maxMotes = Math.max(20, Math.floor(maxMotes * 0.7));
        grainOn = false;
        avg = 16;
      }
      const t = still ? 0 : clock.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Stage floor and back wall.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0d0a14");
      bg.addColorStop(0.55, colors.bg);
      bg.addColorStop(1, "#120a10");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, h * 0.9);
      glow.addColorStop(0, `rgba(${pr},${pg},${pb},${0.16 + 0.2 * k})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Beams from the rig, swaying; they gather to the centre as k rises.
      ctx.globalCompositeOperation = "lighter";
      const beams = 5;
      for (let i = 0; i < beams; i++) {
        const ox = w * (0.1 + (0.8 * i) / (beams - 1));
        const sway = Math.sin(t * 0.35 + i * 1.7) * 0.18 * (1 - k * 0.7);
        const aim = (w / 2 - ox) * (0.25 + 0.65 * k);
        const tx = ox + aim + sway * w * 0.3;
        const spread = w * (0.12 - 0.05 * k);
        const warm = i % 2 === 0;
        const [r, gg, b] = warm ? [ar, ag, ab] : [pr, pg, pb];
        const a = (0.08 + 0.12 * k) * (0.75 + 0.25 * Math.sin(t * 0.9 + i * 2.1));
        const grad = ctx.createLinearGradient(ox, 0, tx, h);
        grad.addColorStop(0, `rgba(${r},${gg},${b},${a * 1.6})`);
        grad.addColorStop(0.6, `rgba(${r},${gg},${b},${a * 0.45})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ox - 4, -2);
        ctx.lineTo(ox + 4, -2);
        ctx.lineTo(tx + spread, h);
        ctx.lineTo(tx - spread, h);
        ctx.closePath();
        ctx.fill();
      }

      // Dust and bokeh drifting through the light.
      const n = still ? Math.min(maxMotes, 24) : maxMotes;
      for (let i = 0; i < n; i++) {
        const m = motes[i];
        const dx = still ? 0 : noise(m.seed + t * 0.05, m.y * 3) * 0.04 + t * 0.004;
        const dy = still ? 0 : noise(m.x * 3, m.seed + t * 0.04) * 0.05 - t * 0.006;
        const x = (((m.x + dx) % 1) + 1) % 1;
        const y = (((m.y + dy) % 1) + 1) % 1;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + m.seed);
        const rad = m.r * (m.r > 2.4 ? 3 : 1) * (w / 900);
        const [r, gg, b] = m.warm ? [ar, ag, ab] : [255, 240, 245];
        const dot = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, rad * 3);
        dot.addColorStop(0, `rgba(${r},${gg},${b},${0.55 * tw})`);
        dot.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = dot;
        ctx.fillRect(x * w - rad * 3, y * h - rad * 3, rad * 6, rad * 6);
      }
      ctx.globalCompositeOperation = "source-over";

      // Vignette.
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      // Film grain, ~4%.
      if (grainOn && pattern && !still) {
        ctx.globalAlpha = 0.04;
        ctx.globalCompositeOperation = "overlay";
        ctx.save();
        ctx.translate(Math.random() * 128, Math.random() * 128);
        ctx.fillStyle = pattern;
        ctx.fillRect(-128, -128, w + 256, h + 256);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [clock, colors.bg, colors.primary, colors.accent]);

  return <canvas ref={ref} className="ps__canvas" aria-hidden />;
}
