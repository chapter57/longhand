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
  function art(e) {
    if (e.image) {
      var src = e.image.charAt(0) === "/" ? e.image : "/" + e.image;
      return '<img class="entry-portrait" src="' + esc(src) + '" alt="' + esc(e.name) + '" loading="lazy">';
    }
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

  function ago(e, today) {
    var n = today.getFullYear() - e.year;
    if (n <= 0) return "";
    return n + (n === 1 ? " year" : " years") + " ago";
  }

  function card(e, today, opts) {
    opts = opts || {};
    var when = MONTHS[e.month - 1] + " " + e.day + ", " + e.year;
    var years = opts.isToday ? ago(e, today) : "";
    var links = '<a href="' + esc(e.read) + '">' + esc(e.read_label || "Read") + "</a>" +
      (e.wiki ? '<a href="' + esc(e.wiki) + '">Read more</a>' : "");
    var credit = e.image && e.image_credit ? '<p class="entry-credit">Portrait: ' + esc(e.image_credit) + "</p>" : "";
    var tag = opts.heading || "h3";
    return '<article class="entry' + (opts.feature ? " entry-feature" : "") + '">' +
      '<div class="entry-art">' + art(e) + "</div>" +
      '<div class="entry-copy">' +
      '<p class="entry-kicker"><span class="kind kind-' + slug(e.kind) + '">' + esc(e.kind) + "</span>" +
      "<span>" + esc(when) + "</span>" + (years ? "<span>" + esc(years) + "</span>" : "") + "</p>" +
      "<" + tag + ' class="entry-name">' + esc(e.name) + "</" + tag + ">" +
      '<p class="entry-note">' + esc(e.note) + "</p>" +
      '<p class="entry-links">' + links + "</p>" + credit +
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
          items.push('<li><a href="/almanac/#' + anchor(e) + '"><span class="strip-date">' +
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
})();
