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

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [key, made] of Object.entries(memes)) {
  if (only.length && !only.includes(key)) continue;
  // A meme is its html, or { h, html } for one taller than square.
  const { h = 1080, html } = typeof made === "string" ? { html: made } : made;
  await tab.setViewportSize({ width: 1080, height: h });
  await tab.setContent(`<!doctype html><meta charset=utf-8><style>${css}</style>${wob}<div class="m" style="height:${h}px">${html}</div>`);
  const raw = path.join(root, "assets/memes", key + ".png");
  await tab.locator(".m").screenshot({ path: raw });
  execFileSync("python3", [path.join(root, ".github/memes/crunch.py"), raw, raw.replace(/png$/, "jpg")]);
  fs.unlinkSync(raw);
  console.log("drew", key);
}
await browser.close();
