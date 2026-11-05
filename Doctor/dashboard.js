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
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let calendarSelectedDate = localDate();
  let calendarView = "year";
  let toastTimer;
  let pendingRejectionId = "";
  let savedBreak = { start: schedule.breakStart || "", end: schedule.breakEnd || "" };

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
    const latestRows = data.newestFirst(rows).slice(0, 3);
    const patients = new Set(rows.map(patientKey));
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    document.getElementById("statToday").textContent = todayRows.length;
    document.getElementById("statPatients").textContent = patients.size;
    document.getElementById("statUpcoming").textContent = rows.length;
    document.getElementById("statPending").textContent = rows.filter(row => ["Pending Deposit", "Requested"].includes(row.status)).length;
    document.getElementById("statDepositsPaid").textContent = rows.filter(row =>
      ["Demo Simulated", "Paid"].includes(row.depositPaymentStatus)
      || ["paid", "succeeded"].includes(String(row.paymentStatus || "").trim().toLowerCase())
      || String(row.paymentStatus || "").trim().toLowerCase().startsWith("demo")
      || Number(row.depositAmount) > 0 && Number(row.depositPaid) >= Number(row.depositAmount)
    ).length;
    const todayList = document.getElementById("todayList");
    todayList.innerHTML = latestRows.length ? latestRows.map(row => `<div class="appointment-item"><span class="time-block">${esc(timeText(row.time))}</span><span class="patient-main"><b>${esc(row.patient || "Patient")}</b><small>${esc(dateText(row.date))}${row.specialty ? ` · ${esc(row.specialty)}` : ""}${String(row.source || "").includes("demo") ? " · Sample preview" : ""}</small></span>${statusTag(row.status)}</div>`).join("") : `<div class="empty-state">No appointments have been booked yet.</div>`;
    const notices = [];
    const requests = rows.filter(row => ["Pending Deposit", "Requested"].includes(row.status)).length;
    if (requests) notices.push(`<div class="notice"><i>✉</i><span><b>${requests} new booking request${requests === 1 ? "" : "s"}</b><br>Review requests awaiting a response.</span></div>`);
    const next = rows.filter(row => row.date >= today && row.status === "Confirmed").sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
    if (next) notices.push(`<div class="notice"><i>◷</i><span><b>Upcoming appointment</b><br>${esc(rowPatient(next))} · ${esc(dateText(next.date))} at ${esc(timeText(next.time))}</span></div>`);
    document.getElementById("noticeList").innerHTML = notices.join("") || `<div class="empty-state">You’re all caught up. New updates will appear here.</div>`;
  }
  function rowPatient(row) { return row.patient || "Patient"; }
  function renderAppointments() {
    const query = document.getElementById("appointmentSearch").value.trim().toLowerCase();
    const filtered = data.newestFirst(ownedAppointments().filter(row => (activeStatus === "All" || (activeStatus === "Requested" ? row.status === "Requested" : row.status === activeStatus)) && (!query || `${row.patient} ${row.phone || ""} ${row.email || ""}`.toLowerCase().includes(query))));
    document.getElementById("appointmentRows").innerHTML = filtered.map(row => {
      let actions = "—";
      if (row.status === "Requested") actions = `<div class="row-actions"><button class="action accept" data-action="Confirmed" data-id="${esc(row.id)}">Accept</button><button class="action reject" data-action="Rejected" data-id="${esc(row.id)}">Reject</button></div>`;
      else if (row.status === "Confirmed") actions = `<div class="row-actions"><button class="action" data-action="Completed" data-id="${esc(row.id)}">Complete</button><button class="action cancel" data-action="Cancelled" data-id="${esc(row.id)}">Cancel</button></div>`;
      return `<tr><td><b>${esc(row.patient || "Patient")}</b>${String(row.source || "").includes("demo") ? `<small class="sample-label">Sample preview</small>` : ""}</td><td>${esc(dateText(row.date))}</td><td>${esc(timeText(row.time))}</td><td>${statusTag(row.status)}</td><td>${actions}</td></tr>`;
    }).join("");
    document.getElementById("appointmentEmpty").hidden = filtered.length > 0;
    document.getElementById("appointmentCount").textContent = `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`;
  }
  renderAppointments = function renderAppointmentFinance() {
    const allRows = ownedAppointments();
    document.getElementById("appointmentSummaryTotal").textContent = allRows.length;
    document.getElementById("appointmentSummaryPending").textContent = allRows.filter(row => ["Requested", "Pending Deposit"].includes(row.status)).length;
    document.getElementById("appointmentSummaryPendingOnly").textContent = allRows.filter(row => row.status === "Requested").length;
    document.getElementById("appointmentSummaryConfirmed").textContent = allRows.filter(row => row.status === "Confirmed").length;
    document.getElementById("appointmentSummaryCompleted").textContent = allRows.filter(row => row.status === "Completed").length;
    const query = document.getElementById("appointmentSearch").value.trim().toLowerCase();
    const filtered = data.newestFirst(ownedAppointments().filter(row => (activeStatus === "All" || (activeStatus === "Requested" ? ["Requested", "Pending Deposit"].includes(row.status) : activeStatus === "Cancelled" ? ["Cancelled", "Rejected"].includes(row.status) : row.status === activeStatus)) && (!query || `${row.patient} ${row.phone || ""} ${row.email || ""} ${row.id || ""}`.toLowerCase().includes(query))));
    const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
    document.getElementById("appointmentRows").innerHTML = filtered.map(row => {
      const hasFee = Number(row.consultationFee) > 0;
      const normalizedPaymentStatus = String(row.paymentStatus || "").trim().toLowerCase();
      const depositReady = ["Demo Simulated", "Paid"].includes(row.depositPaymentStatus)
        || normalizedPaymentStatus === "paid"
        || normalizedPaymentStatus.startsWith("demo")
        || normalizedPaymentStatus === "succeeded"
        || Number(row.depositAmount) > 0 && Number(row.depositPaid) >= Number(row.depositAmount);
      let actions = "—";
      if (row.status === "Requested") actions = `<div class="row-actions"><button class="action accept" data-action="Confirmed" data-id="${esc(row.id)}">Accept</button><button class="action reject" data-action="Rejected" data-id="${esc(row.id)}">Reject</button></div>`;
      else if (row.status === "Pending Deposit" && (!hasFee || depositReady)) actions = `<div class="row-actions"><button class="action accept" data-action="Confirmed" data-id="${esc(row.id)}">Accept</button><button class="action reject" data-action="Rejected" data-id="${esc(row.id)}">Reject</button></div>`;
      else if (row.status === "Pending Deposit") actions = `<div class="row-actions"><button class="action accept" type="button" disabled title="Accept after the deposit is completed">Accept</button><button class="action reject" data-action="Rejected" data-id="${esc(row.id)}">Reject</button></div><small class="payment-wait">Awaiting deposit</small>`;
      else if (row.status === "Confirmed") actions = `<div class="row-actions"><button class="action" data-action="Completed" data-id="${esc(row.id)}">Complete</button><button class="action cancel" data-action="Cancelled" data-id="${esc(row.id)}">Cancel</button></div>`;
      const paymentStatus = String(row.paymentStatus || "Pending").startsWith("Demo") ? "Paid" : (row.paymentStatus || "Pending");
      const payment = hasFee ? `<small class="finance-lines">Fee ${esc(money(row.consultationFee))} · Deposit paid ${esc(money(row.depositPaid))} / required ${esc(money(row.depositAmount))} · Balance ${esc(money(row.remainingBalance))}<br>CarePlus ${esc(Number(row.commissionRate || 0))}% = ${esc(money(row.commissionAmount))} · Collected ${esc(money(row.commissionCollected))} · To settle ${esc(money(row.commissionRemainingToSettle))}<br>Doctor net ${esc(money(row.doctorNetEarnings))}<br>Payment: ${esc(paymentStatus)}</small>` : `<small class="finance-lines">No payment details recorded</small>`;
      const appointmentTag = row.status === "Pending Deposit" && depositReady ? `<span class="status requested">Deposit paid · awaiting review</span>` : row.status === "Pending Deposit" ? `<span class="status requested">Pending deposit</span>` : statusTag(row.status);
      const cancelReason = row.status === "Cancelled" && row.cancelReason ? `<div class="cancel-reason"><span class="cancel-reason__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 21 20H3l9-16.5Z"/><path d="M12 9v4m0 3h.01"/></svg></span><span class="cancel-reason__copy"><strong>Patient’s cancellation reason</strong><span>${esc(row.cancelReason)}</span></span></div>` : "";
      return `<tr data-appointment-id="${esc(row.id)}"><td><b>${esc(row.patient || "Patient")}</b><small class="finance-lines">ID ${esc(row.id)}</small></td><td>${esc(dateText(row.date))}</td><td>${esc(timeText(row.time))}</td><td>${appointmentTag}${cancelReason}</td><td>${payment}</td><td>${actions}</td></tr>`;
    }).join("");
    document.getElementById("appointmentEmpty").hidden = filtered.length > 0;
    document.getElementById("appointmentCount").textContent = `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`;
  };
  function renderCalendar() {
    const grid = document.getElementById("doctorCalendar");
    if (!grid) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const todayKey = localDate();
    document.getElementById("calendarToday").textContent = year;
    const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarMonth);
    const appointmentsByDate = new Map();
    const allAppointments = ownedAppointments().filter(row => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) return false;
      if (!appointmentsByDate.has(row.date)) appointmentsByDate.set(row.date, []);
      appointmentsByDate.get(row.date).push(row);
      return true;
    });
    const monthAppointments = allAppointments.filter(row => {
      const date = new Date(`${row.date}T12:00:00`);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    const normalizedStatus = row => String(row.status || "Requested").trim().toLowerCase();
    const yearAppointments = allAppointments.filter(row => new Date(`${row.date}T12:00:00`).getFullYear() === year);
    document.getElementById("calendarTotalCount").textContent = yearAppointments.length;
    document.getElementById("calendarPendingCount").textContent = yearAppointments.filter(row => ["requested", "pending", "pending deposit"].includes(normalizedStatus(row))).length;
    document.getElementById("calendarConfirmedCount").textContent = yearAppointments.filter(row => ["confirmed", "accepted"].includes(normalizedStatus(row))).length;
    document.getElementById("calendarCancelledCount").textContent = yearAppointments.filter(row => ["cancelled", "rejected"].includes(normalizedStatus(row))).length;
    const dayAppointments = (appointmentsByDate.get(calendarSelectedDate) || []).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    const selectedDateLabel = new Date(`${calendarSelectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    document.getElementById("calendarAgendaTitle").textContent = selectedDateLabel;
    document.getElementById("calendarAgendaDate").textContent = `Selected day · ${monthLabel}`;
    document.getElementById("calendarAgendaCount").textContent = dayAppointments.length;
    document.getElementById("calendarAgendaTotal").textContent = monthAppointments.length;
    document.getElementById("calendarAgendaConfirmed").textContent = monthAppointments.filter(row => ["confirmed", "accepted"].includes(normalizedStatus(row))).length;
    document.getElementById("calendarAgendaPending").textContent = monthAppointments.filter(row => ["requested", "pending", "pending deposit"].includes(normalizedStatus(row))).length;
    document.getElementById("calendarAgendaCancelled").textContent = monthAppointments.filter(row => ["cancelled", "rejected"].includes(normalizedStatus(row))).length;
    document.getElementById("calendarUpcomingTitle").textContent = `Appointments on ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${calendarSelectedDate}T12:00:00`))}`;
    document.getElementById("calendarAgendaList").innerHTML = dayAppointments.length ? dayAppointments.map(row => {
      const state = normalizedStatus(row).replace(/[^a-z]+/g, "-");
      const label = normalizedStatus(row) === "requested" ? "Pending" : row.status || "Pending";
      return `<article class="calendar-agenda-item status-${esc(state)}"><span class="agenda-time">${esc(timeText(row.time))}</span><span class="agenda-patient"><strong>${esc(row.patient || "Patient")}</strong><small>${esc(row.specialty || "Appointment")}</small></span><span class="agenda-status">${esc(label)}</span></article>`;
    }).join("") : `<div class="calendar-agenda-empty"><strong>No appointments on this day</strong><small>Choose another date in the calendar.</small></div>`;
    if (calendarView === "year") {
      document.getElementById("calendarMonthLabel").textContent = `${year} Year Overview`;
      grid.classList.add("is-year-view");
      grid.classList.remove("is-day-view", "is-week-view");
      grid.style.removeProperty("--calendar-columns");
      const weekDays = ["S", "M", "T", "W", "T", "F", "S"];
      grid.innerHTML = Array.from({ length: 12 }, (_, monthIndex) => {
        const firstDay = new Date(year, monthIndex, 1).getDay();
        const dayCount = new Date(year, monthIndex + 1, 0).getDate();
        const name = new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(year, monthIndex, 1));
        const blanks = Array.from({ length: firstDay }, () => `<span class="year-day is-empty" aria-hidden="true"></span>`).join("");
        const days = Array.from({ length: dayCount }, (_, dayIndex) => {
          const date = new Date(year, monthIndex, dayIndex + 1, 12);
          const key = localDate(date);
          const eventCount = (appointmentsByDate.get(key) || []).length;
          return `<button type="button" class="year-day ${key === todayKey ? "is-today" : ""} ${key === calendarSelectedDate ? "is-selected" : ""} ${eventCount ? "has-events" : ""}" data-calendar-date="${key}" aria-label="${esc(date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}" aria-pressed="${key === calendarSelectedDate}">${dayIndex + 1}${eventCount ? `<i aria-label="${eventCount} appointments"></i>` : ""}</button>`;
        }).join("");
        return `<section class="calendar-month-card month-tone-${monthIndex % 6} ${monthIndex === month ? "is-selected-month" : ""}"><h3><span aria-hidden="true">▦</span>${esc(name)}</h3><div class="year-weekdays" aria-hidden="true">${weekDays.map(day => `<span>${day}</span>`).join("")}</div><div class="year-month-days">${blanks}${days}</div></section>`;
      }).join("");
      return;
    }
    grid.classList.remove("is-year-view");
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const selected = new Date(`${calendarSelectedDate}T12:00:00`);
    let firstDate;
    let cellCount;
    if (calendarView === "day") {
      firstDate = selected;
      cellCount = 1;
    } else if (calendarView === "week") {
      firstDate = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - selected.getDay(), 12);
      cellCount = 7;
    } else {
      const firstDayOffset = new Date(year, month, 1).getDay();
      firstDate = new Date(year, month, 1 - firstDayOffset, 12);
      const monthDays = new Date(year, month + 1, 0).getDate();
      cellCount = Math.ceil((firstDayOffset + monthDays) / 7) * 7;
    }
    document.getElementById("calendarMonthLabel").textContent = calendarView === "month" ? monthLabel : calendarView === "week"
      ? `${dateText(localDate(firstDate))} – ${dateText(localDate(new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + 6, 12)))}`
      : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(selected);
    const headerCount = calendarView === "month" ? 7 : cellCount;
    const headers = Array.from({ length: headerCount }, (_, index) => {
      const date = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + index, 12);
      return `<div class="calendar-weekday" role="columnheader"><span>${weekdays[date.getDay()]}</span><small>${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div>`;
    }).join("");
    grid.style.setProperty("--calendar-columns", calendarView === "day" ? 1 : 7);
    grid.classList.toggle("is-day-view", calendarView === "day");
    grid.classList.toggle("is-week-view", calendarView === "week");
    const cells = Array.from({ length: cellCount }, (_, index) => {
      const date = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + index, 12);
      const dayNumber = date.getDate();
      const inMonth = date.getMonth() === month;
      const dateKey = localDate(date);
      const rows = (appointmentsByDate.get(dateKey) || []).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
      const events = rows.slice(0, 2).map(row => {
        const state = String(row.status || "Requested").toLowerCase().replace(/[^a-z]+/g, "-");
        return `<article class="calendar-event status-${esc(state)}" title="${esc(`${timeText(row.time)} · ${row.patient || "Patient"} · ${row.status || "Pending"}`)}"><time>${esc(timeText(row.time))}</time><strong>${esc(row.patient || "Patient")}</strong><small>${esc(row.status === "Requested" ? "Pending" : row.status || "Pending")}</small></article>`;
      }).join("");
      const more = rows.length > 2 ? `<span class="calendar-more">+${rows.length - 2} more appointment${rows.length === 3 ? "" : "s"}</span>` : "";
      const dayCount = rows.length ? `<span class="calendar-day-count">${rows.length}</span>` : "";
      return `<div class="calendar-day ${inMonth || calendarView !== "month" ? "" : "is-outside"} ${dateKey === todayKey ? "is-today" : ""} ${dateKey === calendarSelectedDate ? "is-selected" : ""} ${rows.length ? "has-events" : ""}" role="gridcell" tabindex="0" data-calendar-date="${dateKey}" aria-selected="${dateKey === calendarSelectedDate}" aria-label="${esc(date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}"><div class="calendar-day-heading"><span class="calendar-day-number">${dayNumber}</span>${dayCount}</div><div class="calendar-day-events">${events}${more}</div></div>`;
    }).join("");
    grid.innerHTML = headers + cells;
    const selectedRows = (appointmentsByDate.get(calendarSelectedDate) || []).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    document.getElementById("calendarAgendaTitle").textContent = calendarSelectedDate === todayKey ? "Today's appointments" : "Selected day";
    document.getElementById("calendarAgendaDate").textContent = new Date(`${calendarSelectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    document.getElementById("calendarAgendaCount").textContent = selectedRows.length;
    document.getElementById("calendarAgendaList").innerHTML = selectedRows.length ? selectedRows.map(row => {
      const state = normalizedStatus(row).replace(/[^a-z]+/g, "-");
      const label = row.status === "Requested" ? "Pending" : row.status || "Pending";
      return `<article class="calendar-agenda-item status-${esc(state)}"><span class="agenda-time">${esc(timeText(row.time))}</span><span class="agenda-patient"><strong>${esc(row.patient || "Patient")}</strong><small>${esc(row.specialty || "Appointment")}</small></span><span class="agenda-status">${esc(label)}</span></article>`;
    }).join("") : `<div class="calendar-agenda-empty"><span aria-hidden="true">▦</span><strong>No appointments on this day</strong><small>Choose another date in the calendar.</small></div>`;
  }

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
  function holidayRangeText(start, end) {
    if (start === end) return dateText(start);
    const from = new Date(`${start}T12:00:00`);
    const to = new Date(`${end}T12:00:00`);
    const fromMonth = from.toLocaleDateString(undefined, { month: "short" });
    const toMonth = to.toLocaleDateString(undefined, { month: "short" });
    const fromYear = from.getFullYear();
    const toYear = to.getFullYear();
    if (fromYear === toYear && fromMonth === toMonth) return `${fromMonth} ${from.getDate()}–${to.getDate()}, ${fromYear}`;
    if (fromYear === toYear) return `${fromMonth} ${from.getDate()}–${toMonth} ${to.getDate()}, ${fromYear}`;
    return `${dateText(start)} – ${dateText(end)}`;
  }
  function groupedHolidays(items) {
    const groups = [];
    [...(items || [])].filter(item => item?.date).sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
      const last = groups[groups.length - 1];
      if (last && last.note === (item.note || "")) {
        const nextDate = new Date(`${last.end}T12:00:00`);
        nextDate.setDate(nextDate.getDate() + 1);
        const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
        if (next === item.date) { last.end = item.date; return; }
      }
      groups.push({ start: item.date, end: item.date, note: item.note || "" });
    });
    return groups;
  }
  function updateBreakIndicator() {
    const start = document.getElementById("breakStart").value;
    const end = document.getElementById("breakEnd").value;
    let indicator = document.getElementById("breakStatus");
    if (!indicator) {
      indicator = document.createElement("p");
      indicator.id = "breakStatus";
      indicator.className = "break-status";
      document.querySelector(".break-fields")?.append(indicator);
    }
    if (!start && !end) {
      const hasSavedBreak = savedBreak.start && savedBreak.end;
      indicator.textContent = hasSavedBreak ? "Preview: no break time. Save schedule to remove the saved break." : "No break set. Enter both times to block a break.";
      indicator.classList.toggle("is-saved", !hasSavedBreak);
      return;
    }
    if (!start || !end) {
      indicator.textContent = "Choose both start and end times to set the break.";
      indicator.classList.remove("is-saved");
      return;
    }
    if (start >= end) {
      indicator.textContent = "The break end time must be later than the start time.";
      indicator.classList.remove("is-saved");
      return;
    }
    const isSaved = start === savedBreak.start && end === savedBreak.end;
    indicator.textContent = `${isSaved ? "Break saved" : "Break preview"}: ${timeText(start)}–${timeText(end)}${isSaved ? ". Booking slots during this time are blocked." : ". Save schedule to apply."}`;
    indicator.classList.toggle("is-saved", isSaved);
  }
  function renderSchedule() {
    document.getElementById("weekdays").innerHTML = days.map((day, index) => { const enabled = schedule.days.includes(index); return `<label class="weekday ${enabled ? "" : "off"}"><input type="checkbox" data-day="${index}" ${enabled ? "checked" : ""}><span>${day}</span><input type="time" data-day-start="${index}" value="${esc(schedule.dayHours?.[index]?.start || schedule.start)}" ${enabled ? "" : "disabled"}><input type="time" data-day-end="${index}" value="${esc(schedule.dayHours?.[index]?.end || schedule.end)}" ${enabled ? "" : "disabled"}></label>`; }).join("");
    document.getElementById("startTime").value = schedule.start;
    document.getElementById("endTime").value = schedule.end;
    document.getElementById("duration").value = String(schedule.duration || 30);
    document.getElementById("breakStart").value = schedule.breakStart || "";
    document.getElementById("breakEnd").value = schedule.breakEnd || "";
    updateBreakIndicator();
    document.getElementById("holidayList").innerHTML = groupedHolidays(schedule.holidays).map(group => `<div class="holiday-row"><span>${esc(holidayRangeText(group.start, group.end))}<small>${esc(group.note || "Unavailable")}</small></span><button class="remove-holiday" data-holiday-start="${esc(group.start)}" data-holiday-end="${esc(group.end)}">Remove</button></div>`).join("") || `<div class="empty-state">No unavailable dates added.</div>`;
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
    if (clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })())) { savedBreak = { start: schedule.breakStart, end: schedule.breakEnd }; renderSchedule(); showToast("Schedule saved. Booking availability has been updated."); } else showToast("Could not save your schedule in this browser.");
  }
  function renderProfile() {
    const form = document.getElementById("profileForm");
    Object.entries(profile).forEach(([key, value]) => { const input = form.elements.namedItem(key); if (input && input.type !== "file") input.value = value ?? ""; });
    const eligibleEarnings = ownedAppointments().filter(row => row.status === "Completed" && row.commissionStatus !== "Reversed" && row.refundStatus !== "Refunded");
    const commissionFor = row => row.commissionAmount != null ? Number(row.commissionAmount) : Number(row.consultationFee || 0) * Number(row.commissionRate ?? (DOCTOR_COMMISSION_RATE * 100)) / 100;
    const netEarned = eligibleEarnings.reduce((sum, row) => sum + Number(row.doctorNetEarnings != null ? row.doctorNetEarnings : Number(row.consultationFee || 0) - commissionFor(row)), 0);
    const siteCommission = eligibleEarnings.reduce((sum, row) => sum + commissionFor(row), 0);
    document.getElementById("doctorFeeGross").textContent = `JOD ${netEarned.toFixed(2)}`;
    document.getElementById("doctorFeeCommission").textContent = `JOD ${siteCommission.toFixed(2)}`;
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
  function renderAll() { paintIdentity(); renderDashboard(); renderAppointments(); renderPatients(); if (document.querySelector("#page-calendar.active")) renderCalendar(); }
  function showToast(message) { const node = document.getElementById("toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2800); }
  function navigate(page) { document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node.id === `page-${page}`)); document.querySelectorAll(".nav-link").forEach(node => node.classList.toggle("active", node.dataset.page === page)); const active = document.querySelector(`.nav-link[data-page="${page}"]`); document.getElementById("crumb").textContent = active?.textContent.trim() || "Dashboard"; document.getElementById("sidebar").classList.remove("open"); if (page === "appointments") renderAppointments(); if (page === "calendar") renderCalendar(); if (page === "patients") renderPatients(); if (page === "schedule") renderSchedule(); if (page === "profile") renderProfile(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
  document.querySelectorAll("[data-go-appointments]").forEach(button => button.addEventListener("click", () => navigate("appointments")));
  document.querySelectorAll("[data-go-schedule]").forEach(button => button.addEventListener("click", () => navigate("schedule")));
  document.getElementById("menuButton").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("appointmentSearch").addEventListener("input", renderAppointments);
  document.getElementById("calendarPrev").addEventListener("click", () => {
    if (calendarView === "year") { calendarMonth = new Date(calendarMonth.getFullYear() - 1, calendarMonth.getMonth(), 1); calendarSelectedDate = localDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12)); }
    else if (calendarView === "month") { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); calendarSelectedDate = localDate(calendarMonth); }
    else { const selected = new Date(`${calendarSelectedDate}T12:00:00`); selected.setDate(selected.getDate() - (calendarView === "week" ? 7 : 1)); calendarSelectedDate = localDate(selected); calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1); }
    renderCalendar();
  });
  document.getElementById("calendarNext").addEventListener("click", () => {
    if (calendarView === "year") { calendarMonth = new Date(calendarMonth.getFullYear() + 1, calendarMonth.getMonth(), 1); calendarSelectedDate = localDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12)); }
    else if (calendarView === "month") { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); calendarSelectedDate = localDate(calendarMonth); }
    else { const selected = new Date(`${calendarSelectedDate}T12:00:00`); selected.setDate(selected.getDate() + (calendarView === "week" ? 7 : 1)); calendarSelectedDate = localDate(selected); calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1); }
    renderCalendar();
  });
  document.getElementById("calendarToday").addEventListener("click", () => { const now = new Date(); calendarSelectedDate = localDate(now); calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1); renderCalendar(); });
  document.querySelectorAll("[data-calendar-view]").forEach(button => button.addEventListener("click", () => {
    calendarView = button.dataset.calendarView;
    document.querySelectorAll("[data-calendar-view]").forEach(view => view.classList.toggle("is-active", view === button));
    renderCalendar();
  }));
  document.getElementById("doctorCalendar").addEventListener("click", event => {
    const cell = event.target.closest("[data-calendar-date]");
    if (!cell) return;
    calendarSelectedDate = cell.dataset.calendarDate;
    const selected = new Date(`${calendarSelectedDate}T12:00:00`);
    calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    renderCalendar();
  });
  document.getElementById("doctorCalendar").addEventListener("keydown", event => {
    const cell = event.target.closest("[data-calendar-date]");
    if (cell && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); cell.click(); }
  });
  document.getElementById("patientSearch").addEventListener("input", renderPatients);
  document.getElementById("appointmentStatusFilter").addEventListener("change", event => { activeStatus = event.target.value; renderAppointments(); });
  document.getElementById("appointmentRows").addEventListener("click", event => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const row = ownedAppointments().find(item => String(item.id) === button.dataset.id); if (!row) return;
    const status = button.dataset.action;
    if (status === "Rejected") {
      pendingRejectionId = String(row.id);
      document.getElementById("appointmentRejectionPatient").textContent = `For ${row.patient || "this patient"} · ${dateText(row.date)} at ${timeText(row.time)}`;
      document.getElementById("appointmentRejectionReason").value = "";
      document.getElementById("appointmentRejectionFeedback").textContent = "";
      document.getElementById("appointmentRejectionDialog").showModal();
      document.getElementById("appointmentRejectionReason").focus();
      return;
    }
    updateAppointmentStatus(row, status);
  });
  function updateAppointmentStatus(row, status, rejectionReason = "") {
    const changes = { status, lastActionByRole: "Doctor", lastActionById: String(providerId) };
    if (status === "Confirmed" && row.paymentStatus === "Awaiting Doctor Acceptance") {
      changes.paymentStatus = "Pending";
      changes.depositPaymentStatus = "Pending";
      changes.commissionStatus = "Pending Deposit";
    }
    if (status === "Rejected") changes.rejectionReason = rejectionReason;
    if (status === "Completed") changes.commissionStatus = row.paymentStatus === "Paid" && row.balancePaymentStatus === "Paid" ? "Pending Review" : "Not payable — payment or balance unpaid";
    if (["Cancelled", "Rejected"].includes(status)) {
      if (row.paymentStatus === "Awaiting Doctor Acceptance") {
        changes.paymentStatus = "Not Required";
        changes.depositPaymentStatus = "Not Required";
      }
      changes.commissionStatus = ["Pending Review", "Payable", "Settled", "Review required — appointment reopened"].includes(row.commissionStatus) ? "Reversed" : "Not earned";
        if (Number(row.commissionCollected) > 0) changes.commissionReversedAmount = Number(row.commissionCollected);
        changes.commissionCollected = 0;
        changes.commissionRemainingToSettle = 0;
      if (Number(row.depositPaid) > 0) changes.refundStatus = String(row.paymentStatus || "").startsWith("Demo") ? "No refund due" : "Refund review required";
    }
    const updated = Boolean(Object.keys(changes).length && clinic?.updateAppointment(row.id, changes));
    if (updated) renderAll();
    return updated;
  }
  document.querySelectorAll("[data-close-rejection]").forEach(button => button.addEventListener("click", () => document.getElementById("appointmentRejectionDialog").close()));
  document.getElementById("appointmentRejectionForm").addEventListener("submit", event => {
    event.preventDefault();
    const reasonField = document.getElementById("appointmentRejectionReason");
    const reason = reasonField.value.trim();
    const feedback = document.getElementById("appointmentRejectionFeedback");
    if (reason.length < 3) { feedback.textContent = "Please enter a reason with at least 3 characters."; reasonField.focus(); return; }
    const row = ownedAppointments().find(item => String(item.id) === pendingRejectionId);
    if (!row) { feedback.textContent = "This appointment could not be found. Refresh and try again."; return; }
    if (!updateAppointmentStatus(row, "Rejected", reason)) { feedback.textContent = "Could not reject this appointment. Please try again."; return; }
    document.getElementById("appointmentRejectionDialog").close();
    pendingRejectionId = "";
  });
  document.getElementById("patientList").addEventListener("click", event => { const button = event.target.closest("[data-patient]"); if (!button) return; const details = document.getElementById(button.dataset.patient); details.hidden = !details.hidden; button.textContent = details.hidden ? "Details" : "Hide"; });
  document.getElementById("weekdays").addEventListener("change", event => { const day = event.target.dataset.day; if (day === undefined) return; const row = event.target.closest(".weekday"); row.classList.toggle("off", !event.target.checked); row.querySelectorAll("input[type=time]").forEach(input => input.disabled = !event.target.checked); });
  document.getElementById("saveSchedule").addEventListener("click", saveSchedule);
  ["breakStart", "breakEnd"].forEach(id => document.getElementById(id).addEventListener("input", updateBreakIndicator));
  document.getElementById("holidayDate").min = today;
  document.getElementById("holidayEndDate").min = today;
  document.getElementById("holidayDate").addEventListener("change", event => {
    const endDate = document.getElementById("holidayEndDate");
    endDate.min = event.target.value || today;
    if (endDate.value && endDate.value < event.target.value) endDate.value = event.target.value;
  });
  document.getElementById("holidayForm").addEventListener("submit", event => {
    event.preventDefault();
    const startValue = document.getElementById("holidayDate").value;
    const endValue = document.getElementById("holidayEndDate").value || startValue;
    if (!startValue) return showToast("Choose a start date.");
    if (endValue < startValue) return showToast("The end date must be the same as or later than the start date.");
    schedule.holidays ||= [];
    const existingDates = new Set((schedule.holidays || []).map(item => item.date));
    const added = [];
    const cursor = new Date(`${startValue}T12:00:00`);
    const end = new Date(`${endValue}T12:00:00`);
    while (cursor <= end) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (!existingDates.has(date)) added.push({ date, note: document.getElementById("holidayNote").value.trim() });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!added.length) return showToast("Those unavailable dates are already listed.");
    schedule.holidays.push(...added);
    if (!(clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })()))) {
      schedule.holidays = schedule.holidays.filter(item => !added.includes(item));
      return showToast("Could not save unavailable dates.");
    }
    event.currentTarget.reset();
    document.getElementById("holidayDate").min = today;
    document.getElementById("holidayEndDate").min = today;
    renderSchedule();
    showToast(added.length === 1 ? "Unavailable date added." : `${added.length} consecutive unavailable days added.`);
  });
  document.getElementById("holidayList").addEventListener("click", event => {
    const button = event.target.closest("[data-holiday-start]");
    if (!button) return;
    const { holidayStart, holidayEnd } = button.dataset;
    schedule.holidays ||= [];
    const previousHolidays = schedule.holidays.slice();
    schedule.holidays = schedule.holidays.filter(item => item.date < holidayStart || item.date > holidayEnd);
    if (!(clinic?.saveSchedule(schedule, providerId) || (!clinic && (() => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); return true; } catch { return false; } })()))) {
      schedule.holidays = previousHolidays;
      return showToast("Could not update unavailable dates.");
    }
    renderSchedule();
    showToast(holidayStart === holidayEnd ? "Unavailable date removed." : "Unavailable date range removed.");
  });
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  clinic?.subscribe(() => { profile = clinic.getProfile(providerId); schedule = clinic.getSchedule(providerId); renderAll(); if (document.querySelector("#page-schedule.active")) renderSchedule(); if (document.querySelector("#page-profile.active")) renderProfile(); });
  renderAll(); renderSchedule(); renderProfile();
})();
