const api = window.CarePlusPharmacy;
const orderId = new URLSearchParams(location.search).get("orderId");
const order = window.CarePlusData.get("orders", orderId);
if (order) {
  const item = order.items?.[0] || {};
  const pharmacy = window.CarePlusPharmacy.get(order.pharmacyId);
  const query = `medicine=${encodeURIComponent(item.name || "")}&area=${encodeURIComponent(pharmacy?.area || pharmacy?.city || "")}`;
  const links = [...document.querySelectorAll(".order-progress .order-step-number")];
  if (links[0]) links[0].href = `index.html?${query}`;
  if (links[1]) links[1].href = `results.html?${query}`;
  if (links[2]) links[2].href = `order.html?pharmacyId=${encodeURIComponent(order.pharmacyId)}&medicineId=${encodeURIComponent(item.medicineId || "")}`;
  if (links[4]) links[4].href = `payment.html?orderId=${encodeURIComponent(order.id)}`;
}
const customer = api.currentCustomer();
const card = document.getElementById("paymentCard");
const unavailable = document.getElementById("paymentUnavailable");
const form = document.getElementById("demoPaymentForm");
const message = document.getElementById("demoPaymentMessage");
const submit = document.getElementById("simulatePaymentButton");
const continueLink = document.getElementById("continueAfterPayment");
const money = value => `JOD ${Number(value || 0).toFixed(2)}`;

function unavailableMessage(text) {
  unavailable.hidden = false;
  document.getElementById("paymentErrorText").textContent = text;
  card.hidden = true;
}
function showSimulatedSuccess() {
  message.classList.remove("error");
  message.textContent = "Demo payment submitted. No card was charged or stored.";
  form.querySelectorAll("input").forEach(input => { input.value = ""; input.disabled = true; });
  form.querySelectorAll("label").forEach(label => { label.hidden = true; });
  submit.hidden = true;
  continueLink.href = `order-confirmed.html?orderId=${encodeURIComponent(order.id)}`;
  continueLink.hidden = false;
}

if (!order || order.source !== "pharmacy-order" || !customer || String(order.userId) !== customer.userId) {
  unavailableMessage("This payment page is only available to the customer who placed the order.");
} else if (order.status !== "Accepted" || order.paymentStatus !== "Pending") {
  unavailableMessage(`This order cannot be paid in its current state (${order.paymentStatus || order.status}).`);
} else {
  card.hidden = false;
  document.getElementById("paymentOrderRef").textContent = order.reference || order.id;
  document.getElementById("paymentPharmacy").textContent = order.pharmacyName || "Pharmacy";
  document.getElementById("paymentItems").textContent = (order.items || []).map(item => `${item.name} × ${item.quantity}`).join(", ");
  document.getElementById("paymentSubtotal").textContent = money(order.subtotal ?? order.total);
  document.getElementById("paymentCommission").textContent = money(order.customerCommissionAmount);
  document.getElementById("paymentDeliveryLabel").textContent = `Delivery · ${order.deliveryZoneLabel || api.deliveryZoneLabel(order.deliveryZone)}`;
  document.getElementById("paymentDelivery").textContent = money(order.deliveryFee);
  document.getElementById("paymentTotal").textContent = money(order.customerCommissionAmount);
  if (order.paymentDemoResult === "simulated-success") showSimulatedSuccess();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("cardholder").value.trim();
  const cardNumber = document.getElementById("cardNumber").value.trim();
  const expiry = document.getElementById("cardExpiry").value.trim();
  const cvv = document.getElementById("cardCvv").value.trim();
  const validation = window.CarePlusPaymentValidation?.validateCard({ name, number: cardNumber, expiry, cvv });
  if (!validation?.ok) {
    message.classList.add("error");
    message.textContent = validation?.error || 'Payment validation is unavailable. Refresh and try again.';
    return;
  }
  submit.disabled = true;
  const result = api.simulateDemoPayment(order.id, customer.userId);
  if (!result.ok) {
    message.classList.add("error");
    message.textContent = result.error;
    submit.disabled = false;
    return;
  }
  // No card fields are sent to or persisted in browser storage.
  showSimulatedSuccess();
  message.textContent = "Demo payment submitted. No card was charged. Opening your order confirmation…";
  setTimeout(() => location.assign(`order-confirmed.html?orderId=${encodeURIComponent(order.id)}`), 900);
});
