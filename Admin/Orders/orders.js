/* This page is read-only until an administrator explicitly saves a store status.
 * Pharmacy fulfilment remains with the pharmacy; its admin view is read-only.
 */
(() => {
  const storeStatuses = ["Placed", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
  const pharmacyStatuses = ["Pending", "Accepted", "Rejected", "Preparing", "Ready for Pickup", "Completed", "Cancelled"];
  const isPharmacy = order => order.source === "pharmacy-order";
  const normalizeStatus = status => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[String(status || "")] || String(status || "Not provided"));
  const customer = order => order.customerName || order.customer?.fullName || order.customerReference || "Not provided";
  const currentStatus = order => isPharmacy(order) ? normalizeStatus(order.status) : order.status || "Not provided";
  const reference = order => order.reference || order.id || "Not provided";
  const present = value => value !== null && value !== undefined && value !== "";
  const number = value => present(value) && Number.isFinite(Number(value)) ? Number(value) : null;
  const money = value => number(value) === null ? "Not provided" : `JOD ${Number(value).toFixed(2)}`;
  const dateText = value => {
    if (!value) return "Not provided";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not provided" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(date);
  };
  const needsAttention = order => isPharmacy(order)
    ? ["Pending", "Accepted", "Preparing", "Ready for Pickup"].includes(currentStatus(order)) || ["Completed"].includes(currentStatus(order)) && ["Pending Verification", "Awaiting Payment Verification"].includes(order.commissionStatus)
    : !["Delivered", "Completed", "Cancelled"].includes(order.status);
  function selectOrders(rows, type, state) {
    const query = state.query.trim().toLowerCase();
    const filtered = rows.filter(order => isPharmacy(order) === (type === "pharmacy") &&
      (!state.status || currentStatus(order) === state.status) &&
      (!query || [order.id, order.reference, customer(order), order.pharmacyName, data.get("pharmacies", order.pharmacyId)?.name].some(value => String(value || "").toLowerCase().includes(query))))
      .map((order, index) => ({ order, index }))
      .sort((a, b) => (Date.parse(b.order.createdAt || b.order.placedAt || "") || 0) - (Date.parse(a.order.createdAt || a.order.placedAt || "") || 0) || b.index - a.index)
      .map(item => item.order);
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    const page = Math.max(1, Math.min(state.page, pages));
    return { total: filtered.length, pages, page, rows: filtered.slice((page - 1) * 10, page * 10) };
  }
  function timeline(order) {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory.filter(item => item && typeof item === "object").map(item => ({ ...item, status: isPharmacy(order) ? normalizeStatus(item.status) : item.status })) : [];
    const stages = isPharmacy(order) ? ["Pending", "Accepted", "Preparing", "Ready for Pickup", "Completed"] : ["Placed", "Processing", "Out for Delivery", "Delivered"];
    if (order.status === "Shipped" || history.some(item => item.status === "Shipped")) stages.splice(stages.indexOf("Out for Delivery"), 0, "Shipped");
    if (order.status === "Pending" && !stages.includes("Pending")) stages.unshift("Pending");
    if (normalizeStatus(order.status) === "Rejected" || history.some(item => item.status === "Rejected")) stages.push("Rejected");
    else if (order.status === "Cancelled" || history.some(item => item.status === "Cancelled")) stages.push("Cancelled");
    const stamps = { Placed: order.placedAt, Pending: isPharmacy(order) ? order.placedAt : null, Accepted: order.acceptedAt || order.confirmedAt, Processing: order.processingAt, Preparing: order.preparingAt, Shipped: order.shippedAt, "Ready for Pickup": order.readyForPickupAt || order.outForDeliveryAt, Delivered: order.deliveredAt, Completed: order.completedAt, Rejected: order.rejectedAt, Cancelled: order.cancelledAt };
    return stages.map(status => {
      const event = history.slice().reverse().find(item => item.status === status);
      const at = event?.at || event?.timestamp || stamps[status] || (status === "Completed" ? order.completedAt : null);
      return { status, current: currentStatus(order) === status, recorded: Boolean(event || at || currentStatus(order) === status), at: at || null };
    });
  }

  const root = document.querySelector(".order-workspace");
  const data = window.CarePlusData;
  if (!root || !data) return;
  const $ = selector => root.querySelector(selector);
  const make = (tag, className = "", text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const badge = status => make("span", "order-badge order-badge--" + String(status).toLowerCase().replace(/[^a-z]+/g, "-"), status);
  const state = { store: { query: "", status: "", page: 1 }, pharmacy: { query: "", status: "", page: 1 } };
  let type = location.hash === "#pharmacy-orders" ? "pharmacy" : "store";
  let selectedId = null;
  const dialog = make("dialog", "order-detail-modal");
  dialog.setAttribute("aria-labelledby", "order-detail-title");
  document.body.append(dialog);
  const icons = {
    total: '<path d="M4 7h16v13H4zM8 7V4h8v3M8 11h8M8 15h5"/>',
    store: '<path d="M3 9h18l-2-5H5L3 9ZM5 9v11h14V9M9 20v-7h6v7"/>',
    pharmacy: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
    attention: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v1"/>'
  };
  let summarySignature = "";
  function summary(rows) {
    const pharmacyCount = rows.filter(isPharmacy).length;
    const metrics = [["total", "Total Orders", rows.length, "Across store and pharmacy"], ["store", "Store Orders", rows.length - pharmacyCount, "CarePlus store purchases"], ["pharmacy", "Pharmacy Orders", pharmacyCount, "Medicine service orders"], ["attention", "Needs Attention", rows.filter(needsAttention).length, "Open pharmacy orders · commission reviews"]];
    const signature = metrics.map(metric => metric[2]).join(":");
    if (signature === summarySignature) return;
    summarySignature = signature;
    const holder = $("[data-order-summary]"); holder.replaceChildren();
    metrics.forEach(([key, label, count, caption]) => {
      const card = make("article", "orders-metric");
      const icon = make("span", "orders-metric-icon " + key);
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[key] + '</svg>';
      card.append(icon, make("p", "orders-metric-label", label), make("strong", "", String(count)), make("small", "", caption)); holder.append(card);
    });
    root.querySelector('[data-tab-count="store"]').textContent = rows.length - pharmacyCount;
    root.querySelector('[data-tab-count="pharmacy"]').textContent = pharmacyCount;
  }
  function render() {
    const rows = data.list("orders"); summary(rows);
    const selected = state[type];
    root.querySelectorAll("[data-order-tab]").forEach(tab => {
      const active = tab.dataset.orderTab === type;
      tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1;
    });
    $("#orders-panel").setAttribute("aria-labelledby", type + "-tab");
    root.querySelector("[data-pharmacy-column]").hidden = type !== "pharmacy";
    root.querySelector("[data-commission-column]").hidden = type !== "pharmacy";
    $("#orders-search").value = selected.query;
    $("[data-clear-search]").hidden = !selected.query;
      const statuses = [...new Set([...(type === "store" ? ["Pending", ...storeStatuses] : pharmacyStatuses), ...rows.filter(row => isPharmacy(row) === (type === "pharmacy")).map(row => currentStatus(row)).filter(Boolean)])];
    const select = $("#orders-status");
    select.replaceChildren(new Option("All statuses", ""), ...statuses.map(status => new Option(status, status)));
    select.value = selected.status;
    const result = selectOrders(rows, type, selected); selected.page = result.page;
    const body = $("[data-managed-orders]"); body.replaceChildren();
    result.rows.forEach(order => {
      const row = make("tr");
      [reference(order), customer(order), ...(isPharmacy(order) ? [order.pharmacyName || data.get("pharmacies", order.pharmacyId)?.name || "Not provided"] : []), dateText(order.placedAt || order.createdAt), money(order.total), ...(isPharmacy(order) ? [`${money(order.commissionAmount)} · ${order.commissionStatus || "Not eligible"}`] : [])].forEach((value, i) => row.append(make("td", i === 0 ? "orders-ref" : "", value)));
      const statusCell = make("td");
      // Read exactly one status; never read select.textContent (all option labels).
      statusCell.append(badge(currentStatus(order))); row.append(statusCell);
      const actions = make("td"); const view = make("button", "order-view-button", "View details"); view.type = "button";
      view.setAttribute("aria-label", "View order " + reference(order)); view.addEventListener("click", () => openDetails(order.id));
      actions.append(view);
      row.append(actions); body.append(row);
    });
    $("[data-orders-no-results]").hidden = result.total > 0;
    $("[data-orders-range]").textContent = result.total ? "Showing " + ((result.page - 1) * 10 + 1) + "–" + Math.min(result.page * 10, result.total) + " of " + result.total + " orders" : "No orders to display";
    $("[data-page-label]").textContent = "Page " + result.page + " of " + result.pages;
    $("[data-page-prev]").disabled = result.page <= 1;
    $("[data-page-next]").disabled = result.page >= result.pages;
  }
  function detailsGrid(rows) {
    const list = make("dl", "order-detail-grid");
    rows.forEach(([label, value]) => {
      const field = make("div"); field.append(make("dt", "", label), make("dd", "", present(value) ? String(value) : "Not provided")); list.append(field);
    });
    return list;
  }
  function openDetails(id) {
    if (!window.CarePlusAuth?.hasDemoAdminSession()) return;
    const order = data.get("orders", id); if (!order) return;
    selectedId = id; dialog.replaceChildren();
    const header = make("header", "order-detail-header");
    const copy = make("div"); copy.append(make("p", "eyebrow", isPharmacy(order) ? "PHARMACY ORDER" : "STORE ORDER"));
    const title = make("h2", "", reference(order)); title.id = "order-detail-title"; copy.append(title, badge(currentStatus(order)));
    const close = make("button", "order-detail-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close order details"); close.addEventListener("click", () => dialog.close()); header.append(copy, close); dialog.append(header);
    const content = make("div", "order-detail-content");
    const section = (title, child) => { const block = make("section", "order-detail-section"); block.append(make("h3", "", title), child); content.append(block); return block; };
    section("Order Overview", detailsGrid([["Order ID", reference(order)], ["Customer Name", customer(order)], ["Order Date", dateText(order.placedAt || order.createdAt)], ["Current Status", currentStatus(order)], ...(isPharmacy(order) ? [["Pharmacy", order.pharmacyName || data.get("pharmacies", order.pharmacyId)?.name]] : [])]));
    const items = make("div", "order-items");
    const lines = Array.isArray(order.items) ? order.items.filter(line => line && typeof line === "object") : [];
    if (!lines.length) items.append(make("p", "order-muted", "Not provided"));
    lines.forEach(line => {
      const product = line.product || line;
      const quantity = number(line.quantity);
      const unit = number(line.unitPrice ?? line.price ?? product.price);
      const subtotal = line.subtotal ?? (quantity !== null && unit !== null ? quantity * unit : null);
      const item = make("article", "order-item"); item.append(make("strong", "", product.name || product.productName || line.medicineName || "Not provided"), detailsGrid([["Quantity", quantity], ["Unit price", money(unit)], ["Subtotal", money(subtotal)]])); items.append(item);
    });
    section("Order Items", items);
    section("Payment Summary", detailsGrid([["Total amount", money(order.total)], ["Payment method", order.paymentMethod || order.payment], ["Payment status", order.paymentStatus], ["Delivery fee", money(order.deliveryFee)], ...(isPharmacy(order) ? [["CarePlus fee", money(order.customerCommissionAmount)], ["Commission", money(order.commissionAmount)], ["Commission status", order.commissionStatus]] : [])]));
    section("Delivery Information", detailsGrid([["Delivery address", order.deliveryAddress || [order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(", ")], ["Contact phone", order.deliveryPhone || order.customer?.phone], ["Email", order.customer?.email], ["Delivery method", order.deliveryMethod], ["Delivery status", order.deliveryStatus || order.status], ["Instructions", order.customer?.instructions], ...(order.cancelReason ? [["Cancellation reason", order.cancelReason]] : [])]));
    const progress = make("ol", "order-timeline");
    timeline(order).forEach(step => {
      const item = make("li", (step.recorded ? "is-recorded " : "") + (step.current ? "is-current" : ""));
      item.append(make("span", "order-timeline-dot"), make("strong", "", step.status), make("small", "", step.at ? dateText(step.at) : step.current ? "Current status · time not recorded" : step.recorded ? "Recorded · time not provided" : "Not recorded")); progress.append(item);
    }); section("Order Progress", progress);
    if (!isPharmacy(order)) {
      const form = make("form", "order-status-editor"); const label = make("label", "", "Update store order status");
      const select = make("select"); select.setAttribute("aria-label", "New store order status");
      [...new Set([currentStatus(order), ...storeStatuses])].forEach(status => select.append(new Option(status, status))); select.value = currentStatus(order);
      label.append(select); const save = make("button", "order-primary", "Save status"); save.type = "submit"; save.disabled = true;
      const feedback = make("p", "order-save-feedback"); feedback.setAttribute("role", "status");
      select.addEventListener("change", () => { save.disabled = select.value === order.status; });
      let saving = false;
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (saving || !window.CarePlusAuth?.hasDemoAdminSession()) return;
        const latest = data.get("orders", id);
        if (!latest || isPharmacy(latest) || !storeStatuses.includes(select.value) || latest.status === select.value) return;
        saving = true; save.disabled = true;
        const status = select.value;
        const history = Array.isArray(latest.statusHistory) ? latest.statusHistory : [];
        const updated = data.update("orders", id, { status, statusHistory: [...history, { status, at: new Date().toISOString() }] });
        if (!updated) { saving = false; save.disabled = false; feedback.textContent = "Could not save this status. Please try again."; return; }
        openDetails(id);
        dialog.querySelector(".order-save-feedback").textContent = "Order status updated successfully.";
      }); form.append(label, save, feedback);
      const actionsSection = section("Update Order Status", form);
      content.insertBefore(actionsSection, content.children[1]);
    } else {
      section("Order Management", make("p", "order-muted", "Pharmacy fulfilment is managed by the pharmacy. Commission review is available in Admin Commissions."));
    }
    dialog.append(content);
    const footer = make("footer", "order-detail-footer"); const done = make("button", "order-primary", "Done"); done.type = "button"; done.addEventListener("click", () => dialog.close()); footer.append(done); dialog.append(footer);
    if (!dialog.open) dialog.showModal(); close.focus();
  }
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { selectedId = null; dialog.replaceChildren(); });
  function switchTab(next, focus = false) {
    type = next; render();
    const panel = $("#orders-panel"); panel.classList.remove("orders-tab-enter"); void panel.offsetWidth; panel.classList.add("orders-tab-enter");
    if (focus) root.querySelector('[data-order-tab="' + next + '"]').focus();
  }
  root.querySelectorAll("[data-order-tab]").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.orderTab));
    tab.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); switchTab(event.key === "Home" ? "store" : event.key === "End" ? "pharmacy" : type === "store" ? "pharmacy" : "store", true); }
    });
  });
  $("#orders-search").addEventListener("input", event => { state[type].query = event.target.value; state[type].page = 1; render(); });
  $("#orders-status").addEventListener("change", event => { state[type].status = event.target.value; state[type].page = 1; render(); });
  const clearSearch = () => { state[type].query = ""; state[type].page = 1; render(); $("#orders-search").focus(); };
  $("[data-clear-search]").addEventListener("click", clearSearch);
  $("#orders-search").addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); clearSearch(); } });
  $("[data-reset-orders]").addEventListener("click", () => { state[type] = { query: "", status: "", page: 1 }; render(); });
  $("[data-page-prev]").addEventListener("click", () => { state[type].page--; render(); });
  $("[data-page-next]").addEventListener("click", () => { state[type].page++; render(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#pharmacy-orders") switchTab("pharmacy"); });
  data.subscribe(() => { render(); if (dialog.open && selectedId) { if (data.get("orders", selectedId)) openDetails(selectedId); else dialog.close(); } });
  render();
})();
