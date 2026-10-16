(() => {
  const dataStore = window.CarePlusData;
  const byId = id => document.getElementById(id);
  let identity = String(sessionStorage.getItem("careplusDemoIdentity") || "").trim();
  let identityLower = identity.toLowerCase();
  if (window.CarePlusAuth?.hasDemoAdminSession()) {
    window.location.replace("../Admin/index.html");
    return;
  }
  if (!identity) {
    window.location.replace("../log%20in/login.html");
    return;
  }
  let user = dataStore?.list("users").find(item => item.email?.toLowerCase() === identityLower || item.phone === identity);
  if (!user && identity) user = dataStore?.upsertDemoUser(identity);
  if (!dataStore || !user) {
    byId("profile-name").textContent = "Your CarePlus profile";
    byId("profile-welcome").textContent = "We could not match this demo session to a user record.";
    return;
  }

  const dateFormat = value => {
    if (!value) return "Not added yet";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };
  const initials = value => String(value || "CarePlus").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const iconPaths = {
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    duration: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l-3 2"/>',
    payment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/>',
    heart: '<path d="M20.5 8.7c0 5.3-8.5 10.6-8.5 10.6S3.5 14 3.5 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.5 2.4Z"/>',
    bag: '<path d="M4 8h16l1 12H3L4 8Z"/><path d="M8 8a4 4 0 0 1 8 0"/>',
    medical: '<path d="M12 4v16m-8-8h16"/>'
  };
  function makeIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    svg.classList.add("profile-icon"); svg.innerHTML = iconPaths[name] || iconPaths.medical;
    return svg;
  }
  const today = () => {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  function addDays(days) {
    const date = new Date(`${today()}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function ensureProfileDemoRecords() {
    const owns = collection => dataStore.list(collection).some(matchesUser);
    if (!owns("careRequests")) dataStore.create("careRequests", {
      id: `profile-demo-${user.id}-care`, userId: user.id,
      client: user.name || "CarePlus Member", elderlyName: "Nadia Haddad", email: user.email || identity,
      phone: user.phone || "", service: "Home care", date: addDays(7), time: "09:00",
      duration: 3, schedule: "Daily visits", city: user.city || "Amman", area: user.address || "Al Rabieh",
      address: [user.address, user.city].filter(Boolean).join(", ") || "Al Rabieh, Amman",
      status: "Reviewing", notes: "Sample request to demonstrate request tracking.", source: "profile-demo-seed"
    });
    if (!owns("orders")) {
      const product = dataStore.get("products", 1) || { id: 1, name: "Digital Blood Pressure Monitor", category: "devices", price: 34.9, image: "" };
      const address = user.address || "Al Rabieh";
      const city = user.city || "Amman";
      dataStore.create("orders", {
        id: `profile-demo-${user.id}-order`, reference: `CP-DEMO-${String(user.id).slice(-6).toUpperCase()}`,
        userId: user.id, customerName: user.name || "CarePlus Member",
        customer: { fullName: user.name || "CarePlus Member", email: user.email || identity, phone: user.phone || "", city, area: address, address },
        items: [{ product: { id: product.id, name: product.name, category: product.category, price: Number(product.price) || 34.9, image: product.image || "" }, quantity: 1 }],
        deliveryMethod: "standard", payment: "Cash on Delivery", subtotal: Number(product.price) || 34.9,
        deliveryFee: 2.5, total: (Number(product.price) || 34.9) + 2.5,
        placedAt: new Date().toISOString(), status: "Processing", source: "profile-demo-seed"
      });
    }
  }
  const isAppointmentUpcoming = appointment => appointment.date >= today() && !["completed", "cancelled"].includes(String(appointment.status || "").toLowerCase());
  const matchesUser = record => String(record.userId ?? "") === String(user.id)
    || String(record.email || record.customer?.email || "").toLowerCase() === identityLower
    || String(record.phone || record.customer?.phone || "") === identity;
  let appointmentFilter = "upcoming";
  let toastTimeout;

  function showToast(message) {
    const toast = byId("profile-toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function fillRow(parent, label, value) {
    const row = makeElement("div", "detail-row");
    row.append(makeElement("span", "", label), makeElement("strong", "", value || "Not provided"));
    parent.append(row);
  }

  function showDetails(title, rows, items = []) {
    byId("details-title").textContent = title;
    const content = byId("details-content");
    content.replaceChildren();
    rows.forEach(([label, value]) => fillRow(content, label, value));
    if (items.length) {
      const group = makeElement("div", "details-items");
      items.forEach(([name, value]) => {
        const line = makeElement("p"); line.append(makeElement("span", "", name), makeElement("strong", "", value)); group.append(line);
      });
      content.append(group);
    }
    byId("details-dialog").showModal();
  }

  function setStatusBadge(status) {
    const label = status || "Pending";
    const badge = makeElement("span", "status-badge", label);
    if (["confirmed", "completed", "delivered", "approved", "accepted by careplus", "in progress", "paid"].includes(String(label).toLowerCase())) badge.classList.add("is-good");
    else if (["upcoming", "requested", "processing", "shipped", "pending", "placed", "due", "not due"].includes(String(label).toLowerCase())) badge.classList.add("is-waiting");
    else badge.classList.add("is-muted");
    return badge;
  }

  function setProfileHeader() {
    const fullName = user.name || (identity.includes("@") ? identity.split("@")[0] : identity) || "CarePlus Member";
    byId("profile-name").textContent = `Hello, ${fullName}`;
    byId("profile-welcome").textContent = "Your CarePlus health services and personal details, together in one place.";
    byId("profile-email").textContent = user.email || "Email not added";
    byId("profile-phone").textContent = user.phone || "Phone not added";
    const avatar = byId("profile-avatar");
    if (user.avatarData) {
      avatar.textContent = "";
      avatar.style.backgroundImage = `url("${user.avatarData}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    } else {
      avatar.textContent = initials(fullName);
      avatar.style.backgroundImage = "";
      avatar.style.backgroundSize = "";
      avatar.style.backgroundPosition = "";
    }
    byId("profile-created").textContent = `Member since ${dateFormat(user.createdAt || new Date().toISOString())}`;
  }

  function renderPersonalInfo() {
    const values = [
      ["Full name", user.name], ["Email address", user.email], ["Phone number", user.phone],
      ["Date of birth", dateFormat(user.dateOfBirth)], ["Gender", user.gender], ["Address", user.address],
      ["City", user.city], ["Emergency contact", user.emergencyContact]
    ];
    const parent = byId("personal-info");
    parent.replaceChildren();
    values.forEach(([label, value]) => {
      const item = makeElement("div", "info-item");
      item.append(makeElement("span", "", label), makeElement("strong", "", value || "Not provided"));
      parent.append(item);
    });
  }

  function ownedRecords(collection) {
    return dataStore.list(collection).filter(matchesUser);
  }

  function emptyState(icon, title, message, linkText, href) {
    const box = makeElement("div", "empty-state");
    const iconHolder = makeElement("span", "empty-state__icon"); iconHolder.append(makeIcon(icon));
    box.append(iconHolder, makeElement("h3", "", title), makeElement("p", "", message));
    if (linkText && href) {
      const link = makeElement("a", "button button--outline", linkText);
      link.href = href; box.append(link);
    }
    return box;
  }

  function appendMeta(parent, icon, text) {
    const meta = makeElement("span");
    meta.append(makeIcon(icon), document.createTextNode(text));
    parent.append(meta);
  }

  function renderAppointments() {
    const appointments = ownedRecords("appointments");
    const query = byId("appointment-search").value.trim().toLowerCase();
    const visible = appointments.filter(item => {
      const status = String(item.status || "").toLowerCase();
      const group = status === "cancelled" ? "cancelled" : isAppointmentUpcoming(item) ? "upcoming" : "past";
      const searchText = [item.id, item.doctor, item.specialty, item.area, item.date, item.paymentStatus].join(" ").toLowerCase();
      return group === appointmentFilter && searchText.includes(query);
    }).sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
    const list = byId("appointment-list"); list.replaceChildren();
    if (!visible.length) {
      list.append(emptyState("calendar", `No ${appointmentFilter} appointments`, "Appointments booked with your CarePlus login will appear here.", "Book an appointment", "../Book/index.html"));
      return;
    }
    visible.forEach(appointment => {
      const card = makeElement("article", "record-card appointment-card");
      const top = makeElement("div", "record-card__top");
      top.append(makeElement("span", "record-avatar", initials(appointment.doctor || "Doctor")));
      const copy = makeElement("div", "record-copy");
      copy.append(makeElement("h3", "", appointment.doctor || "CarePlus clinician"), makeElement("p", "", appointment.specialty || "Medical appointment"));
      const statusLabel = String(appointment.status || "").toLowerCase() === "requested" ? "Pending" : appointment.status || "Pending";
      top.append(copy, setStatusBadge(statusLabel)); card.append(top);
      if (String(appointment.source || "").includes("demo")) card.append(makeElement("small", "demo-record-label", "Sample preview data"));
      const meta = makeElement("div", "record-meta");
      appendMeta(meta, "calendar", dateFormat(appointment.date)); appendMeta(meta, "clock", appointment.time || "Time to be confirmed");
      appendMeta(meta, "pin", appointment.area || "Clinic details to be confirmed"); card.append(meta);
      if (Number(appointment.consultationFee) > 0) {
        const finance = makeElement("div", "appointment-finance");
        [
          ["Appointment ID", appointment.id], ["Consultation fee", `JOD ${Number(appointment.consultationFee).toFixed(2)}`],
          ["Deposit paid", `JOD ${Number(appointment.depositPaid || 0).toFixed(2)}`],
          ["Required deposit", `JOD ${Number(appointment.depositAmount || 0).toFixed(2)}`],
          ["Remaining balance", `JOD ${Number(appointment.remainingBalance || 0).toFixed(2)}`],
          ["CarePlus commission (10% of full fee)", `JOD ${Number(appointment.commissionAmount || 0).toFixed(2)}`],
          ["Payment status", appointment.paymentStatus || "Pending"]
        ].forEach(([label, value]) => {
          const item = makeElement("div", "appointment-finance__item");
          item.append(makeElement("span", "", label), makeElement("strong", "", value)); finance.append(item);
        });
        card.append(finance);
      }
      const actions = makeElement("div", "record-actions");
      const details = makeElement("button", "button button--outline", "View details"); details.type = "button";
      details.addEventListener("click", () => {
        const details = [["Appointment ID", appointment.id], ["Doctor", appointment.doctor], ["Specialty", appointment.specialty], ["Date", dateFormat(appointment.date)], ["Time", appointment.time], ["Clinic", appointment.area], ["Appointment status", statusLabel]];
        if (Number(appointment.consultationFee) > 0) details.push(["Consultation fee", `JOD ${Number(appointment.consultationFee).toFixed(2)}`], ["Deposit paid", `JOD ${Number(appointment.depositPaid || 0).toFixed(2)}`], ["Required deposit", `JOD ${Number(appointment.depositAmount || 0).toFixed(2)}`], ["Remaining balance", `JOD ${Number(appointment.remainingBalance || 0).toFixed(2)}`], ["CarePlus commission", `JOD ${Number(appointment.commissionAmount || 0).toFixed(2)}`], ["Payment status", appointment.paymentStatus || "Not recorded"]);
        showDetails("Appointment details", details);
      });
      actions.append(details);
      if (isAppointmentUpcoming(appointment)) {
        const reschedule = makeElement("button", "button button--outline", "Reschedule"); reschedule.type = "button";
        reschedule.addEventListener("click", () => openReschedule(appointment));
        const cancel = makeElement("button", "button button--danger", "Cancel appointment"); cancel.type = "button";
        cancel.addEventListener("click", () => cancelAppointment(appointment));
        actions.append(reschedule, cancel);
      }
      card.append(actions); list.append(card);
    });
  }

  function requestStatus(request) {
    const status = String(request.status || "New").toLowerCase();
    return ({ new: "Pending", reviewing: "Pending", accepted: "Accepted by CarePlus", approved: "Accepted by CarePlus", contacted: "In Progress", "in progress": "In Progress", closed: "Completed", completed: "Completed", cancelled: "Cancelled" })[status] || request.status || "Pending";
  }

  function renderCareRequests() {
    const requests = ownedRecords("careRequests").slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const list = byId("care-list"); list.replaceChildren();
    if (!requests.length) {
      list.append(emptyState("heart", "No care requests yet", "When you request elderly care, you can follow its status here.", "Request elderly care", "../elederly/index.html"));
      return;
    }
    requests.forEach(request => {
      const card = makeElement("article", "record-card care-card");
      const top = makeElement("div", "record-card__top");
      const careIcon = makeElement("span", "record-avatar"); careIcon.append(makeIcon("heart")); top.append(careIcon);
      const copy = makeElement("div", "record-copy");
      copy.append(makeElement("h3", "", request.elderlyName || request.client || "Care recipient"), makeElement("p", "", request.service || "Elderly care"));
      const status = requestStatus(request); top.append(copy, setStatusBadge(status));
      if (["accepted", "approved"].includes(String(request.status || "").toLowerCase())) top.append(setStatusBadge(request.paymentStatus || "Due"));
      card.append(top);
      const meta = makeElement("div", "record-meta");
      appendMeta(meta, "calendar", `Visit date: ${dateFormat(request.date)}`);
      appendMeta(meta, "clock", request.time || "Time to be confirmed");
      appendMeta(meta, "pin", [request.address || request.pickupAddress, request.area, request.city].filter(Boolean).join(", ") || "Address to be confirmed");
      appendMeta(meta, "duration", request.duration ? `${request.duration} ${Number(request.duration) === 1 ? "hour" : "hours"} per visit` : request.schedule || "Schedule to be confirmed");
      card.append(meta);
      const actions = makeElement("div", "record-actions");
      const details = makeElement("button", "button button--outline", "View details"); details.type = "button";
      details.addEventListener("click", () => showDetails("Care request details", [["Care recipient", request.elderlyName || request.client], ["Service", request.service], ["Duration", request.duration ? `${request.duration} hours per visit` : "Not provided"], ["Schedule", request.schedule], ["Preferred time", request.time], ["Pickup address", [request.address || request.pickupAddress, request.area, request.city].filter(Boolean).join(", ")], ["Destination", request.destination], ["Emergency contact", [request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ")], ["Submitted", dateFormat(request.createdAt || request.date)], ["Status", status], ["Payment", request.paymentStatus || "Not due"], ["Notes", request.notes]]));
      actions.append(details);
      const accepted = ["accepted", "approved"].includes(String(request.status || "").toLowerCase());
      if (accepted && String(request.paymentStatus || "").toLowerCase() !== "paid") {
        const pay = makeElement("button", "button button--primary", "Pay now"); pay.type = "button";
        pay.addEventListener("click", () => { window.location.href = `payment.html?requestId=${encodeURIComponent(request.id)}`; });
        actions.append(pay);
      } else if (accepted && String(request.paymentStatus || "").toLowerCase() === "paid") {
        actions.append(setStatusBadge("Paid"));
      }
      if (!["Cancelled", "Completed"].includes(status)) {
        const cancel = makeElement("button", "button button--danger", "Cancel request"); cancel.type = "button";
        cancel.addEventListener("click", () => cancelCareRequest(request)); actions.append(cancel);
      }
      card.append(actions); list.append(card);
    });
  }

  function orderStatus(order) {
    const status = String(order.status || "Placed").toLowerCase();
    return ({ placed: "Placed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" })[status] || order.status || "Placed";
  }

  function orderItems(order) {
    return Array.isArray(order.items) ? order.items : [];
  }

  function renderOrders() {
    const orders = ownedRecords("orders").slice().sort((a, b) => String(b.placedAt || b.createdAt || "").localeCompare(String(a.placedAt || a.createdAt || "")));
    const list = byId("order-list"); list.replaceChildren();
    if (!orders.length) {
      list.append(emptyState("bag", "No orders yet", "Your CarePlus Medical Store purchases will appear here.", "Visit the medical store", "../Store/index.html"));
      return;
    }
    orders.forEach(order => {
      const card = makeElement("article", "record-card order-card");
      const header = makeElement("div", "record-card__top");
      const orderIcon = makeElement("span", "record-avatar"); orderIcon.append(makeIcon("bag")); header.append(orderIcon);
      const copy = makeElement("div", "record-copy");
      copy.append(makeElement("h3", "", order.reference || `Order ${String(order.id).slice(-6)}`), makeElement("p", "", `Placed ${dateFormat(order.placedAt || order.createdAt)}`));
      header.append(copy, setStatusBadge(orderStatus(order))); card.append(header);
      const itemsHolder = makeElement("div", "order-items");
      orderItems(order).forEach(line => {
        const product = line.product || line;
        const item = makeElement("div", "order-product");
        const productVisual = makeElement("span", "product-icon");
        if (product.image) {
          const image = makeElement("img", "product-photo");
          image.src = product.image; image.alt = product.name || "Ordered medical product"; image.loading = "lazy";
          image.addEventListener("error", () => productVisual.replaceChildren(makeIcon("medical")), { once: true });
          productVisual.append(image);
        } else productVisual.append(makeIcon("medical"));
        item.append(productVisual);
        const detail = makeElement("div");
        detail.append(makeElement("strong", "", product.name || "Medical product"), makeElement("span", "", `${Number(line.quantity) || 1} × JOD ${Number(product.price || line.price || 0).toFixed(2)}`));
        item.append(detail); itemsHolder.append(item);
      });
      card.append(itemsHolder);
      card.append(makeElement("strong", "order-total", `Total · JOD ${Number(order.total || 0).toFixed(2)}`));
      const meta = makeElement("div", "record-meta");
      appendMeta(meta, "pin", [order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(", ") || "Delivery address on file");
      appendMeta(meta, "payment", order.payment || "Payment details unavailable"); card.append(meta);
      const actions = makeElement("div", "record-actions");
      const details = makeElement("button", "button button--outline", "Order details"); details.type = "button";
      details.addEventListener("click", () => showOrderDetails(order)); actions.append(details);
      card.append(actions); list.append(card);
    });
  }

  function showOrderDetails(order) {
    const items = orderItems(order).map(line => {
      const product = line.product || line;
      return [`${product.name || "Medical product"} × ${Number(line.quantity) || 1}`, `JOD ${(Number(product.price || line.price || 0) * (Number(line.quantity) || 1)).toFixed(2)}`];
    });
    showDetails("Order details", [["Order number", order.reference || order.id], ["Order date", dateFormat(order.placedAt || order.createdAt)], ["Status", orderStatus(order)], ["Total", `JOD ${Number(order.total || 0).toFixed(2)}`], ["Delivery address", [order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(", ")], ["Payment method", order.payment || "Not provided"]], items);
  }

  function renderSummary() {
    const appointments = ownedRecords("appointments");
    const requests = ownedRecords("careRequests");
    const orders = ownedRecords("orders");
    byId("summary-appointments").textContent = appointments.length;
    byId("summary-care").textContent = requests.filter(request => !["cancelled", "closed", "completed"].includes(String(request.status || "").toLowerCase())).length;
    byId("summary-orders").textContent = orders.length;
    byId("summary-upcoming").textContent = appointments.filter(isAppointmentUpcoming).length;
  }

  function renderAll() {
    setProfileHeader(); renderPersonalInfo(); renderSummary(); renderAppointments(); renderCareRequests(); renderOrders();
  }

  function openProfileEditor() {
    const form = byId("profile-form");
    ["name", "email", "phone", "dateOfBirth", "gender", "city", "address", "emergencyContact"].forEach(key => { form.elements.namedItem(key).value = user[key] || ""; });
    byId("edit-feedback").textContent = "";
    byId("edit-dialog").showModal();
    form.elements.namedItem("name").focus();
  }

  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("This image could not be read."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("This image could not be opened."));
        image.onload = () => {
          const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function cancelAppointment(appointment) {
    if (!window.confirm(`Cancel your appointment with ${appointment.doctor || "this doctor"}?`)) return;
    const changes = { status: "Cancelled" };
    if (Number(appointment.consultationFee) > 0) {
      changes.commissionStatus = ["Pending Review", "Payable", "Settled"].includes(appointment.commissionStatus) ? "Reversed" : "Not earned";
      if (Number(appointment.commissionCollected) > 0) changes.commissionReversedAmount = Number(appointment.commissionCollected);
      changes.commissionCollected = 0;
      changes.commissionRemainingToSettle = 0;
      if (Number(appointment.depositPaid) > 0) changes.refundStatus = String(appointment.paymentStatus || "").startsWith("Demo") ? "No refund due; demo payment was not charged" : "Refund review required";
    }
    if (window.CarePlusClinic?.updateAppointment(appointment.id, changes)) { refreshUser(); showToast("Appointment cancelled."); }
  }

  function cancelCareRequest(request) {
    if (!window.confirm("Cancel this elderly care request?")) return;
    if (dataStore.update("careRequests", request.id, { status: "Cancelled" })) { refreshUser(); showToast("Care request cancelled."); }
  }

  function openReschedule(appointment) {
    const form = byId("reschedule-form");
    form.elements.namedItem("appointmentId").value = appointment.id;
    form.elements.namedItem("date").value = appointment.date || "";
    form.elements.namedItem("time").value = appointment.time || "";
    form.elements.namedItem("date").min = today();
    byId("reschedule-feedback").textContent = "";
    byId("reschedule-dialog").showModal();
  }

  function refreshUser() {
    user = dataStore.list("users").find(item => String(item.id) === String(user.id)) || user;
    renderAll();
  }

  fetch("../Nav/index.html").then(response => response.text()).then(markup => {
    const container = byId("nav-container"); container.innerHTML = markup;
    const nav = container.querySelector(".careplus-navbar__links");
    nav?.querySelectorAll("a").forEach(link => link.classList.remove("active"));
    nav?.querySelectorAll("a").forEach(link => {
      if (link.textContent.trim() === "My Profile") link.classList.add("active");
    });
    window.CarePlusAuth?.paintNavigation();
  }).catch(error => console.error("Could not load CarePlus navigation:", error));

  document.querySelectorAll("[data-tab]").forEach(tab => tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(button => { const selected = button === tab; button.classList.toggle("is-active", selected); button.setAttribute("aria-selected", String(selected)); });
    document.querySelectorAll("[data-panel]").forEach(panel => { const selected = panel.dataset.panel === name; panel.hidden = !selected; panel.classList.toggle("is-active", selected); });
  }));
  document.querySelectorAll("[data-edit-profile]").forEach(button => button.addEventListener("click", openProfileEditor));
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
  document.querySelectorAll("[data-appointment-filter]").forEach(button => button.addEventListener("click", () => {
    appointmentFilter = button.dataset.appointmentFilter;
    document.querySelectorAll("[data-appointment-filter]").forEach(item => item.classList.toggle("is-active", item === button));
    renderAppointments();
  }));
  byId("appointment-search").addEventListener("input", renderAppointments);

  byId("profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const photoInput = form.elements.namedItem("profilePhoto");
    const photoFile = photoInput.files?.[0];
    const values = Object.fromEntries(new FormData(form).entries());
    delete values.profilePhoto;
    values.name = values.name.trim(); values.email = values.email.trim().toLowerCase(); values.phone = values.phone.trim();
    const duplicate = dataStore.list("users").some(item => String(item.id) !== String(user.id) && item.email?.toLowerCase() === values.email);
    if (duplicate) { byId("edit-feedback").textContent = "This email address is already linked to another profile."; return; }
    if (photoFile) {
      if (!photoFile.type.startsWith("image/") || photoFile.size > 6 * 1024 * 1024) {
        byId("edit-feedback").textContent = "Choose an image smaller than 6 MB."; return;
      }
      try { values.avatarData = await imageToDataUrl(photoFile); }
      catch (error) { byId("edit-feedback").textContent = error.message; return; }
    }
    const saved = dataStore.update("users", user.id, values);
    if (!saved) { byId("edit-feedback").textContent = "Could not save the changes in this browser."; return; }
    user = saved;
    identity = user.email || user.phone || identity;
    identityLower = identity.toLowerCase();
    sessionStorage.setItem("careplusDemoIdentity", identity);
    byId("edit-dialog").close(); form.reset(); renderAll(); showToast("Your profile was updated.");
  });

  byId("reschedule-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.namedItem("appointmentId").value;
    const appointment = dataStore.get("appointments", id);
    const date = form.elements.namedItem("date").value;
    const time = form.elements.namedItem("time").value;
    if (!appointment || !window.CarePlusClinic?.isAvailable({ doctor: appointment.doctor, date, time, ignoreId: id })) {
      byId("reschedule-feedback").textContent = "That time is unavailable for this doctor. Choose another date and time."; return;
    }
    const updated = window.CarePlusClinic.updateAppointment(id, { date, time, status: "Requested" });
    if (!updated) { byId("reschedule-feedback").textContent = "Could not update this appointment."; return; }
    byId("reschedule-dialog").close(); refreshUser(); showToast("New appointment time requested.");
  });

  ensureProfileDemoRecords();
  renderAll();
  let knownAppointmentStatuses = new Map(ownedRecords("appointments").map(appointment => [String(appointment.id), String(appointment.status || "Requested")]));
  let knownCareStatuses = new Map(ownedRecords("careRequests").map(request => [String(request.id), String(request.status || "").toLowerCase()]));
  let knownOrderStatuses = new Map(ownedRecords("orders").map(order => [String(order.id), String(order.status || "Placed").toLowerCase()]));
  dataStore.subscribe(() => {
    const appointments = ownedRecords("appointments");
    const changedAppointment = appointments.find(appointment => {
      const previous = knownAppointmentStatuses.get(String(appointment.id));
      return previous !== undefined && previous !== String(appointment.status || "Requested");
    });
    knownAppointmentStatuses = new Map(appointments.map(appointment => [String(appointment.id), String(appointment.status || "Requested")]));
    const requests = ownedRecords("careRequests");
    const orders = ownedRecords("orders");
    const acceptedRequest = requests.find(request => {
      const status = String(request.status || "").toLowerCase();
      return ["accepted", "approved"].includes(status) && !["accepted", "approved"].includes(knownCareStatuses.get(String(request.id)));
    });
    const changedOrder = orders.find(order => {
      const previousStatus = knownOrderStatuses.get(String(order.id));
      return previousStatus !== undefined && String(order.status || "Placed").toLowerCase() !== previousStatus;
    });
    knownCareStatuses = new Map(requests.map(request => [String(request.id), String(request.status || "").toLowerCase()]));
    knownOrderStatuses = new Map(orders.map(order => [String(order.id), String(order.status || "Placed").toLowerCase()]));
    refreshUser();
    if (changedAppointment) showToast(`Appointment status updated: ${changedAppointment.status || "Requested"}.`);
    if (acceptedRequest) showToast("CarePlus accepted your elderly care request.");
    if (changedOrder) showToast(`Order ${changedOrder.reference || changedOrder.id} status updated: ${orderStatus(changedOrder)}.`);
  });
})();
