// Draws the almanac's memes, assets/memes/<month>-<day>.jpg (1080×1080), in a
// deliberately homemade style: plain Arial and Times, wobbly mouse-drawn
// doodles, public-domain portraits from .github/instagram/portraits/, then
// crunched by crunch.py to look reposted. Their captions are in _data/memes.yml.
//
//   npm install playwright   (once; crunch.py needs Pillow)
//   node .github/memes/memes.mjs [month-day ...]
import { chromium } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const P = path.join(root, ".github/instagram/portraits");
const pic = (key) => {
  const f = fs.readdirSync(P).find((n) => n.startsWith(key + "."));
  return `data:image/${f.endsWith("png") ? "png" : "jpeg"};base64,` + fs.readFileSync(path.join(P, f)).toString("base64");
};
const only = process.argv.slice(2);

const css = `body{margin:0;background:#fff}
.m{width:1080px;height:1080px;background:#fff;position:relative;overflow:hidden;font-family:"Liberation Sans";color:#111}
.sans{font-weight:bold;font-family:"Liberation Sans"}.serif{font-family:"Liberation Serif"}
.a{position:absolute}.cap{padding:26px 34px 0;font:bold 50px/1.12 "Liberation Sans"}.say{padding:14px 34px 0;font:46px/1.15 "Liberation Serif"}
.line{position:absolute;background:#111}
svg.d{position:absolute;left:0;top:0;width:1080px;height:1080px;filter:url(#w)}
img.cut{position:absolute;object-fit:cover}`;
// Lines look drawn with a mouse.
const wob = `<svg width=0 height=0 style="position:absolute"><filter id="w"><feTurbulence baseFrequency="0.03" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter></svg>`;
const S = (inner) => `<svg class="d" viewBox="0 0 1080 1080">${inner}</svg>`;
const hat = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-80 0 L0 -150 L90 0 Z" fill="#ff3fa4" stroke="#111" stroke-width="6"/>
  <path d="M-40 -30 l40 25 M0 -90 l40 30 M30 -40 l25 30" stroke="#ffe600" stroke-width="11"/><circle cx="0" cy="-150" r="20" fill="#ffe600" stroke="#111" stroke-width="5"/></g>`;

const memes = {
  "10-19": `<div class="cap">me: writes an entire book about urns and dying</div>
    <img class="cut" src="${pic("10-19")}" style="left:170px;top:160px;width:740px;height:760px;object-position:50% 15%">
    ${S(hat(540, 300, 1.2) + `<path d="M930 560 l100 -45 M940 610 l110 0 M930 660 l100 45" stroke="#111" stroke-width="7"/>
      <path d="M100 220 l20 30 M80 520 l30 -10 M960 240 l-20 30 M120 820 l25 20" stroke="#e0461f" stroke-width="10"/>`)}
    <div class="a sans" style="left:700px;top:820px;font-size:36px;color:#fff;background:#111;padding:6px 12px;transform:rotate(-4deg)">horn noise</div>
    <div class="a say" style="left:0;top:950px">also me, on my 77th birthday: 💀</div>`,
  "10-20": `<div class="cap" style="text-align:center;padding-top:30px">arthur rimbaud's career arc</div>
    <div class="line" style="left:0;right:0;top:110px;height:5px"></div><div class="line" style="left:538px;top:110px;bottom:0;width:5px"></div>
    <img class="cut" src="${pic("10-20")}" style="left:0;top:115px;width:538px;height:760px;object-position:50% 20%">
    <div class="a serif" style="left:24px;top:900px;font-size:46px;width:490px">age 17: reinvents poetry</div>
    ${S(`<path d="M620 380 h300 l-34 300 h-232 z" fill="#fff" stroke="#111" stroke-width="7"/><path d="M920 430 q100 0 80 90 q-17 70 -98 58" fill="none" stroke="#111" stroke-width="8"/>
      <path d="M690 350 q-20 -45 0 -80 q20 -35 0 -70 M770 350 q-20 -45 0 -80 q20 -35 0 -70 M850 350 q-20 -45 0 -80" fill="none" stroke="#888" stroke-width="6"/>
      <ellipse cx="770" cy="385" rx="150" ry="20" fill="#5b3415"/>`)}
    <img src="${pic("10-20")}" style="position:absolute;left:690px;top:470px;width:160px;height:160px;border-radius:50%;object-fit:cover;object-position:50% 25%;transform:rotate(8deg)">
    <div class="a serif" style="left:566px;top:900px;font-size:46px;width:490px">age 21: "im in coffee now"</div>`,
  "10-21": `<div class="say" style="padding-top:40px">every other writer: *puts in a new page*</div>
    <div class="cap" style="padding-top:30px">jack kerouac, 1951:</div>
    ${S(`<path d="M150 470 C 330 360, 450 570, 630 450 S 900 360, 1100 500" fill="none" stroke="#111" stroke-width="74"/>
      <path d="M150 470 C 330 360, 450 570, 630 450 S 900 360, 1100 500" fill="none" stroke="#fffbea" stroke-width="66"/>
      <path d="M210 455 h40 M290 440 h60 M370 480 h50 M480 495 h70 M670 440 h60 M790 420 h50 M900 440 h60" stroke="#666" stroke-width="5"/>
      <rect x="60" y="490" width="250" height="160" rx="14" fill="#2b2b2b" stroke="#111" stroke-width="6"/><rect x="95" y="650" width="180" height="44" fill="#2b2b2b"/>
      <g fill="#ddd" stroke="#111" stroke-width="3">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${100 + i * 42}" cy="535" r="13"/>`).join("")}${[0, 1, 2, 3].map((i) => `<circle cx="${121 + i * 42}" cy="578" r="13"/>`).join("")}</g>
      <path d="M560 650 C 720 720, 880 700, 990 610" fill="none" stroke="#e0161f" stroke-width="7"/><path d="M990 610 l-38 5 M990 610 l-8 34" stroke="#e0161f" stroke-width="7"/>`)}
    <div class="a sans" style="left:620px;top:720px;font-size:60px;color:#e0161f;transform:rotate(-6deg)">120 FEET</div>
    <div class="a serif" style="left:280px;top:880px;font-size:40px">(he wrote On the Road in 3 weeks)</div>`,
  "10-23": `<div class="say" style="padding-top:40px">me at 15: *gets my learner's permit*</div>
    <div class="cap" style="padding-top:30px">philip lamantia at 15: *gets his poems published by the new york surrealists*</div>
    ${S(`<g transform="translate(360,620)"><path d="M-170 -120 q170 -60 300 0 q40 120 -20 170 q-30 30 -10 140 q-20 40 -40 0 q0 -90 -50 -110 q-160 20 -180 -60 q-20 -80 0 -140z" fill="#ffe9a8" stroke="#111" stroke-width="7"/>
      <path d="M-20 -30 v-80 M-20 -30 l70 40" stroke="#111" stroke-width="9"/><circle cx="-20" cy="-30" r="10"/></g>
      <g transform="translate(800,640)"><path d="M-160 0 q160 -150 320 0 q-160 150 -320 0z" fill="#fff" stroke="#111" stroke-width="7"/><circle r="55" fill="#2c6fbb" stroke="#111" stroke-width="5"/><circle r="22"/></g>
      <path d="M560 900 q60 -40 120 0 t120 0 t120 0" fill="none" stroke="#e0461f" stroke-width="8"/>`)}
    <div class="a serif" style="left:60px;top:960px;font-size:36px">(he grew up to read at the six gallery with ginsberg)</div>`,
  "10-24": `<div class="say">me at 12: *does homework*</div>
    <div class="cap" style="padding-top:30px">denise levertov at 12:</div>
    ${S(`<rect x="250" y="300" width="560" height="340" fill="#fff" stroke="#111" stroke-width="7"/>
      <path d="M250 300 L530 500 L810 300" fill="none" stroke="#111" stroke-width="7"/>
      <rect x="700" y="320" width="80" height="90" fill="#e0461f" stroke="#111" stroke-width="5"/>
      <path d="M880 460 C 950 420, 990 380, 1040 300" fill="none" stroke="#e0161f" stroke-width="8"/><path d="M1040 300 l-38 8 M1040 300 l-4 38" stroke="#e0161f" stroke-width="8"/>`)}
    <div class="a serif" style="left:330px;top:540px;font-size:34px;transform:rotate(-2deg)">to: T. S. ELIOT, LONDON<br>(my poems, pls read)</div>
    <div class="a sans" style="left:830px;top:240px;font-size:34px;color:#e0161f;transform:rotate(-8deg)">mails them</div>
    <div class="a say" style="left:0;top:720px;padding-right:40px">T. S. Eliot:</div>
    <div class="a cap" style="left:0;top:790px;padding-right:60px">*actually writes back with pages of advice*</div>`,
  "10-25": `<div class="cap">chaucer's plan: 30 pilgrims tell 4 tales each</div>
    <div class="line" style="left:0;right:0;top:200px;height:5px"></div><div class="line" style="left:538px;top:200px;bottom:0;width:5px"></div>
    <div class="a sans" style="left:150px;top:220px;font-size:46px">the plan</div><div class="a sans" style="left:620px;top:220px;font-size:46px">what he finished</div>
    ${S(Array.from({ length: 13 }, (_, i) => `<rect x="${110 + (i % 2) * 14}" y="${880 - i * 46}" width="300" height="40" fill="${["#c0392b", "#2c6fbb", "#e3b33a", "#3e8e41", "#7d3c98"][i % 5]}" stroke="#111" stroke-width="5"/>`).join("")
      + `<rect x="700" y="880" width="200" height="40" fill="#2c6fbb" stroke="#111" stroke-width="5"/><rect x="712" y="835" width="180" height="40" fill="#c0392b" stroke="#111" stroke-width="5"/>`)}
    <div class="a sans" style="left:200px;top:940px;font-size:60px;color:#e0161f">120</div><div class="a sans" style="left:770px;top:940px;font-size:60px;color:#e0161f">24</div>
    <img class="cut" src="${pic("10-25")}" style="left:650px;top:430px;width:290px;height:340px;object-position:50% 15%;transform:rotate(6deg)">`,
  "10-26": `<div class="cap">beryl markham: first woman to fly solo across the atlantic from east to west</div>
    <img class="cut" src="${pic("10-26")}" style="left:30px;top:200px;width:470px;height:600px;object-position:50% 20%">
    <div class="a say" style="left:540px;top:200px;padding:0;font-size:52px">the landing:</div>
    ${S(`<path d="M520 900 Q 780 840 1080 900 L1080 1080 L520 1080 Z" fill="#6b4a2b" stroke="#111" stroke-width="6"/>
      <g transform="translate(800,760) rotate(38)"><rect x="-150" y="-30" width="300" height="60" rx="28" fill="#d8d8d8" stroke="#111" stroke-width="6"/>
      <rect x="-60" y="-120" width="60" height="240" fill="#bbb" stroke="#111" stroke-width="6"/><path d="M-150 0 l-40 -50 l0 100 z" fill="#bbb" stroke="#111" stroke-width="6"/></g>
      <path d="M900 860 l60 -40 M920 900 l80 -10 M880 830 l20 -60" stroke="#6b4a2b" stroke-width="12"/>`)}
    <div class="a sans" style="left:600px;top:470px;font-size:80px;color:#e0161f;transform:rotate(-10deg)">SPLAT</div>
    <div class="a serif" style="left:560px;top:1000px;font-size:34px;color:#fff">(a bog in nova scotia)</div>`,
  "10-27": `<div class="cap">october 27 is the birthday of dylan thomas AND sylvia plath</div>
    <div class="say" style="padding-top:20px">the birthday party:</div>
    <img class="cut" src="${pic("10-27")}" style="left:80px;top:330px;width:420px;height:520px;object-position:50% 20%;transform:rotate(-3deg)">
    ${S(hat(300, 360, 0.9) + `<path d="M560 330 q20 -90 120 -70 q40 -80 140 -40 q100 -20 110 80 q60 40 0 90 h-360 q-60 -30 -10 -60z" fill="#777" stroke="#111" stroke-width="7"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${600 + i * 40} 440 l-14 40" stroke="#4aa3ff" stroke-width="7"/><path d="M${590 + i * 40} 520 l-14 40" stroke="#4aa3ff" stroke-width="7"/>`).join("")}
      <rect x="600" y="700" width="330" height="150" fill="#f6d8e8" stroke="#111" stroke-width="7"/><rect x="600" y="690" width="330" height="30" fill="#fff" stroke="#111" stroke-width="6"/>
      <path d="M700 690 v-60 M760 690 v-60 M820 690 v-60" stroke="#111" stroke-width="8"/>`)}
    <div class="a serif" style="left:600px;top:880px;font-size:40px">(the candles won't stay lit)</div>`,
  "10-28": `<div class="cap">jonathan swift: writes a book about tiny people, giants, a flying island and talking horses</div>
    <img class="cut" src="${pic("10-28")}" style="left:300px;top:250px;width:480px;height:520px;object-position:50% 15%">
    <div class="a say" style="left:0;top:800px">an irish bishop, 1726:</div>
    <div class="a cap" style="left:0;top:870px;padding-right:50px">"he hardly believed a word of it"</div>
    <div class="a serif" style="left:700px;top:1020px;font-size:26px;color:#555">(Swift, letter to Pope)</div>`,
  "10-29": `<div class="say">nobody:</div>
    <div class="cap" style="padding-top:20px">james boswell, 1763–1784: *follows samuel johnson around writing down everything he says*</div>
    <img class="cut" src="${pic("10-29")}" style="left:60px;top:360px;width:420px;height:560px;object-position:50% 20%">
    ${S(`<g transform="translate(760,640) rotate(8)"><rect x="-170" y="-200" width="340" height="420" fill="#fffbea" stroke="#111" stroke-width="7"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M-130 ${-150 + i * 42} q60 ${i % 2 ? -8 : 8} 260 0" fill="none" stroke="#555" stroke-width="5"/>`).join("")}</g>
      <g transform="translate(940,500) rotate(35)"><rect x="-14" y="-120" width="28" height="220" fill="#e3b33a" stroke="#111" stroke-width="5"/><path d="M-14 100 L0 140 L14 100 Z" fill="#fde2c8" stroke="#111" stroke-width="5"/></g>`)}
    <div class="a sans" style="left:520px;top:900px;font-size:44px;color:#e0161f;transform:rotate(-4deg)">the original stan account</div>`,
  "10-30": `<div class="cap" style="text-align:center;padding-top:30px">paul valéry's poetry career</div>
    <div class="line" style="left:0;right:0;top:110px;height:5px"></div><div class="line" style="left:538px;top:110px;bottom:0;width:5px"></div>
    <img class="cut" src="${pic("10-30")}" style="left:0;top:115px;width:538px;height:720px;object-position:50% 20%">
    <div class="a serif" style="left:24px;top:860px;font-size:46px;width:490px">age 21: quits poetry</div>
    ${S(`<path d="M640 260 h300 v540 q-150 40 -300 0 z" fill="#fffbea" stroke="#111" stroke-width="7"/>
      ${Array.from({ length: 12 }, (_, i) => `<path d="M680 ${300 + i * 40} h${180 + (i % 3) * 20}" stroke="#555" stroke-width="5"/>`).join("")}`)}
    <div class="a sans" style="left:700px;top:560px;font-size:60px;color:#e0161f;transform:rotate(-12deg)">512 lines</div>
    <div class="a serif" style="left:566px;top:860px;font-size:46px;width:490px">25 years later: "ok, one more poem"</div>`,
  "10-31": `<div class="cap">keats: put no name on my grave, just "here lies one whose name was writ in water"</div>
    <div class="say" style="padding-top:22px">his friends:</div>
    <img class="cut" src="${pic("10-31")}" style="left:40px;top:380px;width:300px;height:380px;object-position:50% 20%;transform:rotate(-4deg)">
    ${S(`<path d="M420 1080 V520 q0 -180 260 -180 q260 0 260 180 V1080" fill="#cfcfcf" stroke="#111" stroke-width="8"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M470 ${560 + i * 34} h${400 - (i % 2) * 40}" stroke="#666" stroke-width="5"/>`).join("")}`)}
    <div class="a sans" style="left:460px;top:880px;font-size:38px;color:#e0161f;width:460px;transform:rotate(-3deg)">*adds a whole paragraph about how mean the critics were*</div>
    <div class="a serif" style="left:40px;top:800px;font-size:36px;width:360px">(the grave still has no name on it. technically.)</div>`,
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [key, html] of Object.entries(memes)) {
  if (only.length && !only.includes(key)) continue;
  await tab.setContent(`<!doctype html><meta charset=utf-8><style>${css}</style>${wob}<div class="m">${html}</div>`);
  const raw = path.join(root, "assets/memes", key + ".png");
  await tab.locator(".m").screenshot({ path: raw });
  execFileSync("python3", [path.join(root, ".github/memes/crunch.py"), raw, raw.replace(/png$/, "jpg")]);
  fs.unlinkSync(raw);
  console.log("drew", key);
}
await browser.close();
