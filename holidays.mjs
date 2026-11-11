// Every US holiday and remembrance day, computed for any year (no API, no cost).
// upcoming(dateStr, days) -> markdown list of the holidays in the next `days` days, with days-away counts.
const nth = (y, m, dow, n) => { // n-th weekday (0=Sun) of month m (1-12); n=-1 = last
  if (n > 0) { const d = new Date(Date.UTC(y, m - 1, 1)); d.setUTCDate(1 + ((dow - d.getUTCDay() + 7) % 7) + 7 * (n - 1)); return d; }
  const d = new Date(Date.UTC(y, m, 0)); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - dow + 7) % 7)); return d;
};
const fixed = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
function easter(y) { // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return fixed(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}
const HANUKKAH = { 2026: 4, 2027: 24, 2028: 12, 2029: 1, 2030: 20 }; // December start dates (lunar calendar)
const plus = (d, n) => new Date(d.getTime() + n * 864e5);

// [name, date, why it matters for memorial printables]
function list(y) {
  const e = easter(y);
  return [
    ["New Year's Day", fixed(y, 1, 1), "first new year without someone; remembrance candles, 'missing you this year' posts"],
    ["Martin Luther King Jr. Day", nth(y, 1, 1, 3), "federal holiday; low relevance"],
    ["Valentine's Day", fixed(y, 2, 14), "grieving a spouse or partner; love-letter and memory-card angle"],
    ["Presidents' Day", nth(y, 2, 1, 3), "federal holiday; sale weekend"],
    ["St. Patrick's Day", fixed(y, 3, 17), "Irish blessings for memorial programs"],
    ["Good Friday", plus(e, -2), "faith-based memorial verses"],
    ["Easter", e, "hope and renewal verses; spring florals"],
    ["Mother's Day", nth(y, 5, 0, 2), "BIG: remembering mom; tribute cards, gifts for grieving friends"],
    ["Memorial Day", nth(y, 5, 1, -1), "BIG: honoring the fallen and veterans' families; military-style tribute"],
    ["Father's Day", nth(y, 6, 0, 3), "BIG: remembering dad; tribute cards"],
    ["Juneteenth", fixed(y, 6, 19), "federal holiday; low relevance"],
    ["Independence Day", fixed(y, 7, 4), "summer gatherings; celebration-of-life events peak in summer"],
    ["National Grief Awareness Day", fixed(y, 8, 30), "grief education content, gentle awareness posts"],
    ["Labor Day", nth(y, 9, 1, 1), "sale weekend"],
    ["Grandparents Day", plus(nth(y, 9, 1, 1), 6), "remembering grandparents; tribute pieces"],
    ["Patriot Day (9/11)", fixed(y, 9, 11), "national remembrance; respectful tone only, never salesy"],
    ["Pregnancy & Infant Loss Remembrance Day", fixed(y, 10, 15), "very sensitive; only gentle remembrance content, no promotions"],
    ["Halloween", fixed(y, 10, 31), "low relevance; avoid spooky tie-ins"],
    ["Día de los Muertos", fixed(y, 11, 1), "honoring loved ones; ofrenda photo and memory ideas (Nov 1-2)"],
    ["All Souls' Day", fixed(y, 11, 2), "faith-based remembrance"],
    ["Veterans Day", fixed(y, 11, 11), "honoring veterans who have passed"],
    ["Thanksgiving", nth(y, 11, 4, 4), "BIG: first holiday without someone; empty-chair, gratitude memory cards"],
    ["Black Friday / Cyber Monday", plus(nth(y, 11, 4, 4), 1), "biggest sale weekend of the year (Fri-Mon)"],
    [HANUKKAH[y] ? "Hanukkah begins (evening)" : "Hanukkah (approx., check date)", HANUKKAH[y] ? fixed(y, 12, HANUKKAH[y]) : fixed(y, 12, 10), "lighting a candle in memory"],
    ["Longest Night / Blue Christmas", fixed(y, 12, 21), "grief services at churches; gentle remembrance"],
    ["Christmas", fixed(y, 12, 25), "BIG: remembrance ornaments, memorial table signs, 'a light for you' cards"],
    ["New Year's Eve", fixed(y, 12, 31), "reflection on the year; remembrance posts"]
  ];
}

export function upcoming(dateStr, days = 90) {
  const start = new Date(`${dateStr}T00:00:00Z`), y = start.getUTCFullYear();
  const rows = [...list(y), ...list(y + 1)]
    .map(([name, d, why]) => ({ name, d, why, away: Math.round((d - start) / 864e5) }))
    .filter((r) => r.away >= 0 && r.away <= days)
    .sort((a, b) => a.d - b.d);
  return rows.map((r) => `- ${r.d.toISOString().slice(0, 10)} (${r.away} days away): ${r.name} — ${r.why}`).join("\n") || "- (none in this window)";
}
