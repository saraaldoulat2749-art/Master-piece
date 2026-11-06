(() => {
  const params = new URLSearchParams(location.search);
  const appointmentId = params.get("appointmentId") || "";
  const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
  const button = document.getElementById("simulatePayment");
  const cardForm = document.getElementById("cardForm");
  const viewLink = document.getElementById("viewAppointment");
  const appointment = () => appointmentId && window.CarePlusData?.get("appointments", appointmentId);

  function render() {
    window.CarePlusClinic?.expireUnpaidHolds();
    const record = appointment();
    if (!record) {
      document.getElementById("paymentMessage").textContent = "This appointment could not be found. Return to booking and try again.";
      button.disabled = true;
      return;
    }
    if (record.expiredAt && record.paymentStatus === 'Expired') {
      const message = document.getElementById('paymentMessage');
      message.textContent = 'The one-hour payment deadline has passed. This booking expired and the time is available again. Please book another appointment.';
      message.hidden = false;
      button.disabled = true; button.textContent = 'Payment deadline expired';
      cardForm.hidden = true; viewLink.hidden = true;
      return;
    }
    const identity = sessionStorage.getItem("careplusDemoIdentity") || localStorage.getItem("careplusDemoIdentity") || "";
    const signedIn = window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === identity.toLowerCase() || user.phone === identity);
    const allowedUserIds = [record.userId, record.bookingUserId].filter(Boolean).map(String);
    if (allowedUserIds.length && !allowedUserIds.includes(String(signedIn?.id || ""))) {
      document.getElementById("paymentMessage").textContent = "This appointment belongs to a different account.";
      button.disabled = true;
      return;
    }
    document.getElementById("appointmentId").textContent = record.id;
    document.getElementById("feeAmount").textContent = money(record.consultationFee);
    document.getElementById("depositAmount").textContent = money(record.depositAmount);
    document.getElementById("balanceAmount").textContent = money(record.remainingBalance);
    document.getElementById("commissionAmount").textContent = money(record.commissionAmount);
    document.getElementById("commissionCollected").textContent = money(record.commissionCollected);
    document.getElementById("commissionRemaining").textContent = money(record.commissionRemainingToSettle);
    document.getElementById("doctorNet").textContent = money(record.doctorNetEarnings);
    if (!["confirmed", "accepted"].includes(String(record.status || "").toLowerCase())) {
      document.getElementById("paymentMessage").textContent = "Deposit payment is available only after the doctor accepts your appointment.";
      document.getElementById("paymentMessage").hidden = false;
      button.disabled = true;
      button.textContent = "Pay after doctor accepts";
      cardForm.hidden = true;
      viewLink.hidden = true;
      return;
    }
    const complete = record.depositPaymentStatus === "Demo Simulated" || record.depositPaymentStatus === "Paid";
    if (!complete && record.paymentDueAt) {
      const seconds = Math.max(0, Math.ceil((Date.parse(record.paymentDueAt) - Date.now()) / 1000));
      document.getElementById('paymentMessage').textContent = `Your time is reserved. Pay within ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} to confirm; otherwise it becomes available again.`;
    }
    button.disabled = complete;
    button.textContent = complete ? "Paid" : "Pay now";
    cardForm.hidden = complete;
    document.getElementById("paymentMessage").hidden = complete || !document.getElementById("paymentMessage").textContent;
    viewLink.hidden = !complete;
    viewLink.href = `../Success/index.html?appointmentId=${encodeURIComponent(record.id)}`;
  }

  cardForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!cardForm.reportValidity()) return;
    const validation = window.CarePlusPaymentValidation?.validateCard({ name: document.getElementById('cardholder').value,
      number: document.getElementById('cardNumber').value, expiry: document.getElementById('cardExpiry').value, cvv: document.getElementById('cardCvc').value });
    if (!validation?.ok) {
      document.getElementById('paymentMessage').textContent = validation?.error || 'Payment validation is unavailable. Refresh and try again.';
      document.getElementById('paymentMessage').hidden = false; return;
    }
    const record = appointment();
    if (!record) return render();
    if (!window.CarePlusClinic?.isAvailable({ doctor: record.doctor, doctorId: record.doctorId, date: record.date, time: record.time, ignoreId: record.id })) {
      const message = document.getElementById("paymentMessage");
      message.textContent = "This appointment time is no longer available. Please return to booking and choose another time.";
      message.hidden = false;
      return;
    }
    // Replace this simulated response with verified provider webhooks/API calls in the backend version.
    const updated = window.CarePlusClinic?.recordDemoDepositStep(record.id);
    if (!updated) {
      const message = document.getElementById("paymentMessage");
      message.textContent = "Payment could not be recorded. Please try again.";
      message.hidden = false;
      return;
    }
    cardForm.reset();
    location.href = `../Success/index.html?appointmentId=${encodeURIComponent(updated.id)}`;
  });
  window.CarePlusData?.subscribe(render);
  setInterval(render, 1000);
  render();
})();
