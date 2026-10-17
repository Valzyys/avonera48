/**
 * Pre-show voice-over with edge-tts (pip install edge-tts), id-ID-GadisNeural.
 * Run: node scripts/preshow/gen-vo.mjs
 * If edge-tts fails, the lines are written to public/preshow/audio/vo/*.txt
 * for recording by hand, and the pre-show plays without voice.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { cleanup, encode, OUT } from "./encode.mjs";

const LINES = {
  "welcome-pagi": "Selamat pagi, dan selamat datang di Avonera48. Show akan segera dimulai.",
  "welcome-siang": "Selamat siang, dan selamat datang di Avonera48. Show akan segera dimulai.",
  "welcome-sore": "Selamat sore, dan selamat datang di Avonera48. Show akan segera dimulai.",
  "welcome-malam": "Selamat malam, dan selamat datang di Avonera48. Show akan segera dimulai.",
  etiquette: "Sebelum show dimulai, mohon untuk tidak merekam atau menyebarkan ulang tayangan, dan tetap jaga chat dengan sopan.",
  "stay-tuned": "Show akan segera dimulai. Siapkan dirimu, dan selamat menikmati!",
  countdown: "Lima belas detik lagi. Show segera dimulai!",
  outro: "Show dimulai!",
};

const dir = path.join(OUT, "vo");
mkdirSync(dir, { recursive: true });
let failed = false;
for (const [name, text] of Object.entries(LINES)) {
  const mp3 = path.join(tmpdir(), `vo-${name}.mp3`);
  try {
    execFileSync("edge-tts", ["--voice", "id-ID-GadisNeural", "--rate=-5%", "--text", text, "--write-media", mp3], { stdio: "pipe" });
    encode(mp3, "vo", name, { kbps: 48 });
    console.log("vo", name);
  } catch (e) {
    failed = true;
    writeFileSync(path.join(dir, `${name}.txt`), text + "\n");
    console.warn("vo", name, "failed; wrote", `${name}.txt`, String(e).slice(0, 120));
  }
}
if (failed) console.warn("Some voice lines are missing; the pre-show plays without them.");
cleanup();
