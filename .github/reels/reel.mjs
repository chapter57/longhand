// Draws the reels, assets/reels/<id>.mp4 (1080×1920, 30 fps), from
// _data/reels.yml: one of our drawn portraits slides in, a quote arrives a
// word at a time, the attribution follows, and it ends on our name. Each
// frame is drawn in the browser, then ffmpeg makes the video.
//
//   npm install playwright js-yaml   (once; ffmpeg must be installed)
//   python .github/reels/music.py      (first, for reels with music)
//   node .github/reels/reel.mjs [id ...]
import { chromium } from "playwright";
import yaml from "js-yaml";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reels = yaml.load(fs.readFileSync(path.join(root, "_data/reels.yml"), "utf8"));
const only = process.argv.slice(2);
const FPS = 30;
const img = (f) => "data:image/jpeg;base64," + fs.readFileSync(path.join(root, f)).toString("base64");
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "fonts", f)).toString("base64");

function page(r) {
  const words = r.text.split(/\s+/);
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: L; font-style: normal; font-weight: 600; src: url(${font("Literata-normal-600.woff2")}); }
@font-face { font-family: L; font-style: italic; font-weight: 400; src: url(${font("Literata-italic-400.woff2")}); }
@font-face { font-family: M; font-weight: 500; src: url(${font("IBMPlexMono-normal-500.woff2")}); }
html, body { margin: 0; }
#s { width: 1080px; height: 1920px; position: relative; overflow: hidden; background: ${r.bg}; }
#pic { position: absolute; left: 0; width: 1080px; height: 1350px; top: 0; background: url(${img(r.portrait)}) 50% 0 / 1080px auto no-repeat; }
#card { position: absolute; left: 60px; right: 60px; top: 1030px; min-height: 0; background: #fbf7ee; border: 7px solid #16130f; box-shadow: 14px 14px 0 #16130f; padding: 60px 64px; box-sizing: border-box; }
#q { font: italic ${r.text.length > 90 ? 62 : 86}px/1.24 L; color: #16130f; }
#q span { display: inline-block; margin-right: .26em; }
#by { font: 500 34px/1.3 M; letter-spacing: .08em; text-transform: uppercase; color: #16130f; margin-top: 40px; }
#tag { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font: 500 30px M; letter-spacing: .2em; color: #16130f; }
#end { position: absolute; inset: 0; background: #16130f; color: #fbf7ee; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
#end h1 { font: 600 104px/1.05 L; margin: 0 0 40px; }
#end p { font: italic 50px/1.3 L; margin: 0 0 70px; color: #e3ddcf; }
#end b { font: 500 40px M; letter-spacing: .12em; color: ${r.bg}; }
</style>
<div id="s"><div id="pic"></div><div id="tag">LONGHAND LITERATURE</div>
  <div id="card"><div id="q">${words.map((w, i) => `<span id="w${i}">${w}</span>`).join("")}</div><div id="by">${r.by}</div></div>
  <div id="end"><h1>Longhand<br>Literature</h1><p>A writer, a book or a moment<br>from literary history. Every day.</p><b>LONGHANDLIT.COM</b></div></div>
<script>
  const N = ${words.length}, ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  // The state of the reel at time t, in seconds.
  window.at = (t) => {
    const pic = document.getElementById("pic"), card = document.getElementById("card"), by = document.getElementById("by"), end = document.getElementById("end");
    pic.style.transform = "translateY(" + (1 - ease(t / 1.1)) * 700 + "px) scale(" + (1 + 0.03 * Math.min(1, t / ${r.seconds})) + ")";
    card.style.transform = "translateY(" + (1 - ease((t - .5) / .8)) * 1100 + "px)";
    const per = ${r.per ?? 0.28};
    for (let i = 0; i < N; i++) {
      const k = ease((t - 1.4 - i * per) / .25), w = document.getElementById("w" + i);
      w.style.opacity = k; w.style.transform = "translateY(" + (1 - k) * 30 + "px)";
    }
    const tb = 1.4 + N * per + .3;
    by.style.opacity = ease((t - tb) / .4); by.style.transform = "translateX(" + (1 - ease((t - tb) / .4)) * -60 + "px)";
    const te = ${r.seconds} - 3;
    end.style.opacity = ease((t - te) / .5);
  };
</script>`;
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const r of reels) {
  if (only.length && !only.includes(r.id)) continue;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  await tab.setContent(page(r));
  await tab.evaluate(() => document.fonts.ready);
  const frames = Math.round(r.seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await tab.evaluate((t) => window.at(t), f / FPS);
    await tab.locator("#s").screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".jpg"), type: "jpeg", quality: 90 });
  }
  // Instagram wants H.264 with an audio track: the reel's music
  // (assets/music/, played by .github/reels/music.py), or else silence.
  const audio = r.music ? ["-i", path.join(root, "assets/music", r.music + ".m4a"), "-af", `afade=t=out:st=${r.seconds - 1.5}:d=1.5`, "-t", String(r.seconds)]
    : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest"];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "%04d.jpg"),
    ...audio,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "20", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "96k", path.join(root, "assets/reels", r.id + ".mp4")]);
  fs.rmSync(dir, { recursive: true });
  console.log("drew", r.id, frames, "frames");
}
await browser.close();
