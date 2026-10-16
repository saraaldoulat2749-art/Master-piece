const order = window.CarePlusData.get("orders", new URLSearchParams(location.search).get("orderId"));
const customer = window.CarePlusPharmacy.currentCustomer();
if (!order || order.source !== "pharmacy-order" || !customer || String(order.userId) !== customer.userId) {
  document.getElementById("confirmedOrderReference").textContent = "Order not found";
  document.getElementById("orderSuccessMessage").textContent = "This order is unavailable for the current customer account.";
  document.getElementById("confirmedOrderStatus").hidden = true;
} else {
  document.getElementById("confirmedOrderReference").textContent = order.reference;
  document.getElementById("confirmedOrderStatus").textContent = order.status;
  document.getElementById("orderSuccessMessage").textContent = `${order.pharmacyName} received your request. You can follow status changes from My medicine orders.`;
}
