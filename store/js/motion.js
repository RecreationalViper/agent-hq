// Page motion for every Forever Held page (styles: motion.css). No libraries.
// Kinetic headlines, rolling-label buttons, scroll-linked hero, nav tuck-away, scroll progress, pointer light.
(() => {
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  if (reduce) { root.classList.add("fh-ready"); return; }

  // ---- kinetic headlines ----
  function split(h) {
    let w = 0;
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => { if (!part) return; if (/^\s+$/.test(part)) return frag.append(" "); const s = el("span", "fh-w", part); s.style.setProperty("--w", w++); frag.append(s); });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(h); h.classList.add("fh-k");
  }
  const heads = $$("main h1, main section h2");
  heads.forEach(split);
  root.classList.add("fh-ready");
  const hio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("fh-in"); hio.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px", threshold: 0.2 });
  heads.forEach((h) => { if (h.tagName === "H1") { h.style.setProperty("--kd", "120ms"); requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add("fh-in"))); } else hio.observe(h); });

  // ---- hero pieces fly in, then float; lede and buttons follow ----
  const spring = "cubic-bezier(.34,1.45,.55,1)", smooth = "cubic-bezier(.22,1,.36,1)";
  $$(".stack img, .suite-row figure").forEach((n, i) => {
    const o = getComputedStyle(n).opacity;
    n.animate([{ opacity: 0, scale: ".7", filter: "blur(14px)" }, { opacity: o, scale: "1", filter: "blur(0)" }], { duration: 1300, delay: 350 + i * 140, easing: spring, fill: "backwards" });
  });
  $$(".hero .pill, .hero .lead, .hero .ctas, .hero .fine, .hero2 .lede, .hero2 .chips, .hero2 .hero-cta, .page-head p").forEach((n, i) =>
    n.animate([{ opacity: 0, transform: "translateY(18px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 1000, delay: 420 + i * 110, easing: smooth, fill: "backwards" }));
  const nav = $(".nav");
  nav?.animate([{ opacity: 0, transform: "translateY(-30px) scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: 60, easing: spring, fill: "backwards" });

  // ---- buttons: rolling label + arrow ----
  const ARROW = "M5 12h14M13 6l6 6-6 6";
  const svg = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ARROW); s.append(p); return s; };
  $$("a.btn, button.btn").forEach((b) => {
    const text = b.textContent.trim();
    if (b.children.length || !text) return;
    const roll = el("span", "fh-roll"), second = el("span", "", text);
    second.setAttribute("aria-hidden", "true");
    roll.append(el("span", "", text), second);
    b.replaceChildren(roll);
    if (b.matches(".amber, .btn-sage") && !b.closest("nav, .hcard")) { const a = el("span", "fh-arr"); a.append(svg(), svg()); b.append(a); }
  });

  // ---- scroll: progress line, nav tucks away going down, hero pieces drift ----
  const prog = el("div", "fh-prog"); prog.setAttribute("aria-hidden", "true"); document.body.append(prog);
  const rows = $$(".stack, .suite-row");
  let last = scrollY, ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY, max = root.scrollHeight - innerHeight;
    prog.style.setProperty("--p", max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    if (nav && !document.body.classList.contains("fh-lock")) {
      if (y > last + 6 && y > 360) nav.classList.add("fh-hide");
      else if (y < last - 6 || y < 120) nav.classList.remove("fh-hide");
    }
    if (y < 1400) rows.forEach((r) => r.style.setProperty("--sc", Math.round(y)));
    last = y;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // ---- light that follows the pointer / finger on glass ----
  $$(".fh-drawer, .fh-sbox, .fh-chat").forEach((p) => p.addEventListener("pointermove", (e) => {
    const r = p.getBoundingClientRect();
    p.style.setProperty("--mx", `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`); p.style.setProperty("--my", `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
  }, { passive: true }));
  if (fine) {
    $$(".card, .step, .final, .hcard, .cards > a, .panel").forEach((c) => {
      if (getComputedStyle(c).position !== "static") return;
      c.classList.add("fh-glow");
      c.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`); }, { passive: true });
    });
    // magnetic primary buttons
    $$(".btn.amber, .btn-sage, .fh-chatbtn").forEach((b) => {
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.setProperty("--tx", `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`); b.style.setProperty("--ty", `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`); });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); });
    });
    // hero leans toward the pointer
    const hero = $(".hero, .hero2");
    hero?.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      rows.forEach((s) => { s.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`); s.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`); });
    }, { passive: true });
    hero?.addEventListener("pointerleave", () => rows.forEach((s) => { s.style.setProperty("--ry", "0deg"); s.style.setProperty("--rx", "0deg"); }));
  }
})();
