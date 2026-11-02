(() => {
  const store = window.CarePlusData;
  const auth = window.CarePlusAuth;
  const nurse = auth?.demoNurseAccount?.();
  if (!nurse) {
    window.location.replace(new URL("../log%20in/login.html", document.baseURI).href);
    return;
  }

  const nurseId = String(nurse.nurseId || nurse.id);
  const REQUEST_NUMBERS_KEY = 'careplusRequestNumbersV1';
  let requestNumbers;
  try {
    const saved = JSON.parse(localStorage.getItem(REQUEST_NUMBERS_KEY) || '{}');
    requestNumbers = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { requestNumbers = {}; }
  function requestLabel(request) {
    const key = String(request.id);
    if (!/^REQ-\d{4,}$/.test(requestNumbers[key] || '')) {
      const highest = Object.values(requestNumbers).reduce((max, value) => /^REQ-\d{4,}$/.test(value) ? Math.max(max, Number(value.slice(4))) : max, 1023);
      requestNumbers[key] = `REQ-${highest + 1}`;
      try { localStorage.setItem(REQUEST_NUMBERS_KEY, JSON.stringify(requestNumbers)); } catch {}
    }
    return requestNumbers[key];
  }
  (store?.list('careRequests') || []).forEach(requestLabel);
  const PROFILE_KEY = `carePlusNurseProfileV1:${nurseId}`;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
  const dateText = value => {
    if (!value) return "Not specified";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const timeText = value => {
    const raw = String(value || "").trim();
    if (!raw) return "Time not set";
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
    if (!match) return raw;
    const hours = Number(match[1]), minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return raw;
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  };
  const requestSchedule = request => `<span class="request-schedule"><span class="request-schedule-date">${esc(dateText(request.date))}</span><span class="request-schedule-time"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(timeText(request.time))}</span></span>`;
  const timestamp = item => {
    const day = String(item.date || "");
    const time = String(item.time || "00:00");
    const value = new Date(`${day}T${time.length === 5 ? time : "00:00"}`);
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  };
  const statusName = item => String(item.status || "New");
  const requestQueueStatus = request => ["new", "reviewing", "contacted"].includes(statusName(request).toLowerCase()) ? "Pending" : statusName(request);
  const statusClass = status => String(status).toLowerCase().replace(/[^a-z]+/g, "-");
  const isHomeCare = request => !request.service || /home\s*care|elderly\s*care|hospital\s*companion/i.test(String(request.service));
  const isHospitalCompanion = request => /hospital\s*companion/i.test(String(request.service || ""));
  const isMine = request => String(request.assignedNurseId || request.nurseId || "") === nurseId;
  // Admin-reviewed requests with no nurse assigned are still available for a nurse to claim.
  const demoDepositPaid = request => request.paymentMode === "demo" && request.demoPaymentStatus === "Succeeded" && String(request.demoTransactionReference || "").startsWith("DEMO-");
  // Only the deposit gates care delivery. The remaining balance is settled outside this flow.
  const depositReady = request => request.depositRate !== 0.1 || demoDepositPaid(request) || (request.paymentStatus === "Paid" && request.paymentVerified === true && Boolean(request.transactionReference));
  const isOpen = request => depositReady(request) && (["new", "pending", "requested", "reviewing", "contacted", "accepted", "confirmed"].includes(statusName(request).toLowerCase()) || (statusName(request).toLowerCase() === "pending payment" && demoDepositPaid(request)));
  const canSeeRequest = request => isHomeCare(request) && (isMine(request) || (!request.assignedNurseId && !request.nurseId && (isOpen(request) || (request.status === "Pending Payment" && demoDepositPaid(request)) || statusName(request).toLowerCase() === "cancelled")));
  const requests = () => (store?.list("careRequests") || []).filter(canSeeRequest);
  const assignedVisits = () => requests().filter(request => isMine(request) && ["accepted", "in progress", "completed", "cancelled"].includes(statusName(request).toLowerCase()));
  const readProfile = () => {
    try { return { ...defaultProfile(), ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") }; }
    catch { return defaultProfile(); }
  };
  const defaultProfile = () => ({
    name: nurse.name || "Nurse",
    photo: nurse.photo || "",
    phone: nurse.phone || "",
    email: nurse.email || "",
    specialty: nurse.specialty || "",
    experience: nurse.experience || "",
    availability: nurse.availability || ""
  });
  let profile = readProfile();
  let selectedRequestId = "";
  let pendingCompletionId = "";
  let pendingRejectId = "";
  let toastTimer;

  function toast(message, error = false) {
    const node = $("toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 3000);
  }
  function updateRequest(id, changes) {
    const request = store.get("careRequests", id);
    if (!request || !canSeeRequest(request)) return null;
    return store.update("careRequests", id, { ...changes, lastActionByRole: "Nurse", lastActionById: nurseId });
  }
  function visitLabel(request) { return request.elderlyName || request.client || "Care recipient"; }
  function statusBadge(status) { return `<span class="status ${statusClass(status)}">${esc(status)}</span>`; }
  function actionButton(action, label, id, className = "") {
    const isDetails = action === "details";
    const content = isDetails ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z"/><circle cx="10" cy="10" r="2"/></svg><span>View details</span>` : esc(label);
    return `<button class="action ${isDetails ? "action-details" : ""} ${className}" type="button" data-action="${action}" data-id="${esc(id)}"${isDetails ? ` aria-label="View details for ${esc(visitLabel(store.get("careRequests", id) || {}))}"` : ""}>${content}</button>`;
  }
  function openRequestDetails(request) {
    const hospital = isHospitalCompanion(request);
    $("dialogTitle").textContent = `${visitLabel(request)} · ${requestLabel(request)}`;
    const fields = [
      ["Service", request.service || "Home care"], ["Requested date", dateText(request.date)], ["Preferred time", request.time || "Not specified"],
      ["Duration", request.duration ? `${request.duration} hours` : "Not specified"], ["City / area", [request.city, request.area].filter(Boolean).join(" · ") || "Not specified"],
      [hospital ? "Pickup location" : "Home address", hospital ? (request.pickupAddress || request.address || "Not provided") : (request.address || "Not provided")],
      ...(hospital ? [
        ["Destination", request.destination || "Not provided"], ["Destination type", request.destinationType || "Not specified"],
        ["Trip arrangement", request.tripOption === "roundtrip" ? "Round trip" : request.tripOption === "oneway" ? "One way" : request.tripOption || "Not specified"],
        ["Wait at appointment", request.waitAppointment || "Not specified"], ["Accompany inside facility", request.insideFacility || "Not specified"],
        ["Transport assistance", request.transportHelp || "Not specified"], ["Mobility / accessibility", request.mobility || "Not specified"]
      ] : [["Schedule", request.schedule || "Not specified"], ["Preferred shift", request.shift || "Not specified"]]),
      ["Family contact", request.client || "Not provided"], ["Contact phone", request.phone || "Not provided"],
      ["Emergency contact", [request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ") || "Not provided"],
      ...(!hospital ? [["Requested support tasks", Array.isArray(request.tasks) && request.tasks.length ? request.tasks.join(", ") : "No tasks selected"]] : []),
      ["Special care requirements", request.specialCareRequirements || request.specialRequirements || "No special care requirements are recorded."],
      ["Authorized care instructions", request.authorizedCareInstructions || request.careInstructions || "No separate authorized care instructions are recorded."],
      ["Additional family information", request.notes || "No additional information provided."], ["Status", statusName(request)],
      ["Deposit payment", demoDepositPaid(request) ? "Paid in demo — no real payment" : request.paymentStatus || "Not recorded"],
      ["Total service price", request.totalPrice != null ? `JOD ${Number(request.totalPrice).toFixed(2)}` : "Not recorded"],
      ["Required deposit (10%)", request.depositAmount != null ? `JOD ${Number(request.depositAmount).toFixed(2)}` : "Not recorded"],
      ["Remaining balance", request.remainingBalance != null ? `JOD ${Number(request.remainingBalance).toFixed(2)}` : "Not recorded"],
      ["Demo payment reference", request.demoTransactionReference || "None"],
      ...(request.rejectionReason ? [["Rejection reason", request.rejectionReason]] : []),
      ...(request.cancelReason ? [["Cancellation reason", request.cancelReason]] : [])
    ];
    const wideFields = new Set(["Pickup location", "Destination", "Requested support tasks", "Special care requirements", "Authorized care instructions", "Additional family information"]);
    $("dialogBody").innerHTML = `<div class="detail-grid">${fields.map(([label, value]) => `<div class="detail-item ${wideFields.has(label) ? "detail-wide" : ""}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div>`;
    const dialog = $("requestDialog");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  function promptCompleteVisit(request) {
    if (!request || !isMine(request) || statusName(request).toLowerCase() !== "in progress") return;
    if (!request.actualStartAt && !request.startedAt) { toast("Record a valid visit start before completing this visit.", true); return; }
    pendingCompletionId = String(request.id);
    $("completionVisitName").textContent = visitLabel(request);
    $("completionVisitService").textContent = request.service || "Home care";
    $("requestDialog").close?.();
    $("completeVisitDialog").showModal();
  }

  function openRejectRequest(request) {
    pendingRejectId = String(request.id);
    $("rejectRequestForm").reset();
    $("rejectRequestFeedback").textContent = "";
    $("rejectRequestDialog").showModal();
    $("rejectRequestReason").focus();
  }

  function renderHeader() {
    const name = profile.name || nurse.name || "Nurse";
    $("welcomeName").textContent = name.split(/\s+/)[0];
  }
  function renderDashboard() {
    const allVisits = assignedVisits();
    const day = today();
    const todayVisits = allVisits.filter(request => request.date === day && ["accepted", "in progress", "completed"].includes(statusName(request).toLowerCase()));
    const newRequests = requests().filter(request => !isMine(request) && isOpen(request));
    const upcoming = allVisits.filter(request => ["accepted", "in progress"].includes(statusName(request).toLowerCase()) && timestamp(request) >= new Date(`${day}T00:00`).getTime() && timestamp(request) < new Date(`${addDays(day, 7)}T00:00`).getTime());
    const completed = allVisits.filter(request => statusName(request).toLowerCase() === "completed");
    const hours = completed.reduce((sum, request) => {
      const plannedDuration = Number.parseFloat(request.duration);
      return Number.isFinite(plannedDuration) && plannedDuration > 0 ? sum + plannedDuration : sum;
    }, 0);
    $("visitsToday").textContent = String(todayVisits.length);
    $("newRequests").textContent = String(newRequests.length);
    $("upcomingVisits").textContent = String(upcoming.length);
    $("completedVisits").textContent = String(completed.length);
    $("workingHours").textContent = hours.toFixed(1);
    $("dashboardVisits").innerHTML = allVisits.slice().sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 3).map(request => `<article class="appointment-item"><span class="time-block">${esc(request.time || "—")}</span><span class="patient-main"><b>${esc(visitLabel(request))}</b><small>${esc(dateText(request.date))} · ${esc(request.address || request.area || "Address not provided")}</small></span>${statusBadge(statusName(request))}</article>`).join("") || `<div class="empty-state">No visits have been assigned to you yet.</div>`;
    const reminders = [];
    if (newRequests.length) reminders.push(["!", `${newRequests.length} new home-care request${newRequests.length === 1 ? "" : "s"} need review.`]);
    if (todayVisits.length) reminders.push(["◷", `You have ${todayVisits.length} visit${todayVisits.length === 1 ? "" : "s"} scheduled for today.`]);
    const inProgress = allVisits.filter(request => statusName(request).toLowerCase() === "in progress");
    if (inProgress.length) reminders.push(["✓", `${inProgress.length} visit${inProgress.length === 1 ? "" : "s"} in progress; complete each visit when finished.`]);
    $("notificationsList").innerHTML = reminders.map(([icon, text]) => `<div class="notice"><i>${icon}</i><span>${esc(text)}</span></div>`).join("") || `<div class="empty-state">No new notifications or reminders.</div>`;
    $("notificationCount").textContent = `${newRequests.length + todayVisits.length + inProgress.length} new`;
  }
  function renderRequests() {
    const search = $("requestSearch").value.trim().toLowerCase();
    const status = $("requestStatus").value.toLowerCase();
    const availableRequests = requests();
    $("requestSummaryTotal").textContent = String(availableRequests.length);
    $("requestSummaryNew").textContent = String(availableRequests.filter(request => !isMine(request) && isOpen(request)).length);
    $("requestSummaryAssigned").textContent = String(availableRequests.filter(isMine).length);
    $("requestSummaryReviewing").textContent = String(availableRequests.filter(request => statusName(request).toLowerCase() === "reviewing").length);
    const rows = store.newestFirst(availableRequests).filter(request => {
      const query = [requestLabel(request), request.id, visitLabel(request), request.client, request.service, request.city, request.area, request.address, request.cancelReason].join(" ").toLowerCase();
      return (!search || query.includes(search)) && (status === "all" || requestQueueStatus(request).toLowerCase() === status);
    });
    $("requestRows").innerHTML = rows.map(request => {
      const available = isOpen(request) && (!request.assignedNurseId || isMine(request));
      const actions = `<div class="row-actions">${actionButton("details", "Details", request.id)}${available ? actionButton("accept", "Accept", request.id, "accept") : ""}${available ? actionButton("reject", "Reject", request.id, "reject") : ""}</div>`;
      return `<tr data-request-id="${esc(request.id)}"><td data-label="Request / elderly person"><span class="request-main"><b>${esc(visitLabel(request))}</b><small>${esc(requestLabel(request))}${request.client ? ` · Family: ${esc(request.client)}` : ""}</small></span></td><td data-label="Service">${esc(request.service || "Home care")}</td><td data-label="Status">${statusBadge(requestQueueStatus(request))}${request.cancelReason ? `<small class="demo-deposit-note">Cancellation reason: ${esc(request.cancelReason)}</small>` : ""}${demoDepositPaid(request) ? '<small class="demo-deposit-note">Deposit paid · DEMO</small>' : ""}</td><td data-label="Actions">${actions}</td></tr>`;
    }).join("");
    $("requestEmpty").hidden = rows.length > 0;
  }
  function addDays(dateString, days) {
    const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function currentWeekBounds() {
    const date = new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const fmt = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return [fmt(start), fmt(end)];
  }
  function renderVisits() {
    const query = $("visitSearch").value.trim().toLowerCase();
    const status = $("visitStatus").value.toLowerCase();
    const range = $("visitRange").value;
    const day = today();
    const [weekStart, weekEnd] = currentWeekBounds();
    const allAssignedVisits = assignedVisits();
    $("visitSummaryTotal").textContent = String(allAssignedVisits.length);
    $("visitSummaryProgress").textContent = String(allAssignedVisits.filter(request => statusName(request).toLowerCase() === "in progress").length);
    $("visitSummaryCompleted").textContent = String(allAssignedVisits.filter(request => statusName(request).toLowerCase() === "completed").length);
    const todayStart = new Date(`${day}T00:00:00`).getTime();
    const nextWeek = new Date(`${addDays(day, 7)}T00:00:00`).getTime();
    $("visitSummaryUpcoming").textContent = String(allAssignedVisits.filter(request => ["accepted", "in progress"].includes(statusName(request).toLowerCase()) && timestamp(request) >= todayStart && timestamp(request) < nextWeek).length);
    const rows = store.newestFirst(allAssignedVisits).filter(request => {
      const state = statusName(request).toLowerCase();
      const matchesRange = range === "all" || (range === "daily" ? request.date === day : request.date >= weekStart && request.date <= weekEnd);
      const text = [visitLabel(request), request.address, request.area, request.city, requestLabel(request), request.id].join(" ").toLowerCase();
      return matchesRange && (status === "all" || state === status) && (!query || text.includes(query));
    });
    $("visitRows").innerHTML = rows.map(request => {
      const state = statusName(request).toLowerCase();
      let actions = actionButton("details", "Details", request.id);
      if (state === "accepted") actions += actionButton("start", "Start visit", request.id, "accept");
      if (state === "in progress") actions += actionButton("complete", "Complete", request.id, "accept");
      return `<tr data-request-id="${esc(request.id)}"><td data-label="Elderly person"><span class="visit-main"><b>${esc(visitLabel(request))}</b><small>${esc(requestLabel(request))} · ${esc(request.service || "Home care")}</small></span></td><td data-label="Status">${statusBadge(statusName(request))}</td><td data-label="Actions"><div class="row-actions">${actions}</div></td></tr>`;
    }).join("");
    $("visitEmpty").hidden = rows.length > 0;
  }
  function patientGroups() {
    const grouped = new Map();
    assignedVisits().forEach(request => {
      const key = String(request.phone || request.elderlyName || request.client || request.id).toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(request);
    });
    return [...grouped.values()].map(items => items.sort((a, b) => timestamp(b) - timestamp(a)));
  }
  function renderPatientCare() {
    const query = $("patientSearch").value.trim().toLowerCase();
    const allGroups = patientGroups();
    const careVisits = assignedVisits();
    const groups = allGroups.filter(items => [visitLabel(items[0]), items[0].client, items[0].phone, items[0].area, items[0].city].join(" ").toLowerCase().includes(query));
    $("patientCards").innerHTML = groups.map(items => {
      const latest = items[0];
      const initials = visitLabel(latest).split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      return `<button class="patient-card ${selectedRequestId === latest.id ? "selected" : ""}" type="button" data-patient-id="${esc(latest.id)}"><span class="patient-avatar">${esc(initials)}</span><span class="patient-info"><b>${esc(visitLabel(latest))}</b><small>${esc(items.length)} assigned visit${items.length === 1 ? "" : "s"} · ${esc(latest.address || latest.area || "Address not provided")}</small></span><span class="details-button">Open</span><span class="patient-history"><strong>Most recent:</strong> ${esc(dateText(latest.date))} · ${esc(statusName(latest))}</span></button>`;
    }).join("");
    $("patientEmpty").hidden = groups.length > 0;
    if (selectedRequestId && assignedVisits().some(request => String(request.id) === selectedRequestId)) renderCareDetail(selectedRequestId);
    else if (groups.length) { selectedRequestId = String(groups[0][0].id); renderCareDetail(selectedRequestId); }
    else $("careDetail").innerHTML = `<div class="care-detail-empty"><span>♡</span><h2>Select an assigned patient</h2><p>Visit-specific care instructions, selected support tasks, and history will appear here.</p></div>`;
  }
  function renderCareDetail(id) {
    const request = assignedVisits().find(item => String(item.id) === String(id));
    if (!request) return;
    selectedRequestId = String(id);
    const completed = new Set(Array.isArray(request.completedTasks) ? request.completedTasks : []);
    const tasks = Array.isArray(request.tasks) ? request.tasks : [];
    const history = assignedVisits().filter(item => visitLabel(item) === visitLabel(request) && item.id !== request.id).sort((a, b) => timestamp(b) - timestamp(a));
    const specialRequirements = request.specialCareRequirements || request.specialRequirements || "No special care requirements are recorded.";
    const authorizedInstructions = request.authorizedCareInstructions || request.careInstructions || "No separate authorized care instructions are recorded.";
    $("careDetail").innerHTML = `<article class="care-record"><p class="eyebrow">ASSIGNED VISIT · ${esc(request.id)}</p><h2>${esc(visitLabel(request))}</h2><p class="muted">${esc(request.service || "Home care")} · ${esc(dateText(request.date))} at ${esc(request.time || "time not specified")} · ${request.duration ? `${esc(request.duration)} hours` : "duration not specified"}</p><section class="care-record-section"><h3>Relevant contact &amp; location</h3><p><b>Address:</b> ${esc(request.address || "Not provided")}</p><p><b>Area:</b> ${esc([request.area, request.city].filter(Boolean).join(", ") || "Not provided")}</p><p><b>Family contact:</b> ${esc(request.client || "Not provided")}${request.phone ? ` · ${esc(request.phone)}` : ""}</p><p><b>Emergency contact:</b> ${esc([request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ") || "Not provided")}</p></section><section class="care-record-section"><h3>Special requirements &amp; authorized instructions</h3><p><b>Requirements:</b> ${esc(specialRequirements)}</p><p><b>Authorized instructions:</b> ${esc(authorizedInstructions)}</p><p><b>Additional family information:</b> ${esc(request.notes || "None provided.")}</p></section><section class="care-record-section"><h3>Requested support tasks</h3>${tasks.length ? `<div class="care-task-list">${tasks.map(task => `<label><input type="checkbox" data-care-task="${esc(task)}" ${completed.has(task) ? "checked" : ""}><span>${esc(task)}</span></label>`).join("")}</div>` : `<p>No support tasks were selected in this request.</p>`}</section><section class="care-record-section"><h3>Assigned visit history</h3>${history.length ? history.map(item => `<p>${esc(dateText(item.date))} · ${esc(item.time || "—")} · ${esc(statusName(item))}</p>`).join("") : `<p>No previous assigned visits are recorded.</p>`}</section></article>`;
    const record = $("careDetail").querySelector(".care-record");
    const careSections = record.querySelectorAll(".care-record-section");
    const makeInfoSection = (title, rows) => {
      const section = document.createElement("section"); section.className = "care-record-section";
      const heading = document.createElement("h3"); heading.textContent = title; section.append(heading);
      rows.forEach(([label, value]) => {
        const line = document.createElement("p"); const name = document.createElement("b");
        name.textContent = `${label}: `; line.append(name, document.createTextNode(value || "Not specified")); section.append(line);
      });
      return section;
    };
    if (isHospitalCompanion(request)) {
      careSections[0].hidden = true;
      careSections[2].hidden = true;
      record.insertBefore(makeInfoSection("Hospital trip & accessibility", [
        ["Pickup location", request.pickupAddress || request.address], ["Destination", request.destination],
        ["Destination type", request.destinationType],
        ["Trip arrangement", request.tripOption === "roundtrip" ? "Round trip" : request.tripOption === "oneway" ? "One way" : request.tripOption],
        ["Wait at appointment", request.waitAppointment], ["Accompany inside facility", request.insideFacility],
        ["Transport assistance", request.transportHelp], ["Mobility / accessibility", request.mobility]
      ]), careSections[1]);
      record.insertBefore(makeInfoSection("Family and emergency contacts", [
        ["Family contact", request.client], ["Phone", request.phone],
        ["Emergency contact", [request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ")]
      ]), careSections[1]);
    } else {
      record.insertBefore(makeInfoSection("Home care schedule", [
        ["Schedule", request.schedule], ["Preferred shift", request.shift]
      ]), careSections[1]);
    }
    document.querySelectorAll(".patient-card").forEach(card => card.classList.toggle("selected", card.dataset.patientId === selectedRequestId));
  }
  function renderNurseEarnings() {
    const completedAndVerified = assignedVisits().filter(request => statusName(request).toLowerCase() === "completed"
      && request.commissionStatus !== "Reversed" && request.refundStatus !== "Refunded");
    const commissionFor = request => request.careCommissionAmount != null
      ? Number(request.careCommissionAmount)
      : Number(request.totalPrice || 0) * Number(request.careCommissionRate ?? 10) / 100;
    const commission = completedAndVerified.reduce((sum, request) => sum + commissionFor(request), 0);
    const nurseShare = completedAndVerified.reduce((sum, request) => sum + Math.max(0, Number(request.totalPrice || 0) - commissionFor(request)), 0);
    const careSettings = window.CarePlusPharmacy?.settings?.() || {};
    const currentRate = Number(careSettings.careProviderRates?.[String(nurseId)] ?? careSettings.careCommissionRate ?? 10);
    const rateLabel = `${Number.isFinite(currentRate) ? currentRate : 10}%`;
    $("nurseLifetimeNet").textContent = `JOD ${nurseShare.toFixed(2)}`;
    $("nurseLifetimeCommission").textContent = `JOD ${commission.toFixed(2)}`;
    $("nurseCommissionHeadingRate").textContent = rateLabel.replace(/%$/, "");
    $("nurseCommissionRate").textContent = rateLabel;
  }
  function renderProfileForm() {
    const form = $("profileForm");
    Object.entries(profile).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (field) field.value = value || ""; });
    form.elements.namedItem("email").value = nurse.email || profile.email || "";
    setPhotoPreview(profile.photo);
    renderNurseEarnings();
  }
  function setPhotoPreview(url) {
    const preview = $("photoPreview");
    preview.replaceChildren();
    if (url) {
      const image = document.createElement("img");
      image.alt = "Nurse profile";
      image.src = url;
      image.onerror = () => { preview.textContent = initials(profile.name); };
      preview.append(image);
    }
    else preview.textContent = initials(profile.name);
  }
  function initials(name) { return String(name || "N").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "N"; }
  function renderAll() { renderHeader(); renderDashboard(); renderRequests(); renderVisits(); renderPatientCare(); renderNurseEarnings(); }
  function navigate(page) {
    document.querySelectorAll(".page").forEach(section => {
      const active = section.id === `page-${page}`;
      section.classList.toggle("active", active);
      section.hidden = !active;
    });
    document.querySelectorAll(".nav-link[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    $("sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".nav-link[data-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
  document.querySelectorAll("[data-open-page]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.openPage)));
  ["requestSearch", "requestStatus"].forEach(id => $(id).addEventListener("input", renderRequests));
  $("requestStatus").addEventListener("change", renderRequests);
  ["visitSearch", "visitStatus", "visitRange"].forEach(id => $(id).addEventListener("input", renderVisits));
  ["visitStatus", "visitRange"].forEach(id => $(id).addEventListener("change", renderVisits));
  $("patientSearch").addEventListener("input", renderPatientCare);
  $("requestRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const request = store.get("careRequests", button.dataset.id); if (!request || !canSeeRequest(request)) return;
    if (button.dataset.action === "details") { openRequestDetails(request); return; }
    if (!isOpen(request) || (request.assignedNurseId && !isMine(request))) return;
    if (button.dataset.action === "accept") {
      const updated = updateRequest(request.id, { status: "Accepted", assignedNurseId: nurseId, assignedNurseName: profile.name || nurse.name, acceptedAt: new Date().toISOString() });
      if (updated) {
        $("visitRange").value = "all";
        $("visitStatus").value = "all";
        $("visitSearch").value = "";
        toast("Request accepted and added to My Visits.");
        renderAll();
        navigate("visits");
      } else {
        toast("The request could not be saved. Please try again.", true);
      }
    }
    if (button.dataset.action === "reject") {
      openRejectRequest(request);
    }
  });
  $("cancelRejectRequest").addEventListener("click", () => { pendingRejectId = ""; $("rejectRequestDialog").close(); });
  $("rejectRequestForm").addEventListener("submit", event => {
    event.preventDefault();
    const reason = $("rejectRequestReason").value.trim();
    const request = store.get("careRequests", pendingRejectId);
    if (reason.length < 3) { $("rejectRequestFeedback").textContent = "Enter a reason with at least 3 characters."; $("rejectRequestReason").focus(); return; }
    if (!request || !canSeeRequest(request) || (!isOpen(request) || (request.assignedNurseId && !isMine(request)))) {
      $("rejectRequestFeedback").textContent = "This request is no longer available. Refresh and try again."; return;
    }
    const updated = updateRequest(request.id, { status: "Rejected", assignedNurseId: nurseId, assignedNurseName: profile.name || nurse.name, rejectionReason: reason, rejectedAt: new Date().toISOString() });
    if (updated) { pendingRejectId = ""; $("rejectRequestDialog").close(); toast("Request rejected; the family and admin can see the reason."); renderAll(); }
    else $("rejectRequestFeedback").textContent = "Could not save the rejection. Please try again.";
  });
  $("visitRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const request = store.get("careRequests", button.dataset.id); if (!request || !isMine(request)) return;
    if (button.dataset.action === "details") { openRequestDetails(request); return; }
    const state = statusName(request).toLowerCase();
    if (button.dataset.action === "start") {
      if (state !== "accepted") return;
      if (!depositReady(request)) { toast("The deposit must be paid before starting this visit.", true); return; }
      if (!request.date || !request.time) { toast("This visit needs a scheduled date and time before it can start.", true); return; }
      if (timestamp(request) > Date.now()) { toast("This visit cannot start before its scheduled date and time.", true); return; }
      const now = new Date().toISOString();
      if (updateRequest(request.id, { status: "In Progress", visitStatus: "In Progress", actualStartAt: now, startedAt: now })) { toast("Visit started."); renderAll(); navigate("patient-care"); selectedRequestId = String(request.id); renderPatientCare(); }
    }
    if (button.dataset.action === "complete") {
      promptCompleteVisit(request);
    }
  });
  $("patientCards").addEventListener("click", event => { const card = event.target.closest("[data-patient-id]"); if (card) renderCareDetail(card.dataset.patientId); });
  $("careDetail").addEventListener("change", event => {
    const checkbox = event.target.closest("[data-care-task]"); if (!checkbox) return;
    const request = store.get("careRequests", selectedRequestId); if (!request || !isMine(request)) return;
    const completed = new Set(Array.isArray(request.completedTasks) ? request.completedTasks : []);
    if (checkbox.checked) completed.add(checkbox.dataset.careTask); else completed.delete(checkbox.dataset.careTask);
    if (updateRequest(request.id, { completedTasks: [...completed] })) toast("Care task updated.");
  });
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => { const dialog = $("requestDialog"); if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }));
  $("requestDialog").addEventListener("click", event => { if (event.target === $("requestDialog")) $("requestDialog").close?.(); });
  $("cancelCompleteVisit").addEventListener("click", () => { pendingCompletionId = ""; $("completeVisitDialog").close(); });
  $("completeVisitDialog").addEventListener("click", event => { if (event.target === $("completeVisitDialog")) { pendingCompletionId = ""; $("completeVisitDialog").close(); } });
  $("confirmCompleteVisit").addEventListener("click", () => {
    const request = store.get("careRequests", pendingCompletionId);
    if (!request || !isMine(request) || statusName(request).toLowerCase() !== "in progress") {
      pendingCompletionId = "";
      $("completeVisitDialog").close();
      toast("This visit can no longer be completed.", true);
      return;
    }
    const end = new Date().toISOString();
    if (updateRequest(request.id, { status: "Completed", visitStatus: "Completed", actualEndAt: end, completedAt: end, completedByNurseId: nurseId })) {
      pendingCompletionId = "";
      $("completeVisitDialog").close();
      toast("Visit marked completed with the actual end time.");
      renderAll();
    }
  });
  $("profileForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget; const message = $("profileMessage"); message.classList.remove("error"); message.textContent = "";
    const changes = Object.fromEntries(new FormData(form).entries());
    changes.name = String(changes.name || "").trim(); changes.phone = String(changes.phone || "").trim(); changes.specialty = String(changes.specialty || "").trim(); changes.availability = String(changes.availability || "").trim(); changes.experience = String(changes.experience || "").trim(); changes.photo = String(changes.photo || "").trim(); changes.email = nurse.email || "";
    if (changes.name.length < 2 || (changes.phone && changes.phone.replace(/\D/g, "").length < 7)) { message.textContent = "Enter your full name and a valid phone number."; message.classList.add("error"); return; }
    if (changes.photo && !/^https?:\/\//i.test(changes.photo)) { message.textContent = "Use a valid http or https image URL, or leave it blank."; message.classList.add("error"); return; }
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(changes)); }
    catch { message.textContent = "The profile could not be saved in browser storage."; message.classList.add("error"); return; }
    store.update("users", nurse.id, { name: changes.name, phone: changes.phone, specialty: changes.specialty });
    profile = changes; message.textContent = "Profile changes saved."; toast("Profile saved."); renderHeader(); setPhotoPreview(profile.photo);
  });

  store?.subscribe(renderAll);
  renderProfileForm(); renderAll();
  const section = new URLSearchParams(location.search).get("section");
  if (["dashboard", "requests", "visits", "patient-care", "profile"].includes(section)) navigate(section);
})();
