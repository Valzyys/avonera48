/** Pre-show sound effects (ffmpeg lavfi). Run: node scripts/preshow/gen-sfx.mjs */
import { cleanup, encode, render } from "./encode.mjs";

const N = "(random(0)*2-1)";
const SFX = {
  // Noise and a sine sweeping up, swelling to the end.
  riser: [`(0.35*${N}+0.5*sin(2*PI*(180*t+330*t*t)))*pow(t/2.6,2.2)`, 2.6, "highpass=f=120,lowpass=f=7000"],
  impact: [`0.9*sin(2*PI*52*t)*exp(-3.2*t)+0.5*${N}*exp(-16*t)`, 1.4, "lowpass=f=3200,aecho=0.8:0.6:60|120:0.3|0.2"],
  "whoosh-in": [`${N}*pow(sin(PI*t/0.8),2)*(t/0.8)`, 0.8, "bandpass=f=1400:width_type=h:w=1800"],
  "whoosh-out": [`${N}*pow(sin(PI*t/0.8),2)*(1-t/0.8)`, 0.8, "bandpass=f=900:width_type=h:w=1400"],
  shimmer: [`(sin(2*PI*2093*t)+0.8*sin(2*PI*2637*t)+0.7*sin(2*PI*3136*t)+0.5*sin(2*PI*4186*t))*0.25*(0.6+0.4*sin(2*PI*9*t))*exp(-2.2*t)*min(1,t/0.05)`, 1.8, "aecho=0.8:0.7:90|170:0.35|0.25"],
  tick: [`sin(2*PI*1500*t)*exp(-70*t)`, 0.09, ""],
  pop: [`sin(2*PI*(720*t-600*t*t))*exp(-22*t)*min(1,t/0.004)`, 0.22, ""],
  swell: [`(sin(2*PI*220*t)+0.7*sin(2*PI*261.63*t)+0.6*sin(2*PI*329.63*t)+0.4*sin(2*PI*110*t))*0.3*pow(t/3,1.6)*min(1,(3.2-t)/0.25)`, 3.2, "lowpass=f=2400,aecho=0.8:0.6:120|240:0.3|0.2"],
  "final-hit": [
    `0.9*sin(2*PI*48*t)*exp(-2.4*t)+0.4*${N}*exp(-12*t)+(sin(2*PI*220*t)+0.8*sin(2*PI*277.18*t)+0.7*sin(2*PI*329.63*t)+0.4*sin(2*PI*440*t))*0.22*exp(-0.9*t)*min(1,t/0.02)`,
    3,
    "lowpass=f=6000,aecho=0.8:0.6:80|160:0.35|0.25",
  ],
  beep: [`sin(2*PI*880*t)*min(1,t/0.005)*min(1,(0.15-t)/0.02)`, 0.15, ""],
  "beep-high": [`sin(2*PI*1320*t)*min(1,t/0.005)*min(1,(0.15-t)/0.02)`, 0.15, ""],
};

for (const [name, [expr, secs, filters]] of Object.entries(SFX)) {
  encode(render(`sfx-${name}`, expr, secs, filters), "sfx", name, { kind: "sfx", kbps: 64 });
  console.log("sfx", name);
}
cleanup();
