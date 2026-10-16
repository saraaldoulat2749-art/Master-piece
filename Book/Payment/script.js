(() => {
  const params = new URLSearchParams(location.search);
  const appointmentId = params.get("appointmentId") || "";
  const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
  const button = document.getElementById("simulatePayment");
  const viewLink = document.getElementById("viewAppointment");
  const appointment = () => appointmentId && window.CarePlusData?.get("appointments", appointmentId);

  function render() {
    const record = appointment();
    if (!record) {
      document.getElementById("paymentMessage").textContent = "This appointment could not be found. Return to booking and try again.";
      button.disabled = true;
      return;
    }
    const identity = sessionStorage.getItem("careplusDemoIdentity") || localStorage.getItem("careplusDemoIdentity") || "";
    const signedIn = window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === identity.toLowerCase() || user.phone === identity);
    if (record.userId && String(record.userId) !== String(signedIn?.id || "")) {
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
    const complete = record.depositPaymentStatus === "Demo Simulated" || record.depositPaymentStatus === "Paid";
    document.getElementById("paymentStatus").textContent = complete ? record.paymentStatus : "Deposit required";
    button.disabled = complete;
    button.textContent = complete ? "Demo deposit step complete" : "Simulate deposit success";
    viewLink.hidden = !complete;
    viewLink.href = `../Success/index.html?appointmentId=${encodeURIComponent(record.id)}`;
    if (complete) document.getElementById("paymentMessage").textContent = "The demo response was recorded. This is not a real payment; the appointment is a request for the doctor's review.";
  }

  button.addEventListener("click", () => {
    const record = appointment();
    if (!record) return render();
    // Replace this simulated response with verified provider webhooks/API calls in the backend version.
    const updated = window.CarePlusClinic?.recordDemoDepositStep(record.id);
    if (!updated) {
      document.getElementById("paymentMessage").textContent = "The demo response could not be saved in this browser.";
      return;
    }
    location.href = `../Success/index.html?appointmentId=${encodeURIComponent(updated.id)}`;
  });
  document.getElementById("backButton").addEventListener("click", event => { event.preventDefault(); if (history.length > 1) history.back(); else location.href = "../Review/index.html"; });
  window.CarePlusData?.subscribe(render);
  render();
})();
