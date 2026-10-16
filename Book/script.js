(() => {
  const form = document.getElementById("bookingForm");
  const specialtySelect = document.getElementById("specialty");
  const areaSelect = document.getElementById("area");
  const doctorSelect = document.getElementById("doctor");
  const findButton = document.querySelector(".find-button");
  const preview = document.getElementById("doctor-profile-preview");
  let doctors = [];
  let selectedDoctor = null;

  function refreshDoctors() {
    doctors = (window.CarePlusClinic?.listDoctors() || []).map(account => ({
      ...account,
      profile: { ...account.profile, name: account.profile.name || account.name, doctorId: account.doctorId }
    })).filter(account => account.profile.name);
    doctorSelect.replaceChildren(new Option(doctors.length ? "Choose a doctor" : "No active doctor profile is available", ""));
    doctors.forEach(account => doctorSelect.add(new Option(`${account.profile.name} — ${account.profile.specialty || account.specialty || "Doctor"}`, account.doctorId)));
    doctorSelect.disabled = !doctors.length;
    if (!doctors.some(account => String(account.doctorId) === doctorSelect.value)) doctorSelect.value = doctors[0]?.doctorId || "";
    renderDoctorPreview();
  }

  function renderDoctorPreview() {
    selectedDoctor = doctors.find(account => String(account.doctorId) === doctorSelect.value) || null;
    preview.replaceChildren();
    preview.hidden = !selectedDoctor;
    if (!selectedDoctor) return;
    const profile = selectedDoctor.profile;
    const heading = document.createElement("strong");
    heading.textContent = profile.name;
    const details = [profile.specialty || selectedDoctor.specialty, profile.qualifications,
      profile.experience ? `${profile.experience} years of experience` : "", profile.workplace,
      profile.fee ? `Consultation fee: ${profile.fee} JOD` : "Consultation fee not set"].filter(Boolean);
    const copy = document.createElement("p");
    copy.textContent = details.join(" · ");
    preview.append(heading, copy);
    const specialty = profile.specialty || selectedDoctor.specialty;
    if (specialty && ![...specialtySelect.options].some(option => option.value === specialty)) specialtySelect.add(new Option(specialty, specialty));
    if (specialty) specialtySelect.value = specialty;
  }

  document.querySelectorAll(".specialty").forEach(card => card.addEventListener("click", function () {
    specialtySelect.value = this.dataset.specialty;
    document.querySelectorAll(".specialty").forEach(item => item.classList.toggle("selected", item === this));
  }));
  doctorSelect.addEventListener("change", renderDoctorPreview);
  window.CarePlusClinic?.subscribe(refreshDoctors);
  refreshDoctors();

  findButton.addEventListener("click", event => {
    event.preventDefault();
    const area = areaSelect.value;
    const specialty = specialtySelect.value;
    const doctor = selectedDoctor?.profile.name || "";
    const profile = selectedDoctor?.profile;
    if (!area || !specialty || !doctor) { alert("Please select your area, medical specialty, and doctor."); return; }
    if (!selectedDoctor) { alert("This doctor profile is no longer available. Please select again."); refreshDoctors(); return; }
    if (profile.specialty && specialty !== profile.specialty) { alert("Please choose the specialty shown in this doctor's profile."); specialtySelect.value = profile.specialty; return; }
    if (!Number(profile.fee)) { alert("This doctor has not set a consultation fee yet."); return; }
    const params = new URLSearchParams({ area, specialty, doctor, doctorId: selectedDoctor.doctorId });
    if (profile.photo) params.set("image", profile.photo);
    window.location.href = "Time/index.html?" + params.toString();
  });
})();
