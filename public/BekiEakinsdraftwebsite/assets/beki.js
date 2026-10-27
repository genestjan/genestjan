// Beki Eakins draft site: motion and the small interactive parts.
// Without this file (or with reduced motion) every word and button is still there and works.
(function () {
  var d = document, html = d.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var G = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
  html.classList.add("js");
  if (!G || !ST || reduce) html.classList.add("static");

  // ---------- menu, nav, sticky call bar ----------
  var nav = d.querySelector(".nav"), menu = d.querySelector(".menu"), sticky = d.querySelector(".sticky");
  var lenis = null, lastY = 0;
  function onScroll(y) {
    if (nav) {
      nav.classList.toggle("solid", y > 40);
      nav.classList.toggle("hide", y > 600 && y > lastY && !(menu && menu.classList.contains("open")));
    }
    if (sticky) {
      var fin = d.querySelector(".final"), r = fin && fin.getBoundingClientRect();
      var pin = d.querySelector(".compass-pin"), pr = pin && pin.getBoundingClientRect();  // the stage cards have their own buttons
      sticky.classList.toggle("show", y > innerHeight * .8 && !(r && r.top < innerHeight) && !(pr && pr.top < innerHeight * .5 && pr.bottom > innerHeight * .5));
    }
    lastY = y;
  }
  d.querySelectorAll("[data-menu]").forEach(function (b) {
    b.addEventListener("click", function () {
      var open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      b.setAttribute("aria-expanded", open);
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open) menu.querySelector("a").focus();
    });
  });
  if (menu) menu.addEventListener("click", function (e) { if (e.target.closest("a")) { menu.classList.remove("open"); if (lenis) lenis.start(); } });

  // ---------- video lightbox (Wistia loads only when someone presses play) ----------
  var box = d.querySelector(".lightbox");
  d.querySelectorAll("[data-wistia]").forEach(function (b) {
    b.addEventListener("click", function () {
      var frame = box.querySelector(".box");
      frame.className = "box" + (b.dataset.shape === "wide" ? " wide" : "");
      frame.innerHTML = '<iframe src="https://fast.wistia.net/embed/iframe/' + b.dataset.wistia + '?autoPlay=true" allow="autoplay; fullscreen" allowfullscreen title="' + (b.getAttribute("aria-label") || "Video") + '"></iframe>';
      box.classList.add("open"); if (lenis) lenis.stop();
      box.querySelector(".close").focus();
    });
  });
  function closeBox() { if (!box) return; box.classList.remove("open"); box.querySelector(".box").innerHTML = ""; if (lenis) lenis.start(); }
  if (box) { box.addEventListener("click", function (e) { if (e.target === box || e.target.closest(".close")) closeBox(); }); }
  addEventListener("keydown", function (e) { if (e.key === "Escape") { closeBox(); if (menu) menu.classList.remove("open"); if (lenis) lenis.start(); } });

  // films play only on screen
  var films = d.querySelectorAll("video[data-loop]");
  if ("IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (es) { es.forEach(function (e) { if (reduce) return; if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); }); });
    films.forEach(function (v) { if (reduce) { v.removeAttribute("autoplay"); v.pause(); } vo.observe(v); });
  }

  // programme cards lift as they reach the middle of the phone screen
  d.querySelectorAll(".reel").forEach(function (r) {
    if (!("IntersectionObserver" in window)) return;
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle("near", e.intersectionRatio > .6); }); }, { root: r, threshold: [0, .6, 1] });
    r.querySelectorAll(".offer").forEach(function (o) { io2.observe(o); });
  });

  // drag to scroll the story reel with a mouse
  d.querySelectorAll(".vreel").forEach(function (r) {
    var down = false, x0 = 0, s0 = 0, moved = false;
    r.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = true; moved = false; x0 = e.clientX; s0 = r.scrollLeft; r.style.scrollSnapType = "none"; });
    addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - x0; if (Math.abs(dx) > 4) moved = true; r.scrollLeft = s0 - dx; });
    addEventListener("pointerup", function () { if (!down) return; down = false; r.style.scrollSnapType = ""; });
    r.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  if (!G || !ST) { addEventListener("scroll", function () { onScroll(scrollY); }, { passive: true }); return; }
  G.registerPlugin(ST); if (Split) G.registerPlugin(Split);

  // ---------- smooth scroll ----------
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on("scroll", function (e) { ST.update(); onScroll(e.scroll); });
    G.ticker.add(function (t) { lenis.raf(t * 1000); });
    G.ticker.lagSmoothing(0);
    d.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) { var t = d.querySelector(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.4 }); } });
    });
  } else addEventListener("scroll", function () { onScroll(scrollY); }, { passive: true });

  if (reduce) { G.set("[data-rv]", { opacity: 1, y: 0 }); return; }

  // ---------- hero: the one opening sequence ----------
  var hero = d.querySelector(".hero");
  if (hero) {
    var wait = html.classList.contains("curtain-on") ? 1.75 : 0;
    var tl = G.timeline({ defaults: { ease: "expo.out" }, delay: wait });
    tl.from(hero.querySelector(".hero-film"), { opacity: 0, duration: 2.2, ease: "power2.out" }, 0);
    var h1 = hero.querySelector("h1");
    if (Split && h1) {
      Split.create(h1, { type: "lines", mask: "lines", linesClass: "split-line", autoSplit: true, onSplit: function (self) {
        return G.from(self.lines, { yPercent: 108, duration: 1.25, stagger: .1, ease: "expo.out", delay: wait + .25 });
      } });
    }
    tl.to(hero.querySelectorAll("[data-rv]"), { opacity: 1, y: 0, duration: 1, stagger: .08, ease: "power3.out" }, .65);
    var obj = hero.querySelector(".hero-object");
    if (obj) tl.from(obj, { scale: .7, opacity: 0, rotation: -8, duration: 2, ease: "expo.out" }, .1)
      .from(obj.querySelectorAll(".chip"), { y: 40, opacity: 0, duration: 1.2, stagger: .18, ease: "power3.out" }, .9);
    G.to(hero.querySelector(".hero-film"), { scale: 1.12, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    G.to(hero.querySelector(".hero-grid"), { y: -90, opacity: .15, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
  }

  // ---------- drifting light: mint and gold motes rising slowly in every dark section ----------
  d.querySelectorAll("canvas.motes").forEach(function (c) {
    var g = c.getContext("2d"), dots = [], on = false, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = function () {
      c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
      var n = Math.min(70, Math.round(c.offsetWidth * c.offsetHeight / 16000)); dots = [];
      for (var i = 0; i < n; i++) dots.push({ x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.9, v: .00025 + Math.random() * .0006, s: Math.random() * 6.3, gold: Math.random() < .3 });
    };
    var tick = function (t) {
      if (!on) return;
      g.clearRect(0, 0, c.width, c.height);
      dots.forEach(function (p) {
        p.y -= p.v; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
        var a = .25 + .55 * (.5 + .5 * Math.sin(t / 900 + p.s)), x = (p.x + .012 * Math.sin(t / 2600 + p.s)) * c.width;
        g.beginPath(); g.arc(x, p.y * c.height, p.r * dpr, 0, 7);
        g.fillStyle = p.gold ? "rgba(216,180,69," + a + ")" : "rgba(159,217,188," + a + ")"; g.fill();
      });
      requestAnimationFrame(tick);
    };
    size(); addEventListener("resize", size);
    new IntersectionObserver(function (es) { var was = on; on = es[0].isIntersecting; if (on && !was) requestAnimationFrame(tick); }).observe(c);
  });

  // ---------- map lines draw themselves as each dark section comes in ----------
  d.querySelectorAll(".topo").forEach(function (svg) {
    var ps = svg.querySelectorAll("path");
    ps.forEach(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    G.to(ps, { strokeDashoffset: 0, ease: "none", stagger: .08, scrollTrigger: { trigger: svg.parentNode, start: "top 85%", end: "center 40%", scrub: 1 } });
  });

  // ---------- numbers count up ----------
  d.querySelectorAll("[data-count]").forEach(function (el) {
    var n = { v: 0 }, to = +el.dataset.count;
    G.to(n, { v: to, duration: 2.2, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: function () { el.textContent = Math.round(n.v).toLocaleString("en-GB"); } });
  });

  // ---------- words light up one by one as they are read ----------
  if (Split) d.querySelectorAll("[data-words]").forEach(function (el) {
    var sp = Split.create(el, { type: "words", wordsClass: "w" });
    G.to(sp.words, { opacity: 1, stagger: .1, ease: "none", scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 50%", scrub: true } });
  });

  // ---------- pictures unmask with a slow push-in ----------
  d.querySelectorAll("[data-reveal]").forEach(function (el) {
    var im = el.querySelector("img");
    var tl2 = G.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    tl2.to(el, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.out" });
    if (im && !im.hasAttribute("data-parallax")) tl2.from(im, { scale: 1.3, duration: 2, ease: "expo.out" }, 0);
  });

  // ---------- page heads on inner pages ----------
  d.querySelectorAll(".page-hero h1").forEach(function (h) {
    if (!Split) return;
    Split.create(h, { type: "lines", mask: "lines", linesClass: "split-line", autoSplit: true, onSplit: function (self) {
      return G.from(self.lines, { yPercent: 108, duration: 1.2, stagger: .1, ease: "expo.out", delay: .15 });
    } });
  });

  // ---------- reveals (the Tripwire .rv pattern) ----------
  ST.batch("[data-rv]:not(.hero [data-rv])", {
    start: "top 88%", once: true,
    onEnter: function (els) { G.to(els, { opacity: 1, y: 0, duration: .95, stagger: .09, ease: "power3.out", overwrite: true }); }
  });
  if (Split) d.querySelectorAll("[data-split]").forEach(function (h) {
    Split.create(h, { type: "lines", mask: "lines", linesClass: "split-line", autoSplit: true, onSplit: function (self) {
      return G.from(self.lines, { yPercent: 108, duration: 1.1, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 86%", once: true } });
    } });
  });
  d.querySelectorAll("[data-parallax]").forEach(function (el) {
    G.fromTo(el, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: el.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
  });

  // ---------- a thin line along the top shows how far down the page you are ----------
  var bar = d.createElement("div"); bar.className = "progress"; bar.setAttribute("aria-hidden", "true"); d.body.appendChild(bar);
  G.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .3 } });

  // ---------- the turning rings of words: slow on their own, faster while the page moves ----------
  var rings = d.querySelectorAll(".badge .spin");
  if (rings.length) {
    html.classList.add("spin-js");
    var turn = 0;
    G.ticker.add(function () {
      turn += .2 + Math.min(5, Math.abs(lenis ? lenis.velocity : 0) * .15);
      rings.forEach(function (r) { r.style.transform = "rotate(" + turn + "deg)"; });
    });
  }

  // ---------- the window: the film frame opens to the full screen and the line slides in ----------
  d.querySelectorAll(".window").forEach(function (w) {
    var narrow = innerWidth < 760;
    G.timeline({ scrollTrigger: { trigger: w.querySelector(".window-pin"), start: "top top", end: function () { return "+=" + innerHeight * 1.4; }, pin: true, scrub: .6 } })
      .fromTo(w.querySelector(".window-frame"), { clipPath: narrow ? "inset(22% 9% 22% 9% round 14px)" : "inset(19% 27% 19% 27% round 18px)" },
        { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "power2.inOut", duration: .6 }, 0)
      .fromTo(w.querySelectorAll("video"), { scale: 1.35 }, { scale: 1, ease: "power2.inOut", duration: .6 }, 0)
      .fromTo(w.querySelector(".window-shade"), { opacity: 0 }, { opacity: 1, duration: .3 }, .25)
      .from(w.querySelector(".eyebrow"), { opacity: 0, y: 24, duration: .2 }, .3)
      .from(w.querySelectorAll(".stagger > span"), { xPercent: function (i) { return i % 2 ? 30 : -30; }, opacity: 0, duration: .3, stagger: .08, ease: "power3.out" }, .32)
      .to({}, { duration: .3 });  // a beat with the line fully in before the page moves on
  });

  // ---------- giant type: the stages slide one way, the promise the other ----------
  d.querySelectorAll(".bt-row").forEach(function (r, i) {
    var far = function () { return -Math.max(0, r.scrollWidth - innerWidth) * .55; };
    G.fromTo(r, { x: i % 2 ? far : 0 }, { x: i % 2 ? 0 : far, ease: "none", immediateRender: true,
      scrollTrigger: { trigger: r.parentNode, start: "top bottom", end: "bottom top", scrub: .5, invalidateOnRefresh: true } });
  });

  // the map behind the numbers drifts slower than the page
  d.querySelectorAll(".stats-map img").forEach(function (im) {
    G.fromTo(im, { yPercent: -18 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: im.closest("section"), start: "top bottom", end: "bottom top", scrub: true } });
  });

  // ---------- desktop pointer: a ring that follows, and buttons that lean towards it ----------
  if (matchMedia("(pointer: fine)").matches) {
    var ring = d.createElement("div"); ring.className = "cursor"; ring.setAttribute("aria-hidden", "true"); ring.innerHTML = "<span></span>"; d.body.appendChild(ring);
    var rx = G.quickTo(ring, "x", { duration: .35, ease: "power3" }), ry = G.quickTo(ring, "y", { duration: .35, ease: "power3" }), word = ring.firstChild;
    addEventListener("pointermove", function (e) { rx(e.clientX); ry(e.clientY); ring.classList.add("on"); }, { passive: true });
    d.documentElement.addEventListener("pointerleave", function () { ring.classList.remove("on"); });
    d.addEventListener("pointerover", function (e) {
      var t = e.target.closest("[data-wistia], .vreel, a, button, summary"), say = "";
      if (t && t.matches("[data-wistia]")) say = "Play"; else if (t && t.matches(".vreel")) say = "Drag";
      word.textContent = say;
      ring.classList.toggle("label", !!say); ring.classList.toggle("big", !!t && !say);
    });
    d.querySelectorAll(".cta, .badge").forEach(function (b) {
      b.style.transition = "background .18s ease, box-shadow .18s ease";  // the CSS lift would fight the pull
      var bx = G.quickTo(b, "x", { duration: .6, ease: "elastic.out(1, .45)" }), by = G.quickTo(b, "y", { duration: .6, ease: "elastic.out(1, .45)" });
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); bx((e.clientX - r.left - r.width / 2) * .22); by((e.clientY - r.top - r.height / 2) * .32); });
      b.addEventListener("pointerleave", function () { bx(0); by(0); });
    });
  }

  // ---------- the compass: pinned, frames follow the scroll, one card per stage ----------
  var sec = d.querySelector(".compass");
  if (sec) {
    var canvas = sec.querySelector("canvas"), ctx = canvas.getContext("2d");
    var N = +sec.dataset.frames, phone = matchMedia("(max-width: 899px)").matches;
    var base = phone ? sec.dataset.m : sec.dataset.d, imgs = [], state = { f: 0 };
    var cards = sec.querySelectorAll(".stage-card"), bars = sec.querySelectorAll(".rail i"), cur = -1;
    var load = function (i) {
      if (imgs[i]) return imgs[i];
      var im = new Image(); im.decoding = "async";
      im.onload = function () { if (Math.round(state.f) === i || !drawn) draw(); };
      im.src = base + ("00" + i).slice(-3) + ".jpg";
      return (imgs[i] = im);
    };
    var drawn = false;
    var draw = function () {
      var i = Math.round(state.f), im = imgs[i];
      if (!(im && im.naturalWidth)) for (var k = 1; k < N; k++) {
        if (imgs[i - k] && imgs[i - k].naturalWidth) { im = imgs[i - k]; break; }
        if (imgs[i + k] && imgs[i + k].naturalWidth) { im = imgs[i + k]; break; }
      }
      if (!(im && im.naturalWidth)) return;
      var cw = canvas.width, ch = canvas.height, iw = im.naturalWidth, ih = im.naturalHeight, s, x, y;
      if (phone) {
        // the compass sits at 70% across the frame and is ~40% of its width: show it at 85% of the
        // phone's width, centred, in the upper third above the card; the frame's own dark fills the rest
        s = 2.1 * cw / iw; x = cw * .5 - iw * s * .7; y = ch * .3 - ih * s * .5;
        ctx.fillStyle = "#0a1c26"; ctx.fillRect(0, 0, cw, ch);
      } else { s = Math.max(cw / iw, ch / ih); x = (cw - iw * s) / 2; y = (ch - ih * s) / 2; }
      ctx.drawImage(im, x, y, iw * s, ih * s); drawn = true;
    };
    var fit = function () { var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); draw(); };
    load(0); load(N - 1);
    ST.create({ trigger: sec, start: "top 260%", once: true, onEnter: function () { for (var i = 0; i < N; i++) load(i); } });
    var stageOf = function (p) {
      var n = cards.length, j = Math.min(n - 1, Math.floor(p * n * .999));
      if (j !== cur) { cards.forEach(function (c, k) { c.classList.toggle("on", k === j); c.setAttribute("aria-hidden", k !== j); }); cur = j; }
      bars.forEach(function (b, k) { b.style.width = Math.max(0, Math.min(1, p * n - k)) * 100 + "%"; });
    };
    G.to(state, {
      f: N - 1, ease: "none", onUpdate: draw,
      scrollTrigger: { trigger: sec.querySelector(".compass-pin"), start: "top top", end: function () { return "+=" + innerHeight * 4.5; }, pin: true, scrub: .6,
        onUpdate: function (self) { stageOf(self.progress); }, onRefresh: fit }
    });
    stageOf(0); addEventListener("resize", fit); fit();
  }

  // ---------- ways to work: the reel moves sideways on wide screens ----------
  var mm = G.matchMedia();
  mm.add("(min-width: 1024px)", function () {
    var track = d.querySelector(".work-track");
    if (!track) return;
    var dist = function () { return Math.max(0, track.scrollWidth - track.parentNode.clientWidth); };
    G.to(track, { x: function () { return -dist(); }, ease: "none",
      scrollTrigger: { trigger: ".work", start: "top top", end: function () { return "+=" + dist(); }, pin: true, scrub: .6, invalidateOnRefresh: true } });
  });

  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { ST.refresh(); });
  addEventListener("load", function () { ST.sort(); ST.refresh(); });  // pins first in page order, so everything below them measures right
})();
