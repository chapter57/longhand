// Mrs. Dalloway: an 8-bit game of one day in June, 1923, from Virginia Woolf's
// novel (1925, now in the public domain). Drawn at the NES's 256 x 240, with
// its palette, pixel sprites, pixel portraits and a pixel font, then scaled up.
// Plain canvas and Web Audio, no libraries.
(() => {
"use strict";
const W = 256, H = 240, T = 16, ROWS = 15;
const cv = document.getElementById("game"), cx = cv.getContext("2d");
cx.imageSmoothingEnabled = false;

/* ---------- the NES palette (the colors we use) ---------- */
const C = {
  k: "#000000", K: "#3c3c3c", g: "#7c7c7c", G: "#bcbcbc", w: "#fcfcfc", W: "#f8f8f8",
  r: "#a80020", R: "#e40058", o: "#f83800", O: "#fca044", y: "#f8b800", Y: "#f8d878", b: "#503000", B: "#ac7c00",
  n: "#881400", N: "#e45c10", e: "#007800", E: "#00b800", l: "#58d854", L: "#b8f8b8",
  s: "#0058f8", S: "#3cbcfc", a: "#a4e4fc", u: "#4428bc", U: "#6844fc", v: "#9878f8", V: "#d8b8f8",
  p: "#f878f8", P: "#f8b8f8", t: "#008888", T: "#00e8d8", f: "#fce0a8", F: "#f0d0b0", h: "#e09868",
};

/* ---------- a 5 x 7 pixel font ---------- */
const GLYPHS = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"], B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "], D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"], F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ####"], H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "], J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"], L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"], N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "], P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"], R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "], T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "], V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "], X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "], Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  0: [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "], 1: ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  2: [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"], 3: ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "],
  4: ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "], 5: ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  6: ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "], 7: ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  8: [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "], 9: [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
  ".": ["     ", "     ", "     ", "     ", "     ", " ##  ", " ##  "], ",": ["     ", "     ", "     ", "     ", " ##  ", "  #  ", " #   "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "], "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  "'": ["  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "], '"': [" # # ", " # # ", "     ", "     ", "     ", "     ", "     "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "], ";": ["     ", " ##  ", " ##  ", "     ", " ##  ", "  #  ", " #   "],
  "-": ["     ", "     ", "     ", "#####", "     ", "     ", "     "], "(": ["   # ", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   # "],
  ")": [" #   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", " #   "], "/": ["    #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#    "],
  "&": [" ##  ", "#  # ", "# #  ", " #   ", "# # #", "#  # ", " ## #"], "*": [" # # ", "#####", "#####", "#####", " ### ", "  #  ", "     "],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "], " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
};
function text(s, x, y, col = C.w, shadow = C.k) {
  s = String(s).toUpperCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, "-");
  for (const pass of shadow ? [shadow, col] : [col]) {
    cx.fillStyle = pass; let px = x + (pass === shadow && shadow !== col ? 1 : 0), py = y + (pass === shadow && shadow !== col ? 1 : 0);
    for (const ch of s) {
      const g = GLYPHS[ch] || GLYPHS[" "];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "#") cx.fillRect(px + c, py + r, 1, 1);
      px += 6;
    }
  }
}
const textW = (s) => String(s).length * 6;
const center = (s, y, col, sh) => text(s, Math.round((W - textW(s)) / 2), y, col, sh);
function wrap(s, n) { const out = []; let line = ""; for (const w of s.split(" ")) { if ((line + w).length > n) { out.push(line.trim()); line = ""; } line += w + " "; } out.push(line.trim()); return out; }

/* ---------- sprites, drawn as text ---------- */
function sprite(rows, pal) {
  const c = document.createElement("canvas"); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const WOMAN = [
  "......hhhh......", "....hhhhhhhh....", "...hhhhxhhhhh...", "....gggssss.....", "....ggsssks.....", "....ggsssss.....", ".....gssss......", "......sss.......",
  ".....dwwwd......", "....dddddddd....", "...ddddddddss...", "...dddddddd.....", "....dddddd......", "....dddddd......", "....ddddddd.....", "...dddddddd.....",
  "...ddddddddd....", "..dddddddddd....", "..DDDDDDDDDDD...", "..DDDDDDDDDDD...", "...DDDDDDDDD....",
];
const WOMAN_FEET = [["....s....s......", "....s....s......", "...kk...kk......"], ["....s...s.......", "...s.....s......", "..kk.....kk....."], [".....s.s........", ".....s.s........", "....kk.kk......."]];
const MAN = [
  ".....tttt.......", ".....tttt.......", ".....tttt.......", "....tttttt......", "...tttttttt.....", "....ssssss......", "....ssssks......", "....ssssss......",
  "....mmmmss......", ".....ssss.......", "....cwwwwc......", "...cccwrcccc....", "..ccccwrcccccc..", "..cccccccccc....", "..ss.cccccc.....", ".....cccccc.....",
  ".....cccccc.....", ".....pppppp.....", ".....pp..pp.....", ".....pp..pp.....", ".....pp..pp.....",
];
const MAN_FEET = [[".....pp..pp.....", ".....pp..pp.....", "....kkk..kkk...."], ["....pp....pp....", "...pp......pp...", "..kkk......kkk.."], [".....pp.pp......", ".....pp.pp......", "....kkkkkk......"]];
const build = (base, feet, pal) => feet.map((f) => sprite(base.concat(f), pal));
const PEOPLE = {
  clarissa: build(WOMAN, WOMAN_FEET, { h: C.U, x: C.P, g: C.G, s: C.F, k: C.k, d: C.v, D: C.U, w: C.w }),
  hugh: build(MAN, MAN_FEET, { t: C.k, s: C.F, k: C.k, m: C.F, c: C.K, w: C.w, r: C.r, p: C.g }),
  peter: build(MAN.map((r, i) => i < 5 ? r.replace(/t/g, ".") : r).map((r, i) => i === 4 ? "....bbbbbb......" : r), MAN_FEET, { t: C.b, b: C.b, s: C.F, k: C.k, m: C.b, c: C.b, w: C.w, r: C.e, p: C.b }),
  septimus: build(MAN.map((r, i) => i < 5 ? (i === 4 ? "....BBBBBB......" : r.replace(/t/g, ".")) : r), MAN_FEET, { B: C.B, s: C.F, k: C.k, m: C.F, c: C.g, w: C.w, r: C.K, p: C.K }),
  rezia: build(WOMAN, WOMAN_FEET, { h: C.k, x: C.R, g: C.k, s: C.F, k: C.k, d: C.R, D: C.r, w: C.w }),
  pym: build(WOMAN, WOMAN_FEET, { h: C.G, x: C.G, g: C.G, s: C.F, k: C.k, d: C.e, D: C.e, w: C.w }),
  richard: build(MAN, MAN_FEET, { t: C.K, s: C.F, k: C.k, m: C.g, c: C.k, w: C.w, r: C.R, p: C.k }),
  sally: build(WOMAN, WOMAN_FEET, { h: C.r, x: C.y, g: C.b, s: C.F, k: C.k, d: C.R, D: C.r, w: C.w }),
};
const PIGEON = [sprite(["...gg...", "..gGkg..", "..gggo..", ".gggg...", "gGGggg..", ".gggg...", "..o.o...", "..o.o..."], { g: C.g, G: C.G, k: C.k, o: C.o }),
                sprite(["...gg...", "..gGkg..", "..gggo..", ".gggg...", "gGGggg..", ".gggg...", "...oo...", "...oo..."], { g: C.g, G: C.G, k: C.k, o: C.o })];
const FLOWERS = ["P", "S", "v", "R"].map((col) => sprite(["..pp....", ".pppp...", ".ppypp..", "..ppp...", "...e....", "..ee.e..", "...e....", "...e...."], { p: C[col], y: C.y, e: C.E }));
const ROSE = sprite(["..rr....", ".rRrr...", ".rrRr...", "..rr....", "...e....", "..ee.e..", "...e....", "...e...."], { r: C.r, R: C.R, e: C.E });
function car(body) {
  return sprite([
    "......kkkkkkkkkk................", ".....kbbbbbbbbbbk...............", "....kbaaabbbaaabbk..............", "...kbbaaabbbaaabbbk.............",
    "..kbbbbbbbbbbbbbbbbkkkkkkkkk....", ".kbbbbbbbbbbbbbbbbbbbbbbbbbbk...", "kbbbbbbbbbbbbbbbbbbbbbbbbbbbbk..", "kbbbbbbbbbbbbbbbbbbbbbbbbbbbYk..",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..", "...kkkk...............kkkk......", "..kGGGGk.............kGGGGk.....", "...kkkk...............kkkk......",
  ], { k: C.k, b: body, a: C.a, G: C.G, Y: C.Y });
}
const CARS = [car(C.K), car(C.n), car(C.e)];

/* ---------- pixel portraits, 32 x 32 ---------- */
function portrait(o) {
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const fill = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  fill(0, 0, 32, 32, o.bg);
  for (let y = 0; y < 32; y += 2) for (let x = (y / 2) % 2; x < 32; x += 2) px(x, y, o.bg2 || o.bg); // dither
  // shoulders and collar
  for (let y = 24; y < 32; y++) { const w = 10 + (y - 24) * 2; fill(16 - w, y, w * 2, 1, o.coat); }
  if (o.collar) { fill(13, 24, 6, 2, o.collar); px(16, 26, o.tie || o.collar); px(16, 27, o.tie || o.collar); }
  fill(14, 21, 5, 4, o.skin); fill(17, 21, 2, 4, o.shade);
  // face: a pixel oval
  const fw = o.thin ? 6 : 7, fh = o.long ? 10 : 9, cxm = 16, cym = 14;
  for (let y = -fh; y <= fh; y++) for (let x = -fw; x <= fw; x++) if ((x * x) / (fw * fw) + (y * y) / (fh * fh) <= 1) px(cxm + x, cym + y, x > fw * 0.35 ? o.shade : o.skin);
  // hair
  const H = o.hair, hs = o.hairStyle;
  if (hs === "bun" || hs === "center") { for (let x = -fw - 1; x <= fw + 1; x++) for (let y = -fh - 1; y < -fh + 5 - Math.abs(x) / 3; y++) px(cxm + x, cym + y, H); fill(cxm - fw - 1, cym - 4, 2, 9, H); fill(cxm + fw, cym - 4, 2, 9, H); px(cxm, cym - fh, o.skin); if (hs === "bun") fill(cxm + fw - 1, cym - 2, 4, 6, H); }
  if (hs === "short" || hs === "swept") { for (let x = -fw - 1; x <= fw + 1; x++) for (let y = -fh - 1; y < -fh + 4 - (hs === "swept" ? (x + fw) / 5 : 0); y++) px(cxm + x, cym + y, H); fill(cxm - fw - 1, cym - 5, 2, 5, H); fill(cxm + fw, cym - 5, 2, 4, H); }
  if (hs === "bob") { for (let x = -fw - 2; x <= fw + 2; x++) for (let y = -fh - 1; y < -fh + 5; y++) px(cxm + x, cym + y, H); fill(cxm - fw - 2, cym - 6, 3, 11, H); fill(cxm + fw, cym - 6, 3, 11, H); }
  if (hs === "white") { for (let x = -fw - 1; x <= fw + 1; x++) for (let y = -fh - 1; y < -fh + 4; y++) px(cxm + x, cym + y, H); fill(cxm - fw - 1, cym - 5, 2, 7, H); fill(cxm + fw, cym - 5, 2, 6, H); }
  // hats
  if (o.hat === "top") { fill(cxm - 5, 0, 11, cym - fh + 1, o.hatCol); fill(cxm - 9, cym - fh, 19, 2, o.hatCol); fill(cxm - 5, cym - fh - 3, 11, 1, o.band || C.K); }
  if (o.hat === "cloche") { for (let x = -fw - 2; x <= fw + 2; x++) for (let y = -fh - 2; y < -fh + 4; y++) if (x * x / ((fw + 2) * (fw + 2)) + (y + fh - 1) * (y + fh - 1) / 25 <= 1.2) px(cxm + x, cym + y, o.hatCol); fill(cxm - fw - 3, cym - fh + 3, fw * 2 + 7, 1, o.hatCol); if (o.flower) { fill(cxm + 4, cym - fh, 3, 3, o.flower); px(cxm + 5, cym - fh + 1, C.y); } }
  // eyes, brows, nose, mouth
  const ey = cym - 1 + (o.long ? 1 : 0);
  fill(cxm - 4, ey, 2, o.bigEyes ? 2 : 1, C.k); fill(cxm + 2, ey, 2, o.bigEyes ? 2 : 1, C.k);
  if (o.lids) { fill(cxm - 4, ey - 1, 2, 1, o.shade); fill(cxm + 2, ey - 1, 2, 1, o.shade); }
  fill(cxm - 5, ey - 2, 3, 1, o.brow || H); fill(cxm + 2, ey - 2, 3, 1, o.brow || H);
  px(cxm + 1, ey + 2, o.shade); px(cxm + 1, ey + 3, o.shade);
  if (o.glasses) { g.strokeStyle = C.k; g.lineWidth = 1; g.strokeRect(cxm - 5.5, ey - 1.5, 4, 3); g.strokeRect(cxm + 1.5, ey - 1.5, 4, 3); }
  if (o.moustache) fill(cxm - 3, ey + 5, 7, 1, o.moustache);
  fill(cxm - 2, ey + 6 + (o.moustache ? 1 : 0), 5, 1, o.lips || C.h); if (o.smile) { px(cxm - 3, ey + 5, o.lips || C.h); px(cxm + 3, ey + 5, o.lips || C.h); }
  if (o.pearls) for (let x = 11; x <= 21; x += 2) px(x, 25, C.w);
  if (o.clock) { // Big Ben, the narrator
    fill(0, 0, 32, 32, C.u); fill(8, 0, 16, 32, C.B); fill(6, 6, 20, 20, C.b); for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) if (x * x + y * y <= 64) px(16 + x, 16 + y, x * x + y * y > 49 ? C.y : C.W);
    fill(16, 9, 1, 8, C.k); fill(16, 16, 5, 1, C.k); for (const [x, y] of [[16, 9], [23, 16], [16, 23], [9, 16]]) px(x, y, C.k); fill(14, 0, 4, 4, C.y);
  }
  // a thin frame
  g.strokeStyle = C.w; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 31, 31);
  return c;
}
// Virginia Woolf, drawn by hand: hair parted in the middle and drawn down
// low over the ears, the long face, the heavy-lidded eyes of her photographs.
function woolfPortrait() {
  const rows = [
    "................................", "................................", "...........bbbbbbbbbb...........", ".........bbbbbbbbbbbbbb.........",
    "........bbbbbbbbBbbbbbbb........", ".......bbbbbbbbbBbbbbbbbb.......", ".......bbbbbbbbFFbbbbbbbb.......", "......bbbbbbbFFFFFFbbbbbbb......",
    "......bbbbbFFFFFFFFFFbbbbb......", "......bbbbFFFFFFFFFFFhbbbb......", "......bbbbFFFFFFFFFFFhbbbb......", "......bbbFKKKFFFFFKKKhhbbb......",
    "......bbbFFFFFFFFFFFFhhbbb......", "......bbbFhkkFFFFhkkhhhbbb......", "......bbbFFFFFFFFFFFFhhbbb......", "......bbbFFFFFFhFFFFFhhbbb......",
    "......bbbbFFFFFhFFFFhhbbbb......", "......bbbbFFFFFhhFFFhhbbbb......", ".......bbbFFFFFFFFFFhhbbb.......", ".......bbbbFFFrrrrFFhbbbb.......",
    "........bbbFFFFFFFFFhbbb........", "........bbbbFFFFFFFhhbbb........", ".........bbbbFFFFFhbbbb.........", "..........bbbbFFFFbbbb..........",
    "...........bbFFFFFFbb...........", "............FFFFFFhh............", "..........GGGFFFFhhGGG..........", "......KKKKKGGGFFFhGGGKKKKK......",
    "....KKKKKKKKGGGGGGGGKKKKKKKK....", "...KKKKKKKKKKKGGGGKKKKKKKKKKK...", "..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..", "..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..",
  ];
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
  g.fillStyle = C.t; g.fillRect(0, 0, 32, 32); g.fillStyle = "#007070";
  for (let y = 0; y < 32; y += 2) for (let x = (y / 2) % 2; x < 32; x += 2) g.fillRect(x, y, 1, 1);
  g.drawImage(sprite(rows.map((r) => r.padEnd(32, ".").slice(0, 32)), { b: C.b, B: C.n, F: C.F, h: C.h, k: C.k, K: C.K, G: C.G, r: C.h }), 0, 0);
  g.strokeStyle = C.w; g.strokeRect(0.5, 0.5, 31, 31);
  return c;
}
const PORTRAITS = {
  woolf: woolfPortrait(),
  clarissa: portrait({ bg: C.V, bg2: C.v, skin: C.F, shade: C.h, hair: C.G, hairStyle: "white", hat: "cloche", hatCol: C.U, flower: C.P, coat: C.v, pearls: true, lips: C.R, smile: true }),
  peter: portrait({ bg: C.L, bg2: C.l, skin: C.F, shade: C.h, hair: C.b, hairStyle: "swept", coat: C.b, collar: C.w, tie: C.e, moustache: C.b }),
  septimus: portrait({ bg: C.a, bg2: C.S, skin: C.F, shade: C.h, hair: C.B, hairStyle: "short", thin: true, bigEyes: true, coat: C.g, collar: C.w, tie: C.K }),
  rezia: portrait({ bg: C.P, bg2: C.p, skin: C.F, shade: C.h, hair: C.k, hairStyle: "bob", hat: "cloche", hatCol: C.r, flower: C.y, coat: C.R, lips: C.r }),
  hugh: portrait({ bg: C.l, bg2: C.E, skin: C.F, shade: C.h, hair: C.K, hairStyle: "short", hat: "top", hatCol: C.k, coat: C.K, collar: C.w, tie: C.r, smile: true }),
  pym: portrait({ bg: C.Y, bg2: C.y, skin: C.F, shade: C.h, hair: C.G, hairStyle: "bun", glasses: true, coat: C.e, collar: C.w, smile: true }),
  richard: portrait({ bg: C.a, bg2: C.G, skin: C.F, shade: C.h, hair: C.g, hairStyle: "short", coat: C.k, collar: C.w, tie: C.R, moustache: C.g }),
  sally: portrait({ bg: C.O, bg2: C.N, skin: C.F, shade: C.h, hair: C.b, hairStyle: "bob", coat: C.R, pearls: true, lips: C.r, smile: true }),
  bigben: portrait({ bg: C.u, skin: C.F, shade: C.h, hair: C.k, coat: C.k, clock: true }),
};
const CAST = [["woolf", "WOOLF"], ["clarissa", "CLARISSA"], ["peter", "PETER"], ["septimus", "SEPTIMUS"], ["rezia", "REZIA"],
  ["hugh", "HUGH"], ["pym", "MISS PYM"], ["richard", "RICHARD"], ["sally", "SALLY"], ["bigben", "BIG BEN"]];
