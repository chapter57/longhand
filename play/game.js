// The Lost Pages: a little side-scroller through three books from 1904-1925,
// all in the public domain. Plain canvas, no libraries. You run, jump, collect
// a writer's lost pages, and dodge rejection letters and critics.
(() => {
"use strict";
const W = 960, H = 540, T = 32, ROWS = 17;
const cv = document.getElementById("game"), cx = cv.getContext("2d");
const FONT = "Literata, Georgia, serif", MONO = "'IBM Plex Mono', monospace";

/* ---------- levels ---------- */
// Each level is drawn on a grid of 32px tiles. "#" is ground, "=" a ledge,
// "D" a dock board; p = page, c = critic (walks), r = rejection letter (flies),
// E = the way out.
function grid(cols) { return Array.from({ length: ROWS }, () => Array(cols).fill(".")); }
function ground(m, x0, x1, top = 14) { for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) m[y][x] = "#"; }
function ledge(m, x, y, w, ch = "=") { for (let i = 0; i < w; i++) m[y][x + i] = ch; }
function put(m, x, y, ch) { m[y][x] = ch; }
function pages(m, list) { for (const [x, y] of list) put(m, x, y, "p"); }

const LEVELS = [
  {
    key: "prague", title: "Prague, 1915", book: "Franz Kafka · The Metamorphosis",
    intro: ["Franz Kafka works all day at an insurance office", "and writes all night. His pages are blowing", "across the rooftops. Get them to the publisher."],
    outro: ["Kafka asked his best friend, Max Brod, to burn", "every unpublished page he left behind.", "Brod said no. The Trial and The Castle", "exist because of him."],
    quote: "When Gregor Samsa woke one morning from troubled dreams, he found himself changed in his bed into a monstrous insect.",
    by: "The Metamorphosis, 1915 (our translation)",
    sky: ["#2b1e3f", "#7d4a63", "#d98d6a"], tile: ["#5b5560", "#7b7480", "#3a3540"], ledge: "#8a5a3c",
    exit: "PUBLISHER",
    build(m) {
      ground(m, 0, 22); ground(m, 26, 40, 13); ground(m, 44, 60); ground(m, 64, 66, 12); ground(m, 70, 90, 13);
      ground(m, 95, 120); ground(m, 124, 128, 11); ground(m, 132, 150); ground(m, 153, 175, 13);
      ledge(m, 10, 10, 4); ledge(m, 17, 8, 3); ledge(m, 33, 9, 4); ledge(m, 50, 10, 5); ledge(m, 78, 9, 4); ledge(m, 84, 6, 3);
      ledge(m, 102, 10, 4); ledge(m, 109, 7, 4); ledge(m, 138, 10, 3); ledge(m, 143, 7, 4); ledge(m, 160, 9, 4);
      pages(m, [[12, 9], [18, 7], [34, 8], [52, 9], [65, 11], [79, 8], [85, 5], [103, 9], [110, 6], [126, 10], [139, 9], [144, 6], [161, 8], [168, 12]]);
      put(m, 30, 12, "c"); put(m, 55, 13, "c"); put(m, 88, 12, "c"); put(m, 115, 13, "c"); put(m, 146, 13, "c"); put(m, 165, 12, "c");
      put(m, 40, 8, "r"); put(m, 72, 7, "r"); put(m, 98, 8, "r"); put(m, 130, 6, "r"); put(m, 155, 7, "r");
      put(m, 172, 12, "E");
    },
  },
  {
    key: "dublin", title: "Dublin, June 16, 1904", book: "James Joyce · Ulysses",
    intro: ["Ulysses happens in a single day, June 16, 1904,", "from a tower by the sea to a bed at 2 a.m.", "Cross the city before the day runs out."],
    outro: ["In 1921 a typist's husband threw pages of", "Ulysses into the fire. Joyce had to piece", "them back together. The book came out in", "Paris on his 40th birthday, February 2, 1922."],
    quote: "yes I said yes I will Yes.",
    by: "Ulysses, 1922, the last words",
    sky: ["#7f97a0", "#b9c2b9", "#e2dcc6"], tile: ["#7a4b3a", "#9b6450", "#4f3026"], ledge: "#3e6b4f",
    exit: "SHAKESPEARE AND COMPANY",
    build(m) {
      ground(m, 0, 18); ground(m, 22, 34); ground(m, 38, 40, 12); ground(m, 44, 58, 13); ground(m, 62, 80);
      ground(m, 84, 86, 11); ground(m, 90, 92, 12); ground(m, 96, 115); ground(m, 119, 135, 13); ground(m, 139, 141, 11); ground(m, 145, 175);
      ledge(m, 8, 10, 3); ledge(m, 26, 10, 4); ledge(m, 48, 9, 3); ledge(m, 53, 6, 3); ledge(m, 68, 10, 4); ledge(m, 74, 7, 3);
      ledge(m, 100, 10, 3); ledge(m, 106, 7, 3); ledge(m, 112, 4, 3); ledge(m, 124, 9, 4); ledge(m, 150, 10, 4); ledge(m, 158, 7, 3);
      pages(m, [[9, 9], [27, 9], [39, 11], [49, 8], [54, 5], [69, 9], [75, 6], [85, 10], [91, 11], [101, 9], [107, 6], [113, 3], [125, 8], [140, 10], [151, 9], [159, 6]]);
      put(m, 15, 13, "c"); put(m, 30, 13, "c"); put(m, 56, 12, "c"); put(m, 72, 13, "c"); put(m, 110, 13, "c"); put(m, 130, 12, "c"); put(m, 155, 13, "c"); put(m, 165, 13, "c");
      put(m, 20, 8, "r"); put(m, 60, 7, "r"); put(m, 88, 6, "r"); put(m, 117, 7, "r"); put(m, 143, 6, "r"); put(m, 162, 9, "r");
      put(m, 172, 13, "E");
    },
  },
  {
    key: "westegg", title: "West Egg, 1922", book: "F. Scott Fitzgerald · The Great Gatsby",
    intro: ["Gatsby's party is going all night.", "Across the bay a green light burns", "at the end of Daisy's dock. Reach it."],
    outro: ["When Fitzgerald died in 1940, he thought", "The Great Gatsby had failed. During World War II,", "about 155,000 free copies went to American", "soldiers. It has never stopped selling since."],
    quote: "So we beat on, boats against the current, borne back ceaselessly into the past.",
    by: "The Great Gatsby, 1925, the last line",
    sky: ["#070c22", "#132151", "#24356e"], tile: ["#d8d2c2", "#f2ecdc", "#9e978a"], ledge: "#c9a227",
    exit: "GREEN",
    build(m) {
      ground(m, 0, 30); ground(m, 34, 36, 12); ground(m, 40, 62, 13); ground(m, 66, 68, 11); ground(m, 72, 74, 9);
      ground(m, 78, 100); ground(m, 104, 106, 12); ground(m, 110, 112, 10); ground(m, 116, 118, 12);
      for (let x = 122; x <= 175; x++) put(m, x, 13, "D");
      for (let x = 122; x <= 175; x += 5) for (let y = 14; y < ROWS; y++) put(m, x, y, "|");
      ledge(m, 6, 10, 4); ledge(m, 14, 7, 4); ledge(m, 22, 9, 3); ledge(m, 46, 9, 4); ledge(m, 54, 6, 4); ledge(m, 84, 10, 3); ledge(m, 90, 7, 3); ledge(m, 95, 4, 3);
      ledge(m, 130, 10, 3); ledge(m, 140, 9, 3); ledge(m, 147, 8, 3); ledge(m, 160, 10, 3);
      pages(m, [[7, 9], [15, 6], [23, 8], [35, 11], [47, 8], [55, 5], [67, 10], [73, 8], [85, 9], [91, 6], [96, 3], [105, 11], [111, 9], [117, 11], [131, 9], [141, 8], [148, 7], [161, 9]]);
      put(m, 20, 13, "c"); put(m, 26, 13, "c"); put(m, 50, 12, "c"); put(m, 58, 12, "c"); put(m, 82, 13, "c"); put(m, 92, 13, "c"); put(m, 98, 13, "c"); put(m, 136, 12, "c"); put(m, 156, 12, "c");
      put(m, 32, 8, "r"); put(m, 64, 6, "r"); put(m, 76, 6, "r"); put(m, 108, 7, "r"); put(m, 126, 8, "r"); put(m, 146, 6, "r"); put(m, 166, 7, "r");
      put(m, 173, 12, "E");
    },
  },
];

/* ---------- input ---------- */
const keys = {}, pressed = {};
const map = { ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "j", KeyW: "j", Space: "j", KeyZ: "j", Enter: "go" };
addEventListener("keydown", (e) => { const k = map[e.code]; if (k) { if (!keys[k]) pressed[k] = true; keys[k] = true; e.preventDefault(); } });
addEventListener("keyup", (e) => { const k = map[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
for (const b of document.querySelectorAll("[data-key]")) {
  const k = b.dataset.key;
  const on = (e) => { e.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true; if (k !== "go") pressed.go = true; };
  const off = (e) => { e.preventDefault(); keys[k] = false; };
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
}
cv.addEventListener("pointerdown", () => { pressed.go = true; });

/* ---------- state ---------- */
let state = "title", li = 0, lvl, tiles, cols, ents, P, cam = 0, got = 0, total = 0, t = 0, score = 0, cardT = 0;
const solid = (ch) => ch === "#" || ch === "=" || ch === "D";
const at = (x, y) => (y < 0 || y >= ROWS || x < 0 || x >= cols) ? (y >= ROWS ? "." : "#") : tiles[y][x];

function load(i) {
  li = i; lvl = LEVELS[i]; cols = 180;
  const m = grid(cols); lvl.build(m);
  ents = []; total = 0; got = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) {
    const ch = m[y][x];
    if (ch === "p") { ents.push({ k: "page", x: x * T + 8, y: y * T + 4, w: 16, h: 22, by: y * T + 4 }); total++; m[y][x] = "."; }
    if (ch === "c") { ents.push({ k: "critic", x: x * T + 4, y: y * T + 2, w: 24, h: 30, vx: -1 }); m[y][x] = "."; }
    if (ch === "r") { ents.push({ k: "letter", x: x * T, y: y * T, w: 30, h: 20, x0: x * T, y0: y * T, ph: x }); m[y][x] = "."; }
    if (ch === "E") { ents.push({ k: "exit", x: x * T - 8, y: (y - 2) * T, w: 48, h: 3 * T }); m[y][x] = "."; }
  }
  tiles = m;
  P = { x: 2 * T, y: 10 * T, w: 18, h: 30, vx: 0, vy: 0, on: false, coyote: 0, face: 1, hp: 3, hurt: 0, safe: [2 * T, 10 * T], step: 0 };
  cam = 0;
}

/* ---------- physics ---------- */
function hitsSolid(x, y, w, h) {
  for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - 1) / T); ty++)
    for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - 1) / T); tx++) if (solid(at(tx, ty))) return true;
  return false;
}
function move(o, dx, dy) {
  o.x += dx;
  if (hitsSolid(o.x, o.y, o.w, o.h)) { o.x = dx > 0 ? Math.floor((o.x + o.w) / T) * T - o.w : Math.floor(o.x / T + 1) * T; o.bumpX = true; }
  o.y += dy; o.on = false;
  if (hitsSolid(o.x, o.y, o.w, o.h)) {
    if (dy > 0) { o.y = Math.floor((o.y + o.h) / T) * T - o.h; o.on = true; } else o.y = Math.floor(o.y / T + 1) * T;
    o.vy = 0;
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function hurt() {
  if (P.hurt > 0) return;
  P.hp--; P.hurt = 90; P.vy = -7; P.vx = -P.face * 4;
  if (P.hp <= 0) { state = "fail"; cardT = 0; }
}
function fell() {
  P.hp--; if (P.hp <= 0) { state = "fail"; cardT = 0; return; }
  P.x = P.safe[0]; P.y = P.safe[1] - 40; P.vx = P.vy = 0; P.hurt = 90;
}

function update() {
  t++;
  if (state !== "play") {
    cardT++;
    if (pressed.go || pressed.j) {
      if (state === "title") { load(0); state = "intro"; cardT = 0; }
      else if (state === "intro" && cardT > 20) state = "play";
      else if (state === "done" && cardT > 30) { if (li + 1 < LEVELS.length) { load(li + 1); state = "intro"; cardT = 0; } else { state = "win"; cardT = 0; } }
      else if (state === "fail" && cardT > 30) { load(li); state = "intro"; cardT = 0; }
      else if (state === "win" && cardT > 60) { state = "title"; score = 0; cardT = 0; }
    }
    for (const k in pressed) delete pressed[k];
    return;
  }
  // the writer
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (dir) { P.vx += dir * 0.7; P.face = dir; } else P.vx *= 0.75;
  P.vx = Math.max(-4.2, Math.min(4.2, P.vx));
  P.coyote = P.on ? 6 : P.coyote - 1;
  if (pressed.j && P.coyote > 0) { P.vy = -12.5; P.coyote = 0; }
  if (!keys.j && P.vy < -4) P.vy = -4;
  P.vy = Math.min(P.vy + 0.55, 12);
  move(P, P.vx, P.vy);
  if (P.on) { P.safe = [Math.round(P.x), P.y]; }
  if (Math.abs(P.vx) > 0.5 && P.on) P.step += Math.abs(P.vx) * 0.12;
  if (P.x < 0) P.x = 0;
  if (P.y > ROWS * T + 40) fell();
  if (P.hurt > 0) P.hurt--;
  // everyone else
  for (const e of ents) {
    if (e.dead) continue;
    if (e.k === "page") { e.y = e.by + Math.sin((t + e.x) / 18) * 4; if (overlap(P, e)) { e.dead = true; got++; score += 100; } }
    if (e.k === "critic") {
      e.vy = Math.min((e.vy || 0) + 0.55, 12); e.bumpX = false;
      move(e, e.vx, e.vy);
      const ahead = Math.floor((e.vx > 0 ? e.x + e.w + 2 : e.x - 2) / T), below = Math.floor((e.y + e.h + 4) / T);
      if (e.bumpX || (e.on && !solid(at(ahead, below)))) e.vx = -e.vx;
    }
    if (e.k === "letter") { e.x = e.x0 + Math.sin((t + e.ph * 30) / 70) * 90; e.y = e.y0 + Math.sin((t + e.ph * 10) / 25) * 20; }
    if ((e.k === "critic" || e.k === "letter") && overlap(P, e)) {
      if (P.vy > 1 && P.y + P.h - e.y < 16) { e.dead = true; P.vy = -8; score += 50; }
      else hurt();
    }
    if (e.k === "exit" && overlap(P, e)) { state = "done"; cardT = 0; score += got * 10; }
  }
  cam += (Math.max(0, Math.min(cols * T - W, P.x - W * 0.4)) - cam) * 0.12;
  for (const k in pressed) delete pressed[k];
}

/* ---------- drawing ---------- */
const rect = (c, x, y, w, h) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
function sky() {
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, lvl.sky[0]); g.addColorStop(0.6, lvl.sky[1]); g.addColorStop(1, lvl.sky[2]);
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
}
function backdrop() {
  sky();
  const far = -cam * 0.2, near = -cam * 0.5;
  if (lvl.key === "prague") {
    rect("#f3d7a8", 760 + far * 0.2, 70, 0, 0); cx.fillStyle = "rgba(255,230,180,.75)"; cx.beginPath(); cx.arc(780 + far * 0.1, 90, 34, 0, 7); cx.fill();
    for (let i = -1; i < 12; i++) { // castle hill and spires
      const x = ((i * 260 + far) % 3120 + 3120) % 3120 - 260;
      cx.fillStyle = "#3b2a4a"; cx.fillRect(x, 300, 260, 300);
      cx.fillRect(x + 40, 210, 34, 100); cx.beginPath(); cx.moveTo(x + 36, 212); cx.lineTo(x + 57, 140); cx.lineTo(x + 78, 212); cx.fill();
      cx.fillRect(x + 150, 240, 50, 70); cx.beginPath(); cx.moveTo(x + 146, 242); cx.lineTo(x + 175, 180); cx.lineTo(x + 204, 242); cx.fill();
    }
    for (let i = -1; i < 14; i++) { // rooftops
      const x = ((i * 180 + near) % 2520 + 2520) % 2520 - 180;
      cx.fillStyle = "#24182e"; cx.beginPath(); cx.moveTo(x, 400); cx.lineTo(x + 90, 330); cx.lineTo(x + 180, 400); cx.lineTo(x + 180, 540); cx.lineTo(x, 540); cx.fill();
      rect("#24182e", x + 120, 330, 16, 40); rect("#ffcf7a", x + 60, 420, 12, 16); rect("#ffcf7a", x + 110, 430, 12, 16);
    }
  } else if (lvl.key === "dublin") {
    for (let i = -1; i < 10; i++) {
      const x = ((i * 340 + far) % 3400 + 3400) % 3400 - 340;
      cx.fillStyle = "#8d9a93"; cx.fillRect(x, 330, 340, 300);
      if (i % 3 === 0) { cx.fillRect(x + 60, 230, 90, 110); rect("#7c8983", x + 54, 222, 102, 14); } // a Martello tower
      for (let s = 0; s < 4; s++) rect("#7c8983", x + 180 + s * 36, 300 - (s % 2) * 20, 22, 40);
    }
    const doors = ["#c0392b", "#2c6fbb", "#e3b33a", "#3e8e41", "#7d3c98"];
    for (let i = -1; i < 14; i++) {
      const x = ((i * 150 + near) % 2100 + 2100) % 2100 - 150;
      rect(i % 2 ? "#8b4a39" : "#9a5743", x, 300, 150, 300); rect("#5b2e22", x, 292, 150, 10);
      for (let r = 0; r < 3; r++) { rect("#2b2f36", x + 20, 320 + r * 50, 22, 32); rect("#2b2f36", x + 108, 320 + r * 50, 22, 32); }
      rect(doors[(i + 20) % 5], x + 62, 440, 26, 50); cx.fillStyle = "#f1e3b3"; cx.beginPath(); cx.arc(x + 75, 440, 13, Math.PI, 0); cx.fill();
    }
  } else {
    cx.fillStyle = "#fff"; for (let i = 0; i < 60; i++) cx.fillRect((i * 157 + far * 0.3) % W + (i % 2 ? 0 : W) % W, (i * 71) % 260, 2, 2);
    for (let i = -1; i < 8; i++) { // Gatsby's mansion, all its windows lit
      const x = ((i * 520 + far) % 4160 + 4160) % 4160 - 520;
      cx.fillStyle = "#0f1838"; cx.fillRect(x + 40, 250, 420, 200); cx.beginPath(); cx.moveTo(x + 20, 252); cx.lineTo(x + 250, 170); cx.lineTo(x + 480, 252); cx.fill();
      cx.fillRect(x + 220, 140, 60, 50);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) rect((r + c + i) % 3 ? "#ffd36b" : "#ffe9ad", x + 66 + c * 48, 270 + r * 50, 20, 28);
    }
    const g = cx.createLinearGradient(0, 430, 0, H); g.addColorStop(0, "#0d1a3a"); g.addColorStop(1, "#050a1c");
    cx.fillStyle = g; cx.fillRect(0, 430, W, 110);
    for (let i = 0; i < 30; i++) rect("rgba(255,211,107,.25)", ((i * 97 + near) % W + W) % W, 450 + (i * 13) % 80, 30, 2);
  }
}
function drawTiles() {
  const x0 = Math.floor(cam / T), x1 = x0 + Math.ceil(W / T) + 1;
  for (let y = 0; y < ROWS; y++) for (let x = x0; x <= x1; x++) {
    const ch = at(x, y), sx = x * T - cam, sy = y * T;
    if (ch === "#") {
      const top = at(x, y - 1) !== "#";
      rect(lvl.tile[0], sx, sy, T, T); rect(lvl.tile[2], sx, sy + T - 3, T, 3); rect(lvl.tile[2], sx + ((x + y) % 2 ? 0 : 15), sy, 2, T);
      if (top) { rect(lvl.tile[1], sx, sy, T, 8); rect(lvl.tile[2], sx, sy + 8, T, 2); }
    } else if (ch === "=") { rect(lvl.ledge, sx, sy, T, 12); rect("rgba(0,0,0,.3)", sx, sy + 10, T, 2); rect("rgba(255,255,255,.25)", sx, sy, T, 2); }
    else if (ch === "D") { rect("#6b4a2b", sx, sy, T, 12); rect("#4a321c", sx + T - 2, sy, 2, 12); }
    else if (ch === "|") rect("#3b2716", sx + 12, sy, 8, T);
  }
  if (lvl.key === "westegg") { // the bay, under the dock
    cx.fillStyle = "rgba(10,25,60,.85)"; cx.fillRect(0, 15 * T, W, 2 * T);
  }
}
function drawPage(e) {
  const x = e.x - cam, y = e.y;
  cx.save(); cx.translate(x + 8, y + 11); cx.rotate(Math.sin((t + e.x) / 25) * 0.15);
  rect("rgba(0,0,0,.25)", -6, -9, 16, 22); rect("#fbf7ee", -8, -11, 16, 22);
  for (let i = 0; i < 4; i++) rect("#6d6a63", -5, -7 + i * 4, 10 - (i === 3 ? 4 : 0), 1);
  cx.restore();
}
function drawCritic(e) {
  const x = e.x - cam, y = e.y, f = e.vx > 0 ? 1 : -1;
  rect("#1d1b22", x + 2, y + 12, 20, 18);                       // coat
  rect("#f0d6bd", x + 4, y + 2, 16, 12);                        // face
  rect("#1d1b22", x + 1, y - 6, 22, 4); rect("#1d1b22", x + 5, y - 14, 14, 9); // top hat
  rect("#111", x + (f > 0 ? 13 : 6), y + 6, 3, 3);              // eye
  cx.strokeStyle = "#c9a227"; cx.lineWidth = 2; cx.beginPath(); cx.arc(x + (f > 0 ? 15 : 8), y + 7, 4, 0, 7); cx.stroke(); // monocle
  rect("#111", x + 4 + (Math.floor(t / 8) % 2) * 4, y + 28, 5, 3); rect("#111", x + 14 - (Math.floor(t / 8) % 2) * 4, y + 28, 5, 3);
}
function drawLetter(e) {
  const x = e.x - cam, y = e.y, flap = Math.sin(t / 5) * 3;
  rect("rgba(0,0,0,.2)", x + 3, y + 3, 30, 20); rect("#f4ead2", x, y, 30, 20);
  cx.strokeStyle = "#8a7a5a"; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 15, y + 11 + flap); cx.lineTo(x + 30, y); cx.stroke();
  cx.save(); cx.translate(x + 15, y + 15); cx.rotate(-0.2); cx.fillStyle = "#c0392b"; cx.font = `bold 7px ${MONO}`; cx.textAlign = "center"; cx.fillText("REJECTED", 0, 0); cx.restore();
}
function drawExit(e) {
  const x = e.x - cam, y = e.y;
  if (lvl.exit === "GREEN") {
    rect("#3b2716", x + 20, y + 30, 8, 66);
    const glow = 0.6 + Math.sin(t / 15) * 0.3;
    const g = cx.createRadialGradient(x + 24, y + 22, 2, x + 24, y + 22, 70);
    g.addColorStop(0, `rgba(120,255,140,${glow})`); g.addColorStop(1, "rgba(120,255,140,0)");
    cx.fillStyle = g; cx.fillRect(x - 50, y - 50, 150, 150); rect("#b8ffb8", x + 17, y + 15, 14, 14);
  } else {
    rect("#3b2716", x, y + 6, 48, 90); rect("#6b4a2b", x + 6, y + 14, 36, 82); rect("#e3b33a", x + 34, y + 54, 4, 4);
    cx.font = `600 13px ${MONO}`; const w = cx.measureText(lvl.exit).width + 16;
    rect("#fbf7ee", x + 24 - w / 2, y - 20, w, 22); rect("#1e2227", x + 24 - w / 2, y - 20, w, 2);
    cx.fillStyle = "#1e2227"; cx.textAlign = "center"; cx.fillText(lvl.exit, x + 24, y - 4);
  }
}
function drawWriter() {
  if (P.hurt > 0 && Math.floor(P.hurt / 5) % 2) return;
  const x = Math.round(P.x - cam), y = Math.round(P.y), f = P.face, run = P.on ? Math.floor(P.step) % 2 : 1;
  rect("#2f4f78", x + 2, y + 12, 15, 13);                  // jacket
  rect("#f0d6bd", x + 3, y + 2, 13, 11);                   // face
  rect("#1e2227", x + 1, y - 1, 17, 4); rect("#1e2227", x + 4, y - 5, 11, 5); // hat
  rect("#1e2227", x + (f > 0 ? 11 : 5), y + 6, 2, 2);      // eye
  rect("#fbf7ee", x + (f > 0 ? 16 : -4), y + 14, 7, 9);     // pages under one arm
  rect("#1e2227", x + 3 + (run ? 0 : 4), y + 25, 5, 5); rect("#1e2227", x + 11 - (run ? 0 : 4), y + 25, 5, 5);
}
function hud() {
  rect("rgba(16,14,20,.55)", 0, 0, W, 38);
  cx.fillStyle = "#fbf7ee"; cx.textAlign = "left"; cx.font = `600 18px ${FONT}`; cx.fillText(lvl.title, 16, 25);
  cx.textAlign = "right"; cx.font = `500 15px ${MONO}`;
  cx.fillText(`PAGES ${got}/${total}   ${"♥".repeat(Math.max(0, P.hp))}${"♡".repeat(3 - Math.max(0, P.hp))}   ${String(score).padStart(5, "0")}`, W - 16, 25);
}
function card(lines, title, sub, hint, extra) {
  rect("rgba(10,10,16,.72)", 0, 0, W, H);
  const bw = 720, bh = 380, bx = (W - bw) / 2, by = (H - bh) / 2;
  rect("#16130f", bx + 10, by + 10, bw, bh); rect("#fbf7ee", bx, by, bw, bh); rect("#2f4f78", bx, by, bw, 8);
  cx.textAlign = "center"; cx.fillStyle = "#2f4f78"; cx.font = `500 14px ${MONO}`; cx.fillText(sub.toUpperCase(), W / 2, by + 50);
  cx.fillStyle = "#16130f"; cx.font = `600 38px ${FONT}`; cx.fillText(title, W / 2, by + 100);
  cx.font = `400 20px ${FONT}`; lines.forEach((l, i) => cx.fillText(l, W / 2, by + 150 + i * 30));
  if (extra) extra(by);
  if (Math.floor(t / 30) % 2) { cx.fillStyle = "#2f4f78"; cx.font = `500 15px ${MONO}`; cx.fillText(hint, W / 2, by + bh - 28); }
}
function wrap(text, width) {
  const out = []; let line = "";
  for (const w of text.split(" ")) { if (cx.measureText(line + w).width > width) { out.push(line.trim()); line = ""; } line += w + " "; }
  out.push(line.trim()); return out;
}
const tap = () => (matchMedia("(pointer: coarse)").matches ? "TAP" : "PRESS ENTER");

