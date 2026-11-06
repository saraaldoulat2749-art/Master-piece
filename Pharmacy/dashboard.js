const api = window.CarePlusData;
const pharmacyApi = window.CarePlusPharmacy;
let pharmacyId = window.CarePlusAuth?.demoPharmacyId?.();
if (!pharmacyId || !pharmacyApi?.get(pharmacyId)) window.location.replace(new URL("../log%20in/login.html", document.baseURI).href);
const LOW_STOCK_LIMIT = 5;
const EXPIRY_WARNING_DAYS = 90;
let toastTimer;

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
const inventory = () => api.newestFirst(pharmacyApi.get(pharmacyId)?.inventory || []);
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

function medicineStatus(item) {
  const qty = Number(item.quantity) || 0;
  if (pharmacyApi.isExpired(item)) return "expired";
  if (qty <= 0) return "out";
  if (item.available === false) return "unavailable";
  if (qty <= LOW_STOCK_LIMIT) return "low";
  return "available";
}

function renderMedicines() {
  refreshCategories();
  const query = byId("medicineSearch").value.trim().toLowerCase();
  const category = byId("categoryFilter").value;
  const statusFilter = byId("medicineStatusFilter").value;
  const medicines = inventory();
  byId("manageTotalMedicines").textContent = medicines.length;
  byId("manageAvailableMedicines").textContent = medicines.filter(item => medicineStatus(item) === "available").length;
  byId("manageLowMedicines").textContent = medicines.filter(item => medicineStatus(item) === "low").length;
  byId("manageOutMedicines").textContent = medicines.filter(item => Number(item.quantity) <= 0).length;
  byId("manageUnavailableMedicines").textContent = medicines.filter(item => ["out", "unavailable", "expired"].includes(medicineStatus(item))).length;
  const rows = medicines.filter(item => (!query || `${item.name} ${item.category}`.toLowerCase().includes(query)) && (!category || item.category === category) && (!statusFilter || medicineStatus(item) === statusFilter));
  byId("medicineRows").innerHTML = rows.map(item => {
    const qty = Number(item.quantity) || 0;
    const key = medicineStatus(item);
    const status = { expired: "Expired", out: "Out of stock", unavailable: "Unavailable", low: "Low stock", available: "Available" }[key];
    const statusClass = ["expired", "out", "unavailable"].includes(key) ? "out" : key === "low" ? "low" : "";
    return `<tr><td class="medicine-name"><b>${escapeHtml(item.name)}</b>${item.source === "demo-seed" ? "<small>Sample preview</small>" : ""}</td><td>${escapeHtml(item.category)}</td><td>${statusBadge(status, statusClass)}</td><td><button type="button" class="action-button" data-view-medicine="${escapeHtml(item.id)}" onclick="window.showCarePlusMedicineDetails(this.dataset.viewMedicine)">View Details</button></td></tr>`;
  }).join("");
  byId("medicineEmpty").hidden = rows.length !== 0;
}

async function handleMedicineAction(event) {
  const button = event.currentTarget;
  const medicineId = button.dataset.deleteMedicine;
  const medicine = inventory().find(item => String(item.id) === String(medicineId));
  if (!medicine || !await window.CarePlusDelete.confirm({ kind: "medicine", name: medicine.name, description: "This medicine will be removed from your catalog and availability listing." })) return;
  if (window.CarePlusAuth?.demoPharmacyId?.() !== pharmacyId) return;
  const current = pharmacyApi.get(pharmacyId);
  if (!current) { toast("Pharmacy is no longer available.", true); return; }
  const next = (current.inventory || []).filter(item => String(item.id) !== String(medicineId));
  if (!pharmacyApi.updatePharmacy(pharmacyId, { inventory: next })) { toast("Could not delete this medicine.", true); return; }
  closeMedicineDetails();
  renderAll();
  window.CarePlusDelete.success({ kind: "medicine" });
}

function closeMedicineDetails() {
  const dialog = byId("medicineDetailsDialog");
  dialog.hidden = true;
  document.body.classList.remove("medicine-details-open");
}