// The names over the dialogue boxes.
const NAMES = { woolf: "VIRGINIA WOOLF", clarissa: "CLARISSA DALLOWAY", peter: "PETER WALSH", septimus: "SEPTIMUS WARREN SMITH", rezia: "LUCREZIA (REZIA)", hugh: "HUGH WHITBREAD", pym: "MISS PYM", richard: "RICHARD DALLOWAY", sally: "SALLY SETON", bigben: "BIG BEN" };

/* ---------- sound: a square-wave Big Ben ---------- */
let audio = null, muted = false;
function tone(freq, start, dur, vol = 0.08, type = "square") {
  if (!audio || muted) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, audio.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + dur);
  o.connect(g).connect(audio.destination); o.start(audio.currentTime + start); o.stop(audio.currentTime + start + dur);
}
const NOTE = { E4: 329.6, "F#4": 370, "G#4": 415.3, B3: 246.9, E3: 164.8 };
function chime(hours) { // the Westminster quarters, then the hour
  const q = [["G#4", "F#4", "E4", "B3"], ["E4", "G#4", "F#4", "B3"], ["E4", "F#4", "G#4", "E4"], ["G#4", "E4", "F#4", "B3"]];
  let t = 0; for (const ph of q) { for (const n of ph) { tone(NOTE[n], t, 0.7, 0.06); t += 0.32; } t += 0.25; }
  for (let i = 0; i < Math.min(hours, 4); i++) tone(NOTE.E3, t + i * 0.8, 1.4, 0.09, "triangle");
}
const blip = (f = 880) => tone(f, 0, 0.08, 0.05);

