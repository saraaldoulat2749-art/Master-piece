(() => {
  const params = new URLSearchParams(location.search);
  const appointmentId = params.get("appointmentId") || "";
  const fallback = Object.fromEntries(["doctor", "specialty", "area", "date", "time", "image"].map(key => [key, params.get(key) || ""]));
  const money = value => `JOD ${Number(value || 0).toFixed(2)}`;

  function render() {
    const row = appointmentId && window.CarePlusData?.get("appointments", appointmentId);
    const value = (key, fallbackValue = "Not specified") => row?.[key] || fallback[key] || fallbackValue;
    document.getElementById("doctorName").textContent = value("doctor", "Doctor not selected");
    document.getElementById("doctorSpecialty").textContent = value("specialty", "Specialty not selected");
    document.getElementById("doctorArea").textContent = value("area", "Area not selected");
    document.getElementById("appointmentDate").textContent = value("date");
    document.getElementById("appointmentTime").textContent = value("time");
    document.getElementById("appointmentLocation").textContent = value("area");
    document.getElementById("bookingStatus").textContent = row?.status || "Appointment record unavailable";
    document.getElementById("appointmentId").textContent = row?.id || "Not available";
    document.getElementById("consultationFee").textContent = money(row?.consultationFee);
    document.getElementById("depositRequired").textContent = money(row?.depositAmount);
    document.getElementById("depositPaid").textContent = money(row?.depositPaid);
    document.getElementById("remainingBalance").textContent = money(row?.remainingBalance);
    document.getElementById("commissionAmount").textContent = money(row?.commissionAmount);
    document.getElementById("paymentStatus").textContent = row?.paymentStatus || "Pending";
    const image = document.getElementById("doctorImage");
    image.src = fallback.image || "https://placehold.co/200x200/e8f8f7/087f86?text=Doctor";
    image.onerror = () => { image.onerror = null; image.src = "https://placehold.co/200x200/e8f8f7/087f86?text=Doctor"; };
  }
  window.CarePlusData?.subscribe(render);
  render();
})();
