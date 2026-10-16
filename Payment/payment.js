(() => {
  const form = document.getElementById("checkout-form");
  const cardNumber = document.getElementById("card-number");
  const expiry = document.getElementById("card-expiry");
  const cvc = document.getElementById("card-cvc");
  const result = document.getElementById("checkout-result");
  const planKey = "careplusAiPlanPeriod";
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
    cardNumber.value = digits.replace(/(.{4})/g, "$1  ").trim();
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
    const validExpiry = /^(0[1-9]|1[0-2])\s\/\s\d{2}$/.test(expiry.value);
    const validCvc = /^\d{3,4}$/.test(cvc.value);

    if (!form.reportValidity()) return;
    if (digits.length < 13 || digits.length > 19 || !validExpiry || !validCvc) {
      result.textContent = "Please check your card number, expiry date, and security code.";
      result.hidden = false;
      return;
    }

    result.textContent = "Payment is unavailable because no gateway is connected. No payment was processed. Your card number and security code have been cleared.";
    result.hidden = false;
    cardNumber.value = "";
    cvc.value = "";
  });
})();
