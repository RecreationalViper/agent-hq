// Store chrome: menu drawer, site search (search.json), assistant chat (Worker POST /chat) and page motion.
// Markup comes from tools/site_chrome.py. All text from data is added with textContent (no innerHTML).
(() => {
  const CHAT_API = "https://foreverheld-sales.foreverheld.workers.dev/chat";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = () => matchMedia("(max-width:560px)").matches;

  // ---- scroll reveal: sections and cards glide in as they enter the screen ----
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("fh-seen"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    const groups = new Map();
    $$(".hcard, .card, .step, .cards > a, .faq details, main > section > h2, .panel, .final").forEach((t) => {
      if (t.getBoundingClientRect().top < innerHeight * 0.9) return; // already on screen: leave it alone
      const g = t.parentElement, n = groups.get(g) || 0; groups.set(g, n + 1);
      t.style.setProperty("--d", Math.min(n, 5)); t.classList.add("fh-rv"); io.observe(t);
    });
  }

  const drawer = $("#fh-drawer"), scrim = $(".fh-scrim"), search = $("#fh-search"), chatBox = $("#fh-chat"), chatBtn = $(".fh-chatbtn");
  if (!drawer) return;
  const store = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  let lastFocus = null;
  const isOpen = (n) => !n.hidden && n.dataset.state !== "closing";
  const lock = () => document.body.classList.toggle("fh-lock", isOpen(drawer) || isOpen(search) || (isOpen(chatBox) && phone()));
  const setExp = (sel, v) => $$(sel).forEach((b) => b.hasAttribute("aria-expanded") && b.setAttribute("aria-expanded", String(v)));

  // Open/close with motion: data-state "" -> "open" (spring in), "closing" (quick out) -> hidden.
  function show(n) { n.hidden = false; n.dataset.state = ""; void n.offsetWidth; requestAnimationFrame(() => (n.dataset.state = "open")); }
  function hide(n, ms = 320) {
    if (n.hidden) return;
    n.dataset.state = "closing";
    setTimeout(() => { if (n.dataset.state === "closing") { n.hidden = true; n.dataset.state = ""; lock(); } }, reduce ? 0 : ms);
  }

  // ---- menu drawer ----
  [...$$(".fh-dsearch", drawer), ...$(".fh-dnav", drawer).children, $(".fh-dfoot", drawer)].forEach((n, i) => { n.dataset.i = ""; n.style.setProperty("--i", Math.min(i, 14)); });
  $$(".fh-acc", drawer).forEach((d) => [...d.children].forEach((c, j) => c.style.setProperty("--j", j)));
  function openMenu() {
    closeSearch(false); lastFocus = document.activeElement;
    show(drawer); show(scrim); setExp("[data-fh-menu]", true); lock();
    setTimeout(() => $(".fh-icon", drawer).focus({ preventScroll: true }), 60);
  }
  function closeMenu(restore = true) {
    if (!isOpen(drawer)) return;
    hide(drawer, 330); hide(scrim, 260); setExp("[data-fh-menu]", false);
    if (restore) lastFocus?.focus?.({ preventScroll: true });
  }

  // ---- search ----
  const input = $("input", search), results = $(".fh-results", search);
  let index = null, loading = null, animate = false;
  const load = () => loading ||= fetch("search.json").then((r) => r.json()).then((j) => (index = j.items || [])).catch(() => (index = []));
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const SYN = { christmas: ["evergreen", "ornament"], thanksgiving: ["harvest"], blue: ["longest"], church: ["service", "longest"], obituary: ["program"], sign: ["welcome"], refund: ["refunds"], cards: ["card"] };
  function score(it, words) {
    const t = norm(it.title), d = norm(it.desc), x = norm(it.text);
    let s = 0;
    for (const w of words) {
      const best = Math.max(...[w, ...(SYN[w] || [])].map((a) => (t.includes(a) ? 10 : d.includes(a) ? 4 : x.includes(a) ? 1 : 0)));
      if (!best) return 0;
      s += best;
    }
    return s + (it.group === "Products" ? 3 : 0);
  }
  function mark(parent, text, words) {
    const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    if (!alt) return parent.append(text);
    const whole = new RegExp(`^(${alt})$`, "i");
    text.split(new RegExp(`(${alt})`, "ig")).forEach((part) => part && parent.append(whole.test(part) ? el("mark", "", part) : part));
  }
  function snippet(it, words) {
    const x = it.text || "", nx = norm(x);
    const w = words.find((w) => nx.includes(w));
    if (it.desc && (!w || norm(it.desc).includes(w) || norm(it.title).includes(w))) return it.desc;
    const i = w ? nx.indexOf(w) : -1;
    return i >= 0 ? (i > 40 ? "…" : "") + x.slice(Math.max(0, i - 40), i + 110).trim() + "…" : it.desc || x.slice(0, 140);
  }
  function hit(it, words) {
    const a = el("a", "fh-hit"); a.href = it.url;
    if (it.img) { const im = el("img"); im.src = it.img; im.alt = ""; im.loading = "lazy"; a.append(im); }
    const sp = el("span"), b = el("b"), sm = el("small");
    mark(b, it.title, words); mark(sm, snippet(it, words), words);
    sp.append(b, sm); a.append(sp);
    a.addEventListener("click", () => setTimeout(() => closeSearch(false), 0));
    return a;
  }
  function render() {
    const q = input.value.trim();
    results.replaceChildren();
    results.classList.toggle("fh-anim", animate);
    if (!index) { results.append(el("p", "fh-none", "Loading…")); load().then(render); return; }
    if (!q) {
      results.append(el("h3", "", "Popular searches"));
      const chips = el("div", "fh-chips");
      ["Funeral program", "Christmas", "Thanksgiving", "Welcome sign", "Church service", "Refunds", "How to print"].forEach((c) => { const b = el("button", "", c); b.type = "button"; b.onclick = () => { input.value = c; render(); input.focus(); }; chips.append(b); });
      results.append(chips, el("h3", "", "Shop"));
      index.filter((i) => i.group === "Products").forEach((i) => results.append(hit(i, [])));
    } else {
      const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
      const found = index.map((it) => [score(it, words), it]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([, it]) => it);
      if (!found.length) results.append(el("p", "fh-none", `No pages match “${q}”. Our assistant can still help:`));
      for (const g of ["Products", "Questions", "Guides", "Pages"]) {
        const list = found.filter((i) => i.group === g);
        if (!list.length) continue;
        results.append(el("h3", "", g === "Questions" ? "Questions families ask" : g));
        list.forEach((i) => results.append(hit(i, words)));
      }
      const ask = el("button", "fh-ask"); ask.type = "button"; ask.textContent = `✦  Ask our assistant: “${q.slice(0, 80)}”`;
      ask.onclick = () => { closeSearch(false); openChat(q); };
      results.append(ask);
    }
    [...results.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 12)));
  }
  function openSearch() {
    if (isOpen(drawer)) closeMenu(false); else lastFocus = document.activeElement;
    show(search); setExp("[data-fh-search]", true); lock(); load();
    animate = true; render(); setTimeout(() => (animate = false), 700);
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }
  function closeSearch(restore = true) {
    if (!isOpen(search)) return;
    hide(search, 280); setExp("[data-fh-search]", false);
    if (restore) lastFocus?.focus?.({ preventScroll: true });
  }
  input.addEventListener("input", render);
  $("form", search).addEventListener("submit", (e) => { e.preventDefault(); const first = $(".fh-hit", results); if (first) first.click(); else $(".fh-ask", results)?.click(); });
  search.addEventListener("click", (e) => { if (e.target === search) closeSearch(); });

  // ---- assistant chat ----
  const log = $(".fh-log", chatBox), form = $("form", chatBox), ta = $("textarea", chatBox), send = $("button[type=submit]", chatBox);
  let msgs = store.get("fh-chat") || [], busy = false, drawn = false;
  const HELLO = "Hello, and I'm sorry if you're here because you've lost someone. I can help with planning a funeral or memorial, wording, customs, what to do next, or any question about our printables.";
  const SUGG = ["What goes in a funeral program?", "How do I fill in the files on my phone?", "Burial or cremation: what's the difference?", "Help me write a short eulogy", "What is a Blue Christmas service?"];
  function richText(node, text) {
    const add = (parent, line) => line.split(/(https?:\/\/[^\s)<>"]+)/g).forEach((part, i) => {
      if (i % 2) { const url = part.replace(/[.,;:!?]+$/, ""), a = el("a", "", url.replace(/^https:\/\/foreverheld\.pages\.dev\/?/, "foreverheld.pages.dev/")); a.href = url; if (!/^https:\/\/foreverheld\.pages\.dev/.test(url)) { a.target = "_blank"; a.rel = "noopener"; } parent.append(a, part.slice(url.length)); }
      else parent.append(part);
    });
    const isLi = (l) => /^\s*([-•*]|\d+[.)])\s+/.test(l);
    let ul = null, p = null;
    for (const line of text.split("\n")) {
      if (!line.trim()) { ul = p = null; continue; }
      if (isLi(line)) { p = null; if (!ul) node.append((ul = el("ul"))); const li = el("li"); add(li, line.replace(/^\s*([-•*]|\d+[.)])\s+/, "")); ul.append(li); }
      else { ul = null; if (p) p.append("\n"); else node.append((p = el("p"))); add(p, line); }
    }
  }
  function bubble(m, still) {
    const d = el("div", `fh-msg ${m.role === "user" ? "u" : "a"}${still ? " old" : ""}`);
    m.role === "user" ? (d.textContent = m.content) : richText(d, m.content);
    log.append(d); return d;
  }
  const toEnd = () => log.scrollTo({ top: log.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  function drawAll() {
    log.replaceChildren();
    bubble({ role: "assistant", content: HELLO }, msgs.length > 0);
    if (!msgs.length) {
      const s = el("div", "fh-sugg");
      SUGG.forEach((q, i) => { const b = el("button", "", q); b.type = "button"; b.style.setProperty("--i", i); b.onclick = () => ask(q); s.append(b); });
      log.append(s);
    }
    msgs.forEach((m) => bubble(m, true));
    log.scrollTop = log.scrollHeight;
  }
  async function ask(q) {
    q = (q || "").trim(); if (!q || busy) return;
    busy = true; send.disabled = true; ta.value = ""; grow();
    $(".fh-sugg", log)?.remove();
    msgs.push({ role: "user", content: q.slice(0, 1200) }); store.set("fh-chat", msgs);
    bubble(msgs[msgs.length - 1]); toEnd();
    const t = el("div", "fh-msg a fh-typing"); t.append(el("i"), el("i"), el("i")); t.setAttribute("aria-label", "Writing an answer");
    setTimeout(() => { if (busy) { log.append(t); toEnd(); } }, 250);
    let text, ok = false;
    try {
      const r = await fetch(CHAT_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs.slice(-10), page: location.pathname }) });
      const j = await r.json().catch(() => ({}));
      ok = !!j.ok; text = j.text || "Sorry, something went wrong. Please try again, or message us at https://foreverheld.pages.dev/contact.html";
    } catch { text = "I couldn't connect just now. Please check your connection and try again, or message us at https://foreverheld.pages.dev/contact.html"; }
    busy = false; t.remove();
    if (ok) { msgs.push({ role: "assistant", content: text }); store.set("fh-chat", msgs.slice(-20)); }
    bubble({ role: "assistant", content: text }); toEnd();
    send.disabled = false; ta.focus({ preventScroll: true });
  }
  function grow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(ta.value); });
  function openChat(prefill) {
    closeMenu(false); closeSearch(false); lastFocus = document.activeElement;
    chatBox.hidden = false; chatBox.dataset.state = "";
    // grow out of the "Ask us" button, wherever it is
    const b = chatBtn.getBoundingClientRect(), c = chatBox.getBoundingClientRect();
    chatBox.style.setProperty("--fh-ox", `${b.left + b.width / 2 - c.left}px`); chatBox.style.setProperty("--fh-oy", `${b.top + b.height / 2 - c.top}px`);
    if (!drawn) { drawAll(); drawn = true; }
    show(chatBox); chatBtn.hidden = true; lock();
    if (prefill) setTimeout(() => ask(prefill), 250); else setTimeout(() => ta.focus({ preventScroll: true }), 120);
  }
  function closeChat() {
    if (!isOpen(chatBox)) return;
    hide(chatBox, 300);
    setTimeout(() => { chatBtn.hidden = false; chatBtn.style.animation = "none"; void chatBtn.offsetWidth; chatBtn.style.animation = "fh-pop .6s var(--fh-spring) backwards"; chatBtn.focus({ preventScroll: true }); }, reduce ? 0 : 220);
  }

  // ---- wiring ----
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-fh-menu],[data-fh-search],[data-fh-chat],[data-fh-close]");
    if (!t) return;
    if (t.matches("[data-fh-menu]")) openMenu();
    else if (t.matches("[data-fh-search]")) openSearch();
    else if (t.matches("[data-fh-chat]")) openChat();
    else if (chatBox.contains(t)) closeChat();
    else if (search.contains(t)) closeSearch();
    else closeMenu();
  });
  drawer.addEventListener("click", (e) => { if (e.target.closest("a[href^='#'],a[href*='.html#']")) closeMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (isOpen(search)) closeSearch(); else if (isOpen(drawer)) closeMenu(); else closeChat(); }
    if (e.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "") && !isOpen(search)) { e.preventDefault(); openSearch(); }
  });
})();
