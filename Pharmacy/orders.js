const pharmacyApi = window.CarePlusPharmacy;
const rows = document.getElementById("myOrderRows");
const filter = document.getElementById("orderStatusFilter");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function renderOrders() {
  const customer = pharmacyApi.currentCustomer();
  if (!customer) { rows.innerHTML = `<div class="empty">Sign in with a customer account to view your orders.</div>`; return; }
  const normalize = value => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[value] || value || "Pending");
  const stages = ["Pending", "Accepted", "Preparing", "Ready for Pickup", "Completed"];
  const orders = pharmacyApi.listOrders().filter(order => String(order.userId) === customer.userId).sort((a,b) => new Date(b.placedAt || b.createdAt) - new Date(a.placedAt || a.createdAt)).filter(order => !filter.value || normalize(order.status) === filter.value);
  rows.innerHTML = orders.length ? orders.map(order => {
    const items = (order.items || []).map(line => {
      const image = line.image ? `<img class="my-order-medicine-image" src="${escapeHtml(line.image)}" alt="${escapeHtml(line.name || "Medicine")}" loading="lazy">` : "";
      return `<div class="my-order-medicine">${image}<span><b>${escapeHtml(line.name || "Medicine")}</b><small>${Number(line.quantity) || 0} × JOD ${Number(line.unitPrice ?? line.price ?? 0).toFixed(2)}</small></span></div>`;
    }).join("");
    const state = normalize(order.status), history = Array.isArray(order.statusHistory) && order.statusHistory.length ? order.statusHistory : [{ status: "Pending", at: order.placedAt || order.createdAt, actor: "Customer" }];
    const canCancel = ["Pending", "Accepted", "Preparing"].includes(state);
    const chargeBreakdown = `Medicine JOD ${Number(order.subtotal ?? order.total).toFixed(2)} + CarePlus JOD ${Number(order.customerCommissionAmount || 0).toFixed(2)} + ${order.deliveryZoneLabel || pharmacyApi.deliveryZoneLabel(order.deliveryZone)} delivery JOD ${Number(order.deliveryFee || 0).toFixed(2)}`;
    const commissionStatus = order.paymentDemoResult === "simulated-success" ? "Demo Simulated" : (order.commissionPaymentStatus || order.paymentStatus || "Pending");
    const paymentLink = state === "Accepted" && order.paymentStatus === "Pending" && order.paymentDemoResult !== "simulated-success"
      ? `<a class="delivery-payment-note" href="payment.html?orderId=${encodeURIComponent(order.id)}">Pay CarePlus commission</a>`
      : `<span class="delivery-payment-note">Medicine and delivery: cash on delivery · CarePlus commission: ${escapeHtml(order.paymentDemoResult === "simulated-success" ? "Demo payment submitted (no charge)" : commissionStatus === "Awaiting Pharmacy Acceptance" ? "Pay after pharmacy accepts" : commissionStatus)}</span>`;
    const timeline = state === "Rejected" || state === "Cancelled" ? [...stages.slice(0, Math.max(1, stages.indexOf(state))), state] : stages;
    const currentIndex = stages.indexOf(state);
    const progress = (state === "Rejected" || state === "Cancelled") ? "" : `style="--progress:${currentIndex < 0 ? 0 : currentIndex / (stages.length - 1) * 100}%"`;
    const steps = timeline.map(step => {
      const record = history.slice().reverse().find(entry => normalize(entry.status) === step);
      const recorded = Boolean(record || step === "Pending");
      return `<li class="${recorded ? "is-recorded" : ""} ${step === state ? "is-current" : ""}"><i></i><span><b>${escapeHtml(step === "Pending" ? "Order received" : step)}</b><small>${record?.at ? new Date(record.at).toLocaleString() : recorded ? new Date(order.placedAt || order.createdAt).toLocaleString() : "Waiting"}</small></span></li>`;
    }).join("");
    const reason = order.rejectionReason || order.cancelReason;
    return `<article class="my-order-card" data-order-card="${escapeHtml(order.id)}"><div class="my-order-main"><div><small>${escapeHtml(order.reference || order.id)} · ${new Date(order.placedAt || order.createdAt).toLocaleString()}</small><h3>${escapeHtml(order.pharmacyName || "CarePlus pharmacy")}</h3><div class="my-order-medicines">${items}</div><p><b>Delivery address:</b> ${escapeHtml(order.deliveryAddress || "Not provided")}</p></div><span class="order-state ${state.toLowerCase().replace(/[^a-z]+/g,"-")}">${escapeHtml(state)}</span></div><ol class="customer-order-timeline" ${progress}>${steps}</ol>${reason ? `<p class="order-rejection-reason"><b>Reason:</b> ${escapeHtml(reason)}</p>` : ""}<div class="my-order-meta"><span>Payment: <b>${escapeHtml(order.paymentStatus || "Pending")}</b></span><span>Total: <b>JOD ${Number(order.total).toFixed(2)}</b></span><span>${escapeHtml(chargeBreakdown)}</span>${paymentLink}${canCancel ? `<button type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel order</button>` : ""}</div></article>`;
  }).join("") : `<div class="empty">No medicine orders match this filter.</div>`;
  const targetOrder = new URLSearchParams(location.search).get("orderId");
  if (targetOrder) requestAnimationFrame(() => rows.querySelector(`[data-order-card="${CSS.escape(targetOrder)}"]`)?.scrollIntoView({ block: "center" }));
}

filter.addEventListener("change", renderOrders);
rows.addEventListener("click", async event => {
  const button = event.target.closest("[data-cancel-order]");
  if (!button) return;
  const customer = pharmacyApi.currentCustomer();
  if (!customer) return;
  const reason = await requestCancellationReason();
  if (!reason) return;
  const result = pharmacyApi.cancelCustomerOrder(button.dataset.cancelOrder, customer.userId, reason);
  if (!result.ok) { window.alert(result.error); return; }
  renderOrders();
});
pharmacyApi.subscribe(renderOrders);
renderOrders();

function requestCancellationReason() {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "customer-cancel-dialog";
    dialog.setAttribute("aria-labelledby", "cancelOrderTitle");
    dialog.innerHTML = `<form method="dialog"><div class="cancel-dialog-heading"><h2 id="cancelOrderTitle">Cancel your order?</h2><button type="submit" value="back" formnovalidate aria-label="Close">×</button></div><p>Please tell us why you are cancelling. Your reason will be shared with the pharmacy and CarePlus admin.</p><label for="customerCancelReason">Cancellation reason</label><textarea id="customerCancelReason" required maxlength="1000" rows="4" placeholder="Write your reason here…"></textarea><p class="cancel-error" role="alert"></p><div class="cancel-dialog-actions"><button type="submit" value="back" formnovalidate>Keep order</button><button type="submit" value="cancel" class="confirm-cancel">Cancel order</button></div></form>`;
    dialog.querySelector("form").addEventListener("submit", event => {
      if (event.submitter?.value !== "cancel") return;
      if (!dialog.querySelector("textarea").value.trim()) {
        event.preventDefault();
        dialog.querySelector(".cancel-error").textContent = "Enter a cancellation reason.";
        dialog.querySelector("textarea").focus();
      }
    });
    dialog.addEventListener("close", () => {
      const reason = dialog.returnValue === "cancel" ? dialog.querySelector("textarea").value.trim() : "";
      dialog.remove();
      resolve(reason);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("textarea").focus();
  });
}
