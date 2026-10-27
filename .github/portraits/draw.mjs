// Ink-and-flat-color portraits of writers, drawn by hand in code: bold ink
// outlines, flat skin and shadow shapes, hatching, a bright color behind.
// They're used in the portrait cards (.github/memes/memes.mjs) and reels.
//
//   npm install playwright   (once)
//   node .github/portraits/draw.mjs assets/portraits [name ...]
import { chromium } from "playwright";
import fs from "fs";
const OUT = process.argv[2], only = process.argv.slice(3);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const J = (r, a) => (r() - .5) * 2 * a;
const INK = "#16130f";
// An ink stroke that swells in the middle: a filled shape around a curve.
function brush(pts, w0, w1, w2 = w0) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i], [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)];
    let dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const t = i / (n - 1), w = t < .5 ? w0 + (w1 - w0) * t * 2 : w1 + (w2 - w1) * (t - .5) * 2;
    L.push([x - dy * w / 2, y + dx * w / 2]); R.push([x + dy * w / 2, y - dx * w / 2]);
  }
  return `<path d="M${L.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L")} L${R.reverse().map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L")} Z" fill="${INK}"/>`;
}
// Points along a cubic curve.
function cub(p0, p1, p2, p3, n = 30) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; o.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); }
  return o;
}
const stroke = (p0, p1, p2, p3, w0, w1, w2) => brush(cub(p0, p1, p2, p3), w0, w1, w2 ?? w0);
// Hatching: short parallel ink lines inside a shape.
function hatch(id, d, r, { ang = -50, gap = 9, len = 26, w = 1.6, n = 0, box = [0, 0, 1080, 1350], jit = 3 } = {}) {
  let s = `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`;
  const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  for (let y = box[1]; y < box[3]; y += gap) for (let x = box[0] + ((y / gap) % 2) * gap / 2; x < box[2]; x += gap) {
    const l = len * (0.6 + r() * 0.6), cx = x + J(r, jit), cy = y + J(r, jit);
    s += `<path d="M${cx - dx * l / 2} ${cy - dy * l / 2} L${cx + dx * l / 2} ${cy + dy * l / 2}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return s + "</g>";
}
const frame = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350"><rect width="1080" height="1350" fill="${bg}"/>${body}</svg>`;
const P = {};

/* ---------------- Susan Sontag ---------------- */
P.sontag = () => {
  const r = rng(7);
  const SKIN = "#f1c9a8", SH = "#d9a07e", SH2 = "#bf8264", HL = "#fbe3cf";
  let b = "";
  // hair behind: a big black mass, shoulder length, with volume
  const hairBack = "M300 985 C255 860 250 700 270 560 C290 420 350 320 450 280 C540 245 650 255 730 310 C810 370 840 480 840 620 C842 760 820 880 790 985 C760 1000 700 985 650 975 L430 975 C380 985 325 998 300 985 Z";
  b += `<path d="${hairBack}" fill="${INK}"/>`;
  // neck
  const neck = "M455 800 C460 880 452 930 440 975 L640 975 C625 930 618 880 622 800 Z";
  b += `<path d="${neck}" fill="${SKIN}" stroke="${INK}" stroke-width="6"/>`;
  b += `<path d="M455 820 C500 880 580 885 622 830 L622 870 C600 930 470 930 452 880 Z" fill="${SH}"/>`;
  // black turtleneck and jacket
  b += `<path d="M150 1350 C160 1190 230 1090 360 1040 C400 1025 430 1005 445 975 L635 975 C650 1005 680 1025 720 1040 C850 1090 920 1190 930 1350 Z" fill="${INK}"/>`;
  b += `<path d="M432 960 C470 1000 610 1000 648 960 L660 1035 C610 1065 470 1065 420 1035 Z" fill="#2a2621" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M440 1000 C480 1030 600 1030 640 1000 M436 1020 C480 1050 600 1050 645 1020" stroke="#4a443c" stroke-width="3" fill="none"/>`;
  b += `<path d="M360 1050 C380 1130 420 1240 450 1350 M720 1050 C700 1130 660 1240 630 1350" stroke="#4a443c" stroke-width="4" fill="none"/>`;
  b += `<path d="M250 1130 C270 1200 280 1280 280 1350 M830 1130 C810 1200 800 1280 800 1350" stroke="#4a443c" stroke-width="3" fill="none"/>`;
  // face
  const face = "M385 470 C372 540 370 610 380 680 C392 755 425 815 470 855 C495 876 525 884 550 880 C590 873 625 840 648 795 C672 745 688 680 692 610 C696 545 690 495 678 460 C620 420 440 420 385 470 Z";
  b += `<path d="${face}" fill="${SKIN}"/>`;
  // cel shadows: light from the left, so the right of the face is in shade
  const shR = "M640 470 C660 540 662 620 650 690 C638 760 610 820 560 860 C600 860 640 820 660 770 C682 715 692 640 690 570 C688 520 682 485 670 465 Z";
  b += `<path d="${shR}" fill="${SH}"/>`;
  b += hatch("shR", shR, r, { ang: -55, gap: 10, len: 22, w: 1.5, box: [560, 460, 700, 870] });
  b += `<path d="M400 690 C420 760 450 815 490 850 C455 830 420 780 405 720 Z" fill="${SH}"/>`;
  b += `<path d="M560 770 C590 760 615 730 625 690 C632 740 610 800 570 830 Z" fill="${SH}"/>`;
  // under the brows, eye sockets
  b += `<path d="M405 560 C430 540 490 540 515 560 C500 575 470 580 440 578 C425 576 412 572 405 560 Z" fill="${SH}"/>`;
  b += `<path d="M560 558 C585 540 645 540 668 560 C655 576 620 582 595 578 C580 575 568 568 560 558 Z" fill="${SH}"/>`;
  // nose: shadow on its right side, and under it
  b += `<path d="M530 570 C540 620 550 670 562 708 C560 722 545 728 530 726 C548 712 545 680 535 640 C528 610 524 590 530 570 Z" fill="${SH}"/>`;
  b += `<path d="M498 735 C515 748 545 750 566 740 C560 758 520 760 498 735 Z" fill="${SH2}"/>`;
  // chin and under the lip
  b += `<path d="M485 835 C515 860 560 860 590 838 C580 870 520 880 485 835 Z" fill="${SH}"/>`;
  b += `<path d="M500 812 C520 822 555 822 575 812 C560 832 515 832 500 812 Z" fill="${SH}"/>`;
  // highlights
  b += `<path d="M440 470 C480 452 560 450 600 466 C570 478 470 480 440 470 Z" fill="${HL}"/>`;
  b += `<path d="M420 650 C432 630 460 628 470 645 C455 660 430 664 420 650 Z" fill="${HL}"/>`;
  b += `<path d="M522 600 C526 640 530 670 532 690" stroke="${HL}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  // face outline in ink
  b += brush(cub([385, 470], [372, 540], [368, 620], [380, 690]), 3, 6, 5);
  b += brush(cub([380, 690], [392, 760], [428, 820], [480, 860]), 5, 7, 6);
  b += brush(cub([480, 860], [510, 882], [545, 886], [575, 872]), 6, 7, 5);
  b += brush(cub([575, 872], [615, 850], [645, 810], [662, 762]), 5, 8, 6);
  b += brush(cub([662, 762], [682, 700], [692, 620], [690, 540]), 6, 8, 4);
  // eyebrows: strong, dark, straight
  b += `<path d="M412 545 C430 528 470 522 512 532 C514 540 510 546 505 547 C470 540 440 542 418 553 Z" fill="${INK}"/>`;
  b += `<path d="M566 532 C600 520 640 522 668 540 L664 550 C640 540 605 538 570 545 C565 542 564 537 566 532 Z" fill="${INK}"/>`;
  // eyes: heavy-lidded, dark, looking out
  const eye = (cx, cy, w, s) => {
    let e = "";
    e += `<path d="M${cx - w} ${cy + 2} C${cx - w * .5} ${cy - 14} ${cx + w * .5} ${cy - 15} ${cx + w} ${cy - 1} C${cx + w * .5} ${cy + 10} ${cx - w * .5} ${cy + 11} ${cx - w} ${cy + 2} Z" fill="#f6efe6"/>`;
    e += `<circle cx="${cx + s * 2}" cy="${cy}" r="11" fill="#5a3a24"/><circle cx="${cx + s * 2}" cy="${cy}" r="5.5" fill="${INK}"/><circle cx="${cx + s * 2 + 3}" cy="${cy - 4}" r="2.6" fill="#fff"/>`;
    e += `<path d="M${cx - w} ${cy - 12} C${cx - w * .4} ${cy - 18} ${cx + w * .4} ${cy - 18} ${cx + w} ${cy - 12} L${cx + w} ${cy - 2} C${cx + w * .5} ${cy - 14} ${cx - w * .5} ${cy - 14} ${cx - w} ${cy + 1} Z" fill="${SH}" opacity="0.9"/>`;
    e += brush(cub([cx - w - 2, cy + 3], [cx - w * .5, cy - 15], [cx + w * .5, cy - 16], [cx + w + 3, cy - 2]), 2, 5, 3);
    e += brush(cub([cx - w + 4, cy - 14], [cx - w * .4, cy - 25], [cx + w * .4, cy - 25], [cx + w - 2, cy - 15]), 1, 2.6, 1);
    e += brush(cub([cx - w + 6, cy + 8], [cx - w * .4, cy + 15], [cx + w * .4, cy + 14], [cx + w - 4, cy + 4]), .8, 1.8, .8);
    e += brush(cub([cx - w * .3, cy + 22], [cx, cy + 27], [cx + w * .4, cy + 26], [cx + w * .8, cy + 18]), .6, 1.5, .5);
    return e;
  };
  b += eye(458, 591, 37, 1) + eye(609, 589, 34, 0);
  // nose in ink
  b += brush(cub([512, 575], [510, 620], [500, 670], [496, 700]), 1, 2.5, 3);
  b += brush(cub([496, 702], [488, 716], [494, 732], [512, 734]), 3, 4, 2);
  b += brush(cub([540, 738], [552, 740], [565, 734], [568, 722]), 2, 4, 2);
  b += `<path d="M515 728 C520 722 532 722 536 730 C530 734 520 734 515 728 Z" fill="${INK}"/>`;
  b += `<path d="M548 728 C552 722 560 722 563 729 C558 733 551 733 548 728 Z" fill="${INK}"/>`;
  // mouth: full lips, closed, serious
  b += `<path d="M468 786 C485 774 508 768 522 774 C530 770 545 770 552 774 C566 770 586 776 600 786 C575 790 495 792 468 786 Z" fill="#b8665a"/>`;
  b += `<path d="M472 788 C495 818 575 818 598 788 C570 794 500 794 472 788 Z" fill="#cf8070"/>`;
  b += `<path d="M512 800 C530 806 550 806 568 800" stroke="#e7a99a" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  b += brush(cub([462, 786], [500, 793], [565, 793], [604, 784]), 2, 4.5, 2);
  b += brush(cub([500, 828], [520, 834], [550, 834], [570, 828]), .5, 2, .5);
  b += brush(cub([462, 786], [458, 780], [456, 774], [458, 768]), 2.5, 2, 1);
  // a crease from the nose
  b += brush(cub([482, 735], [470, 748], [464, 760], [463, 772]), .4, 1.8, .4);
  // hair in front: swept back off the forehead, falling past the cheeks, with ink highlights
  const front = "M378 690 C356 600 360 480 395 420 C440 350 530 320 610 330 C690 342 735 400 740 480 C744 540 730 600 712 660 C708 600 700 540 680 500 C650 450 590 430 530 432 C470 434 420 460 400 520 C388 560 382 600 372 640 Z";
  b += `<path d="${front}" fill="${INK}"/>`;
  b += `<path d="M372 630 C360 700 365 780 385 840 C400 880 420 900 445 905 C415 860 395 790 390 720 C388 690 392 660 400 620 Z" fill="${INK}"/>`;
  b += `<path d="M712 650 C716 730 710 800 690 850 C675 885 655 900 630 905 C660 860 675 800 680 740 C683 710 690 690 700 640 Z" fill="${INK}"/>`;
  b += `<path d="M366 560 L402 560 C394 600 392 650 398 705 L368 705 Z" fill="${INK}"/>`;
  // the white streak, rising from her right temple and swept back over the top
  const streak = "M392 560 C385 500 398 440 440 395 C480 352 540 330 600 330 C560 345 520 372 495 410 C470 448 455 500 440 560 Z";
  b += `<path d="${streak}" fill="#f4f0e8"/>`;
  for (let i = 0; i < 6; i++) { const o = i * 13; b += brush(cub([402 + o * .5, 552 - o * .3], [398 + o, 480], [445 + o, 400], [525 + o * 1.4, 346 + o * .3]), .3, 1.8, .3); }

  // white ink flicks in the black hair, for shine and flow
  const flick = (p0, p1, p2, p3, w) => brush(cub(p0, p1, p2, p3), .3, w, .3).replace(`fill="${INK}"`, 'fill="#e9e2d6"');
  for (let i = 0; i < 14; i++) { const x = 300 + i * 6 + J(r, 4); b += flick([x + 40, 360 + i * 10], [x, 480 + i * 8], [x - 20, 640], [x - 10, 800 + J(r, 60)], 2.2); }
  for (let i = 0; i < 12; i++) { const x = 790 - i * 6 + J(r, 4); b += flick([x - 60, 330 + i * 8], [x, 450 + i * 6], [x + 15, 620], [x + 5, 780 + J(r, 60)], 2); }
  for (let i = 0; i < 10; i++) { b += flick([610 + i * 8, 336 + i * 2], [660 + i * 6, 360 + i * 4], [700 + i * 2, 420 + i * 6], [712 + J(r, 6), 520 + i * 12], 1.8); }
  return frame("#f2c230", b);
};


// An eye: white, iris, lid shadow, ink lid lines.
function eyeInk(cx, cy, w, s, iris, lidSh, o = {}) {
  let e = "";
  const up = o.up ?? 15, lo = o.lo ?? 11, ir = o.ir ?? 11;
  e += `<path d="M${cx - w} ${cy + 2} C${cx - w * .5} ${cy - up} ${cx + w * .5} ${cy - up - 1} ${cx + w} ${cy - 1} C${cx + w * .5} ${cy + lo} ${cx - w * .5} ${cy + lo + 1} ${cx - w} ${cy + 2} Z" fill="#f6efe6"/>`;
  e += `<clipPath id="eye${cx}"><path d="M${cx - w} ${cy + 2} C${cx - w * .5} ${cy - up} ${cx + w * .5} ${cy - up - 1} ${cx + w} ${cy - 1} C${cx + w * .5} ${cy + lo} ${cx - w * .5} ${cy + lo + 1} ${cx - w} ${cy + 2} Z"/></clipPath>`;
  e += `<g clip-path="url(#eye${cx})"><circle cx="${cx + s}" cy="${cy}" r="${ir}" fill="${iris}"/><circle cx="${cx + s}" cy="${cy}" r="${ir * .48}" fill="${INK}"/>
    <path d="M${cx - w} ${cy - 20} H${cx + w} V${cy - 3} C${cx} ${cy - 11} ${cx} ${cy - 11} ${cx - w} ${cy - 3} Z" fill="${lidSh}" opacity="0.8"/></g>`;
  e += `<circle cx="${cx + s + 3}" cy="${cy - 4}" r="2.6" fill="#fff"/>`;
  e += brush(cub([cx - w - 2, cy + 3], [cx - w * .5, cy - up - 1], [cx + w * .5, cy - up - 2], [cx + w + 3, cy - 2]), 2, 5, 3);
  e += brush(cub([cx - w + 4, cy - up + 1], [cx - w * .4, cy - up - 10], [cx + w * .4, cy - up - 10], [cx + w - 2, cy - up]), 1, 2.6, 1);
  e += brush(cub([cx - w + 6, cy + 8], [cx - w * .4, cy + lo + 4], [cx + w * .4, cy + lo + 3], [cx + w - 4, cy + 4]), .8, 1.8, .8);
  return e;
}
// Wavy ink strands for hair and beards.
function wisps(r, n, f, w = 2.4) { let s = ""; for (let i = 0; i < n; i++) s += brush(cub(...f(i / n, r)), .3, w * (.6 + r() * .6), .3); return s; }

// Short wavy clumps scattered inside a shape: the texture of a bushy beard.
function curls(r, id, d, box, n, colors, len = 34, w = 2.6) {
  let s = `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`;
  for (let i = 0; i < n; i++) {
    const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]);
    const sway = (x - 540) / 300, l = len * (.6 + r() * .8), c = colors[Math.floor(r() * colors.length)];
    s += brush(cub([x, y], [x + 10 + sway * 8, y + l * .33], [x - 10 + sway * 12, y + l * .66], [x + sway * 16 + J(r, 6), y + l]), .4, w * (.6 + r() * .7), .4).replace(`fill="${INK}"`, `fill="${c}"`);
  }
  return s + "</g>";
}
const clip = (id, d, inner) => `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;

/* ---------------- Herman Melville ---------------- */
P.melville = () => {
  const r = rng(21);
  const SKIN = "#efc3a0", SH = "#d39a76", SH2 = "#b77c5c", HL = "#fadfc8";
  const HAIR = "#6e4a2f", HAIRL = "#9c6c45", BEARD = "#94562f", BEARDL = "#c07a45", BEARDD = "#5e3219";
  let b = "";
  // coat: dark, high-buttoned, with a white collar showing
  b += `<path d="M120 1350 C130 1180 210 1090 340 1040 C400 1018 440 990 460 960 L640 960 C660 990 700 1018 760 1040 C890 1090 960 1180 970 1350 Z" fill="#1f2433"/>`;
  b += `<path d="M300 1080 C330 1160 350 1260 352 1350 M790 1080 C760 1160 740 1260 738 1350 M545 1060 C548 1160 550 1260 548 1350" stroke="#3a4258" stroke-width="4" fill="none"/>`;
  b += `<path d="M600 955 L668 985 L640 1030 L590 990 Z" fill="#f4efe4" stroke="${INK}" stroke-width="4"/>`;
  b += `<path d="M480 955 L420 985 L445 1028 L495 990 Z" fill="#f4efe4" stroke="${INK}" stroke-width="4"/>`;
  // ears
  b += `<path d="M380 560 C350 548 338 580 345 615 C352 650 368 668 392 664 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M372 585 C360 590 360 615 372 632" stroke="${SH2}" stroke-width="5" fill="none"/>`;
  b += `<path d="M700 560 C730 548 742 580 735 615 C728 650 712 668 690 664 Z" fill="${SH}" stroke="${INK}" stroke-width="5"/>`;
  // face
  const face = "M388 450 C375 520 372 600 380 680 C388 740 405 790 430 830 L655 830 C680 790 695 740 700 680 C706 600 704 520 692 450 C640 400 440 400 388 450 Z";
  b += `<path d="${face}" fill="${SKIN}"/>`;
  const shR = "M650 450 C672 520 676 600 668 680 C662 730 650 780 630 830 L660 830 C684 780 698 730 702 680 C708 600 704 520 690 455 Z";
  b += `<path d="${shR}" fill="${SH}"/>` + hatch("mshR", shR, r, { ang: -55, gap: 10, len: 22, w: 1.5, box: [620, 440, 710, 840] });
  b += `<path d="M400 550 C430 528 492 528 518 552 C500 568 470 572 440 570 C420 568 405 562 400 550 Z" fill="${SH}"/>`;
  b += `<path d="M562 552 C590 528 650 528 676 552 C660 568 625 572 598 568 C580 566 568 560 562 552 Z" fill="${SH}"/>`;
  b += `<path d="M534 560 C545 610 556 660 568 700 C565 715 550 720 536 718 C552 702 548 670 540 630 C534 600 530 580 534 560 Z" fill="${SH}"/>`;
  b += `<path d="M440 455 C490 438 580 436 630 452 C590 466 480 468 440 455 Z" fill="${HL}"/>`;
  b += `<path d="M420 640 C434 622 462 620 472 638 C456 652 432 656 420 640 Z" fill="${HL}"/>`;
  b += `<path d="M524 590 C528 630 532 664 534 684" stroke="${HL}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  // forehead lines, faint
  b += brush(cub([450, 488], [500, 478], [570, 478], [625, 488]), .4, 2, .4) + brush(cub([470, 508], [510, 500], [560, 500], [605, 508]), .4, 1.6, .4);
  // brows: moderate, brown
  b += `<path d="M408 540 C430 524 470 520 510 530 L508 541 C470 534 440 536 414 548 Z" fill="${BEARDD}"/>`;
  b += `<path d="M566 530 C600 520 640 522 672 538 L668 548 C640 536 605 535 570 541 Z" fill="${BEARDD}"/>`;
  b += wisps(r, 30, (t, r) => { const x = 412 + t * 96; return [[x, 544 - t * 10], [x + 4, 538 - t * 10], [x + 8, 534 - t * 8], [x + 12, 531 - t * 6]]; }, 1.6);
  // eyes: grey-blue, deep-set, steady
  b += eyeInk(458, 582, 34, 3, "#7d93a3", SH, { up: 12, lo: 10 }) + eyeInk(612, 580, 31, 2, "#7d93a3", SH, { up: 12, lo: 10 });
  b += brush(cub([432, 602], [450, 612], [480, 612], [492, 604]), .4, 1.6, .4) + brush(cub([588, 600], [605, 610], [632, 610], [642, 602]), .4, 1.6, .4);
  // nose
  b += brush(cub([515, 562], [512, 610], [502, 660], [497, 690]), 1, 2.6, 3);
  b += brush(cub([497, 692], [488, 708], [496, 724], [516, 726]), 3, 4, 2);
  b += brush(cub([542, 730], [556, 732], [570, 726], [572, 712]), 2, 4, 2);
  b += `<path d="M518 720 C524 714 536 714 540 722 C534 727 524 727 518 720 Z" fill="${INK}"/>`;
  b += `<path d="M552 720 C556 714 565 714 568 721 C563 725 556 725 552 720 Z" fill="${INK}"/>`;
  // the beard: full, reddish brown, from the cheeks down past the collar
  const beard = "M386 640 C372 720 368 800 378 870 C392 950 440 1010 510 1032 C590 1052 660 1010 690 940 C716 870 718 770 702 640 C690 680 670 712 640 724 C610 732 580 730 545 732 C505 730 475 734 445 726 C415 716 396 690 386 640 Z";
  b += `<path d="${beard}" fill="${BEARD}"/>`;
  b += `<path d="M600 760 C640 760 670 720 690 680 C700 800 690 900 660 960 C640 1000 610 1020 580 1028 C620 960 630 860 600 760 Z" fill="${BEARDD}" opacity="0.8"/>`;
  b += curls(r, "bd1", beard, [370, 650, 720, 1050], 420, [BEARDD, BEARDD, INK], 40, 3);
  b += curls(r, "bd2", beard, [380, 660, 640, 1040], 260, [BEARDL, "#d18b52"], 34, 2.6);
  // the beard's edge where it meets the cheek: soft, not a line
  b += curls(r, "bd3", "M370 600 L492 600 L492 760 L370 760 Z", [380, 640, 492, 700], 45, [BEARD, BEARDD], 30, 2.4);
  b += curls(r, "bd4", "M588 600 L720 600 L720 760 L588 760 Z", [588, 640, 705, 700], 45, [BEARD, BEARDD], 30, 2.4);
  // mustache over the mouth, with the lower lip just showing
  b += `<path d="M512 784 C525 778 555 778 568 784 C560 798 520 798 512 784 Z" fill="#c4766a" stroke="${INK}" stroke-width="2"/>`;
  const must = "M450 760 C470 730 510 726 540 738 C570 726 612 730 632 760 C640 776 636 790 626 796 C600 780 570 772 540 776 C510 772 480 780 456 796 C444 790 442 776 450 760 Z";
  b += `<path d="${must}" fill="${BEARD}"/>`;
  b += clip("mst", must, wisps(r, 50, (t, r) => { const s = t < .5 ? -1 : 1, u = (t * 2) % 1; return [[540 + s * 6, 738 + u * 8], [540 + s * (30 + u * 20), 740 + u * 12], [540 + s * (60 + u * 15), 756 + u * 12], [540 + s * (86 + u * 8), 792 + u * 4]]; }, 2.2));
  b += brush(cub([450, 760], [470, 730], [510, 726], [540, 738]), 2, 4, 2) + brush(cub([540, 738], [570, 726], [612, 730], [632, 760]), 2, 4, 2);
  b += brush(cub([386, 680], [370, 760], [370, 830], [380, 880]), 2, 6, 6) + brush(cub([380, 880], [395, 950], [440, 1010], [510, 1032]), 6, 7, 6);
  b += brush(cub([510, 1032], [590, 1052], [660, 1010], [690, 940]), 6, 7, 6) + brush(cub([690, 940], [716, 870], [718, 770], [704, 680]), 6, 7, 2);
  // face outline above the beard
  b += brush(cub([388, 450], [375, 520], [372, 600], [385, 670]), 3, 6, 5) + brush(cub([692, 450], [704, 520], [706, 600], [698, 670]), 3, 7, 5);
  // hair: swept back, wavy, full over the ears
  const hair = "M350 650 C320 570 326 470 362 400 C405 322 480 288 560 288 C652 290 722 330 752 404 C778 470 772 570 746 650 C730 600 720 560 705 520 C695 470 670 440 630 432 C590 425 520 422 470 430 C430 438 405 465 392 510 C380 550 370 600 352 640 Z";
  b += `<path d="${hair}" fill="${HAIR}"/>`;
  b += `<path d="M650 330 C710 360 750 420 752 500 C754 560 745 610 740 640 C732 600 722 560 708 520 C700 470 680 440 640 430 C680 400 690 360 650 330 Z" fill="#4a301c"/>`;
  b += clip("hrw", hair, Array.from({ length: 9 }, (_, i) => { const y = 330 + i * 34; return brush(cub([330, y + 40], [430, y - 20], [520, y + 30], [600, y - 10]), .5, 3.4, .5) + brush(cub([600, y - 10], [670, y - 40], [720, y + 10], [770, y + 50]), .5, 3.4, .5); }).join("").replaceAll(`fill="${INK}"`, `fill="#4a301c"`));
  b += clip("hr1", hair, wisps(r, 70, (t, r) => { const x = 380 + t * 360; const y = 430 - Math.sin(t * Math.PI) * 30; return [[x + J(r, 5), y + J(r, 6)], [x + (x - 560) * .25 + J(r, 10), y - 60], [x + (x - 560) * .4 + J(r, 15), y - 110], [560 + (x - 560) * 1.25 + J(r, 20), 330 + Math.abs(x - 560) * .25 + J(r, 15)]]; }, 2.4));
  b += clip("hr2", hair, wisps(r, 40, (t, r) => { const x = 400 + t * 300; const y = 425 - Math.sin(t * Math.PI) * 30; return [[x, y], [x + (x - 560) * .25, y - 55], [x + (x - 560) * .4, y - 100], [560 + (x - 560) * 1.2, 340 + Math.abs(x - 560) * .25]]; }, 2.4).replaceAll(`fill="${INK}"`, `fill="${HAIRL}"`));
  b += clip("hr3", hair, wisps(r, 24, (t, r) => { const s = t < .5 ? -1 : 1, u = (t * 2) % 1; return [[540 + s * 170, 470 + u * 60], [540 + s * (205 + J(r, 8)), 520 + u * 50], [540 + s * (200 + J(r, 8)), 580 + u * 30], [540 + s * (190 + J(r, 6)), 630 + u * 10]]; }, 2.6));
  b += brush(cub([350, 650], [320, 570], [326, 470], [362, 400]), 4, 7, 6) + brush(cub([362, 400], [405, 322], [480, 288], [560, 288]), 6, 7, 6);
  b += brush(cub([560, 288], [652, 290], [722, 330], [752, 404]), 6, 7, 6) + brush(cub([752, 404], [778, 470], [772, 570], [746, 650]), 6, 7, 4);
  return frame("#45b3c4", b);
};

