(() => {
  const store = window.CarePlusData, pharmacy = window.CarePlusPharmacy, clinic = window.CarePlusClinic;
  const root = document.querySelector("[data-finance-page]");
  if (!store || !pharmacy || !root) return;
  const menuToggle = document.querySelector(".menu-toggle");
  const closeNavigation = () => {
    document.body.classList.remove("sidebar-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  };
  menuToggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar-open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close admin navigation" : "Open admin navigation");
  });
  document.querySelectorAll(".side-nav a").forEach(link => link.addEventListener("click", closeNavigation));
  document.addEventListener("click", event => {
    if (document.body.classList.contains("sidebar-open") && !event.target.closest(".sidebar, .menu-toggle")) closeNavigation();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeNavigation(); });
  const services = [
    { key: "pharmacy", label: "Pharmacies", icon: '<svg viewBox="0 0 24 24"><path d="M8 4.5a4.5 4.5 0 0 1 6.36 0l5.14 5.14a4.5 4.5 0 0 1-6.36 6.36L8 10.86A4.5 4.5 0 0 1 8 4.5Z"/><path d="m10 12 6-6"/></svg>', color: "#168f9b" },
    { key: "doctor", label: "Doctors", icon: '<svg viewBox="0 0 24 24"><path d="M6 20v-1.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5V20"/><circle cx="12" cy="7" r="4"/><path d="M19 5v6m-3-3h6"/></svg>', color: "#4d82ed" },
    { key: "care", label: "Elderly Care", icon: '<svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z"/><path d="M7.5 12h2.8l1.3-2.5 2 5 1.2-2.5h1.7"/></svg>', color: "#41a37d" },
    { key: "store", label: "Medical Store", icon: '<svg viewBox="0 0 24 24"><path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z"/><path d="m4 12.5 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/></svg>', color: "#9a7bd3" },
    { key: "ai", label: "AI Services", icon: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 5.5a3 3 0 0 0-3 3 3.5 3.5 0 0 0 0 7 3 3 0 0 0 3 3m8-13a3 3 0 0 1 3 3 3.5 3.5 0 0 1 0 7 3 3 0 0 1-3 3"/><path d="M8 8h4m-5 4h5m-4 4h4m4-8h-4m5 4h-5m4 4h-4"/></svg>', color: "#e0a53a" }
  ];
  const $ = selector => root.querySelector(selector);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const money = value => "JOD " + n(value).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateKey = value => { const d = new Date(value || ""); return Number.isNaN(d.getTime()) ? "" : d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dateLabel = value => { const d = new Date(value || ""); return Number.isNaN(d.getTime()) ? "Date unavailable" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); };
  const done = status => ["completed", "delivered"].includes(String(status || "").toLowerCase());
  const refundState = record => String(record.paymentStatus || "").toLowerCase();
  const isDemo = record => /demo|simulat/i.test(String(record.paymentStatus || "") + " " + String(record.paymentVerification || "") + " " + String(record.paymentVerificationMethod || "") + " " + String(record.paymentMode || "") + " " + String(record.paymentDemoResult || "")) || record.demo === true || record.demoPaymentStatus === "Succeeded";
  const isPaid = record => String(record.paymentStatus || "").toLowerCase() === "paid" && record.paymentVerified === true;
  const paidDate = record => record.paymentVerifiedAt || record.paidAt || record.completedAt || record.saleCompletedAt || record.placedAt || record.createdAt || record.date || "";
  const labelFor = key => services.find(service => service.key === key)?.label || "AI services";

  function makeTransaction(record, config) {
    const total = n(config.total), costKnown = config.costKnown !== false;
    const fail = String(record.paymentStatus || "").toLowerCase() === "failed";
    const refundText = refundState(record);
    const refund = refundText === "refunded" || total > 0 && n(record.refundedAmount) >= total;
    const partial = !refund && (["partially refunded", "partial refund"].includes(refundText) || n(record.refundedAmount) > 0);
    const demo = isDemo(record);
    let status = fail ? "Failed" : refund ? "Refunded" : partial ? "Partially Refunded" : demo ? "Demo / Not charged" : (record.paymentStatus || "Pending");
    if (config.service === "store" && done(record.status) && isPaid(record) && !costKnown && !refund) status = "Needs cost data";
    const eligible = done(record.status) && isPaid(record) && !refund && !partial && !demo && costKnown;
    const grossPaid = done(record.status) && isPaid(record) && !refund && !demo
      ? Math.max(0, n(config.paidAmount == null ? total : config.paidAmount) - n(record.refundedAmount)) : 0;
    const revenue = eligible ? Math.max(0, config.service === "store" || config.service === "ai" ? grossPaid - n(config.cost) : n(config.commission)) : 0;
    return {
      id: String(config.txId || record.transactionReference || record.paymentReference || record.reference || record.id || ""),
      transactionId: String(config.txId || record.transactionReference || record.paymentReference || record.reference || record.id || ""),
      customer: config.customer || record.customerName || record.patient || record.client || record.customer?.fullName || "Customer not recorded",
      service: config.service, serviceLabel: labelFor(config.service), provider: config.provider || "Provider not recorded",
      relatedId: String(config.related || record.reference || record.id || ""), total, grossPaid, commission: eligible ? revenue : n(config.commission),
      providerEarnings: eligible ? n(config.providerEarnings) : 0, paymentMethod: record.paymentMethod || record.payment || "Not recorded",
      status, date: paidDate(record), revenue, eligible, eligibleForGross: grossPaid > 0, costKnown, record, recordType: config.type,
      paymentVerified: record.paymentVerified === true, refundAmount: n(record.refundedAmount), demo, completionStatus: record.status || "Not recorded"
    };
  }

  function buildTransactions() {
    const rows = [];
    store.list("orders").forEach(order => {
      if (order.source === "pharmacy-order") {
        const subtotal = n(order.subtotal || order.total);
        const fee = n(order.commissionAmount == null ? (order.customerCommissionAmount == null ? subtotal * Number(order.commissionRate || 0) / 100 : order.customerCommissionAmount) : order.commissionAmount);
        rows.push(makeTransaction(order, { type: "order", service: "pharmacy", total: order.total || subtotal, paidAmount: order.paidAmount || order.total || subtotal, commission: fee, providerEarnings: Math.max(0, subtotal - fee), provider: order.pharmacyName || store.get("pharmacies", order.pharmacyId)?.name, related: order.reference || order.id, txId: order.paymentReference || order.transactionReference || order.reference || order.id }));
      } else if (order.source === "store-checkout") {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemCostsKnown = items.length > 0 && items.every(item => Number.isFinite(Number(item.unitCost ?? item.cost ?? item.product?.unitCost ?? item.product?.cost)));
        const cost = itemCostsKnown ? items.reduce((sum, item) => sum + n(item.unitCost ?? item.cost ?? item.product?.unitCost ?? item.product?.cost) * n(item.quantity || 1), 0) : n(order.costOfGoods);
        const costKnown = itemCostsKnown || Number.isFinite(Number(order.costOfGoods)) || !done(order.status) || !isPaid(order);
        rows.push(makeTransaction(order, { type: "order", service: "store", total: order.total, paidAmount: order.paidAmount || order.total, commission: 0, providerEarnings: cost, provider: "CarePlus Medical Store", related: order.reference || order.id, txId: order.paymentReference || order.transactionReference || order.reference || order.id, cost, costKnown }));
      }
    });
    store.list("appointments").forEach(row => {
      if (row.source !== "user-booking" && row.consultationFee == null) return;
      const fee = n(row.consultationFee || row.totalPrice), commission = n(row.commissionAmount == null ? fee * Number(row.commissionRate || 0) / 100 : row.commissionAmount);
      rows.push(makeTransaction(row, { type: "appointment", service: "doctor", total: row.totalPaid || fee, paidAmount: row.totalPaid || (isPaid(row) ? fee : n(row.depositPaid)), commission, providerEarnings: Math.max(0, fee - commission), provider: row.doctor, related: row.id, txId: row.transactionReference || row.paymentReference || row.id, customer: row.patient }));
    });
    store.list("careRequests").forEach(row => {
      if (row.source !== "user-request" && row.totalPrice == null) return;
      const total = n(row.totalPrice || row.estimatedTotal), commission = n(row.careCommissionAmount == null ? total * Number(row.careCommissionRate || 0) / 100 : row.careCommissionAmount);
      const providerName = row.assignedNurseName || (row.assignedNurseId ? "Nurse " + row.assignedNurseId : "CarePlus care provider");
      rows.push(makeTransaction(row, { type: "careRequest", service: "care", total, paidAmount: row.totalPaid || (isPaid(row) ? total : n(row.depositPaid)), commission, providerEarnings: Math.max(0, total - commission), provider: providerName, related: row.id, txId: row.transactionReference || row.paymentReference || row.demoTransactionReference || row.id, customer: row.client }));
    });
    try {
      const aiRows = JSON.parse(localStorage.getItem("careplusAiTransactionsV1") || "[]");
      if (Array.isArray(aiRows)) aiRows.forEach(row => rows.push(makeTransaction(row, { type: "aiTransaction", service: "ai", total: row.amount || row.total, paidAmount: row.paidAmount || row.amount || row.total, commission: row.amount || row.total, providerEarnings: 0, provider: row.packageName || row.planLabel || row.period || row.plan || "CarePlus AI", related: row.subscriptionId || row.sessionId || row.id, txId: row.transactionId || row.id, customer: row.customerName || row.customer })));
    } catch {}
    const seen = new Set();
    return rows.filter(row => { const key = row.service + ":" + row.recordType + ":" + row.relatedId; if (seen.has(key)) return false; seen.add(key); return true; });
  }

  function hasSitePayment(row) {
    const record = row.record || {};
    const status = String(record.paymentStatus || row.status || "").toLowerCase();
    return row.grossPaid > 0 || status === "paid" || row.demo && (n(record.depositPaid) > 0 || n(record.paymentAmount) > 0 || row.total > 0)
      || record.demoPaymentStatus === "Succeeded" && n(record.depositPaid) > 0;
  }
  function sitePaymentAmount(row) {
    const record = row.record || {};
    const amount = row.grossPaid || n(record.paidAmount) || n(record.paymentAmount) || n(record.totalPaid) || n(record.depositPaid) || (String(record.paymentStatus || "").toLowerCase() === "paid" ? row.total : 0) || (row.demo ? row.total : 0);
    return Math.max(0, amount - n(record.refundedAmount));
  }
  function renderMetrics(rows) {
    const serviceAmounts = services.map(service => ({ ...service, amount: rows.filter(row => row.service === service.key && hasSitePayment(row)).reduce((sum, row) => sum + sitePaymentAmount(row), 0) }));
    const total = serviceAmounts.reduce((sum, item) => sum + item.amount, 0);
    const totalCard = '<article class="admin-ui-metric"><span class="admin-ui-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v4c0 1.7 3.4 3 7.5 3 .8 0 1.6-.1 2.3-.2M19.5 6v3"/><path d="M4.5 10v4c0 1.7 3.4 3 7.5 3M19.5 9c0 1.7-3.4 3-7.5 3"/><path d="M4.5 14v4c0 1.7 3.4 3 7.5 3m2-5.5 2 2 4-4"/></svg></span><p>Total Revenue</p><strong>' + money(total) + '</strong><small>' + rows.filter(hasSitePayment).length + ' recorded transactions</small></article>';
    $("#finance-metrics").innerHTML = totalCard + serviceAmounts.map(service => {
      return '<article class="admin-ui-metric"><span class="admin-ui-metric-icon" aria-hidden="true">' + service.icon + '</span><p>' + esc(service.label) + ' Revenue</p><strong>' + money(service.amount) + '</strong><small><button type="button" class="finance-provider-details" data-service-breakdown="' + esc(service.key) + '">View details</button></small></article>';
    }).join("");
  }
  function openServiceBreakdown(serviceKey) {
    const service = services.find(item => item.key === serviceKey);
    if (!service) return;
    const grouped = new Map();
    ranged.filter(row => row.service === serviceKey && hasSitePayment(row)).forEach(row => {
      const provider = String(row.provider || "Provider not recorded").trim() || "Provider not recorded";
      const item = grouped.get(provider) || { provider, payments: 0, amount: 0 };
      item.payments += 1;
      item.amount += sitePaymentAmount(row);
      grouped.set(provider, item);
    });
    const list = [...grouped.values()].sort((a, b) => b.amount - a.amount);
    $("#service-breakdown-title").textContent = service.label + " payments";
    const total = list.reduce((sum, row) => sum + row.amount, 0);
    $("#service-breakdown-total").textContent = money(total);
    $("#service-breakdown-count").textContent = list.reduce((sum, row) => sum + row.payments, 0) + " payments";
    $("#service-breakdown-rows").innerHTML = list.map(row => {
      const initial = Array.from(row.provider.trim())[0]?.toUpperCase() || "•";
      return '<article class="provider-breakdown-item" style="--provider-color:' + service.color + '"><span class="provider-breakdown-avatar">' + esc(initial) + '</span><span class="provider-breakdown-copy"><strong>' + esc(row.provider) + '</strong><small>' + row.payments + (row.payments === 1 ? " payment" : " payments") + '</small></span><b>' + money(row.amount) + "</b></article>";
    }).join("");
    $("#service-breakdown-empty").hidden = list.length > 0;
    $("#service-breakdown-dialog").showModal();
  }
  function renderPie(rows) {
    const data = services.map(service => Object.assign({}, service, { value: rows.filter(row => hasSitePayment(row) && row.service === service.key).reduce((sum, row) => sum + sitePaymentAmount(row), 0) }));
    const total = data.reduce((sum, row) => sum + row.value, 0), circumference = 2 * Math.PI * 62;
    let offset = 0;
    const circles = total ? data.filter(row => row.value > 0).map(row => {
      const len = row.value / total * circumference, html = '<circle class="pie-slice" cx="100" cy="100" r="62" stroke="' + row.color + '" stroke-dasharray="' + len + " " + (circumference - len) + '" stroke-dashoffset="' + (-offset) + '"><title>' + esc(row.label) + ": " + money(row.value) + "</title></circle>";
      offset += len; return html;
    }).join("") : "";
    $("#revenue-pie").innerHTML = '<circle class="pie-track" cx="100" cy="100" r="62"></circle>' + circles + '<text class="pie-center-total" x="100" y="97">' + (total ? esc(money(total).replace("JOD ", "")) : "0.00") + '</text><text class="pie-center-label" x="100" y="113">JOD payments</text>';
    $("#revenue-legend").innerHTML = data.map(row => '<div class="legend-row"><i class="legend-swatch" style="--swatch:' + row.color + '"></i><span>' + esc(row.label) + '</span><strong>' + (row.value && total ? (row.value / total * 100).toFixed(1) + "%" : money(row.value)) + "</strong></div>").join("");
  }
  function renderBars(rows) {
    const data = services.map(service => Object.assign({}, service, { value: rows.filter(row => row.eligible && row.service === service.key).reduce((sum, row) => sum + row.revenue, 0) }));
    const max = Math.max(0, ...data.map(row => row.value));
    $("#revenue-bars").innerHTML = data.map(row => '<div class="bar-row"><span class="bar-label">' + esc(row.label) + '</span><span class="bar-track"><i class="bar-fill" style="--bar-color:' + row.color + ";width:" + (max ? Math.max(row.value ? 1 : 0, row.value / max * 100) : 0) + '%"></i></span><span class="bar-value">' + money(row.value) + "</span></div>").join("");
  }
  function renderLine(rows) {
    const now = new Date(), months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { date, key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), label: date.toLocaleDateString(undefined, { month: "short" }), value: 0 };
    });
    rows.filter(hasSitePayment).forEach(row => { const month = months.find(item => item.key === dateKey(row.date).slice(0, 7)); if (month) month.value += sitePaymentAmount(row); });
    const max = Math.max(1, ...months.map(item => item.value)), left = 54, right = 886, top = 22, bottom = 184;
    const points = months.map((item, index) => Object.assign({}, item, { x: left + index * (right - left) / (months.length - 1), y: bottom - item.value / max * (bottom - top) }));
    const path = points.map((point, index) => (index ? "L" : "M") + point.x + "," + point.y).join(" ");
    const ticks = [0, .5, 1].map(ratio => { const y = bottom - ratio * (bottom - top); return '<line class="line-grid" x1="' + left + '" y1="' + y + '" x2="' + right + '" y2="' + y + '"></line><text class="line-y-label" x="45" y="' + (y + 3) + '">' + (max * ratio).toFixed(0) + "</text>"; }).join("");
    const dots = points.map(point => '<circle class="line-point" cx="' + point.x + '" cy="' + point.y + '" r="3.5"><title>' + esc(point.label + " " + point.date.getFullYear() + ": " + money(point.value)) + '</title></circle><text class="line-label" x="' + point.x + '" y="207">' + esc(point.label) + "</text>").join("");
    $("#revenue-line").innerHTML = '<defs><linearGradient id="financeLineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#17bcc3" stop-opacity=".2"></stop><stop offset="1" stop-color="#17bcc3" stop-opacity="0"></stop></linearGradient></defs>' + ticks + '<path class="line-area" d="' + path + " L" + right + "," + bottom + " L" + left + "," + bottom + ' Z"></path><path class="line-path" d="' + path + '"></path>' + dots;
  }
  let transactionRows = [];
  let showAllTransactions = false;
  function renderTransactions(rows) {
    const query = $("#transaction-search").value.trim().toLowerCase();
    const service = $("#transaction-service").value;
    transactionRows = rows.filter(hasSitePayment).filter(row => {
      const searchable = [row.transactionId, row.relatedId, row.customer, row.provider, row.serviceLabel, row.paymentMethod, row.status].join(" ").toLowerCase();
      return (!query || searchable.includes(query)) && (!service || row.service === service);
    }).slice().sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const visible = showAllTransactions ? transactionRows : transactionRows.slice(0, 5);
    $("#transaction-count").textContent = transactionRows.length + (transactionRows.length === 1 ? " transaction" : " transactions");
    $("#transactions-view-all").hidden = transactionRows.length <= 5;
    $("#transactions-view-all").textContent = showAllTransactions ? "Show Less ↑" : "View All →";
    $("#transactions-view-all").setAttribute("aria-expanded", String(showAllTransactions));
    $("#recent-transactions-empty").hidden = transactionRows.length > 0;
    $("#recent-transactions-empty").textContent = query || service ? "No transactions match your search or service filter." : "No payment transactions recorded yet.";
    $("#recent-transaction-rows").innerHTML = visible.map((row, index) => {
      return '<tr><td><strong title="' + esc(row.customer) + '">' + esc(row.customer) + '</strong></td><td><span class="finance-service-name"><i style="--service-color:' + esc(services.find(item => item.key === row.service)?.color || "#078f98") + '"></i>' + esc(row.serviceLabel) + '</span></td><td><button type="button" class="finance-row-details" data-recent-detail="' + index + '">View details</button></td></tr>';
    }).join("");
  }
  let ranged = [];
  function render() {
    ranged = buildTransactions();
    renderMetrics(ranged);
    renderPie(ranged);
    renderLine(buildTransactions());
    renderTransactions(ranged);
  }
  function openDetails(row) {
    document.getElementById("transaction-dialog-title").textContent = row.transactionId || row.relatedId;
    const fields = [
      ["Transaction ID", row.transactionId], ["Customer", row.customer], ["Service", row.serviceLabel], ["Provider", row.provider],
      ["Related order / booking", row.relatedId], ["Gross transaction amount", money(row.total)], ["Amount recorded on site", money(sitePaymentAmount(row))],
      ["CarePlus commission / net", row.eligible ? money(row.revenue) : row.status === "Needs cost data" ? "Unavailable · product costs missing" : money(row.commission)],
      ["Provider earnings", row.eligible ? money(row.providerEarnings) : "Not realized"], ["Payment method", row.paymentMethod],
      ["Payment status", row.status], ["Completion status", row.completionStatus], ["Payment verified", row.paymentVerified ? "Yes" : "No"],
      ["Refund amount", money(row.refundAmount)], ["Transaction date", dateLabel(row.date)], ["Source record type", row.recordType],
      ["Simulated payment record", row.demo ? "Yes" : "No"]
    ];
    if (row.record?.refundReason) fields.push(["Refund reason", row.record.refundReason]);
    if (row.record?.rejectionReason || row.record?.cancelReason) fields.push(["Status reason", row.record.rejectionReason || row.record.cancelReason]);
    document.getElementById("transaction-detail-grid").innerHTML = fields.map(field => '<div class="finance-detail"><small>' + esc(field[0]) + '</small><strong>' + esc(field[1] || "Not recorded") + "</strong></div>").join("");
    document.getElementById("transaction-dialog").showModal();
  }
  function csvCell(value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }
  function exportCsv(rows, filename) {
    const headings = ["Transaction ID", "Customer", "Service Type", "Provider", "Order or booking ID", "Total Transaction Amount (JOD)", "CarePlus Commission or Net (JOD)", "Provider Earnings or Costs (JOD)", "Payment Method", "Payment Status", "Transaction Date", "Payment Verified", "Realized Revenue (JOD)"];
    const lines = rows.map(row => [row.transactionId, row.customer, row.serviceLabel, row.provider, row.relatedId, row.total.toFixed(2), (row.eligible ? row.revenue : row.commission).toFixed(2), row.providerEarnings.toFixed(2), row.paymentMethod, row.status, dateLabel(row.date), row.paymentVerified ? "Yes" : "No", row.eligible ? row.revenue.toFixed(2) : "0.00"]);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + [headings].concat(lines).map(line => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  $("#transaction-search").addEventListener("input", () => renderTransactions(ranged));
  $("#transaction-service").addEventListener("change", () => renderTransactions(ranged));
  $("#transactions-view-all").addEventListener("click", () => { showAllTransactions = !showAllTransactions; renderTransactions(ranged); });
  $("#recent-transaction-rows").addEventListener("click", event => {
    const button = event.target.closest("[data-recent-detail]");
    if (button) openDetails(transactionRows[Number(button.dataset.recentDetail)]);
  });
  document.querySelectorAll("[data-transaction-close]").forEach(button => button.addEventListener("click", () => $("#transaction-dialog").close()));
  $("#transaction-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  $("#finance-metrics").addEventListener("click", event => {
    const button = event.target.closest("[data-service-breakdown]");
    if (button) openServiceBreakdown(button.dataset.serviceBreakdown);
  });
  document.querySelectorAll("[data-breakdown-close]").forEach(button => button.addEventListener("click", () => $("#service-breakdown-dialog").close()));
  $("#service-breakdown-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  store.subscribe(render);
  render();
})();
