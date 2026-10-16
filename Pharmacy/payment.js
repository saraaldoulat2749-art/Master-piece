const api = window.CarePlusPharmacy;
const orderId = new URLSearchParams(location.search).get("orderId");
const order = window.CarePlusData.get("orders", orderId);
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
  message.textContent = "Demo simulation succeeded. No charge was made; payment status remains Pending until provider verification.";
  form.querySelectorAll("input").forEach(input => { input.value = ""; input.disabled = true; });
  submit.hidden = true;
  continueLink.href = `order-confirmed.html?orderId=${encodeURIComponent(order.id)}`;
  continueLink.hidden = false;
}

if (!order || order.source !== "pharmacy-order" || !customer || String(order.userId) !== customer.userId) {
  unavailableMessage("This payment page is only available to the customer who placed the order.");
} else if (order.paymentStatus !== "Pending" || order.status === "Cancelled") {
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
  document.getElementById("paymentTotal").textContent = money(order.total);
  if (order.paymentDemoResult === "simulated-success") showSimulatedSuccess();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("cardholder").value.trim();
  const cardNumber = document.getElementById("cardNumber").value.trim();
  const expiry = document.getElementById("cardExpiry").value.trim();
  const cvv = document.getElementById("cardCvv").value.trim();
  if (!name || !cardNumber || !expiry || !cvv) {
    message.classList.add("error");
    message.textContent = "Fill in the demo payment fields to continue.";
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
  message.textContent = "Demo payment accepted. Opening your order confirmation…";
  setTimeout(() => location.assign(`order-confirmed.html?orderId=${encodeURIComponent(order.id)}`), 900);
});
