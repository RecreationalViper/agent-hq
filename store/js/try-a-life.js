// Try A Life: live preview of the program cover / welcome sign as the visitor types.
// Nothing is stored or sent. Text goes in with textContent only.
(() => {
  const $ = (id) => document.getElementById(id);
  const U = (v) => (v * 100 / 528).toFixed(3) + "cqw";
  const SAMPLE = { nm: "Walter James Brooks", y1: "1939", y2: "2026", cl: "Machinist, fisherman, grandfather of nine and the best storyteller on Elm Street", sv: "Saturday, November 22, 2026 · 11:00 AM\nSt. Mark's Church · Fairview" };
  const ins = ["nm", "y1", "y2", "cl", "sv"].reduce((o, k) => (o[k] = $(k), o), {});
  const el = { pg: $("pg"), name: $("name"), line: $("line"), yr: $("yr"), svc: $("svc"), ph: $("ph"), frule: $("frule"), kr: $("kr") };
  let view = "cover", demo = true, typed = { nm: "", cl: "" };

  function fitName() {
    let s = 40;
    el.name.style.fontSize = U(s);
    while (s > 22 && el.name.scrollWidth > el.name.clientWidth + 1) { s -= 1; el.name.style.fontSize = U(s); }
  }
  function layout() {
    const H = view === "sign" ? 792 : 816, photoH = H - 222 - 194;
    el.pg.classList.toggle("sign", view === "sign");
    el.ph.style.top = U(222); el.ph.style.height = U(photoH);
    el.name.style.top = U(222 + photoH + 8);
    el.line.style.top = U(222 + photoH + 64);
    el.frule.style.top = U(H - 80);
    el.svc.style.top = U(H - 70);
    el.kr.textContent = view === "sign" ? "WELCOME" : "COMMEMORATIVE ISSUE";
    el.pg.setAttribute("aria-label", view === "sign" ? "Preview of the A Life welcome sign with the name you typed" : "Preview of the A Life program cover with the name you typed");
  }
  const val = (k) => (demo ? null : ins[k].value.trim()) || SAMPLE[k];
  function render() {
    el.name.textContent = demo ? typed.nm : val("nm");
    el.line.textContent = demo ? typed.cl : val("cl");
    el.name.classList.toggle("caret", demo && typed.nm.length < SAMPLE.nm.length);
    el.line.classList.toggle("caret", demo && typed.nm.length === SAMPLE.nm.length && typed.cl.length < SAMPLE.cl.length);
    const y1 = demo ? SAMPLE.y1 : val("y1"), y2 = demo ? SAMPLE.y2 : val("y2");
    el.yr.textContent = `${y1}  —  ${y2}`;
    el.svc.textContent = view === "sign" ? "Welcome · Thank you for being here" : val("sv");
    fitName();
  }

  // Opening demo: the sample name types itself in, so visitors see the design fill.
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function step() {
    if (!demo) return;
    if (typed.nm.length < SAMPLE.nm.length) typed.nm = SAMPLE.nm.slice(0, typed.nm.length + 1);
    else if (typed.cl.length < SAMPLE.cl.length) typed.cl = SAMPLE.cl.slice(0, typed.cl.length + 2);
    else return render();
    render();
    setTimeout(step, typed.cl ? 22 : 85);
  }
  function stopDemo() {
    if (!demo) return;
    demo = false;
    render();
  }

  Object.values(ins).forEach((i) => {
    i.addEventListener("focus", stopDemo);
    i.addEventListener("input", () => {
      stopDemo();
      render();
      const t = i.id === "nm" ? el.name : i.id === "cl" ? el.line : i.id === "sv" ? el.svc : el.yr;
      t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop");
    });
  });
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.view;
    document.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    layout(); render();
  }));
  document.getElementById("f").addEventListener("submit", (e) => e.preventDefault());

  layout();
  if (reduce) { typed = { nm: SAMPLE.nm, cl: SAMPLE.cl }; render(); }
  else { render(); setTimeout(step, 500); }
  if (document.fonts) document.fonts.ready.then(fitName);
})();
