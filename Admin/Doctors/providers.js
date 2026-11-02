(() => {
  const store = window.CarePlusData;
  const settingsApi = window.CarePlusPharmacy;
  const type = document.body.dataset.providerType;
  if (!store || !settingsApi || !["doctor", "nurse"].includes(type)) return;
  const role = type === "doctor" ? "Doctor" : "Nurse";
  const collection = "users";
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const moneyRate = user => {
    const settings = settingsApi.settings();
    const id = String(user.doctorId || user.nurseId || user.id);
    const map = type === "doctor" ? settings.doctorRates : settings.careProviderRates;
    const fallback = type === "doctor" ? settings.doctorCommissionRate : settings.careCommissionRate;
    return Number(user.commissionRate ?? map?.[id] ?? fallback ?? 0);
  };
  const accountStatus = user => String(user.accountStatus || user.status || "Active");
  const providerId = user => String(user.doctorId || user.nurseId || user.id);
  const archived = user => Boolean(user.archivedAt || user.archived === true);
  let editingId = "";
  const menuToggle = $(".menu-toggle");
  const closeMenu = () => { document.body.classList.remove("sidebar-open"); menuToggle?.setAttribute("aria-expanded", "false"); };
  menuToggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", event => { if (document.body.classList.contains("sidebar-open") && !event.target.closest(".sidebar,.menu-toggle")) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeMenu(); $("[data-provider-dialog]")?.close(); $("[data-details-dialog]")?.close(); } });

  function records() { return store.list(collection).filter(user => String(user.role || "").toLowerCase() === type); }
  function appointmentCount(user) {
    return store.list("appointments").filter(row => String(row.doctorId || "") === providerId(user) || String(row.doctor || "").toLowerCase() === String(user.name || "").toLowerCase()).length;
  }
  function careRequests(user) {
    return store.list("careRequests").filter(row => String(row.assignedNurseId || row.nurseId || "") === providerId(user));
  }
  function unavailableSummary(user) {
    const holidays = window.CarePlusClinic?.getSchedule?.(providerId(user))?.holidays || [];
    const groups = [];
    holidays.filter(item => item?.date).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
      const last = groups[groups.length - 1];
      if (last && last.note === (item.note || "")) {
        const nextDate = new Date(`${last.end}T12:00:00`);
        nextDate.setDate(nextDate.getDate() + 1);
        const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
        if (next === item.date) { last.end = item.date; return; }
      }
      groups.push({ start: item.date, end: item.date, note: item.note || "" });
    });
    const displayDate = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return groups.map(group => `${displayDate(group.start)}${group.start === group.end ? "" : ` – ${displayDate(group.end)}`}${group.note ? ` (${group.note})` : ""}`).join("; ") || "None scheduled";
  }
  function badge(value, kind) {
    const text = String(value || "Pending");
    let cls = "provider-badge";
    if (["active", "verified"].includes(text.toLowerCase())) cls += " is-good";
    else if (["inactive", "archived"].includes(text.toLowerCase())) cls += " is-muted";
    else if (text.toLowerCase() === "rejected") cls += " is-rejected";
    return '<span class="' + cls + '" data-kind="' + kind + '">' + esc(text) + "</span>";
  }
  function activity(user, action) {
    const list = Array.isArray(user.adminActivity) ? user.adminActivity.slice(-39) : [];
    list.push({ action, at: new Date().toISOString(), by: localStorage.getItem("careplusDemoIdentity") || "Admin" });
    return list;
  }
  function requestRejectionReason() {
    const reason = window.prompt("Enter a reason for rejecting this doctor's registration:");
    if (reason === null) return "";
    const trimmed = reason.trim();
    if (!trimmed) window.alert("A rejection reason is required.");
    return trimmed;
  }
  function render() {
    const query = $("[data-provider-search]").value.trim().toLowerCase();
    const selectedAccount = $("[data-account-filter]").value;
    const allDoctors = store.newestFirst(records()).filter(user => !archived(user));
    const total = $("[data-summary-total]");
    const active = $("[data-summary-active]");
    const pending = $("[data-summary-pending]");
    const inactive = $("[data-summary-inactive]");
    const specialties = $("[data-summary-specialties]");
    if (total) total.textContent = allDoctors.length;
    if (active) active.textContent = allDoctors.filter(user => accountStatus(user).toLowerCase() === "active").length;
    if (pending) pending.textContent = allDoctors.filter(user => String(user.verificationStatus || "Pending").toLowerCase() === "pending").length;
    if (inactive) inactive.textContent = allDoctors.filter(user => accountStatus(user).toLowerCase() !== "active").length;
    if (specialties) specialties.textContent = new Set(allDoctors.map(user => String(user.specialty || user.qualifications || "").trim().toLowerCase()).filter(Boolean)).size;
    const list = store.newestFirst(records()).filter(user => {
      const text = [user.id, user.name, user.email, user.phone, user.specialty, user.qualifications].join(" ").toLowerCase();
      const status = archived(user) ? "Archived" : accountStatus(user);
      return text.includes(query)
        && (!selectedAccount || status === selectedAccount);
    });
    $("[data-provider-empty]").hidden = list.length > 0;
    $("[data-provider-rows]").innerHTML = list.map(user => {
      return '<tr class="' + (archived(user) ? "is-archived" : "") + '"><td class="doctor-table-name">' + esc(user.name || "Unnamed") + '</td><td>' + badge(archived(user) ? "Archived" : accountStatus(user), "account") + '</td><td><button type="button" class="cp-table-details-button" data-action="details" data-id="' + esc(user.id) + '">View details</button></td></tr>';
    }).join("");
  }
  function openForm(user = null) {
    editingId = user?.id ? String(user.id) : "";
    const form = $("[data-provider-form]");
    form.reset();
    const passwordField = form.elements.namedItem("password");
    passwordField.required = !user;
    form.elements.namedItem("password").value = "";
    const settings = settingsApi.settings();
    const id = user ? providerId(user) : "";
    const rates = type === "doctor" ? settings.doctorRates : settings.careProviderRates;
    const defaultRate = type === "doctor" ? settings.doctorCommissionRate : settings.careCommissionRate;
    const values = { ...user, commissionRate: user?.commissionRate ?? rates?.[id] ?? defaultRate, status: accountStatus(user || {}), verificationStatus: user?.verificationStatus || "Pending" };
    for (const [key, value] of Object.entries(values)) { const field = form.elements.namedItem(key); if (field && value != null) field.value = value; }
    $("[data-dialog-title]").textContent = user ? "Edit " + role : "Add " + role;
    form.querySelector("[data-form-feedback]").textContent = "";
    $("[data-provider-dialog]").showModal();
  }
  function details(user) {
    const requests = careRequests(user);
    const fields = type === "doctor" ? [
      ["Provider ID", providerId(user)], ["Name", user.name], ["Email", user.email], ["Phone", user.phone], ["Specialty", user.specialty], ["Experience", user.experience ? user.experience + " years" : "Not recorded"], ["Appointments", appointmentCount(user)], ["Rating", user.rating ?? "Not recorded"], ["Account", archived(user) ? "Archived" : accountStatus(user)], ["Time away", unavailableSummary(user)], ...(user.rejectionReason ? [["Rejection reason", user.rejectionReason]] : []), ["CarePlus commission", moneyRate(user) + "%"]
    ] : [
      ["Provider ID", providerId(user)], ["Name", user.name], ["Email", user.email], ["Phone", user.phone], ["Qualifications", user.qualifications], ["Experience", user.experience ? user.experience + " years" : "Not recorded"], ["Assigned requests", requests.length], ["Completed requests", requests.filter(row => String(row.status).toLowerCase() === "completed").length], ["Account", archived(user) ? "Archived" : accountStatus(user)], ["CarePlus commission", moneyRate(user) + "%"]
    ];
    $("[data-details-title]").textContent = user.name || role;
    $("[data-details-grid]").innerHTML = fields.map(([label, value]) => '<div class="provider-detail"><small>' + esc(label) + '</small><strong>' + esc(value || "Not recorded") + "</strong></div>").join("");
    const history = Array.isArray(user.adminActivity) ? user.adminActivity.slice().reverse() : [];
    $("[data-provider-activity]").innerHTML = history.length ? history.map(item => '<small>' + esc(item.action) + " · " + esc(new Date(item.at).toLocaleString()) + " · " + esc(item.by || "Admin") + "</small>").join("") : "<small>No admin activity recorded.</small>";
    const actions = archived(user)
      ? '<button type="button" data-action="restore" data-id="' + esc(user.id) + '">Restore</button>'
      : '<button type="button" data-action="edit" data-id="' + esc(user.id) + '">Edit</button>'
        + (type === "doctor" && String(user.verificationStatus || "Pending") === "Pending" ? '<button type="button" data-action="verify" data-id="' + esc(user.id) + '">Approve</button><button type="button" data-action="reject" data-id="' + esc(user.id) + '">Reject</button>' : "")
        + '<button type="button" class="provider-status-toggle ' + (accountStatus(user) === "Active" ? "is-on" : "") + '" role="switch" aria-checked="' + (accountStatus(user) === "Active") + '" aria-label="Account status: ' + esc(accountStatus(user)) + '" data-action="status" data-id="' + esc(user.id) + '"><span class="provider-status-toggle__track" aria-hidden="true"><span></span></span><span>' + (accountStatus(user) === "Active" ? "Active" : "Inactive") + '</span></button>';
    $("[data-details-actions]").innerHTML = actions;
    $("[data-details-dialog]").showModal();
  }
  function saveRate(id, rate) {
    return type === "doctor" ? settingsApi.saveSettings({ doctorId: id, doctorRate: rate }) : settingsApi.saveSettings({ careProviderId: id, careProviderRate: rate });
  }
  $("[data-provider-search]").addEventListener("input", render);
  $("[data-add-provider]").addEventListener("click", () => openForm());
  $("[data-account-filter]").addEventListener("change", render);
  document.querySelectorAll("[data-dialog-close]").forEach(button => button.addEventListener("click", () => $("[data-provider-dialog]").close()));
  $("[data-details-close]").addEventListener("click", () => $("[data-details-dialog]").close());
  $("[data-provider-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const password = String(values.password || "");
    delete values.password;
    values.name = String(values.name || "").trim();
    values.email = String(values.email || "").trim().toLowerCase();
    values.phone = String(values.phone || "").trim();
    values.commissionRate = Number(values.commissionRate);
    values.experience = values.experience === "" ? "" : Number(values.experience);
    values.status = values.accountStatus = String(values.status || "Active");
    if (password && (password.length < 8 || password.length > 128)) { form.querySelector("[data-form-feedback]").textContent = "Password must be between 8 and 128 characters."; return; }
    const duplicate = store.list(collection).some(user => String(user.id) !== editingId && String(user.email || "").trim().toLowerCase() === values.email);
    if (duplicate) { form.querySelector("[data-form-feedback]").textContent = "A provider with this email already exists."; return; }
    const previous = editingId ? store.get(collection, editingId) : null;
    const newId = editingId || globalThis.crypto?.randomUUID?.() || "provider-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    const next = { ...values, id: newId, [type === "doctor" ? "doctorId" : "nurseId"]: previous ? providerId(previous) : newId, role, ...(password && !previous ? { mustChangePassword: true } : {}), updatedAt: new Date().toISOString(), adminActivity: (previous?.adminActivity || []).concat({ action: previous ? "Profile updated" : "Provider added", at: new Date().toISOString(), by: localStorage.getItem("careplusDemoIdentity") || "Admin" }) };
    if (editingId) next.archivedAt = previous.archivedAt || "";
    const saved = editingId ? store.update(collection, editingId, next) : store.create(collection, { ...next, createdAt: new Date().toISOString() });
    if (!saved) { form.querySelector("[data-form-feedback]").textContent = "Could not save this provider in this browser."; return; }
    let credentialSaved = true;
    const auth = window.CarePlusAuth;
    if (password) credentialSaved = Boolean(await auth?.setDemoPassword?.(values.email, password));
    else if (previous && previous.email && previous.email.toLowerCase() !== values.email) credentialSaved = Boolean(auth?.moveDemoPassword?.(previous.email, values.email));
    if (!credentialSaved) {
      if (previous) store.update(collection, editingId, previous);
      else store.remove(collection, saved.id);
      form.querySelector("[data-form-feedback]").textContent = "Could not save sign-in credentials. Please try again.";
      return;
    }
    if (password && previous?.email && previous.email.toLowerCase() !== values.email) auth.removeDemoPassword?.(previous.email);
    const rateResult = saveRate(saved.id, values.commissionRate);
    form.elements.namedItem("password").value = "";
    $("[data-provider-dialog]").close();
    render();
    toast(rateResult.ok ? role + " saved." : role + " saved, but the commission rate could not sync.", !rateResult.ok);
  });
  $("[data-provider-rows]").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const user = store.get(collection, button.dataset.id);
    if (!user) return;
    const action = button.dataset.action;
    if (action === "details") { details(user); return; }
    if (action === "edit") { openForm(user); return; }
    const rejectionReason = action === "reject" && type === "doctor" ? requestRejectionReason() : "";
    if (action === "reject" && type === "doctor" && !rejectionReason) return;
    if (action === "archive" && !window.confirm("Archive this " + role.toLowerCase() + "? You can restore the record later.")) return;
    const now = new Date().toISOString();
    let changes = {};
    if (action === "archive") changes = { archived: true, archivedAt: now, adminActivity: activity(user, "Provider archived") };
    if (action === "restore") changes = { archived: false, archivedAt: "", adminActivity: activity(user, "Provider restored") };
    if (action === "verify") changes = { verificationStatus: "Verified", verifiedAt: now, adminActivity: activity(user, "Provider verified") };
    if (action === "reject" && type === "doctor") changes = { verificationStatus: "Rejected", rejectedAt: now, rejectionReason, adminActivity: activity(user, "Provider registration rejected: " + rejectionReason) };
    if (action === "status") { const status = accountStatus(user) === "Active" ? "Inactive" : "Active"; changes = { status, accountStatus: status, adminActivity: activity(user, "Account " + status.toLowerCase()) }; }
    if (store.update(collection, user.id, changes)) { render(); toast("Provider record updated."); }
    else toast("Could not update provider.", true);
  });
  $("[data-details-actions]").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const user = store.get(collection, button.dataset.id);
    if (!user) return;
    const action = button.dataset.action;
    if (action === "edit") {
      $("[data-details-dialog]").close();
      openForm(user);
      return;
    }
    const rejectionReason = action === "reject" && type === "doctor" ? requestRejectionReason() : "";
    if (action === "reject" && type === "doctor" && !rejectionReason) return;
    if (action === "archive" && !window.confirm("Archive this " + role.toLowerCase() + "? You can restore it later.")) return;
    const now = new Date().toISOString();
    let changes = {};
    if (action === "archive") changes = { archived: true, archivedAt: now, adminActivity: activity(user, "Provider archived") };
    if (action === "restore") changes = { archived: false, archivedAt: "", adminActivity: activity(user, "Provider restored") };
    if (action === "verify") changes = { verificationStatus: "Verified", verifiedAt: now, adminActivity: activity(user, "Provider verified") };
    if (action === "reject" && type === "doctor") changes = { verificationStatus: "Rejected", rejectedAt: now, rejectionReason, adminActivity: activity(user, "Provider registration rejected: " + rejectionReason) };
    if (action === "status") {
      const status = accountStatus(user) === "Active" ? "Inactive" : "Active";
      changes = { status, accountStatus: status, adminActivity: activity(user, "Account " + status.toLowerCase()) };
    }
    if (store.update(collection, user.id, changes)) {
      render();
      details(store.get(collection, user.id));
      toast("Provider record updated.");
    } else toast("Could not update provider.", true);
  });
  document.querySelectorAll("[data-provider-dialog],[data-details-dialog]").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
  function toast(message, error = false) { const node = $("[data-provider-toast]"); node.textContent = message; node.classList.toggle("is-error", error); node.classList.add("is-visible"); setTimeout(() => node.classList.remove("is-visible"), 2800); }
  store.subscribe(render);
  window.addEventListener("storage", event => { if (event.key === "careplusCommissionSettingsV1") render(); });
  render();
})();