/* ---------- the day, in four parts ---------- */
function grid(cols) { return Array.from({ length: ROWS }, () => Array(cols).fill(".")); }
function ground(m, x0, x1, top = 12, ch = "#") { for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) m[y][x] = ch; }
function block(m, x, y, w, h, ch) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[y + j][x + i] = ch; }
function put(m, list, ch) { for (const [x, y] of list) m[y][x] = ch; }
const LEVELS = [
  {
    key: "westminster", short: "WESTMINSTER", clock: "10:00", title: "WESTMINSTER, 10 A.M.", hours: 10, sky: [C.S, C.a], flower: 0,
    intro: [["bigben", "BIG BEN STRIKES TEN. JUNE, 1923. THE WAR IS OVER, AND LONDON IS OUT IN THE SUN."],
            ["clarissa", "MRS. DALLOWAY SAID SHE WOULD BUY THE FLOWERS HERSELF."]],
    outro: [["bigben", "THE LEADEN CIRCLES DISSOLVED IN THE AIR."]],
    build(m) {
      ground(m, 0, 140);
      block(m, 14, 10, 2, 2, "B"); block(m, 30, 9, 3, 1, "="); block(m, 44, 11, 2, 1, "B"); block(m, 58, 8, 3, 1, "="); block(m, 62, 10, 3, 1, "=");
      block(m, 80, 10, 2, 2, "B"); block(m, 96, 9, 3, 1, "="); block(m, 101, 7, 3, 1, "="); block(m, 118, 10, 2, 2, "B");
      put(m, [[8, 11], [15, 9], [22, 11], [31, 8], [37, 11], [45, 10], [59, 7], [63, 9], [72, 11], [81, 9], [97, 8], [102, 6], [110, 11], [119, 9], [128, 11]], "f");
      put(m, [[20, 11], [40, 11], [70, 11], [90, 11], [112, 11]], "p");
      put(m, [[52, 11], [124, 11]], "c");
      put(m, [[48, 11]], "1");
      put(m, [[136, 11]], "E");
    },
    talks: { 1: [["hugh", "GOOD-MORNING TO YOU, CLARISSA!"], ["clarissa", "I LOVE WALKING IN LONDON. REALLY IT'S BETTER THAN WALKING IN THE COUNTRY."],
                 ["bigben", "HUGH WHITBREAD HAS COME UP TO SEE DOCTORS. EVELYN IS OUT OF SORTS AGAIN."]] },
    who: { 1: "hugh" }, exitSign: "BOND ST",
  },
  {
    key: "bond", short: "BOND ST", clock: "11:00", title: "BOND STREET, 11 A.M.", hours: 11, sky: [C.a, C.W], flower: 1,
    intro: [["bigben", "A VIOLENT EXPLOSION IN BOND STREET! EVERYONE STOPS. (IT WAS ONLY A MOTOR CAR.)"],
            ["bigben", "AND OVERHEAD, AN AEROPLANE IS WRITING LETTERS IN SMOKE. K... R... E... M... O?"]],
    outro: [["pym", "GOOD MORNING, MRS. DALLOWAY! THE FLOWERS CAME IN THIS MORNING."], ["bigben", "THERE WERE FLOWERS: DELPHINIUMS, SWEET PEAS, BUNCHES OF LILAC; AND CARNATIONS, MASSES OF CARNATIONS."]],
    build(m) {
      ground(m, 0, 140);
      block(m, 12, 8, 4, 1, "="); block(m, 22, 10, 2, 2, "B"); block(m, 26, 7, 4, 1, "="); block(m, 60, 10, 2, 2, "B"); block(m, 100, 10, 2, 2, "B"); block(m, 40, 10, 2, 2, "B"); block(m, 50, 8, 4, 1, "="); block(m, 64, 6, 4, 1, "=");
      block(m, 78, 10, 2, 2, "B"); block(m, 88, 8, 4, 1, "="); block(m, 104, 7, 4, 1, "="); block(m, 116, 10, 2, 2, "B");
      put(m, [[13, 7], [16, 11], [27, 6], [34, 11], [41, 9], [51, 7], [58, 11], [65, 5], [74, 11], [79, 9], [89, 7], [96, 11], [105, 6], [112, 11], [117, 9], [126, 11]], "f");
      put(m, [[30, 11], [62, 11], [84, 11], [100, 11], [122, 11]], "c");
      put(m, [[20, 2], [45, 2], [70, 2], [95, 2], [120, 2]], "s");
      put(m, [[133, 11]], "E");
    },
    talks: {}, who: {}, exitSign: "MULBERRY'S",
  },
  {
    key: "park", short: "REGENT'S PARK", clock: "12:00", title: "REGENT'S PARK, NOON", hours: 12, sky: [C.S, C.L], flower: 2,
    intro: [["bigben", "NOON. IN REGENT'S PARK, A YOUNG MAN SITS ON A BENCH BESIDE HIS WIFE."]],
    outro: [["bigben", "PETER WALSH IS BACK FROM INDIA. HE WILL COME TO THE PARTY. EVERYONE WILL."]],
    build(m) {
      ground(m, 0, 30, 12, "g"); ground(m, 34, 58, 12, "g"); ground(m, 62, 64, 10, "g"); ground(m, 68, 100, 12, "g"); ground(m, 104, 106, 10, "g"); ground(m, 110, 140, 12, "g");
      block(m, 10, 10, 3, 1, "b"); block(m, 22, 9, 3, 1, "="); block(m, 44, 10, 3, 1, "b"); block(m, 50, 8, 3, 1, "="); block(m, 76, 10, 3, 1, "b"); block(m, 84, 8, 3, 1, "="); block(m, 89, 6, 3, 1, "=");
      block(m, 118, 10, 3, 1, "b"); block(m, 126, 8, 3, 1, "=");
      put(m, [[11, 9], [23, 8], [32, 9], [45, 9], [51, 7], [60, 8], [63, 9], [66, 8], [77, 9], [85, 7], [90, 5], [102, 8], [105, 9], [108, 8], [119, 9], [127, 7]], "f");
      put(m, [[18, 11], [40, 11], [56, 11], [72, 11], [96, 11], [114, 11], [132, 11]], "p");
      put(m, [[28, 11]], "1"); put(m, [[29, 11]], "2"); put(m, [[94, 11]], "3");
      put(m, [[137, 11]], "E");
    },
    talks: { 1: [["rezia", "LOOK, LOOK, SEPTIMUS!"], ["septimus", "..."],
                 ["bigben", "SEPTIMUS WARREN SMITH FOUGHT IN THE WAR. SOME MEN NEVER CAME HOME FROM IT, EVEN WHEN THEY DID."]],
             3: [["peter", "AND HOW ARE YOU?"], ["bigben", "PETER OPENS HIS POCKET-KNIFE. SHUTS IT. OPENS IT. HE HAS LOVED CLARISSA FOR THIRTY YEARS."]] },
    who: { 1: "rezia", 2: "septimus", 3: "peter" }, exitSign: "HOME",
  },
  {
    key: "party", short: "THE PARTY", clock: "EVENING", title: "THE PARTY", hours: 0, sky: [C.u, C.k], flower: 3, inside: true,
    intro: [["richard", "I'VE BROUGHT YOU SOME ROSES. (HE MEANS: I LOVE YOU. HE CAN'T QUITE SAY IT.)"], ["clarissa", "THE GUESTS ARE ARRIVING. GATHER THE ROSES."]],
    outro: [],
    build(m) {
      ground(m, 0, 140, 12, "w");
      block(m, 10, 10, 4, 2, "B"); block(m, 18, 8, 3, 1, "="); block(m, 26, 9, 3, 1, "="); block(m, 36, 11, 2, 1, "B"); block(m, 38, 10, 2, 2, "B"); block(m, 40, 9, 2, 3, "B"); block(m, 42, 8, 2, 4, "B");
      block(m, 46, 6, 6, 1, "="); block(m, 56, 8, 3, 1, "="); block(m, 66, 10, 4, 2, "B"); block(m, 76, 8, 3, 1, "="); block(m, 82, 6, 3, 1, "="); block(m, 90, 9, 3, 1, "=");
      block(m, 100, 11, 2, 1, "B"); block(m, 102, 10, 2, 2, "B"); block(m, 104, 9, 2, 3, "B"); block(m, 106, 8, 6, 4, "B");
      put(m, [[11, 9], [19, 7], [27, 8], [33, 11], [43, 7], [48, 5], [57, 7], [62, 11], [67, 9], [77, 7], [83, 5], [91, 8], [97, 11], [108, 7], [116, 11], [124, 11]], "f");
      put(m, [[30, 11]], "1"); put(m, [[72, 11]], "2"); put(m, [[133, 11]], "3");
    },
    talks: { 1: [["sally", "CLARISSA! IT'S SALLY! SALLY SETON! I HAVE FIVE ENORMOUS BOYS NOW."]],
             2: [["hugh", "A WONDERFUL PARTY, CLARISSA. THE PRIME MINISTER IS COMING, I HEAR."]],
             3: [["peter", "I WILL COME. WHAT IS THIS TERROR? WHAT IS THIS ECSTASY?"], ["peter", "IT IS CLARISSA, HE SAID."], ["bigben", "FOR THERE SHE WAS."]] },
    who: { 1: "sally", 2: "hugh", 3: "peter" }, last: 3,
  },
];

