// Draws the evening quote cards, assets/cards/<month>-<day>.png, from
// _data/social.yml, in the site's own type and colors, and a .jpg copy of each
// for Instagram, which only takes JPEG pictures.
//
//   npm install playwright js-yaml   (once)
//   node .github/cards/render.mjs [month-day ...]
//
// With no arguments it draws every card.
import { chromium } from "playwright";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const days = yaml.load(fs.readFileSync(path.join(root, "_data/social.yml"), "utf8"));
const only = process.argv.slice(2);
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

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const d of days) {
  const key = `${d.month}-${d.day}`;
  if (only.length && !only.includes(key)) continue;
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
  await tab.locator(".card").screenshot({ path: path.join(root, "assets/cards", key + ".png") });
  await tab.locator(".card").screenshot({ path: path.join(root, "assets/cards", key + ".jpg"), type: "jpeg", quality: 90 });
  console.log("drew", key);
}
await browser.close();
