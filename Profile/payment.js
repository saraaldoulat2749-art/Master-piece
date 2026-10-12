(() => {
  const dataStore = window.CarePlusData;
  const content = document.getElementById("payment-content");
  const result = document.getElementById("payment-result");
  const error = document.getElementById("payment-error");
  const form = document.getElementById("card-form");
  const identity = String(sessionStorage.getItem("careplusDemoIdentity") || "").trim();
  const identityLower = identity.toLowerCase();
  const params = new URLSearchParams(window.location.search);

  if (window.CarePlusAuth?.hasDemoAdminSession()) {
    window.location.replace("../Admin/index.html");
    return;
  }

  fetch("../Nav/index.html").then(response => response.text()).then(markup => {
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const nav = parsed.querySelector(".careplus-navbar");
    if (!nav) return;
    document.getElementById("nav-container").replaceChildren(document.importNode(nav, true));
    window.CarePlusAuth?.paintNavigation();
  }).catch(() => {});

  const owner = dataStore?.list("users").find(user => user.email?.toLowerCase() === identityLower || user.phone === identity);
  const request = dataStore?.get("careRequests", params.get("requestId"));
  const ownsRequest = request && ((owner && String(request.userId) === String(owner.id))
    || String(request.email || "").toLowerCase() === identityLower
    || String(request.phone || "") === identity);
  const accepted = request && ["accepted", "approved"].includes(String(request.status || "").toLowerCase());

  function showResult(title, message) {
    document.getElementById("payment-result-title").textContent = title;
    document.getElementById("payment-result-copy").textContent = message;
    result.hidden = false;
    content.hidden = true;
  }

  if (!dataStore || !ownsRequest || !accepted) {
    showResult("Payment unavailable", "This request is not available for payment. Check its status in My Care Requests.");
    return;
  }

  const amount = request.service === "Hospital companion"
    ? (Number(request.duration) || 1) * 7 + (request.tripOption === "roundtrip" ? 5 : 0) + 1
    : (Number(request.duration) || 1) * 8 + 1;
  const dateText = request.date ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${request.date}T12:00:00`)) : "Not specified";
  document.getElementById("request-reference").textContent = String(request.id).slice(-10).toUpperCase();
  document.getElementById("request-service").textContent = request.service || "Elderly care";
  document.getElementById("request-recipient").textContent = request.elderlyName || request.client || "Care recipient";
  document.getElementById("request-date").textContent = dateText;
  document.getElementById("payment-amount").textContent = `JOD ${amount.toFixed(2)}`;
  content.hidden = false;

  if (String(request.paymentStatus || "").toLowerCase() === "paid") {
    showResult("Payment already recorded", "This care request has already been marked as paid in the CarePlus demo.");
    return;
  }

  const cardNumber = form.elements.namedItem("cardNumber");
  const holder = form.elements.namedItem("cardholder");
  const expiry = form.elements.namedItem("expiry");
  const digitsOnly = value => String(value || "").replace(/\D/g, "");
  cardNumber.addEventListener("input", () => {
    const digits = digitsOnly(cardNumber.value).slice(0, 19);
    cardNumber.value = digits.match(/.{1,4}/g)?.join(" ") || "";
    document.getElementById("card-number-preview").textContent = digits ? `•••• •••• •••• ${digits.slice(-4)}` : "•••• •••• •••• ••••";
  });
  holder.addEventListener("input", () => { document.getElementById("card-name-preview").textContent = holder.value.trim().toUpperCase() || "CARDHOLDER NAME"; });
  expiry.addEventListener("input", () => {
    const digits = digitsOnly(expiry.value).slice(0, 4);
    expiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    document.getElementById("card-expiry-preview").textContent = expiry.value || "MM/YY";
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    error.textContent = "";
    const digits = digitsOnly(cardNumber.value);
    if (holder.value.trim().length < 2) { error.textContent = "Enter the cardholder name."; holder.focus(); return; }
    if (digits.length < 12 || digits.length > 19) { error.textContent = "Enter a demo card number with 12 to 19 digits."; cardNumber.focus(); return; }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry.value)) { error.textContent = "Enter the expiry in MM/YY format."; expiry.focus(); return; }
    const [month, year] = expiry.value.split("/").map(Number);
    const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);
    if (expiryDate < new Date()) { error.textContent = "This card expiry date has passed."; expiry.focus(); return; }
    const cvv = digitsOnly(form.elements.namedItem("cvv").value);
    if (cvv.length < 3 || cvv.length > 4) { error.textContent = "Enter a 3 or 4 digit security code."; form.elements.namedItem("cvv").focus(); return; }

    const latest = dataStore.get("careRequests", request.id);
    if (!latest || !["accepted", "approved"].includes(String(latest.status || "").toLowerCase())) {
      error.textContent = "This request is no longer eligible for payment."; return;
    }
    if (String(latest.paymentStatus || "").toLowerCase() === "paid") {
      showResult("Payment already recorded", "This care request has already been marked as paid in the CarePlus demo."); return;
    }
    const saved = dataStore.update("careRequests", request.id, {
      paymentStatus: "Paid", paymentMethod: `Demo card ending in ${digits.slice(-4)}`,
      paymentLast4: digits.slice(-4), paymentAmount: amount, paidAt: new Date().toISOString()
    });
    if (!saved) { error.textContent = "The demo payment could not be saved. Please try again."; return; }
    form.reset();
    showResult("Payment recorded", `JOD ${amount.toFixed(2)} demo payment recorded. No real money was charged.`);
  });
})();
