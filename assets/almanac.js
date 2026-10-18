// The Longhand Almanac: shows today's entry and the coming week, using the
// visitor's own date. Entries come from _data/almanac.yml, embedded in the
// page as window.LONGHAND_ALMANAC.
(function () {
  "use strict";
  var entries = window.LONGHAND_ALMANAC || [];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var SMALL = { of: 1, the: 1, van: 1, den: 1, de: 1, der: 1, sir: 1, la: 1, le: 1 };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z]+/g, "-"); }
  function onDay(date) {
    return entries.filter(function (e) { return e.month === date.getMonth() + 1 && e.day === date.getDate(); });
  }
  function anchor(e) { return "d-" + e.month + "-" + e.day; }

  // A lettered card stands in for a portrait: initials for people, a book for
  // books, a quill for events.
  function initials(name) {
    var words = String(name).split(/\s+/).filter(function (w) { return w && !SMALL[w.toLowerCase()]; });
    if (!words.length) return "";
    var first = words[0].charAt(0);
    var last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }
  function mono(e) {
    var inner;
    if (e.kind === "Published") {
      inner = '<path class="mono-line" d="M 30 44 Q 45 38 60 44 L 60 78 Q 45 72 30 78 Z M 60 44 Q 75 38 90 44 L 90 78 Q 75 72 60 78"/>' +
        '<path class="mono-line mono-thin" d="M 36 52 Q 45 49 54 52 M 36 60 Q 45 57 54 60 M 66 52 Q 75 49 84 52 M 66 60 Q 75 57 84 60"/>';
    } else if (e.kind === "Event") {
      inner = '<path class="mono-line" d="M 82 30 C 60 36 44 56 38 86 M 82 30 C 82 52 66 70 46 74"/>' +
        '<path class="mono-line mono-thin" d="M 38 86 L 34 94"/>';
    } else {
      inner = '<text class="mono-letters" x="60" y="70" text-anchor="middle">' + esc(initials(e.name)) + "</text>";
    }
    return '<svg class="entry-mono" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="mono-ring" cx="60" cy="60" r="54"/><circle class="mono-ring mono-thin" cx="60" cy="60" r="46"/>' +
      inner + "</svg>";
  }
  function pictured(e) { return e.pictured || e.name; }
  // A portrait stored on the site, if there is one. Otherwise the lettered card,
  // which is swapped for the portrait on Wikipedia once that has loaded.
  function art(e) {
    if (e.image) {
      var src = e.image.charAt(0) === "/" ? e.image : "/" + e.image;
      return '<img class="entry-portrait" src="' + esc(src) + '" alt="' + esc(pictured(e)) + '" loading="lazy">' +
        (e.image_credit ? '<p class="entry-credit">Portrait: ' + esc(e.image_credit) + "</p>" : "");
    }
    return mono(e);
  }
  function artBox(e) {
    return '<div class="entry-art"' + (e.portrait && !e.image ? ' data-portrait="' + esc(e.portrait) + '" data-pictured="' + esc(pictured(e)) + '"' : "") +
      ">" + art(e) + "</div>";
  }

  function yearText(y) { return y < 0 ? -y + " BC" : String(y); }
  function ago(e, today) {
    var n = today.getFullYear() - e.year - (e.year < 0 ? 1 : 0); // there was no year 0
    if (n <= 0) return "";
    return n + (n === 1 ? " year" : " years") + " ago";
  }

  function card(e, today, opts) {
    opts = opts || {};
    var when = MONTHS[e.month - 1] + " " + e.day + ", " + yearText(e.year);
    var years = opts.isToday ? ago(e, today) : "";
    var links = (e.url ? '<a href="' + esc(e.url) + '">The full entry</a>' : "") +
      '<a href="' + esc(e.read) + '">' + esc(e.read_label || "Read") + "</a>";
    var tag = opts.heading || "h3";
    return '<article class="entry' + (opts.feature ? " entry-feature" : "") + '">' +
      artBox(e) +
      '<div class="entry-copy">' +
      '<p class="entry-kicker"><span class="kind kind-' + slug(e.kind) + '">' + esc(e.kind) + "</span>" +
      "<span>" + esc(when) + "</span>" + (years ? "<span>" + esc(years) + "</span>" : "") + "</p>" +
      "<" + tag + ' class="entry-name">' + (e.url ? '<a href="' + esc(e.url) + '">' + esc(e.name) + "</a>" : esc(e.name)) + "</" + tag + ">" +
      '<p class="entry-note">' + esc(e.note) + "</p>" +
      '<p class="entry-links">' + links + "</p>" +
      "</div></article>";
  }

  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function dayLabel(d) { return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate(); }

  var today = new Date();

  // Front page: today's entry, or the next one coming up, plus the week ahead.
  var todayEl = document.querySelector("[data-almanac-today]");
  if (todayEl && entries.length) {
    var dateEl = document.querySelector("[data-almanac-date]");
    if (dateEl) dateEl.textContent = dayLabel(today);
    var hits = onDay(today);
    if (hits.length) {
      todayEl.innerHTML = hits.map(function (e) { return card(e, today, { feature: true, isToday: true }); }).join("");
    } else {
      var next = null, nextDate = null;
      for (var i = 1; i <= 366 && !next; i++) {
        var d = addDays(today, i), h = onDay(d);
        if (h.length) { next = h[0]; nextDate = d; }
      }
      todayEl.innerHTML = next
        ? '<p class="entry-coming">Nothing in the almanac for today. Coming up on ' + esc(dayLabel(nextDate)) + ":</p>" + card(next, today, { feature: true })
        : '<p class="soon">New entries are on their way.</p>';
    }
    var stripEl = document.querySelector("[data-almanac-strip]");
    if (stripEl) {
      var items = [];
      for (var j = 1; j <= 6; j++) {
        var dd = addDays(today, j);
        onDay(dd).forEach(function (e) {
          items.push('<li><a href="' + esc(e.url || "/almanac/#" + anchor(e)) + '"><span class="strip-date">' +
            esc(DAYS[dd.getDay()].slice(0, 3) + " " + dd.getDate()) + '</span><span class="strip-name">' + esc(e.name) + "</span></a></li>");
        });
      }
      stripEl.innerHTML = items.join("");
      if (!items.length && stripEl.parentNode) stripEl.parentNode.hidden = true;
    }
  }

  // Almanac page: the next seven days, and today's place in the full calendar.
  var weekEl = document.querySelector("[data-almanac-week]");
  if (weekEl && entries.length) {
    var parts = [];
    for (var k = 0; k < 7; k++) {
      var day = addDays(today, k);
      var found = onDay(day);
      if (!found.length) continue;
      parts.push('<div class="week-day' + (k === 0 ? " is-today" : "") + '">' +
        '<p class="week-day-label">' + (k === 0 ? "Today \u00b7 " : "") + esc(dayLabel(day)) + "</p>" +
        found.map(function (e) { return card(e, today, { isToday: k === 0 }); }).join("") + "</div>");
    }
    weekEl.innerHTML = parts.length ? parts.join("") : '<p class="soon">Nothing in the almanac this week yet. New entries are on their way.</p>';
  }
  onDay(today).forEach(function (e) {
    var row = document.getElementById(anchor(e));
    if (row) row.classList.add("is-today");
  });

  // An entry's own page: the large portrait beside the title.
  Array.prototype.forEach.call(document.querySelectorAll("[data-art]"), function (box) {
    var md = box.getAttribute("data-art").split("-");
    var e = entries.filter(function (x) { return x.month === +md[0] && x.day === +md[1]; })[0];
    if (!e) return;
    box.innerHTML = art(e);
    if (e.portrait && !e.image) {
      box.setAttribute("data-portrait", e.portrait);
      box.setAttribute("data-pictured", pictured(e));
    }
  });

  // Portraits come from the lead picture of the person's Wikipedia article,
  // loaded by the reader's browser. Only freely licensed pictures from
  // Wikimedia Commons are used, credited to their maker and license. If
  // anything goes wrong, the lettered card stays.
  function cached(key, load) {
    try { var hit = sessionStorage.getItem(key); if (hit) return Promise.resolve(JSON.parse(hit)); } catch (err) {}
    return load().then(function (v) {
      try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (err) {}
      return v;
    });
  }
  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function plain(html) {
    var doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }
  function portrait(title) {
    return cached("longhand-portrait:" + title, function () {
      return getJSON("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title)).then(function (s) {
        var thumb = s.thumbnail && s.thumbnail.source, orig = s.originalimage && s.originalimage.source;
        if (!thumb || !orig || thumb.indexOf("/wikipedia/commons/") < 0) return null;
        var file = decodeURIComponent(orig.split("/").pop());
        var info = { src: thumb, big: orig, file: file, artist: "", license: "" };
        return getJSON("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=" +
          encodeURIComponent("File:" + file)).then(function (c) {
          var pages = (c.query && c.query.pages) || {};
          var page = pages[Object.keys(pages)[0]] || {};
          var meta = (page.imageinfo && page.imageinfo[0] && page.imageinfo[0].extmetadata) || {};
          info.artist = plain(meta.Artist && meta.Artist.value).slice(0, 120);
          info.license = plain(meta.LicenseShortName && meta.LicenseShortName.value);
          return info;
        }, function () { return info; });
      });
    });
  }
  function sized(src, px) {
    // Wikimedia thumbnails can be asked for at another of its standard widths.
    return /\/\d+px-[^/]+$/.test(src) ? src.replace(/\/(\d+)px-([^/]+)$/, "/" + px + "px-$2") : src;
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-portrait]"), function (box) {
    var title = box.getAttribute("data-portrait"), who = box.getAttribute("data-pictured") || "";
    var large = box.hasAttribute("data-art");
    portrait(title).then(function (p) {
      if (!p) return;
      var img = new Image();
      img.className = "entry-portrait";
      img.alt = "Portrait of " + who;
      img.decoding = "async";
      img.onload = function () {
        var credit = document.createElement("p");
        credit.className = "entry-credit";
        var bits = [p.artist, p.license].filter(Boolean).join(", ");
        credit.innerHTML = (large && who ? "Pictured: " + esc(who) + ". " : "") +
          '<a href="https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.file.replace(/ /g, "_")) + '">' +
          (bits ? esc(bits) + ", via Wikimedia Commons" : "Wikimedia Commons") + "</a>";
        box.innerHTML = "";
        box.appendChild(img);
        box.appendChild(credit);
        box.classList.add("has-portrait");
      };
      img.onerror = function () { if (img.src !== p.src) img.src = p.src; };
      img.src = sized(p.src, large ? 500 : 330);
    }).catch(function () {});
  });
})();
