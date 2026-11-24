// Asks Friday a few questions with the agents' test key (derived from PAYHIP_API_KEY) and prints the answers.
import crypto from "node:crypto";
const key = crypto.createHash("sha256").update("friday-check:" + (process.env.PAYHIP_API_KEY || "").trim()).digest("hex");
const URL_ = "https://foreverheld-sales.foreverheld.workers.dev/friday";
const bad = await fetch(URL_, { method: "POST", headers: { "x-friday-key": "wrong" }, body: "{}" });
console.log(`wrong key -> HTTP ${bad.status} (should be 401)`);
for (const q of (process.env.QUESTIONS || "Good morning Friday, what's going on with my business?|How many churches have we emailed and did anyone reply?|What's 15 percent of 9.99?|What's in the news about Pinterest today?|Think hard: should a tiny printable memorial shop focus on Pinterest or Facebook groups this December? One line.|What did the growth coach say in its latest report?").split("|")) {
  const t0 = Date.now();
  const r = await fetch(URL_, { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ q }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\nQ: ${q}  [${((Date.now() - t0) / 1000).toFixed(1)}s]\nA (${r.status}): ${j.say}${j.phone ? `\n[phone ${JSON.stringify(j.phone)}]` : ""}${j.ran ? `\n[ran ${j.ran}]` : ""}${j.image ? `\n[image ${j.image}]` : ""}${j.why ? `\n[why ${j.why.join(" | ")}]` : ""}`);
}

// eyes: send a real store image and ask about it
{
  const img = await fetch("https://recreationalviper.github.io/agent-hq/store/img/program-cover.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  if (img) {
    const image = "data:image/png;base64," + Buffer.from(img).toString("base64");
    const r = await fetch(URL_, { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ q: "What is this and what does it say?", image }) });
    const j = await r.json().catch(() => ({}));
    console.log(`\nPHOTO (${r.status}): ${j.say}`);
  }
}
// optional: design Friday's own voice (VOICE_DESIGN = a description)
if (process.env.VOICE_DESIGN) {
  const r = await fetch(URL_ + "/voice", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ design: process.env.VOICE_DESIGN, name: "Friday" }) });
  console.log(`\nVOICE DESIGN (${r.status}): ${(await r.text()).replace(/\s+/g, " ").slice(0, 600)}`);
}

// natural voice (ElevenLabs): one short line
{
  const r = await fetch(URL_ + "/tts", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ text: "Hi Josiah, this is my new voice." }) });
  const b = r.status === 200 ? (await r.arrayBuffer()).byteLength : 0;
  console.log(`\nTTS: HTTP ${r.status}${r.status === 200 ? ` ${r.headers.get("content-type")} ${b} bytes` : r.status === 204 ? " (no voice: key missing, used up, or refused; see mechanic log)" : ""}`);
}

// voice: send a short public speech sample (JFK, from the Whisper repo) as audio, like the app does
const clip = await fetch("https://github.com/openai/whisper/raw/main/tests/jfk.flac").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
if (clip) {
  const r = await fetch(URL_, { method: "POST", headers: { "x-friday-key": key, "content-type": "audio/flac" }, body: clip });
  const j = await r.json().catch(() => ({}));
  console.log(`\nVOICE (${r.status}) heard: ${j.heard}\nA: ${j.say}${j.why ? `\n[why ${j.why.join(" | ")}]` : ""}`);
}

// Live mode: mint a token, open the Gemini Live WebSocket, ask by text, report what comes back
const lr = await fetch(URL_ + "/live", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: "{}" });
const live = await lr.json().catch(() => ({}));
console.log(`\nLIVE token: ${lr.status} ${live.ok ? `ok (${live.model}, locked ${live.locked})` : live.error}`);
if (live.ok) {
  const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${live.token}`);
  let audioBytes = 0, said = "", events = [];
  const done = new Promise((res) => {
    ws.onopen = () => ws.send(JSON.stringify({ setup: { model: live.model, generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: live.voice } } } }, systemInstruction: { parts: [{ text: live.system }] }, tools: live.tools, outputAudioTranscription: {} } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(typeof e.data === "string" ? e.data : await e.data.text());
      if (m.setupComplete) { events.push("setup"); ws.send(JSON.stringify({ realtimeInput: { text: "Hey Friday, how is the shop doing? Any sales, and did the church emails go out?" } })); }
      if (m.toolCall) {
        events.push("tool:" + m.toolCall.functionCalls.map((f) => f.name).join(","));
        const functionResponses = [];
        for (const f of m.toolCall.functionCalls) {
          const t = await fetch(URL_ + "/tool", { method: "POST", headers: { "x-friday-key": key, "content-type": "application/json" }, body: JSON.stringify({ name: f.name, args: f.args }) }).then((r) => r.json());
          functionResponses.push({ id: f.id, name: f.name, response: { result: t.result } });
        }
        ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
      }
      for (const p of m.serverContent?.modelTurn?.parts || []) if (p.inlineData?.data) audioBytes += p.inlineData.data.length * 0.75;
      if (m.serverContent?.outputTranscription?.text) said += m.serverContent.outputTranscription.text;
      if (m.serverContent?.turnComplete) { events.push("turnComplete"); res(); }
    };
    ws.onerror = (e) => { events.push("error " + (e.message || "")); res(); };
    ws.onclose = (e) => { events.push(`close ${e.code} ${e.reason}`); res(); };
    setTimeout(res, 40000);
  });
  await done; try { ws.close(); } catch {}
  console.log(`LIVE events: ${events.join(" > ")}\nLIVE audio: ${Math.round(audioBytes / 1024)} KB\nLIVE said: ${said}`);
}

// Recent request traces (steps + milliseconds only, no words), to diagnose phone problems
const tr = await fetch(URL_ + "/mechanic", { headers: { "x-friday-key": key } }).then((r) => r.json()).catch(() => ({}));
console.log("\nRECENT TRACES:");
for (const t of (tr.trace || []).slice(-12)) console.log(`  ${t.at} ${t.who} ${t.status} ${t.ms}ms facts=${t.facts}/${t.facts_ms}ms ai=${t.ai_ms}ms tools=${t.tools || "-"}/${t.tools_ms ?? "-"}ms ${t.type || ""} ${t.ua || ""}${t.crash ? " CRASH " + t.crash : ""}${t.keylen != null ? ` key(len ${t.keylen}, starts "${t.keyhead}", ends "${t.keytail}")` : ""}`);
console.log("\nRECENT LOG:");
for (const l of (tr.log || []).slice(-10)) console.log(`  ${l.at} ${l.kind}: ${String(l.text).replace(/\s+/g, " ")}`);
