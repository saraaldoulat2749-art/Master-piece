document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const values = Object.fromEntries(["area", "specialty", "doctor", "doctorId", "image", "date", "time"].map(key => [key, params.get(key) || ""]));
  const errorMessage = document.getElementById("errorMessage");
  const confirmButton = document.getElementById("confirmButton");
  const profile = window.CarePlusClinic?.resolveDoctor(values.doctor, values.doctorId)?.profile || {};
  const fee = Number(profile.fee);
  const validFee = Number.isFinite(fee) && fee > 0;
  const deposit = validFee ? Number((fee * 0.10).toFixed(2)) : 0;
  const commission = validFee ? Number((fee * 0.10).toFixed(2)) : 0;
  const money = amount => `JOD ${Number(amount || 0).toFixed(2)}`;

  document.getElementById("doctorName").textContent = values.doctor || "Doctor not selected";
  document.getElementById("doctorSpecialty").textContent = values.specialty || "Specialty not selected";
  document.getElementById("doctorArea").textContent = values.area || "Area not selected";
  document.getElementById("appointmentTime").textContent = values.time || "Time not selected";
  const date = values.date ? new Date(`${values.date}T12:00:00`) : null;
  document.getElementById("appointmentDate").textContent = date && !Number.isNaN(+date)
    ? date.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "Date not selected";
  const doctorImage = document.getElementById("doctorImage");
  doctorImage.src = values.image || "https://placehold.co/160x160/e1f3f3/168f9b?text=Doctor";
  doctorImage.onerror = () => { doctorImage.onerror = null; doctorImage.src = "https://placehold.co/160x160/e1f3f3/168f9b?text=Doctor"; };
  document.getElementById("consultationFee").textContent = validFee ? money(fee) : "Not set";
  document.getElementById("requiredDeposit").textContent = validFee ? money(deposit) : "Not available";
  document.getElementById("remainingBalance").textContent = validFee ? money(fee - deposit) : "Not available";
  document.getElementById("commissionAmount").textContent = validFee ? money(commission) : "Not available";

  function showError(message) { errorMessage.textContent = message; errorMessage.style.display = "block"; }
  confirmButton.addEventListener("click", event => {
    event.preventDefault();
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
    const patientName = document.getElementById("patientName").value.trim();
    const patientPhone = document.getElementById("patientPhone").value.trim();
    const patientEmail = document.getElementById("patientEmail").value.trim();
    if (!values.doctor || !values.specialty || !values.area || !values.date || !values.time) return showError("Appointment details are missing. Please return and complete your booking.");
    if (!patientName || !patientPhone) return showError("Please enter your full name and phone number.");
    if (!validFee) return showError("This doctor has not set a consultation fee. Please choose another doctor or try later.");
    if (!window.CarePlusClinic?.isAvailable({ doctor: values.doctor, doctorId: values.doctorId, date: values.date, time: values.time })) return showError("This time is no longer available. Please return to the schedule and select another time.");

    const identity = sessionStorage.getItem("careplusDemoIdentity") || localStorage.getItem("careplusDemoIdentity") || "";
    const matchedUser = window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === identity.toLowerCase() || user.phone === identity);
    const idempotencyKey = [matchedUser?.id || identity || patientPhone, values.doctorId, values.date, values.time].join("|");
    const result = window.CarePlusClinic?.createBooking({
      patient: patientName, phone: patientPhone, email: patientEmail, userId: matchedUser?.id || "",
      doctor: values.doctor, doctorId: values.doctorId, specialty: values.specialty,
      area: values.area, date: values.date, time: values.time, idempotencyKey
    });
    if (!result?.ok) return showError(result?.error || "Could not save this booking. Please try again.");

    const paymentParams = new URLSearchParams({ appointmentId: result.appointment.id });
    window.location.href = `../Payment/index.html?${paymentParams.toString()}`;
  });
});
