// The Longhand Almanac wall calendar, as one print-ready PDF for Lulu
// (11 x 8.5 in wall calendar: pages are 11.25 x 8.75 in with 0.125 in bleed).
// Page order: front cover, then for each month an art page (it hangs on top)
// and a grid page (below it), then the back cover. 26 pages.
//
// The portraits are pictures from Wikimedia Commons, downloaded by the Fetch
// portraits workflow (.github/calendar/fetch.py) into .github/calendar/portraits/
// with their makers and licenses, which are printed with them.
//   node .github/calendar/calendar.mjs .github/calendar/2027.yml <out-dir>
// Writes <out-dir>/longhand-almanac-<year>.pdf, plus a JPG of every page
// (for proofing and shop listings) when PREVIEW=1.
import { chromium } from "playwright";
import yaml from "js-yaml";
import fs from "fs";
const [DATA, OUT] = process.argv.slice(2), PICS = ".github/calendar/portraits";
const C = yaml.load(fs.readFileSync(DATA, "utf8")), Y = C.year;
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(`fonts/${f}`).toString("base64");
const logo = "data:image/png;base64," + fs.readFileSync("assets/brand/logo-light-1000.png").toString("base64");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const credits = yaml.load(fs.readFileSync(`${PICS}/credits.yml`, "utf8"));
const look = Object.fromEntries(C.months.map((m) => [m.portrait, { focus: m.focus || "50% 25%", zoom: m.zoom || 1 }]));
// A portrait filling its box, cropped around the face.
function portrait(k) {
  const f = credits[k].file, type = f.endsWith(".png") ? "png" : "jpeg";
  return `<img src="data:image/${type};base64,${fs.readFileSync(`${PICS}/${f}`).toString("base64")}" style="object-position:${look[k].focus};transform:scale(${look[k].zoom});transform-origin:${look[k].focus}">`;
}
// "Photograph by Étienne Carjat, 1872. Public domain." The date is left out when Commons has none worth printing.
function credit(k) {
  const c = credits[k], year = (c.date || "").match(/\b(1[5-9]\d\d)\b/);
  const artist = !c.artist || /unknown/i.test(c.artist) ? "Unknown maker" : c.artist;
  return `${esc(artist)}${year ? `, ${year[1]}` : ""}. ${esc(c.license)}, via Wikimedia Commons`;
}
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
// Bleed is 12px (0.125 in at 96px/in) on every side. The wire binding takes
// 0.375 in at the bottom of the art page and the top of the grid page.
const css = `
@font-face{font-family:L;font-weight:400;src:url(${font("Literata-normal-400.woff2")})}
@font-face{font-family:L;font-weight:600;src:url(${font("Literata-normal-600.woff2")})}
@font-face{font-family:L;font-style:italic;src:url(${font("Literata-italic-400.woff2")})}
@font-face{font-family:M;font-weight:500;src:url(${font("IBMPlexMono-normal-500.woff2")})}
@page{size:11.25in 8.75in;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#fbf7ee;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:1080px;height:840px;position:relative;overflow:hidden;background:#fbf7ee;page-break-after:always;color:#16130f}
.art{display:grid;grid-template-columns:582px minmax(0,1fr)}
.pic{height:840px;background:#16130f;overflow:hidden}
.tiles>div{overflow:hidden}
img{width:100%;height:100%;object-fit:cover;display:block}
.cr{font:500 10px/1.4 M;letter-spacing:.04em;color:#999;margin-top:8px}
.side{padding:66px 60px 92px 50px;display:flex;flex-direction:column}
.k{font:500 15px M;letter-spacing:.2em}
h1{font:600 104px/1 L;margin:18px 0 30px;letter-spacing:-.02em}
.q{font:italic 30px/1.3 L;border-left:6px solid;padding-left:20px}
.by{font:500 13px/1.5 M;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 0 26px;color:#555}
.bio{font:18.5px/1.5 L;color:#333;margin-top:auto}
.foot{font:500 12px M;letter-spacing:.16em;color:#888;margin-top:22px}
.grid{padding:62px 50px 40px;display:flex;flex-direction:column}
.gh{display:flex;justify-content:space-between;align-items:baseline;border-bottom:4px solid #16130f;padding-bottom:8px}
.gh h2{font:600 42px L;margin:0}.gh span{font:500 13px M;letter-spacing:.14em;color:#666}
.dw{display:grid;grid-template-columns:repeat(7,1fr);font:500 12px M;letter-spacing:.14em;color:#666;padding:10px 0 5px 9px}
.cal{flex:1;display:grid;grid-template-columns:repeat(7,1fr);border-top:1.5px solid #16130f;border-left:1.5px solid #16130f}
.c{border-right:1.5px solid #16130f;border-bottom:1.5px solid #16130f;padding:6px 8px 7px;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.c b{font:600 22px/1 L}.c i{font:500 9.5px/1.2 M;letter-spacing:.06em;text-transform:uppercase;color:#777;margin-top:3px}
.c span{font:italic 13.5px/1.2 L;margin-top:auto}
.c.x{background:repeating-linear-gradient(45deg,transparent 0 8px,rgba(0,0,0,.05) 8px 9px)}
.key{display:flex;justify-content:space-between;font:500 11px M;letter-spacing:.1em;color:#777;padding-top:8px}
.cover{background:#16130f;color:#fbf7ee}
.tiles{position:absolute;inset:0;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:300px 300px;row-gap:240px}
.band{position:absolute;left:0;right:0;top:300px;height:240px;background:#fbf7ee;color:#16130f;display:flex;align-items:center;justify-content:center;gap:34px;border-top:6px solid #16130f;border-bottom:6px solid #16130f}
.band img{width:150px;height:150px}
.band .t{font:600 58px/1 L;letter-spacing:-.02em;white-space:nowrap}.band .s{font:500 16px M;letter-spacing:.3em;margin-top:16px}
.band .p{font:500 12px M;letter-spacing:.3em;margin-top:12px;color:#2F4F78}
.back{padding:64px 120px 72px;display:flex;flex-direction:column}
.back h3{font:600 40px L;margin:0 0 6px}.back p{font:19px/1.55 L;color:#333;margin:0 0 14px;max-width:760px}
.cast{display:grid;grid-template-columns:1fr 1fr;gap:6px 40px;font:500 11px/1.45 M;letter-spacing:.03em;margin-top:14px;color:#444}
.imprint{margin-top:auto;display:flex;align-items:center;gap:20px}
.imprint img{width:84px;height:84px}
.imprint b{display:block;font:600 22px L}.imprint span{display:block;font:500 12px/1.7 M;letter-spacing:.12em;color:#666}
`;
const pages = [];
pages.push(`<div class="page cover"><div class="tiles">${C.months.map((m) => `<div>${portrait(m.portrait)}</div>`).join("")}</div>
  <div class="band"><img src="${logo}"><div><div class="t">The Longhand Almanac ${Y}</div><div class="s">A WRITER FOR EVERY DAY</div><div class="p">LONGHAND PUBLISHING</div></div></div></div>`);
