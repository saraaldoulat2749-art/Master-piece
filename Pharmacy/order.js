const api = window.CarePlusPharmacy;
const params = new URLSearchParams(location.search);
const pharmacy = api.get(params.get("pharmacyId"));
const medicineId = params.get("medicineId");
const initialIds = (params.get('medicineIds') || medicineId || '').split(',').filter(Boolean);
const available = (pharmacy?.inventory || []).filter(item => item.available !== false && Number(item.quantity) > 0 && !api.isExpired(item));
const initialMedicine = available.find(item => initialIds.includes(String(item.id)));
if (initialMedicine && pharmacy) {
  const query = `medicine=${encodeURIComponent(available.filter(item => initialIds.includes(String(item.id))).map(item => item.name).join(', '))}&area=${encodeURIComponent(pharmacy.area || pharmacy.city || "")}`;
  const links = [...document.querySelectorAll(".order-progress .order-step-number")];
  if (links[0]) links[0].href = `index.html?${query}`;
  if (links[1]) links[1].href = `results.html?${query}`;
  if (links[2]) links[2].href = `order.html?pharmacyId=${encodeURIComponent(pharmacy.id)}&medicineIds=${encodeURIComponent(initialIds.join(','))}`;
}
const orderReview = document.getElementById("orderReview");
const orderUnavailable = document.getElementById("orderUnavailable");
const form = document.getElementById("medicineOrderForm");
const feedback = document.getElementById("orderFeedback");
const submitButton = form.querySelector(".order-submit");
let idempotencyKey = globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const selected = new Map(available.filter(item => initialIds.includes(String(item.id))).map(item => [String(item.id), 1]));

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function showUnavailable(message) {
  orderUnavailable.hidden = false;
  orderReview.hidden = true;
  document.getElementById("orderErrorMessage").textContent = message;
}
function selectedLines() {
  return [...selected].map(([medicineId, quantity]) => ({ medicineId, quantity }));
}
function renderSelected() {
  document.getElementById('orderItems').innerHTML = selectedLines().map(line => {
    const item = available.find(item => String(item.id) === line.medicineId);
    return `<div class="medicine-order-item" data-medicine-id="${escapeHtml(item.id)}"><div class="medicine-selected-name"><strong>${escapeHtml(item.name)}</strong><small>JOD ${Number(item.price).toFixed(2)} each &middot; ${Number(item.quantity)} available</small></div><label class="medicine-line-quantity">Quantity<input type="number" min="1" max="${Math.min(99, Number(item.quantity))}" step="1" value="${line.quantity}" aria-label="Quantity for ${escapeHtml(item.name)}"></label><button type="button" class="medicine-remove" data-remove-medicine="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">&times;</button></div>`;
  }).join('') || '<p class="medicine-empty-basket">No medicines selected. Search below to add a medicine.</p>';
}
function renderMedicineSearch() {
  const query = document.getElementById('addMedicineSearch').value.trim().toLowerCase().replace(/\s+/g, '');
  const results = document.getElementById('addMedicineResults');
  const status = document.getElementById('addMedicineStatus');
  results.replaceChildren(); results.hidden = !query; status.textContent = '';
  if (!query) return;
  const matches = available.filter(item => !selected.has(String(item.id)) && item.name.toLowerCase().replace(/\s+/g, '').includes(query));
  results.innerHTML = matches.slice(0, 6).map(item => `<button type="button" data-add-medicine="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.name)}</strong><small>JOD ${Number(item.price).toFixed(2)} &middot; ${Number(item.quantity)} available</small></span><b>+ Add</b></button>`).join('');
  status.textContent = !matches.length ? 'No matching medicines to add.' : matches.length > 6 ? `${matches.length} matches. Showing the first 6; type more to narrow your search.` : `${matches.length} medicine(s) found.`;
}
function updateSummary() {
  const lines = selectedLines();
  const valid = lines.length && lines.every(line => { const item = available.find(item => String(item.id) === line.medicineId); return item && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= Math.min(99, Number(item.quantity)); });
  const subtotal = Math.round(lines.reduce((sum, line) => sum + Number(available.find(item => String(item.id) === line.medicineId)?.price || 0) * Math.max(0, line.quantity || 0), 0) * 100) / 100;
  const rate = api.effectiveRate(pharmacy?.id);
  const commission = Math.round(subtotal * rate) / 100;
  const deliveryZone = document.getElementById("deliveryZone").value;
  const delivery = api.deliveryFeeForZone(deliveryZone);
  const total = Math.round((subtotal + commission + delivery) * 100) / 100;
  document.getElementById("orderUnitPrice").textContent = String(lines.length);
  document.getElementById("orderSubtotal").textContent = `JOD ${subtotal.toFixed(2)}`;
  document.getElementById("orderCommissionRate").textContent = rate.toFixed(2).replace(/\.00$/, "");
  document.getElementById("orderCommission").textContent = `JOD ${commission.toFixed(2)}`;
  document.getElementById("orderDeliveryLabel").textContent = `Delivery · ${api.deliveryZoneLabel(deliveryZone)}`;
  document.getElementById("orderDelivery").textContent = `JOD ${delivery.toFixed(2)}`;
  document.getElementById("orderTotal").textContent = `JOD ${commission.toFixed(2)}`;
  const submitButton = document.querySelector(".order-submit");
  const hasAddress = document.getElementById("deliveryAddress").value.trim().length >= 8;
  const hasValidPhone = document.getElementById("deliveryPhone").value.replace(/\D/g, "").length >= 7;
  submitButton.disabled = !hasAddress || !hasValidPhone || !valid;
  feedback.classList.remove("error");
  feedback.textContent = !valid ? 'Select at least one medicine and enter quantities within available stock.' : hasAddress && hasValidPhone
    ? "Your request goes to the pharmacy first. You can pay the CarePlus commission after the pharmacy accepts. Medicine and delivery are paid in cash on delivery."
    : `To enable the button, ${[
        !hasAddress ? "enter a delivery address with at least 8 characters" : "",
        !hasValidPhone ? "enter a contact phone with at least 7 digits" : ""
      ].filter(Boolean).join(" and ")}.`;
}