/* ---------- input ---------- */
const keys = {}, pressed = {};
const KEYMAP = { ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "j", KeyW: "j", Space: "j", KeyZ: "j", KeyX: "j", Enter: "a", KeyM: "m" };
addEventListener("keydown", (e) => { const k = KEYMAP[e.code]; if (k) { if (!keys[k]) pressed[k] = true; keys[k] = true; e.preventDefault(); } });
addEventListener("keyup", (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
for (const b of document.querySelectorAll("[data-key]")) {
  const k = b.dataset.key;
  const on = (e) => { e.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true; pressed.a = true; wake(); };
  const off = (e) => { e.preventDefault(); keys[k] = false; };
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
}
cv.addEventListener("pointerdown", () => { pressed.a = true; wake(); });
addEventListener("keydown", wake);
function wake() { if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } } }
const mute = document.getElementById("mute");
if (mute) mute.addEventListener("click", () => { muted = !muted; mute.textContent = muted ? "SOUND: OFF" : "SOUND: ON"; });

/* ---------- state ---------- */
let state = "title", li = 0, lvl, tiles, cols, ents, P, cam = 0, got = 0, total = 0, t = 0, talk = null, talkI = 0, talkT = 0, afterTalk = null, allGot = 0, allTotal = 0;
const SOLID = "#gwB=b";
const at = (x, y) => (y < 0 || y >= ROWS || x < 0 || x >= cols) ? (y >= ROWS ? "." : (x < 0 ? "#" : ".")) : tiles[y][x];
const solid = (ch) => SOLID.includes(ch) && ch !== ".";

