(() => {
  const data = window.CarePlusData;
  const pharmacyApi = window.CarePlusPharmacy;
  const auth = window.CarePlusAuth;
  const $ = id => document.getElementById(id);
  const form = $("profileForm");
  const loadMessage = $("profileLoadMessage");
  const toastNode = $("toast");
  let timer;

  if (!data || !pharmacyApi || !form) {
    if (loadMessage) loadMessage.textContent = "The pharmacy profile could not be loaded. Refresh this page and try again.";
    return;
  }

  const pharmacyId = auth?.demoPharmacyId?.();
  const safeText = value => String(value ?? "");
  const formatDate = value => {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const showToast = message => {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toastNode.classList.remove("show"), 2800);
  };

  function render() {
    const pharmacy = pharmacyApi.get(pharmacyId);
    if (!pharmacy) {
      form.hidden = true;
      loadMessage.hidden = false;
      loadMessage.textContent = "No pharmacy record is linked to this account. Contact the CarePlus administrator to link the correct pharmacy.";
      return;
    }
    loadMessage.hidden = true;
    form.hidden = false;
    const pharmacist = auth?.demoPharmacyAccount?.();
    $("profileName").value = safeText(pharmacy.name);
    $("profileHeadingName").textContent = pharmacy.name || "My Pharmacy";
    $("profileResponsible").value = safeText(pharmacy.responsiblePharmacist);
    $("profileLicense").value = safeText(pharmacy.licenseNumber);
    $("profilePhone").value = safeText(pharmacy.phone);
    $("profileEmail").value = safeText(pharmacist?.email || pharmacy.email);
    $("profileAddress").value = safeText(pharmacy.address);
    $("profileArea").value = safeText(pharmacy.area || pharmacy.city);
    $("profileLocation").value = safeText(pharmacy.location || pharmacy.area || pharmacy.city);
    $("profileHours").value = safeText(pharmacy.openingHours || pharmacy.hours);
    $("profileDistance").value = safeText(pharmacy.distance);
    $("profileDescription").value = safeText(pharmacy.description);
    $("profileEmergency").checked = pharmacy.emergencyAvailable === true;
    $("openToggle").checked = pharmacy.open !== false;
    $("openLabel").textContent = pharmacy.open === false ? "Closed" : "Open";
    $("profileCreatedAt").textContent = formatDate(pharmacy.createdAt);
    $("profileUpdatedAt").textContent = formatDate(pharmacy.updatedAt);
  }

  $("openToggle").addEventListener("change", () => {
    $("openLabel").textContent = $("openToggle").checked ? "Open" : "Closed";
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const message = $("profileMessage");
    message.classList.remove("error");
    message.textContent = "";
    const changes = {
      name: $("profileName").value.trim(),
      responsiblePharmacist: $("profileResponsible").value.trim(),
      licenseNumber: $("profileLicense").value.trim(),
      phone: $("profilePhone").value.trim(),
      email: $("profileEmail").value.trim(),
      address: $("profileAddress").value.trim(),
      area: $("profileArea").value.trim(),
      location: $("profileLocation").value.trim() || $("profileArea").value.trim(),
      openingHours: $("profileHours").value.trim(),
      hours: $("profileHours").value.trim(),
      distance: $("profileDistance").value.trim() || "Nearby",
      description: $("profileDescription").value.trim(),
      emergencyAvailable: $("profileEmergency").checked,
      open: $("openToggle").checked
    };
    if (!changes.name || !changes.phone || !changes.address || !changes.area || !changes.location || !changes.openingHours) {
      message.textContent = "Complete the pharmacy name, phone, address, city or area, map location, and opening hours.";
      message.classList.add("error");
      return;
    }
    if (changes.phone.replace(/\D/g, "").length < 7) {
      message.textContent = "Enter a valid pharmacy phone number.";
      message.classList.add("error");
      return;
    }
    if (!changes.email || !/^\S+@\S+\.\S+$/.test(changes.email)) {
      message.textContent = "Enter a valid sign-in email address.";
      message.classList.add("error");
      return;
    }
    const pharmacist = auth?.demoPharmacyAccount?.();
    const previousEmail = pharmacist?.email || "";
    const emailResult = auth?.updatePharmacyLoginEmail?.(changes.email);
    if (!emailResult?.ok) {
      message.textContent = emailResult?.error || "Could not update the pharmacy sign-in email.";
      message.classList.add("error");
      return;
    }
    if (!pharmacyApi.updatePharmacy(pharmacyId, changes)) {
      if (previousEmail && previousEmail !== changes.email) auth?.updatePharmacyLoginEmail?.(previousEmail);
      message.textContent = "The pharmacy profile could not be saved in this browser.";
      message.classList.add("error");
      return;
    }
    message.textContent = "Pharmacy profile saved. Customer-facing details are updated.";
    render();
    showToast("Profile changes saved.");
  });

  $("menuToggle").addEventListener("click", () => {
    const open = $("sidebar").classList.toggle("open");
    document.querySelector(".app-shell").classList.toggle("menu-open", open);
  });

  pharmacyApi.subscribe(render);
  render();
})();
