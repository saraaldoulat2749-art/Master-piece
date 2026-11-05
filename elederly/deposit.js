/* Demo only. A production gateway must verify payments on a trusted backend.
 * No browser action in this module can mark a payment paid or a booking confirmed.
 */
(() => {
  const dialog = document.createElement("dialog");
  dialog.className = "deposit-dialog";
  dialog.setAttribute("aria-labelledby", "deposit-title");
  dialog.setAttribute("aria-describedby", "deposit-message");
  dialog.innerHTML = `
    <div class="deposit-content">
      <span class="deposit-badge">CarePlus · Secure booking request</span>
      <h2 id="deposit-title">Booking Deposit Required</h2>
      <p id="deposit-message">To confirm your care service booking, a 10% deposit of the total service cost is required. Your booking will remain pending until the deposit payment is completed.</p>
      <dl class="deposit-summary">
        <div><dt>Total service price</dt><dd data-total></dd></div>
        <div class="deposit-due"><dt>Required deposit (10%)</dt><dd data-deposit></dd></div>
        <div><dt>Remaining balance (90%)</dt><dd data-balance></dd></div>
      </dl>
      <section class="deposit-checkout" hidden>
        <div data-checkout-fields>
        <form data-card-form autocomplete="off">
          <p class="gateway-help">Enter your card details below. Card information is not stored.</p>
          <label class="gateway-label">Cardholder name<input data-card-name required minlength="2" maxlength="80" pattern=".*[^ ].*" placeholder="Enter a name" autocomplete="off"></label>
          <label class="gateway-label">Card number<input data-card-number required inputmode="numeric" maxlength="23" pattern="(?:[0-9] *){13,19}" title="Enter 13 to 19 digits; spaces are allowed." placeholder="1234 5678 9012 3456" autocomplete="off"></label>
          <div class="gateway-card-fields">
            <label class="gateway-label">Expiry<input data-card-expiry required inputmode="numeric" pattern="(0[1-9]|1[0-2])/[0-9]{2}" title="Enter a month and year in MM/YY format." maxlength="5" placeholder="MM/YY" autocomplete="off"></label>
            <label class="gateway-label">CVV<input data-card-cvv required type="password" inputmode="numeric" pattern="[0-9]{3,4}" title="Enter 3 or 4 digits." maxlength="4" placeholder="CVV" autocomplete="off"></label>
          </div>
        </form>
        <button type="button" class="deposit-primary gateway-pay" data-preview>Pay deposit</button>
        </div>
        <p data-result role="status" aria-live="polite" tabindex="-1"></p>
      </section>
      <div class="deposit-actions">
        <button type="button" class="deposit-secondary" data-cancel>Cancel</button>
        <button type="button" class="deposit-primary" data-proceed>Proceed to Payment</button>
      </div>
    </div>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  let requestId = null;
  let previewed = false;
  let attempt = 0;
  const money = value => `JOD ${Number(value).toFixed(2)}`;
  const payable = request => request && (request.bookingFlow === 'nurse-first'
    ? request.status === 'Accepted' && Boolean(request.acceptedAt)
    : request.status === 'Pending Payment');
  const cardForm = find("[data-card-form]");
  const clearCard = () => cardForm.reset();
  cardForm.addEventListener("submit", event => { event.preventDefault(); find("[data-preview]").click(); });

  find("[data-proceed]").addEventListener("click", () => {
    find(".deposit-checkout").hidden = false;
    find("[data-proceed]").hidden = true;
    find("[data-preview]").focus();
  });
  find("[data-preview]").addEventListener("click", async () => {
    if (previewed) return;
    clearCard();
    previewed = true;
    const currentAttempt = ++attempt;
    const currentId = requestId;
    const scenario = "success";
    const method = "card";
    find("[data-preview]").disabled = true;
    find("[data-preview]").textContent = "Processing payment…";
    find("[data-result]").textContent = "Processing card details…";
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (currentAttempt !== attempt || !dialog.open) return;
    const request = window.CarePlusData?.get("careRequests", currentId);
    if (!payable(request) || request.demoPaymentStatus === 'Succeeded') { cancel(); return; }
    const succeeded = scenario === "success";
    const reference = succeeded ? `DEMO-${globalThis.crypto?.randomUUID?.() || Date.now()}` : null;
    // Store simulation results separately. Never change real payment/booking status.
    const saved = window.CarePlusData.update("careRequests", currentId, {
      demoPaymentStatus: succeeded ? "Succeeded" : "Declined",
      demoTransactionReference: reference,
      demoPaymentMethod: method,
      demoPaymentAt: new Date().toISOString()
    });
    find("[data-result]").textContent = !saved
      ? "Unable to complete the payment step. Please retry."
      : succeeded
        ? "Payment successful."
        : "Test payment declined. No money was charged. Your booking remains Pending Payment. Try again or cancel.";
    find("[data-result]").dataset.state = saved && succeeded ? "success" : "error";
    find("[data-preview]").textContent = saved && succeeded ? "Payment complete" : "Retry payment";
    if (saved && succeeded) {
      const feedback = document.getElementById("form-feedback");
      if (feedback) feedback.textContent = `Payment successful. Deposit paid: ${money(request.depositAmount)}. Remaining balance: ${money(request.remainingBalance)}.`;
      find("[data-checkout-fields]").hidden = true;
      find("[data-cancel]").textContent = "Close";
      find("[data-result]").focus();
    }
    if (!saved || !succeeded) {
      previewed = false;
      find("[data-preview]").disabled = false;
    }
  });
  const cancel = () => {
    attempt++;
    clearCard();
    const request = window.CarePlusData?.get("careRequests", requestId);
    if (request?.status === "Pending Payment" && request.demoPaymentStatus !== "Succeeded") {
      const feedback = document.getElementById("form-feedback");
      if (feedback) feedback.textContent = "Payment not completed. Your request remains Pending Payment and is not confirmed. You can reopen the deposit details from My care requests.";
    }
    dialog.close();
  };
  find("[data-cancel]").addEventListener("click", cancel);
  dialog.addEventListener("cancel", event => { event.preventDefault(); cancel(); });
  window.CarePlusDeposit = Object.freeze({
    open(id) {
      const request = window.CarePlusData?.get("careRequests", id);
      if (!payable(request) || request.depositRate !== 0.1 || request.demoPaymentStatus === 'Succeeded') return;
      requestId = id;
      find("[data-checkout-fields]").hidden = false;
      find("[data-cancel]").textContent = "Cancel";
      clearCard();
      cardForm.hidden = false;
      attempt++;
      previewed = false;
      find("[data-total]").textContent = money(request.totalPrice);
      find("[data-deposit]").textContent = money(request.depositAmount);
      find("[data-balance]").textContent = money(request.remainingBalance);
      find(".deposit-checkout").hidden = true;
      find("[data-proceed]").hidden = false;
      find("[data-preview]").disabled = false;
      find("[data-preview]").textContent = `Pay ${money(request.depositAmount)}`;
      find("[data-result]").dataset.state = "";
      find("[data-result]").textContent = "";
      if (!dialog.open) dialog.showModal();
    }
  });
})();
