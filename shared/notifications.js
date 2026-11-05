(() => {
  const store = window.CarePlusData;
  if (!store) return;
  const scriptUrl = document.currentScript?.src || new URL("notifications.js", location.href).href;
  const appRoot = new URL("../", scriptUrl);
  const allNotificationsUrl = new URL("shared/notifications.html", appRoot).href;
  const categories = { appointment: "Appointments", pharmacy: "Pharmacy orders", care: "Elderly care", store: "Store orders" };
  const icons = { appointment: "▦", pharmacy: "♡", care: "♡", store: "▣" };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function viewer() {
    const identity = String(sessionStorage.getItem("careplusDemoIdentity") || localStorage.getItem("careplusDemoIdentity") || "").trim().toLowerCase();
    const accountId = sessionStorage.getItem("careplusDemoAccountIdV1") || "";
    const account = store.list("users").find(user => accountId && String(user.id) === String(accountId))
      || store.list("users").find(user => String(user.email || "").trim().toLowerCase() === identity);
    const role = String(account?.role || "Customer").trim().toLowerCase();
    if (["admin", "administrator"].includes(role)) return { role: "admin", id: "*", account };
    if (role === "doctor") return { role, id: String(account.doctorId || account.id), account };
    if (role === "pharmacy") return { role, id: String(account.pharmacyId || account.id), account };
    if (role === "nurse") return { role, id: String(account.nurseId || account.id), account };
    return { role: "customer", id: String(account?.id || ""), account };
  }

  function visibleNotifications() {
    const user = viewer();
    const rows = store.list("notifications").filter(item => !item.deletedAt && (user.role === "admin"
      || item.recipientRole === user.role && String(item.recipientId) === user.id));
    return { user, rows: store.newestFirst(rows) };
  }

  // UI-facing adapter: an ASP.NET Core implementation can provide these operations over API endpoints and SignalR.
  const notificationService = {
    list: visibleNotifications,
    markRead(id) {
      const { user, rows } = visibleNotifications();
      const item = rows.find(row => String(row.id) === String(id));
      if (!item || user.role !== "admin" && String(item.recipientId) !== user.id) return null;
      return store.update("notifications", item.id, { readAt: new Date().toISOString() });
    },
    markAllRead() { visibleNotifications().rows.filter(item => !item.readAt).forEach(item => store.update("notifications", item.id, { readAt: new Date().toISOString() })); },
    delete(id) {
      const { user, rows } = visibleNotifications();
      const item = rows.find(row => String(row.id) === String(id));
      if (!item || user.role !== "admin" && String(item.recipientId) !== user.id) return null;
      return store.update("notifications", item.id, { deletedAt: new Date().toISOString() });
    },
    subscribe(callback) { return store.subscribe(callback); }
  };
  window.CarePlusNotifications = notificationService;

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function safeTarget(value) {
    try {
      const target = new URL(value, appRoot);
      return target.origin === appRoot.origin && target.pathname.startsWith(appRoot.pathname) ? target.href : allNotificationsUrl;
    } catch { return allNotificationsUrl; }
  }

  function notificationTarget(id, fallback) {
    const notification = store.list("notifications").find(item => String(item.id) === String(id));
    if (notification?.recipientRole === "customer" && notification.category === "pharmacy" && notification.recordType === "order") {
      return new URL("Profile/index.html?tab=orders", appRoot).href;
    }
    return safeTarget(fallback);
  }

  function mountWidget(root) {
    if (!root || root.dataset.mounted === "true") return;
    root.dataset.mounted = "true";
    root.classList.add("cpn-widget");
    root.innerHTML = `<button class="cpn-trigger" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="cpn-trigger-label">Notifications</span><span class="cpn-badge" hidden>0</span></button><section class="cpn-popover" hidden><div class="cpn-popover-head"><strong>Notifications</strong><button type="button" data-cpn-mark-all>Mark all as read</button></div><div class="cpn-items"></div><div class="cpn-popover-foot"><a class="cpn-action-link" href="${allNotificationsUrl}">View all notifications</a></div></section>`;
    const trigger = root.querySelector(".cpn-trigger");
    const popover = root.querySelector(".cpn-popover");
    trigger.addEventListener("click", () => {
      const open = popover.hidden;
      popover.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
    });
    root.querySelector("[data-cpn-mark-all]").addEventListener("click", () => {
      notificationService.markAllRead();
    });
    root.querySelector(".cpn-items").addEventListener("click", event => {
      const link = event.target.closest("a[data-notification-id]");
      if (!link) return;
      event.preventDefault();
      notificationService.markRead(link.dataset.notificationId);
      window.location.assign(notificationTarget(link.dataset.notificationId, link.href));
    });
    root.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("click", event => {
      if (!root.contains(event.target)) { popover.hidden = true; trigger.setAttribute("aria-expanded", "false"); }
    });
    renderWidget(root);
  }

  function renderWidget(root) {
    if (!root?.isConnected) return;
    const { rows } = visibleNotifications();
    const unread = rows.filter(item => !item.readAt).length;
    const badge = root.querySelector(".cpn-badge");
    if (!badge) return;
    badge.textContent = String(unread);
    badge.setAttribute("aria-label", `${unread} unread notifications`);
    badge.hidden = unread === 0;
    const items = root.querySelector(".cpn-items");
    const latest = rows.slice(0, 8);
    items.innerHTML = latest.length ? latest.map(item => `<a class="cpn-item ${item.readAt ? "" : "is-unread"}" href="${escapeHtml(safeTarget(item.link))}" data-notification-id="${escapeHtml(item.id)}"><span class="cpn-icon" aria-hidden="true">${escapeHtml(icons[item.category] || "•")}</span><span class="cpn-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span><time>${escapeHtml(formatTime(item.createdAt))}</time></span>${item.readAt ? "" : `<i class="cpn-unread-dot" aria-label="Unread"></i>`}</a>`).join("") : `<div class="cpn-empty">You’re all caught up.</div>`;
  }

  function ensureCustomerWidget() {
    const actions = document.querySelector("#nav-container .careplus-navbar__actions, .careplus-navbar__actions");
    if (!actions) return false;
    const existing = document.getElementById("careplus-notification-widget");
    if (existing) {
      existing.hidden = false;
      mountWidget(existing);
      return true;
    }
    const root = document.createElement("div");
    root.id = "careplus-notification-widget";
    root.className = "cpn-navbar-slot";
    actions.prepend(root);
    mountWidget(root);
    return true;
  }

  function bindPageContext() {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab) document.querySelector(`[data-tab="${CSS.escape(tab)}"]`)?.click();
    const page = params.get("page");
    if (page) document.querySelector(`.nav-link[data-page="${CSS.escape(page)}"]`)?.click();
    window.setTimeout(() => {
      const appointmentId = params.get("appointmentId");
      const orderId = params.get("orderId");
      const requestId = params.get("requestId");
      if (appointmentId) document.querySelector(`tr[data-appointment-id="${CSS.escape(appointmentId)}"]`)?.scrollIntoView({ block: "center" });
      if (orderId) {
        const pharmacyDetail = document.querySelector(`[data-order-details="${CSS.escape(orderId)}"]`);
        if (pharmacyDetail) pharmacyDetail.click();
        document.querySelector(`[data-order-card="${CSS.escape(orderId)}"]`)?.scrollIntoView({ block: "center" });
      }
      if (requestId) {
        const requestDetail = document.querySelector(`tr[data-request-id="${CSS.escape(requestId)}"] button[data-action="details"]`);
        if (requestDetail) requestDetail.click();
        document.querySelector(`tr[data-request-id="${CSS.escape(requestId)}"]`)?.scrollIntoView({ block: "center" });
      }
      const recordId = params.get("recordId");
      if (recordId) {
        const card = document.querySelector(`[data-record-id="${CSS.escape(recordId)}"]`);
        card?.scrollIntoView({ block: "center" });
        card?.querySelector("button")?.click();
      }
    }, 180);
  }

  function renderNotificationPage() {
    const list = document.getElementById("cpn-page-list");
    if (!list) return;
    const filter = document.getElementById("cpn-category-filter");
    const { user, rows } = visibleNotifications();
    const backTarget = { doctor: "Doctor/index.html", pharmacy: "Pharmacy/dashboard.html", nurse: "Nurse/index.html", admin: "Admin/index.html", customer: "Profile/index.html" }[user.role] || "Home/Master.html";
    document.getElementById("cpn-page-back").href = new URL(backTarget, appRoot).href;
    const selected = filter.value;
    const shown = rows.filter(item => !selected || item.category === selected);
    document.getElementById("cpn-page-count").textContent = `${shown.length} notification${shown.length === 1 ? "" : "s"}`;
    document.getElementById("cpn-admin-note").hidden = user.role !== "admin";
    list.innerHTML = shown.length ? shown.map(item => `<article class="cpn-page-card ${item.readAt ? "" : "is-unread"}"><span class="cpn-icon" aria-hidden="true">${escapeHtml(icons[item.category] || "•")}</span><div class="cpn-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span><time>${escapeHtml(categories[item.category] || "Notification")} · ${escapeHtml(formatTime(item.createdAt))}${item.readAt ? " · Read" : " · Unread"}${user.role === "admin" ? ` · Recipient: ${escapeHtml(item.recipientRole)} ${escapeHtml(item.recipientId)}` : ""}</time></div><div class="cpn-card-actions"><a href="${escapeHtml(safeTarget(item.link))}" data-cpn-open="${escapeHtml(item.id)}">${escapeHtml(item.actionLabel || "View details")}</a><button type="button" data-cpn-read="${escapeHtml(item.id)}">${item.readAt ? "Read" : "Mark read"}</button><button class="cpn-delete" type="button" data-cpn-delete="${escapeHtml(item.id)}">Delete</button></div></article>`).join("") : `<div class="cpn-empty">No notifications in this category.</div>`;
  }

  document.addEventListener("click", event => {
    const readButton = event.target.closest("[data-cpn-read]");
      if (readButton) { notificationService.markRead(readButton.dataset.cpnRead); return; }
    const deleteButton = event.target.closest("[data-cpn-delete]");
      if (deleteButton) { notificationService.delete(deleteButton.dataset.cpnDelete); return; }
    const openLink = event.target.closest("[data-cpn-open]");
    if (openLink) {
      event.preventDefault();
      notificationService.markRead(openLink.dataset.cpnOpen);
      window.location.assign(notificationTarget(openLink.dataset.cpnOpen, openLink.href));
    }
  });

  document.getElementById("cpn-category-filter")?.addEventListener("change", renderNotificationPage);
  document.getElementById("cpn-mark-all-page")?.addEventListener("click", () => {
    notificationService.markAllRead();
  });
  // Backend seam: replace this browser-store subscription with the authenticated SignalR notification stream.
  notificationService.subscribe(() => {
    const root = document.getElementById("careplus-notification-widget");
    if (root?.dataset.mounted === "true") renderWidget(root);
    renderNotificationPage();
  });

  const widgetRoot = document.getElementById("careplus-notification-widget");
  if (widgetRoot) mountWidget(widgetRoot);
  ensureCustomerWidget();
  if (!document.getElementById("careplus-notification-widget") && document.getElementById("nav-container")) {
    const observer = new MutationObserver(() => { if (ensureCustomerWidget()) observer.disconnect(); });
    observer.observe(document.getElementById("nav-container"), { childList: true, subtree: true });
  }
  renderNotificationPage();
  bindPageContext();
  window.setTimeout(bindPageContext, 0);
})();
