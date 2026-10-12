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
  const sharedPanel = document.createElement("section");
  sharedPanel.className = "shared-request-panel";
  sharedPanel.setAttribute("aria-live", "polite");
  sharedPanel.innerHTML = '<h3>My care requests</h3><p>Request statuses update here when CarePlus reviews them.</p><div class="shared-request-list"></div>';
  const paymentNotice = document.querySelector(".booking-intro .payment-status");
  if (paymentNotice) paymentNotice.after(sharedPanel);
  else document.querySelector(".booking-section")?.append(sharedPanel);
  function renderMyRequests() {
    const identity = String(sessionStorage.getItem("careplusDemoIdentity") || "").toLowerCase();
    const user = window.CarePlusData?.list("users").find(item => item.email?.toLowerCase() === identity || item.phone === identity);
    const requests = window.CarePlusData?.list("careRequests").filter(item => (user && item.userId === user.id) || item.email?.toLowerCase() === identity || item.phone === identity) || [];
    const list = sharedPanel.querySelector(".shared-request-list");
    list.replaceChildren();
    if (!requests.length) { const empty = document.createElement("p"); empty.textContent = "No submitted care requests for this login yet."; list.append(empty); return; }
    requests.slice().reverse().forEach(request => {
      const item = document.createElement("article"); item.className = "shared-request-item";
      const title = document.createElement("strong"); title.textContent = request.service;
      const detail = document.createElement("span"); detail.textContent = `Preferred date: ${request.date || "Not specified"}`;
      const status = document.createElement("b");
      const rawStatus = String(request.status || "New");
      status.textContent = ["accepted", "approved"].includes(rawStatus.toLowerCase()) ? "Accepted by CarePlus" : rawStatus;
      item.append(title, detail, status); list.append(item);
    });
  }
  window.CarePlusData?.subscribe(renderMyRequests);
  renderMyRequests();

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
    const request = window.CarePlusData?.create("careRequests", {
      client: String(values.get("customerName") || "").trim(),
      elderlyName: String(values.get("elderlyName") || "").trim(),
      phone: String(values.get("customerPhone") || "").trim(),
      email: String(values.get("email") || "").trim(),
      service: isHome ? "Home care" : "Hospital companion",
      date: String(values.get("date") || ""),
      time: String(values.get("time") || ""),
      city: String(values.get("city") || ""),
      area: String(values.get("area") || "").trim(),
      address: String(values.get("address") || values.get("pickupAddress") || "").trim(),
      pickupAddress: String(values.get("pickupAddress") || "").trim(),
      destination: String(values.get("destination") || "").trim(),
      destinationType: String(values.get("destinationType") || ""),
      tripOption: String(values.get("tripOption") || ""),
      waitAppointment: String(values.get("waitAppointment") || ""),
      insideFacility: String(values.get("insideFacility") || ""),
      transportHelp: String(values.get("transportHelp") || ""),
      mobility: String(values.get("mobility") || ""),
      emergencyName: String(values.get("emergencyName") || "").trim(),
      emergencyPhone: String(values.get("emergencyPhone") || "").trim(),
      schedule: String(values.get("schedule") || values.get("tripOption") || ""),
      shift: String(values.get("shift") || ""),
      tasks: values.getAll("tasks"),
      notes: String(values.get("instructions") || "").trim(),
      duration: Number(duration.value) || 1,
      status: "New", source: "user-request",
      userId: window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === sessionStorage.getItem("careplusDemoIdentity")?.toLowerCase() || user.phone === sessionStorage.getItem("careplusDemoIdentity"))?.id || ""
    });
    if (!request) {
      document.getElementById("form-feedback").textContent = "This browser could not save your demo request. Please try again.";
      return;
    }
    const submitButton = form.querySelector(".submit-button");
    submitButton.textContent = "Request saved ✓";
    submitButton.disabled = true;
    document.getElementById("form-feedback").textContent = "Your request has been saved and appears in My Care Requests. CarePlus will review it and confirm availability.";
  });

  updateEstimate();
}
