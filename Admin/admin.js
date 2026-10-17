(() => {
  const page = document.querySelector("[data-admin-page]");
  if (!page) return;

  const moduleName = page.dataset.adminPage;
  const dataStore = window.CarePlusData;
  if (!dataStore) { console.error("CarePlus shared demo data is not loaded."); return; }
  const fields = {
    users: [
      { key: "name", label: "Name", required: true }, { key: "email", label: "Email", type: "email", required: true },
      { key: "phone", label: "Phone", type: "tel" }, { key: "role", label: "Role", type: "select", options: ["Customer", "Nurse", "Administrator"] },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }
    ],
    appointments: [
      { key: "patient", label: "Patient name", required: true }, { key: "doctor", label: "Doctor", required: true },
      { key: "specialty", label: "Specialty" }, { key: "date", label: "Appointment date", type: "date", required: true },
      { key: "status", label: "Status", type: "select", options: ["Requested", "Confirmed", "Completed", "Cancelled"] }
    ],
    products: [
      { key: "name", label: "Product name", required: true }, { key: "category", label: "Category", type: "select", options: ["devices", "accessories", "clothing", "consumables", "professional"] },
      { key: "price", label: "Price (JOD)", type: "number", min: "0", step: "0.01", required: true },
      { key: "quantity", label: "Quantity", type: "number", min: "0", step: "1", required: true },
      { key: "status", label: "Status", type: "select", options: ["Available", "Unavailable"] }
    ],
    pharmacies: [
      { key: "name", label: "Pharmacy name", required: true }, { key: "area", label: "Area", required: true },
      { key: "address", label: "Address", required: true }, { key: "phone", label: "Phone", type: "tel" },
      { key: "distance", label: "Distance", required: true }, { key: "hours", label: "Opening hours", required: true },
      { key: "medicines", label: "Available medicines (comma separated)", wide: true },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }
    ],
    careRequests: [
      { key: "client", label: "Family contact", required: true }, { key: "elderlyName", label: "Elderly person" },
      { key: "service", label: "Service", type: "select", options: ["Home care", "Hospital companion"] },
      { key: "date", label: "Preferred date", type: "date" }, { key: "time", label: "Preferred time", type: "time" },
      { key: "duration", label: "Duration (hours)", type: "number", min: "1", max: "24" },
      { key: "careCommissionRate", label: "CarePlus rate (%)", type: "number", step: "0.01", readOnly: true },
      { key: "careCommissionAmount", label: "CarePlus fee (JOD)", type: "number", step: "0.01", readOnly: true },
      { key: "estimatedTotal", label: "Estimated total (JOD)", type: "number", step: "0.01", readOnly: true },
      { key: "area", label: "Area" }, { key: "assignedNurseId", label: "Assigned nurse ID" },
      { key: "status", label: "Status", readOnly: true },
      { key: "notes", label: "Family instructions", type: "textarea", wide: true },
    ],
    orders: [
      { key: "reference", label: "Order reference" }, { key: "customerName", label: "Customer", required: true },
      { key: "total", label: "Total (JOD)", type: "number", min: "0", step: "0.01", required: true },
      { key: "status", label: "Status", type: "select", options: ["Placed", "Processing", "Delivered", "Cancelled"] }
    ]
  };
  const labels = { users: "Users", appointments: "Appointments", products: "Products", pharmacies: "Pharmacies", careRequests: "Care requests", orders: "Orders" };
  const singular = { users: "user", appointments: "appointment", products: "product", pharmacies: "pharmacy", careRequests: "care request", orders: "order" };
  let records = Object.fromEntries(Object.keys(labels).map(key => [key, dataStore.list(key)]));
  let editingId = null;
  let toastTimer;

  const iconPaths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    appointments: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>',
    products: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5M12 13v8"/>',
    orders: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
    pharmacies: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/><path d="M10 9h4M12 7v4"/>',
    carerequests: '<path d="M20.8 8.6c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z"/><path d="M8 12h8M12 8v8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>'
  };
  function makeIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.classList.add("admin-icon");
    svg.innerHTML = iconPaths[name] || iconPaths.dashboard;
    return svg;
  }
  const topbar = document.querySelector(".topbar");
  const menuToggle = topbar?.querySelector(".menu-toggle");
  const mainArea = document.querySelector(".main-area");
  const sidebarBottom = document.querySelector(".sidebar-bottom");
  const logoutLink = topbar?.querySelector("[data-auth-toggle]");
  if (menuToggle && mainArea) mainArea.prepend(menuToggle);
  if (logoutLink && sidebarBottom) sidebarBottom.append(logoutLink);
  topbar?.remove();

  function applyFooterBrand() {
    const brand = document.querySelector(".brand");
    if (!brand) return;

    const namespace = "http://www.w3.org/2000/svg";
    const logo = document.createElement("span");
    logo.className = "logo-icon";
    logo.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    svg.setAttribute("focusable", "false");
    const heart = document.createElementNS(namespace, "path");
    heart.setAttribute("d", "M24 41S6 29 6 17.5C6 10.8 10.8 7 16.1 7c3.4 0 6.1 1.8 7.9 4.8C25.8 8.8 28.5 7 31.9 7 37.2 7 42 10.8 42 17.5 42 29 24 41 24 41Z");
    heart.setAttribute("fill", "none"); heart.setAttribute("stroke", "currentColor");
    heart.setAttribute("stroke-width", "2.6"); heart.setAttribute("stroke-linejoin", "round");
    const pulse = document.createElementNS(namespace, "path");
    pulse.setAttribute("d", "M11 24h7l3-6 5.5 13 4-8H37");
    pulse.setAttribute("fill", "none"); pulse.setAttribute("stroke", "currentColor");
    pulse.setAttribute("stroke-width", "2.6"); pulse.setAttribute("stroke-linecap", "round"); pulse.setAttribute("stroke-linejoin", "round");
    svg.append(heart, pulse); logo.append(svg);

    const wordmark = document.createElement("span");
    wordmark.append(document.createTextNode("Care"));
    const plus = document.createElement("span");
    plus.className = "brand-plus"; plus.textContent = "Plus";
    wordmark.append(plus);
    const admin = document.createElement("small");
    admin.textContent = "ADMIN"; wordmark.append(admin);
    brand.setAttribute("aria-label", "CarePlus Admin dashboard");
    brand.replaceChildren(logo, wordmark);
  }
  applyFooterBrand();
  document.querySelectorAll(".side-nav a").forEach(link => {
    const holder = link.querySelector(":scope > span");
    if (!holder) return;
    const label = link.textContent.slice(holder.textContent.length).trim().toLowerCase().replace(/\s+/g, "");
    const key = label === "care requests" ? "carerequests" : label === "store orders" ? "products" : label;
    holder.classList.add("nav-icon"); holder.replaceChildren(makeIcon(key));
  });
  document.querySelectorAll(".menu-toggle").forEach(button => button.replaceChildren(makeIcon("menu")));
  document.querySelectorAll(".search-control > span").forEach(holder => { holder.replaceChildren(makeIcon("search")); });
  document.querySelectorAll(".icon-button[data-close]").forEach(button => button.replaceChildren(makeIcon("close")));
  document.querySelectorAll("[data-action='add']").forEach(button => {
    button.replaceChildren(makeIcon("plus"), document.createTextNode(` Add ${singular[moduleName] || "record"}`));
  });
  document.querySelectorAll(".stat-card").forEach(card => {
    const holder = card.querySelector(".stat-icon");
    const label = card.querySelector("p")?.textContent.trim().toLowerCase();
    if (holder) holder.replaceChildren(makeIcon(label === "care requests" ? "carerequests" : label === "store orders" ? "products" : label));
  });
  document.querySelectorAll(".sidebar-bottom a").forEach(link => { link.textContent = "View CarePlus site"; });
  document.querySelectorAll(".shortcuts-panel a > span").forEach(holder => { holder.replaceChildren(makeIcon("arrow")); });
  document.querySelectorAll(".panel-heading > a").forEach(link => {
    link.textContent = "Manage appointments "; link.append(makeIcon("arrow"));
  });

  function refreshRecords() { records = Object.fromEntries(Object.keys(labels).map(key => [key, dataStore.list(key)])); }

  function cell(text, className) {
    const element = document.createElement("td");
    if (className) element.className = className;
    element.textContent = text || "—";
    return element;
  }

  function renderAppointmentFinance() {
    const head = page.querySelector("[data-table-head]");
    const body = page.querySelector("[data-table-body]");
    const empty = page.querySelector("[data-table-empty]");
    if (!head || !body || !empty) return;
    const appointments = dataStore.list("appointments").filter(row => row.commissionAppointmentId ? String(row.commissionAppointmentId) === String(row.id) : true);
    const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
    const eligible = appointments.filter(row => row.status === "Completed" && row.paymentStatus === "Paid" && row.balancePaymentStatus === "Paid" && row.commissionStatus !== "Reversed" && row.refundStatus !== "Refunded");
    const totals = {
      consultation: appointments.filter(row => row.status !== "Cancelled").reduce((sum, row) => sum + Number(row.consultationFee || 0), 0),
      deposits: appointments.filter(row => row.depositPaymentStatus === "Paid" && row.refundStatus !== "Refunded").reduce((sum, row) => sum + Number(row.depositPaid || 0), 0),
      commissions: eligible.reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0),
      awaiting: eligible.filter(row => ["Pending Review", "Payable"].includes(row.commissionStatus)).reduce((sum, row) => sum + Number(row.commissionRemainingToSettle ?? row.commissionAmount ?? 0), 0)
    };
    [["consultation", totals.consultation], ["deposits", totals.deposits], ["commissions", totals.commissions], ["awaiting", totals.awaiting]].forEach(([key, value]) => {
      const node = page.querySelector(`[data-financial-total="${key}"]`);
      if (node) node.textContent = money(value);
    });
    const query = String(page.querySelector("[data-search]")?.value || "").trim().toLowerCase();
    const filter = String(page.querySelector("[data-appointment-status-filter]")?.value || "");
    const shown = appointments.filter(row => {
      const haystack = [row.id, row.patient, row.doctor, row.status, row.paymentStatus, row.commissionStatus, row.commissionRate, row.commissionAmount].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (!filter || (filter === "awaiting" ? ["Pending Review", "Payable"].includes(row.commissionStatus) : filter === "demo" ? String(row.paymentStatus || "").startsWith("Demo") : row.status === filter));
    }).sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    const headers = ["Appointment ID", "Patient", "Doctor", "Consultation fee", "Deposit paid", "Balance", "Rate", "Commission", "Collected", "To settle", "Payment", "Commission status", "Appointment status", "Date", "Review"];
    const header = document.createElement("tr");
    headers.forEach(label => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; header.append(th); });
    head.replaceChildren(header);
    body.replaceChildren();
    shown.forEach(row => {
      const tr = document.createElement("tr");
      const values = [row.id, row.patient, row.doctor, money(row.consultationFee), money(row.depositPaid), money(row.remainingBalance), row.commissionRate == null ? "—" : `${Number(row.commissionRate)}%`, money(row.commissionAmount), money(row.commissionCollected), money(row.commissionRemainingToSettle), row.paymentStatus || "Not recorded", row.commissionStatus || "Not recorded", row.status || "Requested", row.date || row.createdAt || "—"];
      values.forEach((value, index) => tr.append(cell(String(value ?? "—"), index === 0 ? "appointment-id-cell" : "")));
      const actionCell = document.createElement("td");
      const eligibleForSettlement = row.status === "Completed" && row.paymentStatus === "Paid" && row.balancePaymentStatus === "Paid" && row.commissionAppointmentId === row.id && Number(row.commissionAmount) > 0 && row.refundStatus !== "Refunded";
      if (eligibleForSettlement && row.commissionStatus === "Pending Review") {
        const button = document.createElement("button"); button.type = "button"; button.className = "text-button"; button.dataset.commissionAction = "approve"; button.dataset.id = String(row.id); button.textContent = "Approve"; actionCell.append(button);
      } else if (eligibleForSettlement && row.commissionStatus === "Payable") {
        const button = document.createElement("button"); button.type = "button"; button.className = "text-button"; button.dataset.commissionAction = "settle"; button.dataset.id = String(row.id); button.textContent = "Mark settled"; actionCell.append(button);
      } else if (String(row.paymentStatus || "").startsWith("Demo")) actionCell.textContent = "Demo only";
      else actionCell.textContent = "—";
      tr.append(actionCell); body.append(tr);
    });
    empty.textContent = shown.length ? "" : "Doctor appointment records will appear here when submitted.";
    empty.hidden = shown.length > 0;
    const count = page.querySelector("[data-record-count]");
    if (count) count.textContent = `${shown.length} ${shown.length === 1 ? "appointment" : "appointments"}`;
  }

  function renderTable() {
    if (moduleName === "appointments") { renderAppointmentFinance(); return; }
    const config = fields[moduleName];
    const head = page.querySelector("[data-table-head]");
    const body = page.querySelector("[data-table-body]");
    const empty = page.querySelector("[data-table-empty]");
    if (!config || !head || !body || !empty) return;

    head.replaceChildren();
    const headerRow = document.createElement("tr");
    config.forEach(field => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = field.label;
      headerRow.append(th);
    });
    const actionsHeader = document.createElement("th");
    actionsHeader.scope = "col";
    actionsHeader.textContent = "Actions";
    headerRow.append(actionsHeader);
    head.append(headerRow);

    const query = (page.querySelector("[data-search]")?.value || "").trim().toLocaleLowerCase();
    const shown = records[moduleName].filter(record => config.some(field => String(record[field.key] ?? "").toLocaleLowerCase().includes(query)));
    body.replaceChildren();
    shown.forEach(record => {
      const row = document.createElement("tr");
      config.forEach(field => {
        const derived = field.key === "quantity" ? (record.quantity ?? record.stock ?? 0)
          : field.key === "status" ? (record.status ?? (record.inStock ? "Available" : record.open ? "Active" : "Active"))
          : record[field.key];
        const value = String(derived ?? "");
        if (field.key === "status") {
          const statusCell = document.createElement("td");
          const badge = document.createElement("span");
          badge.className = "status-badge";
          if (["confirmed", "active", "available", "completed", "accepted", "contacted"].includes(value.toLowerCase())) badge.classList.add("is-good");
          if (["cancelled", "inactive", "unavailable", "closed"].includes(value.toLowerCase())) badge.classList.add("is-muted");
          badge.textContent = value || "—";
          statusCell.append(badge);
          row.append(statusCell);
        } else row.append(cell(value));
      });
      const actions = document.createElement("td");
      actions.className = "row-actions";
      const edit = document.createElement("button");
      edit.type = "button"; edit.dataset.action = "edit"; edit.dataset.id = String(record.id); edit.textContent = "Edit"; edit.className = "text-button";
      edit.setAttribute("aria-label", `Edit ${record.name || record.patient || record.id}`);
      const remove = document.createElement("button");
      remove.type = "button"; remove.dataset.action = "delete"; remove.dataset.id = String(record.id); remove.textContent = "Delete"; remove.className = "text-button danger";
      remove.setAttribute("aria-label", `Delete ${record.name || record.patient || record.id}`);
      actions.append(edit, remove);
      row.append(actions);
      body.append(row);
    });
    empty.hidden = shown.length > 0;
    const count = page.querySelector("[data-record-count]");
    if (count) count.textContent = `${records[moduleName].length} ${records[moduleName].length === 1 ? "record" : "records"}`;
  }

  function makeInput(field, value = "") {
    const label = document.createElement("label");
    label.className = field.wide ? "field-label is-wide" : "field-label";
    label.append(document.createTextNode(field.label));
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach(optionText => {
        const option = document.createElement("option"); option.value = optionText; option.textContent = optionText; input.append(option);
      });
    } else if (field.type === "textarea") {
      input = document.createElement("textarea"); input.rows = 3;
    } else {
      input = document.createElement("input"); input.type = field.type || "text";
      if (field.min !== undefined) input.min = field.min;
      if (field.step !== undefined) input.step = field.step;
    }
    input.name = field.key; input.value = value; input.required = Boolean(field.required);
    input.readOnly = Boolean(field.readOnly);
    label.append(input);
    return label;
  }

  function openEditor(record = null) {
    const dialog = document.querySelector(".record-dialog");
    const holder = dialog?.querySelector("[data-form-fields]");
    if (!dialog || !holder || !fields[moduleName]) {
      showToast("The user form could not be opened. Please refresh and try again.", true);
      return;
    }
    editingId = record ? String(record.id) : null;
    dialog.querySelector("#dialog-title").textContent = `${record ? "Edit" : "Add"} ${singular[moduleName]}`;
    holder.replaceChildren(...fields[moduleName].map(field => makeInput(field, record?.[field.key] ?? "")));
    dialog.querySelector("[data-form-feedback]").textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    holder.querySelector("input,select,textarea")?.focus();
  }

  function showToast(message, isError = false) {
    const toast = document.querySelector("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderDashboard() {
    Object.keys(labels).forEach(key => {
      const count = document.getElementById(`count-${key}`);
      if (count) count.textContent = records[key].length;
    });
    renderServiceAnalytics();
    renderRecentOrders();
    const recent = document.getElementById("recent-appointments");
    if (!recent) return;
    const appointments = [...records.appointments].slice(-4).reverse();
    recent.replaceChildren();
    if (!appointments.length) {
      const icon = document.createElement("span"); icon.append(makeIcon("appointments"));
      const title = document.createElement("strong"); title.textContent = "No appointment records";
      const message = document.createElement("p"); message.textContent = "New entries you add in this demo will appear here.";
      recent.append(icon, title, message);
      return;
    }
    const list = document.createElement("div"); list.className = "recent-list";
    appointments.forEach(appointment => {
      const item = document.createElement("div"); item.className = "recent-item";
      const name = document.createElement("strong"); name.textContent = appointment.patient || "Appointment";
      const detail = document.createElement("span"); detail.textContent = [appointment.doctor, appointment.date, appointment.status].filter(Boolean).join(" · ");
      item.append(name, detail); list.append(item);
    });
    recent.replaceChildren(list);
  }

  function renderRecentOrders() {
    const recent = document.getElementById("recent-orders");
    if (!recent) return;
    const orders = [...dataStore.list("orders")].sort((a, b) => new Date(b.placedAt || b.createdAt || 0) - new Date(a.placedAt || a.createdAt || 0)).slice(0, 5);
    recent.replaceChildren();
    if (!orders.length) {
      const icon = document.createElement("span"); icon.textContent = "▧";
      const title = document.createElement("strong"); title.textContent = "No order records";
      const message = document.createElement("p"); message.textContent = "New store and pharmacy orders will appear here.";
      recent.append(icon, title, message);
      return;
    }
    const list = document.createElement("div"); list.className = "recent-list";
    orders.forEach(order => {
      const item = document.createElement("div"); item.className = "recent-item";
      const title = document.createElement("strong"); title.textContent = order.reference || order.id || "Order";
      const kind = order.source === "pharmacy-order" ? "Pharmacy" : "Store";
      const amount = Number.isFinite(Number(order.total)) ? `JOD ${Number(order.total).toFixed(2)}` : "";
      const detail = document.createElement("span"); detail.textContent = [kind, order.customerReference || order.customerName || order.customer?.fullName, amount, order.status || "Pending"].filter(Boolean).join(" · ");
      item.append(title, detail); list.append(item);
    });
    recent.replaceChildren(list);
  }

  // Store checkout orders and pharmacy orders share the same repository.
  // This table intentionally includes only non-pharmacy orders.
  function renderStoreOrders() {
    const body = document.querySelector("[data-orders-body]");
    if (!body) return;
    const empty = document.querySelector("[data-orders-empty]");
    const count = document.querySelector("[data-orders-count]");
    const storeOrders = dataStore.list("orders")
      .filter(order => order.source !== "pharmacy-order")
      .sort((a, b) => new Date(b.placedAt || b.createdAt || 0) - new Date(a.placedAt || a.createdAt || 0));
    const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
    const addCell = (row, text, className = "") => {
      const td = document.createElement("td");
      if (className) td.className = className;
      td.textContent = text || "—";
      row.append(td);
      return td;
    };
    const statusOptions = ["Placed", "Processing", "Out for Delivery", "Delivered", "Cancelled"];

    body.replaceChildren();
    storeOrders.forEach(order => {
      const row = document.createElement("tr");
      const refCell = addCell(row, order.reference || order.id || "Order");
      if (order.demo || order.source === "demo-seed") {
        const note = document.createElement("small");
        note.className = "pharmacy-admin-demo";
        note.textContent = "Sample preview";
        refCell.append(note);
      }

      const customer = order.customer || {};
      const customerCell = document.createElement("td");
      const customerName = document.createElement("strong");
      customerName.textContent = order.customerName || customer.fullName || "Customer";
      customerCell.append(customerName);
      const contact = [customer.phone, customer.email].filter(Boolean).join(" · ");
      if (contact) {
        const details = document.createElement("small");
        details.className = "pharmacy-admin-demo";
        details.textContent = contact;
        customerCell.append(details);
      }
      row.append(customerCell);

      const products = Array.isArray(order.items) ? order.items.map(item => {
        const product = item.product || item;
        return `${product.name || product.productName || "Product"} × ${Number(item.quantity || 1)}`;
      }).join(", ") : "";
      addCell(row, products || "No product details", "pharmacy-order-items");

      const placedAt = order.placedAt || order.createdAt;
      const date = placedAt ? new Date(placedAt) : null;
      addCell(row, date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "—");
      const delivery = [order.deliveryMethod, order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(" · ");
      addCell(row, delivery || "—");
      addCell(row, money(order.total));
      addCell(row, `${order.paymentStatus || "Pending"}${order.payment ? ` · ${order.payment}` : ""}`);

      const statusCell = document.createElement("td");
      const select = document.createElement("select");
      select.className = "store-order-status-select";
      select.setAttribute("aria-label", `Update status for ${order.reference || order.id}`);
      const currentStatus = order.status || "Placed";
      if (!statusOptions.includes(currentStatus)) statusOptions.unshift(currentStatus);
      [...new Set([currentStatus, ...statusOptions])].forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        select.append(option);
      });
      select.value = currentStatus;
      select.addEventListener("change", () => {
        const updated = dataStore.update("orders", order.id, { status: select.value });
        if (!updated) {
          select.value = currentStatus;
          showToast("Could not update the order status.", true);
          return;
        }
        showToast(`Order ${order.reference || order.id} updated.`);
      });
      statusCell.append(select);
      row.append(statusCell);
      body.append(row);
    });
    if (count) count.textContent = `${storeOrders.length} ${storeOrders.length === 1 ? "order" : "orders"}`;
    if (empty) empty.hidden = storeOrders.length > 0;
  }

  function renderServiceAnalytics() {
    const activityChart = document.getElementById("activity-chart");
    const mixSegments = document.getElementById("service-mix-segments");
    if (!activityChart || !mixSegments) return;

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
    const series = [
      { key: "appointments", label: "Appointments", color: "#4d82ed", date: item => item.date || item.createdAt },
      { key: "careRequests", label: "Care requests", color: "#48c96b", date: item => item.date || item.createdAt },
      { key: "orders", label: "Orders", color: "#f5bd2e", date: item => item.placedAt || item.date || item.createdAt }
    ];
    const monthKey = date => `${date.getFullYear()}-${date.getMonth()}`;
    const totals = Object.fromEntries(series.map(item => [item.key, 0]));
    const buckets = months.map(() => Object.fromEntries(series.map(item => [item.key, 0])));
    series.forEach(item => {
      const rows = item.key === "orders" ? records.orders : records[item.key];
      rows.forEach(record => {
        const rawDate = item.date(record);
        if (!rawDate) return;
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return;
        totals[item.key] += 1;
        const bucket = months.findIndex(month => monthKey(month) === monthKey(date));
        if (bucket >= 0) buckets[bucket][item.key] += 1;
      });
    });

    const svgNode = (tag, attrs = {}, content = "") => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      if (content) node.textContent = content;
      return node;
    };
    const bottom = 204, top = 24, left = 48, right = 748, chartHeight = bottom - top;
    const maxValue = Math.max(1, ...buckets.flatMap(bucket => series.map(item => bucket[item.key])));
    const tickStep = Math.max(1, Math.ceil(maxValue / 4));
    const scaleMax = tickStep * 4;
    const chartNodes = [];
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = scaleMax - tick * tickStep;
      const y = top + tick * chartHeight / 4;
      chartNodes.push(svgNode("line", { x1: left, x2: right, y1: y, y2: y, class: "chart-gridline" }));
      chartNodes.push(svgNode("text", { x: left - 9, y: y + 4, "text-anchor": "end", class: "chart-axis-label" }, value));
    }
    const groupWidth = (right - left) / months.length;
    const barWidth = 19;
    buckets.forEach((bucket, index) => {
      const center = left + groupWidth * index + groupWidth / 2;
      series.forEach((item, seriesIndex) => {
        const value = bucket[item.key];
        const height = value ? value / scaleMax * chartHeight : 0;
        const x = center + (seriesIndex - 1) * (barWidth + 5) - barWidth / 2;
        const bar = svgNode("rect", { x, y: bottom - height, width: barWidth, height: Math.max(height, value ? 2 : 0), rx: 4, fill: item.color, class: "chart-bar" });
        const title = svgNode("title", {}, `${item.label}: ${value}`);
        bar.append(title);
        chartNodes.push(bar);
      });
      chartNodes.push(svgNode("text", { x: center, y: 232, "text-anchor": "middle", class: "chart-month-label" }, months[index].toLocaleDateString(undefined, { month: "short" })));
    });
    if (!series.some(item => totals[item.key] > 0)) {
      chartNodes.push(svgNode("text", { x: (left + right) / 2, y: 120, "text-anchor": "middle", class: "chart-axis-label" }, "No service activity recorded yet"));
    }
    activityChart.replaceChildren(...chartNodes);

    const circumference = 2 * Math.PI * 48;
    const grandTotal = series.reduce((sum, item) => sum + totals[item.key], 0);
    let offset = 0;
    const segments = [];
    series.forEach(item => {
      const portion = grandTotal ? totals[item.key] / grandTotal * circumference : 0;
      if (portion > 0) {
        segments.push(svgNode("circle", {
          cx: 70, cy: 70, r: 48, fill: "none", stroke: item.color, "stroke-width": 17,
          "stroke-dasharray": `${portion} ${circumference - portion}`, "stroke-dashoffset": -offset,
          "stroke-linecap": "butt", class: "service-mix-segment"
        }));
        offset += portion;
      }
    });
    mixSegments.replaceChildren(...segments);
    const totalLabel = document.getElementById("service-mix-total");
    if (totalLabel) totalLabel.textContent = String(grandTotal);
    const legend = document.getElementById("service-mix-legend");
    if (legend) {
      legend.replaceChildren(...series.map(item => {
        const line = document.createElement("div"); line.className = "service-mix-item";
        const dot = document.createElement("i"); dot.style.backgroundColor = item.color;
        const label = document.createElement("span"); label.textContent = item.label;
        const count = document.createElement("strong"); count.textContent = String(totals[item.key]);
        line.append(dot, label, count);
        return line;
      }));
    }
  }

  // Pharmacy orders use the same shared order records as the customer and
  // pharmacy pages. Keep this view read-only; order fulfilment stays with the
  // pharmacy and commission review stays in Admin/Commissions.
  function renderPharmacyOrders() {
    const body = document.querySelector("[data-pharmacy-orders-body]");
    if (!body) return;
    const empty = document.querySelector("[data-pharmacy-orders-empty]");
    const count = document.querySelector("[data-pharmacy-orders-count]");
    const search = document.querySelector("[data-pharmacy-order-search]");
    const statusFilter = document.querySelector("[data-pharmacy-order-filter]");
    const pharmacies = dataStore.list("pharmacies");
    const query = String(search?.value || "").trim().toLocaleLowerCase();
    const selectedStatus = String(statusFilter?.value || "");
    const pharmacyOrders = dataStore.list("orders").filter(order => order.source === "pharmacy-order");
    const shown = pharmacyOrders.filter(order => {
      const pharmacy = pharmacies.find(item => String(item.id) === String(order.pharmacyId));
      const itemText = (Array.isArray(order.items) ? order.items : []).map(item => `${item.name || item.medicineName || ""} ${item.quantity ?? ""}`).join(" ");
      const haystack = [order.reference, order.id, order.customerReference, order.pharmacyName, pharmacy?.name, itemText, order.deliveryAddress, order.deliveryPhone]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (!selectedStatus || String(order.status || "Pending") === selectedStatus);
    }).sort((a, b) => new Date(b.placedAt || b.createdAt || 0) - new Date(a.placedAt || a.createdAt || 0));

    const makeCell = (value, className) => {
      const td = document.createElement("td");
      if (className) td.className = className;
      td.textContent = value == null || value === "" ? "—" : String(value);
      return td;
    };
    const money = value => `JOD ${Number(value || 0).toFixed(2)}`;
    const makeBadge = (value, kind = "") => {
      const badge = document.createElement("span");
      badge.className = `pharmacy-admin-status${kind ? ` ${kind}` : ""}`;
      badge.textContent = value || "—";
      return badge;
    };
    const formatDate = value => {
      if (!value) return "—";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    };

    body.replaceChildren();
    shown.forEach(order => {
      const pharmacy = pharmacies.find(item => String(item.id) === String(order.pharmacyId));
      const row = document.createElement("tr");
      const orderCell = document.createElement("td");
      const orderRef = document.createElement("strong");
      orderRef.textContent = order.reference || order.id || "Order";
      orderCell.append(orderRef);
      if (order.demo) {
        const demo = document.createElement("small");
        demo.className = "pharmacy-admin-demo";
        demo.textContent = "Sample preview";
        orderCell.append(demo);
      }
      row.append(orderCell);
      row.append(makeCell(order.customerReference || "Customer", "pharmacy-order-customer"));
      row.append(makeCell(order.pharmacyName || pharmacy?.name || "Unknown pharmacy"));

      const itemCell = document.createElement("td");
      itemCell.className = "pharmacy-order-items";
      const items = Array.isArray(order.items) ? order.items : [];
      itemCell.textContent = items.length ? items.map(item => `${item.name || item.medicineName || "Medicine"} × ${Number(item.quantity || 0)}`).join(", ") : "No medicine details";
      row.append(itemCell);

      const detailsCell = document.createElement("td");
      const details = document.createElement("details");
      details.className = "pharmacy-delivery-details";
      const summary = document.createElement("summary");
      summary.textContent = formatDate(order.placedAt || order.createdAt);
      const address = document.createElement("p"); address.textContent = `Address: ${order.deliveryAddress || "Not provided"}`;
      const phone = document.createElement("p"); phone.textContent = `Phone: ${order.deliveryPhone || "Not provided"}`;
      details.append(summary, address, phone); detailsCell.append(details); row.append(detailsCell);

      row.append(makeCell(money(order.subtotal ?? order.total)));
      row.append(makeCell(money(order.customerCommissionAmount)));
      row.append(makeCell(money(order.deliveryFee)));
      const totalCell = makeCell(money(order.total));
      const paymentMethod = document.createElement("small");
      paymentMethod.className = "pharmacy-admin-demo";
      paymentMethod.textContent = order.paymentMethod === "cash-on-delivery" ? "Cash on delivery" : order.paymentMethod === "online-gateway" ? "Online" : (order.paymentMethod || "");
      totalCell.append(paymentMethod); row.append(totalCell);

      const orderStatusCell = document.createElement("td");
      const orderStatus = order.status || "Pending";
      orderStatusCell.append(makeBadge(orderStatus, ["Delivered", "Completed"].includes(orderStatus) ? "good" : orderStatus === "Cancelled" ? "bad" : ""));
      if (order.cancelReason) { const reason = document.createElement("small"); reason.className = "pharmacy-admin-demo"; reason.textContent = `Reason: ${order.cancelReason}`; orderStatusCell.append(reason); }
      row.append(orderStatusCell);

      const commissionCell = document.createElement("td");
      commissionCell.append(makeBadge(order.commissionStatus || "Not Eligible", order.commissionStatus === "Payable" || order.commissionStatus === "Paid" ? "good" : order.commissionStatus === "Reversed" ? "bad" : ""));
      const commissionValue = document.createElement("small"); commissionValue.className = "pharmacy-admin-demo";
      commissionValue.textContent = `${Number(order.commissionRate || 0)}% · ${money(order.commissionAmount)}`;
      commissionCell.append(commissionValue); row.append(commissionCell);
      body.append(row);
    });
    if (count) count.textContent = `${shown.length} ${shown.length === 1 ? "order" : "orders"}`;
    if (empty) {
      empty.hidden = shown.length > 0;
      empty.textContent = pharmacyOrders.length && (query || selectedStatus)
        ? "No pharmacy orders match your search or status filter."
        : "No pharmacy orders have been placed yet.";
    }
  }

  document.querySelectorAll(".menu-toggle").forEach(button => button.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar-open");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close admin navigation" : "Open admin navigation");
  }));
  document.querySelectorAll(".side-nav a").forEach(link => link.addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
    document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
  }));
  document.addEventListener("click", event => {
    if (document.body.classList.contains("sidebar-open") && !event.target.closest(".sidebar, .menu-toggle")) {
      document.body.classList.remove("sidebar-open");
      document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      document.body.classList.remove("sidebar-open");
      document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
    }
  });
  document.querySelector("[data-action='add']")?.addEventListener("click", () => openEditor());
  page.querySelector("[data-search]")?.addEventListener("input", renderTable);
  page.querySelector("[data-appointment-status-filter]")?.addEventListener("change", renderTable);
  page.querySelector("[data-table-body]")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-commission-action]");
    if (!button) return;
    const row = dataStore.get("appointments", button.dataset.id);
    const verified = row && row.status === "Completed" && row.paymentStatus === "Paid" && row.balancePaymentStatus === "Paid" && row.commissionAppointmentId === row.id && Number(row.commissionAmount) > 0 && row.refundStatus !== "Refunded";
    if (!verified) { showToast("Only a completed, fully verified appointment can be settled.", true); return; }
    const action = button.dataset.commissionAction;
    const expected = action === "approve" ? "Pending Review" : "Payable";
    if (row.commissionStatus !== expected) { showToast("This commission has already been reviewed.", true); return; }
    const identity = localStorage.getItem("careplusDemoIdentity") || "Admin";
    const stamp = new Date().toISOString();
    const changes = action === "approve"
      ? { commissionStatus: "Payable", commissionReviewedAt: stamp, commissionReviewedBy: identity, commissionAdminAction: "Approved for settlement" }
      : { commissionStatus: "Settled", commissionSettledAt: stamp, commissionSettledBy: identity, commissionAdminAction: "Marked settled" };
    if (!dataStore.update("appointments", row.id, changes)) { showToast("Commission update could not be saved.", true); return; }
    refreshRecords(); renderTable(); renderDashboard(); showToast(action === "approve" ? "Commission approved for settlement." : "Commission marked settled.");
  });
  document.querySelector("[data-pharmacy-order-search]")?.addEventListener("input", renderPharmacyOrders);
  document.querySelector("[data-pharmacy-order-filter]")?.addEventListener("change", renderPharmacyOrders);
  page.querySelector("[data-table-body]")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = records[moduleName].findIndex(record => String(record.id) === button.dataset.id);
    if (index < 0) return;
    if (button.dataset.action === "edit") openEditor(records[moduleName][index]);
    if (button.dataset.action === "delete" && window.confirm("Delete this temporary demo record?")) {
      if (dataStore.remove(moduleName, button.dataset.id)) { refreshRecords(); renderTable(); renderDashboard(); showToast("Shared demo record deleted."); }
    }
  });
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog")?.close()));
  const dialog = document.querySelector(".record-dialog");
  dialog?.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog?.querySelector("[data-record-form]")?.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    if (moduleName === "users") {
      const email = String(values.email || "").trim().toLowerCase();
      const duplicate = records.users.some(user => user.id !== editingId && String(user.email || "").trim().toLowerCase() === email);
      if (duplicate) {
        document.querySelector("[data-form-feedback]").textContent = "A user with this email address already exists.";
        return;
      }
      values.email = email;
      values.name = String(values.name || "").trim();
      values.phone = String(values.phone || "").trim();
    }
    if (moduleName === "products") { values.price = Number(values.price); values.quantity = Number(values.quantity); values.stock = values.quantity; values.inStock = values.status === "Available" && values.quantity > 0; }
    if (moduleName === "pharmacies") values.medicines = String(values.medicines || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
    if (moduleName === "orders") values.total = Number(values.total);
    const saved = editingId ? dataStore.update(moduleName, editingId, values) : dataStore.create(moduleName, values);
    if (saved) { const wasEditing = Boolean(editingId); dialog.close(); form.reset(); editingId = null; refreshRecords(); renderTable(); renderDashboard(); showToast(wasEditing ? "Shared demo record updated." : "Shared demo record added."); }
    else document.querySelector("[data-form-feedback]").textContent = "Could not save this demo record in this browser.";
  });

  dataStore.subscribe(() => { refreshRecords(); renderTable(); renderDashboard(); renderStoreOrders(); renderPharmacyOrders(); });
  renderTable();
  renderDashboard();
  renderStoreOrders();
  renderPharmacyOrders();
})();
