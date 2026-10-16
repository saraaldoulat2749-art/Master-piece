const api = window.CarePlusPharmacy;
const params = new URLSearchParams(location.search);
const pharmacy = api.get(params.get("pharmacyId"));
const medicineId = params.get("medicineId");
const available = (pharmacy?.inventory || []).filter(item => item.available !== false && Number(item.quantity) > 0 && !api.isExpired(item));
const initialMedicine = available.find(item => String(item.id) === String(medicineId));
const orderReview = document.getElementById("orderReview");
const orderUnavailable = document.getElementById("orderUnavailable");
const form = document.getElementById("medicineOrderForm");
const feedback = document.getElementById("orderFeedback");
const submitButton = form.querySelector(".order-submit");
let idempotencyKey = globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function showUnavailable(message) {
  orderUnavailable.hidden = false;
  orderReview.hidden = true;
  document.getElementById("orderErrorMessage").textContent = message;
}
function selectedMedicine() { return available.find(item => String(item.id) === document.getElementById("orderMedicine").value); }
function updateSummary() {
  const item = selectedMedicine();
  const price = Number(item?.price || 0);
  const quantity = Math.max(0, Number(document.getElementById("orderQuantity").value) || 0);
  const subtotal = Math.round(price * quantity * 100) / 100;
  const rate = api.effectiveRate(pharmacy?.id);
  const commission = Math.round(subtotal * rate) / 100;
  const deliveryZone = document.getElementById("deliveryZone").value;
  const delivery = api.deliveryFeeForZone(deliveryZone);
  const total = Math.round((subtotal + commission + delivery) * 100) / 100;
  document.getElementById("orderQuantity").max = String(item?.quantity || 1);
  document.getElementById("orderUnitPrice").textContent = `JOD ${price.toFixed(2)}`;
  document.getElementById("orderSubtotal").textContent = `JOD ${subtotal.toFixed(2)}`;
  document.getElementById("orderCommissionRate").textContent = rate.toFixed(2).replace(/\.00$/, "");
  document.getElementById("orderCommission").textContent = `JOD ${commission.toFixed(2)}`;
  document.getElementById("orderDeliveryLabel").textContent = `Delivery · ${api.deliveryZoneLabel(deliveryZone)}`;
  document.getElementById("orderDelivery").textContent = `JOD ${delivery.toFixed(2)}`;
  document.getElementById("orderTotal").textContent = `JOD ${total.toFixed(2)}`;
  const submitButton = document.querySelector(".order-submit");
  submitButton.disabled = !document.getElementById("deliveryAddress").value.trim() || document.getElementById("deliveryPhone").value.replace(/\D/g, "").length < 7;
}

const customer = api.currentCustomer();
if (!customer) showUnavailable("Please sign in with a customer account to place a medicine order.");
else if (!api.isActivePharmacy(pharmacy) || !initialMedicine || pharmacy.open === false) showUnavailable("This pharmacy or medicine is no longer available. Search again for current stock.");
else {
  orderReview.hidden = false;
  document.getElementById("orderPharmacyName").textContent = pharmacy.name;
  document.getElementById("orderPharmacyInfo").textContent = `${pharmacy.address || pharmacy.area} · ${pharmacy.phone || "Contact details unavailable"}`;
  document.getElementById("orderMedicine").innerHTML = available.map(item => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(initialMedicine.id) ? "selected" : ""}>${escapeHtml(item.name)} · JOD ${Number(item.price).toFixed(2)} · ${Number(item.quantity)} available</option>`).join("");
  document.getElementById("orderQuantity").value = "1";
  updateSummary();
}

document.getElementById("orderMedicine").addEventListener("change", () => { document.getElementById("orderQuantity").value = "1"; updateSummary(); });
document.getElementById("orderQuantity").addEventListener("input", updateSummary);
document.getElementById("deliveryAddress").addEventListener("input", updateSummary);
document.getElementById("deliveryZone").addEventListener("change", updateSummary);
document.getElementById("deliveryPhone").addEventListener("input", updateSummary);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (submitButton.disabled || !pharmacy) return;
  submitButton.disabled = true;
  const result = api.createOrder({ pharmacyId: pharmacy.id, medicineId: document.getElementById("orderMedicine").value, quantity: Number(document.getElementById("orderQuantity").value), deliveryAddress: document.getElementById("deliveryAddress").value, deliveryPhone: document.getElementById("deliveryPhone").value, deliveryZone: document.getElementById("deliveryZone").value, idempotencyKey });
  if (!result.ok) {
    feedback.textContent = result.error;
    feedback.classList.add("error");
    submitButton.disabled = false;
    return;
  }
  location.assign(`payment.html?orderId=${encodeURIComponent(result.order.id)}`);
});
