(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const editor = $("editor");
  const SIZES = [16, 17.5, 19, 21, 23.5];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canUseFiles = "showSaveFilePicker" in window;
  // Shortcut labels: ⌘ on a Mac, Ctrl everywhere else. The shortcuts themselves accept either key.
  const isMac = /Mac|iPhone|iPad/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
  const key = (k, shift) => (isMac ? (shift ? "\u21e7\u2318" : "\u2318") + k : "Ctrl+" + (shift ? "Shift+" : "") + k);

  // ---------- small stores ----------
  // Settings live in localStorage; the writing itself lives in IndexedDB.
  const prefsStore = {
    get(k, fallback) { try { const v = localStorage.getItem("longhand." + k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem("longhand." + k, JSON.stringify(v)); } catch (e) { /* not essential */ } },
  };

  const db = (() => {
    let opening;
    function open() {
      return opening || (opening = new Promise((resolve, reject) => {
        const req = indexedDB.open("longhand", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("pieces", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    }
    async function run(mode, fn) {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction("pieces", mode);
        const req = fn(tx.objectStore("pieces"));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return {
      all: () => run("readonly", (s) => s.getAll()),
      put: (p) => run("readwrite", (s) => s.put(p)),
      del: (id) => run("readwrite", (s) => s.delete(id)),
    };
  })();

  // ---------- cleaning HTML down to paragraphs, headings, italic, bold ----------
  const BLOCK = /^(P|DIV|H[1-6]|BLOCKQUOTE|LI|PRE)$/;
  const CONTAINER = /^(UL|OL|SECTION|ARTICLE|MAIN|HEADER|FOOTER|TABLE|THEAD|TBODY|TR|TD|TH|BODY|HTML)$/;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inlineOf(n) {
    if (n.nodeType === 3) return esc(n.nodeValue.replace(/[\t\r\n]+/g, " ").replace(/ /g, " "));
    if (n.nodeType !== 1) return "";
    const t = n.tagName;
    if (t === "BR") return "<br>";
    if (/^(SCRIPT|STYLE|META|LINK|TITLE|HEAD)$/.test(t)) return "";
    const st = n.getAttribute("style") || "";
    let inner = inlineChildren(n);
    const italic = t === "EM" || t === "I" || /font-style:\s*italic/i.test(st);
    const bold = ((t === "STRONG" || t === "B") && !/font-weight:\s*(normal|[1-5]00)/i.test(st))
      || /font-weight:\s*(bold|[6-9]00)/i.test(st);
    if (bold && inner.trim()) inner = "<strong>" + inner + "</strong>";
    if (italic && inner.trim()) inner = "<em>" + inner + "</em>";
    return inner;
  }
  function inlineChildren(el) { let s = ""; el.childNodes.forEach((c) => { s += inlineOf(c); }); return s; }
  function hasBlockChild(el) {
    for (const c of el.children) if (BLOCK.test(c.tagName) || CONTAINER.test(c.tagName) || hasBlockChild(c)) return true;
    return false;
  }
  function blocksOf(root) {
    const out = [];
    let loose = "";
    const flush = () => { if (loose.replace(/<br>/g, "").trim()) out.push({ tag: "p", html: loose.trim() }); loose = ""; };
    root.childNodes.forEach((n) => {
      if (n.nodeType === 1 && (BLOCK.test(n.tagName) || CONTAINER.test(n.tagName) || hasBlockChild(n))) {
        flush();
        if (!BLOCK.test(n.tagName) || hasBlockChild(n)) { out.push(...blocksOf(n)); return; }
        const html = inlineChildren(n).replace(/(<br>)+$/, "");
        out.push({ tag: /^H/.test(n.tagName) ? "h2" : "p", html: html.trim() ? html : "" });
      } else {
        loose += inlineOf(n);
      }
    });
    flush();
    return out;
  }
  const toHTML = (blocks) => blocks.map((b) => `<${b.tag}>${b.html || "<br>"}</${b.tag}>`).join("");
  function parse(html) { const t = document.createElement("template"); t.innerHTML = html || ""; return t.content; }

  // Between the editor's HTML and the export module's runs.
  function runsOf(root) {
    const runs = [];
    (function walk(node, b, i) {
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) {
          const t = c.nodeValue;
          if (!t) return;
          const last = runs[runs.length - 1];
          if (last && !last.br && last.b === b && last.i === i) last.text += t;
          else runs.push({ text: t, b, i });
        } else if (c.nodeType === 1) {
          if (c.tagName === "BR") runs.push({ br: true });
          else walk(c, b || c.tagName === "STRONG", i || c.tagName === "EM");
        }
      });
    })(root, false, false);
    return runs;
  }
  const htmlToDoc = (html) => blocksOf(parse(html)).map((b) => ({ tag: b.tag, runs: runsOf(parse(b.html)) }));

  // ---------- small helpers ----------
  const fmt = (n) => n.toLocaleString();
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const wordsIn = (text) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const blockTexts = (root) => [...root.children].map((c) => c.textContent);
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "just now";
    const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
    const d = Math.round(h / 24); if (d === 1) return "yesterday"; if (d < 7) return `${d} days ago`;
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function firstLine(html) {
    const t = [...parse(html).children].map((c) => c.textContent.trim()).find(Boolean);
    return t ? (t.length > 60 ? t.slice(0, 58).trim() + "…" : t) : "";
  }
  const titleOf = (p) => firstLine(p.html) || "Untitled";

  // ---------- state ----------
  const STARTER = [
    ["h2", "Start here"],
    ["p", "This is Longhand, a quiet place to write. Click at the end of this page and begin, or open <em>Pieces</em> and start a fresh one."],
    ["p", "Your writing stays with you. Longhand saves every piece as you type, in this browser on this computer. Nothing is sent to us or to anyone else. There’s no account, and we never see a word you write, unless you choose <em>Submit as a review</em> under <em>Export</em> to send us a piece."],
    ["p", "That also means your pieces live only here. They won’t appear on another computer, and clearing this browser’s history and site data erases them. When a piece matters, use <em>Export</em> to keep a copy: a Word document for submitting your work, a PDF, Markdown for Substack and blogs, or plain text."],
    ["p", "If you like, install Longhand on your computer. It gets its own window and icon, and it works without the internet. In Chrome, click the install icon at the right end of the address bar. In Microsoft Edge, open the ⋯ menu and choose <em>Apps</em>, then <em>Install this site as an app</em>."],
    ["p", "Quotes curl themselves as you type: “Like this,” she said. Two hyphens become a dash — like that. Three dots become an ellipsis…"],
    ["p", `Type # and a space at the start of a line to make a heading. Press ${key("I")} for <em>italics</em> and ${key("B")} for <strong>bold</strong>.`],
    ["p", "<em>Focus</em> dims everything except the paragraph you are in. <em>Typewriter</em> keeps the line you are writing in the middle of the screen, so your eyes can stay put."],
    ["p", "The buttons fade away while you type. Move the mouse or press Esc and they come back. Spelling underlines are off until you ask for them, so they don’t interrupt a first draft."],
    ["p", "You can remove this page from <em>Pieces</em> whenever you like."],
  ].map(([t, h]) => `<${t}>${h}</${t}>`).join("");

  function newPiece(html) {
    const h = html || "<p><br></p>";
    return { id: uid(), html: h, updated: Date.now(), words: wordsIn(blockTexts(parse(h)).join(" ")) };
  }

  const prefs = Object.assign({ focus: false, typewriter: false, size: 2, spell: false }, prefsStore.get("prefs", {}));
  let pieces = [];
  let currentId = prefsStore.get("current", null);
  let today = prefsStore.get("today", null);
  let backupBroken = false;
  const piece = () => pieces.find((p) => p.id === currentId);
  const totalWords = () => pieces.reduce((s, p) => s + (p.words || 0), 0);
  function ensureToday() {
    const k = todayKey();
    if (!today || today.date !== k) { today = { date: k, start: totalWords() }; prefsStore.set("today", today); }
  }
  function adjustToday(by) { ensureToday(); today.start += by; prefsStore.set("today", today); }

  async function keep(p) {
    try { await db.put(p); backupBroken = false; }
    catch (e) { backupBroken = true; }
    showStatus();
  }

  // ---------- saving ----------
  // Every piece is saved as you type, in this browser's storage on this computer.
  // Nothing is ever sent anywhere. Export, and Submit as a review when the writer
  // chooses it for one piece, are the only ways writing leaves Longhand.
  let saveTimer = 0;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    const p = piece();
    if (!p) return;
    const html = toHTML(blocksOf(editor));
    if (html !== p.html) { p.html = html; p.updated = Date.now(); }
    p.words = countWords();
    await keep(p);
  }

  function showStatus() {
    const s = $("saveState");
    s.textContent = backupBroken
      ? "This browser won’t let Longhand save. Use Export to keep a copy before you close it."
      : "Saved on this computer";
    s.classList.toggle("warn", backupBroken);
  }

  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  addEventListener("pagehide", () => { saveNow(); });


  // ---------- selection helpers ----------
  function blockOf(node) {
    if (!node || node === editor) return null;
    while (node && node.parentNode !== editor) node = node.parentNode;
    return node && node.nodeType === 1 ? node : null;
  }
  function currentBlock() {
    const sel = getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
    if (sel.anchorNode === editor) {
      const kids = editor.children;
      return kids[Math.min(sel.anchorOffset, kids.length - 1)] || null;
    }
    return blockOf(sel.anchorNode);
  }
  function textBeforeCaret() {
    const sel = getSelection();
    const block = currentBlock();
    if (!sel.rangeCount || !block) return "";
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(block);
    try { pre.setEnd(r.startContainer, r.startOffset); } catch (e) { return ""; }
    return pre.toString();
  }
  function placeCaret(el, atEnd) {
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!atEnd);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  const ins = (s) => document.execCommand("insertText", false, s);

  // Keep the editor made of blocks, even after select-all + delete.
  function ensureStructure() {
    if (!editor.firstChild || (editor.childNodes.length === 1 && editor.firstChild.nodeName === "BR")) {
      editor.innerHTML = "<p><br></p>";
      placeCaret(editor.firstChild);
      return;
    }
    const sel = getSelection();
    const a = sel.anchorNode, o = sel.anchorOffset;
    let moved = false;
    [...editor.childNodes].forEach((n) => {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        const p = document.createElement("p");
        editor.insertBefore(p, n);
        p.appendChild(n);
        moved = true;
      }
    });
    if (moved && a && editor.contains(a)) { try { sel.collapse(a, o); } catch (e) { /* caret stays put */ } }
  }

  // ---------- typing niceties ----------
  document.execCommand("defaultParagraphSeparator", false, "p");

  editor.addEventListener("beforeinput", (e) => {
    if (e.inputType !== "insertText" || !e.data || e.data.length !== 1) return;
    if (!getSelection().isCollapsed) return;
    const d = e.data;
    const before = textBeforeCaret();
    const prev = before.slice(-1);
    const opening = prev === "" || /[\s(\[{“‘—–-]/.test(prev);
    if (d === '"') { e.preventDefault(); ins(opening ? "“" : "”"); }
    else if (d === "'") { e.preventDefault(); ins(opening ? "‘" : "’"); }
    else if (d === "-" && prev === "-") { e.preventDefault(); document.execCommand("delete"); ins("—"); }
    else if (d === "." && before.slice(-2) === "..") {
      e.preventDefault(); document.execCommand("delete"); document.execCommand("delete"); ins("…");
    }
    else if (d === " " && before === "#" && currentBlock() && currentBlock().tagName !== "H2") {
      e.preventDefault(); document.execCommand("delete"); document.execCommand("formatBlock", false, "h2");
    }
  });

  editor.addEventListener("input", (e) => {
    ensureStructure();
    if (e.inputType === "insertParagraph") {
      const b = currentBlock();
      if (b && b.tagName === "H2" && !b.textContent.trim()) document.execCommand("formatBlock", false, "p");
    }
    afterChange();
    requestAnimationFrame(keepCaretInView);
  });

  editor.addEventListener("paste", (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    let blocks = [];
    const html = cd.getData("text/html");
    if (html) blocks = blocksOf(parse(html)).filter((b) => b.html.replace(/<br>/g, "").trim());
    if (!blocks.length) {
      blocks = cd.getData("text/plain").split(/\r?\n/).filter((l) => l.trim()).map((l) => ({ tag: "p", html: esc(l.trim()) }));
    }
    if (!blocks.length) return;
    if (blocks.length === 1 && blocks[0].tag === "p") document.execCommand("insertHTML", false, blocks[0].html);
    else document.execCommand("insertHTML", false, toHTML(blocks));
  });

  // ---------- keys ----------
  let sittingMs = 0, lastKey = 0, quietFrom = null;
  editor.addEventListener("keydown", (e) => {
    const now = Date.now();
    if (lastKey && now - lastKey < 90000) sittingMs += now - lastKey;
    lastKey = now;

    if (e.key === "Tab") { e.preventDefault(); return; }
    if (e.key === "Escape") { wake(); editor.blur(); return; }
    if (e.key === "Backspace" && getSelection().isCollapsed) {
      const b = currentBlock();
      if (b && b.tagName === "H2" && textBeforeCaret() === "") { e.preventDefault(); document.execCommand("formatBlock", false, "p"); return; }
    }
    if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace")) goQuiet();
  });
  editor.addEventListener("keyup", (e) => {
    if (/^(Arrow|Page|Home|End)/.test(e.key)) requestAnimationFrame(keepCaretInView);
  });
  addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === "s" && e.shiftKey) { e.preventDefault(); openExportMenu(); }
    else if (mod && k === "s") {
      e.preventDefault();
      saveNow();
      toast("Saved. Longhand saves as you type, on this computer. Use Export to keep a copy anywhere else.");
    }
    else if (e.key === "Escape" && !$("drawer").hidden) closeDrawer();
  });

  // ---------- quiet chrome ----------
  function goQuiet() {
    if (!$("drawer").hidden) return;
    document.body.classList.add("quiet");
    quietFrom = null;
  }
  function wake() { document.body.classList.remove("quiet"); quietFrom = null; }
  addEventListener("mousemove", (e) => {
    if (!document.body.classList.contains("quiet")) return;
    if (!quietFrom) { quietFrom = [e.clientX, e.clientY]; return; }
    if (Math.abs(e.clientX - quietFrom[0]) + Math.abs(e.clientY - quietFrom[1]) > 24) wake();
  });
  addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" && !editor.contains(e.target)) wake(); });

  // ---------- caret position ----------
  function caretRect() {
    const sel = getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(false);
    const rects = r.getClientRects();
    if (rects.length) return rects[rects.length - 1];
    const b = currentBlock();
    return b ? b.getBoundingClientRect() : null;
  }
  function keepCaretInView() {
    if (document.activeElement !== editor) return;
    const rect = caretRect();
    if (!rect) return;
    if (prefs.typewriter) {
      const delta = rect.top + rect.height / 2 - innerHeight * 0.45;
      if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: reduceMotion || Math.abs(delta) < 80 ? "auto" : "smooth" });
    } else {
      const limit = innerHeight - $("statusbar").offsetHeight - 36;
      if (rect.bottom > limit) window.scrollBy({ top: rect.bottom - limit + 24 });
    }
  }

  // ---------- focus mode: mark the paragraph you're in ----------
  let currentEl = null;
  document.addEventListener("selectionchange", () => {
    const b = currentBlock();
    if (!b || b === currentEl) return;
    if (currentEl) currentEl.classList.remove("current");
    b.classList.add("current");
    currentEl = b;
  });

  // ---------- stats ----------
  function countWords() { return wordsIn(blockTexts(editor).join(" ")); }
  let statsTimer = 0;
  function afterChange() {
    editor.classList.toggle("empty", editor.children.length <= 1 && !editor.textContent.trim());
    clearTimeout(statsTimer);
    statsTimer = setTimeout(updateStats, 220);
    scheduleSave();
  }
  function updateStats() {
    const p = piece();
    if (!p) return;
    const n = countWords();
    p.words = n;
    $("wordCount").textContent = plural(n, "word");
    $("readTime").textContent = n ? `${Math.max(1, Math.round(n / 230))} min read` : "";
    ensureToday();
    const added = totalWords() - today.start;
    $("today").textContent = added > 0 ? `+${fmt(added)} today` : added < 0 ? `${fmt(-added)} cut today` : "Nothing added yet today";
    const mins = Math.floor(sittingMs / 60000);
    $("sitting").textContent = mins >= 1 ? `${mins} min this sitting` : "";
    const name = firstLine(toHTML(blocksOf(editor))) || "Untitled";
    $("pieceTitle").textContent = name;
    document.title = `${name} — Longhand`;
  }
  setInterval(updateStats, 30000);

  // ---------- loading a piece ----------
  function load(id) {
    currentId = id;
    prefsStore.set("current", id);
    const p = piece();
    editor.innerHTML = toHTML(blocksOf(parse(p.html))) || "<p><br></p>";
    currentEl = null;
    editor.classList.toggle("empty", editor.children.length <= 1 && !editor.textContent.trim());
    updateStats();
    showStatus();
    window.scrollTo(0, 0);
  }

  // ---------- prefs ----------
  function applyPrefs() {
    editor.classList.toggle("focus", prefs.focus);
    editor.classList.toggle("typewriter", prefs.typewriter);
    $("focusBtn").setAttribute("aria-pressed", prefs.focus);
    $("typeBtn").setAttribute("aria-pressed", prefs.typewriter);
    $("spellBtn").setAttribute("aria-pressed", prefs.spell);
    editor.spellcheck = prefs.spell;
    prefs.size = Math.max(0, Math.min(SIZES.length - 1, prefs.size));
    document.documentElement.style.setProperty("--text-size", SIZES[prefs.size] + "px");
    $("sizeDown").disabled = prefs.size === 0;
    $("sizeUp").disabled = prefs.size === SIZES.length - 1;
    prefsStore.set("prefs", prefs);
  }
  function toggle(key) {
    prefs[key] = !prefs[key];
    applyPrefs();
    editor.focus({ preventScroll: true });
    if (key !== "spell") requestAnimationFrame(keepCaretInView);
  }
  $("focusBtn").onclick = () => toggle("focus");
  $("typeBtn").onclick = () => toggle("typewriter");
  $("spellBtn").onclick = () => toggle("spell");
  $("sizeDown").onclick = () => { prefs.size--; applyPrefs(); };
  $("sizeUp").onclick = () => { prefs.size++; applyPrefs(); };
  // Links to the home page. Pieces are saved first. In the installed app, the
  // home page opens in the browser so the writing window stays open.
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  ["homeLink", "homeLink2"].forEach((id) => {
    const a = $(id);
    if (installed) { a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", () => saveNow()); return; }
    a.addEventListener("click", async (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { saveNow(); return; }
      e.preventDefault();
      await saveNow();
      location.href = a.href;
    });
  });
  $("exportBtn").title = `Save a copy as Word, PDF, Markdown or plain text (${key("S", true)})`;

  // ---------- export ----------
  const EXPORTS = {
    docx: { ext: ".docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", desc: "Word Document", make: (d) => LonghandExport.toDocx(d) },
    md: { ext: ".md", mime: "text/markdown", desc: "Markdown", make: (d) => LonghandExport.toMarkdown(d) },
    txt: { ext: ".txt", mime: "text/plain", desc: "Plain Text", make: (d) => LonghandExport.toText(d) },
  };
  function exportBaseName() {
    const name = firstLine(toHTML(blocksOf(editor)));
    return (name || "Untitled").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled";
  }
  async function exportAs(kind) {
    closeExportMenu();
    saveNow();
    if (kind === "pdf") {
      toast(isMac ? "In the print window, choose \u201cSave as PDF\u201d next to Destination." : "In the print window, choose \u201cSave as PDF\u201d as the printer.");
      const title = document.title;
      document.title = exportBaseName();
      setTimeout(() => { window.print(); document.title = title; }, 60);
      return;
    }
    const f = EXPORTS[kind];
    const blob = new Blob([f.make(htmlToDoc(toHTML(blocksOf(editor))))], { type: f.mime });
    const name = exportBaseName() + f.ext;
    if (canUseFiles) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: f.desc, accept: { [f.mime]: [f.ext] } }], id: "longhand-export" });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        toast(`Exported ${handle.name}.`);
      } catch (e) {
        if (!e || e.name !== "AbortError") toast("Longhand couldn\u2019t save that file. Try again, or choose a different folder.");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Saved ${name} to your Downloads folder.`);
  }
  function openExportMenu() {
    wake();
    $("exportMenu").hidden = false;
    $("exportBtn").setAttribute("aria-expanded", "true");
    $("exportMenu").querySelector("button").focus();
  }
  function closeExportMenu() {
    $("exportMenu").hidden = true;
    $("exportBtn").setAttribute("aria-expanded", "false");
  }
  $("exportBtn").onclick = () => ($("exportMenu").hidden ? openExportMenu() : closeExportMenu());
  $("exportMenu").querySelectorAll("[data-export]").forEach((b) => { b.onclick = () => exportAs(b.dataset.export); });
  $("exportMenu").addEventListener("keydown", (e) => {
    const items = [...$("exportMenu").querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Escape") { e.stopPropagation(); closeExportMenu(); $("exportBtn").focus(); }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!$("exportMenu").hidden && !e.target.closest(".export")) closeExportMenu();
  });

  // ---------- submitting a piece as a review ----------
  // Sends this one piece, only when the writer asks, to Longhand's editors by
  // email through Web3Forms. The access key only allows sending to that inbox.
  const REVIEW_KEY = "7c72d9f4-af8b-4949-98fd-3433f5086676";
  const REVIEW_MIN = 300, REVIEW_MAX = 1500;
  const reviewForm = $("reviewForm");
  function openReview() {
    closeExportMenu();
    saveNow();
    const words = countWords();
    const count = $("reviewCount");
    count.textContent = `This piece is ${words.toLocaleString()} ${words === 1 ? "word" : "words"}. Reviews are usually 700 to 1,000.`;
    const ok = words >= REVIEW_MIN && words <= REVIEW_MAX;
    count.classList.toggle("warn", !ok);
    if (!ok) count.textContent += words < REVIEW_MIN ? " This one is too short to send yet." : " Please trim it before sending.";
    $("reviewSend").disabled = !ok;
    const saved = prefsStore.get("reviewer", {});
    reviewForm.reviewer.value = reviewForm.reviewer.value || saved.name || "";
    reviewForm.email.value = reviewForm.email.value || saved.email || "";
    $("reviewStatus").textContent = "";
    $("reviewStatus").classList.remove("warn");
    $("reviewDialog").showModal();
  }
  $("reviewItem").onclick = openReview;
  $("reviewCancel").onclick = () => $("reviewDialog").close();
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = reviewForm, status = $("reviewStatus");
    if (f.botcheck.checked) return;
    const text = LonghandExport.toText(htmlToDoc(toHTML(blocksOf(editor))));
    prefsStore.set("reviewer", { name: f.reviewer.value.trim(), email: f.email.value.trim() });
    $("reviewSend").disabled = true;
    status.classList.remove("warn");
    status.textContent = "Sending…";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: REVIEW_KEY,
          subject: `Review: ${f.book.value.trim()}, by ${f.reviewer.value.trim()}`,
          from_name: "Longhand Reviews",
          name: f.reviewer.value.trim(),
          email: f.email.value.trim(),
          book: f.book.value.trim(),
          book_author: f.book_author.value.trim(),
          words: countWords(),
          sent_from: "the Longhand writing app",
          review: text,
          botcheck: false,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.success) throw new Error(out.message || res.status);
      $("reviewDialog").close();
      f.book.value = f.book_author.value = "";
      f.consent.checked = false;
      toast("Sent. Thank you! Your review is on its way to Longhand's editors.");
    } catch (err) {
      status.classList.add("warn");
      status.textContent = navigator.onLine === false
        ? "You're offline, so it couldn't be sent. Your piece is safe here; try again when you're connected."
        : "Something went wrong and it wasn't sent. Your piece is safe here; please try again in a moment.";
    } finally {
      $("reviewSend").disabled = false;
    }
  });

  // ---------- toast ----------
  let toastTimer = 0;
  function toast(msg, actionLabel, action) {
    $("toastMsg").textContent = msg;
    const btn = $("toastAction");
    btn.hidden = !action;
    if (action) { btn.textContent = actionLabel; btn.onclick = () => { hideToast(); action(); }; }
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 10000 : Math.max(3500, msg.length * 55));
  }
  function hideToast() { $("toast").hidden = true; }

  // ---------- pieces drawer ----------
  function renderList() {
    const list = $("pieceList");
    list.innerHTML = "";
    [...pieces].sort((a, b) => b.updated - a.updated).forEach((p) => {
      const li = document.createElement("li");
      li.className = "piece";
      li.setAttribute("aria-current", p.id === currentId);
      const open = document.createElement("button");
      open.className = "piece-open";
      const t = document.createElement("span"); t.className = "t"; t.textContent = firstLine(p.html) || "Untitled";
      const m = document.createElement("span"); m.className = "m"; m.textContent = `${plural(p.words || 0, "word")} · edited ${ago(p.updated)}`;
      open.append(t, m);
      open.onclick = () => {
        saveNow();
        load(p.id);
        closeDrawer();
        editor.focus();
        placeCaret(editor.lastElementChild, true);
      };
      const del = document.createElement("button");
      del.className = "piece-del";
      del.textContent = "Remove";
      del.setAttribute("aria-label", `Remove “${titleOf(p)}” from Longhand`);
      del.onclick = () => removePiece(p.id);
      li.append(open, del);
      list.append(li);
    });
  }
  function openDrawer() {
    saveNow();
    wake();
    renderList();
    $("drawer").hidden = false; $("scrim").hidden = false;
    $("drawerBtn").setAttribute("aria-expanded", "true");
    $("newBtn").focus();
  }
  function closeDrawer() {
    $("drawer").hidden = true; $("scrim").hidden = true;
    $("drawerBtn").setAttribute("aria-expanded", "false");
  }
  $("drawerBtn").onclick = () => ($("drawer").hidden ? openDrawer() : closeDrawer());
  $("scrim").onclick = closeDrawer;
  // saveNow reads the editor before it waits on anything, so it's safe to switch pieces right after calling it.
  $("newBtn").onclick = () => {
    saveNow();
    const p = newPiece();
    pieces.push(p);
    load(p.id);
    closeDrawer();
    editor.focus();
    placeCaret(editor.firstElementChild);
    keep(p);
  };
  async function removePiece(id) {
    await saveNow();
    const idx = pieces.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const [gone] = pieces.splice(idx, 1);
    adjustToday(-(gone.words || 0));
    try { await db.del(id); } catch (e) { /* the list is what matters */ }
    if (!pieces.length) { const fresh = newPiece(); pieces.push(fresh); await keep(fresh); }
    if (id === currentId) load([...pieces].sort((a, b) => b.updated - a.updated)[0].id);
    renderList();
    const name = titleOf(gone);
    toast(`Removed “${name}”.`, "Undo", async () => {
      pieces.splice(Math.min(idx, pieces.length), 0, gone);
      adjustToday(gone.words || 0);
      await keep(gone);
      load(gone.id);
      if (!$("drawer").hidden) renderList();
    });
  }

  // ---------- start ----------
  (async () => {
    try { pieces = await db.all(); } catch (e) { backupBroken = true; pieces = []; }
    // Pieces from before Longhand stopped saving .rtf files may still carry file links. Drop them.
    for (const p of pieces) {
      if (!("handle" in p || "fileName" in p)) continue;
      for (const f of ["handle", "fileName", "fileSavedAt", "dirty", "fileError", "needsPermission"]) delete p[f];
      await keep(p);
    }
    // A Start here page from those days talks about .rtf files. Swap in the current one.
    for (const p of pieces) {
      if (firstLine(p.html) === "Start here" && p.html.includes("Rich Text file")) {
        p.html = STARTER;
        p.words = wordsIn(blockTexts(parse(STARTER)).join(" "));
        await keep(p);
      }
    }
    // A Start here page made while the 826 National note was live still carries its line; take it out.
    for (const p of pieces) {
      if (firstLine(p.html) !== "Start here") continue;
      const cleaned = p.html.replace(/<p>Longhand is free\. If it helps you write, please consider a gift to 826 National[^<]*(<em>Pieces<\/em>)?\.?<\/p>/, "");
      if (cleaned !== p.html) { p.html = cleaned; await keep(p); }
    }
    if (!pieces.length) {
      const first = newPiece(STARTER);
      pieces.push(first);
      await keep(first);
      currentId = first.id;
    }
    if (!piece()) currentId = [...pieces].sort((a, b) => b.updated - a.updated)[0].id;
    ensureToday();
    applyPrefs();
    load(currentId);
  })();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* works online without it */ });
  }
})();