/* ---------------- Jean-Paul Sartre ---------------- */
P.sartre = () => {
  const r = rng(33);
  const SKIN = "#f0c6a4", SH = "#d49d7b", SH2 = "#b97f60", HL = "#fbe2cd";
  let b = "";
  // suit, shirt, tie
  b += `<path d="M110 1350 C120 1190 200 1090 330 1040 C390 1018 430 995 450 965 L630 965 C650 995 690 1018 750 1040 C880 1090 960 1190 970 1350 Z" fill="#6f7178"/>`;
  b += `<path d="M450 965 L540 1060 L630 965 L660 1000 L540 1350 L420 1000 Z" fill="#f4efe4" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M520 1040 L560 1040 L580 1250 L540 1350 L500 1250 Z" fill="#2b2e3b" stroke="${INK}" stroke-width="4"/>`;
  b += `<path d="M515 1000 L565 1000 L560 1045 L520 1045 Z" fill="#2b2e3b" stroke="${INK}" stroke-width="4"/>`;
  b += `<path d="M420 1000 L330 1040 L450 1240 L500 1350 M660 1000 L750 1040 L630 1240 L580 1350" stroke="${INK}" stroke-width="5" fill="#7c7e86"/>`;
  b += hatch("suit", "M110 1350 C120 1190 200 1090 330 1040 L450 1240 L500 1350 Z M970 1350 C960 1190 880 1090 750 1040 L630 1240 L580 1350 Z", r, { ang: 60, gap: 18, len: 20, w: 1.3, box: [100, 1030, 980, 1350] });
  // neck
  b += `<path d="M452 830 C455 900 448 940 440 968 L640 968 C632 940 625 900 628 830 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M465 850 C500 905 580 905 615 850 L615 890 C590 935 490 935 465 890 Z" fill="${SH}"/>`;
  // big ears
  b += `<path d="M385 560 C340 540 322 580 330 625 C338 672 362 696 395 688 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M370 585 C352 592 350 630 368 660" stroke="${SH2}" stroke-width="6" fill="none"/>`;
  b += `<path d="M695 560 C740 540 758 580 750 625 C742 672 718 696 685 688 Z" fill="${SH}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M710 585 C728 592 730 630 712 660" stroke="${SH2}" stroke-width="6" fill="none"/>`;
  // a broad face with a soft chin
  const face = "M392 450 C376 520 374 600 382 670 C392 750 430 820 480 852 C510 870 570 870 600 852 C650 820 688 750 698 670 C706 600 704 520 688 450 C640 405 440 405 392 450 Z";
  b += `<path d="${face}" fill="${SKIN}"/>`;
  b += `<path d="M400 470 C420 420 470 395 540 392 C610 395 660 420 682 470 Z" fill="${SKIN}"/>`;
  const shR = "M648 455 C668 525 672 600 664 670 C655 750 625 815 585 850 C620 845 660 805 680 750 C700 690 704 600 698 530 C694 495 688 470 680 455 Z";
  b += `<path d="${shR}" fill="${SH}"/>` + hatch("sshR", shR, r, { ang: -55, gap: 10, len: 22, w: 1.5, box: [580, 450, 705, 860] });
  b += `<path d="M405 700 C425 770 455 815 495 845 C455 830 420 780 408 730 Z" fill="${SH}"/>`;
  b += `<path d="M535 640 C548 680 560 712 566 735 C560 750 545 754 530 750 C550 735 548 700 540 670 Z" fill="${SH}"/>`;
  b += `<path d="M490 830 C520 850 565 850 595 832 C580 865 520 868 490 830 Z" fill="${SH}"/>`;
  b += `<path d="M440 455 C490 438 590 436 640 452 C600 466 480 468 440 455 Z" fill="${HL}"/>`;
  b += brush(cub([455, 490], [500, 480], [580, 480], [630, 492]), .4, 2, .4) + brush(cub([470, 512], [515, 503], [565, 503], [612, 512]), .4, 1.6, .4);
  // the nose: short and broad
  b += brush(cub([520, 625], [518, 670], [508, 705], [500, 728]), 1, 2.6, 3);
  b += brush(cub([500, 730], [486, 745], [496, 764], [520, 764]), 3, 4.5, 2);
  b += brush(cub([548, 768], [568, 770], [584, 760], [584, 742]), 2, 4.5, 2);
  b += `<path d="M520 758 C527 750 540 750 546 760 C538 765 527 765 520 758 Z" fill="${INK}"/>`;
  b += `<path d="M556 758 C561 751 571 751 574 759 C568 764 560 764 556 758 Z" fill="${INK}"/>`;
  b += `<path d="M538 690 C541 710 543 725 544 738" stroke="${HL}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
  // a wide mouth, full lower lip
  b += `<path d="M462 808 C490 798 520 794 538 800 C556 794 590 798 612 808 C580 813 495 813 462 808 Z" fill="#b5675b"/>`;
  b += `<path d="M466 810 C495 840 585 840 608 810 C580 818 495 818 466 810 Z" fill="#c97b6c"/>`;
  b += brush(cub([456, 808], [500, 815], [575, 815], [616, 806]), 2, 4.5, 2);
  b += brush(cub([480, 768], [466, 780], [458, 795], [458, 810]), .4, 2, .4) + brush(cub([600, 768], [612, 780], [618, 795], [618, 808]), .4, 2, .4);
  // the pipe, in the right side of his mouth
  b += brush(cub([585, 812], [620, 822], [660, 836], [690, 848]), 7, 8, 9);
  b += `<path d="M676 840 C676 820 730 818 732 840 L728 900 C726 922 684 924 680 900 Z" fill="#6a3d22" stroke="${INK}" stroke-width="5"/>`;
  b += `<ellipse cx="704" cy="840" rx="28" ry="8" fill="#2a1a10" stroke="${INK}" stroke-width="4"/>`;
  b += `<path d="M690 868 C700 875 712 875 720 868" stroke="#9a6440" stroke-width="3" fill="none"/>`;
  b += `<path d="M712 826 C700 790 735 770 728 735 C720 705 748 690 745 655" stroke="#f4efe4" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  // brows, raised
  b += `<path d="M412 548 C435 530 470 525 505 532 L503 541 C470 536 440 540 418 556 Z" fill="#3a2a20"/>`;
  b += `<path d="M575 532 C610 524 645 530 668 548 L662 556 C640 541 610 536 577 541 Z" fill="#3a2a20"/>`;
  // eyes behind the glasses: his right eye (our left) turned outward
  b += eyeInk(465, 596, 27, -12, "#6e5a44", SH, { up: 11, lo: 9, ir: 9 }) + eyeInk(615, 596, 27, 0, "#6e5a44", SH, { up: 11, lo: 9, ir: 9 });
  // round glasses: thick dark frames, pale lenses with a glint
  for (const cx of [465, 615]) {
    b += `<circle cx="${cx}" cy="598" r="54" fill="#dfe9ee" opacity="0.28"/>`;
    b += `<path d="M${cx - 30} ${560} C${cx - 10} ${550} ${cx + 15} ${552} ${cx + 30} ${562}" stroke="#fff" stroke-width="5" fill="none" opacity="0.8" stroke-linecap="round"/>`;
    b += `<circle cx="${cx}" cy="598" r="54" fill="none" stroke="${INK}" stroke-width="10"/>`;
  }
  b += brush(cub([519, 590], [530, 578], [550, 578], [561, 590]), 6, 7, 6);
  b += brush(cub([411, 590], [395, 586], [385, 588], [376, 596]), 6, 6, 4) + brush(cub([669, 590], [685, 586], [695, 588], [704, 596]), 6, 6, 4);
  // thinning hair, combed straight back
  const hair = "M376 560 C368 480 385 410 440 372 C490 340 590 336 645 366 C700 396 716 470 706 560 C698 520 688 490 670 470 C650 420 610 410 600 430 C560 400 500 400 470 425 C440 430 420 455 405 490 C395 515 385 540 376 560 Z";
  b += `<path d="${hair}" fill="#2b2420"/>`;
  b += clip("srh", hair, Array.from({ length: 40 }, (_, i) => { const x = 380 + i * 8.5; return brush(cub([x, 560 - Math.abs(x - 540) * .3], [x + (x - 540) * .1, 470], [x + (x - 540) * .3, 400], [540 + (x - 540) * 1.3, 350]), .3, 1.8, .3); }).join("").replaceAll(`fill="${INK}"`, `fill="#6b5e55"`));
  // outline
  b += brush(cub([392, 450], [376, 520], [374, 600], [382, 670]), 3, 6, 5) + brush(cub([382, 670], [392, 750], [430, 820], [480, 852]), 5, 7, 6);
  b += brush(cub([480, 852], [510, 870], [570, 870], [600, 852]), 6, 7, 6) + brush(cub([600, 852], [650, 820], [688, 750], [698, 670]), 6, 8, 6) + brush(cub([698, 670], [706, 600], [704, 520], [688, 450]), 6, 8, 3);
  b += brush(cub([376, 560], [368, 480], [385, 410], [440, 372]), 3, 6, 5) + brush(cub([440, 372], [490, 340], [590, 336], [645, 366]), 5, 7, 5) + brush(cub([645, 366], [700, 396], [716, 470], [706, 560]), 5, 7, 3);
  return frame("#ef8fa8", b);
};