function load(i) {
  li = i; lvl = LEVELS[i]; cols = 142;
  const m = grid(cols); lvl.build(m);
  ents = []; total = 0; got = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) {
    const ch = m[y][x];
    if (ch === "f") { ents.push({ k: "flower", x: x * T + 4, y: y * T + 6, w: 8, h: 8, by: y * T + 6 }); total++; }
    else if (ch === "p") ents.push({ k: "pigeon", x: x * T + 4, y: y * T + 8, w: 8, h: 8, vx: -0.4 });
    else if (ch === "c") ents.push({ k: "car", x: x * T, y: y * T + 4, w: 30, h: 12, x0: x * T, look: CARS[(x + y) % 3] });
    else if (ch === "s") ents.push({ k: "smoke", x: x * T, y: y * T, w: 6, h: 7, x0: x * T, y0: y * T, ch: "KREMO"[(x / 25 | 0) % 5], ph: x });
    else if ("123".includes(ch)) ents.push({ k: "npc", id: +ch, who: lvl.who[ch], x: x * T + 2, y: y * T - 8, w: 16, h: 24, talked: !lvl.talks[ch] });
    else if (ch === "E") ents.push({ k: "exit", x: x * T, y: (y - 2) * T, w: 32, h: 48 });
    else continue;
    m[y][x] = ".";
  }
  tiles = m;
  P = { x: 2 * T, y: 9 * T, w: 10, h: 22, vx: 0, vy: 0, on: false, coyote: 0, face: 1, hp: 3, hurt: 0, safe: [2 * T, 9 * T], step: 0 };
  cam = 0;
}
function say(lines, then) { talk = lines; talkI = 0; talkT = 0; afterTalk = then; blip(660); }

