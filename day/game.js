// A Quiet Day: a small game about a writing day at home. Walk the house, make
// coffee, take Juniper out, look out the window, and sit down at the desk to
// write. The desk opens Longhand (/write/), the site's real writing app, in a
// frame: same browser storage, same pieces, same Export, so what you write in
// the game is real writing.
//
// Everything is drawn in code on a plain canvas (no image files) at a low
// resolution and scaled up by whole pixels. Sound is made with Web Audio.
(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const T = 16;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ======================================================================
   The map. One character per 16-pixel tile.
   #  wall top        B S K L  wall faces (bedroom, study, kitchen, living)
   E  outside wall    .  wood floor      k  kitchen tiles
   D  front door      g  grass   w  porch   p  stepping stones   r  lane
   h  hedge
   ====================================================================== */
const rep = (c, n) => c.repeat(n);
const MAP = [
  rep("#", 32),
  "#" + rep("B", 12) + "#" + rep("S", 17) + "#",
  "#" + rep("B", 12) + "#" + rep("S", 17) + "#",
  ...Array(6).fill("#" + rep(".", 12) + "#" + rep(".", 17) + "#"),
  rep("#", 10) + ".." + rep("#", 7) + ".." + rep("#", 11),
  "#" + rep("K", 9) + ".." + "K" + rep("L", 6) + ".." + rep("L", 10) + "#",
  "#" + rep("K", 9) + ".." + "K" + rep("L", 6) + ".." + rep("L", 10) + "#",
  ...Array(6).fill("#" + rep("k", 12) + rep(".", 18) + "#"),
  rep("#", 22) + "DD" + rep("#", 8),
  rep("E", 22) + "DD" + rep("E", 8),
  rep("g", 19) + rep("w", 8) + rep("g", 5),
  rep("g", 22) + "pp" + rep("g", 8),
  rep("g", 22) + "pp" + rep("g", 8),
  rep("r", 32), rep("r", 32),
  rep("g", 32), rep("g", 32),
  rep("h", 32),
];
const MW = 32, MH = MAP.length;
const WORLD_W = MW * T, WORLD_H = MH * T;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? "#" : MAP[y][x];
const WALLISH = "#BSKLEh";
const INSIDE_ROWS = 18; // rows 0-17 are the house
const solid = new Uint8Array(MW * MH);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (WALLISH.includes(tileAt(x, y))) solid[y * MW + x] = 1;
const setSolid = (x, y, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) solid[(y + j) * MW + x + i] = 1; };

/* ======================================================================
   Palette and drawing helpers
   ====================================================================== */
const OL = "#2a1e25";
const WOOD = { d: "#6e4330", m: "#8f5a3c", l: "#ad7650", h: "#c99263" };
const FLOOR = ["#a46f49", "#9d6943", "#ab774f", "#a06c46", "#b07b52"];
const CAB = { d: "#4a6e69", m: "#5f8a84", l: "#79a39c" };
const SOFA = { d: "#a5722c", m: "#c98f3c", l: "#deaa58" };
const SWEATERS = [
  ["rust", "#b4483c", "#8a3530"], ["teal", "#3f7c7a", "#2e5d5f"], ["mustard", "#d9a441", "#b2832e"],
  ["plum", "#6a5a8c", "#4f4269"], ["oatmeal", "#e3d8c2", "#c2b59b"], ["forest green", "#4e6b46", "#3b5236"],
];
const SKIN = "#e8b796", SKIN_D = "#c98f6f", HAIR = "#4a3226", HAIR_L = "#6a4a36", PANTS = "#3d4660", SHOE = "#2b2226";

function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
// A box with a dark outline, and optional highlight and shade lines.
function ob(g, x, y, w, h, c, hi, lo) {
  px(g, x, y, w, h, OL); px(g, x + 1, y + 1, w - 2, h - 2, c);
  if (hi) px(g, x + 1, y + 1, w - 2, 1, hi);
  if (lo) px(g, x + 1, y + h - 2, w - 2, 1, lo);
}
// A filled pixel circle (no anti-aliasing).
function blob(g, cx, cy, r, c, sy = 1) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3); g.fillRect(cx - w, Math.round(cy + dy * sy), w * 2 + 1, 1); }
}
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; }
function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

/* ======================================================================
   The saved day
   ====================================================================== */
const SAVE_KEY = "longhand.quietday";
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function freshDay(day, carry) {
  return Object.assign({
    v: 1, day, minute: 420, weather: day === 1 ? "clear" : (Math.random() < 0.35 ? "rain" : "clear"),
    start: todayISO(), sweater: 0, plantLeaves: 5,
    total: { words: 0, days: 0, cups: 0, walks: 0 },
  }, carry || {}, {
    day, minute: 420,
    coffee: { where: null, level: 0, temp: 0 }, cups: 0, walks: 0, words: 0, deskMin: 0,
    fire: false, record: false, plantWatered: false, meals: {}, mailRead: false, bowl: false,
    dog: { hunger: 0.7, walk: 0.6 }, leash: "hook", pos: null,
  });
}
let S;
try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; }
if (!S || S.v !== 1) S = freshDay(1);
let hasSave = (() => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } })();
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); hasSave = true; } catch (e) { /* the game still works, it just won't remember */ } }
const prefGet = (k, d) => { try { const v = localStorage.getItem("longhand.quietday." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const prefSet = (k, v) => { try { localStorage.setItem("longhand.quietday." + k, JSON.stringify(v)); } catch (e) { /* not essential */ } };

/* ======================================================================
   Sound: rain, birds, the kettle, the fire, a record. All made here.
   ====================================================================== */
const Snd = (() => {
  let ac = null, out, rainG, musG, nb, on = prefGet("sound", true);
  let musTimer = 0, musNext = 0, bar = 0;
  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    out = ac.createGain(); out.gain.value = on ? 0.9 : 0; out.connect(ac.destination);
    nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = nb; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    rainG = ac.createGain(); rainG.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(rainG); rainG.connect(out); src.start();
    musG = ac.createGain(); musG.gain.value = 0;
    const mlp = ac.createBiquadFilter(); mlp.type = "lowpass"; mlp.frequency.value = 2200;
    musG.connect(mlp); mlp.connect(out);
  }
  const now = () => ac.currentTime;
  function noise(dur, o = {}) {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.value = o.f || 1000; f.Q.value = o.q || 1;
    const g = ac.createGain(); const t = now() + (o.at || 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain || 0.1, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, o = {}) {
    if (!ac) return;
    const s = ac.createOscillator(); s.type = o.type || "sine"; const t = now() + Math.max(0, o.at || 0);
    s.frequency.setValueAtTime(freq, t); if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain || 0.08, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; s.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || out); s.start(t); s.stop(t + dur + 0.05);
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65]];
  const MEL = [69, 72, 74, 76, 79, 81, 84];
  function playBar(t) {
    const ch = PROG[bar % 4], at = t - now();
    ch.forEach((m, i) => tone(mtof(m), 3.6, { type: "triangle", gain: 0.022, attack: 0.5, at: at + i * 0.04, dest: musG }));
    tone(mtof(ch[0] - 12), 3.2, { type: "sine", gain: 0.05, attack: 0.04, at, dest: musG });
    for (let k = 0; k < 4; k++) if (Math.random() < 0.55) tone(mtof(pick(MEL)), 1.4, { gain: 0.03, at: at + k * 0.8 + (Math.random() < 0.3 ? 0.4 : 0), dest: musG });
    for (let k = 0; k < 7; k++) noise(0.02, { type: "highpass", f: 4500, gain: 0.025, at: at + Math.random() * 3.2, dest: musG });
  }
  function sched() { if (!ac) return; while (musNext < now() + 1.2) { playBar(musNext); musNext += 3.2; bar++; } }
  return {
    init,
    get on() { return on; },
    toggle() { on = !on; prefSet("sound", on); if (ac) out.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.05); return on; },
    rain(v) { if (ac) rainG.gain.setTargetAtTime(v, now(), 0.8); },
    music(playing, vol) {
      if (!ac) return;
      if (playing && !musTimer) { musNext = now() + 0.2; musTimer = setInterval(sched, 250); sched(); }
      if (!playing && musTimer) { clearInterval(musTimer); musTimer = 0; }
      musG.gain.setTargetAtTime(playing ? vol : 0, now(), 0.3);
    },
    step(outside) { noise(0.06, { f: outside ? 900 : 420, q: 1.4, gain: outside ? 0.05 : 0.03 }); },
    chirp(vol) { const f = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.12), 0.08, { gain: 0.03 * vol, at: i * 0.12, to: f * 1.3 }); },
    crackle(vol) { noise(0.02 + Math.random() * 0.04, { type: "highpass", f: 1400 + Math.random() * 2400, gain: 0.08 * vol }); },
    kettle() { noise(3.6, { f: 450, q: 0.7, gain: 0.06, attack: 2.2, sweep: 1500 }); tone(1760, 1.4, { gain: 0.025, attack: 0.5, at: 2.4 }); tone(2090, 1.2, { gain: 0.012, attack: 0.5, at: 2.5 }); },
    pour() { noise(1.5, { f: 900, q: 2, gain: 0.06, attack: 0.15, sweep: 500, at: 3.6 }); },
    woof() { tone(320, 0.15, { type: "sawtooth", gain: 0.05, to: 170, lp: 900 }); tone(300, 0.14, { type: "sawtooth", gain: 0.04, to: 160, lp: 900, at: 0.22 }); },
    door() { noise(0.2, { type: "lowpass", f: 280, gain: 0.25 }); tone(85, 0.22, { gain: 0.08, to: 55 }); },
    kibble() { for (let i = 0; i < 9; i++) noise(0.03, { type: "highpass", f: 3200, gain: 0.05, at: i * 0.05 + Math.random() * 0.03 }); },
    water() { noise(1.1, { f: 1700, q: 3, gain: 0.04, attack: 0.1 }); },
    page() { noise(0.25, { f: 2600, q: 0.8, gain: 0.04, attack: 0.05, sweep: 1200 }); },
    chime() { tone(784, 0.7, { gain: 0.04 }); tone(1175, 0.9, { gain: 0.025, at: 0.09 }); },
    quack() { tone(560, 0.12, { type: "square", gain: 0.02, to: 420, lp: 1500 }); },
  };
})();

/* ======================================================================
   The background: floors, walls, rugs, the garden. Drawn once.
   ====================================================================== */
const bg = canvas(WORLD_W, WORLD_H)[0];
function drawBackground() {
  const g = bg.getContext("2d");
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) drawTile(g, tx, ty, tileAt(tx, ty));
  // soft shadows where floors meet walls
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const c = tileAt(tx, ty); if (!".kw".includes(c)) continue;
    const X = tx * T, Y = ty * T;
    if ("BSKL#".includes(tileAt(tx, ty - 1))) for (let i = 0; i < 4; i++) px(g, X, Y + i, T, 1, `rgba(40,20,30,${0.2 - i * 0.05})`);
    if (tileAt(tx - 1, ty) === "#") for (let i = 0; i < 3; i++) px(g, X + i, Y, 1, T, `rgba(40,20,30,${0.16 - i * 0.05})`);
    if (tileAt(tx + 1, ty) === "#") for (let i = 0; i < 3; i++) px(g, X + T - 1 - i, Y, 1, T, `rgba(40,20,30,${0.12 - i * 0.04})`);
  }
  // rugs
  rug(g, 4 * T + 4, 5 * T + 2, 5 * T - 8, 3 * T - 6, "#b9705a", "#e3c39a", "#8a4a3c");      // bedroom
  rug(g, 20 * T + 4, 5 * T + 4, 8 * T - 8, 3 * T - 10, "#3f6f7a", "#d9c7a0", "#2e5560");    // study
  rug(g, 23 * T, 13 * T + 2, 6 * T, 2 * T - 4, "#8a4e5e", "#e6c7a0", "#6a3a48");           // by the fire
  // the dog's bed
  const dbx = 29 * T + 1, dby = 13 * T + 2;
  ob(g, dbx, dby, 30, 13, "#7a5a8c", "#9a7aac", "#5a4269"); px(g, dbx + 3, dby + 3, 24, 7, "#e8dcc6"); px(g, dbx + 3, dby + 9, 24, 1, "#cbbda4");
  // a doormat inside and out
  ob(g, 22 * T + 2, 17 * T + 4, 28, 10, "#8a4a3c", "#a65d4b"); px(g, 22 * T + 5, 17 * T + 7, 22, 1, "#c27a5e"); px(g, 22 * T + 5, 17 * T + 10, 22, 1, "#c27a5e");
  // wall pictures, the corkboard, kitchen cabinets
  picture(g, 1 * T + 6, 19, 18, 14, "#d8b36a", (q, x, y) => { px(q, x, y, 14, 10, "#9fc0d8"); px(q, x, y + 6, 14, 4, "#6f9a52"); blob(q, x + 10, y + 3, 2, "#f6e3a6"); });
  corkboard(g, 20 * T + 2, 18, 28, 20);
  picture(g, 22 * T + 2, 164, 26, 17, "#8f5a3c", (q, x, y) => { px(q, x, y, 22, 13, "#e8c69a"); px(q, x, y + 7, 22, 6, "#c27a5e"); px(q, x + 4, y + 4, 8, 3, "#8a4e5e"); blob(q, x + 17, y + 3, 2, "#fbf4e6"); });
  ob(g, 6 * T, 160, 3 * T, 14, CAB.m, CAB.l, CAB.d);
  for (let i = 1; i < 3; i++) px(g, 6 * T + i * T, 161, 1, 12, CAB.d);
  for (let i = 0; i < 3; i++) px(g, 6 * T + i * T + 7, 168, 2, 1, "#d8b36a");
  // the stairs and frame of the front door
  px(g, 21 * T + 12, 18 * T, 4, 2 * T, "#5a4756"); px(g, 24 * T, 18 * T, 4, 2 * T, "#5a4756");
  px(g, 22 * T, 18 * T, 2 * T, 2, OL);
  // flowerbeds along the front of the house
  bed(g, 1, 20, 17); bed(g, 27, 20, 4);
  setSolid(1, 20, 17, 1); setSolid(27, 20, 4, 1);
  // the pond
  pond(g);
  setSolid(5, 25, 4, 2);
  // outside windows and the porch lamp
  for (const c of [4, 9, 15, 27]) { ob(g, c * T + 2, 19 * T + 2, 26, 11, "#efe6d6"); px(g, c * T + 15, 19 * T + 3, 1, 9, "#efe6d6"); }
  ob(g, 24 * T + 6, 19 * T + 2, 5, 7, "#3b3a40"); px(g, 24 * T + 7, 19 * T + 4, 3, 3, "#f6e3a6");
}

