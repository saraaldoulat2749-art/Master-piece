(() => {
  const $ = selector => document.querySelector(selector);
  const usagePrefix = "careplusAiAttempts:";
  const accessPrefix = "careplusAiAccessUntil:";
  const eventKey = "careplusAiUsageEventsV1";
  const paymentKey = "careplusAiTransactionsV1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = amount => "JOD " + Math.max(0, Number(amount) || 0).toFixed(2);
  const menuToggle = document.querySelector(".menu-toggle");
  const closeMenu = () => { document.body.classList.remove("sidebar-open"); menuToggle?.setAttribute("aria-expanded", "false"); };
  menuToggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", event => { if (document.body.classList.contains("sidebar-open") && !event.target.closest(".sidebar,.menu-toggle")) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  const readList = key => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
  const identityMask = identity => {
    const value = String(identity || "unknown");
    return value.includes("@") ? value.slice(0, 1) + "•••@" + value.split("@").pop() : value.length > 5 ? value.slice(0, 2) + "•••" + value.slice(-2) : value;
  };
  const identities = () => {
    const users = new Map();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith(usagePrefix) && !key.startsWith(accessPrefix)) continue;
      const identity = key.slice(key.indexOf(":") + 1).toLowerCase();
      if (!identity) continue;
      const row = users.get(identity) || { identity, free: 0, accessUntil: 0 };
      if (key.startsWith(usagePrefix)) row.free = Math.min(3, Math.max(0, Number(localStorage.getItem(key)) || 0));
      if (key.startsWith(accessPrefix)) row.accessUntil = Number(localStorage.getItem(key)) || 0;
      users.set(identity, row);
    }
    return [...users.values()];
  };
  const groupedUsage = period => {
    const events = readList(eventKey);
    const now = new Date();
    const items = period === "daily"
      ? Array.from({ length: 7 }, (_, i) => { const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i); return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString(undefined, { weekday: "short" }), value: 0 }; })
      : Array.from({ length: 6 }, (_, i) => { const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), label: date.toLocaleDateString(undefined, { month: "short" }), value: 0 }; });
    events.forEach(event => {
      const date = new Date(event.at || ""); if (Number.isNaN(date.getTime())) return;
      const key = period === "daily" ? date.toISOString().slice(0, 10) : date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      const bucket = items.find(item => item.key === key); if (bucket) bucket.value += 1;
    });
    return { items, count: events.length };
  };
  function renderChart() {
    const { items, count } = groupedUsage($("[data-usage-period]").value);
    const max = Math.max(1, ...items.map(item => item.value));
    $("[data-usage-chart]").innerHTML = items.map(item => '<div class="ai-usage-row"><span>' + esc(item.label) + '</span><span class="ai-usage-track"><i class="ai-usage-fill" style="display:block;width:' + (item.value ? Math.max(2, item.value / max * 100) : 0) + '%"></i></span><strong class="ai-usage-value">' + item.value + "</strong></div>").join("");
    $("[data-usage-note]").textContent = count ? "Showing " + count.toLocaleString() + " recorded sessions. Only sessions logged after usage tracking was enabled appear in the timeline." : "No timestamped usage history has been recorded yet.";
  }
  function renderAccounts() {
    const query = $("[data-ai-search]").value.trim().toLowerCase();
    const filter = $("[data-ai-access-filter]").value;
    const now = Date.now();
    const events = readList(eventKey);
    const rows = identities().filter(row => {
      const access = row.accessUntil > now ? "Active" : "Free";
      return (!query || row.identity.includes(query)) && (!filter || filter === access);
    }).sort((a, b) => b.accessUntil - a.accessUntil || b.free - a.free);
    $("[data-ai-account-count]").textContent = rows.length + " accounts";
    $("[data-ai-accounts-empty]").hidden = rows.length > 0;
    $("[data-ai-accounts]").innerHTML = rows.map(row => {
      const sessions = events.filter(event => String(event.identity || "").toLowerCase() === row.identity).length;
      const active = row.accessUntil > now;
      return '<tr><td><strong title="' + esc(row.identity) + '">' + esc(identityMask(row.identity)) + '</strong></td><td>' + row.free + '</td><td>' + sessions + '</td><td>' + (row.accessUntil ? esc(new Date(row.accessUntil).toLocaleString()) : "—") + '</td><td><span class="ai-state ' + (active ? "active" : "") + '">' + (active ? "Active access" : "Free plan") + '</span></td><td>' + (active ? '<button type="button" class="ai-revoke" data-revoke="' + esc(row.identity) + '">Revoke</button>' : "—") + '</td></tr>';
    }).join("");
    rows.forEach(row => {
      const tr = Array.from($("[data-ai-accounts]").rows).find(item => item.cells[0]?.querySelector("strong")?.title === row.identity);
      if (!tr || tr.cells.length < 6) return;
      const accountCell = tr.cells[0];
      const statusCell = tr.cells[4];
      const actionCell = tr.cells[5];
      tr.replaceChildren(accountCell, statusCell, actionCell);
      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "ai-details-button";
      detailsButton.dataset.details = row.identity;
      detailsButton.textContent = "View details";
      actionCell.replaceChildren(detailsButton);
    });
    const free = rows.reduce((sum, row) => sum + row.free, 0);
    const paid = events.filter(event => event.paidAccess === true).length;
    $("[data-ai-users]").textContent = String(rows.length);
    $("[data-ai-free]").textContent = String(free);
    $("[data-ai-paid-sessions]").textContent = String(paid);
    $("[data-ai-consults]").textContent = String(Math.max(events.length, free + paid));
    $("[data-ai-active]").textContent = String(rows.filter(row => row.accessUntil > now).length);
    const mixTotal = free + paid;
    const circumference = 2 * Math.PI * 48;
    const freeLength = mixTotal ? circumference * free / mixTotal : 0;
    const paidLength = mixTotal ? circumference * paid / mixTotal : 0;
    $("[data-session-mix]").innerHTML = '<div class="ai-mix-content"><svg class="ai-mix-chart" viewBox="0 0 140 140" role="img" aria-label="Free and paid AI session distribution"><circle class="ai-mix-track" cx="70" cy="70" r="48"></circle><circle class="ai-mix-segment ai-mix-free" cx="70" cy="70" r="48" stroke-dasharray="' + freeLength + ' ' + circumference + '"></circle><circle class="ai-mix-segment ai-mix-paid" cx="70" cy="70" r="48" stroke-dasharray="' + paidLength + ' ' + circumference + '" stroke-dashoffset="-' + freeLength + '"></circle><text class="ai-mix-total" x="70" y="68" text-anchor="middle">' + mixTotal + '</text><text class="ai-mix-caption" x="70" y="85" text-anchor="middle">sessions</text></svg><div class="ai-mix-legend"><div class="ai-mix-row"><i style="--mix-color:#4d82ed"></i><span>Free attempts</span><strong>' + free + '</strong></div><div class="ai-mix-row"><i style="--mix-color:#168f9b"></i><span>Paid access sessions</span><strong>' + paid + '</strong></div></div></div>';
  }
  function renderPayments() {
    const query = $("[data-payment-search]").value.trim().toLowerCase();
    const filter = $("[data-payment-filter]").value;
    const rows = readList(paymentKey).filter(row => {
      const status = row.demo === true || /demo|simulat/i.test(String(row.paymentStatus || "")) ? "Demo / Not charged" : String(row.paymentStatus || "Pending");
      return (!query || (String(row.transactionId || row.id || "") + " " + String(row.customer || row.customerName || "")).toLowerCase().includes(query)) && (!filter || status === filter);
    }).sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0));
    $("[data-ai-payment-count]").textContent = rows.length + " payments";
    $("[data-ai-payments-empty]").hidden = rows.length > 0;
    $("[data-ai-payments]").innerHTML = rows.map(row => {
      const status = row.demo === true || /demo|simulat/i.test(String(row.paymentStatus || "")) ? "Demo / Not charged" : String(row.paymentStatus || "Pending");
      return '<tr><td><strong>' + esc(row.transactionId || row.id || "—") + '</strong></td><td title="' + esc(row.customer || row.customerName || "") + '">' + esc(identityMask(row.customer || row.customerName || "unknown")) + '</td><td>' + esc(row.planLabel || row.period || row.plan || "AI access") + '</td><td>' + money(row.amount || row.total) + '</td><td><span class="ai-state ' + (status.startsWith("Demo") ? "demo" : status === "Paid" ? "paid" : "") + '">' + esc(status) + '</span></td><td>' + esc(new Date(row.paidAt || row.createdAt || "").toLocaleString() === "Invalid Date" ? "—" : new Date(row.paidAt || row.createdAt).toLocaleString()) + "</td></tr>";
    }).join("");
    const realized = rows.filter(row => row.paymentVerified === true && row.paymentStatus === "Paid" && row.demo !== true);
    $("[data-ai-revenue]").textContent = money(realized.reduce((sum, row) => sum + (Number(row.amount || row.total) || 0), 0));
  }
  function render() { renderChart(); renderAccounts(); renderPayments(); }
  $("[data-usage-period]").addEventListener("change", renderChart);
  $("[data-ai-search]").addEventListener("input", renderAccounts);
  $("[data-ai-access-filter]").addEventListener("change", renderAccounts);
  $("[data-payment-search]").addEventListener("input", renderPayments);
  $("[data-payment-filter]").addEventListener("change", renderPayments);
  $("[data-ai-accounts]").addEventListener("click", event => {
    const button = event.target.closest("[data-details]"); if (!button) return;
    const id = button.dataset.details;
    const row = identities().find(item => item.identity === id);
    if (!row) return;
    const sessions = readList(eventKey).filter(item => String(item.identity || "").toLowerCase() === id).length;
    const active = row.accessUntil > Date.now();
    $("[data-ai-details-title]").textContent = identityMask(id);
    $("[data-ai-details-grid]").innerHTML = [
      ["Status", active ? "Active access" : "Free plan"],
      ["Free attempts used", row.free],
      ["AI sessions", sessions],
      ["Access ends", row.accessUntil ? new Date(row.accessUntil).toLocaleString() : "—"]
    ].map(([label, value]) => '<div class="ai-detail-item"><span>' + esc(label) + '</span><strong>' + esc(value) + "</strong></div>").join("");
    const revoke = $("[data-details-revoke]");
    revoke.hidden = !active;
    revoke.dataset.revoke = id;
    $("[data-ai-details-dialog]").showModal();
  });
  $("[data-details-revoke]").addEventListener("click", event => {
    const id = event.currentTarget.dataset.revoke;
    if (!window.confirm("Revoke active AI access for " + identityMask(id) + "?")) return;
    localStorage.removeItem(accessPrefix + id);
    $("[data-ai-details-dialog]").close();
    render();
    const toast = $("[data-ai-toast]"); toast.textContent = "AI access revoked."; toast.classList.add("is-visible"); setTimeout(() => toast.classList.remove("is-visible"), 2400);
  });
  document.querySelectorAll("[data-details-close]").forEach(button => button.addEventListener("click", () => $("[data-ai-details-dialog]").close()));
  $("[data-ai-details-dialog]").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  window.addEventListener("storage", render);
  render();
})();