function showMedicineDetails(id) {
  navigate("medicines");
  const item = inventory().find(medicine => String(medicine.id) === String(id));
  if (!item) { toast("This medicine could not be found. Refresh the page and try again.", true); return; }
  byId("medicineDetailsTitle").textContent = item.name || "Medicine details";
  const image = item.image ? `<img class="medicine-details-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : "";
  const fields = [
    ["Category", item.category], ["Description", item.description], ["Price", money(item.price)],
    ["Manufacturer", item.manufacturer], ["Quantity", `${Number(item.quantity) || 0} units`],
    ["Expiry date", fmtDate(item.expiry)], ["Status", { expired: "Expired", out: "Out of stock", unavailable: "Unavailable", low: "Low stock", available: "Available" }[medicineStatus(item)]]
  ];
  byId("medicineDetailsBody").innerHTML = `${image}<dl class="medicine-details-grid">${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "Not provided")}</dd></div>`).join("")}</dl>`;
  byId("medicineDetailsDelete").dataset.deleteMedicine = item.id;
  byId("medicineDetailsEdit").dataset.editMedicine = item.id;
  const dialog = byId("medicineDetailsDialog");
  dialog.hidden = false;
  document.body.classList.add("medicine-details-open");
}
window.showCarePlusMedicineDetails = id => {
  try { showMedicineDetails(id); }
  catch (error) { console.error("Could not show medicine details", error); toast("Could not open medicine details. Please try again.", true); }
};

function expiryBadge(item) {
  const days = expiryDays(item.expiry);
  if (days < 0) return statusBadge("Expired", "expired");
  if (days <= EXPIRY_WARNING_DAYS) return statusBadge(days === 0 ? "Expires today" : `${days} days`, "expiry-soon");
  return statusBadge("In date");
}

function renderInventory() {
  const medicines = inventory();
  const query = byId("inventorySearch").value.trim().toLowerCase();
  const statusFilter = byId("inventoryStatusFilter").value;
  const low = medicines.filter(item => Number(item.quantity) > 0 && Number(item.quantity) <= LOW_STOCK_LIMIT).length;
  const out = medicines.filter(item => Number(item.quantity) <= 0).length;
  const expiring = medicines.filter(item => expiryDays(item.expiry) <= EXPIRY_WARNING_DAYS).length;
  byId("inventoryTotalMedicines").textContent = medicines.length;
  byId("inventoryInStock").textContent = medicines.filter(item => Number(item.quantity) > LOW_STOCK_LIMIT && expiryDays(item.expiry) >= 0).length;
  byId("inventoryLowStock").textContent = low;
  byId("inventoryOutOfStock").textContent = out;
  byId("inventoryExpiring").textContent = expiring;
  const rows = medicines.filter(item => {
    const days = expiryDays(item.expiry);
    const qty = Number(item.quantity) || 0;
    const text = `${item.name} ${item.category}`.toLowerCase();
    const state = days < 0 ? "expired" : days <= EXPIRY_WARNING_DAYS ? "expiring" : qty <= 0 ? "out" : qty <= LOW_STOCK_LIMIT ? "low" : "in-stock";
    return (!query || text.includes(query)) && (!statusFilter || statusFilter === state);
  });
  byId("inventoryRows").innerHTML = rows.map(item => {
    const qty = Number(item.quantity) || 0;
    const stock = qty <= 0 ? statusBadge("Out of stock", "out") : qty <= LOW_STOCK_LIMIT ? statusBadge("Low stock", "low") : statusBadge("In stock");
    return `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${escapeHtml(item.category)}</td><td><strong>${qty}</strong> units</td><td>${fmtDate(item.expiry)}</td><td>${stock}</td><td>${expiryBadge(item)}</td><td><form class="stock-editor" data-stock-form="${escapeHtml(item.id)}"><input aria-label="Stock quantity for ${escapeHtml(item.name)}" type="number" min="0" step="1" value="${qty}"><button type="submit">Save</button></form></td></tr>`;
  }).join("");
  byId("inventoryEmpty").hidden = rows.length > 0;
}