function drawTile(g, tx, ty, c) {
  const X = tx * T, Y = ty * T;
  const below = tileAt(tx, ty + 1), above = tileAt(tx, ty - 1);
  switch (c) {
    case "#": {
      px(g, X, Y, T, T, "#3d3040");
      if (!"#".includes(below) && below !== "D") px(g, X, Y + T - 3, T, 3, "#5b4a5c");
      if (below === "D" || "BSKLE".includes(below)) px(g, X, Y + T - 3, T, 3, "#5b4a5c");
      if ((hash(tx, ty) * 5 | 0) === 0) px(g, X + 3 + (hash(ty, tx) * 9 | 0), Y + 4, 2, 1, "#47394a");
      break;
    }
    case "B": case "S": case "K": case "L": case "E": wallFace(g, X, Y, c, above, below, tx); break;
    case ".": woodFloor(g, X, Y, tx, ty); break;
    case "k": {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) px(g, X + i * 8, Y + j * 8, 8, 8, (i + j + tx + ty) % 2 ? "#d6ccb6" : "#e8e0cd");
      px(g, X, Y + T - 1, T, 1, "rgba(120,100,80,.15)");
      break;
    }
    case "D": {
      woodFloor(g, X, Y, tx, ty);
      px(g, X, Y, T, T, "rgba(40,20,20,.25)");
      if (ty === 19) { // the open door, swung against the frame
        px(g, X, Y, T, T, "#9c8366");
        for (let i = 0; i < 4; i++) px(g, X, Y + i * 4 + 3, T, 1, "#86704f");
      }
      break;
    }
    case "w": {
      px(g, X, Y, T, T, "#9c8366");
      for (let i = 0; i < 4; i++) px(g, X, Y + i * 4 + 3, T, 1, "#86704f");
      if ((tx + ty) % 3 === 0) px(g, X + 8, Y, 1, T, "#86704f");
      px(g, X, Y + T - 1, T, 1, tileAt(tx, ty + 1) === "w" ? "#86704f" : "#6e5a40");
      break;
    }
    case "g": grass(g, X, Y, tx, ty); break;
    case "p": {
      grass(g, X, Y, tx, ty);
      const o = (ty % 2) * 4;
      blob(g, X + 5 + o, Y + 5, 4, "#8d8478"); blob(g, X + 5 + o, Y + 4, 4, "#b8ab95");
      blob(g, X + 12 - o, Y + 12, 3, "#8d8478"); blob(g, X + 12 - o, Y + 11, 3, "#b8ab95");
      break;
    }
    case "r": {
      px(g, X, Y, T, T, "#bfae8e");
      for (let i = 0; i < 5; i++) {
        const a = hash(tx * 7 + i, ty * 13), b = hash(ty * 5 + i, tx * 11);
        const sx = X + (a * 14 | 0), sy = Y + (b * 14 | 0);
        px(g, sx, sy, 3, 2, "#a9987a"); px(g, sx, sy, 2, 1, "#cfc0a2");
      }
      if (ty === 23) px(g, X, Y, T, 2, "#a9987a");
      if (ty === 24) px(g, X, Y + T - 2, T, 2, "#a9987a");
      break;
    }
    case "h": {
      grass(g, X, Y, tx, ty);
      blob(g, X + 8, Y + 9, 9, "#3f6b3a"); blob(g, X + 8, Y + 7, 8, "#4f7d43");
      blob(g, X + 5, Y + 4, 3, "#5f9150"); blob(g, X + 12, Y + 5, 2, "#5f9150");
      break;
    }
  }
}
function woodFloor(g, X, Y, tx, ty) {
  for (let r = 0; r < 4; r++) {
    const row = ty * 4 + r, y = Y + r * 4, off = (hash(row, 3) * 32) | 0;
    let x = X;
    while (x < X + T) {
      const seg = Math.floor((x + off) / 32), end = Math.min(X + T, (seg + 1) * 32 - off);
      px(g, x, y, end - x, 4, FLOOR[(hash(seg, row) * FLOOR.length) | 0]);
      px(g, x, y + 3, end - x, 1, "rgba(70,35,20,.35)");
      if ((x + off) % 32 === 0) px(g, x, y, 1, 3, "rgba(70,35,20,.35)");
      x = end;
    }
    if (hash(tx * 3 + r, ty * 5) < 0.25) px(g, X + (hash(ty, tx + r) * 12 | 0), y + 1, 3, 1, "rgba(255,220,180,.12)");
  }
}
function grass(g, X, Y, tx, ty) {
  px(g, X, Y, T, T, "#78a257");
  for (let i = 0; i < 7; i++) {
    const a = hash(tx * 31 + i, ty * 17), b = hash(ty * 29 + i, tx * 19);
    px(g, X + (a * 15 | 0), Y + (b * 14 | 0), 1, 2, i % 2 ? "#689449" : "#8db766");
  }
  if (hash(tx, ty * 3) < 0.12) { const a = hash(tx * 3, ty); px(g, X + 3 + (a * 9 | 0), Y + 5 + (a * 7 | 0), 2, 2, pick2(tx, ty, ["#c98f3c", "#b4583c", "#d9a441"])); }
}
const pick2 = (a, b, arr) => arr[(hash(a * 7, b * 3) * arr.length) | 0];
function wallFace(g, X, Y, c, above, below, tx) {
  const upper = above === "#", lower = !upper;
  const base = { B: "#93a6b9", S: "#7d9a80", K: "#eadcbc", L: "#c99878", E: "#d8cdb5" }[c];
  px(g, X, Y, T, T, base);
  if (c === "B") for (let i = 2; i < T; i += 6) px(g, X + i, Y, 1, T, "#889cb0");
  if (c === "S") for (let j = 3; j < T; j += 6) for (let i = (j % 4); i < T; i += 6) px(g, X + i, Y + j, 1, 1, "#6f8d73");
  if (c === "L" && upper) for (let j = 4; j < T; j += 8) for (let i = (j % 16 === 4 ? 2 : 6); i < T; i += 8) { px(g, X + i, Y + j, 2, 1, "#bb8a6b"); px(g, X + i, Y + j + 1, 1, 1, "#bb8a6b"); }
  if (c === "E") { for (let j = 3; j < T; j += 4) px(g, X, Y + j, T, 1, "#c4b89e"); px(g, X, Y + T - 3, T, 3, "#8d8478"); return; }
  if (upper) { px(g, X, Y, T, 2, "#efe6d6"); px(g, X, Y + 2, T, 1, "rgba(0,0,0,.12)"); }
  if (lower) {
    if (c === "K") { // a tiled backsplash
      for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { const o = j % 2 ? 4 : 0; ob(g, X + i * 8 - o, Y + 3 + j * 4, 9, 5, "#f3eee3"); }
      px(g, X, Y + 3, T, 1, "#d8cfbd");
    } else if (c === "S" || c === "L") {
      const p = c === "S" ? ["#5f7a64", "#6d8a72", "#4d6652"] : ["#8f5f48", "#a06d54", "#774c3a"];
      px(g, X, Y + 4, T, 12, p[0]); px(g, X, Y + 4, T, 1, p[1]); px(g, X, Y + 3, T, 1, p[2]);
      ob(g, X + 2, Y + 6, 12, 7, p[0], p[2], p[1]);
    }
    if (below !== "#") { px(g, X, Y + T - 3, T, 3, "#efe6d6"); px(g, X, Y + T - 3, T, 1, "#cfc2ac"); }
  }
  if (tileAt(tx - 1, Math.floor(Y / T)) === "#") px(g, X, Y, 2, T, "rgba(40,20,30,.18)");
  if (tileAt(tx + 1, Math.floor(Y / T)) === "#") px(g, X + T - 2, Y, 2, T, "rgba(40,20,30,.14)");
}
function rug(g, x, y, w, h, base, border, dark) {
  ob(g, x, y, w, h, border); px(g, x + 3, y + 3, w - 6, h - 6, base);
  px(g, x + 5, y + 5, w - 10, 1, border); px(g, x + 5, y + h - 6, w - 10, 1, border);
  px(g, x + 5, y + 5, 1, h - 10, border); px(g, x + w - 6, y + 5, 1, h - 10, border);
  for (let i = x + 10; i < x + w - 10; i += 8) { px(g, i, y + Math.floor(h / 2) - 1, 3, 3, dark); px(g, i + 1, y + Math.floor(h / 2), 1, 1, border); }
  for (let i = x + 2; i < x + w - 2; i += 3) { px(g, i, y - 1, 1, 1, border); px(g, i, y + h, 1, 1, border); }
}
function picture(g, x, y, w, h, frame, inner) { ob(g, x, y, w, h, frame); inner(g, x + 2, y + 2); px(g, x, y + h, w, 1, "rgba(0,0,0,.15)"); }
function corkboard(g, x, y, w, h) {
  ob(g, x, y, w, h, "#b98c5a", "#c99c68", "#a07848");
  const cards = [[3, 3, 8, 6, "#f5ecd8"], [13, 2, 9, 6, "#f2d27a"], [5, 11, 9, 6, "#cfe2e6"], [16, 10, 8, 7, "#f5ecd8"]];
  for (const [a, b, cw, ch, c] of cards) { px(g, x + a, y + b, cw, ch, c); px(g, x + a + 1, y + b + 2, cw - 2, 1, "#9a8f80"); px(g, x + a + 1, y + b + 4, cw - 3, 1, "#9a8f80"); px(g, x + a + 3, y + b, 1, 1, "#b4483c"); }
  px(g, x + 9, y + 9, 8, 1, "#b4483c");
}
function bed(g, x0, y, n) {
  for (let i = 0; i < n; i++) {
    const X = (x0 + i) * T, Y = y * T;
    px(g, X, Y + 2, T, 13, "#6d4c38"); px(g, X, Y + 2, T, 1, "#86604a"); px(g, X, Y + 14, T, 2, "#8d8478");
    for (let k = 0; k < 3; k++) {
      const a = hash(x0 + i, k * 9), fx = X + 2 + (a * 11 | 0), fy = Y + 4 + (hash(k, x0 + i) * 6 | 0);
      blob(g, fx + 1, fy + 3, 2, "#4f7d43");
      const col = ["#d9a441", "#b4583c", "#8a6aa8", "#e8c66a"][(a * 4) | 0];
      blob(g, fx + 1, fy + 1, 1, col); px(g, fx + 1, fy + 1, 1, 1, "#fbe7bd");
    }
  }
}
function pond(g) {
  const X = 5 * T, Y = 25 * T, w = 4 * T, h = 2 * T;
  for (let i = 0; i < w; i += 3) { blob(g, X + i + 1, Y + 2, 2, "#8d8478"); blob(g, X + i + 1, Y + h - 2, 2, "#8d8478"); }
  for (let j = 0; j < h; j += 3) { blob(g, X + 1, Y + j + 1, 2, "#8d8478"); blob(g, X + w - 2, Y + j + 1, 2, "#8d8478"); }
  px(g, X + 3, Y + 3, w - 6, h - 6, "#4f8a9c"); px(g, X + 4, Y + 4, w - 8, 3, "#3f7486");
  blob(g, X + 10, Y + 20, 3, "#5f9150"); px(g, X + 9, Y + 19, 2, 1, "#f3d0dc"); // a lily pad
  blob(g, X + 50, Y + 9, 2, "#5f9150");
  for (const [rx, ry] of [[X + 2, Y + 6], [X + 60, Y + 24], [X + 3, Y + 26]]) { px(g, rx, ry - 6, 1, 7, "#5d7a3e"); px(g, rx + 2, ry - 8, 1, 9, "#6b8a46"); px(g, rx + 2, ry - 10, 1, 3, "#7a5232"); }
}

/* ======================================================================
   Furniture and things. Each is drawn once into its own little canvas,
   then sorted with the people and the dog by where it touches the floor.
   ====================================================================== */
const OBJS = [];
function thing(o) {
  o.padX = o.padX || 0; o.w = o.w || 1; o.h = o.h || 1; o.tall = o.tall || 0;
  if (o.solid !== false) setSolid(o.x, o.y, o.w, o.h);
  o.sortY = o.sortY || (o.y + o.h) * T;
  OBJS.push(o); return o;
}
function cache(o) {
  const k = o.key ? o.key() : 0;
  if (o.cache && o.cacheKey === k) return o.cache;
  const [c, g] = canvas(o.w * T + o.padX * 2, o.h * T + o.tall);
  o.art(g, k); o.cache = c; o.cacheKey = k; return c;
}
function plantArt(g, cx, by, pot, leaves) {
  const spots = [[0, -14, 5], [-5, -10, 4], [5, -11, 4], [-3, -19, 4], [4, -18, 4], [0, -24, 4], [-6, -16, 3], [6, -23, 3], [-4, -27, 3], [3, -30, 3], [-7, -22, 3], [7, -28, 3]];
  for (let i = 0; i < Math.min(leaves, spots.length); i++) { const [x, y, r] = spots[i]; px(g, cx, by - 9, 1, Math.max(0, -y - 8), "#3f6b3a"); blob(g, cx + x, by + y, r + 1, OL); }
  for (let i = 0; i < Math.min(leaves, spots.length); i++) { const [x, y, r] = spots[i]; blob(g, cx + x, by + y, r, i % 3 ? "#5f9150" : "#4f7d43"); px(g, cx + x - 1, by + y - r + 1, 2, 1, "#86b866"); }
  ob(g, cx - 6, by - 10, 12, 3, pot[2], pot[1]); ob(g, cx - 5, by - 8, 10, 8, pot[0], pot[1], pot[2]);
}
const POT = { terra: ["#c27a5e", "#d9967a", "#9a5a44"], cream: ["#e3d8c2", "#f3ead8", "#c2b59b"], teal: ["#3f7c7a", "#5a9a96", "#2e5d5f"] };
function chairArt(g) {
  ob(g, 2, 0, 12, 4, WOOD.m, WOOD.l);
  ob(g, 2, 0, 3, 18, WOOD.d); ob(g, 11, 0, 3, 18, WOOD.d);
  px(g, 6, 4, 1, 9, WOOD.m); px(g, 9, 4, 1, 9, WOOD.m);
  ob(g, 1, 12, 14, 5, WOOD.l, WOOD.h, WOOD.m);
  ob(g, 2, 16, 3, 7, WOOD.d); ob(g, 11, 16, 3, 7, WOOD.d);
}
function lampArt(g, w) {
  const c = Math.floor(w / 2);
  ob(g, c - 4, 33, 8, 4, "#3b3a40"); px(g, c - 1, 7, 2, 27, "#3b3a40"); px(g, c, 7, 1, 27, "#5f6673");
  ob(g, c - 7, 0, 14, 9, "#efd49a", "#fbe7bd", "#d6b371");
}
function treeArt(g, k, kind) {
  const W = 36, cx = 18;
  for (let i = 0; i < 4; i++) px(g, cx - 12 + i * 2, 48 + i, 24 - i * 4, 1, `rgba(30,40,20,${0.22})`);
  ob(g, cx - 3, 30, 7, 20, "#6e4a34", "#8a5d42", "#5a3a28");
  px(g, cx - 6, 47, 3, 2, "#6e4a34"); px(g, cx + 4, 47, 3, 2, "#6e4a34");
  const pal = [["#3f6b3a", "#558a47", "#73a85a"], ["#a5722c", "#c98f3c", "#e8b860"], ["#8a3f2c", "#b4583c", "#d9824f"]][kind];
  const blobs = [[0, 18, 13], [-8, 22, 8], [8, 21, 9], [-4, 10, 9], [6, 11, 8]];
  for (const [x, y, r] of blobs) blob(g, cx + x, y, r + 1, OL);
  for (const [x, y, r] of blobs) blob(g, cx + x, y, r, pal[0]);
  for (const [x, y, r] of blobs) blob(g, cx + x - 1, y - 2, r - 2, pal[1]);
  for (const [x, y, r] of blobs) blob(g, cx + x - 3, y - 4, Math.max(1, r - 6), pal[2]);
  void W; void k;
}

