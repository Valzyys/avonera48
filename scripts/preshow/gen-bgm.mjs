/**
 * Procedural ambient beds for the pre-show (used only when no BGM of your
 * own is in public/preshow/audio/bgm). Run: node scripts/preshow/gen-bgm.mjs
 *
 *   main.*       150 s, ±77 BPM, Am–F–C–G pads: exactly one pre-show loop
 *   standby.*     30 s, a quiet Am pad
 *   countdown.*  76.8 s = 32 bars at 100 BPM: bass pulse on every beat and a
 *                string line climbing through each 8 bars
 *
 * Every frequency is nudged to complete whole cycles in the loop length and
 * the file is cut from the second pass (reverb already ringing), so each one
 * loops without a seam.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { cleanup, encode, OUT, q, render } from "./encode.mjs";

const CHORDS = [
  [110, 220, 261.63, 329.63], // Am
  [87.31, 174.61, 220, 261.63], // F
  [130.81, 164.81, 196, 261.63], // C
  [98, 196, 246.94, 293.66], // G
];

/** Soft pad voice: fundamental, a detuned double and a quiet octave. */
const voice = (f, period) => `(sin(2*PI*${q(f, period)}*t)+0.6*sin(2*PI*${q(f * 1.004, period)}*t)+0.25*sin(2*PI*${q(f * 2, period)}*t))`;

/** Chords crossfading over half a bar, `bar` seconds each, cycling every 4 bars. */
function pads(bar, period, gain) {
  return CHORDS.map((tones, k) => {
    const d = `abs(mod(t/${bar}-${k}-0.5+8,4)-2)`;
    const w = `clip((1.25-${d})/0.5,0,1)`;
    return `${gain}*${w}*(${tones.map((f) => voice(f, period)).join("+")})`;
  }).join("+");
}

const bgm = path.join(OUT, "bgm");
const own = (name) => existsSync(path.join(bgm, `${name}.webm`)) && existsSync(path.join(bgm, `${name}.m4a`)) && process.argv[2] !== "--force";

if (!own("main")) {
  const P = 150;
  const expr = `(${pads(P / 48, P, 0.06)})*(0.85+0.15*sin(2*PI*t/${P / 10}))+0.015*(random(0)*2-1)*(0.5+0.5*sin(2*PI*t/${P / 5}))`;
  encode(render("bgm-main", expr, P * 2, "lowpass=f=2600,aecho=0.8:0.7:240|420:0.35|0.25"), "bgm", "main", { trim: [P, P * 2] });
  console.log("bgm main");
}
if (!own("standby")) {
  const P = 30;
  const am = CHORDS[0].map((f) => voice(f, P)).join("+");
  encode(render("bgm-standby", `0.07*(${am})*(0.8+0.2*sin(2*PI*t/${P / 2}))`, P * 2, "lowpass=f=1800,aecho=0.8:0.7:260|440:0.35|0.25"), "bgm", "standby", { trim: [P, P * 2] });
  console.log("bgm standby");
}
if (!own("countdown")) {
  const beat = 0.6;
  const P = beat * 4 * 32;
  const bass = CHORDS.map((tones, k) => {
    const on = `between(mod(t,${beat * 4 * 8}),${k * beat * 8},${(k + 1) * beat * 8 - 1e-3})`;
    return `${on}*sin(2*PI*${q(tones[0] / 2 > 40 ? tones[0] : tones[0] * 2, P)}*t)`;
  }).join("+");
  const pulse = `0.5*(${bass})*exp(-7*mod(t,${beat}))`;
  // One string note per bar, climbing an A-minor scale through each 8 bars.
  const scale = [440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880];
  const strings = scale
    .map((f, i) => {
      const on = `between(mod(t,${beat * 32}),${i * beat * 4},${(i + 1) * beat * 4 - 1e-3})`;
      const env = `min(1,mod(t,${beat * 4})/0.35)*min(1,(${beat * 4}-mod(t,${beat * 4}))/0.25)`;
      return `${on}*${env}*(sin(2*PI*${q(f, P)}*t)+0.4*sin(2*PI*${q(f * 1.005, P)}*t))`;
    })
    .join("+");
  const expr = `${pulse}+0.08*(${strings})+(${pads(beat * 8, P, 0.035)})`;
  encode(render("bgm-countdown", expr, P * 2, "lowpass=f=4200,aecho=0.8:0.6:180|300:0.3|0.2"), "bgm", "countdown", { trim: [P, P * 2] });
  console.log("bgm countdown");
}
cleanup();
