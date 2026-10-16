const api = window.CarePlusData;
const pharmacyApi = window.CarePlusPharmacy;
let pharmacyId = window.CarePlusAuth?.demoPharmacyId?.();
if (!pharmacyId || !pharmacyApi?.get(pharmacyId)) window.location.replace(new URL("../log%20in/login.html", document.baseURI).href);
const LOW_STOCK_LIMIT = 5;
const EXPIRY_WARNING_DAYS = 90;
let deletingMedicineId = null;
let toastTimer;

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
const inventory = () => pharmacyApi.get(pharmacyId)?.inventory || [];
const pharmacyOrders = () => pharmacyApi.listOrders(pharmacyId).sort((a, b) => new Date(b.placedAt || b.createdAt) - new Date(a.placedAt || a.createdAt));
const fmtDate = value => value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "—";
const fmtDateTime = value => value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
const expiryDays = value => {
  if (!value) return Infinity;
  const date = new Date(`${value}T23:59:59`);
  return Math.ceil((date - new Date()) / 86400000);
};

function toast(message, error = false) {
  const node = byId("toast");
  node.textContent = message;
  node.classList.toggle("error", error);
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2800);
}

function currentPage() { return document.querySelector(".nav-link.active")?.dataset.page || "overview"; }
function navigate(page) {
  const titles = { overview: "Dashboard", medicines: "Manage Medicines", inventory: "Inventory & Expiry", orders: "Orders", profile: "My Profile" };
  document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === page));
  document.querySelectorAll(".view").forEach(view => {
    const active = view.id === `view-${page}`;
    view.classList.toggle("active", active);
    if (active) view.removeAttribute("hidden");
    else view.setAttribute("hidden", "");
    view.style.setProperty("display", active ? "block" : "none", "important");
  });
  const pageTitle = byId("pageTitle");
  if (pageTitle) pageTitle.textContent = titles[page] || "Dashboard";
  if (page === "profile") renderProfile();
  byId("sidebar").classList.remove("open");
  document.querySelector(".app-shell").classList.remove("menu-open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function statusBadge(text, type = "") { return `<span class="status-badge ${type}">${escapeHtml(text)}</span>`; }

function renderHeader() {
  const pharmacy = pharmacyApi.get(pharmacyId);
  if (!pharmacy) return;
  document.querySelectorAll("[data-pharmacy-name]").forEach(node => { node.textContent = pharmacy.name || "My Pharmacy"; });
}

function renderOverview() {
  const medicines = inventory();
  const orders = pharmacyOrders();
  const low = medicines.filter(item => Number(item.quantity) > 0 && Number(item.quantity) <= LOW_STOCK_LIMIT);
  const out = medicines.filter(item => Number(item.quantity) <= 0);
  const available = medicines.filter(item => item.available !== false && Number(item.quantity) > 0 && !pharmacyApi.isExpired(item));
  byId("totalMedicines").textContent = medicines.length;
  byId("availableMedicines").textContent = available.length;
  byId("lowMedicines").textContent = low.length;
  byId("outMedicines").textContent = out.length;
  byId("pendingOrders").textContent = orders.filter(order => order.status === "Pending").length;
  const pending = orders.filter(order => order.status === "Pending").length;
  byId("pendingDot").hidden = pending === 0;
  const recent = byId("recentOrders");
  recent.innerHTML = orders.slice(0, 5).map(order => {
    const items = (order.items || []).map(item => `${item.name} × ${item.quantity}`).join(", ");
    return `<article class="recent-order"><div><b>${escapeHtml(order.customerReference || "Customer")}</b><small>${escapeHtml(order.reference || order.id)}</small></div><div><b>${escapeHtml(items || "Medicine order")}</b><small>${fmtDateTime(order.placedAt || order.createdAt)}</small></div><div class="money">${money(order.total)}</div></article>`;
  }).join("") || `<div class="empty-state">No orders yet. New customer orders will appear here.</div>`;
  const alerts = medicines.map(item => {
    const count = Number(item.quantity) || 0;
    const days = expiryDays(item.expiry);
    if (count === 0) return { item, message: "Out of stock", type: "out", priority: 0 };
    if (count <= LOW_STOCK_LIMIT) return { item, message: `Only ${count} left`, type: "", priority: 1 };
    if (days < 0) return { item, message: "Past expiry date", type: "out", priority: 0 };
    if (days <= EXPIRY_WARNING_DAYS) return { item, message: `Expires in ${days} days`, type: "", priority: 2 };
    return null;
  }).filter(Boolean).sort((a, b) => a.priority - b.priority).slice(0, 6);
  byId("alertCount").textContent = alerts.length;
  byId("stockAlerts").innerHTML = alerts.map(alert => `<div class="stock-alert-row"><i class="alert-dot ${alert.type}"></i><div><b>${escapeHtml(alert.item.name)}</b><small>${alert.message} · Expiry ${fmtDate(alert.item.expiry)}</small></div></div>`).join("") || `<div class="empty-state">All stock levels and expiry dates look good.</div>`;
}

function refreshCategories() {
  const select = byId("categoryFilter");
  const selected = select.value;
  const categories = [...new Set(inventory().map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">All categories</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  select.value = categories.includes(selected) ? selected : "";
}

function renderMedicines() {
  refreshCategories();
  const query = byId("medicineSearch").value.trim().toLowerCase();
  const category = byId("categoryFilter").value;
  const rows = inventory().filter(item => (!query || `${item.name} ${item.category}`.toLowerCase().includes(query)) && (!category || item.category === category));
  byId("medicineRows").innerHTML = rows.map(item => {
    const qty = Number(item.quantity) || 0;
    const expired = pharmacyApi.isExpired(item);
    const status = expired ? "Expired" : qty <= 0 ? "Out of stock" : item.available === false ? "Unavailable" : qty <= LOW_STOCK_LIMIT ? "Low stock" : "Available";
    const statusClass = expired || qty <= 0 || item.available === false ? "out" : qty <= LOW_STOCK_LIMIT ? "low" : "";
    return `<tr><td class="medicine-name"><b>${escapeHtml(item.name)}</b>${item.source === "demo-seed" ? "<small>Sample preview</small>" : ""}</td><td>${escapeHtml(item.category)}</td><td>${money(item.price)}</td><td>${qty}</td><td>${fmtDate(item.expiry)}</td><td>${statusBadge(status, statusClass)}</td><td><div class="row-actions"><button class="action-button" data-edit-medicine="${escapeHtml(item.id)}">Edit</button><button class="action-button delete" data-delete-medicine="${escapeHtml(item.id)}">Delete</button></div></td></tr>`;
  }).join("");
  byId("medicineEmpty").hidden = rows.length !== 0;
}

function expiryBadge(item) {
  const days = expiryDays(item.expiry);
  if (days < 0) return statusBadge("Expired", "expired");
  if (days <= EXPIRY_WARNING_DAYS) return statusBadge(days === 0 ? "Expires today" : `${days} days`, "expiry-soon");
  return statusBadge("In date");
}

function renderInventory() {
  const medicines = inventory();
  const low = medicines.filter(item => Number(item.quantity) > 0 && Number(item.quantity) <= LOW_STOCK_LIMIT).length;
  const out = medicines.filter(item => Number(item.quantity) <= 0).length;
  const expiring = medicines.filter(item => expiryDays(item.expiry) <= EXPIRY_WARNING_DAYS).length;
  byId("inventorySummary").textContent = `${medicines.length} items · ${low + out} stock alerts · ${expiring} expiry alerts`;
  const alerts = [];
  if (out) alerts.push(`<span class="inventory-alert critical">${out} item(s) are out of stock</span>`);
  if (low) alerts.push(`<span class="inventory-alert">${low} item(s) have low stock</span>`);
  if (expiring) alerts.push(`<span class="inventory-alert ${medicines.some(item => expiryDays(item.expiry) < 0) ? "critical" : ""}">${expiring} item(s) are expired or expiring within 90 days</span>`);
  byId("inventoryAlerts").innerHTML = alerts.join("");
  byId("inventoryRows").innerHTML = medicines.map(item => {
    const qty = Number(item.quantity) || 0;
    const stock = qty <= 0 ? statusBadge("Out of stock", "out") : qty <= LOW_STOCK_LIMIT ? statusBadge("Low stock", "low") : statusBadge("In stock");
    return `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${escapeHtml(item.category)}</td><td><strong>${qty}</strong> units</td><td>${fmtDate(item.expiry)}</td><td>${stock}</td><td>${expiryBadge(item)}</td><td><form class="stock-editor" data-stock-form="${escapeHtml(item.id)}"><input aria-label="Stock quantity for ${escapeHtml(item.name)}" type="number" min="0" step="1" value="${qty}"><button type="submit">Save</button></form></td></tr>`;
  }).join("");
}

function renderOrders() {
  const query = byId("orderSearch").value.trim().toLowerCase();
  const status = byId("orderStatusFilter").value;
  const orders = pharmacyOrders();
  const rows = orders.filter(order => {
    const text = `${order.reference || order.id} ${order.customerReference || ""} ${(order.items || []).map(item => item.name).join(" ")}`.toLowerCase();
    return (!query || text.includes(query)) && (!status || order.status === status);
  });
  byId("orderCount").textContent = `${rows.length} ${rows.length === 1 ? "order" : "orders"}`;
  byId("orderRows").innerHTML = rows.map(order => {
    const statusClass = order.status === "Pending" ? "pending" : order.status === "Cancelled" ? "rejected" : ["Delivered", "Completed"].includes(order.status) ? "completed" : "accepted";
    const medicines = (order.items || []).map(item => `${escapeHtml(item.name)} × ${Number(item.quantity) || 0}`).join("<br>");
    const action = order.status === "Pending" ? `<button class="action-button accept" data-order-action="Confirmed" data-order-id="${escapeHtml(order.id)}">Confirm</button><button class="action-button reject" data-order-action="Cancelled" data-order-id="${escapeHtml(order.id)}">Cancel</button>`
      : order.status === "Confirmed" ? `<button class="action-button accept" data-order-action="Preparing for Delivery" data-order-id="${escapeHtml(order.id)}">Prepare</button><button class="action-button reject" data-order-action="Cancelled" data-order-id="${escapeHtml(order.id)}">Cancel</button>`
      : order.status === "Preparing for Delivery" ? `<button class="action-button accept" data-order-action="Out for Delivery" data-order-id="${escapeHtml(order.id)}">Dispatch</button><button class="action-button reject" data-order-action="Cancelled" data-order-id="${escapeHtml(order.id)}">Cancel</button>`
      : order.status === "Out for Delivery" ? `<a class="action-button accept" href="manage-order.html?orderId=${encodeURIComponent(order.id)}">Track delivery</a>` : "—";
    const commissionLabel = order.commissionStatus || "Not Eligible";
    const demoPaymentNote = order.paymentDemoResult === "simulated-success" ? "<small>Demo payment simulated · not verified</small>" : "";
    return `<tr><td><b>${escapeHtml(order.reference || order.id)}</b>${order.demo ? "<small>Sample preview</small>" : ""}</td><td>${escapeHtml(order.customerReference || "Customer")}</td><td>${medicines || "—"}</td><td>${fmtDateTime(order.placedAt || order.createdAt)}</td><td><b>${money(order.total)}</b></td><td>${statusBadge(order.paymentStatus || "Pending", order.paymentStatus === "Paid" ? "accepted" : order.paymentStatus === "Refunded" || order.paymentStatus === "Failed" ? "out" : "pending")}${demoPaymentNote}</td><td>${statusBadge(order.status, statusClass)}</td><td><b>${Number(order.commissionRate || 0)}%</b><small>${money(order.commissionAmount || 0)} · ${escapeHtml(commissionLabel)}</small></td><td><div class="row-actions">${action}</div></td></tr>`;
  }).join("");
  byId("orderRows").querySelectorAll("tr").forEach((row, index) => {
    const order = rows[index];
    if (!order) return;
    const link = document.createElement("a");
    link.className = "action-button accept";
    link.href = `manage-order.html?orderId=${encodeURIComponent(order.id)}`;
    link.textContent = ["Delivered", "Completed", "Cancelled"].includes(order.status) ? "View delivery" : "Manage delivery";
    row.querySelector(".row-actions").replaceChildren(link);
  });
  byId("orderEmpty").hidden = rows.length !== 0;
}

function renderProfile() {
  const pharmacy = pharmacyApi.get(pharmacyId);
  const profileForm = byId("profileForm");
  const loadMessage = byId("profileLoadMessage");
  if (!pharmacy) {
    if (profileForm) profileForm.hidden = true;
    if (loadMessage) { loadMessage.hidden = false; loadMessage.textContent = "Pharmacy profile details are unavailable for this account. Please contact the CarePlus administrator."; }
    return;
  }
  if (profileForm) profileForm.hidden = false;
  if (loadMessage) loadMessage.hidden = true;
  const profileDate = value => {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const pharmacist = window.CarePlusAuth?.demoPharmacyAccount?.();
  byId("accountName").value = pharmacist?.name || "";
  byId("accountEmail").value = pharmacist?.email || pharmacy.email || "";
  byId("accountPhone").value = pharmacist?.phone || "";
  byId("profileName").value = pharmacy.name || "";
  byId("profilePhone").value = pharmacy.phone || "";
  byId("profileAddress").value = pharmacy.address || "";
  byId("profileArea").value = pharmacy.area || "";
  byId("profileLocation").value = pharmacy.location || pharmacy.area || "";
  byId("profileHours").value = pharmacy.openingHours || pharmacy.hours || "";
  byId("profileDistance").value = pharmacy.distance || "";
  byId("profileEmail").value = pharmacist?.email || pharmacy.email || "";
  byId("profileDescription").value = pharmacy.description || "";
  byId("profileResponsible").value = pharmacy.responsiblePharmacist || "";
  byId("profileLicense").value = pharmacy.licenseNumber || "";
  byId("profileEmergency").checked = pharmacy.emergencyAvailable === true;
  byId("profileCreatedAt").textContent = profileDate(pharmacy.createdAt);
  byId("profileUpdatedAt").textContent = profileDate(pharmacy.updatedAt);
  byId("openToggle").checked = pharmacy.open !== false;
  byId("openLabel").textContent = pharmacy.open === false ? "Closed" : "Open";
}

function renderAll() {
  renderHeader();
  renderOverview();
  renderMedicines();
  renderInventory();
  renderOrders();
  renderProfile();
}

function openMedicineDialog(medicine = null) {
  byId("medicineForm").reset();
  byId("medicineMessage").textContent = "";
  byId("medicineMessage").classList.remove("error");
  byId("medicineDialogTitle").textContent = medicine ? "Edit medicine" : "Add medicine";
  byId("medicineId").value = medicine?.id || "";
  byId("medicineName").value = medicine?.name || "";
  byId("medicineCategory").value = medicine?.category || "";
  byId("medicinePrice").value = medicine?.price ?? "";
  byId("medicineQuantity").value = medicine?.quantity ?? 0;
  byId("medicineExpiry").value = medicine?.expiry || "";
  byId("medicineAvailable").checked = medicine ? medicine.listed !== false : true;
  const dialog = byId("medicineDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else { dialog.setAttribute("open", ""); dialog.classList.add("fallback-open"); }
  byId("medicineName").focus();
}
function closeMedicineDialog() {
  const dialog = byId("medicineDialog");
  if (typeof dialog.close === "function") dialog.close();
  else { dialog.removeAttribute("open"); dialog.classList.remove("fallback-open"); }
  if (location.hash === "#medicineDialog") history.replaceState(null, "", `${location.pathname}${location.search}`);
}
// Inline fallback lets the add action remain reachable if an older browser does not support <dialog>.
window.openCarePlusMedicineForm = () => openMedicineDialog();

document.querySelectorAll("button.nav-link[data-page]").forEach(link => link.addEventListener("click", () => navigate(link.dataset.page)));
document.querySelectorAll("[data-open-page]").forEach(button => button.addEventListener("click", () => {
  const page = button.dataset.openPage;
  navigate(page);
  if (page === "medicines") openMedicineDialog();
}));
byId("menuToggle").addEventListener("click", () => {
  const open = byId("sidebar").classList.toggle("open");
  document.querySelector(".app-shell").classList.toggle("menu-open", open);
});
byId("medicineSearch").addEventListener("input", renderMedicines);
byId("categoryFilter").addEventListener("change", renderMedicines);
byId("orderSearch").addEventListener("input", renderOrders);
byId("orderStatusFilter").addEventListener("change", renderOrders);
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", closeMedicineDialog));
document.querySelectorAll("[data-close-delete]").forEach(button => button.addEventListener("click", () => byId("deleteDialog").close()));

byId("medicineForm").addEventListener("submit", event => {
  event.preventDefault();
  const message = byId("medicineMessage");
  message.textContent = "";
  message.classList.remove("error");
  const id = byId("medicineId").value || `med-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
  const quantity = Number(byId("medicineQuantity").value);
  const listed = byId("medicineAvailable").checked;
  const medicine = {
    id, name: byId("medicineName").value.trim(), category: byId("medicineCategory").value.trim(),
    price: Number(byId("medicinePrice").value), quantity, expiry: byId("medicineExpiry").value,
    listed, available: listed && quantity > 0
  };
  if (!medicine.name || !medicine.category || !Number.isFinite(medicine.price) || medicine.price <= 0 || !Number.isInteger(quantity) || quantity < 0 || !medicine.expiry) {
    message.textContent = "Enter a name, category, valid price and quantity, and expiry date.";
    message.classList.add("error");
    return;
  }
  if (Number.isNaN(Date.parse(`${medicine.expiry}T23:59:59`))) {
    message.textContent = "Enter a valid expiry date.";
    message.classList.add("error");
    return;
  }
  const current = pharmacyApi.get(pharmacyId);
  if (!current) {
    message.textContent = "This pharmacy account is not linked to a pharmacy record. Please sign in again or contact the administrator.";
    message.classList.add("error");
    return;
  }
  const rows = Array.isArray(current.inventory) ? current.inventory : [];
  const next = rows.some(item => String(item.id) === String(id))
    ? rows.map(item => String(item.id) === String(id) ? { ...item, ...medicine } : item)
    : [...rows, medicine];
  const saved = pharmacyApi.updatePharmacy(pharmacyId, { inventory: next });
  const savedMedicine = saved && pharmacyApi.get(pharmacyId)?.inventory?.find(item => String(item.id) === String(id));
  if (!savedMedicine) {
    message.textContent = "Could not save this medicine. Check browser storage and try again.";
    message.classList.add("error");
    toast("Could not save this medicine.", true);
    return;
  }
  const isUpdate = rows.some(item => String(item.id) === String(id));
  closeMedicineDialog();
  toast(isUpdate
    ? "Medicine updated in your inventory and customer search."
    : savedMedicine.available
      ? "Medicine added and now available in customer search."
      : "Medicine added to inventory; it will appear in customer search when available and in stock.");
  renderAll();
});

byId("medicineRows").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-medicine]");
  if (edit) {
    const medicine = inventory().find(item => String(item.id) === edit.dataset.editMedicine);
    if (medicine) openMedicineDialog(medicine);
    return;
  }
  const remove = event.target.closest("[data-delete-medicine]");
  if (remove) { deletingMedicineId = remove.dataset.deleteMedicine; byId("deleteDialog").showModal(); }
});
byId("confirmDelete").addEventListener("click", event => {
  event.preventDefault();
  const current = pharmacyApi.get(pharmacyId);
  const next = (current.inventory || []).filter(item => String(item.id) !== String(deletingMedicineId));
  if (!pharmacyApi.updatePharmacy(pharmacyId, { inventory: next })) { toast("Could not delete this medicine.", true); return; }
  byId("deleteDialog").close();
  deletingMedicineId = null;
  toast("Medicine deleted.");
  renderAll();
});

byId("inventoryRows").addEventListener("submit", event => {
  const form = event.target.closest("[data-stock-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector("input");
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 0) { toast("Enter a whole stock quantity of zero or more.", true); return; }
  const medicineId = form.dataset.stockForm;
  const current = pharmacyApi.get(pharmacyId);
  const next = current.inventory.map(item => String(item.id) === String(medicineId) ? { ...item, quantity: value, available: value > 0 && item.listed !== false } : item);
  if (!pharmacyApi.updatePharmacy(pharmacyId, { inventory: next })) { toast("Could not update stock.", true); return; }
  toast(value === 0 ? "Stock updated. Medicine is unavailable to customers." : "Stock quantity updated.");
  renderAll();
});

byId("accountEmail").addEventListener("input", () => { byId("profileEmail").value = byId("accountEmail").value; });
byId("profileEmail").addEventListener("input", () => { byId("accountEmail").value = byId("profileEmail").value; });

byId("profileForm").addEventListener("submit", event => {
  event.preventDefault();
  const message = byId("profileMessage");
  message.classList.remove("error");
  const pharmacist = window.CarePlusAuth?.demoPharmacyAccount?.();
  const previousAccountDetails = pharmacist ? { name: pharmacist.name || "", phone: pharmacist.phone || "" } : null;
  const accountChanges = { name: byId("accountName").value.trim(), phone: byId("accountPhone").value.trim() };
  byId("profileEmail").value = byId("accountEmail").value.trim().toLowerCase();
  if (!pharmacist) {
    message.textContent = "Your pharmacist session is no longer active. Sign in again to update your profile.";
    message.classList.add("error");
    return;
  }
  if (!accountChanges.name || accountChanges.phone && accountChanges.phone.replace(/\D/g, "").length < 7) {
    message.textContent = "Enter your name and a valid personal phone number, or leave the phone blank.";
    message.classList.add("error");
    return;
  }
  const changes = {
    name: byId("profileName").value.trim(), phone: byId("profilePhone").value.trim(), address: byId("profileAddress").value.trim(),
    area: byId("profileArea").value.trim(), location: byId("profileLocation").value.trim() || byId("profileArea").value.trim(),
    openingHours: byId("profileHours").value.trim(), hours: byId("profileHours").value.trim(), distance: byId("profileDistance").value.trim() || "Nearby", open: byId("openToggle").checked,
    email: byId("profileEmail").value.trim(), description: byId("profileDescription").value.trim(),
    responsiblePharmacist: byId("profileResponsible").value.trim(), licenseNumber: byId("profileLicense").value.trim(), emergencyAvailable: byId("profileEmergency").checked
  };
  if ([changes.name, changes.phone, changes.address, changes.area, changes.location, changes.openingHours].some(value => !value)) {
    message.textContent = "Complete the pharmacy name, phone, address, area, location, and opening hours.";
    message.classList.add("error");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(changes.email)) {
    message.textContent = "Enter a valid sign-in email address.";
    message.classList.add("error");
    return;
  }
  if (changes.phone.replace(/\D/g, "").length < 7) {
    message.textContent = "Enter a valid pharmacy phone number.";
    message.classList.add("error");
    return;
  }
  const emailResult = window.CarePlusAuth?.updatePharmacyLoginEmail?.(changes.email);
  if (!emailResult?.ok) { message.textContent = emailResult?.error || "Could not update the pharmacy sign-in email."; message.classList.add("error"); return; }
  const updatedAccount = api.update("users", pharmacist.id, accountChanges);
  if (!updatedAccount) {
    if (emailResult.linked && emailResult.previousEmail) window.CarePlusAuth.updatePharmacyLoginEmail(emailResult.previousEmail);
    message.textContent = "Your personal account details could not be saved."; message.classList.add("error"); return;
  }
  if (!pharmacyApi.updatePharmacy(pharmacyId, changes)) {
    api.update("users", pharmacist.id, previousAccountDetails);
    if (emailResult.linked && emailResult.previousEmail) window.CarePlusAuth.updatePharmacyLoginEmail(emailResult.previousEmail);
    message.textContent = "Personal details were saved, but pharmacy listing details could not be saved."; message.classList.add("error"); return;
  }
  message.textContent = "My Profile saved. Pharmacy listing changes are visible to customers.";
  toast("Profile changes saved.");
  renderHeader();
  renderProfile();
});
byId("openToggle").addEventListener("change", () => { byId("openLabel").textContent = byId("openToggle").checked ? "Open" : "Closed"; });
// Refresh all dashboard views when another same-origin page changes the shared browser data.
api.subscribe(renderAll);
renderAll();
const requestedSection = new URLSearchParams(location.search).get("section");
if (["overview", "medicines", "inventory", "orders", "profile"].includes(requestedSection)) navigate(requestedSection);