// ---- bedroom ----
thing({ id: "bed", x: 1, y: 3, w: 2, h: 3, tall: 6, art(g) {
  ob(g, 0, 0, 32, 14, WOOD.m, WOOD.l, WOOD.d); px(g, 4, 4, 24, 1, WOOD.d);
  ob(g, 0, 10, 32, 44, WOOD.d);
  px(g, 2, 12, 28, 40, "#efe6d6");
  ob(g, 5, 13, 22, 9, "#faf6ee", null, "#e0d6c6"); px(g, 16, 14, 1, 7, "#e8e0d2");
  ob(g, 1, 25, 30, 27, "#c4664f", "#e0896f", "#9b4636");
  px(g, 2, 26, 28, 3, "#efe6d6"); px(g, 2, 29, 28, 1, "#d6cab6");
  for (let yy = 34; yy < 50; yy += 6) px(g, 2, yy, 28, 1, "#a9523f");
  for (let xx = 9; xx < 30; xx += 8) px(g, xx, 30, 1, 20, "#a9523f");
  for (let yy = 31; yy < 50; yy += 6) for (let xx = 4; xx < 30; xx += 8) px(g, xx + 1, yy + 1, 2, 2, "#e0896f");
  ob(g, 0, 50, 32, 4, WOOD.d);
} });
thing({ id: "nightstand", x: 3, y: 3, tall: 12, art(g) {
  ob(g, 1, 12, 14, 16, WOOD.m, WOOD.l, WOOD.d); px(g, 2, 19, 12, 1, WOOD.d); px(g, 7, 22, 2, 1, "#e0c080");
  ob(g, 6, 8, 4, 6, "#8e96a3"); ob(g, 3, 1, 10, 8, "#efd49a", "#fbe7bd", "#d6b371");
  ob(g, 1, 10, 5, 3, "#5a6f9a");
} });
thing({ id: "wardrobe", x: 9, y: 3, w: 2, tall: 26, art(g) {
  ob(g, 0, 2, 32, 40, WOOD.m, WOOD.l, WOOD.d); ob(g, 0, 0, 32, 5, WOOD.d, WOOD.m);
  px(g, 15, 6, 2, 32, WOOD.d);
  for (const x of [3, 18]) { px(g, x, 8, 11, 1, WOOD.d); px(g, x, 8, 1, 28, WOOD.d); px(g, x, 36, 11, 1, WOOD.h); px(g, x + 10, 8, 1, 29, WOOD.h); }
  px(g, 13, 21, 1, 3, "#e0c080"); px(g, 18, 21, 1, 3, "#e0c080");
  px(g, 2, 40, 3, 2, OL); px(g, 27, 40, 3, 2, OL);
} });
thing({ id: "bedplant", x: 12, y: 3, tall: 14, art(g) { plantArt(g, 8, 30, POT.cream, 6); } });

// ---- study ----
thing({ id: "shelves", x: 14, y: 3, w: 4, tall: 28, art(g) {
  ob(g, 0, 0, 64, 44, WOOD.d, WOOD.m); px(g, 3, 3, 58, 39, "#40291f");
  const r = rng(57), BOOK = ["#b4483c", "#3f7c7a", "#d9a441", "#6a5a8c", "#e3d8c2", "#4e6b46", "#2f4f78", "#c27a5e", "#8a4e5e"];
  for (let s = 0; s < 4; s++) {
    const base = 12 + s * 10;
    px(g, 2, base, 60, 2, WOOD.m); px(g, 2, base, 60, 1, WOOD.h);
    let x = 4;
    while (x < 58) {
      const roll = r();
      if (roll < 0.06 && x < 50) { // a little plant
        blob(g, x + 3, base - 6, 3, "#5f9150"); ob(g, x + 1, base - 4, 5, 4, "#c27a5e"); x += 8; continue;
      }
      if (roll < 0.12) { x += 3; continue; }
      if (roll < 0.17 && x < 52) { const bw = 6 + (r() * 3 | 0); ob(g, x, base - 4, bw, 4, pick2(s, x, BOOK)); ob(g, x + 1, base - 7, bw - 1, 3, pick2(x, s + 4, BOOK)); x += bw + 1; continue; }
      const bw = 2 + (r() * 3 | 0), bh = 6 + (r() * 3 | 0), col = BOOK[(r() * BOOK.length) | 0];
      px(g, x, base - bh, bw, bh, col); px(g, x, base - bh, 1, bh, "rgba(255,255,255,.15)");
      if (bw > 2) px(g, x + 1, base - bh + 2, bw - 2, 1, "rgba(255,240,200,.45)");
      x += bw;
    }
  }
} });
thing({ id: "desk", x: 23, y: 3, w: 4, tall: 14, art(g) {
  ob(g, 0, 10, 64, 7, WOOD.l, WOOD.h, WOOD.m);
  ob(g, 1, 16, 62, 12, WOOD.m, null, WOOD.d);
  ob(g, 3, 17, 18, 9, WOOD.l, WOOD.h); px(g, 11, 21, 3, 1, "#e0c080");
  ob(g, 43, 17, 18, 9, WOOD.l, WOOD.h); px(g, 51, 21, 3, 1, "#e0c080");
  px(g, 22, 17, 20, 11, "#3a2620");
  ob(g, 2, 27, 4, 3, WOOD.d); ob(g, 58, 27, 4, 3, WOOD.d);
  // papers, pencils, the laptop, the lamp
  ob(g, 4, 8, 13, 5, "#f5ecd8"); px(g, 6, 9, 9, 1, "#cfc2ac"); px(g, 5, 7, 12, 1, "#e9dfcc");
  ob(g, 18, 5, 4, 7, "#3f7c7a"); px(g, 19, 2, 1, 4, "#d9a441"); px(g, 20, 3, 1, 3, "#b4483c");
  ob(g, 26, 0, 17, 11, "#2f3442"); px(g, 28, 2, 13, 7, "#46506a");
  ob(g, 24, 10, 21, 3, "#b9bec7", "#d5d9df");
  ob(g, 54, 9, 7, 3, "#2e5d5f"); px(g, 57, 3, 1, 7, "#2e5d5f"); px(g, 52, 3, 6, 1, "#2e5d5f"); ob(g, 47, 1, 8, 5, "#3f7c7a", "#5a9a96");
} });
const deskChair = thing({ id: "chair", x: 24, y: 4, tall: 8, sortY: 5 * T + 1, art: chairArt });
thing({ id: "studyplant", x: 30, y: 3, tall: 22, key: () => S.plantLeaves, art(g, leaves) { plantArt(g, 8, 37, POT.terra, leaves); } });
thing({ id: "armchair", x: 15, y: 7, tall: 10, art(g) {
  ob(g, 1, 0, 14, 13, "#3f7c7a", "#5a9a96"); px(g, 4, 3, 8, 1, "#2e5d5f");
  ob(g, 0, 8, 4, 17, "#2e5d5f", "#3f7c7a"); ob(g, 12, 8, 4, 17, "#2e5d5f", "#3f7c7a");
  ob(g, 3, 12, 10, 8, "#5a9a96", "#79b5b0"); ob(g, 3, 19, 10, 6, "#3f7c7a", null, "#2e5d5f");
  px(g, 1, 24, 2, 2, OL); px(g, 13, 24, 2, 2, OL);
  ob(g, 8, 4, 6, 5, "#e3d8c2"); // a cushion
} });
thing({ id: "readlamp", x: 14, y: 7, tall: 22, art(g) { lampArt(g, 16); } });
thing({ id: "record", x: 29, y: 7, w: 2, tall: 8, art(g) {
  ob(g, 0, 7, 32, 17, WOOD.m, WOOD.l, WOOD.d);
  px(g, 3, 11, 26, 10, "#40291f");
  const sleeves = ["#d9a441", "#3f7c7a", "#b4483c", "#e3d8c2", "#6a5a8c", "#2f4f78", "#c27a5e"];
  for (let i = 0; i < 12; i++) px(g, 4 + i * 2, 12, 2, 9, sleeves[i % sleeves.length]);
  ob(g, 2, 0, 22, 9, "#3b3036", "#55474f"); ob(g, 24, 1, 6, 8, "#5a4a3f"); blob(g, 27, 4, 1, "#2a1e25");
} });

// ---- kitchen ----
thing({ id: "fridge", x: 1, y: 12, tall: 22, art(g) {
  ob(g, 0, 0, 16, 38, "#dfe5e6", "#f4f7f7", "#b9c2c4"); px(g, 1, 13, 14, 1, "#a9b3b6");
  px(g, 12, 4, 1, 7, "#8e96a3"); px(g, 12, 17, 1, 9, "#8e96a3");
  px(g, 3, 16, 5, 6, "#f5ecd8"); px(g, 4, 18, 3, 1, "#9a8f80"); px(g, 5, 15, 2, 2, "#b4483c");
  px(g, 8, 22, 3, 3, "#f2d27a"); px(g, 3, 5, 3, 3, "#3f7c7a");
} });
thing({ id: "counter", x: 2, y: 12, w: 7, tall: 14, art(g) {
  ob(g, 0, 14, 112, 16, CAB.m, null, CAB.d);
  for (let i = 0; i < 7; i++) { if (i === 3) continue; ob(g, i * 16 + 2, 16, 12, 12, CAB.m, CAB.l, CAB.d); px(g, i * 16 + 7, 19, 2, 1, "#d8b36a"); }
  ob(g, 48, 15, 16, 14, "#3b3a40", "#55545c"); px(g, 51, 19, 10, 6, "#24232a"); px(g, 51, 17, 10, 1, "#8e96a3");
  ob(g, 0, 6, 112, 9, "#d9d2c3", "#ece6da", "#b9b0a0");
  // knife block, the sink, the stove top, the coffee things, the fruit
  ob(g, 3, 1, 6, 7, WOOD.m, WOOD.l); px(g, 4, 0, 1, 2, "#8e96a3"); px(g, 6, 0, 1, 2, "#8e96a3");
  ob(g, 10, 4, 5, 4, "#c49a62"); // bread
  ob(g, 17, 7, 14, 6, "#8e96a3"); px(g, 18, 8, 12, 4, "#6d7480"); px(g, 23, 2, 2, 6, "#8e96a3"); px(g, 23, 2, 5, 2, "#8e96a3");
  px(g, 50, 8, 5, 2, "#2a2a2e"); px(g, 57, 8, 5, 2, "#2a2a2e"); px(g, 50, 11, 5, 2, "#2a2a2e"); px(g, 57, 11, 5, 2, "#2a2a2e");
  ob(g, 81, 1, 6, 9, WOOD.m, WOOD.l); px(g, 82, 0, 4, 2, "#3b3a40");
  ob(g, 88, 3, 8, 8, "#cfe2e6", "#eef6f7"); px(g, 89, 8, 6, 2, "#6e4330"); ob(g, 87, 0, 10, 4, "#efe6d6");
  ob(g, 98, 7, 8, 5, "#efe6d6"); // a mug, waiting
  ob(g, 99, 1, 11, 6, "#e9e2d3"); blob(g, 102, 2, 2, "#d9a441"); blob(g, 106, 2, 2, "#b4483c"); blob(g, 104, 0, 1, "#8db766");
} });
thing({ id: "table", x: 4, y: 15, w: 3, tall: 8, art(g) {
  ob(g, 0, 2, 48, 12, WOOD.l, WOOD.h, WOOD.m); ob(g, 0, 12, 48, 4, WOOD.m, null, WOOD.d);
  ob(g, 2, 15, 4, 9, WOOD.d); ob(g, 42, 15, 4, 9, WOOD.d);
  ob(g, 8, 4, 14, 8, "#efe6d6"); px(g, 9, 5, 12, 1, "#cfc2ac");
  ob(g, 32, 0, 5, 8, "#cfe2e6"); px(g, 34, -2, 1, 3, "#5f9150"); blob(g, 34, 1, 1, "#d9a441");
} });
thing({ id: "chairA", x: 4, y: 16, tall: 8, art: chairArt });
thing({ id: "chairB", x: 6, y: 16, tall: 8, art: chairArt });
thing({ id: "bowls", x: 11, y: 17, tall: 0, art(g) {
  ob(g, 1, 7, 7, 5, "#c4664f", "#e0896f"); ob(g, 8, 7, 7, 5, "#3f7c7a", "#5a9a96"); px(g, 9, 8, 5, 1, "#8fc0e6");
} });

