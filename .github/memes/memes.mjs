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
  // A portrait by its day (from the almanac's portraits) or by name (kept here).
  const own = path.join(root, ".github/memes", key + ".jpg");
  const f = fs.existsSync(own) ? own : path.join(P, fs.readdirSync(P).find((n) => n.startsWith(key + ".")));
  return `data:image/${f.endsWith("png") ? "png" : "jpeg"};base64,` + fs.readFileSync(f).toString("base64");
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
const S = (inner, h = 1080) => `<svg class="d" viewBox="0 0 1080 ${h}" style="height:${h}px">${inner}</svg>`;
// A doodled head, in our own scribbly style. o: hair (cap, beanie, swoop, bald,
// none), eyes (dots, shades, tired, wide, cry), mouth (smile, flat, grin, yell), smoke.
function head(x, y, o = {}) {
  const k = "#111", w = 'stroke="#111" stroke-width="6"';
  const hair = {
    cap: `<path d="M${x - 78} ${y - 20} q0 -90 78 -90 q78 0 78 90 z" fill="#6d7d5a" ${w}/><path d="M${x + 60} ${y - 22} h70 q10 14 -8 20 h-62" fill="#6d7d5a" ${w}/>`,
    beanie: `<path d="M${x - 80} ${y - 10} q0 -105 80 -105 q80 0 80 105 z" fill="#2b2b2b" ${w}/><rect x="${x - 84}" y="${y - 28}" width="168" height="28" fill="#2b2b2b" ${w}/>`,
    swoop: `<path d="M${x - 78} ${y - 5} q-10 -100 80 -98 q90 4 70 70 q-60 -50 -150 28z" fill="#e3c26a" ${w}/>`,
    curly: `<path d="M${x - 80} ${y} q-30 -60 0 -90 q20 -40 60 -30 q30 -30 70 0 q40 10 30 60 q20 30 -10 60 q-60 -50 -150 0z" fill="#3b2a1e" ${w}/>`,
    bald: ``, none: ``,
  }[o.hair || "none"];
  const eyes = {
    dots: `<circle cx="${x - 28}" cy="${y + 10}" r="7" fill="${k}"/><circle cx="${x + 28}" cy="${y + 10}" r="7" fill="${k}"/>`,
    shades: `<path d="M${x - 70} ${y} h140" ${w}/><rect x="${x - 66}" y="${y - 2}" width="56" height="30" rx="10" fill="${k}"/><rect x="${x + 10}" y="${y - 2}" width="56" height="30" rx="10" fill="${k}"/>`,
    tired: `<path d="M${x - 48} ${y + 8} q20 -12 40 0 M${x + 8} ${y + 8} q20 -12 40 0" fill="none" ${w}/><path d="M${x - 48} ${y + 22} q20 10 40 0 M${x + 8} ${y + 22} q20 10 40 0" fill="none" stroke="#8a6d9c" stroke-width="5"/><circle cx="${x - 28}" cy="${y + 12}" r="5"/><circle cx="${x + 28}" cy="${y + 12}" r="5"/>`,
    wide: `<circle cx="${x - 30}" cy="${y + 6}" r="22" fill="#fff" ${w}/><circle cx="${x + 30}" cy="${y + 6}" r="22" fill="#fff" ${w}/><circle cx="${x - 30}" cy="${y + 8}" r="7"/><circle cx="${x + 30}" cy="${y + 8}" r="7"/>`,
    cry: `<path d="M${x - 50} ${y} q22 16 44 0 M${x + 6} ${y} q22 16 44 0" fill="none" ${w}/><path d="M${x - 40} ${y + 12} q-8 50 6 80 M${x + 40} ${y + 12} q8 50 -6 80" fill="none" stroke="#4aa3ff" stroke-width="12"/><rect x="${x - 60}" y="${y - 14}" width="50" height="34" rx="8" fill="none" ${w}/><rect x="${x + 10}" y="${y - 14}" width="50" height="34" rx="8" fill="none" ${w}/><path d="M${x - 10} ${y} h20" ${w}/>`,
  }[o.eyes || "dots"];
  const mouth = {
    smile: `<path d="M${x - 30} ${y + 52} q30 24 60 0" fill="none" ${w}/>`,
    flat: `<path d="M${x - 24} ${y + 58} h48" ${w}/>`,
    grin: `<path d="M${x - 40} ${y + 46} q40 40 80 0 z" fill="#fff" ${w}/>`,
    yell: `<ellipse cx="${x}" cy="${y + 62}" rx="34" ry="26" fill="#5a0f0f" ${w}/>`,
    smirk: `<path d="M${x - 26} ${y + 58} q30 6 52 -14" fill="none" ${w}/>`,
  }[o.mouth || "flat"];
  const smoke = o.smoke ? `<path d="M${x + 22} ${y + 60} l50 16" stroke="#eee" stroke-width="10"/><path d="M${x + 22} ${y + 60} l50 16" fill="none" stroke="#111" stroke-width="2"/><path d="M${x + 80} ${y + 66} q10 -20 0 -40 q-10 -20 0 -40" fill="none" stroke="#999" stroke-width="4"/>` : "";
  const stubble = o.stubble ? Array.from({ length: 14 }, (_, i) => `<circle cx="${x - 40 + (i * 37) % 80}" cy="${y + 48 + (i * 13) % 30}" r="2"/>`).join("") : "";
  const body = `<path d="M${x - 95} ${y + 200} q0 -100 95 -100 q95 0 95 100 z" fill="${o.shirt || "#5b7fa6"}" ${w}/>`;
  return `${body}<ellipse cx="${x}" cy="${y + 20}" rx="80" ry="92" fill="#fbfbf7" ${w}/>${hair}${eyes}${mouth}${stubble}${smoke}`;
}
// A little "sticker": a white card with a border, like a screenshot pasted in.
const tag = (x, y, w, html, rot = 0, size = 26) =>
  `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;font:${size}px/1.2 'Liberation Sans';background:#fff;border:3px solid #111;padding:10px 12px;transform:rotate(${rot}deg);box-shadow:4px 4px 0 #bbb">${html}</div>`;
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


// Memes about books in general, not tied to a day; posted by name.
// A face cut from a portrait: the portrait scaled by zoom, centered on the
// face at (fx, fy), as fractions of its width and height (portraits are 4:5).
const faceCut = (src, x, y, w, h, zoom, fx, fy) => {
  const iw = w * zoom, ih = iw * 1.25;
  return `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;border-radius:46% 46% 42% 42%;border:5px solid #111">
    <img src="${src}" style="position:absolute;width:${iw}px;height:${ih}px;left:${w / 2 - fx * iw}px;top:${h / 2 - fy * ih}px"></div>`;
};
// The "unmasking" meme, drawn from scratch: a hand pulls the sheet off a tied-up
// ghost labeled one thing, and underneath is another.
const yellow = (x, y, w, text, size = 46) =>
  `<div class="a" style="left:${x}px;top:${y}px;width:${w}px;text-align:center;font:bold ${size}px/1.08 'Liberation Sans';color:#ffd84a;-webkit-text-stroke:1.5px #111;text-shadow:3px 3px 0 #111,-2px -2px 0 #111,2px -2px 0 #111,-2px 2px 0 #111;text-transform:uppercase">${text}</div>`;
