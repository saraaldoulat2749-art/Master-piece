(() => {
  const dataStore = window.CarePlusData;
  const byId = id => document.getElementById(id);
  let pendingCancellationId = "";
  let pendingCareCancellationId = "";
  let pendingPharmacyOrderId = "";
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
  const isAppointmentUpcoming = appointment => appointment.date >= today() && !["completed", "cancelled", "rejected"].includes(String(appointment.status || "").toLowerCase());
  const matchesUser = record => String(record.userId ?? "") === String(user.id)
    || String(record.bookingUserId ?? "") === String(user.id)
    || String(record.email || record.customer?.email || "").toLowerCase() === identityLower
    || String(record.phone || record.customer?.phone || "") === identity;
  let appointmentFilter = "upcoming";
  let careFilter = "upcoming";
  let orderFilter = "upcoming";
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
    const wide = ["Appointment ID", "Pickup address", "Destination", "Rejection reason", "Cancellation reason", "Notes"].includes(label);
    const row = makeElement("div", `detail-row${wide ? " detail-row--wide" : ""}${label === "Appointment ID" ? " detail-row--id" : ""}`);
    row.append(makeElement("span", "", label), makeElement("strong", "", value || "Not provided"));
    parent.append(row);
  }

  function showDetails(title, rows, items = []) {
    const dialog = byId("details-dialog");
    dialog.classList.toggle("profile-dialog--appointment", title === "Appointment details");
    dialog.classList.toggle("profile-dialog--care-request", title === "Care request details");
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
    dialog.showModal();
  }

  function showAppointmentDetails(appointment) {
    const status = String(appointment.status || "Pending").toLowerCase() === "requested" ? "Pending" : appointment.status || "Pending";
    const details = [["Appointment ID", appointment.id], ["Doctor", appointment.doctor], ["Specialty", appointment.specialty], ["Date", dateFormat(appointment.date)], ["Time", appointment.time], ["Clinic", appointment.area], ["Appointment status", status]];
    if (String(appointment.status || "").toLowerCase() === "rejected" && appointment.rejectionReason) details.push(["Rejection reason", appointment.rejectionReason]);
    if (String(appointment.status || "").toLowerCase() === "cancelled" && appointment.cancelReason) details.push(["Cancellation reason", appointment.cancelReason]);
    if (Number(appointment.consultationFee) > 0) details.push(["Consultation fee", `JOD ${Number(appointment.consultationFee).toFixed(2)}`], ["Deposit paid", `JOD ${Number(appointment.depositPaid || 0).toFixed(2)}`], ["Required deposit", `JOD ${Number(appointment.depositAmount || 0).toFixed(2)}`], ["Remaining balance", `JOD ${Number(appointment.remainingBalance || 0).toFixed(2)}`], ["CarePlus commission", `JOD ${Number(appointment.commissionAmount || 0).toFixed(2)}`], ["Payment status", appointment.paymentStatus || "Not recorded"]);
    showDetails("Appointment details", details);
  }

  function setStatusBadge(status) {
    const label = status || "Pending";
    const badge = makeElement("span", "status-badge", label);
    if (["confirmed", "completed", "delivered", "approved", "accepted by careplus", "in progress", "paid"].includes(String(label).toLowerCase())) badge.classList.add("is-good");
    else if (["upcoming", "requested", "processing", "shipped", "pending", "placed", "due", "not due"].includes(String(label).toLowerCase())) badge.classList.add("is-waiting");
    else if (["rejected", "cancelled", "canceled", "refunded", "failed"].includes(String(label).toLowerCase())) badge.classList.add("is-negative");
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
      const group = ["cancelled", "rejected"].includes(status) ? "cancelled" : isAppointmentUpcoming(item) ? "upcoming" : "past";
      const searchText = [item.id, item.doctor, item.specialty, item.area, item.date, item.paymentStatus, item.rejectionReason].join(" ").toLowerCase();
      return group === appointmentFilter && searchText.includes(query);
    });
    const sortedVisible = dataStore.newestFirst(visible);
    const list = byId("appointment-list"); list.replaceChildren();
    if (!visible.length) {
      list.append(emptyState("calendar", `No ${appointmentFilter} appointments`, "Appointments booked with your CarePlus login will appear here.", "Book an appointment", "../Book/index.html"));
      return;
    }
    sortedVisible.forEach(appointment => {
      const card = makeElement("article", "record-card appointment-card");
      card.dataset.recordId = String(appointment.id);
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
      details.addEventListener("click", () => showAppointmentDetails(appointment));
      actions.append(details);
      const acceptedByDoctor = ["confirmed", "accepted"].includes(String(appointment.status || "").toLowerCase());
      const depositPaid = ["paid", "demo simulated"].includes(String(appointment.depositPaymentStatus || "").toLowerCase());
      if (acceptedByDoctor && !depositPaid) {
        const pay = makeElement("a", "button button--primary", "Pay deposit");
        pay.href = `../Book/Payment/index.html?appointmentId=${encodeURIComponent(appointment.id)}`;
        actions.append(pay);
      } else if (String(appointment.paymentStatus || "") === "Awaiting Doctor Acceptance") {
        actions.append(makeElement("span", "order-payment-waiting", "Deposit payment is available after the doctor accepts."));
      }
      if (isAppointmentUpcoming(appointment)) {
        const reschedule = makeElement("button", "button button--outline", "Reschedule"); reschedule.type = "button";
        reschedule.addEventListener("click", () => openReschedule(appointment));
        actions.append(reschedule);
        const pendingBeforeAcceptance = ["requested", "pending", "pending deposit"].includes(String(appointment.status || "").trim().toLowerCase());
        if (pendingBeforeAcceptance) {
          const cancel = makeElement("button", "button button--danger", "Cancel appointment"); cancel.type = "button";
          cancel.addEventListener("click", () => cancelAppointment(appointment));
          actions.append(cancel);
        }
      }
      card.append(actions); list.append(card);
    });
  }

  function requestStatus(request) {
    const status = String(request.status || "New").toLowerCase();
    return ({ new: "Pending", reviewing: "Pending", accepted: "Accepted by CarePlus", approved: "Accepted by CarePlus", contacted: "In Progress", "in progress": "In Progress", closed: "Completed", completed: "Completed", cancelled: "Cancelled" })[status] || request.status || "Pending";
  }

  function canCancelCareRequest(request) {
    return ["new", "pending", "requested", "reviewing", "pending payment", "accepted", "approved"]
      .includes(String(request?.status || "New").trim().toLowerCase());
  }

  function renderCareRequests() {
    const query = byId("care-search").value.trim().toLowerCase();
    const requests = dataStore.newestFirst(ownedRecords("careRequests").filter(request => {
      const rawStatus = String(request.status || "new").trim().toLowerCase();
      const group = ["cancelled", "rejected"].includes(rawStatus) ? "cancelled" : ["closed", "completed"].includes(rawStatus) ? "past" : "upcoming";
      const searchable = [request.id, request.elderlyName, request.client, request.service, request.status, request.date, request.time, request.area, request.city, request.address, request.cancelReason].join(" ").toLowerCase();
      return group === careFilter && searchable.includes(query);
    }));
    const list = byId("care-list"); list.replaceChildren();
    if (!requests.length) {
      list.append(emptyState("heart", "No care requests yet", "When you request elderly care, you can follow its status here.", "Request elderly care", "../elederly/index.html"));
      return;
    }
    requests.forEach(request => {
      const card = makeElement("article", "record-card care-card");
      card.dataset.recordId = String(request.id);
      const top = makeElement("div", "record-card__top");
      const careIcon = makeElement("span", "record-avatar"); careIcon.append(makeIcon("heart")); top.append(careIcon);
      const copy = makeElement("div", "record-copy");
      copy.append(makeElement("h3", "", request.elderlyName || request.client || "Care recipient"), makeElement("p", "", request.service || "Elderly care"));
      const status = requestStatus(request); top.append(copy, setStatusBadge(status));
      const depositPaid = request.paymentMode === "demo" && request.demoPaymentStatus === "Succeeded" && Boolean(request.demoTransactionReference);
      if (depositPaid) top.append(setStatusBadge("Deposit paid"));
      if (["accepted", "approved"].includes(String(request.status || "").toLowerCase())) top.append(setStatusBadge(request.paymentStatus || "Due"));
      card.append(top);
      const meta = makeElement("div", "record-meta");
      appendMeta(meta, "calendar", `Visit date: ${dateFormat(request.date)}`);
      if (depositPaid) {
        appendMeta(meta, "clock", `Deposit paid: JOD ${Number(request.depositAmount).toFixed(2)}`);
        appendMeta(meta, "clock", `Remaining balance: JOD ${Number(request.remainingBalance).toFixed(2)}`);
      }
      appendMeta(meta, "clock", request.time || "Time to be confirmed");
      appendMeta(meta, "pin", [request.address || request.pickupAddress, request.area, request.city].filter(Boolean).join(", ") || "Address to be confirmed");
      appendMeta(meta, "duration", request.duration ? `${request.duration} ${Number(request.duration) === 1 ? "hour" : "hours"} per visit` : request.schedule || "Schedule to be confirmed");
      card.append(meta);
      if (request.totalPrice != null) {
        const costSummary = makeElement("div", "care-cost-summary");
        const commission = Number(request.careCommissionAmount ?? (Number(request.totalPrice) * Number(request.careCommissionRate ?? 10) / 100));
        const costRows = [
          ["Service total", request.totalPrice],
          ["CarePlus commission", commission],
          ...(request.depositAmount != null ? [[depositPaid ? "Deposit paid" : "Deposit", request.depositAmount]] : []),
          ...(request.remainingBalance != null ? [["Remaining balance", request.remainingBalance]] : [])
        ];
        costRows.forEach(([label, amount]) => {
          const line = makeElement("div", label === "Service total" ? "care-cost-line care-cost-line--total" : "care-cost-line");
          line.append(makeElement("span", "", label), makeElement("strong", "", `JOD ${Number(amount || 0).toFixed(2)}`));
          costSummary.append(line);
        });
        card.append(costSummary);
      }
      const actions = makeElement("div", "record-actions");
      const details = makeElement("button", "button button--outline", "View details"); details.type = "button";
      details.addEventListener("click", () => showDetails("Care request details", [["Care recipient", request.elderlyName || request.client], ["Service", request.service], ["Duration", request.duration ? `${request.duration} hours per visit` : "Not provided"], ["Schedule", request.schedule], ["Preferred time", request.time], ["Pickup address", [request.address || request.pickupAddress, request.area, request.city].filter(Boolean).join(", ")], ["Destination", request.destination], ["Emergency contact", [request.emergencyName, request.emergencyPhone].filter(Boolean).join(" · ")], ["Submitted", dateFormat(request.createdAt || request.date)], ["Status", status], ...(request.rejectionReason ? [["Rejection reason", request.rejectionReason]] : []), ...(request.cancelReason ? [["Cancellation reason", request.cancelReason]] : []), ["Payment", depositPaid ? "Deposit paid" : request.paymentStatus || "Not due"], ["Total service price", request.totalPrice != null ? `JOD ${Number(request.totalPrice).toFixed(2)}` : "Not provided"], [depositPaid ? "Deposit paid (10%)" : "Required deposit (10%)", request.depositAmount != null ? `JOD ${Number(request.depositAmount).toFixed(2)}` : "Not provided"], ["Remaining balance", request.remainingBalance != null ? `JOD ${Number(request.remainingBalance).toFixed(2)}` : "Not provided"], ["Notes", request.notes]]));
      actions.append(details);
      const accepted = ["accepted", "approved"].includes(String(request.status || "").toLowerCase());
      if (accepted && !depositPaid && String(request.paymentStatus || "").toLowerCase() !== "paid") {
        const pay = makeElement("button", "button button--primary", "Pay now"); pay.type = "button";
        pay.addEventListener("click", () => { window.location.href = `payment.html?requestId=${encodeURIComponent(request.id)}`; });
        actions.append(pay);
      } else if (accepted && String(request.paymentStatus || "").toLowerCase() === "paid") {
        actions.append(setStatusBadge("Paid"));
      }
      if (canCancelCareRequest(request)) {
        const cancel = makeElement("button", "button button--danger", "Cancel request"); cancel.type = "button";
        cancel.addEventListener("click", () => cancelCareRequest(request)); actions.append(cancel);
      }
      card.append(actions); list.append(card);
    });
  }

  function orderStatus(order) {
    if (order?.source === "pharmacy-order") {
      const pharmacyStatuses = { Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" };
      return pharmacyStatuses[order.status] || order.status || "Pending";
    }
    const status = String(order.status || "Placed").toLowerCase();
    return ({ placed: "Placed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" })[status] || order.status || "Placed";
  }

  function orderItems(order) {
    return Array.isArray(order.items) ? order.items : [];
  }

  function renderOrders() {
    const query = byId("order-search").value.trim().toLowerCase();
    const orders = ownedRecords("orders").filter(order => {
      const status = String(orderStatus(order)).trim().toLowerCase();
      const group = ["cancelled", "rejected"].includes(status) ? "cancelled" : ["completed", "delivered"].includes(status) ? "past" : "upcoming";
      const itemNames = orderItems(order).map(line => (line.product || line).name || "").join(" ");
      const searchable = [order.id, order.reference, order.pharmacyName, order.status, order.paymentStatus, order.customer?.name, order.customer?.address, order.customer?.area, order.customer?.city, itemNames].join(" ").toLowerCase();
      return group === orderFilter && searchable.includes(query);
    }).slice().sort((a, b) => String(b.placedAt || b.createdAt || "").localeCompare(String(a.placedAt || a.createdAt || "")));
    const list = byId("order-list"); list.replaceChildren();
    if (!orders.length) {
      list.append(emptyState("bag", "No orders yet", "Your CarePlus pharmacy and medical store orders will appear here.", "Browse CarePlus", "../Pharmacy/index.html"));
      return;
    }
    orders.forEach(order => {
      const card = makeElement("article", "record-card order-card");
      card.dataset.recordId = String(order.id);
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
      if (order.source === "pharmacy-order") {
        const stages = ["Pending", "Accepted", "Preparing", "Ready for Pickup", "Completed"];
        if (["Rejected", "Cancelled"].includes(orderStatus(order))) stages.push(orderStatus(order));
        const history = Array.isArray(order.statusHistory) ? order.statusHistory : [{ status: "Pending", at: order.placedAt || order.createdAt }];
        const timeline = makeElement("ol", "profile-order-timeline");
        const stageIcons = {
          Pending: "<path d=\"M4 7h16v13H4z\"/><path d=\"M4 8l8 6 8-6M8 4h8\"/>",
          Accepted: "<path d=\"m5 12 4 4L19 6\"/>",
          Preparing: "<path d=\"M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/>",
          "Ready for Pickup": "<path d=\"M4 8h16l1 12H3L4 8Z\"/><path d=\"M8 8a4 4 0 0 1 8 0\"/>",
          Completed: "<path d=\"m5 12 4 4L19 6\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
          Rejected: "<path d=\"m7 7 10 10M17 7 7 17\"/>",
          Cancelled: "<path d=\"m7 7 10 10M17 7 7 17\"/>"
        };
        stages.forEach(stage => {
          const event = history.slice().reverse().find(entry => ({ Confirmed: "Accepted", "Preparing for Delivery": "Preparing", "Out for Delivery": "Ready for Pickup", Delivered: "Completed" }[entry.status] || entry.status) === stage);
          const step = makeElement("li", `${event ? "is-recorded" : ""} ${orderStatus(order) === stage ? "is-current" : ""}`.trim());
          const stepIcon = makeElement("i"); stepIcon.setAttribute("aria-hidden", "true");
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("focusable", "false"); svg.innerHTML = stageIcons[stage] || stageIcons.Pending;
          stepIcon.append(svg);
          step.append(stepIcon, makeElement("strong", "", stage));
          if (event?.at) step.append(makeElement("small", "", new Date(event.at).toLocaleString()));
          timeline.append(step);
        });
        card.append(timeline);
        if (order.rejectionReason || order.cancelReason) card.append(makeElement("p", "profile-order-reason", `Reason: ${order.rejectionReason || order.cancelReason}`));
      }
      const costSummary = makeElement("div", "order-cost-summary");
      if (order.source === "pharmacy-order") {
        [
          ["Medicine subtotal", order.subtotal ?? order.total],
          ["CarePlus commission", order.customerCommissionAmount ?? order.commissionAmount],
          [order.deliveryZoneLabel ? `Delivery · ${order.deliveryZoneLabel}` : "Delivery", order.deliveryFee]
        ].forEach(([label, amount]) => {
          const line = makeElement("div", "order-cost-line");
          line.append(makeElement("span", "", label), makeElement("strong", "", `JOD ${Number(amount || 0).toFixed(2)}`));
          costSummary.append(line);
        });
      }
      const totalLine = makeElement("div", "order-total");
      totalLine.append(makeElement("span", "", "Order total"), makeElement("strong", "", `JOD ${Number(order.total || 0).toFixed(2)}`));
      costSummary.append(totalLine);
      card.append(costSummary);
      const meta = makeElement("div", "record-meta");
      appendMeta(meta, "pin", [order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(", ") || "Delivery address on file");
      appendMeta(meta, "payment", order.payment || order.paymentMethod || order.paymentStatus || "Payment details unavailable"); card.append(meta);
      const actions = makeElement("div", "record-actions");
      const details = makeElement("button", "button button--outline", "Order details"); details.type = "button";
      details.addEventListener("click", () => showOrderDetails(order)); actions.append(details);
      if (order.source === "pharmacy-order") {
        const paymentIsPending = order.paymentStatus === "Pending" && orderStatus(order) === "Accepted" && order.paymentDemoResult !== "simulated-success";
        if (paymentIsPending) {
          const pay = makeElement("a", "button button--primary", "Complete payment");
          pay.href = `../Pharmacy/payment.html?orderId=${encodeURIComponent(order.id)}`;
          actions.append(pay);
        } else if (order.paymentDemoResult === "simulated-success") {
          actions.append(makeElement("span", "order-payment-waiting", "Demo payment submitted; no charge was made."));
        } else if (order.paymentStatus === "Awaiting Pharmacy Acceptance") {
          actions.append(makeElement("span", "order-payment-waiting", "Payment will be available after the pharmacy accepts."));
        }
        if (orderStatus(order) === "Pending") {
          const cancelOrder = makeElement("button", "button button--danger", "Cancel order");
          cancelOrder.type = "button";
          cancelOrder.addEventListener("click", () => openPharmacyOrderCancellation(order));
          actions.append(cancelOrder);
        }
      }
      card.append(actions); list.append(card);
    });
  }

  function showOrderDetails(order) {
    const items = orderItems(order).map(line => {
      const product = line.product || line;
      return [`${product.name || "Medical product"} × ${Number(line.quantity) || 1}`, `JOD ${(Number(product.price || line.price || 0) * (Number(line.quantity) || 1)).toFixed(2)}`];
    });
    if (order.source === "pharmacy-order") {
      items.push(...(Array.isArray(order.statusHistory) ? order.statusHistory : []).map(event => [`${orderStatus({ ...order, status: event.status })} · ${event.actor || "CarePlus"}`, `${dateFormat(event.at)}${event.reason ? ` · ${event.reason}` : ""}`]));
      if (order.rejectionReason || order.cancelReason) items.push(["Rejection reason", order.rejectionReason || order.cancelReason]);
    }
    showDetails("Order details", [["Order number", order.reference || order.id], ["Order date", dateFormat(order.placedAt || order.createdAt)], ["Status", orderStatus(order)], ["Total", `JOD ${Number(order.total || 0).toFixed(2)}`], ...(order.source === "pharmacy-order" ? [["Pharmacy", order.pharmacyName || "CarePlus pharmacy"], ["Payment status", order.paymentStatus || "Pending"]] : []), ["Delivery address", [order.customer?.address, order.customer?.area, order.customer?.city].filter(Boolean).join(", ") || order.deliveryAddress], ["Payment method", order.payment || order.paymentMethod || "Not provided"]], items);
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
    pendingCancellationId = String(appointment.id);
    const form = byId("cancel-appointment-form");
    form.reset();
    form.elements.namedItem("appointmentId").value = appointment.id;
    byId("cancel-appointment-patient").textContent = `For ${appointment.doctor || "your doctor"} · ${dateFormat(appointment.date)} at ${appointment.time || "time pending"}`;
    byId("cancel-appointment-feedback").textContent = "";
    byId("cancel-appointment-dialog").showModal();
    byId("cancel-appointment-reason").focus();
  }

  function cancelCareRequest(request) {
    pendingCareCancellationId = String(request.id);
    const form = byId("cancel-care-request-form");
    form.reset();
    form.elements.namedItem("requestId").value = request.id;
    byId("cancel-care-request-label").textContent = `For ${request.elderlyName || request.client || "your care recipient"} · ${request.service || "Elderly care"}`;
    byId("cancel-care-request-feedback").textContent = "";
    byId("cancel-care-request-dialog").showModal();
    byId("cancel-care-request-reason").focus();
  }

  function openPharmacyOrderCancellation(order) {
    pendingPharmacyOrderId = String(order.id);
    const form = byId("cancel-pharmacy-order-form");
    form.reset();
    form.elements.namedItem("orderId").value = order.id;
    byId("cancel-pharmacy-order-label").textContent = `${order.reference || order.id} · ${order.pharmacyName || "Pharmacy"}`;
    byId("cancel-pharmacy-order-feedback").textContent = "";
    byId("cancel-pharmacy-order-dialog").showModal();
    byId("cancel-pharmacy-order-reason").focus();
  }

  function openReschedule(appointment) {
    const form = byId("reschedule-form");
    form.elements.namedItem("appointmentId").value = appointment.id;
    form.elements.namedItem("date").value = appointment.date || "";
    form.elements.namedItem("date").min = today();
    byId("reschedule-feedback").textContent = "";
    populateRescheduleTimes(appointment.id, appointment.time);
    byId("reschedule-dialog").showModal();
  }

  function normalizeAppointmentTime(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return "";
    let hour = Number(match[1]);
    if (match[3]) { hour %= 12; if (match[3].toUpperCase() === "PM") hour += 12; }
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }

  function populateRescheduleTimes(appointmentId, preferredTime = "") {
    const form = byId("reschedule-form");
    const date = form.elements.namedItem("date").value;
    const timeSelect = form.elements.namedItem("time");
    const appointment = dataStore.get("appointments", appointmentId);
    const slots = appointment && window.CarePlusClinic?.availableSlots({ doctor: appointment.doctor, doctorId: appointment.doctorId, date, ignoreId: appointment.id }) || [];
    timeSelect.replaceChildren(new Option(slots.length ? "Select an available time" : "No available times", ""));
    slots.forEach(slot => {
      const [hourText, minute] = slot.split(":");
      const hour = Number(hourText);
      const label = `${String(hour % 12 || 12).padStart(2, "0")}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
      timeSelect.add(new Option(label, slot));
    });
    timeSelect.disabled = !slots.length;
    const preferred = normalizeAppointmentTime(preferredTime);
    timeSelect.value = slots.includes(preferred) ? preferred : "";
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
  document.querySelectorAll("[data-care-filter]").forEach(button => button.addEventListener("click", () => {
    careFilter = button.dataset.careFilter;
    document.querySelectorAll("[data-care-filter]").forEach(item => item.classList.toggle("is-active", item === button));
    renderCareRequests();
  }));
  byId("care-search").addEventListener("input", renderCareRequests);
  document.querySelectorAll("[data-order-filter]").forEach(button => button.addEventListener("click", () => {
    orderFilter = button.dataset.orderFilter;
    document.querySelectorAll("[data-order-filter]").forEach(item => item.classList.toggle("is-active", item === button));
    renderOrders();
  }));
  byId("order-search").addEventListener("input", renderOrders);
  byId("cancel-appointment-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const reasonField = form.elements.namedItem("reason");
    const reason = reasonField.value.trim();
    const appointmentId = form.elements.namedItem("appointmentId").value;
    const feedback = byId("cancel-appointment-feedback");
    if (reason.length < 3) { feedback.textContent = "Please enter a reason with at least 3 characters."; reasonField.focus(); return; }
    const appointment = dataStore.get("appointments", appointmentId);
    if (!appointment || String(appointment.id) !== pendingCancellationId) { feedback.textContent = "This appointment could not be found. Refresh and try again."; return; }
    const changes = { status: "Cancelled", cancelReason: reason, lastActionByRole: "Customer", lastActionById: String(user.id) };
    if (Number(appointment.consultationFee) > 0) {
      changes.commissionStatus = ["Pending Review", "Payable", "Settled"].includes(appointment.commissionStatus) ? "Reversed" : "Not earned";
      if (Number(appointment.commissionCollected) > 0) changes.commissionReversedAmount = Number(appointment.commissionCollected);
      changes.commissionCollected = 0;
      changes.commissionRemainingToSettle = 0;
      if (Number(appointment.depositPaid) > 0) changes.refundStatus = String(appointment.paymentStatus || "").startsWith("Demo") ? "No refund due" : "Refund review required";
    }
    if (!window.CarePlusClinic?.updateAppointment(appointment.id, changes)) { feedback.textContent = "Could not cancel this appointment. Please try again."; return; }
    byId("cancel-appointment-dialog").close();
    pendingCancellationId = "";
    refreshUser(); showToast("Appointment cancelled.");
  });
  byId("cancel-care-request-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const reasonField = form.elements.namedItem("reason");
    const reason = reasonField.value.trim();
    const requestId = form.elements.namedItem("requestId").value;
    const feedback = byId("cancel-care-request-feedback");
    if (reason.length < 3) { feedback.textContent = "Please enter a reason with at least 3 characters."; reasonField.focus(); return; }
    const request = dataStore.get("careRequests", requestId);
    if (!request || String(request.id) !== pendingCareCancellationId || !ownedRecords("careRequests").some(item => String(item.id) === pendingCareCancellationId)) {
      feedback.textContent = "This care request could not be found. Refresh and try again."; return;
    }
    if (!canCancelCareRequest(request)) {
      feedback.textContent = "Only pending or accepted care requests can be cancelled."; return;
    }
    if (!dataStore.update("careRequests", request.id, { status: "Cancelled", cancelReason: reason, cancellationReason: reason, lastActionByRole: "Customer", lastActionById: String(user.id) })) {
      feedback.textContent = "Could not cancel this request. Please try again."; return;
    }
    byId("cancel-care-request-dialog").close();
    pendingCareCancellationId = "";
    refreshUser(); showToast("Care request cancelled; the nurse and admin can see the reason.");
  });
  byId("cancel-pharmacy-order-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const reasonField = form.elements.namedItem("reason");
    const reason = reasonField.value.trim();
    const orderId = form.elements.namedItem("orderId").value;
    const feedback = byId("cancel-pharmacy-order-feedback");
    if (reason.length < 3) { feedback.textContent = "Please enter a reason with at least 3 characters."; reasonField.focus(); return; }
    const order = dataStore.get("orders", orderId);
    if (!order || String(order.id) !== pendingPharmacyOrderId || !ownedRecords("orders").some(item => String(item.id) === pendingPharmacyOrderId) || orderStatus(order) !== "Pending") {
      feedback.textContent = "Only a pending order on your account can be cancelled."; return;
    }
    const result = window.CarePlusPharmacy?.cancelCustomerOrder(order.id, user.id, reason);
    if (!result?.ok) { feedback.textContent = result?.error || "Could not cancel this order. Please try again."; return; }
    byId("cancel-pharmacy-order-dialog").close();
    pendingPharmacyOrderId = "";
    renderAll();
    showToast("Order cancelled; the pharmacy and admin can see your reason.");
  });
  byId("reschedule-form").elements.namedItem("date").addEventListener("change", event => {
    const id = byId("reschedule-form").elements.namedItem("appointmentId").value;
    populateRescheduleTimes(id);
    byId("reschedule-feedback").textContent = "";
  });

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
    if (!appointment || !time || !window.CarePlusClinic?.isAvailable({ doctor: appointment.doctor, doctorId: appointment.doctorId, date, time, ignoreId: id })) {
      byId("reschedule-feedback").textContent = "That time is unavailable for this doctor. Choose another date and time."; return;
    }
    const updated = window.CarePlusClinic.updateAppointment(id, { date, time, status: "Requested", lastActionByRole: "Customer", lastActionById: String(user.id) });
    if (!updated) { byId("reschedule-feedback").textContent = "Could not update this appointment."; return; }
    byId("reschedule-dialog").close(); refreshUser(); showToast("New appointment time requested.");
  });

  ensureProfileDemoRecords();
  renderAll();
  const pageParams = new URLSearchParams(window.location.search);
  if (["orders", "appointments"].includes(pageParams.get("tab"))) {
    document.querySelector(`[data-tab="${pageParams.get("tab")}"]`)?.click();
  }
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
