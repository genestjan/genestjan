// Beki Eakins draft site: the motion layer and the one live thing (the stage picker).
// Everything works without this file; it only adds movement and the deck.
(function () {
  var doc = document.documentElement;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  doc.classList.add("js");

  // Signature move: the masked headline rises once the fonts are in.
  var ready = function () { document.body.classList.add("ready"); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(ready); });
  else ready();
  setTimeout(ready, 1200); // never leave the headline hidden

  // Entrances: each section's parts rise in turn, once.
  var parts = document.querySelectorAll("[data-in]");
  if ("IntersectionObserver" in window && !still) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    parts.forEach(function (p) { io.observe(p); });
  } else parts.forEach(function (p) { p.classList.add("in"); });

  // Films play only while on screen, and never under reduced motion or data saver.
  var save = navigator.connection && navigator.connection.saveData;
  document.querySelectorAll("video[data-loop]").forEach(function (v) {
    if (still || save) { v.removeAttribute("autoplay"); v.pause(); return; }
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
    });
    vo.observe(v);
  });

  // A slow push-in on films as they scroll past.
  var pushers = document.querySelectorAll("[data-push]");
  if (pushers.length && !still) {
    var tick = function () {
      pushers.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var k = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
        el.style.setProperty("--push", (1.04 + k * 0.1).toFixed(4));
      });
    };
    addEventListener("scroll", function () { requestAnimationFrame(tick); }, { passive: true });
    tick();
  }

  // The live thing: pick your stage, go to its chapter, see the right next step.
  document.querySelectorAll(".picker a").forEach(function (a) {
    a.addEventListener("click", function () {
      document.querySelectorAll(".picker a").forEach(function (b) { b.setAttribute("aria-current", "false"); });
      a.setAttribute("aria-current", "true");
      document.querySelectorAll(".stage").forEach(function (s) { s.classList.remove("is-picked"); });
      var t = document.querySelector(a.getAttribute("href"));
      if (t) t.classList.add("is-picked");
      try { localStorage.setItem("beki-stage", a.getAttribute("href")); } catch (e) {}
    });
  });
  try {
    var saved = localStorage.getItem("beki-stage");
    var mine = saved && document.querySelector('.picker a[href="' + saved + '"]');
    if (mine) { mine.setAttribute("aria-current", "true"); var st = document.querySelector(saved); if (st) st.classList.add("is-picked"); }
  } catch (e) {}

  // Podcast deck: cards fold into spines as the section is scrolled (desktop only).
  var wrap = document.querySelector(".deck-wrap");
  if (wrap && !still && matchMedia("(min-width: 861px)").matches) {
    var cards = wrap.querySelectorAll(".card");
    var stage = wrap.querySelector(".deck-stage");
    wrap.style.height = (100 + cards.length * 28) + "svh";
    stage.style.position = "sticky"; stage.style.top = "0";
    var fold = function () {
      var r = wrap.getBoundingClientRect();
      var span = wrap.offsetHeight - innerHeight;
      var k = Math.min(1, Math.max(0, -r.top / (span || 1)));
      var n = Math.min(cards.length - 1, Math.floor(k * cards.length));
      cards.forEach(function (c, i) { c.classList.toggle("spine", i < n); });
    };
    addEventListener("scroll", function () { requestAnimationFrame(fold); }, { passive: true });
    fold();
    cards.forEach(function (c, i) {
      c.addEventListener("click", function (ev) {
        if (!c.classList.contains("spine")) return;
        ev.preventDefault();
        var span = wrap.offsetHeight - innerHeight;
        scrollTo({ top: wrap.offsetTop + span * (i + 0.2) / cards.length, behavior: "smooth" });
      });
    });
  }

  // Wistia facades: the player loads only when someone presses play.
  document.querySelectorAll("button.vid[data-wistia]").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://fast.wistia.net/embed/iframe/" + b.dataset.wistia + "?autoPlay=true";
      f.allow = "autoplay; fullscreen"; f.title = b.getAttribute("aria-label") || "Video";
      b.innerHTML = ""; b.appendChild(f); b.disabled = true;
    }, { once: true });
  });
})();
