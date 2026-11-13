// Swap the main gallery image when a thumbnail is tapped
  const main = document.getElementById("main-img");
  document.querySelectorAll(".thumbs button").forEach((b) => b.addEventListener("click", () => {
    main.src = b.dataset.src; main.alt = b.dataset.alt;
    document.querySelectorAll(".thumbs button").forEach((x) => x.setAttribute("aria-current", x === b));
  }));
