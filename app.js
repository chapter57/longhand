(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const editor = $("editor");
  const SIZES = [16, 17.5, 19, 21, 23.5];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canUseFiles = "showSaveFilePicker" in window && "showOpenFilePicker" in window;
  const RTF_TYPES = [{ description: "Rich Text Document", accept: { "text/rtf": [".rtf"] } }];
  const OPEN_TYPES = [{ description: "Writing", accept: { "text/rtf": [".rtf"], "text/plain": [".txt", ".text", ".md"] } }];

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

  // Between the editor's HTML and the RTF module's runs.
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
  function docToHTML(blocks) {
    return blocks.map((b) => {
      const inner = b.runs.map((r) => {
        if (r.br) return "<br>";
        let s = esc(r.text.replace(/\t/g, " "));
        if (r.b && b.tag === "p") s = `<strong>${s}</strong>`;
        if (r.i) s = `<em>${s}</em>`;
        return s;
      }).join("");
      return `<${b.tag}>${inner.trim() ? inner : "<br>"}</${b.tag}>`;
    }).join("");
  }

  // ---------- small helpers ----------
  const fmt = (n) => n.toLocaleString();
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const wordsIn = (text) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const blockTexts = (root) => [...root.children].map((c) => c.textContent);
  const stripExt = (name) => name.replace(/\.(rtf|txt|text|md)$/i, "");
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
  const titleOf = (p) => (p.fileName ? stripExt(p.fileName) : firstLine(p.html)) || "Untitled";
  const fileNameFor = (p) => (firstLine(p.html).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled") + ".rtf";

  // ---------- state ----------
  const STARTER = [
    ["h2", "Start here"],
    ["p", "This is Longhand, a quiet place to write. It works without the internet, and it saves your writing as real files on your Mac."],
    ["p", "Press ⌘S to save a piece as a Rich Text file. After that, Longhand keeps the file up to date as you write, and you can open it in Word, Pages, TextEdit or Scrivener whenever you like. Press ⌘O to open an .rtf file, and ⇧⌘S to save a copy under a new name."],
    ["p", "Even before you save a file, nothing is lost. Longhand keeps a copy of every piece on this computer. You’ll find them all under <em>Pieces</em>."],
    ["p", "Quotes curl themselves as you type: “Like this,” she said. Two hyphens become a dash — like that. Three dots become an ellipsis…"],
    ["p", "Type # and a space at the start of a line to make a heading. Press ⌘I for <em>italics</em> and ⌘B for <strong>bold</strong>."],
    ["p", "<em>Focus</em> dims everything except the paragraph you are in. <em>Typewriter</em> keeps the line you are writing in the middle of the screen, so your eyes can stay put."],
    ["p", "The buttons fade away while you type. Move the mouse or press Esc and they come back. Spelling underlines are off until you ask for them, so they don’t interrupt a first draft."],
    ["p", "Longhand is free. If it helps you write, please consider a gift to 826 National, which runs free writing and tutoring programs for young people. You\u2019ll find the link at the bottom of <em>Pieces</em>."],
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
    catch (e) {
      // If the file link can't be stored, keep the words anyway.
      try { const copy = Object.assign({}, p); delete copy.handle; await db.put(copy); backupBroken = false; }
      catch (e2) { backupBroken = true; }
    }
    showStatus();
  }

  // ---------- saving: the in-app copy, then the file ----------
  let saveTimer = 0, fileTimer = 0, writing = Promise.resolve();

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    const p = piece();
    if (!p) return;
    const html = toHTML(blocksOf(editor));
    if (html !== p.html) { p.html = html; p.updated = Date.now(); p.dirty = true; }
    p.words = countWords();
    await keep(p);
    if (p.dirty && p.handle) { clearTimeout(fileTimer); fileTimer = setTimeout(() => writeFile(p, false), 1500); }
    showStatus();
  }

  // Writes the piece to its file. `asked` is true when the writer pressed Save,
  // which is the only time the browser lets us ask for permission.
  function writeFile(p, asked) {
    writing = writing.then(async () => {
      if (!p || !p.handle) return false;
      try {
        let perm = await p.handle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted" && asked) perm = await p.handle.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") { p.needsPermission = true; showStatus(); return false; }
        p.needsPermission = false;
        const html = p.html;
        const w = await p.handle.createWritable();
        await w.write(RTF.toRTF(htmlToDoc(html)));
        await w.close();
        p.fileSavedAt = (await p.handle.getFile()).lastModified;
        p.fileError = null;
        if (p.html === html) p.dirty = false;
        await keep(p);
        showStatus();
        return true;
      } catch (e) {
        p.fileError = e && e.name === "NotFoundError"
          ? `${p.fileName} was moved or deleted. Use Save as to choose where to keep it.`
          : `Couldn’t save to ${p.fileName}. Your words are still kept in Longhand.`;
        showStatus();
        return false;
      }
    });
    return writing;
  }

  async function save() {
    await saveNow();
    const p = piece();
    if (!p.handle) return saveAs();
    clearTimeout(fileTimer);
    if (await writeFile(p, true)) toast(`Saved to ${p.fileName}.`);
  }

  async function saveAs() {
    await saveNow();
    const p = piece();
    if (!canUseFiles) return downloadCopy(p);
    let handle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: p.fileName || fileNameFor(p), types: RTF_TYPES, id: "longhand" });
    } catch (e) {
      if (e && e.name !== "AbortError") toast("Longhand couldn’t open the save window.");
      return;
    }
    p.handle = handle;
    p.fileName = handle.name;
    p.dirty = true;
    await keep(p);
    if (await writeFile(p, true)) { toast(`Saved to ${p.fileName}. Longhand will keep it up to date as you write.`); updateStats(); }
  }

  function downloadCopy(p) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([RTF.toRTF(htmlToDoc(p.html))], { type: "text/rtf" }));
    a.download = fileNameFor(p);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Saved a copy to your Downloads folder.");
  }

  function showStatus() {
    const p = piece();
    const s = $("saveState");
    if (!p) return;
    let msg, warn = false;
    if (backupBroken) { msg = "Longhand can’t keep its backup copy in this browser. Save to a file to be safe."; warn = true; }
    else if (p.fileError) { msg = p.fileError; warn = true; }
    else if (!p.handle) msg = canUseFiles ? "Kept in Longhand · ⌘S saves it as a file" : "Kept in Longhand";
    else if (p.needsPermission) msg = `Press ⌘S to keep saving to ${p.fileName}`;
    else if (p.dirty) msg = "";
    else msg = `Saved to ${p.fileName}`;
    s.textContent = msg;
    s.classList.toggle("warn", warn);
  }

  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  addEventListener("pagehide", () => { saveNow(); });

  // ---------- opening files ----------
  async function readHandle(handle) {
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    const isRTF = /\.rtf$/i.test(file.name);
    let blocks, ours = true;
    if (isRTF) {
      const text = new TextDecoder("windows-1252").decode(buf);
      ours = text.includes("\\generator Longhand");
      blocks = RTF.fromRTF(text);
    } else {
      blocks = new TextDecoder().decode(buf).split(/\r?\n/).filter((l) => l.trim())
        .map((l) => ({ tag: "p", runs: [{ text: l.trim(), b: false, i: false }] }));
    }
    return { file, isRTF, ours, html: docToHTML(blocks) || "<p><br></p>" };
  }

  async function openHandle(handle) {
    await saveNow();
    let got;
    try { got = await readHandle(handle); }
    catch (e) { toast("Longhand couldn’t read that file."); return; }
    const { file, isRTF, ours, html } = got;

    let p = null;
    if (isRTF) {
      for (const q of pieces) {
        if (q.handle && await q.handle.isSameEntry(handle).catch(() => false)) { p = q; break; }
      }
    }
    if (!p) { p = newPiece(html); pieces.push(p); }
    else { adjustToday(-(p.words || 0)); p.html = html; p.updated = Date.now(); }
    p.words = wordsIn(blockTexts(parse(html)).join(" "));
    adjustToday(p.words);
    if (isRTF) {
      Object.assign(p, { handle, fileName: file.name, fileSavedAt: file.lastModified, dirty: false, fileError: null, needsPermission: false });
    }
    await keep(p);
    load(p.id);
    closeDrawer();
    if (!isRTF) toast(`Opened ${file.name}. Saving will make a Rich Text copy and leave the original alone.`);
    else if (!ours) toast(`Opened ${file.name}. Longhand keeps the words, italics, bold and headings. Other formatting is dropped when it saves.`);
    else toast(`Opened ${file.name}.`);
  }

  async function openFile() {
    if (!canUseFiles) { $("fileInput").click(); return; }
    let handles;
    try { handles = await window.showOpenFilePicker({ types: OPEN_TYPES, id: "longhand", multiple: false }); }
    catch (e) { return; }
    if (handles && handles[0]) openHandle(handles[0]);
  }
  $("fileInput").onchange = async () => {
    const f = $("fileInput").files[0];
    $("fileInput").value = "";
    if (!f) return;
    const fake = { getFile: async () => f };
    try {
      const { html } = await readHandle(fake);
      await saveNow();
      const p = newPiece(html);
      pieces.push(p);
      adjustToday(p.words);
      await keep(p);
      load(p.id);
      toast(`Opened ${f.name}.`);
    } catch (e) { toast("Longhand couldn’t read that file."); }
  };

  // If the file was changed in another app since Longhand last saved it, offer that version.
  async function checkOutsideChanges(p) {
    if (!p || !p.handle) return;
    try {
      if (await p.handle.queryPermission({ mode: "read" }) !== "granted") return;
      const f = await p.handle.getFile();
      if (f.lastModified > (p.fileSavedAt || 0) + 1000 && piece() === p) {
        toast(`${p.fileName} was changed in another app.`, "Load that version", () => openHandle(p.handle));
      }
    } catch (e) {
      if (e && e.name === "NotFoundError") { p.fileError = `${p.fileName} was moved or deleted. Use Save as to choose where to keep it.`; showStatus(); }
    }
  }

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
    if (mod && k === "s") { e.preventDefault(); e.shiftKey ? saveAs() : save(); }
    else if (mod && k === "o") { e.preventDefault(); openFile(); }
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
    const name = p.fileName ? stripExt(p.fileName) : (firstLine(toHTML(blocksOf(editor))) || "Untitled");
    $("pieceTitle").textContent = p.fileName ? p.fileName : name;
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
    checkOutsideChanges(p);
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
  $("openBtn").onclick = openFile;
  $("saveBtn").onclick = save;
  $("saveAsBtn").onclick = () => { closeDrawer(); saveAs(); };

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
      const f = document.createElement("span"); f.className = p.fileName ? "f" : "f none"; f.textContent = p.fileName || "Not saved to a file yet";
      const m = document.createElement("span"); m.className = "m"; m.textContent = `${plural(p.words || 0, "word")} · edited ${ago(p.updated)}`;
      open.append(t, f, m);
      open.onclick = async () => {
        saveNow();
        load(p.id);
        closeDrawer();
        editor.focus();
        placeCaret(editor.lastElementChild, true);
        if (p.handle) {
          try {
            if (await p.handle.queryPermission({ mode: "readwrite" }) !== "granted") await p.handle.requestPermission({ mode: "readwrite" });
            p.needsPermission = false;
            showStatus();
          } catch (e) { /* they can still press Save later */ }
        }
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
    const msg = gone.fileName ? `Removed “${name}”. The file ${gone.fileName} is untouched.` : `Removed “${name}”.`;
    toast(msg, "Undo", async () => {
      pieces.splice(Math.min(idx, pieces.length), 0, gone);
      adjustToday(gone.words || 0);
      await keep(gone);
      load(gone.id);
      if (!$("drawer").hidden) renderList();
    });
  }

  // ---------- start ----------
  const ready = (async () => {
    try { pieces = await db.all(); } catch (e) { backupBroken = true; pieces = []; }
    pieces.forEach((p) => { p.needsPermission = false; p.fileError = null; });
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

  // Files opened from Finder ("Open With > Longhand") arrive here.
  if ("launchQueue" in window) {
    window.launchQueue.setConsumer(async (params) => {
      await ready;
      for (const h of params.files || []) if (h.kind === "file") await openHandle(h);
    });
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* works online without it */ });
  }
})();
