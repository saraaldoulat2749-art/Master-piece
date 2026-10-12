(() => {
  const page = document.querySelector("[data-admin-page]");
  if (!page) return;

  const moduleName = page.dataset.adminPage;
  const dataStore = window.CarePlusData;
  if (!dataStore) { console.error("CarePlus shared demo data is not loaded."); return; }
  const fields = {
    users: [
      { key: "name", label: "Name", required: true }, { key: "email", label: "Email", type: "email", required: true },
      { key: "phone", label: "Phone", type: "tel" }, { key: "role", label: "Role", type: "select", options: ["Customer", "Administrator"] },
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
      { key: "client", label: "Client name", required: true },
      { key: "service", label: "Service", type: "select", options: ["Home care", "Hospital companion"] },
      { key: "date", label: "Preferred date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["New", "Reviewing", "Accepted", "Contacted", "Closed", "Cancelled"] },
      { key: "paymentStatus", label: "Payment", type: "select", options: ["Not due", "Due", "Paid"] },
      { key: "notes", label: "Notes", type: "textarea", wide: true }
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

  function renderTable() {
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
      if (moduleName === "careRequests" && !["accepted", "closed"].includes(String(record.status || "").toLowerCase())) {
        const accept = document.createElement("button");
        accept.type = "button"; accept.dataset.action = "accept"; accept.dataset.id = String(record.id);
        accept.textContent = "Accept"; accept.className = "text-button accept";
        accept.setAttribute("aria-label", `Accept request from ${record.client || record.id}`);
        actions.append(accept);
      }
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
  page.querySelector("[data-table-body]")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = records[moduleName].findIndex(record => String(record.id) === button.dataset.id);
    if (index < 0) return;
    if (button.dataset.action === "edit") openEditor(records[moduleName][index]);
    if (button.dataset.action === "accept" && moduleName === "careRequests") {
      const updated = dataStore.update(moduleName, button.dataset.id, { status: "Accepted", paymentStatus: "Due" });
      if (updated) { refreshRecords(); renderTable(); renderDashboard(); showToast("Care request accepted."); }
    }
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

  dataStore.subscribe(() => { refreshRecords(); renderTable(); renderDashboard(); });
  renderTable();
  renderDashboard();
})();