// ---- living room ----
thing({ id: "livplant", x: 13, y: 12, tall: 14, art(g) { plantArt(g, 8, 30, POT.teal, 8); } });
thing({ id: "livlamp", x: 21, y: 12, tall: 22, art(g) { lampArt(g, 16); } });
thing({ id: "fireplace", x: 25, y: 12, w: 3, tall: 22, art(g) {
  ob(g, 2, 0, 44, 24, "#9d5a46");
  for (let j = 2; j < 22; j += 4) for (let i = 3 + ((j / 4) % 2) * 4; i < 44; i += 8) px(g, i, j, 1, 3, "#86493a");
  for (let j = 5; j < 24; j += 4) px(g, 3, j, 42, 1, "#86493a");
  ob(g, 4, 18, 40, 20, "#c9bfb0", "#ddd5c8", "#a89d8c");
  ob(g, 12, 22, 24, 14, "#231a1e"); px(g, 13, 23, 22, 2, "#3a2a2a");
  ob(g, 0, 14, 48, 5, WOOD.m, WOOD.l, WOOD.d);
  ob(g, 1, 35, 46, 4, "#8d8478", "#a39a8d");
  ob(g, 6, 8, 7, 7, WOOD.d); blob(g, 9, 11, 2, "#f5ecd8"); px(g, 9, 10, 1, 2, OL);
  ob(g, 21, 7, 8, 8, "#d8b36a"); px(g, 23, 9, 4, 4, "#7a9cb8");
  ob(g, 35, 8, 3, 7, "#f3ecd9"); ob(g, 39, 10, 3, 5, "#f3ecd9");
  px(g, 16, 32, 16, 3, "#5a3a28"); px(g, 18, 30, 12, 2, "#6e4a34");
} });
const fireplace = OBJS[OBJS.length - 1];
thing({ id: "sofa", x: 24, y: 15, w: 4, tall: 8, art(g) {
  ob(g, 6, 2, 27, 9, SOFA.l, "#ecc177"); ob(g, 31, 2, 27, 9, SOFA.l, "#ecc177");
  ob(g, 0, 0, 7, 22, SOFA.d, SOFA.m); ob(g, 57, 0, 7, 22, SOFA.d, SOFA.m);
  ob(g, 5, 9, 54, 14, SOFA.m, SOFA.l, SOFA.d);
  ob(g, 40, 7, 12, 16, "#e8e0cf", "#f6f0e2"); for (let j = 10; j < 22; j += 4) px(g, 41, j, 10, 1, "#b4483c");
  ob(g, 10, 3, 8, 6, "#3f7c7a");
  px(g, 2, 22, 3, 2, OL); px(g, 59, 22, 3, 2, OL);
} });
thing({ id: "coatrack", x: 21, y: 17, tall: 20, art(g) {
  ob(g, 3, 32, 10, 4, WOOD.d); px(g, 7, 3, 2, 30, WOOD.d); px(g, 8, 3, 1, 30, WOOD.m);
  px(g, 3, 4, 10, 2, WOOD.d);
  ob(g, 0, 5, 8, 16, "#7a6a58", "#968470", "#5f5244"); px(g, 3, 6, 2, 10, "#5f5244");
  ob(g, 9, 7, 4, 14, "#b4483c", "#d0655a");
  ob(g, 2, 0, 12, 5, "#4e6b46", "#6a8a60"); // a hat
} });

// ---- outside ----
for (const [x, y, kind] of [[1, 21, 0], [8, 21, 1], [13, 22, 2], [29, 21, 1], [12, 26, 0], [19, 25, 2], [27, 26, 1], [31, 25, 0], [15, 26, 2]]) {
  thing({ id: "tree", x, y, tall: 36, padX: 10, art(g) { treeArt(g, 0, kind); } });
}
thing({ id: "bench", x: 1, y: 25, w: 2, tall: 8, art(g) {
  ob(g, 0, 0, 32, 4, WOOD.m, WOOD.l); ob(g, 0, 4, 32, 3, WOOD.m, WOOD.l);
  ob(g, 0, 9, 32, 4, WOOD.l, WOOD.h); ob(g, 0, 12, 32, 3, WOOD.m);
  ob(g, 2, 0, 3, 23, "#3b3a40"); ob(g, 27, 0, 3, 23, "#3b3a40");
} });
thing({ id: "mailbox", x: 25, y: 22, tall: 10, art(g) {
  px(g, 7, 9, 2, 17, WOOD.d); ob(g, 2, 2, 12, 8, "#3f6f8f", "#5a8aaa", "#2f5570"); px(g, 4, 5, 8, 1, "#2f5570");
} });
const mailbox = OBJS[OBJS.length - 1];
thing({ id: "streetlamp", x: 17, y: 22, tall: 30, art(g) {
  ob(g, 4, 40, 8, 6, "#3b3a40"); px(g, 7, 7, 2, 34, "#3b3a40"); px(g, 7, 7, 1, 34, "#55545c");
  ob(g, 3, 0, 10, 9, "#3b3a40"); px(g, 5, 2, 6, 5, "#f6e3a6"); px(g, 2, 0, 12, 2, "#2a2a2e");
} });

// Light sources: [world x, world y, radius, warmth, which]
const LAMPS = [
  { x: 3 * T + 8, y: 3 * T - 6, r: 54, on: () => darkness > 0.18 },              // bedside
  { x: 23 * T + 51, y: 3 * T - 9, r: 70, on: () => darkness > 0.18 || sitting },  // desk
  { x: 14 * T + 8, y: 7 * T - 18, r: 60, on: () => darkness > 0.25 },             // reading lamp
  { x: 21 * T + 8, y: 12 * T - 18, r: 66, on: () => darkness > 0.2 },             // living room lamp
  { x: 5 * T, y: 11 * T, r: 60, on: () => darkness > 0.25 },                      // kitchen
  { x: 24 * T + 8, y: 19 * T + 6, r: 52, on: () => darkness > 0.25 },             // porch
  { x: 17 * T + 8, y: 22 * T - 25, r: 84, on: () => darkness > 0.3 },             // street lamp
];

/* ======================================================================
   Windows, drawn each frame so the sky moves
   ====================================================================== */
const WINDOWS = [
  { x: 82, y: 19, w: 44, h: 24, curtain: "#d9a38c" },
  { x: 386, y: 18, w: 44, h: 22, curtain: "#c98f3c" },
  { x: 49, y: 162, w: 30, h: 15, curtain: null },
  { x: 242, y: 162, w: 44, h: 22, curtain: "#7d9a80" },
];
const SKY = [ // minute, top, bottom
  [0, "#141a36", "#232b52"], [330, "#141a36", "#232b52"], [400, "#6f6a9a", "#f1b38c"], [470, "#8fb6dc", "#f4d9b8"],
  [560, "#86bce4", "#cfe6f2"], [960, "#8fc0e6", "#d8ecf2"], [1060, "#e0a060", "#f6d49a"], [1130, "#a0607a", "#f0a35e"],
  [1190, "#3d3866", "#c97f7f"], [1260, "#18203f", "#2c3560"], [1440, "#141a36", "#232b52"],
];
function keyLerp(table, m, cols) {
  let i = 0; while (i < table.length - 2 && table[i + 1][0] <= m) i++;
  const a = table[i], b = table[i + 1], t = clamp((m - a[0]) / (b[0] - a[0] || 1), 0, 1);
  return cols.map((c) => Array.isArray(a[c]) || typeof a[c] === "string" ? mix(hex(a[c]), hex(b[c]), t) : lerp(a[c], b[c], t));
}
function drawWindow(g, w, t) {
  const [top, bot] = keyLerp(SKY, S.minute, [1, 2]);
  const rain = S.weather === "rain";
  const grey = [142, 154, 168];
  const tc = rain ? mix(top, grey, 0.6) : top, bc = rain ? mix(bot, grey, 0.55) : bot;
  ob(g, w.x - 2, w.y - 2, w.w + 4, w.h + 4, "#efe6d6", "#fbf4e6", "#d6cab6");
  const gx = w.x, gy = w.y, gw = w.w, gh = w.h;
  for (let j = 0; j < gh; j++) { const c = mix(tc, bc, j / gh); px(g, gx, gy + j, gw, 1, rgb(c)); }
  const night = darkness > 0.45;
  if (night && !rain) { const r = rng(w.x); for (let i = 0; i < 8; i++) px(g, gx + (r() * gw | 0), gy + (r() * gh * 0.6 | 0), 1, 1, "#e8e4d0"); if (w.x === 82) { blob(g, gx + 32, gy + 6, 3, "#f3ecd0"); blob(g, gx + 33, gy + 5, 3, rgb(tc)); } }
  if (!night) { // drifting clouds
    const drift = (S.minute * 0.15 + w.x) % (gw + 30) - 15;
    const cc = rain ? "rgba(110,120,135,.7)" : "rgba(255,250,240,.75)";
    g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
    blob(g, gx + drift, gy + 6, 3, cc, 0.6); blob(g, gx + drift + 5, gy + 5, 4, cc, 0.6); blob(g, gx + drift + 10, gy + 7, 3, cc, 0.6);
    if (rain) { blob(g, gx + drift - 18, gy + 4, 5, cc, 0.6); blob(g, gx + drift + 24, gy + 3, 6, cc, 0.6); }
    g.restore();
  }
  // trees and rooftops across the lane
  const far = night ? "#1a2230" : rain ? "#5f6f68" : "#5d8a5a";
  for (let i = 0; i < gw; i += 6) blob(g, gx + i + 2, gy + gh - 2, 3 + ((i * 7 + w.x) % 3), far);
  px(g, gx + gw - 14, gy + gh - 7, 10, 7, night ? "#232a38" : "#9a7a6a");
  if (night) px(g, gx + gw - 11, gy + gh - 5, 2, 2, "#f2c66d");
  if (rain) { // drops running down the glass
    for (let i = 0; i < 6; i++) {
      const sx = gx + ((i * 13 + w.x) % gw), sy = gy + ((t * 0.03 * (1 + (i % 3) * 0.4) + i * 9) % gh);
      px(g, sx, sy, 1, 2, "rgba(220,235,245,.7)"); px(g, sx, sy - 3, 1, 2, "rgba(220,235,245,.3)");
    }
  }
  px(g, gx + Math.floor(gw / 2), gy, 1, gh, "#efe6d6"); px(g, gx, gy + Math.floor(gh / 2), gw, 1, "#efe6d6");
  px(g, gx + 1, gy + 1, 3, 1, "rgba(255,255,255,.5)");
  ob(g, w.x - 4, w.y + w.h + 1, w.w + 8, 4, "#efe6d6", "#fbf4e6");
  if (w.curtain) {
    for (const side of [-1, 1]) {
      const cx = side < 0 ? w.x - 6 : w.x + w.w - 1;
      ob(g, cx, w.y - 4, 7, w.h + 9, w.curtain); px(g, cx + 3, w.y - 3, 1, w.h + 7, "rgba(0,0,0,.15)");
    }
    px(g, w.x - 8, w.y - 5, w.w + 16, 2, WOOD.d);
  }
}
function drawClock(g) { // the living room clock tells the game's time
  const x = 29 * T + 6, y = 168;
  blob(g, x, y, 6, OL); blob(g, x, y, 5, "#f5ecd8");
  const h = (S.minute / 60) % 12, m = S.minute % 60;
  const ha = h / 12 * Math.PI * 2 - Math.PI / 2, ma = m / 60 * Math.PI * 2 - Math.PI / 2;
  for (let i = 1; i <= 3; i++) px(g, Math.round(x + Math.cos(ha) * i), Math.round(y + Math.sin(ha) * i), 1, 1, OL);
  for (let i = 1; i <= 4; i++) px(g, Math.round(x + Math.cos(ma) * i), Math.round(y + Math.sin(ma) * i), 1, 1, "#8a3530");
}
function drawOutsideWindows(g) {
  for (const c of [4, 9, 15, 27]) {
    const x = c * T + 3, y = 19 * T + 3;
    px(g, x, y, 24, 9, darkness > 0.3 ? "#f2c66d" : "#8fb6cf");
    if (darkness <= 0.3) px(g, x + 1, y + 1, 4, 1, "rgba(255,255,255,.6)");
    px(g, x + 12, y, 1, 9, "#efe6d6");
  }
}

/* ======================================================================
   People and the dog, drawn in code
   ====================================================================== */
function drawPerson(g, x, y, dir, step, o = {}) {
  const X = Math.round(x) - 6, Y = Math.round(y) - 23 + (o.seated ? 2 : 0);
  const sw = SWEATERS[S.sweater % SWEATERS.length];
  const parts = [];
  const flip = dir === "right";
  const add = (a, b, w, h, c) => parts.push([flip ? 12 - a - w : a, b, w, h, c]);
  const l = step === 1 ? 1 : 0, r = step === 3 ? 1 : 0;
  // shadow
  px(g, X + 2, Y + 22, 8, 2, "rgba(30,20,25,.22)"); px(g, X + 1, Y + 23, 10, 1, "rgba(30,20,25,.12)");
  const side = dir === "left" || dir === "right";
  if (!o.seated) {
    if (side) {
      add(4 - l + r, 17, 3, 5, PANTS); add(5 + l - r, 17, 3, 5, PANTS);
      add(3 - l + r, 21, 4, 2, SHOE); add(5 + l - r, 21, 4, 2, SHOE);
    } else {
      add(3, 17 - l, 3, 5, PANTS); add(6, 17 - r, 3, 5, PANTS);
      add(3, 21 - l, 3, 2, SHOE); add(6, 21 - r, 3, 2, SHOE);
    }
  }
  if (side) {
    add(3, 9, 6, 9, sw[1]);
    add(2, 1, 8, 8, SKIN);
    add(3, 0, 7, 3, HAIR); add(6, 2, 4, 6, HAIR);
  } else {
    add(2, 9, 8, 9, sw[1]);
    add(0, 10, 2, 6, sw[2]); add(10, 10, 2, 6, sw[2]);
    add(2, 1, 8, 8, SKIN);
    if (dir === "up") add(2, 0, 8, 8, HAIR);
    else { add(2, 0, 8, 3, HAIR); add(2, 2, 1, 5, HAIR); add(9, 2, 1, 5, HAIR); }
  }
  // outline pass, then colour pass
  g.fillStyle = OL;
  for (const [a, b, w, h] of parts) g.fillRect(X + a - 1, Y + b - 1, w + 2, h + 2);
  for (const [a, b, w, h, c] of parts) { g.fillStyle = c; g.fillRect(X + a, Y + b, w, h); }
  const P = (a, b, w, h, c) => px(g, X + (flip ? 12 - a - w : a), Y + b, w, h, c);
  // details
  if (side) {
    const swing = step === 1 ? -1 : step === 3 ? 1 : 0;
    P(5 + swing, 10, 2, 6, sw[2]); P(5 + swing, 16, 2, 1, SKIN);
    P(3, 5, 1, 2, OL); P(3, 7, 1, 1, "#e09080"); P(7, 1, 2, 1, HAIR_L);
    P(3, 9, 6, 1, sw[2]);
  } else if (dir === "down") {
    P(4, 5, 1, 2, OL); P(7, 5, 1, 2, OL); P(3, 7, 1, 1, "#e09080"); P(8, 7, 1, 1, "#e09080");
    P(3, 0, 3, 1, HAIR_L); P(0, 16, 2, 1, SKIN); P(10, 16, 2, 1, SKIN); P(5, 9, 2, 1, sw[2]);
  } else {
    P(3, 1, 2, 1, HAIR_L); P(4, 8, 4, 1, SKIN_D);
    if (o.typing) { const k = Math.floor(o.typing * 8) % 2; P(0, 10 + k, 2, 4, sw[2]); P(10, 11 - k, 2, 4, sw[2]); }
  }
  // the mug
  if (o.mug && dir !== "up") {
    const mx = side ? 1 : 10, my = side ? 13 : 14;
    P(mx, my, 3, 3, "#efe6d6"); P(mx, my + 2, 3, 1, "#cfc2ac"); P(flip ? mx - 1 : mx + 3, my + 1, 1, 1, "#efe6d6");
  }
  return { hand: side ? [X + (flip ? 6 : 6), Y + 16] : [X + 11, Y + 16] };
}

