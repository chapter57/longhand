// Longhand's export formats: Word (.docx), Markdown and plain text.
// Takes the same document shape as rtf.js: a list of blocks
// { tag: "p" | "h2", runs: [{ text, b, i } | { br: true }] }.
(function (root) {
  "use strict";

  // ---------- Word (.docx) ----------
  // A .docx file is a zip of a few XML files. This writes the smallest set Word,
  // Pages, Google Docs and LibreOffice all accept, stored without compression.

  const xmlEscape = (s) => s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function docxRuns(runs, inHeading) {
    return runs.map((r) => {
      if (r.br) return "<w:r><w:br/></w:r>";
      if (!r.text) return "";
      const props = (r.b && !inHeading ? "<w:b/>" : "") + (r.i ? "<w:i/>" : "");
      const text = r.text.replace(/\t/g, " ");
      return "<w:r>" + (props ? "<w:rPr>" + props + "</w:rPr>" : "") +
        '<w:t xml:space="preserve">' + xmlEscape(text) + "</w:t></w:r>";
    }).join("");
  }

  function documentXml(blocks) {
    const body = blocks.map((b) => {
      const h = b.tag === "h2";
      return "<w:p>" + (h ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : "") + docxRuns(b.runs || [], h) + "</w:p>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
      "</w:body></w:document>";
  }

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="240" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>' +
    '<w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>' +
    "</w:styles>";

  const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    "</Types>";

  const ROOT_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const DOC_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Builds an uncompressed zip from [{ name, data: Uint8Array }].
  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);        // version needed
      local.setUint16(6, 0x0800, true);    // names are UTF-8
      local.setUint16(8, 0, true);         // stored, no compression
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      locals.push(new Uint8Array(local.buffer), name, f.data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);
      central.setUint16(6, 20, true);
      central.setUint16(8, 0x0800, true);
      central.setUint16(10, 0, true);
      central.setUint16(12, dosTime, true);
      central.setUint16(14, dosDate, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, size, true);
      central.setUint32(24, size, true);
      central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      centrals.push(new Uint8Array(central.buffer), name);

      offset += 30 + name.length + size;
    }
    const centralSize = centrals.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((s, a) => s + a.length, 0));
    let at = 0;
    for (const a of parts) { out.set(a, at); at += a.length; }
    return out;
  }

  function toDocx(blocks) {
    const enc = new TextEncoder();
    return zip([
      { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES_XML) },
      { name: "_rels/.rels", data: enc.encode(ROOT_RELS_XML) },
      { name: "word/document.xml", data: enc.encode(documentXml(blocks)) },
      { name: "word/_rels/document.xml.rels", data: enc.encode(DOC_RELS_XML) },
      { name: "word/styles.xml", data: enc.encode(STYLES_XML) },
    ]);
  }

  // ---------- Markdown ----------

  function mdEscape(s) {
    return s.replace(/([\\`*_[\]<>])/g, "\\$1");
  }
  function mdRuns(runs, inHeading) {
    return runs.map((r) => {
      if (r.br) return "\\\n";
      if (!r.text) return "";
      // Keep spaces outside the markers, where Markdown expects them.
      const m = r.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!m[2]) return r.text;
      let s = mdEscape(m[2]);
      if (r.b && !inHeading) s = "**" + s + "**";
      if (r.i) s = "*" + s + "*";
      return m[1] + s + m[3];
    }).join("");
  }
  function toMarkdown(blocks) {
    return blocks.map((b) => {
      let line = mdRuns(b.runs || [], b.tag === "h2").replace(/\t/g, " ");
      if (b.tag === "h2") return "# " + line.trim();
      // A paragraph that starts like a list, heading or quote should stay a paragraph.
      line = line.replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, (all, sp, mark) => sp + "\\" + mark);
      return line;
    }).filter((s, i, all) => s.trim() || (i > 0 && all[i - 1].trim()))
      .join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  // ---------- plain text ----------

  function toText(blocks) {
    return blocks.map((b) => (b.runs || []).map((r) => (r.br ? "\n" : r.text || "")).join("").replace(/\t/g, " "))
      .join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  const Export = { toDocx, toMarkdown, toText, crc32 };
  if (typeof module !== "undefined" && module.exports) module.exports = Export;
  else root.LonghandExport = Export;
})(typeof window !== "undefined" ? window : globalThis);
