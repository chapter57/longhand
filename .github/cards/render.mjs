// Draws the evening quote cards, assets/cards/<month>-<day>.png, from
// _data/social.yml, in the site's own type and colors, and a .jpg copy of each
// for Instagram, which only takes JPEG pictures.
//
//   npm install playwright js-yaml   (once)
//   node .github/cards/render.mjs [month-day ...]
//
// With no arguments it draws every card. A day whose writer is still in
// copyright has "about" instead of a quote, and gets a card with the writer's
// portrait (from .github/instagram/portraits/) and those words.
import { chromium } from "playwright";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const days = yaml.load(fs.readFileSync(path.join(root, "_data/social.yml"), "utf8"));
const only = process.argv.slice(2);
const entries = Object.fromEntries(fs.readdirSync(path.join(root, "_almanac")).map((f) => {
  const e = yaml.load(fs.readFileSync(path.join(root, "_almanac", f), "utf8").split("---")[1]);
  return [`${e.month}-${e.day}`, e];
}));
const portraits = path.join(root, ".github/instagram/portraits");
const credits = yaml.load(fs.readFileSync(path.join(portraits, "credits.yml"), "utf8")) || {};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "fonts", f)).toString("base64");
// Typewriter quotes to printer's quotes.
const curly = (s) => String(s)
  .replace(/(^|[\s(\[—-])"/g, "$1\u201c").replace(/"/g, "\u201d")
  .replace(/(^|[\s(\[—-])'/g, "$1\u2018").replace(/'/g, "\u2019");
// A poem keeps its lines; prose wraps.
const isPoem = (t) => t.includes("\n") && t.split("\n").every((l) => l.length <= 72);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function page(d) {
  const e = d.evening;
  const text = String(e.text).trim(), poem = isPoem(text);
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: L; font-style: normal; src: url(${font("Literata-normal-400.woff2")}); }
@font-face { font-family: L; font-style: italic; src: url(${font("Literata-italic-400.woff2")}); }
@font-face { font-family: M; font-weight: 500; src: url(${font("IBMPlexMono-normal-500.woff2")}); }
html, body { margin: 0; }
.card { width: 1080px; height: 1350px; box-sizing: border-box; padding: 96px 100px 84px;
  background: #F2F3EE; color: #1E2227; display: flex; flex-direction: column; }
.top { font: 500 22px/1 M; letter-spacing: 0.14em; text-transform: uppercase; color: #2F4F78;
  border-top: 3px solid #1E2227; padding-top: 22px; display: flex; justify-content: space-between; }
.title { font: italic 40px/1.25 L; color: #2F4F78; margin: 64px 0 36px; }
.body { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding-bottom: 24px; }
.text { font-family: L; white-space: pre-line; margin: 0; letter-spacing: -0.005em; }
.poem .text { white-space: normal; }
.ln { padding-left: 1.2em; text-indent: -1.2em; }
.nowrap .ln { white-space: nowrap; }
.gap { height: 0.7em; }
.by { margin-top: 40px; border-top: 1px solid #D3D6CC; padding-top: 26px; }
.author { font: 32px/1.3 L; }
.source { font: 500 20px/1.5 M; color: #5B6168; letter-spacing: 0.03em; margin-top: 8px; }
.foot { margin-top: 36px; font: 500 20px/1 M; letter-spacing: 0.12em; color: #8E9398; text-transform: uppercase; }
</style>
<div class="card">
  <div class="top"><span>The Longhand Almanac</span><span>${MONTHS[d.month - 1]} ${d.day}</span></div>
  <div class="title">${esc(curly(e.title))}</div>
  <div class="body${poem ? " poem" : ""}"><div class="text">${poem
    ? text.split("\n").map((l) => l.trim() ? `<div class="ln">${esc(curly(l))}</div>` : `<div class="gap"></div>`).join("")
    : esc(curly(text))}</div></div>
  <div class="by"><div class="author">${esc(curly(e.author))}</div><div class="source">${esc(curly(e.source))}</div></div>
  <div class="foot">longhandlit.com</div>
</div>`;
}

// The card for a writer still in copyright: portrait, name and a few words.
function aboutPage(d) {
  const e = entries[`${d.month}-${d.day}`], c = credits[`${d.month}-${d.day}`];
  // Only a portrait of this writer (an old file may be of the day's previous writer).
  const file = c && c.pictured === e.name && c.license ? path.join(portraits, c.file) : "";
  const img = file && fs.existsSync(file)
    ? `<img src="data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(file).toString("base64")}">` : "";
  const when = `${{ Born: "Born", Died: "Died" }[e.kind] || "On this day"} ${MONTHS[d.month - 1]} ${d.day}, ${e.year}`;
  // Commons sometimes repeats the name ("Unknown authorUnknown author").
  let artist = String((c && c.artist) || "");
  if (artist.length % 2 === 0 && artist.slice(0, artist.length / 2) === artist.slice(artist.length / 2)) artist = artist.slice(0, artist.length / 2);
  if (/^unknown/i.test(artist)) artist = "";
  const credit = img ? `Portrait: ${artist ? artist + ", " : ""}${c.license}, via Wikimedia Commons` : "";
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: L; font-style: normal; font-weight: 400; src: url(${font("Literata-normal-400.woff2")}); }
@font-face { font-family: L; font-style: normal; font-weight: 600; src: url(${font("Literata-normal-600.woff2")}); }
@font-face { font-family: M; font-weight: 500; src: url(${font("IBMPlexMono-normal-500.woff2")}); }
html, body { margin: 0; }
.card { width: 1080px; height: 1350px; box-sizing: border-box; padding: 96px 100px 84px;
  background: #F2F3EE; color: #1E2227; display: flex; flex-direction: column; }
.top { font: 500 22px/1 M; letter-spacing: 0.14em; text-transform: uppercase; color: #2F4F78;
  border-top: 3px solid #1E2227; padding-top: 22px; display: flex; justify-content: space-between; }
.pic { margin-top: 48px; height: 560px; background: #E4E9F0; overflow: hidden; flex: none; }
.pic img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; filter: grayscale(1) contrast(1.05); }
.nopic .pic { display: none; }
.when { font: 500 24px/1 M; letter-spacing: 0.12em; text-transform: uppercase; color: #2F4F78; margin-top: 52px; }
.nopic .when { margin-top: auto; }
h1 { font: 600 84px/1.04 L; letter-spacing: -0.02em; margin: 20px 0 30px; }
.nopic h1 { font-size: 120px; }
.about { font: 34px/1.45 L; color: #2B3036; flex: 1; overflow: hidden; }
.nopic .about { flex: none; font-size: 42px; margin-bottom: auto; }
.foot { margin-top: 24px; font: 500 20px/1 M; letter-spacing: 0.12em; color: #8E9398; text-transform: uppercase;
  display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
.credit { font: 500 15px/1.4 M; letter-spacing: 0.03em; text-transform: none; max-width: 620px; text-align: right; }
</style>
<div class="card${img ? "" : " nopic"}">
  <div class="top"><span>The Longhand Almanac</span><span>${MONTHS[d.month - 1]} ${d.day}</span></div>
  <div class="pic">${img}</div>
  <div class="when">${esc(when)}</div>
  <h1>${esc(e.name)}</h1>
  <div class="about">${esc(curly(String(d.evening.about).trim()))}</div>
  <div class="foot"><span>longhandlit.com</span><span class="credit">${esc(credit)}</span></div>
</div>`;
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const d of days) {
  const key = `${d.month}-${d.day}`;
  if (only.length && !only.includes(key)) continue;
  if (d.evening.about) {
    await tab.setContent(aboutPage(d));
    await tab.evaluate(() => document.fonts.ready);
    // Smaller type if the words are long.
    await tab.evaluate(() => {
      const a = document.querySelector(".about");
      for (let size = parseFloat(getComputedStyle(a).fontSize); a.scrollHeight > a.clientHeight + 1 && size > 24; size -= 1)
        a.style.fontSize = size - 1 + "px";
    });
  } else {
    await tab.setContent(page(d));
    await tab.evaluate(() => document.fonts.ready);
    // The largest type size, up to 60px, at which the text fits.
    await tab.evaluate(() => {
      const box = document.querySelector(".body"), text = document.querySelector(".text");
      // A poem keeps whole lines while the type stays large; below that its
      // long lines wrap, with an indent.
      const poem = box.classList.contains("poem");
      const fits = (size, nowrap) => {
        text.style.fontSize = size + "px";
        text.classList.toggle("nowrap", nowrap);
        text.style.lineHeight = size > 44 ? "1.42" : "1.5";
        return text.scrollHeight <= box.clientHeight - 24 && text.scrollWidth <= box.clientWidth;
      };
      let done = false;
      if (poem) for (let size = 60; size >= 38 && !done; size -= 1) done = fits(size, true);
      for (let size = poem ? 50 : 60; size >= 24 && !done; size -= 1) done = fits(size, false);
    });
  }
  await tab.locator(".card").screenshot({ path: path.join(root, "assets/cards", key + ".png") });
  await tab.locator(".card").screenshot({ path: path.join(root, "assets/cards", key + ".jpg"), type: "jpeg", quality: 90 });
  console.log("drew", key);
}
await browser.close();