const FUR = "#c99a5b", FUR_D = "#a57943", FUR_L = "#e3bd80", EAR = "#7a5232";
function drawDog(g, d, t) {
  const X = Math.round(d.x), Y = Math.round(d.y);
  px(g, X - 6, Y - 1, 12, 2, "rgba(30,20,25,.2)");
  const parts = [], dots = [];
  const flip = d.dir === "left";
  const add = (a, b, w, h, c) => parts.push([a, b, w, h, c]);
  const dot = (a, b, w, h, c) => dots.push([a, b, w, h, c]);
  const step = d.moving ? Math.floor(t / 110) % 4 : 0;
  const wag = Math.floor(t / (d.happy > 0 ? 70 : 220)) % 2;
  let ox = -8, oy = -12;
  if (d.pose === "sleep") {
    const br = Math.floor(t / 900) % 2;
    add(2, 6 - br, 10, 5 + br, FUR); add(1, 7 - br, 12, 3 + br, FUR); add(9, 4, 6, 6, FUR);
    dot(10, 4, 3, 4, EAR); dot(12, 7, 2, 1, OL); dot(14, 7, 1, 1, OL); dot(13, 8, 2, 1, FUR_L);
    dot(1, 8, 5, 2, FUR_D); dot(3, 10, 6, 1, FUR_L); dot(4, 7 - br, 4, 1, FUR_L);
  } else if (d.dir === "down" || d.dir === "up") {
    ox = -6;
    const s1 = step === 1 ? 1 : 0, s2 = step === 3 ? 1 : 0;
    if (d.dir === "down") {
      add(3, 6, 7, 4, FUR); add(3, 9 - s1, 2, 3, FUR_D); add(8, 9 - s2, 2, 3, FUR_D);
      add(3, 0, 7, 6, FUR); add(1, 1, 2, 5, EAR); add(10, 1, 2, 5, EAR);
      dot(5, 6, 3, 3, FUR_L); dot(4, 2, 1, 1, OL); dot(8, 2, 1, 1, OL); dot(5, 3, 3, 2, FUR_L); dot(6, 3, 1, 1, OL);
      dot(4, 6, 5, 1, "#3f7c7a"); dot(6, 7, 1, 1, "#e8c66a"); dot(4, 0, 5, 1, FUR_D);
      if (d.happy > 0) dot(6, 5, 1, 2, "#e0707a");
    } else {
      add(3, 4, 7, 6, FUR); add(3, 9 - s1, 2, 3, FUR_D); add(8, 9 - s2, 2, 3, FUR_D);
      add(5 + wag, 8, 2, 4, FUR_D);
      add(3, 0, 7, 5, FUR); add(1, 1, 2, 4, EAR); add(10, 1, 2, 4, EAR);
      dot(4, 5, 5, 3, FUR_D); dot(4, 4, 5, 1, "#3f7c7a"); dot(4, 0, 5, 2, FUR_D);
    }
  } else {
    const s = [0, 1, 0, -1][step];
    add(2, 5, 10, 5, FUR); add(10, 0, 6, 6, FUR);
    add(0, 2 - wag, 2, 4, FUR_D);
    add(3 + s, 9, 2, 3, FUR_D); add(6 - s, 9, 2, 3, FUR); add(9 + s, 9, 2, 3, FUR_D); add(11 - s, 9, 2, 3, FUR);
    dot(10, 0, 2, 5, EAR); dot(14, 3, 3, 3, FUR_L); dot(16, 3, 1, 1, OL); dot(13, 2, 1, 1, OL);
    dot(9, 4, 2, 3, "#3f7c7a"); dot(10, 7, 1, 1, "#e8c66a"); dot(3, 9, 8, 1, FUR_L);
    if (d.happy > 0) dot(15, 6, 1, 2, "#e0707a");
  }
  const tx = (a, w) => flip ? -ox - a - w + ox + (ox === -8 ? 0 : 0) : a;
  const XX = (a, w) => X + ox + (flip ? (ox === -8 ? 17 : 13) - a - w : a);
  g.fillStyle = OL; for (const [a, b, w, h] of parts) g.fillRect(XX(a, w) - 1, Y + oy + b - 1, w + 2, h + 2);
  for (const [a, b, w, h, c] of parts) { g.fillStyle = c; g.fillRect(XX(a, w), Y + oy + b, w, h); }
  for (const [a, b, w, h, c] of dots) { g.fillStyle = c; g.fillRect(XX(a, w), Y + oy + b, w, h); }
  void tx;
  return { collar: [XX(9, 2) + 1, Y + oy + 6] };
}
function drawBubble(g, x, y, icon) {
  x = Math.round(x); y = Math.round(y);
  ob(g, x - 7, y - 11, 14, 11, "#fbf4e6"); px(g, x - 1, y - 1, 3, 2, OL); px(g, x, y - 1, 1, 1, "#fbf4e6");
  if (icon === "bowl") { ob(g, x - 4, y - 6, 8, 4, "#c4664f"); px(g, x - 2, y - 7, 1, 1, "#7a5232"); px(g, x, y - 8, 1, 1, "#7a5232"); px(g, x + 2, y - 7, 1, 1, "#7a5232"); }
  if (icon === "leash") { px(g, x - 3, y - 8, 6, 1, "#b4483c"); px(g, x - 3, y - 8, 1, 4, "#b4483c"); px(g, x + 2, y - 8, 1, 4, "#b4483c"); px(g, x - 2, y - 5, 4, 1, "#b4483c"); px(g, x, y - 4, 1, 2, "#b4483c"); }
}
const HEART = ["11011", "11111", "01110", "00100"];
function drawIcon(g, rows, x, y, c) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === "1") px(g, x + i, y + j, 1, 1, c); })); }
const NOTE = ["0011", "0010", "0010", "1110", "1100"];
const ZED = ["111", "010", "111"];

/* ======================================================================
   Game state at runtime
   ====================================================================== */
const cv = $("game"), ctx = cv.getContext("2d");
let VW = 320, VH = 180, SCALE = 3;
let light = canvas(VW, VH)[0], lg = light.getContext("2d");
function resize() {
  const w = innerWidth, h = innerHeight;
  SCALE = Math.max(2, Math.floor(Math.min(w, h * 1.4) / 250));
  VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  cv.width = VW; cv.height = VH; cv.style.width = VW * SCALE + "px"; cv.style.height = VH * SCALE + "px";
  ctx.imageSmoothingEnabled = false;
  light.width = VW; light.height = VH;
}
addEventListener("resize", resize);

const player = { x: 3 * T + 8, y: 4 * T + 12, dir: "down", step: 0, stepT: 0, moving: false, path: null, pending: null, busy: 0, onBusyDone: null };
const dog = { x: 29 * T + 15, y: 13 * T + 12, dir: "left", pose: "sleep", moving: false, path: null, state: "bed", timer: 6, happy: 0, bubble: null, bubbleT: 8, eat: 0 };
const duck = { a: 0 };
let sitting = false, paused = true, darkness = 0, lastT = 0, cam = { x: 0, y: 0 }, trail = [];
let particles = [], drops = [], current = null, toastTimer = 0, lastSave = 0, lastStepSound = 0;
if (S.pos) { player.x = S.pos.x; player.y = S.pos.y; player.dir = S.pos.dir || "down"; }
if (S.pos && S.pos.sitting) { player.x = 24 * T + 8; player.y = 5 * T + 12; player.dir = "up"; }

/* ---- walkable tests and paths ---- */
const isSolid = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || solid[ty * MW + tx] === 1;
const dogBlocked = (tx, ty) => isSolid(tx, ty) || ty >= INSIDE_ROWS;
function blockedAt(x, y, test) {
  const x0 = Math.floor((x - 4) / T), x1 = Math.floor((x + 4) / T), y0 = Math.floor((y - 3) / T), y1 = Math.floor((y + 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (test(tx, ty)) return true;
  return false;
}
function findPath(sx, sy, gx, gy, test) {
  if (test(gx, gy)) return null;
  const prev = new Int32Array(MW * MH).fill(-1), start = sy * MW + sx, goal = gy * MW + gx;
  const q = [start]; prev[start] = start;
  while (q.length) {
    const cur = q.shift(); if (cur === goal) break;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * MW + nx;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || prev[n] !== -1 || test(nx, ny)) continue;
      prev[n] = cur; q.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const out = []; for (let c = goal; c !== start; c = prev[c]) out.push([(c % MW) * T + 8, ((c / MW) | 0) * T + 12]);
  return out.reverse();
}
const tileOf = (x, y) => [Math.floor(x / T), Math.floor((y - 2) / T)];

/* ======================================================================
   Things to do
   ====================================================================== */
const LOOK = {
  rain: ["Rain on the glass. The lane shines like a wet record.", "The rain has settled in for the day. Good weather for staying put.", "Someone runs past with a newspaper over their head.", "Gutters talking to themselves. The maples drip."],
  morning: ["A clear, cold morning. Someone's breath hangs over the lane.", "The neighbor is raking leaves into a pile the wind keeps editing.", "Frost on the cars across the way, going soft in the sun."],
  day: ["Bright and still. A crow walks down the middle of the lane like it owns it.", "The maples across the way have gone the color of marmalade.", "A delivery van idles, then thinks better of it."],
  golden: ["The light goes long and gold across the lane.", "Late sun on the leaves. Everything looks like the last page of something."],
  night: ["Dark now. The street lamp hums. Across the way, someone is reading by a window.", "A few stars over the rooftops. A cat crosses the lane on business."],
};
function lookOutside() {
  if (darkness > 0.45) return pick(LOOK.night);
  if (S.weather === "rain") return pick(LOOK.rain);
  if (S.minute < 600) return pick(LOOK.morning);
  if (S.minute > 1020) return pick(LOOK.golden);
  return pick(LOOK.day);
}
const SHELF = [
  "You take down Middlemarch, read a page standing up, and put it back a little further in.",
  "A dictionary, heavy as a brick. You look up \"gloaming\" just to see it again.",
  "Your old notebooks, years of them. You read one page and close it, fast.",
  "A book of Chekhov's stories, with a train ticket for a bookmark.",
  "A row of poetry, mostly borrowed and never returned.",
  "Moby-Dick, which you have started four times. Not today.",
  "Mrs. Dalloway, which you open just to read the first line again.",
];
const CORK = ["Index cards for the novel. One just says FIND THE ENDING.", "A card that says \"chapter 7 is too long.\" It is.", "A list: things the mother would never say. It's getting longer.", "A postcard of the sea, pinned up years ago."];
const MAIL = ["A seed catalogue, and a postcard from a friend: \"Write the thing.\"", "Only the electric bill.", "A rejection, very kindly worded. Onward.", "A literary magazine with a story you wish you'd written.", "A letter from your aunt, mostly about her tomatoes.", "Nothing today. The mailbox smells of leaves."];
const SNACK = ["You eat a piece of cheese standing up, like a writer.", "Half a lemon, some jam, and a very old jar of capers. You close the door.", "You eat a few grapes and feel organized.", "Leftover soup. You'll have it later."];

function meal() {
  const m = S.minute;
  if (m < 660 && !S.meals.b) return ["b", "Have breakfast", "Toast and an egg at the table. Juniper watches every bite."];
  if (m >= 690 && m < 900 && !S.meals.l) return ["l", "Have lunch", "A sandwich and an apple, eaten slowly, looking at nothing in particular."];
  if (m >= 1050 && m < 1290 && !S.meals.d) return ["d", "Make dinner", "Pasta with too much garlic. You eat it at the table with a book open."];
  return null;
}
const cupWords = () => {
  const c = S.coffee; if (!c.where || c.level <= 0.02) return "";
  const amt = c.level > 0.75 ? "A full cup" : c.level > 0.4 ? "Half a cup" : "The last of the coffee";
  const temp = c.temp > 0.6 ? "hot" : c.temp > 0.25 ? "warm" : "cold";
  return `${amt}, ${temp}${c.where === "desk" && !sitting ? ", on the desk" : ""}`;
};

function makeCoffee() {
  busy(5.2, () => {
    S.coffee = { where: "hand", level: 1, temp: 1 }; S.cups++; S.total.cups++;
    toast(pick(["The first sip is the best one.", "Coffee. The world comes into focus.", "You hold the mug in both hands for a minute."]));
  });
  kettle.on = 5; Snd.kettle(); Snd.pour();
  toast(S.coffee.where && S.coffee.level > 0.2 ? "You tip the cold coffee into the sink and put the kettle on." : "You put the kettle on and grind the beans.");
}
const kettle = { on: 0 };

const ACTIONS = [
  { id: "bed", use: [3, 4], face: "left", label: () => S.minute >= 1200 ? "Go to bed" : "Lie down for a while",
    act() { if (S.minute >= 1200) endDay(); else skip(60, "You lie down on top of the covers and close your eyes. An hour goes by."); } },
  { id: "wardrobe", use: [9, 4], face: "up", label: () => "Change your sweater",
    act() { S.sweater = (S.sweater + 1) % SWEATERS.length; Snd.page(); toast(`You put on the ${SWEATERS[S.sweater][0]} sweater.`); } },
  { id: "bedwin", use: [6, 3], face: "up", label: () => "Look outside", act() { toast(lookOutside()); } },
  { id: "shelves", use: [15, 4], face: "up", label: () => "Browse the shelves", act() { Snd.page(); toast(pick(SHELF)); } },
  { id: "cork", use: [21, 3], face: "up", label: () => "Look at the corkboard", act() { toast(pick(CORK)); } },
  { id: "desk", use: [24, 5], face: "up", label: () => "Sit down and write", act: () => sitDown() },
  { id: "plant", use: [30, 4], face: "up", label: () => S.plantWatered ? "Look at the plant" : "Water the plant",
    act() {
      if (S.plantWatered) { toast("The soil is still damp. It's doing fine without you."); return; }
      S.plantWatered = true; Snd.water();
      if (S.plantLeaves < 12 && S.day % 2 === 0) { S.plantLeaves++; toast("You water the plant. There's a new leaf, still curled up."); }
      else toast("You water the plant and turn it a little toward the window.");
    } },
  { id: "armchair", use: [15, 8], face: "up", label: () => "Read for a while", act() { Snd.page(); skip(30, "You read in the armchair. Half an hour slips by."); } },
  { id: "record", use: [29, 6], face: "down", label: () => S.record ? "Lift the needle" : "Play a record",
    act() { S.record = !S.record; toast(S.record ? "You put on a record. Soft piano, a little crackle." : "You lift the needle. The room is quiet again."); } },
  { id: "fridge", use: [1, 13], face: "up", label: () => "Open the fridge", act() { toast(pick(SNACK)); } },
  { id: "sink", use: [3, 13], face: "up", label: () => "Have a glass of water", act() { Snd.water(); toast("A glass of water at the sink. You should do this more often."); } },
  { id: "coffee", use: [7, 13], face: "up", label: () => S.coffee.where === "hand" && S.coffee.level > 0.5 ? "Make a fresh cup" : "Make coffee", act: makeCoffee },
  { id: "table", use: [5, 14], face: "down", label: () => (meal() || [])[1], act() { const m = meal(); if (!m) return; S.meals[m[0]] = true; skip(20, m[2]); } },
  { id: "bowl", use: [11, 16], face: "down", label: () => S.bowl ? null : "Fill Juniper's bowl",
    act() { S.bowl = true; Snd.kibble(); toast("You fill the bowl. Juniper hears it from anywhere in the house."); dog.timer = 0; } },
  { id: "livwin", use: [16, 12], face: "up", label: () => "Look outside", act() { toast(lookOutside()); } },
  { id: "fire", use: [26, 13], face: "up", label: () => S.fire ? "Let the fire burn down" : "Light the fire",
    act() { S.fire = !S.fire; if (S.fire) { Snd.crackle(1); toast("You build a small fire. It takes on the second match."); } else toast("You leave the fire to burn down to embers."); } },
  { id: "sofa", use: [23, 15], face: "right", label: () => S.fire ? "Sit by the fire" : "Sit on the sofa",
    act() { skip(30, S.fire ? "You sit by the fire and watch it for a while. Juniper sighs against your feet." : "You sit on the sofa and think about the next scene. Half an hour goes by."); } },
  { id: "leash", use: [21, 16], face: "down", label: () => S.leash === "hook" ? "Take the leash" : "Hang up the leash",
    act() {
      if (S.leash === "hook") { S.leash = "hand"; dog.happy = 6; dog.path = null; Snd.woof(); toast(S.dog.walk > 0.5 ? "Juniper is at the door before you've got the leash off the hook." : "You clip on the leash. Juniper is game for anything."); }
      else { S.leash = "hook"; toast("You hang up the leash."); }
    } },
  { id: "bench", use: [1, 24], face: "down", label: () => "Sit on the bench", act() { skip(20, S.weather === "rain" ? "You sit on the wet bench anyway. The rain makes a sound like applause." : "You sit on the bench by the pond. Twenty minutes, no thoughts at all."); } },
  { id: "pond", use: [6, 24], face: "down", label: () => "Watch the duck", act() { Snd.quack(); toast("The duck goes about its business. It has a lot of business."); } },
  { id: "mail", use: [24, 22], face: "right", label: () => S.mailRead ? null : "Check the mail", act() { S.mailRead = true; Snd.page(); toast(pick(MAIL)); } },
];
// where you can click to use each thing (in tiles)
const HIT = {
  bed: [1, 3, 3, 3], wardrobe: [9, 1, 2, 3], bedwin: [5, 1, 3, 2], shelves: [14, 1, 4, 3], cork: [20, 1, 2, 2], desk: [23, 2, 4, 3],
  plant: [30, 2, 1, 2], armchair: [15, 7, 1, 1], record: [29, 7, 2, 1], fridge: [1, 11, 1, 2], sink: [3, 11, 1, 2], coffee: [5, 11, 3, 2],
  table: [4, 15, 3, 1], bowl: [11, 17, 1, 1], livwin: [15, 10, 3, 2], fire: [25, 10, 3, 3], sofa: [24, 15, 4, 1], leash: [21, 16, 1, 2],
  bench: [1, 25, 2, 1], pond: [5, 25, 4, 2], mail: [25, 21, 1, 2],
};
const actionById = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

function busy(sec, done) { player.busy = sec; player.onBusyDone = done; player.path = null; }
function skip(mins, msg) {
  player.busy = 1.2; player.path = null;
  $("fade").classList.add("on");
  setTimeout(() => { advance(mins); toast(msg, 6000); setTimeout(() => $("fade").classList.remove("on"), 200); }, 480);
}
function advance(mins) {
  S.minute = Math.min(S.minute + mins, sitting ? 1439 : 1440);
  S.dog.hunger = clamp(S.dog.hunger + mins / 480, 0, 1);
  S.dog.walk = clamp(S.dog.walk + mins / 420, 0, 1);
  if (S.coffee.where) S.coffee.temp = clamp(S.coffee.temp - mins / 55, 0, 1);
}

/* ---- the toast ---- */
function toast(msg, ms = 5200) {
  const el = $("toast"); el.textContent = msg; el.classList.remove("hide");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hide"), ms);
}

/* ======================================================================
   The desk: Longhand, in a frame
   ====================================================================== */
let frame = null, frameReady = null, baseWords = 0, sessionStart = 0, liveTimer = 0, escAt = 0;
function api() { try { return frame && frame.contentWindow && frame.contentWindow.longhand; } catch (e) { return null; } }
function ensureFrame() {
  if (frameReady) return frameReady;
  frame = document.createElement("iframe");
  frame.title = "Longhand, the writing app";
  frame.src = "/write/?from=day";
  $("deskPaper").appendChild(frame);
  frameReady = new Promise((resolve) => {
    frame.addEventListener("load", () => {
      const w = frame.contentWindow;
      // Esc once leaves the page (Longhand's own Esc); Esc again stands up.
      w.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" || !sitting) return;
        const d = frame.contentDocument, a = d.activeElement;
        const busyUI = !d.getElementById("drawer").hidden || !d.getElementById("exportMenu").hidden || d.querySelector("dialog[open]");
        if (!busyUI && (!a || a === d.body || a === d.documentElement)) { e.preventDefault(); standUp(); }
      }, true);
      const wait = () => { const a = api(); if (a) a.ready.then(resolve, resolve); else setTimeout(wait, 60); };
      wait();
    }, { once: true });
  });
  return frameReady;
}
async function sitDown() {
  if (sitting) return;
  sitting = true; player.path = null; player.x = 24 * T + 8; player.y = 4 * T + 12; player.dir = "up";
  if (S.coffee.where === "hand") S.coffee.where = "desk";
  if (S.leash === "hand") { S.leash = "hook"; }
  document.body.classList.add("writing");
  $("prompt").hidden = true;
  const desk = $("desk"); desk.hidden = false;
  requestAnimationFrame(() => desk.classList.add("open"));
  updateDesk();
  await ensureFrame();
  const a = api();
  baseWords = a ? a.words() : 0; sessionStart = performance.now();
  clearInterval(liveTimer); liveTimer = setInterval(updateDesk, 2000);
  focusEditor();
}
function focusEditor() { try { const ed = frame.contentDocument.getElementById("editor"); frame.focus(); ed.focus(); } catch (e) { /* fine */ } }
function sessionWords() { const a = api(); if (!a) return 0; try { return Math.max(0, a.words() - baseWords); } catch (e) { return 0; } }
async function standUp() {
  if (!sitting) return;
  const a = api();
  try { if (a) await a.save(); } catch (e) { /* it saves as you type anyway */ }
  const added = sessionWords();
  S.words += added; S.total.words += added;
  S.deskMin += Math.round((performance.now() - sessionStart) / 60000);
  clearInterval(liveTimer);
  sitting = false;
  const desk = $("desk"); desk.classList.remove("open");
  document.body.classList.remove("writing");
  setTimeout(() => { if (!sitting) desk.hidden = true; }, 500);
  player.y = 5 * T + 12; player.dir = "down";
  try { document.activeElement.blur(); } catch (e) { /* fine */ }
  cv.focus && cv.focus();
  toast(added > 0 ? `${added.toLocaleString()} new ${added === 1 ? "word" : "words"}. You push back the chair and stretch.` : "You push back the chair. Sometimes the work is thinking.");
  if (dog.state === "desk") { dog.timer = 2; }
  save();
}
$("standBtn").addEventListener("click", standUp);
function updateDesk() {
  const live = S.words + (sitting ? sessionWords() : 0);
  $("deskTime").textContent = `${clockText()} · ${S.weather === "rain" ? "Rain" : darkness > 0.45 ? "Night" : "Clear"}`;
  const cw = cupWords(); $("deskCoffee").textContent = cw ? "☕ " + cw : "No coffee";
  $("deskDog").textContent = dog.state === "desk" ? "Juniper is asleep under the desk" : "";
  $("deskWords").textContent = live > 0 ? `${live.toLocaleString()} words today` : "";
  updateHud();
}

