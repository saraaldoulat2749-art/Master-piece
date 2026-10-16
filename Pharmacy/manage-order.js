const api = window.CarePlusPharmacy;
const orderId = new URLSearchParams(location.search).get("orderId");
const initialOrder = window.CarePlusData.get("orders", orderId);
const pharmacyId = window.CarePlusAuth?.demoPharmacyId?.();
const content = document.getElementById("manageOrderContent");
const actions = document.getElementById("manageOrderActions");
const message = document.getElementById("manageOrderMessage");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = amount => `JOD ${Number(amount || 0).toFixed(2)}`;
function showMessage(text, error = false) { message.textContent = text; message.classList.toggle("error", error); }

function renderPage() {
  const current = initialOrder && window.CarePlusData.get("orders", initialOrder.id);
  if (!current || current.source !== "pharmacy-order" || !pharmacyId || String(current.pharmacyId) !== String(pharmacyId)) {
    document.getElementById("manageOrderTitle").textContent = "Order unavailable";
    document.getElementById("manageOrderStatus").hidden = true;
    showMessage("This order does not belong to the pharmacy workspace signed in on this tab.", true);
    content.replaceChildren(); actions.replaceChildren(); return;
  }
  document.getElementById("manageOrderTitle").textContent = current.reference || current.id;
  document.getElementById("manageOrderStatus").textContent = current.status;
  const items = (current.items || []).map(item => `<div class="manage-order-item"><span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span><b>${money(Number(item.price) * Number(item.quantity))}</b></div>`).join("");
  const online = current.paymentMethod === "online-gateway";
  content.innerHTML = `<div class="manage-order-facts"><div><small>Customer reference</small><b>${escapeHtml(current.customerReference || "Customer")}</b></div><div><small>Order date</small><b>${new Date(current.placedAt || current.createdAt).toLocaleString()}</b></div><div><small>Payment</small><b>${escapeHtml(current.paymentStatus || "Pending")} · ${online ? "Online payment" : "Cash on delivery"}</b></div><div><small>Commission rate snapshot</small><b>${Number(current.commissionRate || 0)}%</b></div></div><div class="manage-order-items"><strong>Medicines</strong>${items || "No items"}<div class="manage-order-total"><span>Medicine subtotal</span><b>${money(current.subtotal ?? current.total)}</b></div><div class="manage-order-total"><span>CarePlus fee</span><b>${money(current.customerCommissionAmount)}</b></div><div class="manage-order-total"><span>Delivery · ${escapeHtml(current.deliveryZoneLabel || api.deliveryZoneLabel(current.deliveryZone))}</span><b>${money(current.deliveryFee)}</b></div><div class="manage-order-total"><span>Customer total</span><b>${money(current.total)}</b></div></div>${current.cancelReason ? `<p class="manage-cancel-note"><b>Cancellation reason:</b> ${escapeHtml(current.cancelReason)}</p>` : ""}${current.commissionStatus && current.commissionStatus !== "Not Eligible" ? `<p class="manage-commission-note">Commission: ${escapeHtml(current.commissionStatus)} · ${money(current.commissionAmount)}</p>` : ""}`;

  if (current.deliveryAddress) content.insertAdjacentHTML("afterbegin", `<div class="manage-order-facts"><div><small>Delivery address</small><b>${escapeHtml(current.deliveryAddress)}</b></div><div><small>Delivery contact</small><b>${escapeHtml(current.deliveryPhone || "Not provided")}</b></div></div>`);
  const next = current.status === "Pending" ? ["Confirmed", "Cancelled"] : current.status === "Confirmed" ? ["Preparing for Delivery", "Cancelled"] : current.status === "Preparing for Delivery" ? ["Out for Delivery", "Cancelled"] : [];
  actions.innerHTML = next.map(status => `<button type="button" class="btn ${status === "Cancelled" ? "btn-outline" : "btn-primary"}" data-next-status="${escapeHtml(status)}">${status === "Delivered" ? "Confirm delivered to customer" : status === "Cancelled" ? "Cancel order" : status}</button>`).join("");
  document.querySelector("#manageCollectionWrap span").textContent = online
    ? "I confirm the customer received the medicine at the delivery address above."
    : "I confirm the customer received the delivery and paid the cash-on-delivery amount.";
}

actions.addEventListener("click", event => {
  const button = event.target.closest("[data-next-status]");
  if (!button) return;
  const status = button.dataset.nextStatus;
  document.getElementById("manageReasonWrap").hidden = status !== "Cancelled";
  document.getElementById("manageCollectionWrap").hidden = status !== "Delivered";
  if (status === "Cancelled") { document.getElementById("manageCancelReason").focus(); return; }
  if (status === "Delivered") { document.getElementById("manageCollectionVerified").checked = false; button.textContent = "Confirm delivered to customer"; button.dataset.confirming = "true"; return; }
  const result = api.setOrderStatus(orderId, status);
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage(`Order updated to ${result.order.status}.`); renderPage();
});

document.getElementById("manageReasonWrap").insertAdjacentHTML("afterend", `<button class="btn btn-outline" id="submitOrderCancellation" type="button" hidden>Confirm cancellation</button>`);
const cancelButton = document.getElementById("submitOrderCancellation");
actions.addEventListener("click", event => { if (event.target.closest('[data-next-status="Cancelled"]')) cancelButton.hidden = false; });
cancelButton.addEventListener("click", () => {
  const reason = document.getElementById("manageCancelReason").value.trim();
  const result = api.setOrderStatus(orderId, "Cancelled", { reason });
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage(`Order ${result.order.reference} was cancelled. Reserved stock was released.`); cancelButton.hidden = true; renderPage();
});
actions.addEventListener("click", event => {
  const button = event.target.closest('[data-next-status="Delivered"]');
  if (!button || button.dataset.confirming !== "true") return;
  if (!document.getElementById("manageCollectionVerified").checked) { showMessage("Confirm delivery to the customer before completing this step.", true); return; }
  const result = api.setOrderStatus(orderId, "Delivered", { deliveryVerified: true, paymentCollected: !online });
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage("Delivery marked as delivered. Verified paid orders are submitted for commission review."); renderPage();
});

api.subscribe(renderPage);
renderPage();
