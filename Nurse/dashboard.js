(() => {
  const store = window.CarePlusData;
  const auth = window.CarePlusAuth;
  const nurse = auth?.demoNurseAccount?.();
  if (!nurse) {
    window.location.replace(new URL("../log%20in/login.html", document.baseURI).href);
    return;
  }

  const nurseId = String(nurse.nurseId || nurse.id);
  const PROFILE_KEY = `carePlusNurseProfileV1:${nurseId}`;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
  const dateText = value => {
    if (!value) return "Not specified";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const timestamp = item => {
    const day = String(item.date || "");
    const time = String(item.time || "00:00");
    const value = new Date(`${day}T${time.length === 5 ? time : "00:00"}`);
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  };
  const statusName = item => String(item.status || "New");
  const statusClass = status => String(status).toLowerCase().replace(/[^a-z]+/g, "-");
  const isHomeCare = request => !request.service || /home\s*care|elderly\s*care|hospital\s*companion/i.test(String(request.service));
  const isMine = request => String(request.assignedNurseId || request.nurseId || "") === nurseId;
  // Admin-reviewed requests with no nurse assigned are still available for a nurse to claim.
  const isOpen = request => ["new", "pending", "requested", "reviewing", "contacted", "accepted"].includes(statusName(request).toLowerCase());
  const canSeeRequest = request => isHomeCare(request) && (isMine(request) || (!request.assignedNurseId && !request.nurseId && isOpen(request)));
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
  let savedProfile = { ...profile };
  let selectedRequestId = "";
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
    return store.update("careRequests", id, changes);
  }
  function visitLabel(request) { return request.elderlyName || request.client || "Care recipient"; }
  function statusBadge(status) { return `<span class="status ${statusClass(status)}">${esc(status)}</span>`; }
  function actionButton(action, label, id, className = "") {
    return `<button class="action ${className}" type="button" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
  }
  function openRequestDetails(request) {
    $("dialogTitle").textContent = `${visitLabel(request)} · ${request.id}`;
    const fields = [
      ["Service", request.service || "Home care"], ["Requested date", dateText(request.date)], ["Preferred time", request.time || "Not specified"],
      ["Duration", request.duration ? `${request.duration} hours` : "Not specified"], ["City / area", [request.city, request.area].filter(Boolean).join(" · ") || "Not specified"],
      ["Home address", request.address || request.pickupAddress || "Not provided"], ["Family contact", request.client || "Not provided"], ["Contact phone", request.phone || "Not provided"],
      ["Emergency contact", [request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ") || "Not provided"],
      ["Requested support tasks", Array.isArray(request.tasks) && request.tasks.length ? request.tasks.join(", ") : "No tasks selected"],
      ["Additional family information", request.notes || "No additional information provided."], ["Status", statusName(request)]
    ];
    $("dialogBody").innerHTML = `<div class="detail-grid">${fields.map(([label, value], index) => `<div class="detail-item ${index === 5 || index === 9 || index === 10 ? "detail-wide" : ""}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div>`;
    const dialog = $("requestDialog");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
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
    $("dashboardVisits").innerHTML = upcoming.slice().sort((a, b) => timestamp(a) - timestamp(b)).slice(0, 6).map(request => `<article class="appointment-item"><span class="time-block">${esc(request.time || "—")}</span><span class="patient-main"><b>${esc(visitLabel(request))}</b><small>${esc(dateText(request.date))} · ${esc(request.address || request.area || "Address not provided")}</small></span>${statusBadge(statusName(request))}</article>`).join("") || `<div class="empty-state">No upcoming visits have been assigned to you.</div>`;
    const reminders = [];
    if (newRequests.length) reminders.push(["!", `${newRequests.length} new home-care request${newRequests.length === 1 ? "" : "s"} need review.`]);
    if (todayVisits.length) reminders.push(["◷", `You have ${todayVisits.length} visit${todayVisits.length === 1 ? "" : "s"} scheduled for today.`]);
    const inProgress = allVisits.filter(request => statusName(request).toLowerCase() === "in progress");
    if (inProgress.length) reminders.push(["✓", `${inProgress.length} visit${inProgress.length === 1 ? "" : "s"} in progress; add care notes and complete when finished.`]);
    $("notificationsList").innerHTML = reminders.map(([icon, text]) => `<div class="notice"><i>${icon}</i><span>${esc(text)}</span></div>`).join("") || `<div class="empty-state">No new notifications or reminders.</div>`;
    $("notificationCount").textContent = `${newRequests.length + todayVisits.length + inProgress.length} new`;
  }
  function renderRequests() {
    const search = $("requestSearch").value.trim().toLowerCase();
    const status = $("requestStatus").value.toLowerCase();
    const date = $("requestDate").value;
    const rows = requests().filter(request => {
      const query = [request.id, visitLabel(request), request.client, request.service, request.city, request.area, request.address].join(" ").toLowerCase();
      return (!search || query.includes(search)) && (status === "all" || statusName(request).toLowerCase() === status) && (!date || request.date === date);
    }).sort((a, b) => timestamp(a) - timestamp(b));
    $("requestCount").textContent = `${rows.length} request${rows.length === 1 ? "" : "s"}`;
    $("requestRows").innerHTML = rows.map(request => {
      const available = isOpen(request) && (!request.assignedNurseId || isMine(request));
      const actions = `<div class="row-actions">${actionButton("details", "Details", request.id)}${available ? actionButton("accept", "Accept", request.id, "accept") : ""}${available ? actionButton("reject", "Reject", request.id, "reject") : ""}</div>`;
      return `<tr><td><span class="request-main"><b>${esc(visitLabel(request))}</b><small>${esc(request.id)}${request.client ? ` · Family: ${esc(request.client)}` : ""}</small></span></td><td>${esc(request.service || "Home care")}</td><td>${esc(dateText(request.date))}<small>${esc(request.time || "Time not set")}</small></td><td>${request.duration ? `${esc(request.duration)} hours` : "—"}</td><td>${esc([request.area, request.city].filter(Boolean).join(", ") || request.address || "Not provided")}</td><td>${statusBadge(statusName(request))}</td><td>${actions}</td></tr>`;
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
    const rows = assignedVisits().filter(request => {
      const state = statusName(request).toLowerCase();
      const matchesRange = range === "all" || (range === "daily" ? request.date === day : request.date >= weekStart && request.date <= weekEnd);
      const text = [visitLabel(request), request.address, request.area, request.city, request.id].join(" ").toLowerCase();
      return matchesRange && (status === "all" || state === status) && (!query || text.includes(query));
    }).sort((a, b) => timestamp(a) - timestamp(b));
    $("visitRows").innerHTML = rows.map(request => {
      const state = statusName(request).toLowerCase();
      let actions = actionButton("details", "Details", request.id);
      if (state === "accepted") actions += actionButton("start", "Start visit", request.id, "accept");
      if (state === "in progress") actions += actionButton("complete", "Complete", request.id, "accept");
      return `<tr><td><span class="visit-main"><b>${esc(visitLabel(request))}</b><small>${esc(request.id)} · ${esc(request.service || "Home care")}</small></span></td><td>${esc(dateText(request.date))}</td><td>${esc(request.time || "—")}</td><td>${request.duration ? `${esc(request.duration)} hours` : "—"}</td><td>${esc(request.address || [request.area, request.city].filter(Boolean).join(", ") || "Not provided")}</td><td>${statusBadge(statusName(request))}</td><td><div class="row-actions">${actions}</div></td></tr>`;
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
    const groups = patientGroups().filter(items => [visitLabel(items[0]), items[0].client, items[0].phone, items[0].area, items[0].city].join(" ").toLowerCase().includes(query));
    $("patientCards").innerHTML = groups.map(items => {
      const latest = items[0];
      const initials = visitLabel(latest).split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      return `<button class="patient-card ${selectedRequestId === latest.id ? "selected" : ""}" type="button" data-patient-id="${esc(latest.id)}"><span class="patient-avatar">${esc(initials)}</span><span class="patient-info"><b>${esc(visitLabel(latest))}</b><small>${esc(items.length)} assigned visit${items.length === 1 ? "" : "s"} · ${esc(latest.address || latest.area || "Address not provided")}</small></span><span class="details-button">Open</span><span class="patient-history"><strong>Most recent:</strong> ${esc(dateText(latest.date))} · ${esc(statusName(latest))}</span></button>`;
    }).join("");
    $("patientEmpty").hidden = groups.length > 0;
    if (selectedRequestId && assignedVisits().some(request => String(request.id) === selectedRequestId)) renderCareDetail(selectedRequestId);
    else if (groups.length) { selectedRequestId = String(groups[0][0].id); renderCareDetail(selectedRequestId); }
    else $("careDetail").innerHTML = `<div class="care-detail-empty"><span>♡</span><h2>Select an assigned patient</h2><p>Visit-specific care instructions, selected support tasks, notes, and history will appear here.</p></div>`;
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
    $("careDetail").innerHTML = `<article class="care-record"><p class="eyebrow">ASSIGNED VISIT · ${esc(request.id)}</p><h2>${esc(visitLabel(request))}</h2><p class="muted">${esc(request.service || "Home care")} · ${esc(dateText(request.date))} at ${esc(request.time || "time not specified")} · ${request.duration ? `${esc(request.duration)} hours` : "duration not specified"}</p><section class="care-record-section"><h3>Relevant contact &amp; location</h3><p><b>Address:</b> ${esc(request.address || "Not provided")}</p><p><b>Area:</b> ${esc([request.area, request.city].filter(Boolean).join(", ") || "Not provided")}</p><p><b>Family contact:</b> ${esc(request.client || "Not provided")}${request.phone ? ` · ${esc(request.phone)}` : ""}</p><p><b>Emergency contact:</b> ${esc([request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ") || "Not provided")}</p></section><section class="care-record-section"><h3>Special requirements &amp; authorized instructions</h3><p><b>Requirements:</b> ${esc(specialRequirements)}</p><p><b>Authorized instructions:</b> ${esc(authorizedInstructions)}</p><p><b>Additional family information:</b> ${esc(request.notes || "None provided.")}</p></section><section class="care-record-section"><h3>Requested support tasks</h3>${tasks.length ? `<div class="care-task-list">${tasks.map(task => `<label><input type="checkbox" data-care-task="${esc(task)}" ${completed.has(task) ? "checked" : ""}><span>${esc(task)}</span></label>`).join("")}</div>` : `<p>No support tasks were selected in this request.</p>`}</section><section class="care-record-section"><h3>Care notes</h3><textarea id="careNotes" maxlength="1500" placeholder="Record factual care provided during this assigned visit. Do not enter diagnoses.">${esc(request.careNotes || "")}</textarea><p class="muted">Last saved: ${esc(request.careNotesUpdatedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.careNotesUpdatedAt)) : "Not yet saved")}</p><button class="button primary" type="button" data-action="save-notes" data-id="${esc(request.id)}">Save care notes</button></section><section class="care-record-section"><h3>Assigned visit history</h3>${history.length ? history.map(item => `<p>${esc(dateText(item.date))} · ${esc(item.time || "—")} · ${esc(statusName(item))}</p>`).join("") : `<p>No previous assigned visits are recorded.</p>`}</section></article>`;
    document.querySelectorAll(".patient-card").forEach(card => card.classList.toggle("selected", card.dataset.patientId === selectedRequestId));
  }
  function renderProfileForm() {
    const form = $("profileForm");
    Object.entries(profile).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (field) field.value = value || ""; });
    form.elements.namedItem("email").value = nurse.email || profile.email || "";
    setPhotoPreview(profile.photo);
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
  function renderAll() { renderHeader(); renderDashboard(); renderRequests(); renderVisits(); renderPatientCare(); }
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
  $("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  ["requestSearch", "requestStatus", "requestDate"].forEach(id => $(id).addEventListener("input", renderRequests));
  ["requestStatus", "requestDate"].forEach(id => $(id).addEventListener("change", renderRequests));
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
      if (updated) { toast("Request accepted and added to My Visits."); renderAll(); }
    }
    if (button.dataset.action === "reject") {
      const reason = window.prompt("Enter a short reason for rejecting this request:");
      if (!reason || !reason.trim()) { if (reason !== null) toast("A rejection reason is required.", true); return; }
      const updated = updateRequest(request.id, { status: "Rejected", assignedNurseId: nurseId, assignedNurseName: profile.name || nurse.name, rejectionReason: reason.trim(), rejectedAt: new Date().toISOString() });
      if (updated) { toast("Request rejected and the reason was saved."); renderAll(); }
    }
  });
  $("visitRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const request = store.get("careRequests", button.dataset.id); if (!request || !isMine(request)) return;
    if (button.dataset.action === "details") { openRequestDetails(request); return; }
    const state = statusName(request).toLowerCase();
    if (button.dataset.action === "start") {
      if (state !== "accepted") return;
      if (!request.date || !request.time) { toast("This visit needs a scheduled date and time before it can start.", true); return; }
      if (timestamp(request) > Date.now()) { toast("This visit cannot start before its scheduled date and time.", true); return; }
      const now = new Date().toISOString();
      if (updateRequest(request.id, { status: "In Progress", visitStatus: "In Progress", actualStartAt: now, startedAt: now })) { toast("Visit started. Record care notes as you go."); renderAll(); navigate("patient-care"); selectedRequestId = String(request.id); renderPatientCare(); }
    }
    if (button.dataset.action === "complete") {
      if (state !== "in progress") return;
      if (!request.actualStartAt && !request.startedAt) { toast("Record a valid visit start before completing this visit.", true); return; }
      if (!window.confirm("Confirm that this visit has finished and mark it Completed?")) return;
      const end = new Date().toISOString();
      if (updateRequest(request.id, { status: "Completed", visitStatus: "Completed", actualEndAt: end, completedAt: end, completedByNurseId: nurseId })) { toast("Visit marked completed with the actual end time."); renderAll(); }
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
  $("careDetail").addEventListener("click", event => {
    const button = event.target.closest('[data-action="save-notes"]'); if (!button) return;
    const request = store.get("careRequests", button.dataset.id); if (!request || !isMine(request)) return;
    const notes = $("careNotes").value.trim();
    if (!notes) { toast("Add a care note before saving.", true); return; }
    if (updateRequest(request.id, { careNotes: notes, careNotesUpdatedAt: new Date().toISOString() })) { toast("Care notes saved to this assigned visit."); renderPatientCare(); }
  });
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => { const dialog = $("requestDialog"); if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }));
  $("requestDialog").addEventListener("click", event => { if (event.target === $("requestDialog")) $("requestDialog").close?.(); });
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
    profile = changes; savedProfile = { ...changes }; message.textContent = "Profile changes saved."; toast("Profile saved."); renderHeader(); setPhotoPreview(profile.photo);
  });
  $("cancelProfile").addEventListener("click", () => { profile = { ...savedProfile }; renderProfileForm(); $("profileMessage").textContent = "Unsaved changes discarded."; });

  store?.subscribe(renderAll);
  renderProfileForm(); renderAll();
  const section = new URLSearchParams(location.search).get("section");
  if (["dashboard", "requests", "visits", "patient-care", "profile"].includes(section)) navigate(section);
})();
