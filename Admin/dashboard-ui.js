/* Visual summaries only. No account, booking, payment or inventory mutations. */
(() => {
  const adminNav = document.querySelector(".admin-layout .side-nav");
  if (adminNav && document.currentScript?.src) {
    const revenueUrl = new URL("Revenue/index.html", new URL(".", document.currentScript.src));
    const existingRevenueLink = Array.from(adminNav.querySelectorAll("a")).find(link => {
      try { return new URL(link.href, location.href).pathname === revenueUrl.pathname; } catch { return false; }
    });
    if (!existingRevenueLink) {
      const link = document.createElement("a");
      link.href = revenueUrl.href;
      link.innerHTML = "<span>◈</span>Revenue &amp; reports";
      adminNav.append(link);
      if (location.pathname === revenueUrl.pathname) link.classList.add("active");
    }
  }
  if (adminNav && document.currentScript?.src) {
    const base = new URL(".", document.currentScript.src);
    const sections = [
      ["index.html", "Dashboard", "D"], ["Users/index.html", "Users", "U"],
      ["Doctors/index.html", "Doctors", "D"], ["Pharmacies/index.html", "Pharmacies", "P"],
      ["Nurses/index.html", "Nurses", "N"], ["Appointments/index.html", "Appointments", "A"],
      ["Orders/index.html", "Medicine Orders", "M"], ["CareRequests/index.html", "Elderly Care", "C"],
      ["Products/index.html", "Medical Store", "S"], ["AIServices/index.html", "AI Services", "AI"],
      ["Revenue/index.html", "Revenue & reports", "R"]
    ];
    const links = sections.map(([route, label, glyph]) => {
      const target = new URL(route, base);
      let link = Array.from(adminNav.querySelectorAll("a")).find(item => {
        try { return new URL(item.href, location.href).pathname === target.pathname; } catch { return false; }
      });
      if (!link) { link = document.createElement("a"); link.href = target.href; link.innerHTML = "<span>" + glyph + "</span>"; }
      const icon = link.querySelector(":scope > span") || document.createElement("span");
      if (!icon.parentElement) link.prepend(icon);
      Array.from(link.childNodes).filter(node => node !== icon && node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
      icon.insertAdjacentText("afterend", label);
      link.href = target.href;
      const current = location.pathname === target.pathname || route === "Pharmacies/index.html" && location.pathname.includes("/Pharmacies/");
      link.classList.toggle("active", current);
      return link;
    });
    adminNav.replaceChildren(...links);
  }
  const counterSelector = ".admin-ui-metric > strong, .orders-metric > strong, .stat-card > strong, [data-animate-count]";
  const runningCounters = new WeakSet();
  const animateCounter = element => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (runningCounters.has(element)) return;
    const original = element.textContent.trim();
    const match = original.match(/^(\D*?)([\d,]+)(\D*)$/);
    if (!match) return;
    const target = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(target) || target < 1) return;
    runningCounters.add(element);
    const start = performance.now();
    const duration = 950;
    const tick = now => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = match[1] + Math.round(target * eased).toLocaleString() + match[3];
      if (progress < 1) requestAnimationFrame(tick);
      else { element.textContent = original; runningCounters.delete(element); }
    };
    element.textContent = match[1] + "0" + match[3];
    requestAnimationFrame(tick);
  };
  const scanCounters = root => {
    if (root.matches?.(counterSelector)) animateCounter(root);
    root.querySelectorAll?.(counterSelector).forEach(animateCounter);
  };
  scanCounters(document);
  new MutationObserver(records => records.forEach(record => {
    if (record.type === "childList") record.addedNodes.forEach(node => { if (node.nodeType === 1) scanCounters(node); });
    else if (!runningCounters.has(record.target.parentElement)) animateCounter(record.target.parentElement);
  })).observe(document.body, { childList: true, subtree: true, characterData: true });

  const store = window.CarePlusData;
  const page = document.querySelector("[data-admin-page]");
  const module = page?.dataset.adminPage;
  const configs = {
    users: rows => [["Total Users", rows.length, "Registered accounts"], ["Active Users", rows.filter(r => r.status === "Active").length, "Active account records"], ["Customers", rows.filter(r => String(r.role).toLowerCase() === "customer").length, "Customer accounts"], ["Staff Accounts", rows.filter(r => ["admin", "administrator", "doctor", "nurse", "pharmacy"].includes(String(r.role).toLowerCase())).length, "CarePlus service teams"]],
    products: rows => [["Total Products", rows.length, "Store catalogue records"], ["Available", rows.filter(r => r.inStock === true).length, "Marked available for purchase"], ["Out of Stock", rows.filter(r => Number(r.quantity ?? r.stock) === 0).length, "No remaining units"], ["Categories", new Set(rows.map(r => r.category).filter(Boolean)).size, "Product categories"]],
    pharmacies: rows => [["Total Pharmacies", rows.length, "Pharmacy directory records"], ["Active Pharmacies", rows.filter(r => r.status === "Active" && r.deleted !== true).length, "Active directory listings"], ["Currently Closed", rows.filter(r => r.open === false).length, "Marked closed by the pharmacy"], ["Cities / Areas", new Set(rows.map(r => r.city || r.area).filter(Boolean)).size, "Locations in the directory"]],
    careRequests: rows => [["Total Requests", rows.length, "Home and companion care"], ["Pending Requests", rows.filter(r => ["new", "pending", "requested", "pending payment", "reviewing", "contacted"].includes(String(r.status).toLowerCase())).length, "Awaiting payment or care review"], ["In Progress", rows.filter(r => r.status === "In Progress").length, "Care visits underway"], ["Completed", rows.filter(r => ["Completed", "Closed"].includes(r.status)).length, "Finished care visits"]],
    appointments: rows => [["Total Appointments", rows.length, "Doctor appointment records"], ["Awaiting Action", rows.filter(r => ["Requested", "Pending Deposit"].includes(r.status)).length, "Pending requests and deposits"], ["Confirmed", rows.filter(r => r.status === "Confirmed").length, "Confirmed appointments"], ["Completed", rows.filter(r => r.status === "Completed").length, "Finished appointments"]]
  };
  if (store && module === "dashboard") {
    const readAi = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
    const isArchived = row => row.archived === true || Boolean(row.archivedAt);
    const paidAndVerified = row => row.paymentVerified === true && String(row.paymentStatus || "").toLowerCase() === "paid" && row.demo !== true && row.paymentMode !== "demo";
    const completed = row => ["completed", "delivered"].includes(String(row.status || "").toLowerCase());
    const money = amount => "JOD " + (Number(amount) || 0).toFixed(2);
    const renderDashboard = () => {
      const users = store.list("users").filter(row => !isArchived(row));
      const appointments = store.list("appointments").filter(row => !isArchived(row));
      const pharmacies = store.list("pharmacies").filter(row => !isArchived(row) && row.deleted !== true);
      const care = store.list("careRequests").filter(row => !isArchived(row));
      const orders = store.list("orders").filter(row => !isArchived(row));
      const count = (id, value) => { const node = document.getElementById("count-" + id); if (node) node.textContent = String(value); };
      count("users", users.length);
      count("doctors", users.filter(row => String(row.role).toLowerCase() === "doctor").length);
      count("nurses", users.filter(row => String(row.role).toLowerCase() === "nurse").length);
      count("pharmacies", pharmacies.length);
      count("appointments", appointments.length);
      count("careRequests", care.length);
      count("medicine-orders", orders.filter(row => row.source === "pharmacy-order").length);
      count("store-orders", orders.filter(row => row.source === "store-checkout").length);
      const growth = document.getElementById("user-growth-chart");
      if (growth) {
        const svgNs = "http://www.w3.org/2000/svg";
        const months = Array.from({ length: 6 }, (_, index) => new Date(new Date().getFullYear(), new Date().getMonth() - 5 + index, 1));
        const values = months.map(month => users.filter(user => { const date = new Date(user.createdAt || ""); return Number.isFinite(date.getTime()) && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(); }).length);
        const max = Math.max(1, ...values);
        growth.replaceChildren();
        const baseline = document.createElementNS(svgNs, "line"); baseline.setAttribute("x1", "24"); baseline.setAttribute("x2", "408"); baseline.setAttribute("y1", "142"); baseline.setAttribute("y2", "142"); baseline.setAttribute("stroke", "#dce9ee"); growth.append(baseline);
        values.forEach((value, index) => {
          const x = 38 + index * 63; const height = value ? Math.max(8, value / max * 100) : 3;
          const bar = document.createElementNS(svgNs, "rect"); bar.setAttribute("x", String(x)); bar.setAttribute("y", String(142 - height)); bar.setAttribute("width", "32"); bar.setAttribute("height", String(height)); bar.setAttribute("rx", "7"); bar.setAttribute("fill", "#008f98"); growth.append(bar);
          const label = document.createElementNS(svgNs, "text"); label.setAttribute("x", String(x + 16)); label.setAttribute("y", "164"); label.setAttribute("text-anchor", "middle"); label.setAttribute("fill", "#8199a5"); label.setAttribute("font-size", "10"); label.textContent = months[index].toLocaleDateString(undefined, { month: "short" }); growth.append(label);
          const amount = document.createElementNS(svgNs, "text"); amount.setAttribute("x", String(x + 16)); amount.setAttribute("y", String(Math.max(24, 132 - height))); amount.setAttribute("text-anchor", "middle"); amount.setAttribute("fill", "#456676"); amount.setAttribute("font-size", "10"); amount.textContent = String(value); growth.append(amount);
        });
      }
      const pharmacyRevenue = orders.filter(row => row.source === "pharmacy-order" && completed(row) && paidAndVerified(row)).reduce((sum, row) => sum + (Number(row.commissionAmount) || 0), 0);
      const storeRevenue = orders.filter(row => row.source === "store-checkout" && completed(row) && paidAndVerified(row)).reduce((sum, row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        const knownItems = items.length > 0 && items.every(item => Number.isFinite(Number(item.unitCost ?? item.cost ?? item.product?.unitCost ?? item.product?.cost)));
        const costKnown = knownItems || Number.isFinite(Number(row.costOfGoods));
        const cost = knownItems ? items.reduce((total, item) => total + Number(item.unitCost ?? item.cost ?? item.product?.unitCost ?? item.product?.cost) * (Number(item.quantity) || 1), 0) : Number(row.costOfGoods) || 0;
        return sum + (costKnown ? Math.max(0, Number(row.total || 0) - cost) : 0);
      }, 0);
      const doctorRevenue = appointments.filter(row => completed(row) && paidAndVerified(row)).reduce((sum, row) => sum + (Number(row.commissionAmount) || 0), 0);
      const careRevenue = care.filter(row => completed(row) && paidAndVerified(row)).reduce((sum, row) => sum + (Number(row.careCommissionAmount || row.commissionAmount) || 0), 0);
      const aiRevenue = readAi("careplusAiTransactionsV1").filter(row => row.paymentVerified === true && row.demo !== true && String(row.status || "").toLowerCase() === "paid").reduce((sum, row) => sum + (Number(row.commissionAmount ?? row.amount) || 0), 0);
      const revenue = document.getElementById("count-revenue"); if (revenue) revenue.textContent = money(pharmacyRevenue + storeRevenue + doctorRevenue + careRevenue + aiRevenue);
      const recent = (id, rows, label, getName, getMeta, href) => {
        const host = document.getElementById(id); if (!host) return;
        const latest = [...rows].sort((a,b) => String(b.createdAt || b.placedAt || b.date || "").localeCompare(String(a.createdAt || a.placedAt || a.date || ""))).slice(0,4);
        host.replaceChildren();
        if (!latest.length) { host.className = "recent-empty"; host.innerHTML = "<strong>No " + label + " records</strong><p>New records will appear here.</p>"; return; }
        host.className = "dashboard-recent-list";
        latest.forEach(row => { const item = document.createElement("a"); item.className = "dashboard-recent-item"; item.href = href; const copy = document.createElement("span"); const title = document.createElement("strong"); title.textContent = getName(row); const meta = document.createElement("small"); meta.textContent = getMeta(row); copy.append(title, meta); const status = document.createElement("b"); status.textContent = row.status || "New"; item.append(copy,status); host.append(item); });
      };
      recent("recent-appointments", appointments, "appointment", row => row.patient || row.doctor || "Appointment", row => [row.specialty,row.date,row.time].filter(Boolean).join(" · "), "Appointments/index.html");
      recent("recent-orders", orders, "order", row => row.customerName || row.reference || "Order", row => [row.source === "pharmacy-order" ? "Pharmacy" : row.source === "store-checkout" ? "Store" : "Order",row.status].filter(Boolean).join(" · "), "Orders/index.html");
      const recentCare = document.getElementById("recent-care-requests");
      if (recentCare) recent("recent-care-requests", care, "care request", row => row.client || row.patient || "Care request", row => [row.service,row.date,row.status].filter(Boolean).join(" · "), "CareRequests/index.html");
      const activity = document.getElementById("recent-activity");
      if (activity) {
        const entries = [
          ...appointments.map(row => ({ row, type: "Appointment", href: "Appointments/index.html" })),
          ...orders.map(row => ({ row, type: row.source === "pharmacy-order" ? "Medicine order" : "Store order", href: "Orders/index.html" })),
          ...care.map(row => ({ row, type: "Elderly care", href: "CareRequests/index.html" }))
        ].sort((a,b) => String(b.row.updatedAt || b.row.createdAt || b.row.placedAt || b.row.date || "").localeCompare(String(a.row.updatedAt || a.row.createdAt || a.row.placedAt || a.row.date || ""))).slice(0,5);
        activity.replaceChildren();
        if (!entries.length) { const empty=document.createElement("p"); empty.className="dashboard-activity-empty"; empty.textContent="No recent activity yet."; activity.append(empty); }
        entries.forEach(({row,type,href}) => { const link=document.createElement("a"); link.className="dashboard-recent-item"; link.href=href; const copy=document.createElement("span"); const title=document.createElement("strong"); title.textContent=type+" · "+(row.patient||row.client||row.customerName||row.reference||row.id); const meta=document.createElement("small"); const time=row.updatedAt||row.createdAt||row.placedAt||row.date; meta.textContent=[row.status||"Updated",time?new Date(time).toLocaleDateString():""].filter(Boolean).join(" · "); copy.append(title,meta); link.append(copy); activity.append(link); });
      }
      const pending = document.getElementById("pending-attention");
      if (pending) {
        const needsAction = row => /pending|placed|requested|awaiting|review|new/i.test(String(row.status || ""));
        const pendingRows = [
          ["Appointments", appointments.filter(row => ["requested","pending deposit","pending"].includes(String(row.status).toLowerCase())).length, "Appointments/index.html"],
          ["Medicine orders", orders.filter(row => row.source === "pharmacy-order" && needsAction(row)).length, "Orders/index.html#pharmacy-orders"],
          ["Store orders", orders.filter(row => row.source === "store-checkout" && needsAction(row)).length, "Orders/index.html"],
          ["Elderly care", care.filter(needsAction).length, "CareRequests/index.html"]
        ];
        pending.replaceChildren();
        pendingRows.forEach(([label, value, href]) => { const link=document.createElement("a"); link.href=href; link.className="dashboard-pending-item"; const name=document.createElement("span"); name.textContent=label; const total=document.createElement("strong"); total.textContent=String(value); link.append(name,total); pending.append(link); });
      }
    };
    store.subscribe(renderDashboard);
    window.addEventListener("storage", event => { if (["careplusAiTransactionsV1", "careplusAiUsageEventsV1", "careplusMockDataV1"].includes(event.key)) renderDashboard(); });
    renderDashboard();
  }
  if (!store || !configs[module]) return;
  const summary = document.createElement("section");
  summary.className = "admin-ui-summary";
  summary.setAttribute("aria-label", "Page summary");
  const anchor = page.querySelector(".welcome-row") || page.querySelector(".records-panel");
  if (anchor?.classList.contains("welcome-row")) anchor.after(summary);
  else if (anchor) anchor.before(summary);
  else page.prepend(summary);
  const paths = ['<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>', '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', '<path d="M4 17V7M10 17V4M16 17v-6M22 20H2"/>', '<path d="M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M8 14h3"/>'];
  let previous = "";
  function render() {
    const metrics = configs[module](store.list(module));
    const signature = JSON.stringify(metrics);
    if (signature === previous) return;
    previous = signature; summary.replaceChildren();
    metrics.forEach(([label, value, detail], index) => {
      const card = document.createElement("article"); card.className = "admin-ui-metric";
      const icon = document.createElement("span"); icon.className = "admin-ui-metric-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[index] + '</svg>';
      const caption = document.createElement("p"); caption.textContent = label;
      const number = document.createElement("strong"); number.dataset.animateCount = ""; number.textContent = value;
      const hint = document.createElement("small"); hint.textContent = detail;
      card.append(icon, caption, number, hint); summary.append(card);
    });
  }
  store.subscribe(render); render();
})();