const unmask = (mask, reveal, under) => ({ h: 1080, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:540px;background:#29406b"></div><div class="a" style="left:0;top:540px;width:1080px;height:540px;background:#29406b"></div>
    <div class="line" style="left:0;right:0;top:537px;height:7px"></div>
    ${S(`<path d="M150 530 q-30 -260 80 -360 q100 -70 190 0 q100 90 80 360 z" fill="#f2f2f2" stroke="#111" stroke-width="7"/>
      <ellipse cx="290" cy="250" rx="18" ry="12" fill="#111"/><ellipse cx="370" cy="250" rx="18" ry="12" fill="#111"/>
      <path d="M165 400 q170 30 330 0 M160 455 q175 30 340 0 M158 505 q178 25 344 0" fill="none" stroke="#5a4426" stroke-width="18"/>
      ${head(860, 210, { hair: "swoop", eyes: "dots", mouth: "smirk", shirt: "#f2f2f2" })}<path d="M820 315 l40 40 l40 -40 z" fill="#e8742a" stroke="#111" stroke-width="5"/>
      <path d="M780 360 C 700 330, 560 200, 470 175" fill="none" stroke="#111" stroke-width="44"/><path d="M780 360 C 700 330, 560 200, 470 175" fill="none" stroke="#f2f2f2" stroke-width="34"/>
      <ellipse cx="450" cy="170" rx="44" ry="30" fill="#fde2c8" stroke="#111" stroke-width="6"/>
      <path d="M150 1070 q-20 -200 70 -250 l210 0 q90 50 70 250 z" fill="#d9d9d9" stroke="#111" stroke-width="7"/>
      <path d="M160 940 q170 30 330 0 M155 995 q175 30 340 0 M152 1048 q178 25 344 0" fill="none" stroke="#5a4426" stroke-width="18"/>
      ${head(860, 750, { hair: "swoop", eyes: "dots", mouth: "smirk", shirt: "#f2f2f2" })}<path d="M820 855 l40 40 l40 -40 z" fill="#e8742a" stroke="#111" stroke-width="5"/>
      <path d="M780 900 C 730 880, 690 820, 650 760" fill="none" stroke="#111" stroke-width="44"/><path d="M780 900 C 730 880, 690 820, 650 760" fill="none" stroke="#f2f2f2" stroke-width="34"/>
      <path d="M600 640 q60 -20 100 10 q20 80 -10 160 q-50 20 -90 -10 q-30 -80 0 -160z" fill="#f2f2f2" stroke="#111" stroke-width="6"/>
      <ellipse cx="635" cy="690" rx="11" ry="7" fill="#111"/><ellipse cx="670" cy="690" rx="11" ry="7" fill="#111"/>
      <ellipse cx="655" cy="760" rx="40" ry="28" fill="#fde2c8" stroke="#111" stroke-width="6"/>`, 1080)}
    ${under}
    ${yellow(40, 300, 560, mask)}
    ${yellow(30, 870, 580, reveal, 40)}` });

Object.assign(memes, {
  "well-read-quadrant": { h: 1350, html: `
    <div class="cap" style="text-align:center;font-size:47px;letter-spacing:-1.5px;padding:30px 10px 0;white-space:nowrap">How well-read you are vs. how well-read you look</div>
    ${S(`<path d="M540 170 V1330 M30 760 H1050" stroke="#111" stroke-width="7"/><path d="M540 150 l-18 34 h36z M540 1345 l-18 -34 h36z M20 760 l34 -18 v36z M1060 760 l-34 -18 v36z" fill="#111"/>
      ${head(130, 260, { hair: "cap", eyes: "dots", mouth: "smile", shirt: "#7a5c3e" })}
      ${head(950, 260, { hair: "bald", eyes: "dots", mouth: "smirk", shirt: "#222" })}
      ${head(130, 850, { hair: "beanie", eyes: "tired", mouth: "flat", shirt: "#333", smoke: true, stubble: true })}
      ${head(950, 850, { hair: "swoop", eyes: "shades", mouth: "smirk", shirt: "#c9b28b" })}`, 1350)}
    <div class="a sans" style="left:560px;top:150px;font-size:30px">Actually Well-Read</div><div class="a sans" style="left:560px;top:1300px;font-size:30px">Actually Unread</div>
    <div class="a sans" style="left:30px;top:705px;font-size:30px">Looks Unread</div><div class="a sans" style="right:30px;top:705px;font-size:30px;white-space:nowrap">Looks Well-Read</div>
    ${tag(240, 220, 270, "<b>LIBRARY CARD</b><br>fines owed: $0.40", -3)}
    ${tag(40, 480, 230, "drugstore reading glasses, 3 pairs", 2, 24)}
    ${tag(280, 400, 230, "6 paperbacks with cracked spines, all Penguin", -1, 24)}
    ${tag(260, 560, 250, "Books read this year:<br><b style='font-size:40px;color:#2a8a3a'>61</b> ▲", 3)}
    ${tag(580, 220, 220, "reads Proust in French. for fun", 3, 24)}
    ${tag(600, 380, 260, "pencil notes in every margin", -2, 24)}
    ${tag(580, 520, 240, "owns <b>the whole Loeb Classical Library</b>", 2, 24)}
    ${tag(830, 470, 200, "has read Ulysses <b>twice</b>", -4, 24)}
    ${tag(250, 800, 260, "Screen time: <b>9h 41m</b>", 3)}
    ${tag(40, 1080, 250, "Reading challenge:<br><b style='font-size:40px;color:#c0392b'>0 / 52</b>", -2)}
    ${tag(300, 1000, 220, "“i watched the movie”", 2, 24)}
    ${tag(300, 1150, 210, "last book: assigned in 2011", -3, 24)}
    ${tag(580, 820, 210, "<b>Infinite Jest</b><br>bookmark on p. 12", -3, 24)}
    ${tag(570, 980, 230, "shelves sorted <b>by color</b>", 2, 24)}
    ${tag(830, 1080, 220, "tote bag from a literary magazine", 3, 24)}
    ${tag(580, 1140, 230, "Kindle: <b>312 unread</b>", -2, 24)}` },

  "reader-iq-curve": { h: 1350, html: `
    <div class="cap" style="text-align:center;font:bold 66px/1 'Liberation Serif';letter-spacing:-1px;padding-top:22px">THE READER IQ CURVE</div>
    <div class="line" style="left:0;right:0;top:100px;height:5px"></div><div class="line" style="left:0;right:0;top:500px;height:5px"></div><div class="line" style="left:0;right:0;top:920px;height:5px"></div><div class="line" style="left:440px;top:100px;bottom:0;width:5px"></div>
    ${S(`${head(220, 220, { hair: "bald", eyes: "dots", mouth: "grin", shirt: "#fff" })}<rect x="300" y="360" width="80" height="110" fill="#2c6fbb" stroke="#111" stroke-width="6" transform="rotate(-8 340 410)"/>
      ${head(220, 630, { hair: "beanie", eyes: "cry", mouth: "yell", shirt: "#3e6b4f" })}`, 1350)}
    <img class="cut" src="${pic("samuel-johnson")}" style="left:0;top:925px;width:440px;height:425px;object-position:50% 18%">
    <div class="a" style="left:470px;top:120px;right:20px"><div style="font:bold 54px 'Liberation Serif'">LOW IQ <span style="font:30px 'Liberation Serif'">| ~85</span></div>
      <div style="font:bold 34px/1.2 'Liberation Serif';margin:8px 0 10px">"The book was good. I liked it."</div>
      <div style="font:26px/1.35 'Liberation Serif'">• Read it on the porch.<br>• Cried at the end.<br>• Lent it to a friend.<br>• Didn't think too hard about it.</div></div>
    <div class="a" style="left:470px;top:515px;right:20px"><div style="font:bold 54px 'Liberation Serif'">MIDWIT <span style="font:30px 'Liberation Serif'">| ~115</span></div>
      <div style="font:bold 32px/1.15 'Liberation Sans';color:#a8201a;margin:6px 0 10px">"YOU CAN'T JUST <i>ENJOY</i> A BOOK."</div>
      <div style="font:24px/1.32 'Liberation Serif'">• "The author is dead, actually."<br>• "Have you read the theory first?"<br>• "The canon is a construct."<br>• "That ending is deeply problematic."<br>• "What's the subtext of the subtext?"<br>• "I only read it ironically."<br>• Hasn't finished a novel since 2019.</div></div>
    <div class="a" style="left:470px;top:935px;right:20px"><div style="font:bold 54px 'Liberation Serif'">HIGH IQ <span style="font:30px 'Liberation Serif'">| ~145</span></div>
      <div style="font:bold 34px/1.2 'Liberation Serif';margin:8px 0 10px">"The book was good. I liked it."</div>
      <div style="font:24px/1.32 'Liberation Serif'">• Samuel Johnson, 1757: "The only end of writing is to enable the readers better to enjoy life, or better to endure it."<br>• Has read everything. Still reads for pleasure.<br>• <b>The porch guy was right.</b></div></div>` },

  "unmask-literary-fiction": unmask("Literary fiction", "A professor in Connecticut having an affair",
    S(head(325, 640, { hair: "bald", eyes: "dots", mouth: "smirk", shirt: "#8a6a45" }) + `<circle cx="297" cy="650" r="24" fill="none" stroke="#111" stroke-width="5"/><circle cx="353" cy="650" r="24" fill="none" stroke="#111" stroke-width="5"/><path d="M321 650 h8" stroke="#111" stroke-width="5"/><path d="M262 700 q63 70 126 0 q-10 60 -63 70 q-53 -10 -63 -70z" fill="#8a7a6a" stroke="#111" stroke-width="5"/>`, 1080)),
  "unmask-russian-novel": unmask("The great Russian novel", "A guy in St. Petersburg who hasn't slept in four days",
    faceCut(pic("11-11"), 205, 560, 240, 290, 4.2, 0.51, 0.29)),
  "unmask-great-american-novel": unmask("The great American novel", "A guy staring at a green light across the water",
    faceCut(pic("12-21"), 205, 560, 240, 290, 2.0, 0.475, 0.37)),
});

// Halloween.
const creature = (x, y) => `<path d="M${x - 95} ${y + 200} q0 -100 95 -100 q95 0 95 100 z" fill="#3b3b3b" stroke="#111" stroke-width="6"/>
  <ellipse cx="${x}" cy="${y + 20}" rx="80" ry="92" fill="#e9dc9a" stroke="#111" stroke-width="6"/>
  <path d="M${x - 82} ${y + 30} q-10 -120 82 -118 q92 -2 82 118 q-20 -70 -82 -72 q-62 2 -82 72z" fill="#141414" stroke="#111" stroke-width="5"/>
  <path d="M${x - 50} ${y - 20} l100 10 M${x - 40} ${y - 30} v20 M${x - 10} ${y - 27} v20 M${x + 20} ${y - 24} v20" stroke="#111" stroke-width="4"/>
  <circle cx="${x - 28}" cy="${y + 20}" r="7"/><circle cx="${x + 28}" cy="${y + 20}" r="7"/><path d="M${x - 24} ${y + 66} q24 10 48 0" fill="none" stroke="#111" stroke-width="6"/>`;
const vamp = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-130 220 L-60 60 L0 110 L60 60 L130 220 z" fill="#111" stroke="#111" stroke-width="6"/>
  <path d="M-90 70 L-130 -10 L-60 40 M90 70 L130 -10 L60 40" fill="#8a1020" stroke="#111" stroke-width="6"/>
  <ellipse cx="0" cy="10" rx="70" ry="85" fill="#eef0ea" stroke="#111" stroke-width="6"/>
  <path d="M-72 -10 q0 -90 72 -88 q72 -2 72 88 q-30 -40 -72 -10 q-42 -30 -72 10z" fill="#111"/>
  <path d="M-40 0 l26 8 M40 0 l-26 8" stroke="#111" stroke-width="6"/><circle cx="-26" cy="16" r="6" fill="#8a1020"/><circle cx="26" cy="16" r="6" fill="#8a1020"/>
  <path d="M-24 50 q24 14 48 0" fill="none" stroke="#111" stroke-width="5"/><path d="M-14 54 l5 14 l5 -12 M6 56 l5 12 l5 -14" fill="#fff" stroke="#111" stroke-width="3"/></g>`;
const row = (y, icon, name, how) => `${S(icon, 1350)}<div class="a" style="left:250px;top:${y}px;width:800px"><div style="font:bold 40px 'Liberation Sans'">${name}</div>
  <div style="font:31px/1.2 'Liberation Serif';margin-top:4px">${how}</div></div>`;

Object.assign(memes, {
  "literary-costumes": { h: 1350, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:120px;background:#ef7d1a"></div>
    <div class="cap" style="position:relative;text-align:center;font-size:48px;padding-top:12px;color:#111">literary halloween costumes,<br>ranked by effort</div>
    ${S(`<path d="M60 150 V1320" stroke="#111" stroke-width="8"/><path d="M60 1335 l-22 -40 h44z" fill="#111"/>`, 1350)}
    <div class="a sans" style="left:80px;top:140px;font-size:22px;color:#777;transform:rotate(-90deg) translate(-150px,-60px);transform-origin:left top"></div>
    ${row(150, `<rect x="110" y="170" width="110" height="70" fill="#9aa" stroke="#111" stroke-width="5"/><path d="M120 240 v40 M210 240 v40" stroke="#111" stroke-width="6"/><path d="M150 150 l15 25 l15 -25" fill="#2c6fbb" stroke="#111" stroke-width="4"/>`,
      "Bartleby <span style='font-weight:normal;font-size:26px'>(Melville, 1853)</span>", "wear your work clothes. whenever anyone asks you to do anything: “I would prefer not to.”")}
    ${row(345, `<ellipse cx="165" cy="400" rx="60" ry="38" fill="#6b4a2b" stroke="#111" stroke-width="6"/><path d="M115 380 l-25 -30 M135 372 l-15 -38 M165 368 v-40 M195 372 l15 -38 M215 380 l25 -30" stroke="#111" stroke-width="5"/>`,
      "Gregor Samsa <span style='font-weight:normal;font-size:26px'>(Kafka, 1915)</span>", "lie on your back on the floor. wave your arms a little. your family will stop visiting.")}
    ${row(530, `<path d="M165 540 a32 32 0 1 1 0.1 0 M120 660 q0 -70 45 -70 q45 0 45 70" fill="none" stroke="#999" stroke-width="5" stroke-dasharray="10 9"/>`,
      "The Invisible Man <span style='font-weight:normal;font-size:26px'>(H. G. Wells, 1897)</span>", "don’t come.")}
    ${row(700, `<path d="M165 830 l-40 -90 M165 830 l0 -95 M165 830 l40 -90" stroke="#3e8e41" stroke-width="6"/><circle cx="125" cy="735" r="22" fill="#e0461f" stroke="#111" stroke-width="4"/><circle cx="165" cy="725" r="22" fill="#ffd84a" stroke="#111" stroke-width="4"/><circle cx="205" cy="735" r="22" fill="#d86fb0" stroke="#111" stroke-width="4"/>`,
      "Mrs. Dalloway <span style='font-weight:normal;font-size:26px'>(Woolf, 1925)</span>", "go buy the flowers yourself. that’s it. that’s the costume.")}
    ${row(880, `<path d="M120 1010 q45 -130 90 0 z" fill="#f4efe0" stroke="#111" stroke-width="5"/><circle cx="165" cy="905" r="34" fill="#fff" stroke="#111" stroke-width="5"/><path d="M165 905 v-22 M165 905 l14 8" stroke="#111" stroke-width="4"/>`,
      "Miss Havisham <span style='font-weight:normal;font-size:26px'>(Dickens, 1861)</span>", "your old wedding dress. one shoe. stop every clock in the house at twenty to nine. stay like that for decades.")}
    ${row(1090, `<path d="M90 1130 q55 -50 110 0 q-10 32 -50 32 q-45 0 -60 -32z" fill="#c9d6e8" stroke="#111" stroke-width="5"/><path d="M200 1130 l22 -18 v36z" fill="#c9d6e8" stroke="#111" stroke-width="5"/><path d="M150 1215 v90" stroke="#e8dcc0" stroke-width="16"/><path d="M150 1215 v90" stroke="#111" stroke-width="3" fill="none"/>`,
      "Captain Ahab <span style='font-weight:normal;font-size:26px'>(Melville, 1851)</span>", "one leg made of whalebone. yell about a whale until the party asks you to leave. do not leave.")}` },

  "frankenstein-iq-curve": { h: 1350, html: `
    <div class="cap" style="text-align:center;font:bold 60px/1 'Liberation Serif';letter-spacing:-1px;padding-top:24px">THE FRANKENSTEIN IQ CURVE</div>
    <div class="line" style="left:0;right:0;top:100px;height:5px"></div><div class="line" style="left:0;right:0;top:500px;height:5px"></div><div class="line" style="left:0;right:0;top:920px;height:5px"></div><div class="line" style="left:440px;top:100px;bottom:0;width:5px"></div>
    ${S(`${head(220, 220, { hair: "bald", eyes: "dots", mouth: "grin", shirt: "#ef7d1a" })}
      <g transform="translate(330,420)"><ellipse rx="52" ry="42" fill="#ef7d1a" stroke="#111" stroke-width="6"/><path d="M0 -42 q6 -20 18 -24" fill="none" stroke="#3e8e41" stroke-width="8"/><path d="M-22 -8 l10 -12 l10 12z M2 -8 l10 -12 l10 12z M-24 14 q24 18 48 0" fill="#111" stroke="#111" stroke-width="3"/></g>
      ${head(220, 630, { hair: "beanie", eyes: "cry", mouth: "yell", shirt: "#3e6b4f" })}
      ${creature(220, 1080)}`, 1350)}
    <div class="a" style="left:470px;top:120px;right:20px"><div style="font:bold 54px 'Liberation Serif'">LOW IQ <span style="font:30px 'Liberation Serif'">| ~85</span></div>
      <div style="font:bold 36px/1.2 'Liberation Serif';margin:8px 0 10px">"Frankenstein is the monster."</div>
      <div style="font:26px/1.35 'Liberation Serif'">• Saw the movie.<br>• Big guy, scary.<br>• Dressed up as him in third grade.</div></div>
    <div class="a" style="left:470px;top:515px;right:20px"><div style="font:bold 54px 'Liberation Serif'">MIDWIT <span style="font:30px 'Liberation Serif'">| ~115</span></div>
      <div style="font:bold 31px/1.15 'Liberation Sans';color:#a8201a;margin:6px 0 10px">"ACTUALLY, FRANKENSTEIN IS THE <i>DOCTOR</i>."</div>
      <div style="font:24px/1.32 'Liberation Serif'">• "The creature doesn't even have a name."<br>• "He reads Milton, Plutarch and Goethe."<br>• "The neck bolts aren't in the book."<br>• "Technically Victor was a student."<br>• "Have you read the 1818 text?"<br>• Says this at every Halloween party.</div></div>
    <div class="a" style="left:470px;top:935px;right:20px"><div style="font:bold 54px 'Liberation Serif'">HIGH IQ <span style="font:30px 'Liberation Serif'">| ~145</span></div>
      <div style="font:bold 36px/1.2 'Liberation Serif';margin:8px 0 10px">"Frankenstein is the monster."</div>
      <div style="font:24px/1.32 'Liberation Serif'">• Victor makes a life, then runs from it.<br>• Abandons it. Lies. Lets others hang for it.<br>• <b>The name was on the right one all along.</b></div></div>` },

  "unmask-raven": unmask("The raven's deep supernatural meaning", "A bird that knows one word",
    S(`<ellipse cx="325" cy="720" rx="110" ry="125" fill="#1b1b1b" stroke="#111" stroke-width="6"/><path d="M215 720 l-90 20 l90 18z" fill="#444" stroke="#111" stroke-width="6"/>
      <circle cx="270" cy="690" r="18" fill="#fff" stroke="#111" stroke-width="4"/><circle cx="266" cy="692" r="7"/><path d="M300 600 l20 -40 l14 42" fill="#1b1b1b" stroke="#111" stroke-width="5"/>`, 1080)
    + `<div class="a sans" style="left:40px;top:560px;font-size:30px;color:#fff;background:#111;padding:4px 10px;transform:rotate(-5deg)">"nevermore"</div>`),

  "dracula-bed": { h: 1080, html: `
    <div class="line" style="left:538px;top:0;bottom:0;width:5px"></div>
    <div class="a" style="left:24px;top:24px;width:490px;font:bold 40px/1.12 'Liberation Sans'">count dracula: undead nobleman, master of wolves, terror of the carpathians</div>
    <div class="a" style="left:566px;top:24px;width:490px;font:bold 40px/1.12 'Liberation Sans'">also count dracula:</div>
    ${S(vamp(270, 520, 1.25) + `
      <rect x="600" y="640" width="440" height="160" fill="#f4f4f4" stroke="#111" stroke-width="6"/><rect x="600" y="800" width="440" height="40" fill="#6b4a2b" stroke="#111" stroke-width="6"/><path d="M610 840 v60 M1030 840 v60" stroke="#111" stroke-width="10"/>
      <rect x="620" y="610" width="130" height="60" rx="25" fill="#fff" stroke="#111" stroke-width="6"/>` + vamp(860, 400, 0.9) + `
      <path d="M760 560 q-30 30 -70 40 M960 560 q30 30 60 60" fill="none" stroke="#111" stroke-width="8"/>`)}
    <div class="a serif" style="left:566px;top:120px;width:490px;font-size:36px;line-height:1.2">*makes the guest's bed himself, serves him dinner, drives the coach*</div>
    <div class="a serif" style="left:566px;top:930px;width:490px;font-size:28px;color:#444">(this is really in the book. no servants. he does everything himself.)</div>
    <div class="a sans" style="left:24px;top:960px;font-size:30px;color:#8a1020">Bram Stoker, 1897</div>` },
});

// Portrait cards: one of our drawn portraits (assets/portraits/) with a quote,
// or, for a writer still in copyright, a line about them in our own words.
const portrait = (name) => "data:image/jpeg;base64," + fs.readFileSync(path.join(root, "assets/portraits", name + ".jpg")).toString("base64");
const portraitCard = (name, bg, text, by, quote = true) => ({ h: 1350, clean: true, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:1350px;background:${bg}"></div>
    <div class="a" style="left:0;top:0;width:1080px;height:900px;background:url(${portrait(name)}) 50% 24% / 1080px auto no-repeat"></div>
    <div class="a" style="left:54px;right:54px;top:880px;bottom:60px;background:#fbf7ee;border:6px solid #16130f;box-shadow:12px 12px 0 #16130f;padding:44px 50px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center">
      <div style="font:${quote ? "italic " : ""}${text.length > 110 ? 44 : 58}px/1.22 'Liberation Serif';color:#16130f">${quote ? "“" + text + "”" : text}</div>
      <div style="font:bold 26px/1.3 'Liberation Sans';letter-spacing:.06em;text-transform:uppercase;margin-top:26px;color:#16130f">${by}</div>
    </div>
    <div class="a" style="right:64px;top:28px;font:bold 22px 'Liberation Sans';letter-spacing:.14em;color:#16130f">LONGHAND LITERATURE</div>` });

Object.assign(memes, {
  "portrait-melville": portraitCard("melville", "#45b3c4", "It is not down in any map; true places never are.", "Herman Melville · Moby-Dick, 1851"),
  "portrait-sontag": portraitCard("sontag", "#f2c230", "Susan Sontag kept a journal from the age of fourteen and read like it was oxygen. Her first book of essays, Against Interpretation, came out in 1966. She was 33.", "Susan Sontag · 1933–2004", false),
  "portrait-rimbaud": portraitCard("rimbaud", "#e4572e", "For I is someone else.", "Arthur Rimbaud · letter, May 1871 · translated for Longhand"),
  "portrait-sartre": portraitCard("sartre", "#ef8fa8", "In 1964 Jean-Paul Sartre was awarded the Nobel Prize in Literature, and turned it down. A writer, he said, shouldn't let himself be turned into an institution.", "Jean-Paul Sartre · 1905–1980", false),
});

// New formats, drawn from scratch: a character sheet, a forum post, a starter
// pack, an alignment chart, a tier list, a year-in-review card.
const bar = (v) => `<span style="display:inline-block;width:240px;height:22px;border:3px solid #111;vertical-align:middle;background:linear-gradient(90deg,${v > 70 ? "#3e8e41" : v > 30 ? "#e3b33a" : "#c0392b"} ${v}%,#fff ${v}%)"></span>`;
const stat = (name, v, note) => `<div style="display:flex;align-items:center;gap:18px;margin:22px 0"><div style="width:300px;font:bold 30px 'Liberation Sans'">${name}</div>${bar(v)}<div style="font:26px/1.1 'Liberation Serif';width:390px">${note}</div></div>`;
const comment = (user, pts, text, indent = 0) => `<div style="margin:0 0 22px ${indent}px;border-left:4px solid #ccc;padding-left:18px"><div style="font:bold 24px 'Liberation Sans';color:#555">u/${user} · ${pts} points</div><div style="font:36px/1.25 'Liberation Sans';margin-top:6px">${text}</div></div>`;
const skull = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-90 0 q0 -110 90 -110 q90 0 90 110 q0 40 -30 60 v40 h-120 v-40 q-30 -20 -30 -60z" fill="#f4f0e2" stroke="#111" stroke-width="7"/>
  <ellipse cx="-38" cy="5" rx="26" ry="30"/><ellipse cx="38" cy="5" rx="26" ry="30"/><path d="M0 40 l-12 26 h24z"/><path d="M-50 100 v-20 M-25 100 v-24 M0 100 v-24 M25 100 v-24 M50 100 v-20" stroke="#111" stroke-width="5"/></g>`;
const trumpet = (x, y) => `<g transform="translate(${x},${y}) rotate(-12)"><rect x="0" y="-12" width="200" height="24" fill="#e3b33a" stroke="#111" stroke-width="5"/><path d="M200 -12 l90 -50 v124 l-90 -50z" fill="#e3b33a" stroke="#111" stroke-width="5"/><rect x="60" y="-30" width="14" height="22" fill="#e3b33a" stroke="#111" stroke-width="4"/><rect x="90" y="-30" width="14" height="22" fill="#e3b33a" stroke="#111" stroke-width="4"/></g>`;
const bug = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="0" rx="200" ry="95" fill="#6b4a2b" stroke="#111" stroke-width="7"/>
  ${[-130, -65, 0, 65, 130].map((dx) => `<path d="M${dx} -60 q0 30 0 120" stroke="#111" stroke-width="5" fill="none"/>`).join("")}
  ${[-120, -40, 40, 120].map((dx, i) => `<path d="M${dx} -85 q${i % 2 ? 20 : -20} -60 ${i % 2 ? 50 : -50} -80" stroke="#111" stroke-width="7" fill="none"/>`).join("")}
  <circle cx="-215" cy="-10" r="45" fill="#6b4a2b" stroke="#111" stroke-width="7"/><circle cx="-230" cy="-22" r="8" fill="#fff"/><path d="M-250 -45 q-40 -60 -80 -50 M-235 -50 q-10 -70 -60 -90" stroke="#111" stroke-width="5" fill="none"/></g>`;

Object.assign(memes, {
  "holmes-stats": { h: 1350, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:1350px;background:#1d2340"></div>
    <div class="a" style="left:40px;top:40px;right:40px;bottom:40px;background:#f6f1df;border:6px solid #111;box-shadow:10px 10px 0 #000"></div>
    <div class="a sans" style="left:80px;top:70px;font-size:28px;letter-spacing:.1em;color:#8a1020">CHARACTER SELECT</div>
    <div class="a sans" style="left:80px;top:110px;font-size:62px">SHERLOCK HOLMES</div>
    <div class="a serif" style="left:80px;top:190px;font-size:30px;color:#444">class: consulting detective · lvl 99 · 221B</div>
    <div class="a" style="left:760px;top:70px;width:240px;height:300px;border:5px solid #111;background:#c8d6e5;overflow:hidden">${`<svg viewBox="0 0 240 300" width="240" height="300" style="filter:url(#w)">${head(120, 130, { eyes: "dots", mouth: "flat", shirt: "#6b5a45" })}
      <path d="M40 110 q80 -110 160 0 z" fill="#a08a64" stroke="#111" stroke-width="6"/><path d="M40 110 l-30 18 M200 110 l30 18" stroke="#111" stroke-width="8"/><path d="M120 30 v-14" stroke="#111" stroke-width="6"/>
      <path d="M140 190 q30 10 40 30 h22 v-24" fill="none" stroke="#111" stroke-width="7"/></svg>`}</div>
    <div class="a" style="left:80px;top:400px">
      ${stat("chemistry", 100, "profound")}
      ${stat("sensational lit.", 100, "knows every horror of the century")}
      ${stat("boxing, swords", 92, "expert")}
      ${stat("violin", 85, "plays well")}
      ${stat("british law", 70, "good, practical")}
      ${stat("botany", 45, "poisons yes, gardening no")}
      ${stat("politics", 12, "feeble")}
      ${stat("literature", 0, "nil")}
      ${stat("philosophy", 0, "nil")}
      ${stat("astronomy", 0, "nil. learns the earth goes round the sun:")}
    </div>
    ${tag(180, 1110, 720, `<span style="font:italic 36px/1.25 'Liberation Serif'">"Now that I do know it I shall do my best to forget it."</span><div style="font:bold 22px 'Liberation Sans';margin-top:8px">— A Study in Scarlet, 1887. Watson really made this list.</div>`, -1.5)}` },

  "ahab-aita": { h: 1350, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:1350px;background:#dae0e6"></div>
    <div class="a" style="left:40px;top:40px;right:40px;background:#fff;border:2px solid #ccc;border-radius:8px;padding:34px 40px">
      <div style="font:bold 24px 'Liberation Sans';color:#555">r/AITA · posted by u/OneLegCaptain · 1851</div>
      <div style="font:bold 52px/1.15 'Liberation Sans';margin:14px 0">AITA for nailing a gold coin to the mast and making my whole crew chase the one whale that took my leg?</div>
      <div style="font:36px/1.35 'Liberation Sans';color:#222">The crew signed on to hunt whales for oil and money. I've decided we're hunting one whale, specifically, forever. My first mate keeps calling it "madness." For the record: I'd strike the sun if it insulted me.</div>
      <div style="font:bold 24px 'Liberation Sans';color:#878a8c;margin-top:16px">⬆ 1.8k · 💬 135 chapters · share</div>
    </div>
    <div class="a" style="left:40px;top:690px;right:40px;background:#fff;border:2px solid #ccc;border-radius:8px;padding:30px 40px 8px">
      ${comment("Starbuck_FirstMate", "4.2k", "YTA. To be enraged with a dumb thing seems blasphemous.")}
      ${comment("Ishmael", "2.9k", "Call me Ishmael. Not voting, I'm just here to explain the whale's head for 40 pages", 0)}
      ${comment("OneLegCaptain", "-312", "thanks everyone. we sail at dawn", 40)}
      ${comment("WhiteWhale", "9.9k", "ESH", 0)}
    </div>` },

  "samsa-mondays": `
    <div class="a" style="left:0;top:0;width:1080px;height:1080px;background:#e9e3d1"></div>
    ${S(`<rect x="90" y="560" width="900" height="200" fill="#f8f8f8" stroke="#111" stroke-width="7"/><rect x="90" y="760" width="900" height="50" fill="#6b4a2b" stroke="#111" stroke-width="7"/>
      <path d="M100 810 v110 M980 810 v110" stroke="#111" stroke-width="14"/><rect x="60" y="430" width="50" height="380" fill="#6b4a2b" stroke="#111" stroke-width="7"/>
      <rect x="120" y="500" width="200" height="90" rx="40" fill="#fff" stroke="#111" stroke-width="6"/>
      <path d="M300 600 q300 -60 680 0 v140 h-680z" fill="#9bb7d4" stroke="#111" stroke-width="6"/>` + bug(600, 520, .9) + `
      <g transform="translate(900,250)"><circle r="80" fill="#fff" stroke="#111" stroke-width="7"/><path d="M0 0 v-55 M0 0 v58" stroke="#111" stroke-width="8"/><path d="M-60 -80 l-30 -30 M60 -80 l30 -30" stroke="#111" stroke-width="10"/><path d="M-110 -30 l-30 -10 M110 -30 l30 -10 M-100 20 l-30 10" stroke="#e0161f" stroke-width="7"/></g>`)}
    <div class="a sans" style="left:40px;top:40px;font-size:96px;color:#8a1020;transform:rotate(-3deg)">#GrrMondays</div>
    <div class="a serif" style="left:50px;top:180px;width:620px;font-size:38px;line-height:1.2">gregor samsa: wakes up as a giant bug<br>also gregor samsa: <b>"oh no, I've missed the 5 o'clock train to work"</b></div>
    <div class="a sans" style="left:830px;top:345px;font-size:30px">6:30</div>
    <div class="a serif" style="left:40px;top:990px;font-size:28px;color:#444">Franz Kafka, The Metamorphosis, 1915. (he really does worry about work first.)</div>`,

  "carraway-deceive": `
    <div class="cap" style="padding-top:34px">nick carraway, narrator of the great gatsby, chapter 3:</div>
    ${tag(70, 200, 940, `<span style="font:italic 46px/1.25 'Liberation Serif'">"I am one of the few honest people that I have ever known."</span>`, -1, 26)}
    ${S(head(300, 560, { hair: "swoop", eyes: "shades", mouth: "smirk", shirt: "#e8e1c8" }) + `<path d="M420 760 l80 -110 h40 l-60 120" fill="#cfe8f2" stroke="#111" stroke-width="6"/><path d="M500 650 q20 -20 40 0" fill="none" stroke="#111" stroke-width="5"/><circle cx="520" cy="680" r="9" fill="#5a8a2f"/>
      <path d="M180 470 l-40 -30 M420 470 l40 -30" stroke="#111" stroke-width="7"/>`)}
    <div class="a" style="left:560px;top:430px;width:470px;font:bold 52px/1.1 'Liberation Sans'">why would I deceive you?</div>
    <div class="a serif" style="left:560px;top:600px;width:470px;font-size:34px;line-height:1.25">*never tells the police who was driving the car*<br>*helps his cousin cheat on her husband*<br>*"old sport" x 40*</div>
    <div class="a serif" style="left:40px;top:990px;font-size:28px;color:#444">F. Scott Fitzgerald, 1925. every unreliable narrator starts with this exact sentence.</div>`,

  "yorick-doot": `
    <div class="line" style="left:538px;top:0;bottom:0;width:5px"></div>
    <div class="a" style="left:24px;top:24px;width:490px;font:bold 40px/1.15 'Liberation Sans'">hamlet: "alas, poor yorick! i knew him, horatio: a fellow of infinite jest"</div>
    <div class="a" style="left:566px;top:24px;width:490px;font:bold 40px/1.15 'Liberation Sans'">yorick:</div>
    ${S(head(270, 520, { hair: "curly", eyes: "tired", mouth: "flat", shirt: "#222" }) + `<path d="M330 760 q60 -40 110 -110" fill="none" stroke="#111" stroke-width="10"/>` + skull(450, 620, .55)
      + skull(760, 560, 1.4) + trumpet(830, 700))}
    <div class="a sans" style="left:640px;top:250px;font-size:96px;color:#e0461f;transform:rotate(-8deg)">doot</div>
    <div class="a sans" style="left:800px;top:360px;font-size:96px;color:#e0461f;transform:rotate(6deg)">doot</div>
    <div class="a serif" style="left:566px;top:990px;font-size:30px;color:#444">Shakespeare, Hamlet, act 5</div>`,

  "russian-starter-pack": `
    <div class="cap" style="padding-top:30px">"reading a russian novel" starter pack</div>
    <div class="line" style="left:0;right:0;top:110px;height:5px"></div>
    ${S(`<rect x="70" y="170" width="140" height="300" fill="#fffbea" stroke="#111" stroke-width="6" transform="rotate(-6 140 320)"/>
      <path d="M95 220 h90 M95 260 h70 M95 300 h85 M95 340 h60 M95 380 h80" stroke="#666" stroke-width="5" transform="rotate(-6 140 320)"/>
      <g transform="translate(560,330)"><path d="M-70 -120 h140 l20 160 h-180z" fill="#c9a227" stroke="#111" stroke-width="6"/><circle cy="-140" r="28" fill="#c9a227" stroke="#111" stroke-width="6"/><path d="M90 -40 h60 v30" fill="none" stroke="#111" stroke-width="8"/><rect x="-90" y="40" width="180" height="30" fill="#c9a227" stroke="#111" stroke-width="6"/></g>
      <g transform="translate(870,320)"><path d="M-110 30 l140 -60 l10 18 l-140 60z" fill="#555" stroke="#111" stroke-width="5"/><path d="M110 30 l-140 -60 l-10 18 l140 60z" fill="#555" stroke="#111" stroke-width="5"/><circle cx="0" cy="-90" r="40" fill="#ffd36b" stroke="#111" stroke-width="5"/></g>
      <g transform="translate(200,720)">${Array.from({ length: 12 }, (_, i) => `<path d="M${(i * 53) % 260 - 130} ${(i * 37) % 160 - 80} l0 22 M${(i * 53) % 260 - 141} ${(i * 37) % 160 - 69} l22 0" stroke="#7aa6d6" stroke-width="5"/>`).join("")}</g>
      <g transform="translate(560,720)"><rect x="-140" y="-80" width="280" height="200" fill="#2c6fbb" stroke="#111" stroke-width="6"/><rect x="-120" y="-60" width="240" height="160" fill="none" stroke="#e3b33a" stroke-width="4"/></g>
      <g transform="translate(880,720)"><rect x="-90" y="-60" width="180" height="110" fill="#8a1020" stroke="#111" stroke-width="6"/><path d="M-70 50 v30 M70 50 v30" stroke="#111" stroke-width="8"/><circle cx="-60" cy="90" r="22" fill="#333"/><circle cx="60" cy="90" r="22" fill="#333"/><path d="M-90 -60 h180" stroke="#111" stroke-width="10"/><path d="M90 -20 q40 -60 80 -40" fill="none" stroke="#999" stroke-width="10"/></g>`)}
    <div class="a serif" style="left:40px;top:500px;width:260px;font-size:28px;line-height:1.15">the list of names you wrote on your bookmark</div>
    <div class="a serif" style="left:410px;top:500px;width:300px;font-size:28px;line-height:1.15">a samovar (somebody is always making tea)</div>
    <div class="a serif" style="left:760px;top:440px;width:280px;font-size:28px;line-height:1.15">a duel at dawn over something said at a party</div>
    <div class="a serif" style="left:60px;top:830px;width:300px;font-size:28px;line-height:1.15">snow. so much snow.</div>
    <div class="a serif" style="left:410px;top:870px;width:300px;font-size:28px;line-height:1.15">900 pages, 40 of them an argument about God</div>
    <div class="a serif" style="left:770px;top:870px;width:280px;font-size:28px;line-height:1.15">a train (be careful around the train)</div>
    <div class="a sans" style="left:40px;top:985px;font-size:34px;color:#8a1020">Rodion Romanovich Raskolnikov, also called Rodya, also Rodka, also Rodenka</div>`,

  "alignment-chart": { h: 1350, html: `
    <div class="cap" style="text-align:center;padding-top:30px">the classic literature alignment chart</div>
    <div class="a" style="left:40px;top:130px;width:1000px;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:378px;border:5px solid #111">
      ${[["lawful good", "Jane Eyre", "leaves the man she loves because it's the right thing to do", "#dff0d8"],
        ["neutral good", "Ishmael", "just here to tell you about whales", "#e7f1d0"],
        ["chaotic good", "Huck Finn", "\"All right, then, I'll go to hell.\"", "#f0f2c8"],
        ["lawful neutral", "Javert", "chases one man for decades. it started with a loaf of bread", "#e6e6e6"],
        ["true neutral", "Bartleby", "would prefer not to", "#f2f2f2"],
        ["chaotic neutral", "Puck", "gives a man a donkey's head, for fun", "#efe6f5"],
        ["lawful evil", "Uriah Heep", "so very 'umble. robs his boss blind", "#f6dcdc"],
        ["neutral evil", "Iago", "ruins everyone's life. gives no real reason", "#f3d0d0"],
        ["chaotic evil", "Heathcliff", "has his dead love's coffin opened, years later, to look", "#eebcbc"]]
        .map(([al, who, why, bg]) => `<div style="border:3px solid #111;background:${bg};padding:22px;display:flex;flex-direction:column">
          <div style="font:bold 24px 'Liberation Sans';text-transform:uppercase;letter-spacing:.06em;color:#555">${al}</div>
          <div style="font:bold 52px/1.05 'Liberation Serif';margin-top:auto">${who}</div>
          <div style="font:28px/1.2 'Liberation Serif';margin-top:12px;color:#222">${why}</div></div>`).join("")}
    </div>
    <div class="a serif" style="left:40px;top:1300px;font-size:26px;color:#555">fight us in the comments</div>` },

  "dinner-tier-list": { h: 1350, html: `
    <div class="cap" style="padding-top:30px">literary dinner guests, tier list</div>
    <div class="a" style="left:30px;top:120px;width:1020px">
      ${[["S", "#ff7f7f", "Mr. Fezziwig", "throws the best christmas party in London. dances all night. pays for everything."],
        ["A", "#ffbf7f", "Mr. Darcy", "won't dance, insults you on arrival. secretly pays for your sister's wedding."],
        ["B", "#ffdf7f", "The Mad Hatter", "it's always six o'clock, so it's always tea time. no clean cups."],
        ["C", "#ffff7f", "Mr. Collins", "will talk about his patroness, Lady Catherine de Bourgh, for three hours."],
        ["D", "#bfff7f", "Miss Havisham", "the cake has been on the table for decades. she's still in the dress."],
        ["F", "#7fbfff", "Count Dracula", "\"I have dined already, and I do not sup.\" watches you eat. alone."],
        ["F−", "#bf7fbf", "Macbeth", "sees a ghost in his own chair. his last guest of honor, the king, did not survive the night."]]
        .map(([t, c, who, why]) => `<div style="display:flex;border:3px solid #111;margin-bottom:-3px;min-height:150px">
          <div style="width:150px;background:${c};display:flex;align-items:center;justify-content:center;font:bold 72px 'Liberation Sans';border-right:3px solid #111">${t}</div>
          <div style="flex:1;padding:16px 24px;background:#1f1f1f;color:#fff"><div style="font:bold 40px 'Liberation Sans'">${who}</div><div style="font:30px/1.2 'Liberation Serif';margin-top:6px;color:#ddd">${why}</div></div></div>`).join("")}
    </div>` },

  "reading-unwrapped": { h: 1350, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:1350px;background:linear-gradient(160deg,#ff5f6d,#7b2ff7 55%,#1e1e7a)"></div>
    <div class="a sans" style="left:70px;top:70px;font-size:34px;color:#fff;letter-spacing:.08em">YOUR 2026 READING, UNWRAPPED</div>
    <div class="a sans" style="left:70px;top:130px;width:940px;font-size:84px;line-height:1;color:#fff">you had a big year (buying books)</div>
    <div class="a" style="left:70px;top:380px;width:940px;color:#fff">
      ${[["books bought", "46"], ["books finished", "7"], ["top genre", "\"i'll get to it\""], ["minutes in bookstores", "9,871"], ["minutes reading", "412"], ["most rewatched adaptation", "Pride & Prejudice (2005), 11x"], ["book on the nightstand since March", "still there"]]
        .map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid rgba(255,255,255,.5);padding:20px 0"><span style="font:34px 'Liberation Sans'">${k}</span><span style="font:bold 46px 'Liberation Sans'">${v}</span></div>`).join("")}
    </div>
    <div class="a sans" style="left:70px;top:1230px;font-size:30px;color:#fff">you're in the top 1% of people who own two copies of the same book</div>` },
});

// "And yet a trace of the true self exists in the false self": three rows,
// each turning into the next, and the last one is the first one again.
const arrow = (y) => `<path d="M440 ${y} h180" stroke="#111" stroke-width="10"/><path d="M600 ${y - 26} l40 26 l-40 26z" fill="#111"/>`;
const trace = (top, rows, bottom) => ({ h: 1350, html: `
    <div class="a sans" style="left:0;right:0;top:12px;text-align:center;font-size:44px">${top}</div>
    <div class="line" style="left:0;right:0;top:450px;height:5px"></div><div class="line" style="left:0;right:0;top:900px;height:5px"></div>
    ${S(rows.map(([a, b], i) => `<g transform="translate(0,${i * 450 + (i === 1 ? 0 : 52)}) scale(${i === 1 ? 1 : .9})">${a}${arrow(240)}${b}</g>`).join(""), 1350)}
    <div class="a sans" style="left:30px;top:916px;font-size:44px">${bottom}</div>` });
const book = (x, y, w, h, c, t, ts = 30) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#111" stroke-width="7"/><rect x="${x + 14}" y="${y}" width="10" height="${h}" fill="rgba(0,0,0,.25)"/><text x="${x + w / 2 + 6}" y="${y + h / 2 + 10}" text-anchor="middle" font-family="Liberation Serif" font-weight="bold" font-size="${ts}" fill="#f4e7b8">${t}</text>`;
const bard = `<g transform="translate(220,170)"><path d="M-90 230 q0 -120 90 -120 q90 0 90 120z" fill="#e8e1c8" stroke="#111" stroke-width="6"/><ellipse cx="0" cy="40" rx="62" ry="72" fill="#fbfbf7" stroke="#111" stroke-width="6"/>
  <path d="M-40 25 h28 M12 25 h28" stroke="#111" stroke-width="6"/><path d="M-50 70 q50 90 100 0 q-10 60 -50 70 q-40 -10 -50 -70z" fill="#ddd" stroke="#111" stroke-width="5"/><ellipse cx="0" cy="88" rx="18" ry="12" fill="#5a0f0f"/>
  <path d="M90 130 q40 -40 10 -110 M110 130 q50 -50 20 -110 M88 20 h42" fill="none" stroke="#c9a227" stroke-width="8"/>
  <text x="120" y="-30" font-size="56">🎶</text></g><text x="40" y="410" font-family="Liberation Serif" font-size="32">a poet sings it to a crowd</text>`;
const scroll = (x, y) => `<g transform="translate(${x},${y})"><rect x="0" y="0" width="230" height="260" fill="#f3e3b5" stroke="#111" stroke-width="6"/><rect x="-20" y="-20" width="270" height="34" rx="16" fill="#c9a227" stroke="#111" stroke-width="6"/><rect x="-20" y="246" width="270" height="34" rx="16" fill="#c9a227" stroke="#111" stroke-width="6"/>
  ${[40, 80, 120, 160, 200].map((yy) => `<path d="M30 ${yy} h170" stroke="#7a6a4a" stroke-width="5"/>`).join("")}</g>`;
const phone = `<g transform="translate(790,40)"><rect x="0" y="0" width="200" height="360" rx="28" fill="#222" stroke="#111" stroke-width="6"/><rect x="14" y="30" width="172" height="300" rx="8" fill="#f2f2f2"/>
  <rect x="44" y="60" width="112" height="112" fill="#7a3b12" stroke="#111" stroke-width="4"/><text x="100" y="128" text-anchor="middle" font-family="Liberation Serif" font-weight="bold" font-size="24" fill="#f4e7b8">ILIAD</text>
  <text x="100" y="210" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="20">audiobook</text><text x="100" y="240" text-anchor="middle" font-family="Liberation Sans" font-size="20">15 hr 4 min</text>
  <path d="M50 280 l0 20 M70 270 l0 40 M90 262 l0 56 M110 274 l0 32 M130 266 l0 48 M150 280 l0 20" stroke="#2c6fbb" stroke-width="7"/></g>
  <path d="M760 120 q-40 -50 -10 -90 M1020 120 q40 -50 10 -90" fill="none" stroke="#111" stroke-width="7"/><circle cx="752" cy="128" r="16"/><circle cx="1028" cy="128" r="16"/>`;
const mag = (x, y) => `<g transform="translate(${x},${y})"><rect x="0" y="0" width="240" height="320" fill="#e6dcc2" stroke="#111" stroke-width="6"/><text x="120" y="50" text-anchor="middle" font-family="Liberation Serif" font-weight="bold" font-size="30">PART 14</text>
  ${[90, 120, 150, 180, 210].map((yy) => `<path d="M24 ${yy} h192" stroke="#777" stroke-width="5"/>`).join("")}<text x="120" y="270" text-anchor="middle" font-family="Liberation Serif" font-style="italic" font-size="26">to be continued...</text><text x="120" y="300" text-anchor="middle" font-family="Liberation Sans" font-size="20">one shilling</text></g>`;
const syllabus = `<g transform="translate(760,60)"><rect x="0" y="0" width="250" height="330" fill="#fff" stroke="#111" stroke-width="6" transform="rotate(4 125 165)"/><g transform="rotate(4 125 165)"><text x="125" y="50" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="28">SYLLABUS</text>
  <text x="24" y="110" font-family="Liberation Serif" font-size="24">wk 1-6: Bleak House</text><text x="24" y="150" font-family="Liberation Serif" font-size="24">(all of it)</text><text x="24" y="200" font-family="Liberation Serif" font-size="24">essay due friday</text><text x="24" y="250" font-family="Liberation Serif" font-size="24" fill="#c0392b">required reading</text></g></g>`;
const tv = `<g transform="translate(740,50)"><rect x="0" y="0" width="290" height="210" rx="16" fill="#222" stroke="#111" stroke-width="6"/><rect x="16" y="16" width="258" height="178" fill="#1f2b44"/><text x="145" y="80" text-anchor="middle" font-family="Liberation Sans" font-weight="bold" font-size="26" fill="#fff">EPISODE 4</text>
  <text x="145" y="120" text-anchor="middle" font-family="Liberation Sans" font-size="22" fill="#ffd36b">new episode friday</text><text x="145" y="165" text-anchor="middle" font-family="Liberation Serif" font-style="italic" font-size="24" fill="#fff">to be continued...</text>
  <path d="M100 210 l-30 60 M190 210 l30 60" stroke="#111" stroke-width="8"/></g>`;

Object.assign(memes, {
  "trace-homer": trace("And yet a trace of the true self", [
    [bard, scroll(760, 90)],
    [scroll(110, 90), book(760, 50, 240, 340, "#7a3b12", "THE ILIAD", 30) + `<text x="880" y="430" text-anchor="middle" font-family="Liberation Serif" font-size="30">700 pages, read in silence</text>`],
    [book(110, 80, 240, 330, "#7a3b12", "THE ILIAD", 30), phone],
  ], "Exists in the False Self"),
  "trace-dickens": trace("And yet a trace of the true self", [
    [mag(110, 50) + `<text x="40" y="410" font-family="Liberation Serif" font-size="32">dickens, sold in monthly parts</text>`, book(760, 60, 260, 330, "#2e4a3a", "COMPLETE WORKS", 24) + `<text x="890" y="430" text-anchor="middle" font-family="Liberation Serif" font-size="32">a leather-bound classic</text>`],
    [book(110, 60, 260, 330, "#2e4a3a", "COMPLETE WORKS", 24), syllabus],
    [syllabus.replace("translate(760,60)", "translate(100,60)"), tv],
  ], "Exists in the False Self"),
});

// Halloween, 2026: a house listing and a candy tier list.
const tierRow = ([t, c, who, why]) => `<div style="display:flex;border:3px solid #111;margin-bottom:-3px;min-height:140px">
  <div style="width:150px;background:${c};display:flex;align-items:center;justify-content:center;font:bold 68px 'Liberation Sans';border-right:3px solid #111">${t}</div>
  <div style="flex:1;padding:14px 22px;background:#1f1f1f;color:#fff"><div style="font:bold 38px 'Liberation Sans'">${who}</div><div style="font:29px/1.2 'Liberation Serif';margin-top:6px;color:#ddd">${why}</div></div></div>`;
const usher = `<g transform="translate(540,470)">
  <path d="M-380 260 h760 v40 h-760z" fill="#3b4a3a"/>
  <rect x="-300" y="-60" width="600" height="320" fill="#6b6460" stroke="#111" stroke-width="7"/>
  <path d="M-330 -60 L0 -230 L330 -60 Z" fill="#3a3533" stroke="#111" stroke-width="7"/>
  <rect x="-250" y="-200" width="50" height="110" fill="#3a3533" stroke="#111" stroke-width="6"/><rect x="200" y="-190" width="50" height="100" fill="#3a3533" stroke="#111" stroke-width="6"/>
  ${[-220, -110, 70, 180].map((x) => `<rect x="${x}" y="0" width="60" height="80" fill="#1b1b1b" stroke="#111" stroke-width="5"/><circle cx="${x + 30}" cy="40" r="10" fill="#6d6"/>`).join("")}
  ${[-220, 180].map((x) => `<rect x="${x}" y="130" width="60" height="80" fill="#1b1b1b" stroke="#111" stroke-width="5"/>`).join("")}
  <rect x="-45" y="120" width="90" height="140" fill="#2a1d14" stroke="#111" stroke-width="6"/>
  <path d="M-20 -150 l14 40 l-20 30 l24 40 l-16 40 l20 50 l-12 50 l18 60 l-10 60 l14 40" fill="none" stroke="#111" stroke-width="5"/>
  <path d="M-420 300 q200 -30 420 0 t420 0 v70 h-840z" fill="#1d2a2a"/>
  <path d="M-20 300 l-8 40 l12 30" fill="none" stroke="#111" stroke-width="4"/>
  <path d="M-360 -260 q30 -20 60 0 M300 -280 q30 -20 60 0 M220 -320 q20 -14 40 0" fill="none" stroke="#111" stroke-width="5"/>
</g>`;

Object.assign(memes, {
  "usher-listing": { h: 1350, html: `
    <div class="a" style="left:0;top:0;width:1080px;height:1350px;background:#f4f4f4"></div>
    <div class="a" style="left:0;top:0;width:1080px;height:90px;background:#1277e1"></div>
    <div class="a sans" style="left:34px;top:22px;font-size:40px;color:#fff">home·finder</div>
    <div class="a" style="left:40px;top:120px;width:1000px;height:560px;background:#8f9aa3;border:3px solid #111;overflow:hidden">${`<svg viewBox="0 0 1080 700" width="1000" height="560" style="filter:url(#w)"><rect width="1080" height="700" fill="#8a929b"/>${usher}</svg>`}</div>
    <div class="a sans" style="left:60px;top:150px;font-size:26px;color:#fff;background:#d23;padding:6px 12px">NEW LISTING · MOTIVATED SELLER</div>
    <div class="a" style="left:40px;top:700px;width:1000px">
      <div style="font:bold 60px 'Liberation Sans'">$0 <span style="font:32px 'Liberation Sans';color:#555">(family must go)</span></div>
      <div style="font:bold 32px 'Liberation Sans';margin-top:6px">3 bd · 1 crypt · 1 tarn · 1 crack</div>
      <div style="font:28px 'Liberation Sans';color:#555;margin-top:4px">The House of Usher, somewhere dreary · Est. many centuries</div>
      <div style="font:35px/1.35 'Liberation Serif';margin-top:20px">Ancestral home with original features: <i>vacant eye-like windows</i>, a <i>black and lurid tarn</i>, and a <i>barely perceptible fissure</i> running zigzag from the roof down into the water. Owner (hypersensitive, plays guitar) seeks quiet buyer. Sister in the vault. Probably.</div>
      <div style="font:bold 28px 'Liberation Sans';color:#d23;margin-top:18px">⚠ Listing status: sank into the tarn, 1839</div>
    </div>
    <div class="a serif" style="left:40px;top:1290px;font-size:26px;color:#666">Edgar Allan Poe, "The Fall of the House of Usher," 1839</div>` },

  "gothic-candy": { h: 1350, html: `
    <div class="cap" style="padding-top:28px">gothic classics as halloween candy</div>
    <div class="a" style="left:30px;top:112px;width:1020px">
      ${[["S", "#ff7f7f", "Dracula (1897)", "the full-size candy bar. everyone remembers which house."],
        ["A", "#ffbf7f", "Frankenstein (1818)", "the homemade popcorn ball. assembled from parts. your parents warned you. it's great."],
        ["A", "#ffbf7f", "Sleepy Hollow (1820)", "the plastic pumpkin pail. comes with a head."],
        ["B", "#ffdf7f", "Jekyll and Hyde (1886)", "the two-flavor lollipop. one side is fine."],
        ["C", "#ffff7f", "\"The Raven\" (1845)", "candy corn. says the same thing over and over. people have opinions."],
        ["D", "#bfff7f", "The Turn of the Screw (1898)", "the unwrapped mystery candy. was it ever real? you'll argue forever."],
        ["F", "#7fbfff", "The Castle of Otranto (1764)", "raisins. technically first. no one is excited."]].map(tierRow).join("")}
    </div>
    <div class="a serif" style="left:34px;top:1268px;font-size:36px">what did you get in your pillowcase?</div>` },
});

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [key, made] of Object.entries(memes)) {
  if (only.length && !only.includes(key)) continue;
  // A meme is its html, or { h, html } for one taller than square.
  // Portrait cards are kept crisp ("clean"); memes get crunched.
  const { h = 1080, html, clean } = typeof made === "string" ? { html: made } : made;
  await tab.setViewportSize({ width: 1080, height: h });
  await tab.setContent(`<!doctype html><meta charset=utf-8><style>${css}</style>${wob}<div class="m" style="height:${h}px">${html}</div>`);
  const raw = path.join(root, "assets/memes", key + ".png");
  await tab.locator(".m").screenshot({ path: raw });
  if (clean) await tab.locator(".m").screenshot({ path: raw.replace(/png$/, "jpg"), type: "jpeg", quality: 92 });
  else execFileSync("python3", [path.join(root, ".github/memes/crunch.py"), raw, raw.replace(/png$/, "jpg")]);
  fs.unlinkSync(raw);
  console.log("drew", key);
}
await browser.close();
