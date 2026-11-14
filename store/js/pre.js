// Runs before first paint: marks that scripts work so headline animations can start hidden.
// Failsafe: if the motion script never runs, everything is shown after 2.5s.
document.documentElement.classList.add("fh-js");
setTimeout(() => document.documentElement.classList.add("fh-ready"), 2500);