/* ======================================================================
   The end of the day
   ====================================================================== */
function weekday(offset) {
  const [y, m, d] = (S.start || todayISO()).split("-").map(Number);
  return new Date(y, m - 1, d + offset).toLocaleDateString(undefined, { weekday: "long" });
}
function endDay() {
  if (sitting) return;
  paused = true; save(); $("prompt").hidden = true; $("toast").classList.add("hide");
  const w = S.words;
  $("endKicker").textContent = `Day ${S.day} · ${weekday(S.day - 1)}`;
  $("endTitle").textContent = "The end of the day";
  $("endLine").textContent = w === 0 ? "No words today, and that's allowed. Some days the work is walking around." :
    w < 300 ? "A few good sentences. Those count." : w < 1000 ? "A real day's work." : "A big day at the desk. Rest well.";
  const hrs = Math.floor(S.deskMin / 60), mins = S.deskMin % 60;
  const items = [
    [w.toLocaleString(), w === 1 ? "word" : "words"],
    [hrs ? `${hrs}h ${mins}m` : `${mins} min`, "at the desk"],
    [S.cups, S.cups === 1 ? "cup of coffee" : "cups of coffee"],
    [S.walks, S.walks === 1 ? "walk with Juniper" : "walks with Juniper"],
  ];
  $("endStats").innerHTML = items.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join("");
  $("endNote").textContent = S.total.days > 0 ? `Over ${S.total.days + 1} days: ${(S.total.words).toLocaleString()} words.` : "Your writing is in Longhand, saved in this browser. Open the desk tomorrow and it's right where you left it.";
  $("endCard").hidden = false;
  $("sleepBtn").focus();
}
$("sleepBtn").addEventListener("click", () => {
  const carry = { greeted: true, sweater: S.sweater, plantLeaves: S.plantLeaves, start: S.start, total: Object.assign({}, S.total, { days: S.total.days + 1, walks: S.total.walks }) };
  S = freshDay(S.day + 1, carry);
  player.x = 3 * T + 8; player.y = 4 * T + 12; player.dir = "down";
  dog.x = 29 * T + 15; dog.y = 13 * T + 12; dog.state = "bed"; dog.pose = "sleep"; dog.timer = 8;
  save();
  $("endCard").hidden = true; paused = false;
  toast(S.weather === "rain" ? `Day ${S.day}. Rain on the roof. Juniper is still asleep.` : `Day ${S.day}. A clear morning. Juniper is still asleep.`);
});

/* ======================================================================
   Input
   ====================================================================== */
const keys = new Set();
const MOVE = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
addEventListener("keydown", (e) => {
  if (sitting) { if (e.key === "Escape") { e.preventDefault(); standUp(); } return; }
  if (!$("titleCard").hidden || !$("endCard").hidden) return;
  if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName) && (e.key === " " || e.key === "Enter")) return;
  if (MOVE[e.key]) { keys.add(MOVE[e.key]); player.path = null; player.pending = null; e.preventDefault(); }
  else if (e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") { e.preventDefault(); if (current && !player.busy) useThing(current); }
  else if (e.key === "Escape") openMenu();
  else if (e.key === "m" || e.key === "M") toggleSound();
});
addEventListener("keyup", (e) => { if (MOVE[e.key]) keys.delete(MOVE[e.key]); });
addEventListener("blur", () => keys.clear());

cv.addEventListener("pointerdown", (e) => {
  if (paused || sitting || player.busy) return;
  Snd.init();
  const wx = cam.x + e.clientX / SCALE, wy = cam.y + e.clientY / SCALE;
  // the dog?
  if (Math.abs(wx - dog.x) < 10 && wy > dog.y - 14 && wy < dog.y + 3) { goTo(dog.x, dog.y, { dog: true }); return; }
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  for (const a of ACTIONS) {
    const h = HIT[a.id];
    if (h && tx >= h[0] && tx < h[0] + h[2] && ty >= h[1] && ty < h[1] + h[3] && a.label()) { goTo(a.use[0] * T + 8, a.use[1] * T + 12, a); return; }
  }
  goTo(wx, wy, null);
});
function goTo(wx, wy, target) {
  const [sx, sy] = tileOf(player.x, player.y);
  let gx = Math.floor(wx / T), gy = Math.floor(wy / T);
  if (target && target.dog) {
    // walk to a free tile beside the dog
    const opts = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [gx + dx, Math.floor((dog.y - 2) / T) + dy]).filter(([x, y]) => !isSolid(x, y));
    opts.sort((a, b) => Math.hypot(a[0] - sx, a[1] - sy) - Math.hypot(b[0] - sx, b[1] - sy));
    if (!opts.length) return; [gx, gy] = opts[0];
  }
  if (isSolid(gx, gy)) { // the nearest open tile
    let best = null, bd = 1e9;
    for (let y = gy - 2; y <= gy + 2; y++) for (let x = gx - 2; x <= gx + 2; x++) if (!isSolid(x, y)) { const d = Math.hypot(x - gx, y - gy); if (d < bd) { bd = d; best = [x, y]; } }
    if (!best) return; [gx, gy] = best;
  }
  const p = (sx === gx && sy === gy) ? [] : findPath(sx, sy, gx, gy, isSolid);
  if (!p) return;
  if (!target) { const fx = clamp(wx, gx * T + 5, gx * T + 11), fy = clamp(wy, gy * T + 6, gy * T + 13); if (p.length) p[p.length - 1] = [fx, fy]; else p.push([fx, fy]); }
  player.path = p; player.pending = target;
}
function useThing(it) {
  if (it.dog) { petDog(); return; }
  if (it.face) player.dir = it.face;
  it.act();
}
function petDog() {
  dog.happy = 3; Snd.pat();
  for (let i = 0; i < 3; i++) particles.push({ type: "heart", x: dog.x - 3 + i * 3, y: dog.y - 14, vx: (i - 1) * 6, vy: -14, life: 1.4 + i * 0.2, ui: true });
  toast(pick(["Juniper leans her whole weight into your hand.", "You scratch behind Juniper's ears. Her back leg goes.", "Juniper rolls over, in case you missed any of her.", "Good dog. The best dog, really."]), 3500);
}
$("prompt").addEventListener("click", () => { Snd.init(); if (current && !player.busy) useThing(current); });

/* ---- menus and buttons ---- */
function toggleSound() { Snd.init(); const on = Snd.toggle(); $("soundBtn").textContent = on ? "Sound on" : "Sound off"; }
$("soundBtn").addEventListener("click", toggleSound);
$("soundBtn").textContent = Snd.on ? "Sound on" : "Sound off";
function openMenu() {
  paused = true; save(); $("prompt").hidden = true;
  $("beginBtn").textContent = "Back to the day";
  $("restartBtn").hidden = false;
  $("titleCard").hidden = false; $("beginBtn").focus();
}
$("menuBtn").addEventListener("click", openMenu);
$("beginBtn").addEventListener("click", () => {
  Snd.init(); $("titleCard").hidden = true; paused = false; lastT = 0;
  if (!S.greeted) { S.greeted = true; toast("Morning. Juniper is still asleep. Coffee first, maybe.", 6500); }
});
$("restartBtn").addEventListener("click", () => {
  if (!confirm("Start over from day one? Your writing stays in Longhand; only the game's day is reset.")) return;
  S = freshDay(1); save();
  player.x = 3 * T + 8; player.y = 4 * T + 12; dog.x = 29 * T + 15; dog.y = 13 * T + 12; dog.state = "bed";
  $("restartBtn").hidden = true; $("beginBtn").click();
});
if (hasSave && (S.day > 1 || S.minute > 430)) {
  $("beginBtn").textContent = `Continue: day ${S.day}, ${clockText()}`;
  $("restartBtn").hidden = false;
}

