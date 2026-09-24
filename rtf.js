// Longhand's Rich Text Format reader and writer.
//
// A document is a list of blocks: { tag: "p" | "h2", runs: [...] }.
// A run is either { text, b, i } (bold / italic flags) or { br: true } for a line break.
(function (root) {
  "use strict";

  // ---------- writing ----------

  function escapeText(s) {
    let out = "";
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
      else if (ch === "\t") out += "\\tab ";
      else if (ch === "\n" || ch === "\r") out += "\\line ";
      else if (c < 0x80) out += ch;
      else if (c < 0x10000) out += "\\u" + (c > 32767 ? c - 65536 : c) + "?";
      else {
        const v = c - 0x10000;
        out += "\\u" + ((0xd800 + (v >> 10)) - 65536) + "?\\u" + ((0xdc00 + (v & 0x3ff)) - 65536) + "?";
      }
    }
    return out;
  }

  function runsToRTF(runs, inHeading) {
    return runs.map((r) => {
      if (r.br) return "\\line ";
      if (!r.text) return "";
      const bold = r.b && !inHeading;
      const on = (bold ? "\\b" : "") + (r.i ? "\\i" : "");
      return on ? "{" + on + " " + escapeText(r.text) + "}" : escapeText(r.text);
    }).join("");
  }

  const PARA = "\\pard\\plain\\s0\\sa240\\sl360\\slmult1\\f0\\fs24 ";
  const HEAD = "\\pard\\plain\\s1\\sb360\\sa120\\keepn\\outlinelevel0\\f0\\fs32\\b ";

  function toRTF(blocks) {
    let out =
      "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n" +
      "{\\fonttbl{\\f0\\froman\\fcharset0 Georgia;}}\n" +
      "{\\stylesheet{\\s0\\sa240\\sl360\\slmult1\\f0\\fs24 Normal;}" +
      "{\\s1\\sb360\\sa120\\keepn\\outlinelevel0\\b\\f0\\fs32 Heading 1;}}\n" +
      "{\\*\\generator Longhand;}\n" +
      "\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440\\viewkind1\n";
    for (const b of blocks) {
      const h = b.tag === "h2";
      out += (h ? HEAD : PARA) + runsToRTF(b.runs || [], h) + "\\par\n";
    }
    return out + "}\n";
  }

  // ---------- reading ----------

  // Groups whose contents are settings, not words.
  const SKIP = new Set([
    "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "headerl", "headerr",
    "headerf", "footer", "footerl", "footerr", "footerf", "footnote", "annotation", "listtable",
    "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "themedata", "colorschememapping",
    "latentstyles", "datastore", "mmathPr", "pgdsctbl", "revtbl", "filetbl", "fldinst", "atnid",
    "atnauthor", "bkmkstart", "bkmkend", "nonshppict", "shp", "shpinst", "sp", "userprops", "docvar",
    "expandedcolortbl", "pntext", "pntxta", "pntxtb", "ftnsep", "ftnsepc", "aftnsep", "aftnsepc",
  ]);

  const WORDS = {
    emdash: "\u2014", endash: "\u2013", lquote: "\u2018", rquote: "\u2019",
    ldblquote: "\u201c", rdblquote: "\u201d", bullet: "\u2022", tab: " ",
    emspace: " ", enspace: " ", qmspace: " ",
  };

  const CP1252 = {
    0x80: "\u20ac", 0x82: "\u201a", 0x83: "\u0192", 0x84: "\u201e", 0x85: "\u2026", 0x86: "\u2020",
    0x87: "\u2021", 0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160", 0x8b: "\u2039", 0x8c: "\u0152",
    0x8e: "\u017d", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022",
    0x96: "\u2013", 0x97: "\u2014", 0x98: "\u02dc", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a",
    0x9c: "\u0153", 0x9e: "\u017e", 0x9f: "\u0178",
  };

  function fromRTF(src) {
    const blocks = [];
    let runs = [];
    let heading = false;
    let st = { b: false, i: false, skip: false, uc: 1 };
    const stack = [];
    let skipChars = 0;
    const word = /\\([a-zA-Z]+)(-?\d+)? ?/y;
    const n = src.length;
    let i = 0;

    function add(t) {
      if (st.skip || !t) return;
      const last = runs[runs.length - 1];
      if (last && !last.br && last.b === st.b && last.i === st.i) last.text += t;
      else runs.push({ text: t, b: st.b, i: st.i });
    }
    function endPara() {
      if (st.skip) return;
      blocks.push({ tag: heading ? "h2" : "p", runs });
      runs = [];
    }

    while (i < n) {
      const ch = src[i];
      if (ch === "{") {
        stack.push(Object.assign({}, st));
        i++;
        if (src.startsWith("\\*", i)) st.skip = true;
        else {
          word.lastIndex = i;
          const m = word.exec(src);
          if (m && SKIP.has(m[1])) st.skip = true;
        }
        continue;
      }
      if (ch === "}") {
        if (stack.length) st = stack.pop();
        i++;
        continue;
      }
      if (ch === "\\") {
        const nx = src[i + 1];
        if (nx === "\\" || nx === "{" || nx === "}") {
          i += 2;
          if (skipChars > 0) skipChars--; else add(nx);
          continue;
        }
        if (nx === "'") {
          const code = parseInt(src.substr(i + 2, 2), 16);
          i += 4;
          if (skipChars > 0) { skipChars--; continue; }
          if (!isNaN(code)) add(CP1252[code] || String.fromCharCode(code));
          continue;
        }
        if (nx === "\n" || nx === "\r") { i += 2; endPara(); continue; }
        if (nx === "~") { i += 2; add(" "); continue; }
        if (nx === "_") { i += 2; add("-"); continue; }
        word.lastIndex = i;
        const m = word.exec(src);
        if (!m) { i += 2; continue; }
        i = word.lastIndex;
        const w = m[1];
        const arg = m[2] === undefined ? null : parseInt(m[2], 10);
        switch (w) {
          case "par": endPara(); break;
          case "line": if (!st.skip) runs.push({ br: true }); break;
          case "pard": heading = false; break;
          case "outlinelevel": if (!st.skip && arg !== null && arg <= 2) heading = true; break;
          case "plain": st.b = false; st.i = false; break;
          case "b": st.b = arg !== 0; break;
          case "i": st.i = arg !== 0; break;
          case "uc": st.uc = arg === null ? 1 : arg; break;
          case "u": {
            if (arg === null) break;
            add(String.fromCharCode(arg < 0 ? arg + 65536 : arg));
            skipChars = st.uc;
            break;
          }
          case "cell": case "row": case "page": case "sect":
            if (runs.length) endPara();
            break;
          default:
            if (WORDS[w]) add(WORDS[w]);
        }
        continue;
      }
      if (ch === "\r" || ch === "\n") { i++; continue; }
      let j = i;
      while (j < n && src[j] !== "\\" && src[j] !== "{" && src[j] !== "}" && src[j] !== "\r" && src[j] !== "\n") j++;
      let t = src.slice(i, j);
      i = j;
      if (skipChars > 0) {
        const k = Math.min(skipChars, t.length);
        t = t.slice(k);
        skipChars -= k;
      }
      add(t);
    }
    if (runs.length) endPara();

    // Word and others often end with an empty paragraph or two.
    while (blocks.length > 1 && isEmpty(blocks[blocks.length - 1])) blocks.pop();
    return blocks;
  }

  function isEmpty(block) {
    return !block.runs.some((r) => r.br || (r.text && r.text.trim()));
  }

  const RTF = { toRTF, fromRTF };
  if (typeof module !== "undefined" && module.exports) module.exports = RTF;
  else root.RTF = RTF;
})(typeof window !== "undefined" ? window : globalThis);
