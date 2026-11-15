// Forever Held v3 home (styles: v3.css). No libraries: canvas + requestAnimationFrame + IntersectionObserver.
// Hero particle sculpture, word-by-word manifesto, sticky "assembly" story, collection filters, look switcher,
// exploded figures, chapter nav, motion toggle (body.motion-paused), Cmd/Ctrl+K search.
(() => {
  const root = document.documentElement, body = document.body;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t), span = (v, a, b) => clamp((v - a) / (b - a));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saved = (() => { try { return localStorage.getItem("fh-motion"); } catch { return null; } })();
  let paused = reduce || saved === "off";
  root.classList.add("v3-live");

  // ---- motion toggle ----
  const toggle = $(".motion-toggle");
  function setPaused(v) {
    paused = v; body.classList.toggle("motion-paused", v);
    if (toggle) { toggle.setAttribute("aria-pressed", String(!v)); $("span", toggle).textContent = v ? "Motion off" : "Motion on"; }
    $$("video[autoplay]").forEach((vd) => (v ? vd.pause() : vd.play().catch(() => {})));
    try { localStorage.setItem("fh-motion", v ? "off" : "on"); } catch {}
    if (!v) requestAnimationFrame(loop);
  }
  toggle?.addEventListener("click", () => setPaused(!paused));

  // ---- reveal ----
  const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$("[data-reveal]").forEach((n) => { n.style.setProperty("--rd", n.dataset.reveal || 0); rio.observe(n); });

  // ---- particle fields ----
  function fit(c) {
    const d = Math.min(devicePixelRatio || 1, 2), r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
    const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); return [x, r.width, r.height];
  }
  // points along a "page" wireframe (border, photo circle, text lines), in -1..1 units, aspect .72
  function pagePoints(n) {
    const segs = [], W = 0.72, add = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1)]);
    const rect = (w, h) => { add(-w, -h, w, -h); add(w, -h, w, h); add(w, h, -w, h); add(-w, h, -w, -h); };
    rect(W, 1); rect(W - 0.07, 0.93);
    for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.283, b = ((i + 1) / 28) * 6.283; add(Math.cos(a) * 0.26, -0.38 + Math.sin(a) * 0.26, Math.cos(b) * 0.26, -0.38 + Math.sin(b) * 0.26); }
    [[0.06, 0.46], [0.19, 0.3], [0.4, 0.5], [0.5, 0.42], [0.6, 0.46], [0.76, 0.2]].forEach(([y, w]) => add(-w, y, w, y));
    const total = segs.reduce((s, g) => s + g[4], 0), pts = [];
    for (let i = 0; i < n; i++) { let d = (i / n) * total, k = 0; while (d > segs[k][4]) d -= segs[k++][4]; const g = segs[k], t = d / g[4]; pts.push([lerp(g[0], g[2], t), lerp(g[1], g[3], t)]); }
    return pts;
  }
  const phoneW = () => innerWidth < 760;

  // HERO: a slowly turning sphere of light that settles into the outline of a printed page as you scroll
  const sc = $("#sculpture"), hero = $(".hero");
  const N = phoneW() ? 620 : 1150, sphere = [], page = pagePoints(N);
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; sphere.push([Math.cos(a) * r, y, Math.sin(a) * r, Math.random()]); }
  let heroOn = true, heroP = 0;
  function drawHero(t) {
    const [x, w, h] = fit(sc); x.clearRect(0, 0, w, h);
    const wide = w > 760, cx = w * (wide ? 0.72 : 0.5), cy = h * (wide ? 0.46 : 0.3), R = Math.min(w, h) * (wide ? 0.34 : 0.4);
    const p = ease(span(heroP, 0.04, 0.72)), rot = t * 0.00022 + heroP * 2.4, cs = Math.cos(rot), sn = Math.sin(rot), tilt = 0.35;
    for (let i = 0; i < N; i++) {
      const s = sphere[i], g = page[i];
      const breathe = 1 + Math.sin(t * 0.0012 + s[3] * 20) * 0.025;
      let X = (s[0] * cs - s[2] * sn) * breathe, Z = s[0] * sn + s[2] * cs, Y = s[1] * Math.cos(tilt) * breathe - Z * Math.sin(tilt);
      const per = 1 / (1.55 - Z * 0.55);
      const sx = X * per * 1.15, sy = Y * per * 1.15;
      const px = lerp(sx, g[0] * 0.95, p), py = lerp(sy, g[1] * 0.95, p);
      const depth = lerp((Z + 1) / 2, 0.8, p), size = lerp(0.5 + depth * 1.9, 1.35, p);
      x.globalAlpha = lerp(0.12 + depth * 0.8, 0.85, p) * (1 - span(heroP, 0.86, 1));
      x.fillStyle = s[3] > 0.82 ? "#fff6e6" : "#e6b47f";
      x.fillRect(cx + px * R - size / 2, cy + py * R - size / 2, size, size);
    }
  }

  // ASSEMBLY: a cloud of light gathers into the page, the real program turns to face you, then its companions fan out
  const asm = $(".assembly"), ac = $("#assembly-canvas"), apage = $(".assembly-page"), chapters = $$(".chapters div"), typed = $(".assembly-type span");
  const NAME = typed?.dataset.text || "", M = phoneW() ? 420 : 760, cloud = [];
  for (let i = 0; i < M; i++) cloud.push([(Math.random() * 2 - 1), (Math.random() * 2 - 1), Math.random() * 6.283, 0.4 + Math.random()]);
  let asmOn = false, asmP = 0;
  function drawAsm(t) {
    const [x, w, h] = fit(ac); x.clearRect(0, 0, w, h);
    const ph = Math.min(h * 0.62, 560), pw = ph * 0.667, cx = w / 2, cy = h / 2;
    const p = ease(span(asmP, 0.02, 0.3)), fade = 1 - span(asmP, 0.3, 0.44), cols = Math.round(Math.sqrt(M * 0.667)), rows = Math.ceil(M / cols);
    if (fade <= 0) return;
    for (let i = 0; i < M; i++) {
      const c = cloud[i], drift = t * 0.0004 * c[3];
      const ax = cx + (c[0] * w * 0.52) + Math.cos(c[2] + drift) * 26, ay = cy + (c[1] * h * 0.5) + Math.sin(c[2] * 1.3 + drift) * 26;
      const gx = cx - pw / 2 + ((i % cols) + 0.5) / cols * pw, gy = cy - ph / 2 + (Math.floor(i / cols) + 0.5) / rows * ph;
      const k = clamp(p * 1.35 - (i / M) * 0.35), e = ease(k);
      x.globalAlpha = lerp(0.18 + c[3] * 0.3, 0.75, e) * fade; x.fillStyle = c[3] > 1.2 ? "#fff6e6" : "#e6b47f";
      const s = lerp(1 + c[3], 1.4, e); x.fillRect(lerp(ax, gx, e) - s / 2, lerp(ay, gy, e) - s / 2, s, s);
    }
  }
  function layoutAsm() {
    const q = ease(span(asmP, 0.24, 0.5)), st = asm.style;
    st.setProperty("--arx", `${lerp(58, 0, q).toFixed(2)}deg`); st.setProperty("--ary", `${lerp(-28, 0, q).toFixed(2)}deg`); st.setProperty("--asc", lerp(0.72, 1, q).toFixed(3)); st.setProperty("--aop", span(asmP, 0.26, 0.42).toFixed(3));
    const ty = span(asmP, 0.42, 0.52) * (1 - span(asmP, 0.7, 0.76)); st.setProperty("--top", ty.toFixed(3));
    if (typed) typed.textContent = NAME.slice(0, Math.round(span(asmP, 0.46, 0.66) * NAME.length));
    const f = ease(span(asmP, 0.7, 0.94)), reach = Math.min(innerWidth * 0.36, 400);
    st.setProperty("--sx", `${(f * reach).toFixed(1)}px`); st.setProperty("--sr", f.toFixed(3)); st.setProperty("--sop", span(asmP, 0.68, 0.8).toFixed(3)); st.setProperty("--ap", asmP.toFixed(4));
    const idx = asmP < 0.36 ? 0 : asmP < 0.7 ? 1 : 2; chapters.forEach((c, i) => c.classList.toggle("on", i === idx));
  }

  // ---- manifesto: words light up with the scroll ----
  const mani = $(".manifesto p.big");
  if (mani) {
    const frag = document.createDocumentFragment();
    [...mani.childNodes].forEach((n) => { const gold = n.nodeType === 1; (n.textContent || "").split(/(\s+)/).forEach((part) => { if (!part) return; if (/^\s+$/.test(part)) return frag.append(" "); const s = document.createElement("span"); s.className = "mw" + (gold ? " g" : ""); s.textContent = part; frag.append(s); }); });
    mani.replaceChildren(frag);
  }
  const mwords = $$(".manifesto .mw");

  // ---- figures spread apart as they pass through the screen; collection art fans out ----
  const figures = $$(".feature svg").map((s) => [s, $$(".figure-layer", s)]), cards = $$(".project-art"), nav = $(".nav");
  function onScroll() {
    const vh = innerHeight, y = scrollY;
    nav?.classList.toggle("scrolled", y > 40);
    const hr = hero.getBoundingClientRect(); heroP = clamp(-hr.top / (hr.height * 0.9)); heroOn = hr.bottom > 0;
    const ar = asm.getBoundingClientRect(); asmP = clamp(-ar.top / (ar.height - vh)); asmOn = ar.top < vh && ar.bottom > 0;
    if (asmOn) layoutAsm();
    if (mani) { const r = mani.getBoundingClientRect(), p = clamp((vh * 0.86 - r.top) / (r.height + vh * 0.42)); const upto = p * (mwords.length + 2); mwords.forEach((w, i) => w.classList.toggle("on", reduce || i < upto)); }
    figures.forEach(([s, layers]) => { const r = s.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const p = clamp((vh - r.top) / (vh + r.height)), sp = Math.sin(p * Math.PI) * 15; layers.forEach((l, i) => (l.style.transform = `translateY(${((i - (layers.length - 1) / 2) * -sp).toFixed(2)}px)`)); });
    cards.forEach((c) => { const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const d = Math.abs((r.top + r.height / 2) - vh / 2) / (vh * 0.6); c.style.setProperty("--s", ease(clamp(1 - d)).toFixed(3)); });
    if (paused) { if (heroOn) drawHero(performance.now()); if (asmOn) drawAsm(performance.now()); }
  }
  let tick = false; addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; onScroll(); }); } }, { passive: true });
  addEventListener("resize", onScroll);
  let running = false;
  function loop(t) { if (paused) { running = false; return; } running = true; if (heroOn) drawHero(t); if (asmOn) drawAsm(t); requestAnimationFrame(loop); }
  onScroll(); setPaused(paused); if (paused) { drawHero(0); } else if (!running) requestAnimationFrame(loop);

  // ---- collection filters ----
  $$(".filters button").forEach((b) => b.addEventListener("click", () => {
    $$(".filters button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    const f = b.dataset.filter;
    $$(".project-card").forEach((c, i) => { const show = f === "all" || c.dataset.kind.split(" ").includes(f); c.hidden = !show; c.classList.remove("fade"); if (show) { void c.offsetWidth; c.style.animationDelay = `${i * 70}ms`; c.classList.add("fade"); } });
    onScroll();
  }));

  // ---- story: steps pick the piece, the palette picks the look ----
  const editor = $(".editor-wrap"), steps = $$(".story-steps > div"), looks = $$(".palette button"), imgs = $$(".editor-stage img");
  let step = 0, look = looks[0]?.dataset.look;
  function showPiece() { imgs.forEach((im) => im.classList.toggle("on", im.dataset.look === look && +im.dataset.step === step)); steps.forEach((s, i) => s.classList.toggle("on", i === step)); }
  function setLook(b) {
    look = b.dataset.look; looks.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    editor.style.setProperty("--look", b.dataset.bg); $(".editor-bar span", editor).textContent = b.dataset.name; const a = $(".editor-bar a", editor); a.href = b.dataset.href; a.textContent = `View set · ${b.dataset.price}`;
    showPiece();
  }
  looks.forEach((b) => b.addEventListener("click", () => setLook(b)));
  const sio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { step = steps.indexOf(e.target); showPiece(); } }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => sio.observe(s)); if (looks[0]) setLook(looks[0]);

  // ---- chapter nav ----
  const links = $$(".chapter-nav a"), cio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((l) => l.classList.toggle("on", l.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-40% 0px -55% 0px" });
  links.forEach((l) => { const t = $(l.getAttribute("href")); if (t) cio.observe(t); });

  // ---- composer: questions go to the assistant; Cmd/Ctrl+K opens search ----
  const comp = $(".composer form"), ta = comp && $("textarea", comp);
  const send = (q) => { q = (q || "").trim(); if (!q) return ta?.focus(); if (window.fhAsk) window.fhAsk(q); if (ta) ta.value = ""; };
  comp?.addEventListener("submit", (e) => { e.preventDefault(); send(ta.value); });
  ta?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
  $$(".composer .hints button").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
  addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("[data-fh-search]")?.click(); } });
})();
