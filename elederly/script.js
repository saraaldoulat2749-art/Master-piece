const navContainer = document.getElementById("nav-container");
const footerContainer = document.getElementById("footer-container");

fetch("../Nav/index.html")
  .then(response => {
    if (!response.ok) throw new Error(`Navigation request failed: ${response.status}`);
    return response.text();
  })
  .then(markup => {
    const navDocument = new DOMParser().parseFromString(markup, "text/html");
    const navbar = navDocument.querySelector(".careplus-navbar");
    if (!navbar) throw new Error("CarePlus navigation markup is missing.");

    navContainer.replaceChildren(document.importNode(navbar, true));
    const links = [...navContainer.querySelectorAll(".careplus-navbar__links a")];
    const servicesLink = links.find(link => link.textContent.trim() === "Services");
    links.forEach(link => link.classList.remove("active"));
    if (servicesLink) {
      servicesLink.href = "../services/index.html";
      servicesLink.classList.add("active");
      servicesLink.setAttribute("aria-current", "page");
    }

    const menuToggle = navContainer.querySelector(".careplus-navbar__toggle");
    links.forEach(link => link.addEventListener("click", () => {
      if (menuToggle) menuToggle.checked = false;
    }));
  })
  .catch(error => console.error("Could not load CarePlus navigation:", error));

fetch("../Footer/index.html")
  .then(response => {
    if (!response.ok) throw new Error(`Footer request failed: ${response.status}`);
    return response.text();
  })
  .then(html => { footerContainer.innerHTML = html; })
  .catch(error => console.error("Could not load CarePlus footer:", error));

// Reveal page sections as they enter view, while honoring the visitor's motion preference.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(
  ".elderly-hero .hero-content, .elderly-hero .hero-art, .intro-strip > div, .section-heading, .service-choice, .care-notice, .approach-copy, .steps-list article"
);

if (!reduceMotion && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach(item => {
    item.classList.add("reveal-on-scroll");
    revealObserver.observe(item);
  });
}

const form = document.getElementById("care-form");
if (form) {
  // Editable prototype rates; these do not represent live provider quotes.
  const PRICING = Object.freeze({ homeHourlyJod: 8, companionHourlyJod: 7, platformFeeJod: 1, sampleReturnFeeJod: 5 });
  const isHome = form.dataset.service === "home";
  const duration = form.elements.namedItem("duration");
  const tripOption = form.elements.namedItem("tripOption");
  const money = amount => `JOD ${amount.toFixed(2)}`;

  function updateEstimate() {
    const hours = Math.max(1, Number(duration.value) || 1);
    const base = hours * (isHome ? PRICING.homeHourlyJod : PRICING.companionHourlyJod);
    const returnFee = !isHome && tripOption.value === "roundtrip" ? PRICING.sampleReturnFeeJod : 0;
    const total = base + returnFee + PRICING.platformFeeJod;
    document.getElementById("base-label").textContent = `${isHome ? "Home care" : "Companion service"} · ${hours} ${hours === 1 ? "hour" : "hours"}`;
    document.getElementById("base-price").textContent = money(base);
    document.getElementById("return-fee-row").hidden = returnFee === 0;
    document.getElementById("return-fee").textContent = money(returnFee);
    document.getElementById("service-fee").textContent = money(PRICING.platformFeeJod);
    document.getElementById("total-price").textContent = money(total);
  }

  form.addEventListener("input", updateEstimate);
  form.addEventListener("change", updateEstimate);
  form.querySelectorAll('input[type="date"]').forEach(input => {
    const now = new Date();
    input.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const lines = [`Service: ${isHome ? "Home Care" : "Hospital & Clinic Companion"}`];
    for (const [key, value] of values.entries()) {
      if (key === "authorization" || key === "serviceType" || key === "duration") continue;
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase());
      lines.push(`${label}: ${value}`);
    }
    lines.push(`Planned service duration: ${duration.value} hours`);
    lines.push(`Prototype estimate (not a confirmed quote): ${document.getElementById("total-price").textContent}`);
    lines.push("Please confirm coverage, provider availability, the final price, and payment options.");

    document.getElementById("form-feedback").textContent = "WhatsApp will open with your request ready to review and send. No booking or payment is confirmed by this page.";
    const subject = isHome ? "CarePlus Home Care Request" : "CarePlus Appointment Companion Request";
    const message = `${subject}\n\n${lines.join("\n")}`;
    window.open(`https://wa.me/962712345678?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });

  updateEstimate();
}