function draw() {
  if (state === "title") {
    lvl = LEVELS[Math.floor(t / 400) % 3]; cam = (t * 0.6) % 3000; backdrop();
    rect("rgba(10,10,16,.45)", 0, 0, W, H);
    cx.textAlign = "center"; cx.fillStyle = "#fbf7ee";
    cx.font = `500 16px ${MONO}`; cx.fillText("LONGHAND PRESENTS", W / 2, 150);
    cx.font = `600 76px ${FONT}`; cx.fillText("The Lost Pages", W / 2, 240);
    cx.font = `italic 400 24px ${FONT}`; cx.fillText("Three cities. Three books. Get the pages to the printer.", W / 2, 290);
    cx.font = `500 15px ${MONO}`; cx.fillText("← → TO RUN · ↑ OR SPACE TO JUMP · LAND ON CRITICS", W / 2, 360);
    if (Math.floor(t / 30) % 2) { cx.fillStyle = "#ffd36b"; cx.font = `500 18px ${MONO}`; cx.fillText(`${tap()} TO START`, W / 2, 420); }
    return;
  }
  backdrop(); drawTiles();
  for (const e of ents) if (!e.dead) ({ page: drawPage, critic: drawCritic, letter: drawLetter, exit: drawExit })[e.k](e);
  drawWriter(); hud();
  if (state === "intro") card(lvl.intro, lvl.title, `Level ${li + 1} of 3 · ${lvl.book}`, `${tap()} TO PLAY`);
  if (state === "fail") card(["The critics got you this time.", "Every writer gets rejected. Try again."], "Rejected", lvl.title, `${tap()} TO TRY AGAIN`);
  if (state === "done") card(lvl.outro, got === total ? "Every page saved" : `${got} of ${total} pages saved`, `${lvl.title} · ${lvl.book}`, `${tap()} TO GO ON`);
  if (state === "win") card([], "You made it", "The Lost Pages", `${tap()} TO PLAY AGAIN`, (by) => {
    cx.font = `italic 400 22px ${FONT}`; cx.fillStyle = "#16130f";
    wrap(`“${LEVELS[2].quote}”`, 600).forEach((l, i) => cx.fillText(l, W / 2, by + 160 + i * 32));
    cx.font = `500 13px ${MONO}`; cx.fillStyle = "#555"; cx.fillText(LEVELS[2].by.toUpperCase(), W / 2, by + 240);
    cx.font = `600 22px ${FONT}`; cx.fillStyle = "#2f4f78"; cx.fillText(`Final score: ${score}`, W / 2, by + 290);
  });
}

/* ---------- loop ---------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw(); requestAnimationFrame(frame);
}
// Jump straight to a level for testing: /play/?level=2
const q = new URLSearchParams(location.search).get("level");
if (q) { load(Math.max(0, Math.min(2, q - 1))); state = "intro"; }
document.fonts.ready.then(() => requestAnimationFrame(frame));
window.__game = { get state() { return state; }, get P() { return P; }, get got() { return got; } };
})();
