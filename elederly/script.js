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

fetch("../Footer/index.html?v=footer-hearts-removed-1")
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
  const PRICING = Object.freeze({ homeHourlyJod: 8, companionHourlyJod: 7, sampleReturnFeeJod: 5 });
  const isHome = form.dataset.service === "home";
  let submitting = false;
  const duration = form.elements.namedItem("duration");
  const tripOption = form.elements.namedItem("tripOption");
  const money = amount => `JOD ${amount.toFixed(2)}`;
  const commissionRate = () => Number(window.CarePlusPharmacy?.settings().careCommissionRate) || 0;
  function updateEstimate() {
    const hours = Math.max(1, Number(duration.value) || 1);
    const base = hours * (isHome ? PRICING.homeHourlyJod : PRICING.companionHourlyJod);
    const returnFee = !isHome && tripOption.value === "roundtrip" ? PRICING.sampleReturnFeeJod : 0;
    const rate = commissionRate();
    const commission = Math.round(base * rate) / 100;
    const total = base + returnFee + commission;
    document.getElementById("base-label").textContent = `${isHome ? "Home care" : "Companion service"} · ${hours} ${hours === 1 ? "hour" : "hours"}`;
    document.getElementById("base-price").textContent = money(base);
    document.getElementById("return-fee-row").hidden = returnFee === 0;
    document.getElementById("return-fee").textContent = money(returnFee);
    document.getElementById("care-commission-rate").textContent = rate.toFixed(2).replace(/\.00$/, "");
    document.getElementById("care-commission-amount").textContent = money(commission);
    document.getElementById("total-price").textContent = money(total);
    return { base, returnFee, rate, commission, total };
  }

  form.addEventListener("input", updateEstimate);
  form.addEventListener("change", updateEstimate);
  form.querySelectorAll('input[type="date"]').forEach(input => {
    const now = new Date();
    input.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) return;
    if (!form.reportValidity()) return;
    const identity = sessionStorage.getItem('careplusDemoIdentity');
    const customer = identity && window.CarePlusData?.list('users').find(user => user.email?.toLowerCase() === identity.toLowerCase() || user.phone === identity);
    if (!customer) { document.getElementById('form-feedback').textContent = 'Please sign in to send a care request.'; return; }
    submitting = true;
    let selectedNurse;
    const visitDetails = () => ({ date: form.elements.namedItem('date').value, time: form.elements.namedItem('time').value,
      duration: Number(duration.value), schedule: form.elements.namedItem('schedule')?.value || '' });
    try { selectedNurse = await window.CarePlusNursePicker.open(visitDetails()); }
    catch { document.getElementById('form-feedback').textContent = 'Nurse selection could not be opened. Please refresh and try again.'; }
    finally { submitting = false; }
    if (!selectedNurse || !form.reportValidity()) return;
    const availability = window.CarePlusNurseAvailability?.check(selectedNurse.nurseId, visitDetails());
    if (!availability?.ok) { document.getElementById('form-feedback').textContent = availability?.reason || 'Please refresh and choose an available nurse.'; return; }
    const values = new FormData(form);
    const estimate = updateEstimate();
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
      specialCareRequirements: String(values.get("specialCareRequirements") || "").trim(),
      authorizedCareInstructions: String(values.get("authorizedCareInstructions") || "").trim(),
      duration: Number(duration.value) || 1,
      estimatedBaseAmount: estimate.base,
      estimatedReturnFee: estimate.returnFee,
      careCommissionRate: estimate.rate,
      careCommissionAmount: estimate.commission,
      estimatedTotal: estimate.total,
      totalPrice: Math.round(estimate.total * 100) / 100,
      depositAmount: Math.round(estimate.total * 10) / 100,
      remainingBalance: (Math.round(estimate.total * 100) - Math.round(estimate.total * 10)) / 100,
      depositRate: 0.1,
      currency: "JOD",
      paymentStatus: "Unpaid",
      paymentMode: "demo",
      transactionReference: null,
      status: "Requested", source: "user-request", bookingFlow: "nurse-first",
      assignedNurseId: selectedNurse.nurseId, assignedNurseName: selectedNurse.name,
      userId: window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === sessionStorage.getItem("careplusDemoIdentity")?.toLowerCase() || user.phone === sessionStorage.getItem("careplusDemoIdentity"))?.id || ""
    });
    if (!request) {
      document.getElementById("form-feedback").textContent = "This browser could not save your demo request. Please try again.";
      return;
    }
    const submitButton = form.querySelector(".submit-button");
    submitButton.textContent = "Submit another care request";
    document.getElementById("form-feedback").textContent = `Request sent to ${selectedNurse.name}. You can pay the deposit after the nurse accepts. Follow its status and pay from your profile.`;
  });

  window.addEventListener("careplus:commission", updateEstimate);
  window.addEventListener("storage", event => { if (!event.key || event.key.includes("Commission") || event.key.includes("commission")) updateEstimate(); });
  updateEstimate();
}
