const services = {
  appointments: { title: "Doctor Appointments", eyebrow: "CAREPLUS APPOINTMENTS", purpose: "Find a doctor by specialty and area, then choose an appointment time that fits your schedule.", features: ["Browse doctors across supported specialties", "Choose a city, specialty, and doctor", "Select a preferred date and available time"], how: "Choose your area and specialty, select a doctor, pick a time, then review the appointment details before continuing.", next: "../../Book/index.html" },
  medicine: { title: "Medicine Search", eyebrow: "PHARMACY FINDER", purpose: "Search for a medicine and explore nearby pharmacies that may carry it, using your selected area.", features: ["Search by medicine name", "Choose a supported city or area", "Review nearby pharmacy details and availability information"], how: "Enter a medicine name, choose your area, and review the pharmacy results shown for your search.", next: "../../Pharmacy/index.html" },
  ai: { title: "AI Symptom Checker", eyebrow: "AI HEALTH GUIDANCE", purpose: "Organize the symptoms you report and provide general information to help you decide what care to seek.", features: ["Select symptoms and their duration", "Describe symptom severity and other context", "Review general guidance based on the submitted details"], how: "Choose your symptoms, answer the duration and severity questions, and submit them to view the guidance page. This tool does not provide a diagnosis.", next: "../../AI/index.html" },
  store: { title: "Medical Store", eyebrow: "CAREPLUS MEDICAL STORE", purpose: "Browse medical equipment and healthcare essentials for home care and everyday needs.", features: ["Explore medical product categories", "Search and filter the product range", "Review product details and prepare a cart"], how: "Browse products, add items to your cart, and continue to checkout to provide delivery details.", next: "../../Store/index.html" },
  elderly: { title: "Elderly Care", eyebrow: "PERSON-CENTERED SUPPORT", purpose: "Explore non-clinical support options for older adults and families, including help at home and companionship for appointments.", features: ["Home care support planned around daily routines", "Hospital and clinic appointment companionship", "Share schedule, location, and accessibility needs"], how: "Choose the type of support, provide the requested details, and send a request for the CarePlus team to review. Availability needs confirmation.", next: "../../elederly/index.html" }
};

const navContainer = document.getElementById("nav-container");
if (navContainer) {
  const navObserver = new MutationObserver(() => navContainer.querySelectorAll('a[href^="../"]').forEach(link => {
    link.href = new URL(`../${link.getAttribute("href")}`, document.baseURI).href;
  }));
  navObserver.observe(navContainer, { childList: true, subtree: true });
}

const data = services[document.body.dataset.service];
if (data) {
  document.title = `${data.title} | CarePlus`;
  const safe = value => { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; };
  const serviceUrl = new URL(data.next, document.baseURI);
  const loginUrl = new URL("../../log%20in/login.html", document.baseURI);
  loginUrl.searchParams.set("returnTo", serviceUrl.href);
  document.getElementById("detail-content").innerHTML = `<a class="crumb" href="../index.html">All services</a><section class="detail-hero"><span class="eyebrow">${safe(data.eyebrow)}</span><h1>${safe(data.title)}</h1><p>${safe(data.purpose)}</p><div class="actions"><a class="button primary" href="${loginUrl.href}">Log in to access this service</a><a class="button secondary" href="../index.html">Explore other services</a></div></section><section class="description-grid"><article class="info-card"><h2>Purpose</h2><p>${safe(data.purpose)}</p></article><article class="info-card"><h2>Features</h2><ul>${data.features.map(item => `<li>${safe(item)}</li>`).join("")}</ul></article><article class="info-card"><h2>How it works</h2><p>${safe(data.how)}</p></article></section><section class="how"><h2>Using CarePlus</h2><p>Service details are public. Opening the service requires the temporary demo session described on the login page.</p></section><p class="access-note"><strong>Availability:</strong> Some services show prototype information. A request, booking, product availability, or final price is not confirmed until the relevant CarePlus team completes follow-up.</p>`;
  const serviceAction = document.querySelector("#detail-content .button.primary");
  const breadcrumb = document.querySelector("#detail-content .crumb");
  if (breadcrumb) breadcrumb.textContent = "\u2190 All services";
  if (serviceAction && window.CarePlusAuth?.hasDemoSession()) {
    serviceAction.href = serviceUrl.href;
    serviceAction.textContent = "Open service";
  }
}