/* ---------------- Arthur Rimbaud ---------------- */
P.rimbaud = () => {
  const r = rng(17);
  const SKIN = "#f3cdb0", SH = "#d9a584", SH2 = "#bd8668", HL = "#fde6d4";
  const HAIR = "#3b2a20", HAIRL = "#7a5a44";
  let b = "";
  // coat, shirt collar, a loose cravat
  b += `<path d="M130 1350 C140 1190 220 1095 350 1045 C405 1024 440 1000 458 968 L622 968 C640 1000 675 1024 730 1045 C860 1095 940 1190 950 1350 Z" fill="#2c2a33"/>`;
  b += `<path d="M300 1080 C330 1170 345 1270 348 1350 M780 1080 C750 1170 735 1270 732 1350" stroke="#4a4756" stroke-width="4" fill="none"/>`;
  b += `<path d="M458 960 L540 1040 L622 960 L650 1010 L560 1080 L540 1060 L520 1080 L430 1010 Z" fill="#f4efe4" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M505 1045 C520 1030 560 1030 575 1045 C590 1080 600 1130 585 1170 C570 1130 555 1100 540 1090 C525 1100 510 1130 495 1170 C480 1130 490 1080 505 1045 Z" fill="#1d1b22" stroke="${INK}" stroke-width="4"/>`;
  b += `<ellipse cx="540" cy="1050" rx="24" ry="17" fill="#1d1b22" stroke="${INK}" stroke-width="4"/>`;
  b += `<path d="M430 1010 L350 1045 L440 1200 M650 1010 L730 1045 L640 1200" stroke="${INK}" stroke-width="5" fill="#35333e"/>`;
  // neck
  b += `<path d="M472 830 C474 900 466 935 458 968 L622 968 C614 935 606 900 608 830 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M472 845 C505 900 575 900 608 845 L608 885 C585 925 495 925 472 885 Z" fill="${SH}"/>`;
  // a young, soft, oval face
  const face = "M398 470 C384 540 382 610 392 680 C404 760 440 820 490 852 C515 866 560 868 585 852 C635 820 672 760 684 680 C694 610 692 540 678 470 C630 420 445 420 398 470 Z";
  b += `<path d="${face}" fill="${SKIN}"/>`;
  const shR = "M638 475 C660 545 662 620 652 690 C640 765 608 820 565 855 C610 850 650 810 668 760 C688 700 692 620 688 550 C686 510 680 485 670 470 Z";
  b += `<path d="${shR}" fill="${SH}"/>` + hatch("rshR", shR, r, { ang: -55, gap: 10, len: 22, w: 1.4, box: [560, 465, 700, 865] });
  b += `<path d="M410 700 C430 765 460 812 500 845 C462 830 428 785 414 735 Z" fill="${SH}"/>`;
  b += `<path d="M412 562 C440 542 492 544 516 564 C500 578 468 582 440 579 C424 577 416 571 412 562 Z" fill="${SH}"/>`;
  b += `<path d="M562 564 C586 544 640 542 664 562 C650 577 622 582 596 579 C580 577 568 572 562 564 Z" fill="${SH}"/>`;
  b += `<path d="M528 580 C540 630 552 675 560 708 C556 722 544 726 530 724 C546 708 543 676 535 640 C528 610 525 595 528 580 Z" fill="${SH}"/>`;
  b += `<path d="M488 832 C515 852 560 852 588 834 C575 864 515 868 488 832 Z" fill="${SH}"/>`;
  b += `<path d="M430 650 C442 632 468 630 476 646 C462 660 440 664 430 650 Z" fill="${HL}"/>`;
  b += `<path d="M520 600 C524 640 528 668 530 690" stroke="${HL}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  // brows: thin, a little sullen, slanting down at the inner ends
  b += `<path d="M418 546 C440 534 475 532 508 544 L506 553 C475 544 445 546 422 556 Z" fill="${HAIR}"/>`;
  b += `<path d="M568 544 C600 532 636 534 660 548 L656 557 C632 547 600 545 570 553 Z" fill="${HAIR}"/>`;
  // pale eyes, wide-set, looking a little past us
  b += eyeInk(462, 594, 33, -3, "#8fb3c9", SH, { up: 13, lo: 10, ir: 11 }) + eyeInk(614, 592, 31, -4, "#8fb3c9", SH, { up: 13, lo: 10, ir: 11 });
  b += brush(cub([436, 614], [452, 624], [478, 624], [492, 615]), .3, 1.4, .3) + brush(cub([590, 612], [606, 621], [630, 621], [642, 613]), .3, 1.4, .3);
  // nose
  b += brush(cub([512, 580], [510, 625], [500, 668], [496, 696]), 1, 2.4, 3);
  b += brush(cub([496, 698], [488, 712], [496, 728], [514, 730]), 3, 4, 2);
  b += brush(cub([540, 734], [553, 736], [566, 730], [568, 716]), 2, 4, 2);
  b += `<path d="M516 724 C522 718 534 718 538 726 C532 730 522 730 516 724 Z" fill="${INK}"/>`;
  b += `<path d="M548 724 C552 718 560 718 563 725 C558 729 551 729 548 724 Z" fill="${INK}"/>`;
  // a full, slightly sulky mouth
  b += `<path d="M474 788 C492 778 512 772 526 778 C534 774 548 774 556 778 C570 772 588 778 604 788 C580 792 500 794 474 788 Z" fill="#c07466"/>`;
  b += `<path d="M478 790 C500 822 578 822 600 790 C575 797 503 797 478 790 Z" fill="#d68b7b"/>`;
  b += `<path d="M516 804 C532 810 550 810 564 804" stroke="#efb3a3" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  b += brush(cub([468, 788], [505, 795], [570, 795], [610, 786]), 2, 4.5, 2);
  b += brush(cub([466, 788], [462, 794], [464, 800], [470, 804]), 2, 2, .5) + brush(cub([612, 786], [618, 792], [616, 799], [610, 803]), 2, 2, .5);
  // outline
  b += brush(cub([398, 470], [384, 540], [382, 610], [392, 680]), 3, 6, 5) + brush(cub([392, 680], [404, 760], [440, 820], [490, 852]), 5, 7, 6);
  b += brush(cub([490, 852], [515, 866], [560, 868], [585, 852]), 6, 7, 6) + brush(cub([585, 852], [635, 820], [672, 760], [684, 680]), 6, 8, 6) + brush(cub([684, 680], [694, 610], [692, 540], [678, 470]), 6, 8, 3);
  // ears, half hidden by the hair
  b += `<path d="M394 590 C372 580 362 605 368 632 C374 658 388 670 402 664 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  b += `<path d="M682 590 C704 580 714 605 708 632 C702 658 688 670 674 664 Z" fill="${SH}" stroke="${INK}" stroke-width="5"/>`;
  // the hair: a wild, uncombed mop, locks falling over the forehead and sticking out at the sides
  const hair = "M352 640 C330 600 322 540 336 480 C340 440 330 410 352 380 C372 340 400 320 440 300 C470 278 520 266 570 272 C620 270 670 290 705 320 C740 350 752 390 748 430 C760 470 758 530 742 580 C735 610 724 630 712 646 C706 600 700 575 692 552 Q686 590 676 568 Q662 520 652 512 Q648 560 634 556 Q620 510 612 502 Q604 548 588 546 Q574 506 566 496 Q556 540 544 542 Q530 504 522 498 Q514 546 500 550 Q488 510 480 504 Q468 556 460 562 Q448 524 440 515 Q430 572 420 578 Q412 548 405 538 Q398 590 392 600 C378 615 366 628 352 640 Z";
  b += `<path d="${hair}" fill="${HAIR}"/>`;
  // locks: curved ink strokes, light and dark, for the tangle
  const lock = (p0, p1, p2, p3, w, c) => brush(cub(p0, p1, p2, p3), .4, w, .4).replace(`fill="${INK}"`, `fill="${c}"`);
  for (let i = 0; i < 46; i++) {
    const x = 350 + r() * 390, y = 300 + r() * 220, d = x < 540 ? -1 : 1, l = 50 + r() * 70;
    b += clip("rh" + i, hair, lock([x, y], [x + d * 20 + J(r, 20), y + l * .3], [x + d * 10 + J(r, 30), y + l * .7], [x + d * (25 + J(r, 20)), y + l], 3.2, r() < .55 ? INK : HAIRL));
  }
  // stray locks breaking the outline
  b += lock([360, 400], [330, 380], [318, 350], [330, 320], 5, HAIR) + lock([420, 315], [400, 285], [405, 255], [430, 240], 6, HAIR);
  b += lock([600, 280], [630, 250], [665, 245], [690, 255], 6, HAIR) + lock([735, 390], [770, 370], [785, 340], [778, 312], 5, HAIR);
  b += lock([740, 520], [770, 520], [790, 545], [790, 575], 5, HAIR) + lock([345, 560], [318, 565], [305, 590], [310, 620], 5, HAIR);
  b += brush(cub([352, 640], [330, 600], [322, 540], [336, 480]), 3, 6, 5) + brush(cub([336, 480], [340, 440], [330, 410], [352, 380]), 5, 6, 5);
  b += brush(cub([352, 380], [372, 340], [400, 320], [440, 300]), 5, 6, 5) + brush(cub([440, 300], [470, 278], [520, 266], [570, 272]), 5, 7, 5);
  b += brush(cub([570, 272], [620, 270], [670, 290], [705, 320]), 5, 7, 5) + brush(cub([705, 320], [740, 350], [752, 390], [748, 430]), 5, 7, 5);
  b += brush(cub([748, 430], [760, 470], [758, 530], [742, 580]), 5, 6, 5) + brush(cub([742, 580], [735, 610], [724, 630], [712, 646]), 5, 5, 3);
  return frame("#e4572e", b);
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [k, f] of Object.entries(P)) {
  if (only.length && !only.includes(k)) continue;
  const svg = f(); fs.writeFileSync(`${OUT}/${k}.svg`, svg);
  await tab.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
  await tab.locator("svg").screenshot({ path: `${OUT}/${k}.jpg`, type: "jpeg", quality: 92 });
  console.log("drew", k);
}
await browser.close();