/* ======================================================================
   Update
   ====================================================================== */
function clockText(m = S.minute) { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; }
const AMB = [ // minute, darkness, color, grade rgb, grade alpha
  [0, 0.74, "#0c1028", "#5060b0", 0.05], [330, 0.74, "#0c1028", "#5060b0", 0.05], [390, 0.48, "#2a2050", "#ff9a7a", 0.1],
  [450, 0.14, "#5a4060", "#ffb48a", 0.16], [540, 0, "#ffffff", "#fff0d8", 0.05], [900, 0, "#ffffff", "#fff0d8", 0],
  [1020, 0.04, "#6a4a40", "#ffc070", 0.13], [1110, 0.16, "#6a3a50", "#ff9050", 0.24], [1170, 0.34, "#3a2a60", "#d07090", 0.16],
  [1230, 0.56, "#141a40", "#6070c0", 0.07], [1320, 0.72, "#0c1028", "#5060b0", 0.05], [1440, 0.74, "#0c1028", "#5060b0", 0.05],
];
let amb = null;
function computeAmb() {
  const a = keyLerp(AMB, S.minute, [1, 2, 3, 4]);
  amb = { dark: a[0], col: a[1], grade: a[2], ga: a[3] };
  if (S.weather === "rain") { amb.dark = amb.dark + (1 - amb.dark) * 0.14; amb.col = mix(amb.col, [90, 100, 120], 0.4); amb.grade = [130, 150, 175]; amb.ga = Math.max(amb.ga, 0.12); }
  darkness = amb.dark;
}
function update(dt, t) {
  if (paused) return;
  // time passes: a game minute a second, slower at the desk
  const rate = sitting ? 2 / 60 : 1;
  const before = S.minute;
  advance(dt * rate);
  if (!sitting && S.minute >= 1440) { endDay(); return; }
  if (before < 1350 && S.minute >= 1350 && !sitting) toast("It's getting late. The bed is calling.");
  computeAmb();

  // coffee
  const c = S.coffee;
  if (c.where) { if (sitting && c.where === "desk") c.level = Math.max(0, c.level - dt / (22 * 60)); else if (c.where === "hand") c.level = Math.max(0, c.level - dt / 600); }
  if (sitting) c.temp = Math.max(0, c.temp - dt / (16 * 60));
  if (c.where && c.level <= 0.01) { c.where = null; if (!sitting) toast("You finish the coffee."); }
  if (kettle.on > 0) kettle.on -= dt;

  // the player
  if (player.busy > 0) {
    player.busy -= dt;
    if (player.busy <= 0) { player.busy = 0; const f = player.onBusyDone; player.onBusyDone = null; if (f) f(); }
  } else if (!sitting) movePlayer(dt, t);
  if (sitting) { player.x = 24 * T + 8; player.y = 4 * T + 12; player.dir = "up"; }

  // the leash: back inside means the walk is over
  const outside = player.y > 18 * T + 8;
  if (S.leash === "hand") {
    if (outside && !S.walkedNow && Math.floor(player.x / T) <= 9 && player.y >= 23 * T) {
      S.walkedNow = true; S.walks++; S.total.walks++; S.dog.walk = 0; dog.happy = 5;
      toast(pick(["Juniper sniffs every reed by the pond. A good walk.", "Juniper meets a leaf she has strong feelings about. A good walk.", S.weather === "rain" ? "Juniper doesn't mind the rain at all. You mind it a little. A good walk." : "Juniper trots ahead like she's late for something. A good walk."]));
    }
    if (!outside && player.y < 17 * T && S.walkedNow) { S.leash = "hook"; S.walkedNow = false; toast("You unclip the leash and hang it by the door. Juniper shakes herself off."); Snd.door(); }
  }
  trail.push([player.x, player.y]); if (trail.length > 90) trail.shift();

  updateDog(dt, t);
  duck.a += dt * 0.25;

  // particles
  for (const p of particles) { p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.type === "steam") p.x += Math.sin(t / 300 + p.y) * dt * 3; }
  particles = particles.filter((p) => p.life > 0);
  emitParticles(dt, t);

  // nearest thing to use
  current = null;
  if (!sitting && !player.busy) {
    let best = 22;
    for (const a of ACTIONS) {
      if (!a.label()) continue;
      const d = Math.hypot(player.x - (a.use[0] * T + 8), player.y - (a.use[1] * T + 12));
      if (d < best) { best = d; current = a; }
    }
    if (S.leash !== "hand") { const dd = Math.hypot(player.x - dog.x, player.y - dog.y); if (dd < 18 && dd < best + 4) current = { dog: true, label: () => "Pet Juniper" }; }
  }
  const pr = $("prompt");
  if (current && !paused) { const l = current.label(); if (pr.dataset.l !== l) { pr.innerHTML = `<kbd>E</kbd><span></span>`; pr.lastChild.textContent = l; pr.dataset.l = l; } pr.hidden = false; }
  else { pr.hidden = true; pr.dataset.l = ""; }

  ambientSound(dt, outside);
  if (t - lastSave > 5000) { lastSave = t; S.pos = { x: player.x, y: player.y, dir: player.dir, sitting }; save(); }
  updateHud();
}

function movePlayer(dt, t) {
  let vx = 0, vy = 0;
  if (keys.has("left")) vx -= 1; if (keys.has("right")) vx += 1;
  if (keys.has("up")) vy -= 1; if (keys.has("down")) vy += 1;
  const speed = 62;
  if (player.path) {
    const nxt = player.path[0];
    if (!nxt) {
      player.path = null;
      const p = player.pending; player.pending = null;
      if (p) { if (p.dog) { player.dir = dog.x < player.x - 4 ? "left" : dog.x > player.x + 4 ? "right" : dog.y < player.y ? "up" : "down"; petDog(); } else useThing(p); }
    } else {
      const dx = nxt[0] - player.x, dy = nxt[1] - player.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { player.x = nxt[0]; player.y = nxt[1]; player.path.shift(); }
      else { vx = dx / d; vy = dy / d; }
    }
  }
  const len = Math.hypot(vx, vy);
  player.moving = len > 0;
  if (player.moving) {
    vx /= len; vy /= len;
    if (Math.abs(vx) > Math.abs(vy) + 0.1) player.dir = vx < 0 ? "left" : "right"; else if (vy) player.dir = vy < 0 ? "up" : "down";
    const nx = player.x + vx * speed * dt, ny = player.y + vy * speed * dt;
    const following = !!player.path;
    if (following || !blockedAt(nx, player.y, isSolid)) player.x = nx;
    if (following || !blockedAt(player.x, ny, isSolid)) player.y = ny;
    player.x = clamp(player.x, 6, WORLD_W - 6); player.y = clamp(player.y, 8, WORLD_H - 18);
    player.stepT += dt;
    if (player.stepT > 0.13) { player.stepT = 0; player.step = (player.step + 1) % 4; if (player.step % 2 === 1) Snd.step(player.y > 19 * T); }
  } else { player.step = 0; player.stepT = 0.12; }
}

function updateDog(dt, t) {
  const d = S.dog;
  dog.happy = Math.max(0, dog.happy - dt);
  dog.moving = false;
  const leashed = S.leash === "hand";
  if (leashed) {
    dog.state = "follow"; dog.pose = "stand";
    const back = trail[Math.max(0, trail.length - 22)] || [player.x, player.y];
    const dx = back[0] - dog.x, dy = back[1] - dog.y, dist = Math.hypot(dx, dy);
    if (dist > 2) { const sp = Math.min(dist * 4, 90); dog.x += dx / dist * sp * dt; dog.y += dy / dist * sp * dt; dog.moving = true; faceDog(dx, dy); }
    return;
  }
  if (dog.state === "follow") { dog.state = "idle"; dog.timer = 3; }
  // the dog finds its way back inside if it is ever outside unleashed
  if (dog.y > INSIDE_ROWS * T - 4) { dog.y = 17 * T + 10; dog.x = clamp(dog.x, 13 * T, 30 * T); }
  if (dog.path && dog.path.length) {
    const nxt = dog.path[0], dx = nxt[0] - dog.x, dy = nxt[1] - dog.y, dist = Math.hypot(dx, dy);
    const sp = dog.state === "toEat" ? 70 : dog.state === "toDesk" ? 55 : 40;
    if (dist < 1.5) { dog.x = nxt[0]; dog.y = nxt[1]; dog.path.shift(); }
    else { dog.x += dx / dist * sp * dt; dog.y += dy / dist * sp * dt; dog.moving = true; faceDog(dx, dy); dog.pose = "stand"; }
    if (dog.path.length) return;
    dog.path = null; arrived(); return;
  }
  dog.timer -= dt;
  if (sitting && dog.state !== "desk" && dog.state !== "toDesk") { dogGo(25, 4, "toDesk"); return; }
  if (S.bowl && d.hunger > 0.25 && dog.state !== "eat" && dog.state !== "toEat" && !sitting) { dogGo(11, 16, "toEat"); return; }
  if (dog.state === "eat") {
    dog.pose = "stand"; dog.dir = "down";
    if (dog.timer <= 0) { S.bowl = false; d.hunger = 0; dog.happy = 3; dog.state = "idle"; dog.timer = 4; }
    return;
  }
  if (dog.timer > 0) return;
  if (sitting) return;
  const late = S.minute > 1290;
  const r = Math.random();
  if (late || r < 0.2) { if (S.fire && Math.random() < 0.5) dogGo(27, 14, "toBed"); else dogGo(29, 13, "toBed"); return; }
  if (r < 0.45 && player.y < INSIDE_ROWS * T) { // come and see what you're doing
    const [px_, py_] = tileOf(player.x, player.y);
    const opts = [[1, 0], [-1, 0], [0, 1]].map(([a, b]) => [px_ + a, py_ + b]).filter(([x, y]) => !dogBlocked(x, y));
    if (opts.length) { const o = pick(opts); dogGo(o[0], o[1], "visit"); return; }
  }
  if (r < 0.85) { // wander
    for (let i = 0; i < 20; i++) { const x = 1 + (Math.random() * 30 | 0), y = 3 + (Math.random() * 15 | 0); if (!dogBlocked(x, y)) { dogGo(x, y, "wander"); return; } }
  }
  dog.state = "idle"; dog.pose = "stand"; dog.timer = 3 + Math.random() * 5;
}
function dogGo(x, y, state) {
  const [sx, sy] = tileOf(dog.x, dog.y);
  const p = findPath(clamp(sx, 0, MW - 1), clamp(sy, 0, INSIDE_ROWS - 1), x, y, dogBlocked);
  dog.state = state;
  if (!p || !p.length) { dog.path = null; arrived(); return; }
  if (state === "toBed" && x === 29) p[p.length - 1] = [29 * T + 15, 13 * T + 12];
  dog.path = p;
}
function arrived() {
  const s = dog.state;
  if (s === "toEat") { dog.state = "eat"; dog.timer = 3.5; Snd.kibble(); }
  else if (s === "toDesk") { dog.state = "desk"; dog.pose = "sleep"; dog.dir = "left"; }
  else if (s === "toBed") { dog.state = "bed"; dog.pose = "sleep"; dog.timer = 25 + Math.random() * 30; }
  else if (s === "visit") { dog.state = "idle"; dog.pose = "stand"; faceDog(player.x - dog.x, player.y - dog.y); dog.timer = 5 + Math.random() * 6; }
  else { dog.state = "idle"; dog.pose = "stand"; dog.timer = 2 + Math.random() * 5; }
}
function faceDog(dx, dy) { if (Math.abs(dx) > Math.abs(dy)) dog.dir = dx < 0 ? "left" : "right"; else dog.dir = dy < 0 ? "up" : "down"; }

function emitParticles(dt, t) {
  // steam from the kettle, the mug, the coffee on the desk
  const steam = (x, y, rate) => { if (Math.random() < rate * dt) particles.push({ type: "steam", x: x + Math.random() * 2, y, vx: 0, vy: -7, life: 1.6, max: 1.6 }); };
  if (kettle.on > 0) steam(2 * T + 53, 12 * T - 12, 14);
  if (S.coffee.where && S.coffee.temp > 0.3) {
    if (S.coffee.where === "desk") steam(23 * T + 47, 3 * T - 8, 3 * S.coffee.temp);
    else if (S.coffee.where === "hand" && player.dir !== "up") steam(player.x + (player.dir === "left" ? -4 : 5), player.y - 10, 3 * S.coffee.temp);
  }
  if (S.fire && Math.random() < 6 * dt) particles.push({ type: "ember", x: 25 * T + 18 + Math.random() * 12, y: 12 * T + 4, vx: (Math.random() - 0.5) * 6, vy: -12, life: 0.9, max: 0.9 });
  if (S.record && Math.random() < 0.7 * dt) particles.push({ type: "note", x: 29 * T + 10, y: 7 * T - 10, vx: (Math.random() - 0.3) * 6, vy: -9, life: 2.2, max: 2.2, ui: true });
  if (dog.pose === "sleep" && Math.random() < 0.6 * dt) particles.push({ type: "zed", x: dog.x + (dog.dir === "left" ? -4 : 4), y: dog.y - 12, vx: 3, vy: -6, life: 1.8, max: 1.8, ui: true });
  // dust in the sunbeams
  if (beamStrength() > 0.2 && Math.random() < 3 * dt) {
    const w = pick(WINDOWS.filter((w) => w.y < 100 || w.y > 150));
    particles.push({ type: "mote", x: w.x + Math.random() * w.w, y: w.y + w.h + 6 + Math.random() * 30, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 4, max: 4 });
  }
  // falling leaves outside
  if (Math.random() < 0.8 * dt) particles.push({ type: "leaf", x: Math.random() * WORLD_W, y: 19 * T + Math.random() * 40, vx: 6 + Math.random() * 6, vy: 6, life: 5, max: 5, c: pick(["#c98f3c", "#b4583c", "#d9a441"]) });
  // the dog's bubble: hungry, or wants a walk
  dog.bubbleT -= dt;
  if (dog.bubbleT <= 0) {
    dog.bubble = null;
    if (!sitting && S.leash !== "hand" && dog.pose !== "sleep") {
      if (S.dog.hunger > 0.8 && !S.bowl) dog.bubble = "bowl";
      else if (S.dog.walk > 0.75 && darkness < 0.6) dog.bubble = "leash";
      if (dog.bubble && Math.random() < 0.3) Snd.woof();
    }
    dog.bubbleT = dog.bubble ? 3 : 9 + Math.random() * 6;
  }
}
function beamStrength() { if (S.weather === "rain") return 0; return clamp(1 - darkness * 6, 0, 1) * (S.minute > 480 && S.minute < 1140 ? 1 : 0.4); }

