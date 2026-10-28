// Pictures of the printed calendar for the shop page and social posts: the
// calendar hanging over a desk, lying open on a table, and up close. Built
// from the page pictures that calendar.mjs writes with PREVIEW=1.
//   node .github/calendar/mockups.mjs <calendar-out-dir> <out-dir>
import { chromium } from "playwright";
import fs from "fs";
const [PAGES, OUT] = process.argv.slice(2);
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(`fonts/${f}`).toString("base64");
// A page picture, with the 0.125 in bleed trimmed off by the frame around it.
const page = (n) => `data:image/jpeg;base64,${fs.readFileSync(`${PAGES}/page-${String(n).padStart(2, "0")}.jpg`).toString("base64")}`;
const pg = (n, w) => `<div class="pg" style="width:${w}px;height:${w * 8.5 / 11}px"><img src="${page(n)}"></div>`;
const wire = (w) => `<div class="wire" style="width:${w}px">${"<i></i>".repeat(Math.round(w / 15))}</div>`;
// One hanging calendar, open to a month: the picture page above, the grid below.
const hanging = (m, w) => `<div class="cal" style="width:${w}px"><div class="hook"></div>${pg(2 * m, w)}${wire(w * .96)}${pg(2 * m + 1, w)}</div>`;
// Wood and plaster textures, made by hand in Python, in .github/calendar/textures/.
const tex = (k) => `background:url(data:image/jpeg;base64,${fs.readFileSync(`.github/calendar/textures/${k}.jpg`).toString("base64")}) 0 0/cover`;
const css = `
@font-face{font-family:L;font-weight:600;src:url(${font("Literata-normal-600.woff2")})}
@font-face{font-family:L;font-style:italic;src:url(${font("Literata-italic-400.woff2")})}
@font-face{font-family:M;font-weight:500;src:url(${font("IBMPlexMono-normal-500.woff2")})}
*{box-sizing:border-box}body{margin:0}
.s{width:1080px;height:1350px;position:relative;overflow:hidden}
.pg{overflow:hidden;position:relative;background:#fbf7ee}
.pg img{position:absolute;width:102.2%;height:102.9%;left:-1.1%;top:-1.45%}
.cal{position:absolute;filter:drop-shadow(0 18px 26px rgba(40,30,20,.32)) drop-shadow(0 3px 5px rgba(40,30,20,.25))}
.cal .pg:first-of-type{box-shadow:inset 0 -30px 30px -30px rgba(0,0,0,.25)}
.wire{height:16px;margin:-8px auto;position:relative;z-index:2;display:flex;justify-content:space-between}
.wire i{width:7px;height:16px;border-radius:4px;background:linear-gradient(90deg,#d8d8d8,#8a8a8a 45%,#f2f2f2 60%,#9a9a9a);box-shadow:0 1px 1px rgba(0,0,0,.4)}
.hook{position:absolute;left:50%;top:-34px;width:40px;height:38px;margin-left:-20px;border:3px solid #8f8f8f;border-bottom:none;border-radius:20px 20px 0 0;clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}
.hook:before{content:"";position:absolute;left:13px;top:-12px;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ddd,#555);box-shadow:2px 3px 3px rgba(0,0,0,.35)}
.wall{position:absolute;inset:0;background:radial-gradient(ellipse at 18% 8%,#f7f1e6,#e6dccb 55%,#d2c6b1)}
.light{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,250,235,.0) 30%,rgba(255,248,230,.35) 42%,rgba(255,250,235,0) 58%);mix-blend-mode:screen}
.desk{position:absolute;left:-20px;right:-20px;height:300px;background:linear-gradient(#7a5236,#5a3a24)}
.desk:before{content:"";position:absolute;left:0;right:0;top:0;height:14px;background:linear-gradient(#a3754f,#7a5236)}
.book{position:absolute;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15),0 4px 8px rgba(0,0,0,.3)}
.cap{font:600 50px/1.1 L;color:#16130f}
.tag{font:500 18px M;letter-spacing:.24em;color:#2F4F78}
`;
const scenes = {
  // The calendar on the wall above a writing desk.
  "hanging-desk": `<div class="s"><div style="position:absolute;inset:0;${tex("plaster")}"></div><div class="wall" style="opacity:.55"></div><div class="light"></div>
    ${hanging(1, 520).replace('class="cal"', 'class="cal" style="left:280px;top:96px"')}
    <div class="desk" style="top:1080px"><div style="position:absolute;inset:14px 0 0;${tex("wood")}"></div></div>
    <div style="position:absolute;left:0;right:0;top:1080px;height:60px;background:linear-gradient(rgba(0,0,0,.18),transparent)"></div>
    <!-- lamp -->
    <div style="position:absolute;left:90px;top:860px;width:150px;height:96px;background:linear-gradient(#2F4F78,#203a5a);border-radius:75px 75px 6px 6px;box-shadow:0 8px 14px rgba(0,0,0,.3)"></div>
    <div style="position:absolute;left:96px;top:950px;width:138px;height:22px;border-radius:50%;background:radial-gradient(#fff6d8,#f2d58a)"></div>
    <div style="position:absolute;left:160px;top:960px;width:10px;height:118px;background:linear-gradient(90deg,#999,#555)"></div>
    <div style="position:absolute;left:115px;top:1062px;width:100px;height:22px;border-radius:50%;background:linear-gradient(#444,#222)"></div>
    <!-- books -->
    <div class="book" style="left:760px;top:1040px;width:230px;height:40px;background:#8a2f2a"></div>
    <div class="book" style="left:775px;top:1004px;width:200px;height:36px;background:#e7dcc6"></div>
    <div class="book" style="left:765px;top:972px;width:215px;height:32px;background:#2c4a3e"></div>
    <!-- mug -->
    <div style="position:absolute;left:620px;top:1000px;width:84px;height:84px;border-radius:6px 6px 14px 14px;background:linear-gradient(90deg,#e9e4da,#fbf8f2 40%,#cfc8bb);box-shadow:0 6px 10px rgba(0,0,0,.3)"></div>
    <div style="position:absolute;left:692px;top:1018px;width:34px;height:44px;border:9px solid #e2ddd2;border-left:none;border-radius:0 22px 22px 0"></div>
    <!-- pencils -->
    <div style="position:absolute;left:330px;top:1100px;width:300px;height:12px;background:linear-gradient(#f2c230,#d9a227);transform:rotate(-4deg);box-shadow:0 3px 4px rgba(0,0,0,.35);border-radius:2px"></div>
    </div>`,
  // Open on a table, seen from above, with a pencil and a cup of coffee.
  "flat-lay": `<div class="s" style="background:#7a5236"><div style="position:absolute;inset:-200px;transform:rotate(90deg);${tex("wood")}"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 40% 35%,rgba(255,240,215,.25),rgba(0,0,0,.25))"></div>
    ${hanging(8, 600).replace('class="cal"', 'class="cal" style="left:200px;top:100px;transform:rotate(-5deg)"').replace('<div class="hook"></div>', "")}
    <div style="position:absolute;left:790px;top:1060px;width:230px;height:230px;border-radius:50%;background:radial-gradient(#f2efe8 58%,#d9d3c8 60%,#f6f3ed 66%);box-shadow:0 14px 24px rgba(0,0,0,.4)"></div>
    <div style="position:absolute;left:840px;top:1110px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle at 45% 40%,#6b4027,#2e1a0e 70%);box-shadow:inset 0 0 0 9px #fbf8f2"></div>
    <div style="position:absolute;left:60px;top:1180px;width:420px;height:16px;background:linear-gradient(#45b3c4,#2f8a99);transform:rotate(14deg);border-radius:3px;box-shadow:0 5px 6px rgba(0,0,0,.4)"></div>
    </div>`,
  // A close look at a month's grid, tilted, with a writer for every day.
  "grid-close": `<div class="s" style="background:#e9e2d3"><div style="position:absolute;inset:0;${tex("plaster")}"></div>
    <div style="position:absolute;left:-260px;top:250px;transform:perspective(1600px) rotateY(18deg) rotateX(8deg) rotate(-6deg);filter:drop-shadow(0 30px 40px rgba(40,30,20,.35))">${pg(17, 1300)}</div>
    <div style="position:absolute;left:70px;top:80px"><div class="tag">THE LONGHAND ALMANAC · 2027</div><div class="cap" style="margin-top:14px">A writer for every day.</div></div>
    </div>`,
  // The front cover, propped at an angle.
  "cover": `<div class="s" style="background:#e9e2d3"><div style="position:absolute;inset:0;${tex("plaster")}"></div>
    <div style="position:absolute;left:70px;top:90px"><div class="tag">NEW FROM LONGHAND PUBLISHING</div><div class="cap" style="margin-top:14px">Twelve writers.<br>One for every month.</div></div>
    <div style="position:absolute;left:60px;top:420px;transform:perspective(1800px) rotateX(10deg) rotate(-3deg);filter:drop-shadow(0 30px 34px rgba(40,30,20,.38))">${pg(1, 960)}</div>
    </div>`,
  // The link card for Bluesky and the site, 1200 x 630.
  "card": `<div class="s" style="width:1200px;height:630px;background:#e9e2d3"><div style="position:absolute;inset:0;${tex("plaster")}"></div>
    <div style="position:absolute;left:56px;top:70px;width:470px"><div class="tag">LONGHAND PUBLISHING</div><div class="cap" style="margin-top:16px;font-size:54px">The Longhand Almanac 2027</div>
    <div style="font:italic 28px/1.35 L;color:#333;margin-top:18px">A writer for every day of the year, and one on your wall every month.</div></div>
    <div class="cal" style="left:600px;top:40px;transform:rotate(3deg)">${pg(16, 540)}${wire(520)}${pg(17, 540)}</div>
    </div>`,
};
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
fs.mkdirSync(OUT, { recursive: true });
for (const [k, body] of Object.entries(scenes)) {
  await tab.setViewportSize(k === "card" ? { width: 1200, height: 630 } : { width: 1080, height: 1350 });
  await tab.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${body}`, { waitUntil: "load", timeout: 0 });
  await tab.evaluate(() => document.fonts.ready);
  await tab.locator(".s").screenshot({ path: `${OUT}/${k}.jpg`, type: "jpeg", quality: 90 });
  console.log("made", k);
}
await browser.close();
