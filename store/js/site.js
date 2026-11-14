// Store chrome: menu drawer, site search (search.json) and the assistant chat (Worker POST /chat).
// Markup comes from tools/site_chrome.py. All text from data is added with textContent (no innerHTML).
(() => {
  const CHAT_API = "https://foreverheld-sales.foreverheld.workers.dev/chat";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const drawer = $("#fh-drawer"), scrim = $(".fh-scrim"), search = $("#fh-search"), chatBox = $("#fh-chat"), chatBtn = $(".fh-chatbtn");
  if (!drawer) return;
  const store = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  let lastFocus = null;
  const lock = () => document.body.classList.toggle("fh-lock", !drawer.hidden || !search.hidden || (!chatBox.hidden && matchMedia("(max-width:560px)").matches));
  const setExp = (sel, v) => $$(sel).forEach((b) => b.hasAttribute("aria-expanded") && b.setAttribute("aria-expanded", String(v)));

  // ---- menu drawer ----
  function openMenu() {
    closeAll(); lastFocus = document.activeElement;
    drawer.hidden = false; scrim.hidden = false; setExp("[data-fh-menu]", true);
    requestAnimationFrame(() => { drawer.classList.add("fh-open"); $(".fh-icon", drawer).focus(); });
    lock();
  }
  function closeMenu(restore = true) {
    if (drawer.hidden) return;
    drawer.classList.remove("fh-open"); scrim.hidden = true; setExp("[data-fh-menu]", false);
    setTimeout(() => { drawer.hidden = true; lock(); }, matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 280);
    if (restore) lastFocus?.focus?.();
  }

  // ---- search ----
  const input = $("input", search), results = $(".fh-results", search);
  let index = null, loading = null;
  const load = () => loading ||= fetch("search.json").then((r) => r.json()).then((j) => (index = j.items || [])).catch(() => (index = []));
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const SYN = { christmas: ["evergreen", "ornament"], thanksgiving: ["harvest"], blue: ["longest"], church: ["service", "longest"], obituary: ["program"], sign: ["welcome"], refund: ["refunds"], cards: ["card"] };
  function score(it, words) {
    const t = norm(it.title), d = norm(it.desc), x = norm(it.text);
    let s = 0;
    for (const w of words) {
      const alts = [w, ...(SYN[w] || [])];
      const best = Math.max(...alts.map((a) => (t.includes(a) ? 10 : d.includes(a) ? 4 : x.includes(a) ? 1 : 0)));
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
    const x = it.text || "";
    const i = words.length ? norm(x).indexOf(words.find((w) => norm(x).includes(w)) || "\u0000") : -1;
    if (!it.desc || (i > 0 && !norm(it.desc).includes(words[0]))) return i >= 0 ? (i > 40 ? "…" : "") + x.slice(Math.max(0, i - 40), i + 110) + "…" : it.desc || x.slice(0, 140);
    return it.desc;
  }
  function hit(it, words) {
    const a = el("a", "fh-hit"); a.href = it.url;
    if (it.img) { const im = el("img"); im.src = it.img; im.alt = ""; im.loading = "lazy"; a.append(im); }
    const sp = el("span"), b = el("b"), sm = el("small");
    mark(b, it.title, words); mark(sm, snippet(it, words), words);
    sp.append(b, sm); a.append(sp);
    a.addEventListener("click", () => setTimeout(closeSearch, 0));
    return a;
  }
  function render() {
    const q = input.value.trim();
    results.replaceChildren();
    if (!index) { results.append(el("p", "fh-none", "Loading…")); load().then(render); return; }
    if (!q) {
      results.append(el("h3", "", "Popular searches"));
      const chips = el("div", "fh-chips");
      ["Funeral program", "Christmas", "Thanksgiving", "Welcome sign", "Church service", "Refunds", "How to print"].forEach((c) => { const b = el("button", "", c); b.type = "button"; b.onclick = () => { input.value = c; render(); input.focus(); }; chips.append(b); });
      results.append(chips, el("h3", "", "Shop"));
      index.filter((i) => i.group === "Products").forEach((i) => results.append(hit(i, [])));
      return;
    }
    const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
    const found = index.map((it) => [score(it, words), it]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([, it]) => it);
    if (!found.length) results.append(el("p", "fh-none", `No pages match “${q}”. Our assistant can still help:`));
    for (const g of ["Products", "Questions", "Guides", "Pages"]) {
      const list = found.filter((i) => i.group === g);
      if (!list.length) continue;
      results.append(el("h3", "", g === "Questions" ? "Questions families ask" : g));
      list.forEach((i) => results.append(hit(i, words)));
    }
    const ask = el("button", "fh-ask"); ask.type = "button"; ask.textContent = `Ask our assistant: “${q.slice(0, 80)}”`;
    ask.onclick = () => { closeSearch(false); openChat(q); };
    results.append(ask);
  }
  function openSearch() {
    closeAll(); lastFocus = lastFocus && drawer.contains(document.activeElement) ? lastFocus : document.activeElement;
    search.hidden = false; setExp("[data-fh-search]", true); lock(); load(); render();
    setTimeout(() => input.focus(), 30);
  }
  function closeSearch(restore = true) {
    if (search.hidden) return;
    search.hidden = true; setExp("[data-fh-search]", false); lock();
    if (restore) lastFocus?.focus?.();
  }
  input.addEventListener("input", render);
  $("form", search).addEventListener("submit", (e) => { e.preventDefault(); const first = $(".fh-hit", results); if (first) first.click(); else $(".fh-ask", results)?.click(); });
  search.addEventListener("click", (e) => { if (e.target === search) closeSearch(); });

  // ---- assistant chat ----
  const log = $(".fh-log", chatBox), form = $("form", chatBox), ta = $("textarea", chatBox), send = $("button[type=submit]", chatBox);
  let msgs = store.get("fh-chat") || [], busy = false;
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
  function bubble(m) { const d = el("div", `fh-msg ${m.role === "user" ? "u" : "a"}`); m.role === "user" ? (d.textContent = m.content) : richText(d, m.content); log.append(d); return d; }
  function draw() {
    log.replaceChildren();
    bubble({ role: "assistant", content: "Hello, and I'm sorry if you're here because you've lost someone. I can help with planning a funeral or memorial, wording, customs, what to do next, or any question about our printables." });
    if (!msgs.length) { const s = el("div", "fh-sugg"); SUGG.forEach((q) => { const b = el("button", "", q); b.type = "button"; b.onclick = () => ask(q); s.append(b); }); log.append(s); }
    msgs.forEach(bubble);
    log.scrollTop = log.scrollHeight;
  }
  async function ask(q) {
    q = (q || "").trim(); if (!q || busy) return;
    busy = true; send.disabled = true; ta.value = ""; grow();
    msgs.push({ role: "user", content: q.slice(0, 1200) }); store.set("fh-chat", msgs); draw();
    const t = el("div", "fh-msg a fh-typing"); t.append(el("i"), el("i"), el("i")); t.setAttribute("aria-label", "Writing an answer"); log.append(t); log.scrollTop = log.scrollHeight;
    let text;
    try {
      const r = await fetch(CHAT_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs.slice(-10), page: location.pathname }) });
      const j = await r.json().catch(() => ({}));
      text = j.text || "Sorry, something went wrong. Please try again, or message us at https://foreverheld.pages.dev/contact.html";
      if (j.ok) msgs.push({ role: "assistant", content: text });
    } catch { text = "I couldn't connect just now. Please check your connection and try again, or message us at https://foreverheld.pages.dev/contact.html"; }
    store.set("fh-chat", msgs.slice(-20)); draw();
    if (msgs[msgs.length - 1]?.role === "user") bubble({ role: "assistant", content: text });
    log.scrollTop = log.scrollHeight;
    busy = false; send.disabled = false; ta.focus();
  }
  function grow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(ta.value); });
  function openChat(prefill) {
    closeMenu(false); closeSearch(false); lastFocus = lastFocus || document.activeElement;
    chatBox.hidden = false; chatBtn.hidden = true; draw(); lock();
    if (prefill) ask(prefill); else setTimeout(() => ta.focus(), 30);
  }
  function closeChat() { if (chatBox.hidden) return; chatBox.hidden = true; chatBtn.hidden = false; lock(); chatBtn.focus(); }

  // ---- wiring ----
  function closeAll() { closeMenu(false); closeSearch(false); }
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
    if (e.key === "Escape") { if (!search.hidden) closeSearch(); else if (!drawer.hidden) closeMenu(); else closeChat(); }
    if (e.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "") && search.hidden) { e.preventDefault(); openSearch(); }
  });
})();
