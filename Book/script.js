(() => {
  const form = document.getElementById("bookingForm");
  const specialtySelect = document.getElementById("specialty");
  const areaSelect = document.getElementById("area");
  const doctorSelect = document.getElementById("doctor");
  const findButton = document.querySelector(".find-button");
  const preview = document.getElementById("doctor-profile-preview");
  let profile = window.CarePlusClinic?.getProfile() || {};

  function refreshDoctorProfile() {
    profile = window.CarePlusClinic?.getProfile() || {};
    doctorSelect.replaceChildren(new Option(profile.name ? "Choose a doctor" : "No doctor profile is available", ""));
    doctorSelect.disabled = !profile.name;
    if (!profile.name) { preview.hidden = true; return; }
    doctorSelect.add(new Option(`${profile.name} — ${profile.specialty || "Doctor"}`, profile.name));
    if (profile.specialty && ![...specialtySelect.options].some(option => option.value === profile.specialty)) {
      specialtySelect.add(new Option(profile.specialty, profile.specialty));
    }
    specialtySelect.value = profile.specialty || "";
    doctorSelect.value = profile.name;
    renderProfilePreview();
  }

  function renderProfilePreview() {
    preview.replaceChildren();
    if (!doctorSelect.value || doctorSelect.value !== profile.name) { preview.hidden = true; return; }
    preview.hidden = false;
    const heading = document.createElement("strong");
    heading.textContent = profile.name;
    const details = [profile.specialty, profile.qualifications, profile.experience ? `${profile.experience} years of experience` : "", profile.workplace, profile.fee ? `Consultation fee: ${profile.fee} JOD` : ""].filter(Boolean);
    const copy = document.createElement("p");
    copy.textContent = details.join(" · ");
    preview.append(heading, copy);
  }

  document.querySelectorAll(".specialty").forEach(card => {
    card.addEventListener("click", function () {
      specialtySelect.value = this.dataset.specialty;
      document.querySelectorAll(".specialty").forEach(item => item.classList.toggle("selected", item === this));
    });
  });
  doctorSelect.addEventListener("change", renderProfilePreview);
  window.CarePlusClinic?.subscribe(refreshDoctorProfile);
  refreshDoctorProfile();

  findButton.addEventListener("click", event => {
    event.preventDefault();
    const area = areaSelect.value;
    const specialty = specialtySelect.value;
    const doctor = doctorSelect.value;
    if (!area || !specialty || !doctor) { alert("Please select your area, medical specialty, and doctor."); return; }
    if (doctor !== profile.name) { alert("This doctor profile is no longer available. Please select again."); refreshDoctorProfile(); return; }
    if (profile.specialty && specialty !== profile.specialty) { alert("Please choose the specialty shown in this doctor's profile."); specialtySelect.value = profile.specialty; return; }
    const params = new URLSearchParams({ area, specialty, doctor });
    if (profile.photo) params.set("image", profile.photo);
    window.location.href = "Time/index.html?" + params.toString();
  });
})();
