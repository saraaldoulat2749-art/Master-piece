(() => {
  const form = document.getElementById("checkout-form");
  const cardNumber = document.getElementById("card-number");
  const expiry = document.getElementById("card-expiry");
  const cvc = document.getElementById("card-cvc");
  const result = document.getElementById("checkout-result");
  const returnToAi = document.getElementById("return-to-ai");
  const planKey = "careplusAiPlanPeriod";
  const accessKey = "careplusAiAccessUntil";
  const identity = (sessionStorage.getItem("careplusDemoIdentity") || "demo-account").toLowerCase();
  const userAccessKey = `${accessKey}:${identity}`;
  const periodLabels = { day: "1 day", week: "1 week", month: "1 month" };
  const periodPrices = { day: 1, week: 5, month: 15 };
  const savedPeriod = sessionStorage.getItem(planKey);
  const planInputs = [...document.querySelectorAll('input[name="ai-plan"]')];
  if (planInputs.some(input => input.value === savedPeriod)) {
    planInputs.forEach(input => { input.checked = input.value === savedPeriod; });
  }
  const updatePlanSummary = () => {
    const period = planInputs.find(input => input.checked)?.value || "day";
    const price = periodPrices[period];
    document.getElementById("summary-period").textContent = periodLabels[period];
    document.getElementById("summary-price").textContent = `JOD ${price.toFixed(2)}`;
    document.getElementById("summary-total").textContent = `JOD ${price.toFixed(2)}`;
    sessionStorage.setItem(planKey, period);
  };
  planInputs.forEach(input => input.addEventListener("change", updatePlanSummary));
  updatePlanSummary();

  cardNumber.addEventListener("input", () => {
    const digits = cardNumber.value.replace(/\D/g, "").slice(0, 19);
    cardNumber.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });

  expiry.addEventListener("input", () => {
    const digits = expiry.value.replace(/\D/g, "").slice(0, 4);
    expiry.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
  });

  cvc.addEventListener("input", () => {
    cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const digits = cardNumber.value.replace(/\D/g, "");
    const expiryDigits = expiry.value.replace(/\D/g, "");
    const month = Number(expiryDigits.slice(0, 2));
    const expiryYear = Number(expiryDigits.slice(2, 4));
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    const validExpiry = expiryDigits.length === 4 && month >= 1 && month <= 12
      && (expiryYear > currentYear || expiryYear === currentYear && month >= currentMonth);
    const validCvc = /^\d{3,4}$/.test(cvc.value);

    if (!form.reportValidity()) return;
    if (digits.length < 13 || digits.length > 19 || !validExpiry || !validCvc) {
      result.textContent = !validExpiry
        ? "Enter a valid future expiry date in MM / YY format, for example 12 / 30."
        : "Please check your card number and security code.";
      result.hidden = false;
      return;
    }

    const period = planInputs.find(input => input.checked)?.value || "day";
    const durationMs = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 }[period];
    const accessUntil = Date.now() + durationMs;
    localStorage.setItem(userAccessKey, String(accessUntil));
    const transaction = { transactionId: `DEMO-AI-${Date.now()}`, customer: identity, plan: period, planLabel: periodLabels[period], amount: periodPrices[period], currency: "JOD", paymentStatus: "Demo / Not charged", paymentVerified: false, demo: true, paidAt: new Date().toISOString(), accessUntil };
    try {
      const transactions = JSON.parse(localStorage.getItem("careplusAiTransactionsV1") || "[]");
      transactions.push(transaction);
      localStorage.setItem("careplusAiTransactionsV1", JSON.stringify(transactions.slice(-1000)));
    } catch { /* Keep the local access demo even if payment history cannot be stored. */ }
    result.textContent = `Payment successful! Your CarePlus AI access is active for ${periodLabels[period]}, until ${new Date(accessUntil).toLocaleString()}.`;
    result.classList.add("checkout-result-success");
    result.hidden = false;
    returnToAi.hidden = false;
    form.querySelector('button[type="submit"]').disabled = true;
    cardNumber.value = "";
    cvc.value = "";
  });
})();
