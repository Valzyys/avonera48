/**
 * Shared ffmpeg helpers for the pre-show audio generators. Every asset is
 * written twice: .webm (Opus) for most browsers and .m4a (AAC) for Safari.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../public/preshow/audio");
const TMP = path.join(tmpdir(), "preshow-audio");
mkdirSync(TMP, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

/** Renders an aevalsrc expression (mono or stereo, "L|R") to a temp WAV, with optional filters. */
export function render(name, expr, seconds, filters = "") {
  const wav = path.join(TMP, `${name}.wav`);
  const src = `aevalsrc='${expr}':s=48000:d=${seconds}`;
  ff(["-f", "lavfi", "-i", src, ...(filters ? ["-af", filters] : []), "-ac", "2", wav]);
  return wav;
}

/** Final loudness: SFX are peak-limited to −3 dBFS; music and voice go to −16 LUFS. */
export function encode(wav, dir, name, { kind = "music", kbps = 64, trim } = {}) {
  mkdirSync(path.join(OUT, dir), { recursive: true });
  const level = kind === "sfx" ? "alimiter=limit=0.707:level=false" : "loudnorm=I=-16:TP=-1.5:LRA=11";
  const pre = trim ? [`atrim=start=${trim[0]}:end=${trim[1]}`, "asetpts=PTS-STARTPTS"] : [];
  const af = [...pre, level, "aresample=48000"].join(",");
  ff(["-i", wav, "-af", af, "-c:a", "libopus", "-b:a", `${kbps}k`, path.join(OUT, dir, `${name}.webm`)]);
  ff(["-i", wav, "-af", af, "-c:a", "aac", "-b:a", `${Math.round(kbps * 1.25)}k`, "-movflags", "+faststart", path.join(OUT, dir, `${name}.m4a`)]);
}

export const cleanup = () => rmSync(TMP, { recursive: true, force: true });

/** A frequency nudged so it completes whole cycles in `period` seconds: the loop seam is click-free. */
export const q = (f, period) => Math.round(f * period) / period;
