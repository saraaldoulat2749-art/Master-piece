(() => {
  const data = window.CarePlusData;
  const clinic = window.CarePlusClinic;
  const doctorAccount = window.CarePlusAuth?.demoDoctorAccount?.();
  const providerId = doctorAccount?.doctorId || doctorAccount?.id || "";
  const PROFILE_KEY = "careplusDoctorProfileV1";
  const SCHEDULE_KEY = "careplusDoctorScheduleV1";
  const DOCTOR_COMMISSION_RATE = 0.10;
  const today = localDate();
  const defaults = { name: "", photo: "", specialty: "", qualifications: "", experience: "", license: "", workplace: "", email: "", phone: "", fee: "" };
  let profile = clinic?.getProfile(providerId) || read(PROFILE_KEY, defaults);
  let schedule = clinic?.getSchedule(providerId) || read(SCHEDULE_KEY, { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", duration: 30, breakStart: "", breakEnd: "", holidays: [] });
  let activeStatus = "All";
  let toastTimer;

  function read(key, fallback) { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return { ...fallback }; } }
  function localDate(date = new Date()) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); return `${y}-${m}-${d}`; }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
  function appointments() { return data?.list("appointments") || []; }
  function ensureProfile() {
    const account = doctorAccount;
    if (account?.doctorId && String(account.doctorId) !== String(profile.doctorId || "")) profile = { ...defaults };
    if (!profile.name) {
      const all = appointments();
      const match = all.find(row => account?.doctorId && String(row.doctorId || "") === String(account.doctorId));
      profile.name = account?.name || match?.doctor || "Doctor";
      profile.specialty = account?.specialty || match?.specialty || "Healthcare";
      profile.email = account?.email || "";
      profile.phone = account?.phone || "";
      profile.doctorId = providerId;
      clinic?.saveProfile(profile, providerId);
    }
  }
  ensureProfile();
  const doctorName = () => String(profile.name || "Doctor").trim();
  const ownedAppointments = () => {
    const doctorId = window.CarePlusAuth?.demoDoctorAccount?.()?.doctorId || providerId;
    return appointments().filter(row => Boolean(doctorId) && String(row.doctorId || "") === String(doctorId));
  };
  function patientKey(row) {
    const name = String(row.patient || "").trim().toLowerCase().replace(/\s+/g, " ");
    const contact = String(row.email || "").trim().toLowerCase() || String(row.phone || "").replace(/\D/g, "");
    if (name) return `${name}|${contact}`;
    return contact || String(row.userId || row.id || "");
  }
  function initials(name) { return String(name || "DR").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase(); }
  function paintIdentity() {
    document.querySelectorAll("[data-doctor-name]").forEach(node => node.textContent = doctorName());
    document.querySelectorAll("[data-first-name]").forEach(node => node.textContent = doctorName().replace(/^Dr\.?\s*/i, "").split(/\s+/)[0] || "Doctor");
    document.querySelectorAll("[data-specialty]").forEach(node => node.textContent = profile.specialty || "CarePlus provider");
    document.querySelectorAll("[data-avatar]").forEach(node => { node.textContent = profile.photo ? "" : initials(doctorName()); node.style.backgroundImage = profile.photo ? `url("${profile.photo.replace(/["\\]/g, "")}")` : ""; });
  }
  function dateText(date) { if (!date) return "Date not set"; const parsed = new Date(`${date}T12:00:00`); return Number.isNaN(+parsed) ? date : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function timeText(value) { if (!value) return "—"; const parsed = new Date(`2000-01-01T${value}`); return Number.isNaN(+parsed) ? value : parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  const statusClass = status => String(status || "Requested").toLowerCase();
  function statusTag(status) { const normalized = ["Requested", "Confirmed", "Completed", "Cancelled", "Rejected"].includes(status) ? status : "Requested"; return `<span class="status ${statusClass(normalized)}">${normalized === "Requested" ? "Pending" : normalized}</span>`; }

  function renderDashboard() {
    const rows = ownedAppointments();
    const todayRows = rows.filter(row => row.date === today).sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const patients = new Set(rows.map(patientKey));
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    document.getElementById("statToday").textContent = todayRows.length;
    document.getElementById("statPatients").textContent = patients.size;
    document.getElementById("statUpcoming").textContent = rows.length;
    document.getElementById("statPending").textContent = rows.filter(row => ["Pending Deposit", "Requested"].includes(row.status)).length;
    const todayList = document.getElementById("todayList");
    todayList.innerHTML = todayRows.length ? todayRows.map(row => `<div class="appointment-item"><span class="time-block">${esc(timeText(row.time))}</span><span class="patient-main"><b>${esc(row.patient || "Patient")}</b><small>${esc(dateText(row.date))}${row.specialty ? ` · ${esc(row.specialty)}` : ""}${String(row.source || "").includes("demo") ? " · Sample preview" : ""}</small></span>${statusTag(row.status)}</div>`).join("") : `<div class="empty-state">No appointments are scheduled for today.</div>`;
    const notices = [];
    const requests = rows.filter(row => ["Pending Deposit", "Requested"].includes(row.status)).length;
    if (requests) notices.push(`<div class="notice"><i>✉</i><span><b>${requests} new booking request${requests === 1 ? "" : "s"}</b><br>Review requests awaiting a response.</span></div>`);
    const next = rows.filter(row => row.date >= today && row.status === "Confirmed").sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
    if (next) notices.push(`<div class="notice"><i>◷</i><span><b>Upcoming appointment</b><br>${esc(rowPatient(next))} · ${esc(dateText(next.date))} at ${esc(timeText(next.time))}</span></div>`);
    document.getElementById("noticeList").innerHTML = notices.join("") || `<div class="empty-state">You’re all caught up. New updates will appear here.</div>`;
    document.getElementById("notificationDot").hidden = requests === 0;
  }
  function rowPatient(row) { return row.patient || "Patient"; }
  function renderAppointments() {
    const query = document.getElementById("appointmentSearch").value.trim().toLowerCase();
    const date = document.getElementById("appointmentDateFilter").value;
    const filtered = ownedAppointments().filter(row => (activeStatus === "All" || (activeStatus === "Requested" ? row.status === "Requested" : row.status === activeStatus)) && (!date || row.date === date) && (!query || `${row.patient} ${row.phone || ""} ${row.email || ""}`.toLowerCase().includes(query))).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    document.getElementById("appointmentRows").innerHTML = filtered.map(row => {
      let actions = "—";
      if (row.status === "Requested") actions = `<div class="row-actions"><button class="action accept" data-action="Confirmed" data-id="${esc(row.id)}">Accept</button><button class="action reject" data-action="Cancelled" data-id="${esc(row.id)}">Reject</button></div>`;
      else if (row.status === "Confirmed") actions = `<div class="row-actions"><button class="action" data-action="Completed" data-id="${esc(row.id)}">Complete</button><button class="action cancel" data-action="Cancelled" data-id="${esc(row.id)}">Cancel</button></div>`;
      return `<tr><td><b>${esc(row.patient || "Patient")}</b>${String(row.source || "").includes("demo") ? `<small class="sample-label">Sample preview</small>` : ""}</td><td>${esc(dateText(row.date))}</td><td>${esc(timeText(row.time))}</td><td>${statusTag(row.status)}</td><td>${actions}</td></tr>`;
    }).join("");
    document.getElementById("appointmentEmpty").hidden = filtered.length > 0;
    document.getElementById("appointmentCount").textContent = `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`;
  }
  renderAppointments = function renderAppointmentFinance() {
    const query = document.getElementById("appointmentSearch").value.trim().toLowerCase();
    const date = document.getElementById("appointmentDateFilter").value;
    const filtered = ownedAppointments().filter(row => (activeStatus === "All" || (activeStatus === "Requested" ? ["Requested", "Pending Deposit"].includes(row.status) : row.status === activeStatus)) && (!date || row.date === date) && (!query || `${row.patient} ${row.phone || ""} ${row.email || ""} ${row.id || ""}`.toLowerCase().includes(query))).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
    document.getElementById("appointmentRows").innerHTML = filtered.map(row => {
      const hasFee = Number(row.consultationFee) > 0;
      const depositReady = ["Demo Simulated", "Paid"].includes(row.depositPaymentStatus);
      let actions = "—";
      if (row.status === "Pending Deposit") actions = `<span class="payment-wait">Pending</span>`;
      else if (row.status === "Requested" && (!hasFee || depositReady)) actions = `<div class="row-actions"><button class="action accept" data-action="Confirmed" data-id="${esc(row.id)}">Accept</button><button class="action reject" data-action="Cancelled" data-id="${esc(row.id)}">Reject</button></div>`;
      else if (row.status === "Requested") actions = `<span class="payment-wait">Awaiting deposit</span>`;
      else if (row.status === "Confirmed") actions = `<div class="row-actions"><button class="action" data-action="Completed" data-id="${esc(row.id)}">Complete</button><button class="action cancel" data-action="Cancelled" data-id="${esc(row.id)}">Cancel</button></div>`;
      const payment = hasFee ? `<small class="finance-lines">Fee ${esc(money(row.consultationFee))} · Deposit paid ${esc(money(row.depositPaid))} / required ${esc(money(row.depositAmount))} · Balance ${esc(money(row.remainingBalance))}<br>CarePlus ${esc(Number(row.commissionRate || 0))}% = ${esc(money(row.commissionAmount))} · Collected ${esc(money(row.commissionCollected))} · To settle ${esc(money(row.commissionRemainingToSettle))}<br>Doctor net ${esc(money(row.doctorNetEarnings))}<br>Payment: ${esc(row.paymentStatus || "Pending")}</small>` : `<small class="finance-lines">No payment details recorded</small>`;
      const appointmentTag = row.status === "Pending Deposit" ? `<span class="status requested">Pending deposit</span>` : statusTag(row.status);
      return `<tr><td><b>${esc(row.patient || "Patient")}</b><small class="finance-lines">ID ${esc(row.id)}</small></td><td>${esc(dateText(row.date))}</td><td>${esc(timeText(row.time))}</td><td>${appointmentTag}</td><td>${payment}</td><td>${actions}</td></tr>`;
    }).join("");
    document.getElementById("appointmentEmpty").hidden = filtered.length > 0;
    document.getElementById("appointmentCount").textContent = `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`;
  };
  function renderPatients() {
    const query = document.getElementById("patientSearch").value.trim().toLowerCase();
    const byKey = new Map();
    ownedAppointments().forEach(row => {
      const key = patientKey(row);
      if (!byKey.has(key)) byKey.set(key, { ...row, history: [] });
      byKey.get(key).history.push(row);
    });
    const list = [...byKey.values()].filter(person => String(person.patient || "Patient").toLowerCase().includes(query)).sort((a, b) => String(a.patient).localeCompare(String(b.patient)));
    document.getElementById("patientCount").textContent = `${list.length} patient${list.length === 1 ? "" : "s"}`;
    document.getElementById("patientList").innerHTML = list.map((person, i) => {
      const ordered = person.history.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const user = data?.list("users").find(row => row.id === person.userId);
      const phone = person.phone || user?.phone || "";
      const email = person.email || user?.email || "";
      const access = phone || email ? `${phone ? `<small>${esc(phone)}</small>` : ""}${email ? `<small>${esc(email)}</small>` : ""}` : `<small>Contact details not provided with booking</small>`;
      const history = ordered.slice(0, 4).map(row => `${esc(dateText(row.date))} · ${esc(row.status || "Requested")}${String(row.source || "").includes("demo") ? " · Sample preview" : ""}`).join("<br>");
      return `<article class="patient-card"><span class="patient-avatar">${esc(initials(person.patient))}</span><span class="patient-info"><b>${esc(person.patient || "Patient")}</b>${access}</span><button class="details-button" data-patient="patient-${i}">Details</button><div class="patient-history" id="patient-${i}" hidden><strong>Appointment history</strong><br>${history || "No history available"}<br><span>Medical notes are not supported by the current system.</span></div></article>`;
    }).join("");
    document.getElementById("patientEmpty").hidden = list.length > 0;
  }
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function renderSchedule() {
    document.getElementById("weekdays").innerHTML = days.map((day, index) => { const enabled = schedule.days.includes(index); return `<label class="weekday ${enabled ? "" : "off"}"><input type="checkbox" data-day="${index}" ${enabled ? "checked" : ""}><span>${day}</span><input type="time" data-day-start="${index}" value="${esc(schedule.dayHours?.[index]?.start || schedule.start)}" ${enabled ? "" : "disabled"}><input type="time" data-day-end="${index}" value="${esc(schedule.dayHours?.[index]?.end || schedule.end)}" ${enabled ? "" : "disabled"}></label>`; }).join("");
    document.getElementById("startTime").value = schedule.start;
    document.getElementById("endTime").value = schedule.end;
    document.getElementById("duration").value = String(schedule.duration || 30);
    document.getElementById("breakStart").value = schedule.breakStart || "";
    document.getElementById("breakEnd").value = schedule.breakEnd || "";
    document.getElementById("holidayList").innerHTML = (schedule.holidays || []).map((item, index) => `<div class="holiday-row"><span>${esc(dateText(item.date))}<small>${esc(item.note || "Unavailable")}</small></span><button class="remove-holiday" data-holiday="${index}">Remove</button></div>`).join("") || `<div class="empty-state">No unavailable dates added.</div>`;
  }
  function saveSchedule() {
    const selected = [...document.querySelectorAll("[data-day]:checked")].map(input => Number(input.dataset.day));
    if (!selected.length) return showToast("Choose at least one working day.");
    schedule.days = selected;
    schedule.start = document.getElementById("startTime").value;
    schedule.end = document.getElementById("endTime").value;
    schedule.duration = Number(document.getElementById("duration").value);
    schedule.breakStart = document.getElementById("breakStart").value;
    schedule.breakEnd = document.getElementById("breakEnd").value;
    schedule.dayHours = Object.fromEntries(selected.map(day => [day, { start: document.querySelector(`[data-day-start="${day}"]`).value, end: document.querySelector(`[data-day-end="${day}"]`).value }]));
    if (!schedule.start || !schedule.end || schedule.start >= schedule.end) return showToast("Enter valid working hours.");
    if (selected.some(day => !schedule.dayHours[day].start || !schedule.dayHours[day].end || schedule.dayHours[day].start >= schedule.dayHours[day].end)) return showToast("Each working day needs valid start and end times.");
    if ((schedule.breakStart || schedule.breakEnd) && (!schedule.breakStart || !schedule.breakEnd || schedule.breakStart >= schedule.breakEnd || schedule.breakStart < schedule.start || schedule.breakEnd > schedule.end)) return showToast("Break must fit inside working hours.");
    if (clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })())) { renderSchedule(); showToast("Schedule saved. Booking availability has been updated."); } else showToast("Could not save your schedule in this browser.");
  }
  function renderProfile() {
    const form = document.getElementById("profileForm");
    Object.entries(profile).forEach(([key, value]) => { const input = form.elements.namedItem(key); if (input && input.type !== "file") input.value = value ?? ""; });
    renderFeeBreakdown();
  }
  function renderFeeBreakdown() {
    const feeInput = document.querySelector('#profileForm [name="fee"]');
    const rawFee = feeInput.value.trim();
    const fee = Number(rawFee);
    const hasFee = rawFee !== "" && Number.isFinite(fee) && fee >= 0;
    const commission = hasFee ? fee * DOCTOR_COMMISSION_RATE : 0;
    const formatJod = amount => `JOD ${amount.toFixed(2)}`;

    document.getElementById("doctorFeeGross").textContent = hasFee ? formatJod(fee) : "JOD 0.00";
    document.getElementById("doctorFeeCommission").textContent = formatJod(commission);
    document.getElementById("doctorFeeNet").textContent = formatJod(hasFee ? fee - commission : 0);
  }
  function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    values.photo = profile.photo || "";
    values.name = values.name.trim();
    values.doctorId = providerId || profile.doctorId || "";
    if (!values.name || values.name.length < 2 || (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) { document.getElementById("profileMessage").textContent = "Check the name and email fields and try again."; return; }
    const oldName = doctorName();
    const linkedIds = oldName.toLowerCase() !== values.name.toLowerCase() ? ownedAppointments().map(row => row.id) : [];
    try {
      const profileSaved = clinic ? clinic.saveProfile(values, providerId) : (() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(values)); return true; })();
      if (!profileSaved) throw new Error("Profile storage unavailable");
      const account = doctorAccount;
      if (account) data?.update("users", account.id, { name: values.name, phone: values.phone, specialty: values.specialty });
      profile = values;
      // When the provider renames their profile, keep existing bookings linked to that profile.
      linkedIds.forEach(id => data.update("appointments", id, { doctor: doctorName() }));
      document.getElementById("profileMessage").textContent = "Changes saved in this browser.";
      paintIdentity(); renderAll(); showToast("Profile saved.");
    } catch { document.getElementById("profileMessage").textContent = "Could not save changes in this browser."; }
  }
  function renderAll() { paintIdentity(); renderDashboard(); renderAppointments(); renderPatients(); }
  function showToast(message) { const node = document.getElementById("toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2800); }
  function navigate(page) { document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node.id === `page-${page}`)); document.querySelectorAll(".nav-link").forEach(node => node.classList.toggle("active", node.dataset.page === page)); const active = document.querySelector(`.nav-link[data-page="${page}"]`); document.getElementById("crumb").textContent = active?.textContent.trim() || "Dashboard"; document.getElementById("sidebar").classList.remove("open"); if (page === "appointments") renderAppointments(); if (page === "patients") renderPatients(); if (page === "schedule") renderSchedule(); if (page === "profile") renderProfile(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
  document.querySelectorAll("[data-go-appointments]").forEach(button => button.addEventListener("click", () => navigate("appointments")));
  document.querySelectorAll("[data-go-schedule]").forEach(button => button.addEventListener("click", () => navigate("schedule")));
  document.getElementById("menuButton").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("notificationButton").addEventListener("click", () => navigate("appointments"));
  document.getElementById("appointmentSearch").addEventListener("input", renderAppointments);
  document.getElementById("appointmentDateFilter").addEventListener("change", renderAppointments);
  document.getElementById("patientSearch").addEventListener("input", renderPatients);
  document.getElementById("statusTabs").addEventListener("click", event => { const button = event.target.closest("[data-status]"); if (!button) return; activeStatus = button.dataset.status; document.querySelectorAll("#statusTabs button").forEach(item => item.classList.toggle("selected", item === button)); renderAppointments(); });
  document.getElementById("appointmentRows").addEventListener("click", event => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const row = ownedAppointments().find(item => String(item.id) === button.dataset.id); if (!row) return;
    const status = button.dataset.action;
    const changes = { status };
    if (status === "Completed") changes.commissionStatus = row.paymentStatus === "Paid" && row.balancePaymentStatus === "Paid" ? "Pending Review" : "Not payable — demo payment or balance unpaid";
    if (status === "Cancelled") {
      changes.commissionStatus = ["Pending Review", "Payable", "Settled"].includes(row.commissionStatus) ? "Reversed" : "Not earned";
        if (Number(row.commissionCollected) > 0) changes.commissionReversedAmount = Number(row.commissionCollected);
        changes.commissionCollected = 0;
        changes.commissionRemainingToSettle = 0;
      if (Number(row.depositPaid) > 0) changes.refundStatus = String(row.paymentStatus || "").startsWith("Demo") ? "No refund due; demo payment was not charged" : "Refund review required";
    }
    if (Object.keys(changes).length && clinic?.updateAppointment(row.id, changes)) renderAll();
  });
  document.getElementById("patientList").addEventListener("click", event => { const button = event.target.closest("[data-patient]"); if (!button) return; const details = document.getElementById(button.dataset.patient); details.hidden = !details.hidden; button.textContent = details.hidden ? "Details" : "Hide"; });
  document.getElementById("weekdays").addEventListener("change", event => { const day = event.target.dataset.day; if (day === undefined) return; const row = event.target.closest(".weekday"); row.classList.toggle("off", !event.target.checked); row.querySelectorAll("input[type=time]").forEach(input => input.disabled = !event.target.checked); });
  document.getElementById("saveSchedule").addEventListener("click", saveSchedule);
  document.getElementById("holidayForm").addEventListener("submit", event => { event.preventDefault(); const date = document.getElementById("holidayDate").value; if (!date) return; if (schedule.holidays.some(item => item.date === date)) return showToast("That unavailable date is already listed."); schedule.holidays.push({ date, note: document.getElementById("holidayNote").value.trim() }); if (!(clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })()))) return showToast("Could not save unavailable date."); event.currentTarget.reset(); renderSchedule(); showToast("Unavailable date added."); });
  document.getElementById("holidayList").addEventListener("click", event => { const button = event.target.closest("[data-holiday]"); if (!button) return; schedule.holidays.splice(Number(button.dataset.holiday), 1); if (!(clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })()))) return showToast("Could not update unavailable dates."); renderSchedule(); showToast("Unavailable date removed."); });
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.querySelector('#profileForm [name="fee"]').addEventListener("input", renderFeeBreakdown);
  clinic?.subscribe(() => { profile = clinic.getProfile(providerId); schedule = clinic.getSchedule(providerId); renderAll(); if (document.querySelector("#page-schedule.active")) renderSchedule(); if (document.querySelector("#page-profile.active")) renderProfile(); });
  document.getElementById("holidayDate").min = today;
  renderAll(); renderSchedule(); renderProfile();
})();
