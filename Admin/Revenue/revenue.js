(() => {
  const store = window.CarePlusData;
  const root = document.querySelector("[data-revenue-page]");
  if (!store || !root) return;

  const sources = [
    { id: "pharmacy", name: "Pharmacies", color: "#13a8a1" },
    { id: "doctors", name: "Doctors", color: "#3986ed" },
    { id: "store", name: "Medical Store", color: "#8061da" },
    { id: "ai", name: "AI Services", color: "#f3984c" },
    { id: "care", name: "Elderly Home Care", color: "#e7bd48" }
  ];
  const pageSize = 10;
  const state = { period: "all", from: "", to: "", source: "", status: "", query: "", sourceQuery: "", page: 0, sort: "net", direction: -1 };
  const $ = selector => root.querySelector(selector);
  const money = value => `JOD ${Number(value || 0).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const localDate = date => { const value = String(date || ""); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const recordDate = row => row.refundedAt || row.refundDate || row.paidAt || row.saleCompletedAt || row.deliveredAt || row.completedAt || row.placedAt || row.createdAt || row.date || "";
  const isComplete = row => ["completed", "delivered"].includes(String(row.status || "").toLowerCase());
  const isCancelled = row => ["cancelled", "canceled", "rejected"].includes(String(row.status || "").toLowerCase());
  const isRefunded = row => String(row.paymentStatus || "").toLowerCase() === "refunded" || String(row.refundStatus || "").toLowerCase() === "refunded";
  const isFailed = row => String(row.paymentStatus || "").toLowerCase() === "failed";
  const isPending = row => ["pending", "pending deposit", "awaiting payment", "unpaid"].includes(String(row.paymentStatus || "").toLowerCase()) || ["pending", "pending deposit", "pending payment"].includes(String(row.depositPaymentStatus || "").toLowerCase());
  const isDemo = row => [row.source, row.paymentStatus, row.payment, row.paymentMethod, row.paymentVerification, row.paymentVerificationMethod, row.paymentMethodLabel]
    .some(value => /demo|simulat|profile-demo-seed/i.test(String(value || "")));
  const hasVerifiedPayment = row => (row.paymentVerified === true || row.paymentVerificationStatus === "Verified" || row.paymentVerification === "Verified") && !isDemo(row);
  const isVerified = row => String(row.paymentStatus || "").toLowerCase() === "paid" && hasVerifiedPayment(row);
  const isVerifiedRefund = row => isRefunded(row) && hasVerifiedPayment(row);
  const amountOf = (...values) => { for (const value of values) { const amount = Number(value); if (Number.isFinite(amount) && amount > 0) return amount; } return 0; };
  const provider = row => row.pharmacyName || row.doctor || row.providerName || row.provider || "CarePlus";
  const customer = row => row.customerName || row.patient || row.client || row.elderlyName || row.customer?.fullName || row.customerReference || "Customer";

  function normalize(source, row) {
    const when = recordDate(row);
    const base = {
      id: String(row.id || row.reference || "-"), source: source.id, sourceName: source.name,
      record: row, date: when, customer: customer(row), provider: provider(row),
      relatedId: row.reference || row.id || "-", amount: 0, grossAmount: 0,
      pendingAmount: 0, unverifiedAmount: 0, commission: 0, commissionReversed: 0, refunds: 0, net: 0,
      completedTransaction: false, paymentVerified: false, status: "Pending",
      statusKey: "pending", settlement: row.commissionStatus || "Not recorded",
      earned: false, awaitingSettlement: 0
    };
    const paymentStatus = String(row.paymentStatus || "Pending");
    const paymentLower = paymentStatus.toLowerCase();
    const complete = isComplete(row);
    let expected = 0;
    let collected = 0;
    let commission = 0;
    let commissionEligible = false;

    if (source.id === "pharmacy") {
      expected = amountOf(row.total, Number(row.subtotal || 0) + Number(row.deliveryFee || 0));
      if (isVerified(row)) collected = amountOf(row.paidAmount, row.total);
      commissionEligible = complete && collected > 0;
      const rate = Number(row.commissionRate);
      commission = commissionEligible
        ? amountOf(row.commissionAmount, Number(row.commissionEligibleSales || row.subtotal || 0) * (Number.isFinite(rate) ? rate : 0) / 100)
        : 0;
    } else if (source.id === "doctors") {
      const fee = amountOf(row.consultationFee, row.total);
      const splitPayment = row.depositPaymentStatus != null || row.balancePaymentStatus != null;
      expected = splitPayment ? amountOf(row.depositAmount, fee) : fee;
      if (isVerified(row)) {
        if (splitPayment) {
          if (String(row.depositPaymentStatus || "").toLowerCase() === "paid") collected += amountOf(row.depositPaid, row.depositAmount);
          if (String(row.balancePaymentStatus || "").toLowerCase() === "paid") collected += amountOf(row.balancePaidAmount, row.balancePaid, row.remainingBalance);
          if (row.balancePaymentStatus === "Paid" && collected === 0) collected = fee;
        } else collected = amountOf(row.paidAmount, row.paymentAmount, row.total, row.consultationFee);
      }
      if (collected > 0 && row.balancePaymentStatus !== "Paid") expected = amountOf(row.remainingBalance, expected);
      const uniqueCommission = !row.commissionAppointmentId || String(row.commissionAppointmentId) === String(row.id);
      commissionEligible = complete && (!splitPayment || row.balancePaymentStatus === "Paid") && collected >= fee && uniqueCommission;
      commission = commissionEligible ? amountOf(row.commissionAmount, fee * Number(row.commissionRate ?? 10) / 100) : 0;
    } else if (source.id === "store") {
      expected = amountOf(row.total, row.subtotal);
      if (isVerified(row)) collected = amountOf(row.paidAmount, row.total);
      commissionEligible = complete && collected > 0;
      // Store records do not currently include vendor costs or the platform share.
      commission = commissionEligible ? amountOf(row.carePlusNetRevenue, row.platformRevenue, row.netPlatformRevenue) : 0;
    } else if (source.id === "care") {
      expected = amountOf(row.paymentAmount, row.estimatedTotal);
      if (isVerified(row)) collected = amountOf(row.paidAmount, row.paymentAmount);
      const accepted = ["accepted", "approved"].includes(String(row.status || "").toLowerCase());
      if (!row.paymentStatus && accepted) expected = amountOf(row.paymentAmount, row.estimatedTotal);
      commissionEligible = complete && collected > 0;
      const baseAmount = amountOf(row.estimatedBaseAmount);
      const rate = Number(row.careCommissionRate);
      commission = commissionEligible
        ? amountOf(row.careCommissionAmount, row.commissionAmount, baseAmount * (Number.isFinite(rate) ? rate : 0) / 100)
        : 0;
    }

    if (isFailed(row)) return { ...base, amount: expected, status: "Failed", statusKey: "failed", settlement: "Not earned" };

    if (isRefunded(row)) {
      const verifiedRefund = isVerifiedRefund(row);
      const originalValue = source.id === "doctors"
        ? amountOf(Number(row.depositPaid || 0) + Number(row.balancePaidAmount || row.balancePaid || 0), row.paidAmount, row.total, row.consultationFee)
        : amountOf(row.paidAmount, row.paymentAmount, row.total, row.consultationFee, row.depositPaid);
      const refund = verifiedRefund ? amountOf(row.refundAmount, originalValue) : 0;
      const refundRatio = originalValue > 0 ? Math.min(1, refund / originalValue) : 1;
      let originalCommission = 0;
      if (verifiedRefund && source.id === "pharmacy" && complete) {
        const rate = Number(row.commissionRate);
        originalCommission = amountOf(row.commissionAmount, Number(row.commissionEligibleSales || row.subtotal || 0) * (Number.isFinite(rate) ? rate : 0) / 100);
      }
      if (verifiedRefund && source.id === "doctors" && complete && (!row.balancePaymentStatus || row.balancePaymentStatus === "Paid")) {
        originalCommission = amountOf(row.commissionAmount, amountOf(row.consultationFee) * Number(row.commissionRate ?? 10) / 100);
      }
      if (verifiedRefund && source.id === "care" && complete) originalCommission = amountOf(row.careCommissionAmount, row.commissionAmount);
      if (verifiedRefund && source.id === "store" && complete) originalCommission = amountOf(row.carePlusNetRevenue, row.platformRevenue, row.netPlatformRevenue);
      originalCommission *= refundRatio;
      const reversed = verifiedRefund ? amountOf(row.commissionReversedAmount, originalCommission) : 0;
      return {
        ...base, amount: refund ? -refund : -expected, grossAmount: verifiedRefund ? originalValue : 0,
        refunds: refund, commission: originalCommission, commissionReversed: reversed, net: originalCommission - reversed,
        paymentVerified: verifiedRefund, completedTransaction: Boolean(verifiedRefund && complete),
        status: verifiedRefund ? "Refunded" : "Refund - unverified", statusKey: "refunded",
        settlement: row.commissionStatus || "Refund verification required", earned: originalCommission > 0,
        awaitingSettlement: Math.max(0, originalCommission - reversed - amountOf(row.commissionPaidAmount))
      };
    }

    const paidEvidence = isVerified(row);
    if (isCancelled(row)) {
      return { ...base, amount: paidEvidence ? collected : expected, grossAmount: paidEvidence ? collected : 0, paymentVerified: paidEvidence, status: "Cancelled", statusKey: "cancelled", settlement: row.commissionStatus || "Not earned" };
    }

    if (paidEvidence) {
      const reversed = amountOf(row.commissionReversedAmount);
      const commissionPaid = amountOf(row.commissionPaidAmount);
      let status = "Payment verified - service incomplete";
      if (commissionEligible) status = source.id === "store" && commission === 0 ? "Completed - platform share not recorded" : "Completed - verified";
      const commissionStatus = row.commissionStatus || (commissionEligible ? "Pending settlement" : "Not earned");
      const awaitingSettlement = commissionEligible && !["paid", "settled"].includes(commissionStatus.toLowerCase())
        ? Math.max(0, commission - reversed - commissionPaid)
        : 0;
      return {
        ...base, amount: collected, grossAmount: collected, commission, net: (commissionEligible ? commission : 0) - reversed,
        paymentVerified: true, completedTransaction: Boolean(complete && collected > 0),
        status, statusKey: "verified", settlement: commissionStatus,
        earned: commissionEligible && commission > 0, awaitingSettlement
      };
    }

    const acceptedCarePayment = source.id === "care" && expected > 0
      && ["accepted", "approved"].includes(String(row.status || "").toLowerCase()) && !row.paymentStatus;
    if (isPending(row) || paymentLower === "pending" || source.id === "doctors" && row.status === "Pending Deposit" || acceptedCarePayment) {
      return { ...base, amount: expected, pendingAmount: expected, status: source.id === "doctors" ? "Deposit pending" : "Pending", statusKey: "pending", settlement: "Not earned" };
    }

    const paidLabel = paymentLower === "paid" || paymentLower.startsWith("demo") || Boolean(row.paymentVerification || row.paymentDemoResult);
    const unverifiedAmount = paidLabel ? expected : 0;
    let settlement = row.commissionStatus || "No verified payment";
    if (complete && expected > 0) settlement = "Payment verification unavailable";
    if (source.id === "store" && complete && expected > 0) settlement = "Platform share and payment verification unavailable";
    return {
      ...base, amount: expected, unverifiedAmount, status: paidLabel ? "Paid - unverified / demo" : paymentStatus,
      statusKey: "unverified", settlement
    };
  }

  function collectAll() {
    const orders = store.list("orders");
    const appointments = store.list("appointments").filter(row => !row.commissionAppointmentId || String(row.commissionAppointmentId) === String(row.id));
    const care = store.list("careRequests");
    return [
      ...orders.filter(row => row.source === "pharmacy-order").map(row => normalize(sources[0], row)),
      ...appointments.filter(row => row.consultationFee || row.depositAmount || row.paymentStatus || row.commissionAmount).map(row => normalize(sources[1], row)),
      ...orders.filter(row => row.source === "store-checkout").map(row => normalize(sources[2], row)),
      ...care.filter(row => row.paymentStatus || row.paymentAmount || row.paidAt || row.refundStatus || row.refundAmount || ["accepted", "approved"].includes(String(row.status || "").toLowerCase()) && row.estimatedTotal).map(row => normalize(sources[4], row))
    ].filter(item => item.date);
  }

  function getRange() {
    const now = new Date(); const today = localDate(now); const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (state.period === "all") return ["0000-01-01", today];
    if (state.period === "today") return [today, today];
    if (state.period === "7days") { const from = new Date(now); from.setDate(from.getDate() - 6); return [localDate(from), today]; }
    if (state.period === "lastMonth") { const from = new Date(now.getFullYear(), now.getMonth() - 1, 1); const to = new Date(now.getFullYear(), now.getMonth(), 0); return [localDate(from), localDate(to)]; }
    if (state.period === "custom") return [state.from || "0000-01-01", state.to || "9999-12-31"];
    return [localDate(start), today];
  }
  function inRange(item, range) { const date = localDate(item.date); return date && date >= range[0] && date <= range[1]; }
  const jod = value => money(value);
  const sourceFor = id => sources.find(source => source.id === id);

  function summarize(rows) {
    return sources.map(source => {
      const items = rows.filter(item => item.source === source.id);
      const completed = items.filter(item => item.completedTransaction);
      const gross = items.reduce((sum, item) => sum + item.grossAmount, 0);
      const commission = items.reduce((sum, item) => sum + Math.max(0, item.commission - item.commissionReversed), 0);
      const refunds = items.reduce((sum, item) => sum + item.refunds, 0);
      const pending = items.filter(item => item.statusKey === "pending").length;
      const verifiedAmount = items.filter(item => item.paymentVerified).reduce((sum, item) => sum + item.grossAmount, 0);
      const pendingAmount = items.reduce((sum, item) => sum + item.pendingAmount, 0);
      const unverifiedAmount = items.reduce((sum, item) => sum + item.unverifiedAmount, 0);
      const awaitingSettlement = items.reduce((sum, item) => sum + item.awaitingSettlement, 0);
      const settlement = [...new Set(items.filter(item => item.earned).map(item => item.settlement).filter(Boolean))];
      const net = items.reduce((sum, item) => sum + item.net, 0);
      let status = "No verified revenue";
      if (source.id === "ai") status = "AI payment records are not connected";
      else if (settlement.length) status = settlement.join(", ");
      else if (pending) status = "Awaiting payment";
      else if (unverifiedAmount) status = "Payment verification unavailable";
      else if (!items.length) status = "No transaction records";
      return { ...source, gross, count: completed.length, commission, refunds, net, pending, pendingAmount, unverifiedAmount, awaitingSettlement, status, items, verifiedAmount };
    });
  }

  function periodLabel() { return ({ all: "All time", today: "Today", "7days": "Last 7 days", month: "This month", lastMonth: "Last month", custom: "Custom range" })[state.period]; }
  function renderStats(allRows, rows) {
    const summaries = summarize(rows);
    const totalNet = summaries.reduce((sum, item) => sum + item.net, 0);
    const totalCommission = summaries.reduce((sum, item) => sum + item.commission, 0);
    const completedCount = summaries.reduce((sum, item) => sum + item.count, 0);
    const pendingRows = rows.filter(item => item.statusKey === "pending" && item.pendingAmount > 0);
    const pendingAmount = pendingRows.reduce((sum, item) => sum + item.pendingAmount, 0);
    const currentMonthStart = new Date(); currentMonthStart.setDate(1);
    const currentMonthRows = allRows.filter(item => inRange(item, [localDate(currentMonthStart), localDate(new Date())]));
    const monthNet = summarize(currentMonthRows).reduce((sum, item) => sum + item.net, 0);
    $("[data-total-revenue]").textContent = jod(totalNet);
    $("[data-total-transactions]").textContent = completedCount.toLocaleString("en");
    $("[data-total-commissions]").textContent = jod(totalCommission);
    $("[data-pending-payments]").textContent = jod(pendingAmount);
    $("[data-pending-count]").textContent = `${pendingRows.length} pending payment records`;
    $("[data-month-revenue]").textContent = jod(monthNet);
  }

  function renderDonut(summaries) {
    const total = summaries.reduce((sum, item) => sum + item.net, 0);
    $("[data-donut-total]").textContent = jod(total);
    const slices = summaries.filter(item => item.net > 0); let stop = 0;
    const gradient = slices.length && total > 0 ? slices.map(item => { const from = stop; stop += item.net / total * 100; return `${item.color} ${from}% ${stop}%`; }).join(",") : "#eaf0f3 0 100%";
    $("[data-donut]").style.background = `conic-gradient(${gradient})`;
    $("[data-source-legend]").innerHTML = summaries.map(item => `<div class="legend-row"><i class="legend-dot" style="background:${item.color}"></i><span>${safe(item.name)}</span><strong>${jod(item.net)}</strong><small>${total > 0 ? (item.net / total * 100).toFixed(1) : "0.0"}% - Collected ${jod(item.verifiedAmount)} - Pending ${jod(item.pendingAmount)} - Unverified ${jod(item.unverifiedAmount)}</small></div>`).join("");
  }

  function renderTrend(rows, range) {
    const svg = $("[data-trend]"); const empty = $("[data-trend-empty]");
    const revenueRows = rows.filter(item => item.paymentVerified && item.net !== 0);
    if (!revenueRows.length) { svg.innerHTML = ""; empty.hidden = false; return; }
    empty.hidden = true;
    const from = new Date(`${range[0]}T00:00:00`); const to = new Date(`${range[1]}T00:00:00`);
    const dayCount = Math.max(1, Math.floor((to - from) / 86400000) + 1);
    const bucketCount = Math.min(14, dayCount);
    const values = Array(bucketCount).fill(0);
    revenueRows.forEach(item => { const d = new Date(`${localDate(item.date)}T00:00:00`); const offset = Math.floor((d - from) / 86400000); const index = Math.min(bucketCount - 1, Math.floor(Math.max(0, offset) / dayCount * bucketCount)); values[index] += item.net; });
    const min = Math.min(...values, 0), max = Math.max(...values, 1); const span = Math.max(1, max - min); const left = 38, top = 12, width = 660, height = 188; const points = values.map((value, index) => [left + (bucketCount === 1 ? width / 2 : index / (bucketCount - 1) * width), top + height - (value - min) / span * height]);
    const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
    const area = `${path} L${points.at(-1)[0].toFixed(1)} ${top + height} L${points[0][0].toFixed(1)} ${top + height} Z`;
    const grid = [0, 1, 2, 3].map(index => { const y = top + index * height / 3; const amount = max - span * index / 3; return `<line class="trend-grid" x1="${left}" y1="${y}" x2="${left + width}" y2="${y}"/><text class="trend-axis" x="1" y="${y + 3}">${amount.toFixed(0)}</text>`; }).join("");
    const labels = [0, Math.floor((bucketCount - 1) / 2), bucketCount - 1].map(index => { const d = new Date(from); d.setDate(d.getDate() + Math.round(index / Math.max(1, bucketCount - 1) * (dayCount - 1))); return `<text class="trend-axis" x="${points[index][0]}" y="228" text-anchor="middle">${safe(d.toLocaleDateString("en", { month: "short", day: "numeric" }))}</text>`; }).join("");
    svg.innerHTML = `<defs><linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#13a8a1" stop-opacity=".25"/><stop offset="100%" stop-color="#13a8a1" stop-opacity=".01"/></linearGradient></defs>${grid}<path class="trend-area" d="${area}"/><path class="trend-line" d="${path}"/>${points.map(point => `<circle class="trend-point" cx="${point[0]}" cy="${point[1]}" r="4"><title>${jod(values[points.indexOf(point)])}</title></circle>`).join("")}${labels}`;
  }

  function renderSources(summaries) {
    const query = state.sourceQuery.toLowerCase(); const shown = summaries.filter(item => item.name.toLowerCase().includes(query));
    const sorted = [...shown].sort((a, b) => { const av = a[state.sort], bv = b[state.sort]; const result = typeof av === "string" ? av.localeCompare(bv) : av - bv; return result * state.direction; });
    $("[data-source-rows]").innerHTML = sorted.map(item => `<tr><td><span class="source-name"><i style="background:${item.color}"></i>${safe(item.name)}</span></td><td class="revenue-number">${jod(item.gross)}</td><td>${item.count}</td><td>${jod(item.commission)}</td><td>${jod(item.refunds)}</td><td class="revenue-number">${jod(item.net)}</td><td><span class="settlement-status"><span>${safe(item.status)}</span><small>${item.pending} pending - ${jod(item.awaitingSettlement)} to settle</small></span></td><td><button class="source-detail-button" type="button" data-source-details="${item.id}">View</button></td></tr>`).join("");
    $("[data-source-empty]").hidden = shown.length > 0;
  }

  function renderSourceFilter() {
    const select = $("[data-source-filter]"); const old = state.source;
    select.innerHTML = `<option value="">All sources</option>${sources.map(item => `<option value="${item.id}">${safe(item.name)}</option>`).join("")}`;
    select.value = old;
  }
  function transactionRows(allRows, range) {
    return allRows.filter(item => inRange(item, range)).filter(item => !state.source || item.source === state.source)
      .filter(item => !state.status || item.statusKey === state.status)
      .filter(item => { const query = state.query.toLowerCase(); return !query || [item.id, item.sourceName, item.relatedId, item.customer, item.provider, item.status].join(" ").toLowerCase().includes(query); })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  function renderTransactions(allRows, range) {
    const filtered = transactionRows(allRows, range); const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); state.page = Math.min(state.page, pages - 1);
    const pageRows = filtered.slice(state.page * pageSize, (state.page + 1) * pageSize);
    $("[data-transactions]").innerHTML = pageRows.map(item => `<tr><td class="transaction-id">${safe(item.id)}</td><td>${safe(item.sourceName)}</td><td>${safe(item.relatedId)}</td><td>${safe(item.customer)}<small>${safe(item.provider)}</small></td><td>${jod(item.amount)}</td><td>${jod(item.commission)}</td><td><span class="status-pill ${item.statusKey}">${safe(item.status)}</span></td><td>${safe(localDate(item.date) || "—")}</td><td><button class="source-detail-button" type="button" data-transaction-details="${safe(item.id)}">View</button></td></tr>`).join("");
    $("[data-transactions-empty]").hidden = pageRows.length > 0;
    $("[data-page-info]").textContent = filtered.length ? `${state.page * pageSize + 1}–${Math.min((state.page + 1) * pageSize, filtered.length)} of ${filtered.length} transactions` : "0 transactions";
    $("[data-prev]").disabled = state.page <= 0; $("[data-next]").disabled = state.page >= pages - 1;
    $("[data-transactions-title]").textContent = state.source ? `${sourceFor(state.source)?.name || "Source"} transactions` : "Transactions";
  }

  function openDetails(sourceId, allRows, range) {
    const source = sourceFor(sourceId); if (!source) return;
    const items = allRows.filter(item => item.source === sourceId && inRange(item, range)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $("[data-dialog-title]").textContent = `${source.name} · ${items.length} records`;
    $("[data-dialog-body]").innerHTML = items.length ? items.map(item => `<div class="dialog-transaction"><strong>${safe(item.id)} · ${safe(item.customer)}</strong><b>${jod(item.amount)}</b><span>${safe(item.status)} · ${safe(localDate(item.date) || "No date")}</span><span>${safe(item.provider)}</span><em>Related ${safe(item.relatedId)} · Commission ${jod(item.commission)} · ${safe(item.settlement)}</em></div>`).join("") : `<div class="table-empty">No transactions for ${safe(source.name)} in this period.</div>`;
    $("[data-details-dialog]").showModal();
  }

  function render() {
    const range = getRange(); const allRows = collectAll(); const rows = allRows.filter(item => inRange(item, range)); const summaries = summarize(rows);
    $("[data-period-caption]").textContent = periodLabel(); $("[data-trend-caption]").textContent = periodLabel();
    renderStats(allRows, rows); renderDonut(summaries); renderTrend(rows, range); renderSources(summaries); renderTransactions(allRows, range);
  }

  $("[data-period]").addEventListener("change", event => {
    state.period = event.target.value; document.querySelectorAll(".custom-date").forEach(label => { label.hidden = state.period !== "custom"; }); state.page = 0; render();
  });
  $("[data-date-from]").addEventListener("change", event => { state.from = event.target.value; state.page = 0; render(); });
  $("[data-date-to]").addEventListener("change", event => { state.to = event.target.value; state.page = 0; render(); });
  $("[data-source-filter]").addEventListener("change", event => { state.source = event.target.value; state.page = 0; render(); });
  $("[data-status-filter]").addEventListener("change", event => { state.status = event.target.value; state.page = 0; render(); });
  $("[data-transaction-search]").addEventListener("input", event => { state.query = event.target.value; state.page = 0; render(); });
  $("[data-source-search]").addEventListener("input", event => { state.sourceQuery = event.target.value; render(); });
  root.addEventListener("click", event => {
    const sort = event.target.closest("[data-sort]");
    if (sort) { const key = sort.dataset.sort; state.direction = state.sort === key ? -state.direction : -1; state.sort = key; render(); return; }
    const detail = event.target.closest("[data-source-details]");
    if (detail) { state.source = detail.dataset.sourceDetails; $("[data-source-filter]").value = state.source; state.page = 0; const range = getRange(); openDetails(state.source, collectAll(), range); render(); }
    const transactionDetail = event.target.closest("[data-transaction-details]");
    if (transactionDetail) {
      const item = collectAll().find(row => row.id === transactionDetail.dataset.transactionDetails);
      if (item) {
        $("[data-dialog-title]").textContent = `${item.sourceName} · ${item.id}`;
        $("[data-dialog-body]").innerHTML = `<div class="dialog-transaction"><strong>Payment status</strong><b>${safe(item.status)}</b><span>Related record</span><span>${safe(item.relatedId)}</span><span>Customer</span><span>${safe(item.customer)}</span><span>Provider</span><span>${safe(item.provider)}</span><span>Transaction amount</span><span>${jod(item.amount)}</span><span>CarePlus commission</span><span>${jod(item.commission)}</span><span>Net platform revenue</span><span>${jod(item.net)}</span><em>Date ${safe(localDate(item.date) || "—")} · Settlement ${safe(item.settlement)}</em></div>`;
        $("[data-details-dialog]").showModal();
      }
    }
  });
  $("[data-prev]").addEventListener("click", () => { state.page = Math.max(0, state.page - 1); render(); });
  $("[data-next]").addEventListener("click", () => { state.page += 1; render(); });
  $("[data-dialog-close]").addEventListener("click", () => $("[data-details-dialog]").close());
  $("[data-details-dialog]").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  renderSourceFilter(); render(); store.subscribe(render);
})();