const customer = api.currentCustomer();
if (!customer) showUnavailable("Please sign in with a customer account to place a medicine order.");
else if (!api.isActivePharmacy(pharmacy) || !initialMedicine || pharmacy.open === false) showUnavailable("This pharmacy or medicine is no longer available. Search again for current stock.");
else {
  orderReview.hidden = false;
  document.getElementById("orderPharmacyName").textContent = pharmacy.name;
  document.getElementById("orderPharmacyInfo").textContent = `${pharmacy.address || pharmacy.area} · ${pharmacy.phone || "Contact details unavailable"}`;
  renderSelected();
  updateSummary();
}

document.getElementById('orderItems').addEventListener('input', event => {
  const row = event.target.closest('[data-medicine-id]');
  if (row) selected.set(row.dataset.medicineId, Number(event.target.value));
  updateSummary();
});
document.getElementById('orderItems').addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-medicine]');
  if (!remove) return;
  selected.delete(remove.dataset.removeMedicine); renderSelected(); renderMedicineSearch(); updateSummary();
});
document.getElementById('addMedicineSearch').addEventListener('input', renderMedicineSearch);
document.getElementById('addMedicineSearch').addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
document.getElementById('addMedicineResults').addEventListener('click', event => {
  const add = event.target.closest('[data-add-medicine]');
  if (!add || selected.has(add.dataset.addMedicine)) return;
  selected.set(add.dataset.addMedicine, 1);
  renderSelected(); document.getElementById('addMedicineSearch').value = ''; renderMedicineSearch(); updateSummary();
  document.getElementById('addMedicineSearch').focus();
});
document.getElementById("deliveryAddress").addEventListener("input", updateSummary);
document.getElementById("deliveryZone").addEventListener("change", updateSummary);
document.getElementById("deliveryPhone").addEventListener("input", updateSummary);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (submitButton.disabled || !pharmacy) return;
  submitButton.disabled = true;
  const result = api.createOrder({ pharmacyId: pharmacy.id, items: selectedLines(), deliveryAddress: document.getElementById("deliveryAddress").value, deliveryPhone: document.getElementById("deliveryPhone").value, deliveryZone: document.getElementById("deliveryZone").value, idempotencyKey });
  if (!result.ok) {
    feedback.textContent = result.error;
    feedback.classList.add("error");
    submitButton.disabled = false;
    return;
  }
  location.assign("../Profile/index.html?tab=orders");
});