/* ---------- physics ---------- */
function hits(x, y, w, h) {
  for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - 1) / T); ty++)
    for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - 1) / T); tx++) if (solid(at(tx, ty))) return true;
  return false;
}
function move(o, dx, dy) {
  o.bumpX = false; o.x += dx;
  if (hits(o.x, o.y, o.w, o.h)) { o.x = dx > 0 ? Math.floor((o.x + o.w) / T) * T - o.w : Math.floor(o.x / T + 1) * T; o.bumpX = true; }
  o.y += dy; o.on = false;
  if (hits(o.x, o.y, o.w, o.h)) { if (dy > 0) { o.y = Math.floor((o.y + o.h) / T) * T - o.h; o.on = true; } else o.y = Math.floor(o.y / T + 1) * T; o.vy = 0; }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function hurt() { if (P.hurt > 0) return; P.hp--; P.hurt = 90; P.vy = -3.5; P.vx = -P.face * 2; tone(150, 0, 0.25, 0.08); if (P.hp <= 0) { state = "fail"; t = 0; } }
function fell() { P.hp--; tone(120, 0, 0.3, 0.08); if (P.hp <= 0) { state = "fail"; return; } P.x = P.safe[0]; P.y = P.safe[1] - 20; P.vx = P.vy = 0; P.hurt = 90; }

function update() {
  t++;
  if (pressed.m) { muted = !muted; if (mute) mute.textContent = muted ? "SOUND: OFF" : "SOUND: ON"; }
  const go = pressed.a || pressed.j;
  if (talk) {
    talkT++;
    if (go && talkT > 12) { talkI++; talkT = 0; blip(); if (talkI >= talk.length) { talk = null; const f = afterTalk; afterTalk = null; if (f) f(); } }
    for (const k in pressed) delete pressed[k]; return;
  }
  if (state === "title") { if (go) { allGot = allTotal = 0; load(0); state = "play"; chime(lvl.hours); say(lvl.intro); } for (const k in pressed) delete pressed[k]; return; }
  if (state === "fail") { if (go && t > 40) { load(li); state = "play"; say(lvl.intro.slice(-1)); } for (const k in pressed) delete pressed[k]; return; }
  if (state === "cast") { if (go && t > 90) state = "title"; for (const k in pressed) delete pressed[k]; return; }
  // Clarissa
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (dir) { P.vx += dir * 0.25; P.face = dir; } else P.vx *= 0.7;
  P.vx = Math.max(-1.7, Math.min(1.7, P.vx));
  P.coyote = P.on ? 6 : P.coyote - 1;
  if (pressed.j && P.coyote > 0) { P.vy = -6.4; P.coyote = 0; tone(520, 0, 0.1, 0.04); tone(780, 0.05, 0.08, 0.03); }
  if (!keys.j && P.vy < -2) P.vy = -2;
  P.vy = Math.min(P.vy + 0.3, 5.5);
  move(P, P.vx, P.vy);
  if (P.on) P.safe = [Math.round(P.x), P.y];
  if (Math.abs(P.vx) > 0.3 && P.on) P.step += Math.abs(P.vx) * 0.08;
  if (P.x < 0) P.x = 0;
  if (P.y > ROWS * T + 20) fell();
  if (P.hurt > 0) P.hurt--;
  for (const e of ents) {
    if (e.dead) continue;
    if (e.k === "flower") { e.y = e.by + Math.round(Math.sin((t + e.x) / 16)); if (overlap(P, e)) { e.dead = true; got++; tone(990, 0, 0.06, 0.05); tone(1320, 0.06, 0.08, 0.05); } }
    if (e.k === "pigeon") {
      e.vy = Math.min((e.vy || 0) + 0.3, 5); move(e, e.vx, e.vy);
      const ahead = Math.floor((e.vx > 0 ? e.x + e.w + 1 : e.x - 1) / T), below = Math.floor((e.y + e.h + 2) / T);
      if (e.bumpX || (e.on && !solid(at(ahead, below)))) e.vx = -e.vx;
    }
    if (e.k === "car") { e.x -= 1.6; if (e.x < e.x0 - 22 * T) e.x = e.x0 + 6 * T; }
    if (e.k === "smoke") { e.y += 0.45; e.x = e.x0 + Math.sin((t + e.ph * 7) / 40) * 20; if (e.y > 12 * T) { e.y = e.y0; } }
    if ((e.k === "pigeon") && overlap(P, e)) { if (P.vy > 0.5 && P.y + P.h - e.y < 8) { e.dead = true; P.vy = -3.5; tone(300, 0, 0.1, 0.06); } else hurt(); }
    if ((e.k === "car" || e.k === "smoke") && overlap(P, e)) hurt();
    if (e.k === "npc" && !e.talked && overlap(P, e)) {
      e.talked = true; P.vx = 0;
      const last = lvl.last === e.id;
      say(lvl.talks[e.id], last ? () => { allGot += got; allTotal += total; state = "cast"; t = 0; chime(0); } : null);
    }
    if (e.k === "exit" && overlap(P, e)) {
      e.dead = true; allGot += got; allTotal += total;
      say(lvl.outro.length ? lvl.outro : [["bigben", "ON SHE WENT."]], () => { load(li + 1); chime(lvl.hours); say(lvl.intro); });
    }
  }
  cam += (Math.max(0, Math.min(cols * T - W, P.x - W * 0.4)) - cam) * 0.15;
  for (const k in pressed) delete pressed[k];
}

/* ---------- drawing ---------- */
const rect = (col, x, y, w, h) => { cx.fillStyle = col; cx.fillRect(Math.round(x), Math.round(y), w, h); };
function backdrop() {
  const [top, bot] = lvl.sky;
  for (let y = 0; y < H; y += 8) rect(y < 120 ? top : bot, 0, y, W, 8);
  for (let y = 112; y < 136; y += 2) for (let x = (y / 2) % 2 * 2; x < W; x += 4) rect(bot, x, y, 2, 2); // a dithered horizon
  const far = Math.round(-cam * 0.25), near = Math.round(-cam * 0.5);
  if (lvl.key === "westminster") {
    for (let i = -1; i < 6; i++) { // the Houses of Parliament and Big Ben
      const x = ((i * 300 + far) % 1800 + 1800) % 1800 - 300;
      rect(C.B, x, 120, 220, 72); for (let k = 0; k < 11; k++) { rect(C.b, x + 4 + k * 20, 112, 6, 10); rect(C.b, x + 8 + k * 20, 134, 4, 10); rect(C.b, x + 8 + k * 20, 156, 4, 10); }
      rect(C.B, x + 240, 60, 24, 132); rect(C.b, x + 240, 60, 24, 3); rect(C.Y, x + 244, 72, 16, 16); rect(C.b, x + 251, 74, 2, 7); rect(C.b, x + 251, 80, 6, 2);
      for (let k = 0; k < 10; k++) rect(C.B, x + 246 + Math.floor(k / 2), 50 - k, 12 - k, 1); rect(C.y, x + 251, 38, 2, 4);
    }
    for (let i = -1; i < 9; i++) { const x = ((i * 120 + near) % 1080 + 1080) % 1080 - 120; rect(C.G, x + 20, 150, 6, 42); rect(C.k, x + 18, 148, 10, 4); rect(C.Y, x + 19, 142, 8, 6); } // lamp posts
  } else if (lvl.key === "bond") {
    const awn = [C.r, C.e, C.u, C.n];
    for (let i = -1; i < 9; i++) { // shopfronts
      const x = ((i * 128 + near) % 1152 + 1152) % 1152 - 128;
      rect(i % 2 ? C.G : C.Y, x, 96, 126, 96); rect(C.k, x, 96, 126, 2);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rect(C.s, x + 10 + c * 28, 104 + r * 22, 16, 14);
      rect(C.a, x + 12, 162, 44, 30); rect(C.k, x + 70, 158, 20, 34);
      for (let k = 0; k < 8; k++) rect(k % 2 ? C.w : awn[(i + 9) % 4], x + 8 + k * 7, 150, 7, 8);
    }
    const ax = ((t * 0.6) % 600) - 100; // the aeroplane, writing in smoke
    rect(C.w, ax, 24, 18, 3); rect(C.w, ax + 6, 20, 4, 11); rect(C.w, ax - 2, 22, 3, 7);
    text("KREEMO", ax - 50, 22, C.G, null);
  } else if (lvl.key === "park") {
    for (let i = -1; i < 8; i++) { // trees
      const x = ((i * 150 + far) % 1200 + 1200) % 1200 - 150;
      rect(C.b, x + 40, 130, 10, 62); for (let r = 0; r < 4; r++) rect(r % 2 ? C.e : C.E, x + 14 + r * 4, 92 + r * 10, 62 - r * 8, 12);
      rect(C.b, x + 112, 150, 8, 42); rect(C.e, x + 96, 120, 40, 34); rect(C.E, x + 100, 116, 30, 8);
    }
    for (let i = -1; i < 10; i++) { const x = ((i * 110 + near) % 1100 + 1100) % 1100 - 110; for (let k = 0; k < 10; k++) rect(C.k, x + k * 6, 178, 1, 14); rect(C.k, x, 180, 60, 1); } // railings
  } else { // inside: wallpaper, windows onto the night, chandeliers
    for (let x = 0; x < W; x += 16) for (let y = 0; y < 192; y += 16) { rect(C.r, x, y, 16, 16); rect(C.n, x + 7, y, 2, 16); rect(C.y, x + 3, y + 7, 2, 2); }
    for (let i = -1; i < 7; i++) {
      const x = ((i * 180 + near) % 1260 + 1260) % 1260 - 180;
      rect(C.Y, x + 20, 40, 48, 72); rect(C.k, x + 24, 44, 40, 64); rect(C.Y, x + 43, 44, 2, 64); rect(C.Y, x + 24, 74, 40, 2); rect(C.w, x + 30, 52, 1, 1); rect(C.w, x + 54, 60, 1, 1);
      rect(C.y, x + 120, 0, 2, 30); rect(C.y, x + 104, 30, 34, 4); for (let k = 0; k < 5; k++) { rect(C.w, x + 105 + k * 7, 24, 2, 6); if ((t >> 3) % 2 === k % 2) rect(C.Y, x + 105 + k * 7, 21, 2, 3); }
    }
  }
}
function drawTiles() {
  const x0 = Math.floor(cam / T), x1 = x0 + W / T + 1, ox = Math.round(cam);
  for (let y = 0; y < ROWS; y++) for (let x = x0; x <= x1; x++) {
    const ch = at(x, y), sx = x * T - ox, sy = y * T, top = at(x, y - 1) !== ch;
    if (ch === "#") { // pavement and kerb
      if (top) { rect(C.G, sx, sy, T, 4); rect(C.w, sx, sy, T, 1); rect(C.g, sx, sy + 4, T, 12); rect(C.K, sx, sy + 15, T, 1); rect(C.K, sx + 15, sy, 1, 16); }
      else { rect(C.K, sx, sy, T, T); rect(C.k, sx + ((x * 7) % 12), sy + 6, 3, 1); }
    } else if (ch === "g") {
      if (top) { rect(C.E, sx, sy, T, 5); rect(C.l, sx, sy, T, 1); for (let k = 0; k < 4; k++) rect(C.e, sx + k * 4 + 1, sy + 4, 2, 2); rect(C.b, sx, sy + 6, T, 10); rect(C.B, sx + 3 + (x % 3) * 3, sy + 10, 2, 2); }
      else { rect(C.b, sx, sy, T, T); rect(C.B, sx + (x * 5) % 12, sy + 6, 2, 2); }
    } else if (ch === "w") { // floorboards
      rect(top ? C.N : C.n, sx, sy, T, T); rect(C.b, sx, sy + 7, T, 1); rect(C.b, sx + ((x + y) % 2 ? 4 : 11), sy, 1, T); if (top) rect(C.O, sx, sy, T, 1);
    } else if (ch === "B") { // crates, carts, sideboards
      const col = lvl.inside ? C.b : C.B; rect(col, sx, sy, T, T); rect(C.k, sx, sy, T, 1); rect(C.k, sx, sy, 1, T); rect(C.k, sx + 15, sy, 1, T); rect(C.k, sx, sy + 15, T, 1);
      if (lvl.inside) { rect(C.B, sx + 2, sy + 2, 12, 5); rect(C.y, sx + 7, sy + 9, 2, 2); } else { rect(C.b, sx + 2, sy + 7, 12, 1); rect(C.b, sx + 7, sy + 2, 1, 12); }
    } else if (ch === "=") { // awnings, ledges, shelves
      const col = lvl.key === "bond" ? C.r : lvl.inside ? C.b : C.g; rect(col, sx, sy, T, 6); rect(C.k, sx, sy + 6, T, 1);
      if (lvl.key === "bond") for (let k = 0; k < 4; k++) rect(C.w, sx + k * 4, sy, 2, 6); else rect(C.w, sx, sy, T, 1);
    } else if (ch === "b") { // a park bench
      rect(C.e, sx, sy + 2, T, 3); rect(C.e, sx, sy - 4, T, 2); rect(C.k, sx + 2, sy + 5, 2, 11); rect(C.k, sx + 12, sy + 5, 2, 11);
    }
  }
}
function drawEnts(cars) {
  const ox = Math.round(cam);
  for (const e of ents) {
    if (e.dead || (e.k === "car") !== cars) continue;
    const sx = Math.round(e.x) - ox, sy = Math.round(e.y);
    if (sx < -40 || sx > W + 40) continue;
    if (e.k === "flower") cx.drawImage(lvl.inside ? ROSE : FLOWERS[(e.x / 16 | 0) % 4], sx, sy);
    if (e.k === "pigeon") { cx.save(); if (e.vx > 0) { cx.translate(sx + 8, sy); cx.scale(-1, 1); cx.drawImage(PIGEON[(t >> 4) % 2], 0, 0); } else cx.drawImage(PIGEON[(t >> 4) % 2], sx, sy); cx.restore(); }
    if (e.k === "car") { cx.drawImage(e.look, sx, sy); if ((t >> 2) % 2) rect(C.G, sx + 30, sy + 8, 2, 1); }
    if (e.k === "smoke") { rect("rgba(255,255,255,.55)", sx - 2, sy - 2, 10, 11); text(e.ch, sx, sy, C.g, null); }
    if (e.k === "npc") {
      const frames = PEOPLE[e.who]; cx.save(); cx.translate(sx + 16, sy); cx.scale(-1, 1); cx.drawImage(frames[0], 0, 0); cx.restore();
      if (e.id === 1 && e.who === "rezia") { const s = PEOPLE.septimus[0]; cx.save(); cx.translate(sx + 30, sy); cx.scale(-1, 1); cx.drawImage(s, 0, 0); cx.restore(); }
      if (!e.talked && (t >> 4) % 2) { rect(C.w, sx + 4, sy - 12, 9, 9); text("!", sx + 6, sy - 11, C.k, null); }
    }
    if (e.k === "exit") {
      const sign = lvl.exitSign || ""; const w = textW(sign) + 6;
      rect(C.b, sx + 14, sy + 12, 3, 36); rect(C.k, sx + 15 - w / 2, sy - 2, w, 12); rect(C.w, sx + 16 - w / 2, sy - 1, w - 2, 10); text(sign, sx + 18 - w / 2, sy + 1, C.k, null);
      if ((t >> 4) % 2) text(">", sx + 16 + w / 2, sy + 1, C.w);
    }
  }
}
function drawClarissa() {
  if (P.hurt > 0 && (P.hurt >> 2) % 2) return;
  const f = PEOPLE.clarissa[P.on ? (Math.abs(P.vx) > 0.3 ? 1 + (Math.floor(P.step) % 2) : 0) : 1];
  const sx = Math.round(P.x - cam) - 3, sy = Math.round(P.y) - 2;
  cx.save(); if (P.face < 0) { cx.translate(sx + 16, sy); cx.scale(-1, 1); cx.drawImage(f, 0, 0); } else cx.drawImage(f, sx, sy); cx.restore();
}
function hud() {
  rect(C.k, 0, 0, W, 14);
  text(lvl.clock, 4, 4, C.Y, null);
  cx.drawImage(lvl.inside ? ROSE : FLOWERS[lvl.flower], 72, 3); text(`${got}/${total}`, 84, 4, C.w, null);
  for (let i = 0; i < 3; i++) text("*", 140 + i * 8, 4, i < P.hp ? C.R : C.K, null);
  text(lvl.short, W - 4 - textW(lvl.short), 4, C.G, null);
}
function box(x, y, w, h) { rect(C.k, x, y, w, h); rect(C.w, x + 2, y + 2, w - 4, 1); rect(C.w, x + 2, y + h - 3, w - 4, 1); rect(C.w, x + 2, y + 2, 1, h - 4); rect(C.w, x + w - 3, y + 2, 1, h - 4); }
function drawTalk() {
  const [who, line] = talk[talkI];
  box(4, 166, W - 8, 70); cx.drawImage(PORTRAITS[who], 12, 176);
  text(NAMES[who] || "", 52, 174, C.Y, null);
  const shown = Math.min(line.length, talkT * 2);
  wrap(line.slice(0, shown), 32).slice(0, 6).forEach((l, i) => text(l, 52, 186 + i * 9, C.w, null));
  if (shown >= line.length && (t >> 4) % 2) text("+", W - 16, 226, C.Y, null);
}
function draw() {
  if (state === "title") {
    lvl = LEVELS[0]; cam = (t * 0.4) % 1800; backdrop();
    rect("rgba(0,0,0,.55)", 0, 0, W, H);
    cx.save(); cx.translate(96, 26); cx.scale(2, 2); cx.drawImage(PORTRAITS.woolf, 0, 0); cx.restore();
    center("VIRGINIA WOOLF'S", 98, C.G);
    cx.save(); cx.scale(2, 2); text("MRS. DALLOWAY", 25, 55, C.Y); cx.restore();
    center("ONE DAY IN JUNE. A PARTY TONIGHT.", 140, C.w);
    center("BUY THE FLOWERS. MIND THE MOTOR CARS.", 152, C.G);
    if ((t >> 5) % 2) center(matchMedia("(pointer: coarse)").matches ? "TAP TO START" : "PRESS ENTER", 180, C.Y);
    center("A LONGHAND GAME", 222, C.g, null);
    return;
  }
  if (state === "cast") {
    rect(C.k, 0, 0, W, H);
    center("THE END", 10, C.Y); center(`FLOWERS GATHERED: ${allGot} OF ${allTotal}`, 22, C.w);
    CAST.forEach(([k, name], i) => { const x = 6 + (i % 5) * 50, y = 40 + Math.floor(i / 5) * 76; cx.drawImage(PORTRAITS[k], x + 9, y); wrap(name, 8).forEach((l, j) => text(l, x + 25 - textW(l) / 2, y + 38 + j * 9, C.G, null)); });
    center("VIRGINIA WOOLF, 1925", 196, C.g, null);
    if (t > 90 && (t >> 5) % 2) center("PRESS ENTER", 218, C.Y);
    return;
  }
  backdrop(); drawEnts(true); drawTiles(); drawEnts(false); drawClarissa(); hud();
  if (state === "fail") { box(28, 80, 200, 70); center("OH DEAR.", 96, C.Y); center("SHE MUST BEGIN AGAIN.", 112, C.w); if ((t >> 5) % 2) center("PRESS ENTER", 132, C.G); }
  if (talk) drawTalk();
}

/* ---------- loop ---------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw(); requestAnimationFrame(frame);
}
const q = new URLSearchParams(location.search).get("level");
if (q) { load(Math.max(0, Math.min(3, q - 1))); state = "play"; say(lvl.intro); }
if (new URLSearchParams(location.search).has("cast")) { load(3); state = "cast"; t = 0; }
requestAnimationFrame(frame);
window.__game = { get state() { return state; }, get P() { return P; }, get talk() { return talk; }, get li() { return li; }, LEVELS, PORTRAITS };
})();
