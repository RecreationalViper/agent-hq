const f = document.querySelector("form.contact"), msg = f.querySelector(".form-msg"), btn = f.querySelector("button");
const show = (t, ok) => { msg.textContent = t; msg.className = "form-msg " + (ok ? "ok" : "err"); };
f.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  if (!d.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || d.message.trim().length < 5) return show("Please add your name, a valid email and a message.", false);
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    const r = await fetch("https://foreverheld-sales.foreverheld.workers.dev/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "failed");
    f.reset(); show("Thank you. Your message is on its way, and we'll reply to your email soon.", true);
  } catch (err) { show("Sorry, that didn't send. Please email us at foreverheld.shop@gmail.com.", false); }
  btn.disabled = false; btn.textContent = "Send message";
});