C.months.forEach((m, i) => {
  pages.push(`<div class="page art"><div class="pic">${portrait(m.portrait)}</div><div class="side">
    <div class="k" style="color:${m.dark}">THE LONGHAND ALMANAC · ${Y}</div><h1 style="font-size:${[104, 104, 104, 104, 104, 104, 104, 96, 84, 76][m.name.length]}px">${m.name}</h1>
    <div class="q" style="border-color:${m.color}">${esc(m.quote).replace(" / ", "<br>")}</div><div class="by">${esc(m.by)}</div>
    <div class="bio">${esc(m.bio)}</div><div class="foot">LONGHANDLIT.COM</div><div class="cr">Portrait: ${credit(m.portrait)}</div></div></div>`);
  const first = new Date(Y, i, 1).getDay(), n = new Date(Y, i + 1, 0).getDate(), rows = Math.ceil((first + n) / 7);
  let cells = "";
  for (let j = 0; j < rows * 7; j++) {
    const d = j - first + 1;
    if (d < 1 || d > n) { cells += `<div class="c x"></div>`; continue; }
    const hol = C.holidays[`${i + 1}-${d}`], who = m.days[d - 1] || "";
    cells += `<div class="c" style="${d === m.day ? `background:${m.tint}` : ""}"><b>${d}</b>${hol ? `<i>${esc(hol)}</i>` : ""}<span style="color:${m.dark}">${esc(who)}</span></div>`;
  }
  pages.push(`<div class="page grid"><div class="gh"><h2>${m.name} ${Y}</h2><span>A WRITER FOR EVERY DAY</span></div>
    <div class="dw">${DOW.map((d) => `<div>${d}</div>`).join("")}</div>
    <div class="cal" style="grid-template-rows:repeat(${rows},1fr)">${cells}</div>
    <div class="key"><span>† DIED ON THIS DAY · EVERYONE ELSE WAS BORN ON IT</span><span>A NEW ENTRY EVERY DAY AT LONGHANDLIT.COM</span></div></div>`);
});
pages.push(`<div class="page back"><h3>The Longhand Almanac</h3>
  <p>Longhand is a literary almanac. Every day at longhandlit.com, one new entry opens: a writer, a book, or a moment in literary history. You can read everything that came before. Tomorrow is still in the pen.</p>
  <p>This calendar puts a writer in every day of ${Y}, and one on your wall every month. The quotations are in the public domain or are our own translations. The portraits come from Wikimedia Commons:</p>
  <div class="cast">${C.months.map((m) => `<div><span style="color:${m.dark}">${m.name.slice(0, 3).toUpperCase()}</span> · ${esc(m.by.split(" · ")[0])}: ${credit(m.portrait)} (${esc(credits[m.portrait].commons)})</div>`).join("")}</div>
  <div class="imprint"><img src="${logo}"><div><b>Longhand Publishing</b><span>LONGHANDLIT.COM</span><span>CALENDAR DESIGN © ${Y - 1} LONGHAND PUBLISHING</span></div></div></div>`);
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>${pages.join("\n")}`;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
// Each page is photographed at 300 dpi and the PDF is made of those pictures,
// so it has no transparency or layers left in it, as Lulu asks ("flattened").
const tab = await browser.newPage({ viewport: { width: 1080, height: 840 }, deviceScaleFactor: 300 / 96 });
await tab.setContent(html, { waitUntil: "load", timeout: 0 }); await tab.evaluate(() => document.fonts.ready);
fs.mkdirSync(OUT, { recursive: true });
const shots = [];
for (const el of await tab.locator(".page").all()) shots.push(await el.screenshot({ type: "jpeg", quality: 92 }));
if (process.env.PREVIEW) shots.forEach((b, i) => fs.writeFileSync(`${OUT}/page-${String(i + 1).padStart(2, "0")}.jpg`, b));
await tab.setContent(`<!doctype html><style>@page{size:11.25in 8.75in;margin:0}body{margin:0}img{display:block;width:11.25in;height:8.75in;page-break-after:always}img:last-child{page-break-after:auto}</style>`
  + shots.map((b) => `<img src="data:image/jpeg;base64,${b.toString("base64")}">`).join(""), { waitUntil: "load", timeout: 0 });
await tab.pdf({ path: `${OUT}/longhand-almanac-${Y}.pdf`, width: "11.25in", height: "8.75in", printBackground: true });
console.log(`${pages.length} pages`);
await browser.close();