function ambientSound(dt, outside) {
  const rain = S.weather === "rain";
  Snd.rain(rain ? (sitting ? 0.07 : outside ? 0.2 : 0.09) : 0);
  if (!rain && S.minute > 380 && S.minute < 1100 && Math.random() < (outside ? 0.35 : 0.08) * dt) Snd.chirp(outside ? 1 : 0.35);
  if (S.fire) { const near = clamp(1 - Math.hypot(player.x - 26 * T, player.y - 13 * T) / 260, 0.15, 1); if (Math.random() < 5 * dt) Snd.crackle(near * (sitting ? 0.4 : 1)); }
  const recDist = Math.hypot(player.x - 30 * T, player.y - 7 * T);
  Snd.music(S.record, clamp(1 - recDist / 420, 0.2, 1) * (outside ? 0.25 : 0.8));
}

const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
let liveWords = 0, liveAt = 0;
function updateHud() {
  setText("clock", clockText());
  setText("dayline", `${weekday(S.day - 1)} · Day ${S.day} · ${S.weather === "rain" ? "Rain" : darkness > 0.45 ? "Night" : "Clear"}`);
  const cw = cupWords(); setText("coffeeChip", cw ? "☕ " + cw : "");
  const now = performance.now();
  if (now - liveAt > 1000) { liveAt = now; liveWords = S.words + (sitting ? sessionWords() : 0); }
  setText("wordsChip", liveWords > 0 ? `${liveWords.toLocaleString()} ${liveWords === 1 ? "word" : "words"} today` : "");
}

/* ======================================================================
   Draw
   ====================================================================== */
function render(t) {
  computeAmb();
  // the camera follows you, or settles on the desk
  const fx = sitting ? 24 * T + 8 : player.x, fy = sitting ? 3 * T + 10 : player.y - 8;
  const tx = WORLD_W <= VW ? (WORLD_W - VW) / 2 : clamp(fx - VW / 2, 0, WORLD_W - VW);
  const ty = WORLD_H <= VH ? (WORLD_H - VH) / 2 : clamp(fy - VH / 2, 0, WORLD_H - VH);
  const k = reduceMotion ? 1 : 0.12;
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  if (Math.abs(tx - cam.x) > 300 || Math.abs(ty - cam.y) > 300) { cam.x = tx; cam.y = ty; }
  const cx = Math.round(cam.x), cy = Math.round(cam.y);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#1d1820"; ctx.fillRect(0, 0, VW, VH);
  ctx.setTransform(1, 0, 0, 1, -cx, -cy);
  ctx.drawImage(bg, 0, 0);
  for (const w of WINDOWS) drawWindow(ctx, w, t);
  drawClock(ctx); drawOutsideWindows(ctx);
  // the pond shimmers, the duck paddles
  for (let i = 0; i < 3; i++) { const sx = 5 * T + 10 + ((t / 60 + i * 17) % 40); px(ctx, sx, 25 * T + 10 + i * 6, 4, 1, "rgba(255,255,255,.35)"); }
  const dx = 5 * T + 32 + Math.cos(duck.a) * 18, dy = 25 * T + 16 + Math.sin(duck.a) * 6, dl = Math.sin(duck.a) > 0;
  ob(ctx, Math.round(dx) - 4, Math.round(dy) - 3, 8, 5, "#efe6d6"); ob(ctx, Math.round(dx) + (dl ? -6 : 2), Math.round(dy) - 6, 5, 5, "#3f7c5a"); px(ctx, Math.round(dx) + (dl ? -8 : 6), Math.round(dy) - 4, 2, 1, "#e8a040");

  // sunbeams through the windows
  const bs = beamStrength();
  if (bs > 0) {
    ctx.globalCompositeOperation = "lighter";
    const shift = clamp((780 - S.minute) / 10, -26, 26);
    for (const w of WINDOWS) {
      const y0 = w.y + w.h + 6, len = w.y > 150 ? 40 : 52;
      const grad = ctx.createLinearGradient(0, y0, 0, y0 + len);
      grad.addColorStop(0, `rgba(255,226,170,${0.13 * bs})`); grad.addColorStop(1, "rgba(255,226,170,0)");
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.moveTo(w.x + 2, y0); ctx.lineTo(w.x + w.w - 2, y0); ctx.lineTo(w.x + w.w - 2 + shift, y0 + len); ctx.lineTo(w.x + 2 + shift, y0 + len); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // everything that stands on the floor, back to front
  const list = [];
  for (const o of OBJS) list.push([o.sortY, () => {
    const ox = o.x * T - o.padX, oy = o.y * T - o.tall;
    ctx.drawImage(cache(o), ox, oy);
    if (o.id === "desk") deskExtras(ox, oy, t);
    if (o.id === "counter") kettleArt(ox, oy);
    if (o.id === "fireplace" && S.fire) fireArt(ox, oy, t);
    if (o.id === "record") recordArt(ox, oy, t);
    if (o.id === "bowls" && S.bowl) { px(ctx, ox + 2, oy + 7, 5, 2, "#7a5232"); px(ctx, ox + 3, oy + 7, 1, 1, "#9a6a42"); }
    if (o.id === "coatrack" && S.leash === "hook") { px(ctx, ox + 11, oy + 5, 1, 12, "#c0392b"); px(ctx, ox + 10, oy + 16, 3, 2, "#c0392b"); }
    if (o.id === "mailbox" && !S.mailRead) { px(ctx, ox + 13, oy + 0, 1, 6, "#b4483c"); px(ctx, ox + 13, oy + 0, 3, 2, "#b4483c"); }
  }]);
  const pSort = sitting ? 4 * T + 12 : player.y;
  list.push([pSort, () => {
    const holding = S.coffee.where === "hand";
    const r = drawPerson(ctx, player.x, player.y, player.dir, player.moving ? player.step : 0, { mug: holding, seated: sitting, typing: sitting ? t / 1000 : 0 });
    player.hand = r.hand;
  }]);
  list.push([dog.y, () => { const r = drawDog(ctx, dog, t); dog.collar = r.collar; }]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, f] of list) f();

  // the leash
  if (S.leash === "hand" && player.hand && dog.collar) {
    ctx.strokeStyle = "#b4483c"; ctx.lineWidth = 1; ctx.beginPath();
    const [hx, hy] = player.hand, [cx2, cy2] = dog.collar;
    const midx = (hx + cx2) / 2, midy = Math.max(hy, cy2) + 4;
    for (let i = 0; i <= 10; i++) { const s = i / 10, x = (1 - s) * (1 - s) * hx + 2 * (1 - s) * s * midx + s * s * cx2, y = (1 - s) * (1 - s) * hy + 2 * (1 - s) * s * midy + s * s * cy2; px(ctx, Math.round(x), Math.round(y), 1, 1, "#b4483c"); }
  }

  // world particles
  for (const p of particles) if (!p.ui) drawParticle(p);
  drawRain(t);

  // light and color
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (amb) {
    if (amb.ga > 0.005) { ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = `rgba(${amb.grade.map((v) => v | 0).join(",")},${amb.ga * 2})`; ctx.fillRect(0, 0, VW, VH); }
    if (amb.dark > 0.01) {
      const shade = mix([255, 255, 255], amb.col, clamp(amb.dark * 1.25, 0, 1));
      lg.globalCompositeOperation = "source-over"; lg.fillStyle = rgb(shade); lg.fillRect(0, 0, VW, VH);
      lg.globalCompositeOperation = "lighter";
      const glow = (x, y, r, a, col = "255,226,180") => {
        const g = lg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); lg.fillStyle = g; lg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
      };
      for (const L of LAMPS) if (L.on()) glow(L.x, L.y, L.r, 0.85 * Math.min(1, amb.dark * 1.6));
      if (S.fire) glow(26 * T + 8, 12 * T + 8, 78 + Math.sin(t / 90) * 4 + Math.random() * 3, 0.9, "255,190,120");
      if (sitting) glow(24 * T + 10, 3 * T - 6, 34, 0.5, "190,215,255");
      for (const c of [4, 9, 15, 27]) glow(c * T + 15, 19 * T + 10, 26, 0.6 * amb.dark);
      ctx.globalCompositeOperation = "multiply"; ctx.drawImage(light, 0, 0);
      // a little bloom
      ctx.globalCompositeOperation = "lighter";
      const bloom = (x, y, r, a) => { const g = ctx.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r); g.addColorStop(0, `rgba(255,170,90,${a})`); g.addColorStop(1, "rgba(255,170,90,0)"); ctx.fillStyle = g; ctx.fillRect(x - cx - r, y - cy - r, r * 2, r * 2); };
      for (const L of LAMPS) if (L.on()) bloom(L.x, L.y, 18, 0.18 * amb.dark);
      if (S.fire) bloom(26 * T + 8, 12 * T + 14, 30, 0.22);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  // the things that float above, unshaded
  ctx.setTransform(1, 0, 0, 1, -cx, -cy);
  for (const p of particles) if (p.ui) drawParticle(p);
  if (dog.bubble) drawBubble(ctx, dog.x, dog.y - 16, dog.bubble);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function deskExtras(ox, oy, t) {
  if (sitting) { // the screen is on
    px(ctx, ox + 28, oy + 2, 13, 7, "#dfe8f2");
    for (let i = 0; i < 3; i++) px(ctx, ox + 30, oy + 3 + i * 2, 5 + ((i * 3 + Math.floor(t / 700)) % 6), 1, "#8a9ab0");
  }
  if (S.coffee.where === "desk") {
    ob(ctx, ox + 44, oy + 6, 6, 6, "#efe6d6", "#fbf4e6"); px(ctx, ox + 50, oy + 8, 1, 2, "#efe6d6");
    if (S.coffee.level > 0.05) px(ctx, ox + 45, oy + 7, 4, 1, "#6e4330");
  }
}
function kettleArt(ox, oy) {
  const x = ox + 50, y = oy + 1;
  ob(ctx, x, y + 2, 10, 7, "#c4664f", "#e0896f", "#9b4636"); px(ctx, x + 3, y, 4, 3, OL); px(ctx, x + 4, y + 1, 2, 1, "#c4664f");
  px(ctx, x + 10, y + 3, 2, 1, "#9b4636"); px(ctx, x + 11, y + 2, 1, 1, "#9b4636");
  if (kettle.on > 0) { px(ctx, x - 1, y + 9, 12, 1, "#f08040"); }
}
function fireArt(ox, oy, t) {
  const f = Math.floor(t / 90);
  const r = rng(f);
  const cols = ["#b4483c", "#f08040", "#f6c45a", "#fbe7a6"];
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 5; k++) {
      const x = ox + 16 + k * 3 + (r() * 2 | 0), h = (12 - i * 3) * (0.6 + r() * 0.5);
      px(ctx, x, oy + 33 - h, 2 + (i < 2 ? 1 : 0), h, cols[i]);
    }
  }
}
function recordArt(ox, oy, t) {
  const x = ox + 12, y = oy + 4;
  blob(ctx, x, y, 4, "#18141a", 0.8); blob(ctx, x, y, 1, S.record ? "#b4483c" : "#8a3530");
  if (S.record) { const a = t / 300; px(ctx, Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 2), 1, 1, "#55474f"); }
  px(ctx, ox + 19, oy + 1, 1, S.record ? 4 : 2, "#c3c9d1"); px(ctx, ox + 17, oy + (S.record ? 4 : 2), 2, 1, "#c3c9d1");
}
function drawParticle(p) {
  const a = clamp(p.life / (p.max || 1.5), 0, 1);
  const x = Math.round(p.x), y = Math.round(p.y);
  switch (p.type) {
    case "steam": px(ctx, x, y, 1, 1, `rgba(255,255,255,${0.55 * a})`); if (p.life > 0.8) px(ctx, x + 1, y - 1, 1, 1, `rgba(255,255,255,${0.3 * a})`); break;
    case "ember": px(ctx, x, y, 1, 1, `rgba(255,200,110,${a})`); break;
    case "mote": px(ctx, x, y, 1, 1, `rgba(255,240,200,${0.5 * Math.sin(a * Math.PI) * beamStrength()})`); break;
    case "leaf": px(ctx, x, y + Math.round(Math.sin(p.life * 3) * 2), 2, 1, p.c); break;
    case "heart": ctx.globalAlpha = a; drawIcon(ctx, HEART, x, y, "#e0707a"); ctx.globalAlpha = 1; break;
    case "note": ctx.globalAlpha = a; drawIcon(ctx, NOTE, x, y, "#fbf4e6"); ctx.globalAlpha = 1; break;
    case "zed": ctx.globalAlpha = a * 0.8; drawIcon(ctx, ZED, x, y, "#fbf4e6"); ctx.globalAlpha = 1; break;
  }
}
function drawRain(t) {
  if (S.weather !== "rain") { drops.length = 0; return; }
  const top = 20 * T;
  const want = 90;
  while (drops.length < want) drops.push({ x: cam.x + Math.random() * (VW + 40), y: cam.y - Math.random() * VH, land: top + Math.random() * (WORLD_H - top), s: 0 });
  ctx.save(); ctx.beginPath(); ctx.rect(0, 19 * T + 10, WORLD_W, WORLD_H); ctx.clip();
  for (const d of drops) {
    if (d.s > 0) { d.s -= 0.016; px(ctx, Math.round(d.x) - 1, Math.round(d.land), 3, 1, "rgba(210,225,240,.5)"); if (d.s <= 0) { d.x = cam.x + Math.random() * (VW + 40); d.y = cam.y - 10; d.land = Math.max(top, cam.y) + Math.random() * VH; } continue; }
    d.x -= 0.6; d.y += 4.2;
    if (d.y >= d.land) { d.s = 0.12; continue; }
    px(ctx, Math.round(d.x), Math.round(d.y), 1, 3, "rgba(200,215,235,.55)");
  }
  ctx.restore();
}

/* ======================================================================
   Go
   ====================================================================== */
drawBackground();
resize();
function frameLoop(now) {
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
  lastT = now;
  update(dt, now);
  render(now);
  requestAnimationFrame(frameLoop);
}
updateHud();
requestAnimationFrame(frameLoop);
// For testing only: /day/?debug exposes the state.
if (/[?&]debug\b/.test(location.search)) window.__qd = { get S() { return S; }, player, dog, cam, get scale() { return SCALE; }, get sitting() { return sitting; }, goTo, advance, walkTo(id) { const a = actionById[id]; goTo(a.use[0] * T + 8, a.use[1] * T + 12, a); } };
addEventListener("pagehide", () => { S.pos = { x: player.x, y: player.y, dir: player.dir }; save(); });
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
})();
