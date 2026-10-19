// Draws Instagram carousel slides, assets/instagram/<id>-<n>.jpg (1080×1350),
// from _data/instagram.yml, in the site's own type and colors. Portraits come
// from .github/instagram/portraits/ (see .github/scripts/fetch_portraits.py).
//
//   npm install playwright js-yaml   (once)
//   node .github/instagram/carousel.mjs [id ...]
//
// With no arguments it draws every post.
import { chromium } from "playwright";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const posts = yaml.load(fs.readFileSync(path.join(root, "_data/instagram.yml"), "utf8"));
const portraits = path.join(root, ".github/instagram/portraits");
const credits = fs.existsSync(path.join(portraits, "credits.yml"))
  ? yaml.load(fs.readFileSync(path.join(portraits, "credits.yml"), "utf8")) || {} : {};
const only = process.argv.slice(2);
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "fonts", f)).toString("base64");
const curly = (s) => String(s)
  .replace(/(^|[\s(\[—-])"/g, "$1“").replace(/"/g, "”")
  .replace(/(^|[\s(\[—-])'/g, "$1‘").replace(/'/g, "’");
const esc = (s) => curly(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const style = `
@font-face { font-family: L; font-style: normal; font-weight: 400; src: url(${font("Literata-normal-400.woff2")}); }
@font-face { font-family: L; font-style: normal; font-weight: 600; src: url(${font("Literata-normal-600.woff2")}); }
@font-face { font-family: L; font-style: italic; font-weight: 400; src: url(${font("Literata-italic-400.woff2")}); }
@font-face { font-family: M; font-weight: 500; src: url(${font("IBMPlexMono-normal-500.woff2")}); }
html, body { margin: 0; }
.s { width: 1080px; height: 1350px; box-sizing: border-box; position: relative; overflow: hidden;
  background: #F2F3EE; color: #1E2227; font-family: L; display: flex; flex-direction: column; padding: 96px 100px 88px; }
.top { font: 500 22px/1 M; letter-spacing: 0.14em; text-transform: uppercase; color: #2F4F78;
  border-top: 3px solid currentColor; padding-top: 22px; display: flex; justify-content: space-between; }
.foot { font: 500 21px/1 M; letter-spacing: 0.12em; text-transform: uppercase; color: #8E9398;
  display: flex; justify-content: space-between; align-items: center; }
.mid { flex: 1; display: flex; flex-direction: column; justify-content: center; }
h2 { font: 600 76px/1.08 L; letter-spacing: -0.015em; margin: 0 0 44px; }
p { font: 40px/1.5 L; margin: 0; color: #2B3036; }
.words { margin: 10px 0 48px; }
.word { font: italic 104px/1.15 L; color: #2F4F78; }
/* cover */
.cover { padding: 0; color: #F2F3EE; background: #1E2227; }
.cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.cover .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,22,25,0.35) 0%, rgba(20,22,25,0) 22%, rgba(20,22,25,0) 38%, rgba(20,22,25,0.86) 64%, rgba(20,22,25,0.97) 100%); }
.cover .in { position: relative; height: 100%; box-sizing: border-box; padding: 84px 100px 80px; display: flex; flex-direction: column; }
.cover .top { color: #F2F3EE; }
.cover .kick { font: 500 26px/1 M; letter-spacing: 0.14em; text-transform: uppercase; color: #C9D6E8; margin-top: auto; }
.cover h1 { font: 600 98px/1.04 L; letter-spacing: -0.02em; margin: 26px 0 26px; }
.cover .sub { font: italic 48px/1.3 L; color: #E3E1DA; }
.cover .row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 44px; gap: 40px; }
.cover .credit { font: 500 16px/1.4 M; letter-spacing: 0.04em; color: #A3A8AE; max-width: 640px; }
.cover .swipe { font: 500 24px/1 M; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
/* quote */
.quote { background: #2F4F78; color: #F2F3EE; }
.quote .top, .quote .foot { color: #C9D6E8; }
.mark { font: 600 220px/0.6 L; color: #9DB6D6; height: 110px; }
blockquote { font: italic 68px/1.32 L; margin: 0; letter-spacing: -0.01em; }
.by { font: 500 24px/1.5 M; letter-spacing: 0.06em; color: #C9D6E8; margin-top: 52px; text-transform: uppercase; }
/* end */
.end .mid { align-items: flex-start; }
.end h2 { font-size: 84px; }
.end .handle { font: 600 54px/1 L; color: #2F4F78; margin: 8px 0 56px; }
.end li { font: 38px/1.45 L; list-style: none; margin: 0 0 18px; padding-left: 52px; position: relative; }
.end li::before { content: "→"; position: absolute; left: 0; color: #2F4F78; font-family: M; }
.end ul { margin: 0; padding: 0; }
/* the red margin line of a notebook page */
.ruled::before { content: ""; position: absolute; top: 0; bottom: 0; left: 64px; width: 2px; background: rgba(170, 70, 60, 0.35); }
`;

function slide(s, n, total, id) {
  const count = `<span>${n} / ${total}</span>`;
  const top = `<div class="top"><span>The Longhand Almanac</span>${count}</div>`;
  const foot = `<div class="foot"><span>@longhandliterature</span><span>${n < total ? "Swipe →" : ""}</span></div>`;
  if (s.kind === "cover") {
    const file = credits[s.portrait] ? path.join(portraits, credits[s.portrait].file) : "";
    const img = file && fs.existsSync(file)
      ? `<img src="data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}">` : "";
    const c = credits[s.portrait];
    const credit = c ? `Portrait: ${esc(c.artist || "Unknown artist")}${c.license ? ", " + esc(c.license) : ""}, via Wikimedia Commons` : "";
    return `<div class="s cover">${img}<div class="shade"></div><div class="in">
      <div class="top"><span>The Longhand Almanac</span>${count}</div>
      <div class="kick">${esc(s.kicker)}</div><h1>${esc(s.title)}</h1><div class="sub">${esc(s.sub)}</div>
      <div class="row"><div class="credit">${credit}</div><div class="swipe">Swipe →</div></div></div></div>`;
  }
  if (s.kind === "quote") {
    return `<div class="s quote">${top}<div class="mid"><div class="mark">“</div>
      <blockquote>${esc(s.text)}</blockquote><div class="by">${esc(s.by)}</div></div>${foot}</div>`;
  }
  if (s.kind === "words") {
    return `<div class="s ruled">${top}<div class="mid"><h2>${esc(s.title)}</h2>
      <div class="words">${s.words.map((w) => `<div class="word">${esc(w)}</div>`).join("")}</div>
      <p>${esc(s.body)}</p></div>${foot}</div>`;
  }
  if (s.kind === "end") {
    return `<div class="s end ruled">${top}<div class="mid">
      <h2>A writer, a book or a moment from literary history. Every day.</h2>
      <div class="handle">Follow @longhandliterature</div>
      <ul><li>Save this post for later</li><li>Send it to a reader you love</li><li>The full story is at the link in our bio</li></ul>
      </div><div class="foot"><span>longhandlit.com</span><span></span></div></div>`;
  }
  return `<div class="s ruled">${top}<div class="mid"><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></div>${foot}</div>`;
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
fs.mkdirSync(path.join(root, "assets/instagram"), { recursive: true });
for (const post of posts) {
  if (only.length && !only.includes(post.id)) continue;
  const total = post.slides.length;
  for (const [i, s] of post.slides.entries()) {
    await tab.setContent(`<!doctype html><meta charset="utf-8"><style>${style}</style>${slide(s, i + 1, total, post.id)}`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.locator(".s").screenshot({ path: path.join(root, "assets/instagram", `${post.id}-${i + 1}.jpg`), type: "jpeg", quality: 90 });
  }
  console.log("drew", post.id, total, "slides");
}
await browser.close();