function renderOrders() {
  const query = byId("orderSearch").value.trim().toLowerCase();
  const selectedStatus = byId("orderStatusFilter").value;
  const normalize = value => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[value] || value || "Pending");
  const orders = pharmacyOrders();
  byId("ordersTotal").textContent = orders.length;
  byId("ordersPending").textContent = orders.filter(order => normalize(order.status) === "Pending").length;
  byId("ordersInProgress").textContent = orders.filter(order => ["Accepted", "Preparing", "Ready for Pickup"].includes(normalize(order.status))).length;
  byId("ordersDelivered").textContent = orders.filter(order => normalize(order.status) === "Completed").length;
  byId("ordersCancelled").textContent = orders.filter(order => ["Rejected", "Cancelled"].includes(normalize(order.status))).length;
  const rows = orders.filter(order => {
    const searchable = `${order.reference || order.id} ${order.customerName || ""} ${order.customerReference || ""} ${(order.items || []).map(item => item.name).join(" ")}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!selectedStatus || normalize(order.status) === selectedStatus);
  });
  byId("orderRows").innerHTML = rows.map(order => {
    const state = normalize(order.status);
    const badge = state === "Pending" ? "pending" : ["Rejected", "Cancelled"].includes(state) ? "rejected" : state === "Completed" ? "completed" : "accepted";
    return `<tr data-order-id="${escapeHtml(order.id)}"><td><b>${escapeHtml(order.customerName || order.customerReference || "Customer")}</b></td><td>${statusBadge(state, badge)}</td><td><button class="action-button details" data-order-details="${escapeHtml(order.id)}">View details</button></td></tr>`;
  }).join("");
  byId("orderEmpty").hidden = rows.length !== 0;
}

function showPharmacyOrderDetails(id) {
  const order = pharmacyOrders().find(row => String(row.id) === String(id));
  if (!order || String(order.pharmacyId) !== String(pharmacyId)) return;
  const normalize = value => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[value] || value || "Pending");
  const item = order.items?.[0] || {};
  const history = Array.isArray(order.statusHistory) && order.statusHistory.length ? order.statusHistory : [{ status: "Pending", at: order.placedAt, actor: "Customer", note: "Order received" }];
  byId("pharmacyOrderTitle").textContent = order.reference || order.id;
  byId("pharmacyOrderDialog").dataset.orderId = String(order.id);
  byId("pharmacyOrderContent").innerHTML = `<div class="order-detail-grid"><div><small>Customer</small><b>${escapeHtml(order.customerName || order.customerReference || "Customer")}</b></div><div><small>Date</small><b>${fmtDateTime(order.placedAt || order.createdAt)}</b></div><div><small>Customer phone</small><b>${escapeHtml(order.deliveryPhone || "Not provided")}</b></div><div><small>Delivery address</small><b>${escapeHtml(order.deliveryAddress || "Not provided")}</b></div>${(order.items || []).map(line => `<div class="wide-field"><small>Medicine</small><b>${escapeHtml(line.name)} &times; ${Number(line.quantity)} &middot; ${money(line.unitPrice ?? line.price)} each</b></div>`).join("")}<div><small>Total price</small><b>${money(order.total)}</b></div><div><small>Payment status</small><b>${escapeHtml(order.paymentStatus || "Pending")}</b></div><div><small>Order status</small><b>${escapeHtml(normalize(order.status))}</b></div>${order.rejectionReason || order.cancelReason ? `<div class="wide-field"><small>${normalize(order.status) === "Cancelled" ? "Cancellation reason" : "Rejection reason"}</small><b>${escapeHtml(order.rejectionReason || order.cancelReason)}</b></div>` : ""}</div><h3 class="order-history-title">Status history</h3><ol class="order-history">${history.map(entry => `<li><i></i><div><b>${escapeHtml(normalize(entry.status))}</b><small>${fmtDateTime(entry.at || entry.timestamp)} · ${escapeHtml(entry.actor || "CarePlus")}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ""}</small></div></li>`).join("")}</ol>`;
  const currentStatus = normalize(order.status);
  if (currentStatus === "Cancelled") {
    const cancellation = history.slice().reverse().find(entry => normalize(entry.status) === "Cancelled" && entry.actor === "Customer" && entry.reason);
    const reason = order.cancelReason || cancellation?.reason;
    const notice = document.createElement("section");
    notice.className = "order-cancellation-detail";
    const title = document.createElement("h3");
    title.textContent = "Customer cancellation reason";
    const text = document.createElement("p");
    text.textContent = reason || "No cancellation reason was recorded for this order.";
    notice.append(title, text);
    byId("pharmacyOrderContent").prepend(notice);
  }
  const allStatuses = ["Pending", "Accepted", "Rejected", "Preparing", "Ready for Pickup", "Completed"];
  const actions = byId("pharmacyOrderActions");
  if (currentStatus === "Cancelled") {
    actions.innerHTML = `<p class="order-terminal-note">This order was cancelled. Status updates are unavailable.</p>`;
    if (!byId("pharmacyOrderDialog").open) byId("pharmacyOrderDialog").showModal();
    return;
  }
  actions.innerHTML = `<label class="order-status-control"><span>Update status</span><select class="order-status-choice" aria-label="New status for ${escapeHtml(order.reference || order.id)}"><option value="">Choose status</option>${allStatuses.map(next => `<option value="${escapeHtml(next)}" ${next === currentStatus ? "disabled" : ""}>${escapeHtml(next)}</option>`).join("")}</select><button type="button" class="action-button accept" data-order-update="${escapeHtml(order.id)}" disabled>Update</button></label>`;
  if (!byId("pharmacyOrderDialog").open) byId("pharmacyOrderDialog").showModal();
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
  const orderDialog = byId("pharmacyOrderDialog");
  if (orderDialog.open && orderDialog.dataset.orderId) showPharmacyOrderDetails(orderDialog.dataset.orderId);
}

function openMedicineDialog(medicine = null) {
  byId("medicineForm").reset();
  byId("medicineMessage").textContent = "";
  byId("medicineMessage").classList.remove("error");
  byId("medicineDialogTitle").textContent = medicine ? "Edit medicine" : "Add medicine";
  byId("medicineId").value = medicine?.id || "";
  byId("medicineName").value = medicine?.name || "";
  byId("medicineCategory").value = medicine?.category || "";
  byId("medicineDescription").value = medicine?.description || "";
  byId("medicineManufacturer").value = medicine?.manufacturer || "";
  byId("medicineImage").value = medicine?.image || "";
  byId("medicinePrice").value = medicine?.price ?? "";
  byId("medicineQuantity").value = medicine?.quantity ?? 0;
  byId("medicineQuantity").readOnly = Boolean(medicine);
  byId("medicineSaveButton").textContent = medicine ? "Save Changes" : "Add medicine";
  byId("medicineExpiry").value = medicine?.expiry || "";
  byId("medicineAvailable").checked = medicine ? medicine.listed !== false : true;
  const dialog = byId("medicineDialog");
  dialog.hidden = false;
  document.body.classList.add("medicine-edit-open");
  byId("medicineName").focus();
}
function closeMedicineDialog() {
  const dialog = byId("medicineDialog");
  dialog.hidden = true;
  document.body.classList.remove("medicine-edit-open");
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
byId("medicineStatusFilter").addEventListener("change", renderMedicines);
byId("inventorySearch").addEventListener("input", renderInventory);
byId("inventoryStatusFilter").addEventListener("change", renderInventory);
byId("orderSearch").addEventListener("input", renderOrders);
byId("orderStatusFilter").addEventListener("change", renderOrders);
byId("pharmacyOrderActions").addEventListener("change", event => {
  if (!event.target.matches(".order-status-choice")) return;
  const update = event.target.closest(".order-status-control")?.querySelector("[data-order-update]");
  if (update) update.disabled = !event.target.value;
});
byId("orderRows").addEventListener("click", event => {
  const detail = event.target.closest("[data-order-details]");
  if (detail) { showPharmacyOrderDetails(detail.dataset.orderDetails); return; }
});
function confirmCompletedSale() {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "pharmacy-order-dialog rejection-dialog sale-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "saleConfirmTitle");
    dialog.setAttribute("aria-describedby", "saleConfirmMessage");
    dialog.innerHTML = `<form method="dialog"><div class="order-dialog-heading"><h2 id="saleConfirmTitle">Complete order</h2><button type="submit" value="cancel" class="dialog-close" aria-label="Close">×</button></div><p id="saleConfirmMessage">Confirm that the medicine was handed to the customer and the sale was completed?</p><div class="dialog-actions"><button type="submit" value="cancel" class="btn btn-outline" autofocus>Cancel</button><button type="submit" value="confirm" class="btn btn-primary">Confirm completion</button></div></form>`;
    dialog.addEventListener("close", () => {
      const confirmed = dialog.returnValue === "confirm";
      dialog.remove();
      resolve(confirmed);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
byId("pharmacyOrderActions").addEventListener("click", async event => {
  const button = event.target.closest("[data-order-update]");
  if (!button) return;
  const nextStatus = button.closest(".order-status-control")?.querySelector(".order-status-choice")?.value;
  if (!nextStatus) return;
  if (nextStatus === "Rejected") {
    byId("orderRejectForm").dataset.orderId = button.dataset.orderUpdate;
    byId("orderRejectReason").value = "";
    byId("pharmacyOrderDialog").close();
    byId("orderRejectDialog").showModal();
    return;
  }
  const options = { pharmacyId };
  if (nextStatus === "Completed") {
    button.disabled = true;
    let confirmed;
    try { confirmed = await confirmCompletedSale(); }
    finally { button.disabled = false; }
    if (!confirmed) return;
    options.saleVerified = true;
    const order = pharmacyOrders().find(row => String(row.id) === String(button.dataset.orderUpdate));
    options.paymentCollected = order?.paymentMethod === "cash-on-delivery";
  }
  const result = pharmacyApi.setOrderStatus(button.dataset.orderUpdate, nextStatus, options);
  if (!result.ok) { toast(result.error || "Could not update this order.", true); return; }
  toast(`Order updated to ${nextStatus}.`);
  byId("pharmacyOrderDialog").close();
  renderAll();
});
byId("orderRejectForm").addEventListener("submit", event => {
  event.preventDefault();
  const reason = byId("orderRejectReason").value.trim();
  if (!reason) { byId("orderRejectReason").focus(); return; }
  const result = pharmacyApi.setOrderStatus(event.currentTarget.dataset.orderId, "Rejected", { pharmacyId, reason });
  if (!result.ok) { toast(result.error || "Could not reject this order.", true); return; }
  byId("orderRejectDialog").close();
  toast("Order rejected and the reason saved.");
  renderAll();
});
document.querySelectorAll("[data-close-order-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog")?.close()));
byId("pharmacyOrderDialog").addEventListener("click", event => { if (event.target === byId("pharmacyOrderDialog")) byId("pharmacyOrderDialog").close(); });
byId("orderRejectDialog").addEventListener("click", event => { if (event.target === byId("orderRejectDialog")) byId("orderRejectDialog").close(); });
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", closeMedicineDialog));
byId("closeMedicineDetails").addEventListener("click", closeMedicineDetails);
byId("closeMedicineDetailsButton").addEventListener("click", closeMedicineDetails);
byId("medicineDetailsEdit").addEventListener("click", () => {
  const item = inventory().find(medicine => String(medicine.id) === byId("medicineDetailsEdit").dataset.editMedicine);
  if (!item) { toast("This medicine could not be found. Refresh the page and try again.", true); return; }
  closeMedicineDetails();
  openMedicineDialog(item);
});
byId("medicineDetailsDelete").addEventListener("click", handleMedicineAction);
byId("medicineDetailsDialog").addEventListener("click", event => { if (event.target === byId("medicineDetailsDialog")) closeMedicineDetails(); });
byId("medicineDialog").addEventListener("click", event => { if (event.target === byId("medicineDialog")) closeMedicineDialog(); });
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!byId("medicineDetailsDialog").hidden) closeMedicineDetails();
  if (!byId("medicineDialog").hidden) closeMedicineDialog();
});

byId("medicineForm").addEventListener("submit", event => {
  event.preventDefault();
  const message = byId("medicineMessage");
  message.textContent = "";
  message.classList.remove("error");
  const id = byId("medicineId").value || `med-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
  const current = pharmacyApi.get(pharmacyId);
  const rows = Array.isArray(current?.inventory) ? current.inventory : [];
  const existing = rows.find(item => String(item.id) === String(id));
  const quantity = existing ? Number(existing.quantity) || 0 : Number(byId("medicineQuantity").value);
  const listed = byId("medicineAvailable").checked;
  const medicine = {
    id, name: byId("medicineName").value.trim(), category: byId("medicineCategory").value.trim(),
    description: byId("medicineDescription").value.trim(), manufacturer: byId("medicineManufacturer").value.trim(), image: byId("medicineImage").value.trim(),
    price: Number(byId("medicinePrice").value), quantity, expiry: byId("medicineExpiry").value,
    listed, available: listed && quantity > 0
  };
  if (!medicine.name || !medicine.category || !Number.isFinite(medicine.price) || medicine.price <= 0 || (!existing && (!Number.isInteger(quantity) || quantity < 0)) || !medicine.expiry) {
    message.textContent = "Enter a name, category, valid price, and expiry date.";
    message.classList.add("error");
    return;
  }
  if (Number.isNaN(Date.parse(`${medicine.expiry}T23:59:59`))) {
    message.textContent = "Enter a valid expiry date.";
    message.classList.add("error");
    return;
  }
  if (!current) {
    message.textContent = "This pharmacy account is not linked to a pharmacy record. Please sign in again or contact the administrator.";
    message.classList.add("error");
    return;
  }
  const next = existing
    ? rows.map(item => String(item.id) === String(id) ? { ...item, ...medicine, quantity: item.quantity } : item)
    : [...rows, { ...medicine, createdAt: new Date().toISOString() }];
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
byId("openToggle").addEventListener("change", () => {
  const open = byId("openToggle").checked;
  byId("openLabel").textContent = open ? "Open" : "Closed";
  if (!pharmacyApi.updatePharmacy(pharmacyId, { open })) {
    byId("openToggle").checked = !open;
    byId("openLabel").textContent = open ? "Closed" : "Open";
    toast("Could not update the pharmacy status.", true);
    return;
  }
  toast(open ? "Pharmacy is now open to customers." : "Pharmacy is now closed to customers.");
});
// Refresh all dashboard views when another same-origin page changes the shared browser data.
api.subscribe(renderAll);
renderAll();
const requestedSection = new URLSearchParams(location.search).get("section");
if (["overview", "medicines", "inventory", "orders", "profile"].includes(requestedSection)) navigate(requestedSection);
