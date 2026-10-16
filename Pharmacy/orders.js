const pharmacyApi = window.CarePlusPharmacy;
const rows = document.getElementById("myOrderRows");
const filter = document.getElementById("orderStatusFilter");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function renderOrders() {
  const customer = pharmacyApi.currentCustomer();
  if (!customer) { rows.innerHTML = `<div class="empty">Sign in with a customer account to view your orders.</div>`; return; }
  const orders = pharmacyApi.listOrders().filter(order => String(order.userId) === customer.userId).sort((a,b) => new Date(b.placedAt || b.createdAt) - new Date(a.placedAt || a.createdAt)).filter(order => !filter.value || order.status === filter.value);
  rows.innerHTML = orders.length ? orders.map(order => {
    const items = (order.items || []).map(item => `${escapeHtml(item.name)} × ${Number(item.quantity)}`).join(", ");
    const canCancel = ["Pending", "Confirmed", "Preparing for Delivery"].includes(order.status);
    const receiptAction = order.status === "Out for Delivery" ? `<button type="button" data-confirm-receipt="${escapeHtml(order.id)}">Confirm I received this order</button>` : "";
    const statusClass = order.status.toLowerCase().replace(/\s+/g, "-");
    const paymentLabel = order.paymentMethod === "online-gateway" ? (order.paymentDemoResult === "simulated-success" ? "Demo payment simulated · not charged" : "Online payment pending provider setup") : "Cash on delivery";
    const chargeBreakdown = `Medicine JOD ${Number(order.subtotal ?? order.total).toFixed(2)} + CarePlus JOD ${Number(order.customerCommissionAmount || 0).toFixed(2)} + ${order.deliveryZoneLabel || pharmacyApi.deliveryZoneLabel(order.deliveryZone)} delivery JOD ${Number(order.deliveryFee || 0).toFixed(2)}`;
    const paymentLink = order.paymentMethod === "online-gateway" && order.paymentStatus === "Pending" && order.status !== "Cancelled" ? `<a href="payment.html?orderId=${encodeURIComponent(order.id)}">Open demo checkout</a>` : "";
    return `<article class="my-order-card"><div class="my-order-main"><div><small>${escapeHtml(order.reference || order.id)} · ${new Date(order.placedAt || order.createdAt).toLocaleString()}</small><h3>${escapeHtml(order.pharmacyName)}</h3><p>${items}</p><p><b>Delivery address:</b> ${escapeHtml(order.deliveryAddress || "Not provided")}</p></div><span class="order-state ${statusClass}">${escapeHtml(order.status)}</span></div><div class="my-order-meta"><span>Payment: <b>${escapeHtml(order.paymentStatus || "Pending")}</b></span><span>Total: <b>JOD ${Number(order.total).toFixed(2)}</b></span><span>${escapeHtml(chargeBreakdown)}</span><span>${paymentLabel}</span>${paymentLink}${receiptAction}${canCancel ? `<button type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel order</button>` : ""}</div></article>`;
  }).join("") : `<div class="empty">No medicine orders match this filter.</div>`;
}
filter.addEventListener("change", renderOrders);
rows.addEventListener("click", event => {
  const receiptButton = event.target.closest("[data-confirm-receipt]");
  if (receiptButton) {
    const customer = pharmacyApi.currentCustomer();
    if (!customer || !window.confirm("Confirm that you have received this medicine order?")) return;
    const result = pharmacyApi.confirmCustomerReceipt(receiptButton.dataset.confirmReceipt, customer.userId);
    if (!result.ok) { window.alert(result.error); return; }
    renderOrders();
    window.alert("Receipt confirmed. The order status is now Delivered.");
    return;
  }
  const button = event.target.closest("[data-cancel-order]");
  if (!button) return;
  const customer = pharmacyApi.currentCustomer();
  if (!customer) return;
  const result = pharmacyApi.cancelCustomerOrder(button.dataset.cancelOrder, customer.userId);
  if (!result.ok) { window.alert(result.error); return; }
  renderOrders();
});
pharmacyApi.subscribe(renderOrders);
renderOrders();
