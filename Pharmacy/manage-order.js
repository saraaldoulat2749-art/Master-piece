const api = window.CarePlusPharmacy;
const orderId = new URLSearchParams(location.search).get("orderId");
const initialOrder = window.CarePlusData.get("orders", orderId);
const pharmacyId = window.CarePlusAuth?.demoPharmacyId?.();
const orderIsCashOnDelivery = initialOrder?.paymentMethod === "cash-on-delivery";
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
  const normalize = value => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[value] || value || "Pending");
  const currentStatus = normalize(current.status);
  document.getElementById("manageOrderStatus").textContent = currentStatus;
  const items = (current.items || []).map(item => `<div class="manage-order-item"><span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span><b>${money(Number(item.price) * Number(item.quantity))}</b></div>`).join("");
  const online = current.paymentMethod === "online-gateway";
  content.innerHTML = `<div class="manage-order-facts"><div><small>Customer reference</small><b>${escapeHtml(current.customerReference || "Customer")}</b></div><div><small>Order date</small><b>${new Date(current.placedAt || current.createdAt).toLocaleString()}</b></div><div><small>Payment</small><b>${escapeHtml(current.paymentStatus || "Pending")} · ${online ? "Online payment" : "Cash on delivery"}</b></div><div><small>Commission rate snapshot</small><b>${Number(current.commissionRate || 0)}%</b></div></div><div class="manage-order-items"><strong>Medicines</strong>${items || "No items"}<div class="manage-order-total"><span>Medicine subtotal</span><b>${money(current.subtotal ?? current.total)}</b></div><div class="manage-order-total"><span>CarePlus fee</span><b>${money(current.customerCommissionAmount)}</b></div><div class="manage-order-total"><span>Delivery · ${escapeHtml(current.deliveryZoneLabel || api.deliveryZoneLabel(current.deliveryZone))}</span><b>${money(current.deliveryFee)}</b></div><div class="manage-order-total"><span>Customer total</span><b>${money(current.total)}</b></div></div>${current.cancelReason ? `<p class="manage-cancel-note"><b>Cancellation reason:</b> ${escapeHtml(current.cancelReason)}</p>` : ""}${current.commissionStatus && current.commissionStatus !== "Not Eligible" ? `<p class="manage-commission-note">Commission: ${escapeHtml(current.commissionStatus)} · ${money(current.commissionAmount)}</p>` : ""}`;

  const history = Array.isArray(current.statusHistory) ? current.statusHistory : [{ status: "Pending", at: current.placedAt || current.createdAt, actor: "Customer" }];
  content.insertAdjacentHTML("beforeend", `<h3 class="order-history-title">Status history</h3><ol class="order-history">${history.map(entry => `<li><i></i><div><b>${escapeHtml(normalize(entry.status))}</b><small>${new Date(entry.at || entry.timestamp || current.placedAt).toLocaleString()} · ${escapeHtml(entry.actor || "CarePlus")}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ""}</small></div></li>`).join("")}</ol>`);

  if (current.deliveryAddress) content.insertAdjacentHTML("afterbegin", `<div class="manage-order-facts"><div><small>Delivery address</small><b>${escapeHtml(current.deliveryAddress)}</b></div><div><small>Delivery contact</small><b>${escapeHtml(current.deliveryPhone || "Not provided")}</b></div></div>`);
  const transitions = { Pending: ["Accepted", "Rejected"], Accepted: ["Preparing", "Rejected"], Preparing: ["Ready for Pickup", "Rejected"], "Ready for Pickup": ["Completed"] };
  const next = transitions[currentStatus] || [];
  actions.innerHTML = next.map(status => `<button type="button" class="btn ${status === "Rejected" ? "btn-outline" : "btn-primary"}" data-next-status="${escapeHtml(status)}">${status === "Completed" ? "Complete verified sale" : status === "Rejected" ? "Reject order" : status}</button>`).join("");
  document.querySelector("#manageCollectionWrap span").textContent = orderIsCashOnDelivery
    ? "I verify the sale is complete and confirm cash payment was collected."
    : "I verify the medicine was handed to the customer and the sale was completed.";
}

actions.addEventListener("click", event => {
  const button = event.target.closest("[data-next-status]");
  if (!button) return;
  const status = button.dataset.nextStatus;
  document.getElementById("manageReasonWrap").hidden = status !== "Rejected";
  document.getElementById("manageCollectionWrap").hidden = status !== "Completed";
  if (status === "Rejected") { document.getElementById("manageCancelReason").focus(); return; }
  if (status === "Completed") { document.getElementById("manageCollectionVerified").checked = false; button.textContent = "Confirm completed sale"; button.dataset.confirming = "true"; return; }
  const result = api.setOrderStatus(orderId, status, { pharmacyId });
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage(`Order updated to ${result.order.status}.`); renderPage();
});

document.getElementById("manageReasonWrap").insertAdjacentHTML("afterend", `<button class="btn btn-outline" id="submitOrderRejection" type="button" hidden>Confirm rejection</button>`);
const cancelButton = document.getElementById("submitOrderRejection");
actions.addEventListener("click", event => { if (event.target.closest('[data-next-status="Rejected"]')) cancelButton.hidden = false; });
cancelButton.addEventListener("click", () => {
  const reason = document.getElementById("manageCancelReason").value.trim();
  const result = api.setOrderStatus(orderId, "Rejected", { pharmacyId, reason });
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage(`Order ${result.order.reference} was rejected. Reserved stock was returned.`); cancelButton.hidden = true; renderPage();
});
actions.addEventListener("click", event => {
  const button = event.target.closest('[data-next-status="Completed"]');
  if (!button || button.dataset.confirming !== "true") return;
  if (!document.getElementById("manageCollectionVerified").checked) { showMessage("Confirm delivery to the customer before completing this step.", true); return; }
  const result = api.setOrderStatus(orderId, "Completed", { pharmacyId, saleVerified: true, paymentCollected: orderIsCashOnDelivery });
  if (!result.ok) { showMessage(result.error, true); return; }
  showMessage("Sale completed and verified. Eligible commission was submitted for review."); renderPage();
});

api.subscribe(renderPage);
renderPage();
