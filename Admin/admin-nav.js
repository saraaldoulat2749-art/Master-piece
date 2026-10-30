(() => {
  const namespace = "http://www.w3.org/2000/svg";
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    doctors: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    nurses: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    appointments: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>',
    products: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5M12 13v8"/>',
    pharmacies: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/><path d="M10 9h4M12 7v4"/>',
    care: '<path d="M20.8 8.6c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z"/><path d="M8 12h8M12 8v8"/>',
    elderlycare: '<path d="M20.8 8.6c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z"/><path d="M8 12h8M12 8v8"/>',
    orders: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
    medicineorders: '<path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
    commission: '<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="m5 19 14-14"/>',
    revenue: '<path d="m12 3 9 9-9 9-9-9 9-9Z"/>',
    medicalstore: '<path d="M3 10h18M5 10V7l7-4 7 4v3M5 10v10h14V10M9 14h6M12 11v6"/>',
    aiservices: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>'
  };
  function icon(markup, className) {
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) svg.classList.add(className);
    svg.innerHTML = markup;
    return svg;
  }

  const brand = document.querySelector(".sidebar .brand");
  if (brand) {
    const logo = document.createElement("span");
    logo.className = "logo-icon";
    logo.setAttribute("aria-hidden", "true");
    const heart = icon('<path d="M24 41S6 29 6 17.5C6 10.8 10.8 7 16.1 7c3.4 0 6.1 1.8 7.9 4.8C25.8 8.8 28.5 7 31.9 7 37.2 7 42 10.8 42 17.5 42 29 24 41 24 41Z"/><path d="M11 24h7l3-6 5.5 13 4-8H37"/>');
    heart.setAttribute("viewBox", "0 0 48 48");
    heart.setAttribute("stroke-width", "2.6");
    logo.append(heart);
    const wordmark = document.createElement("span");
    wordmark.append(document.createTextNode("Care"));
    const plus = document.createElement("span");
    plus.className = "brand-plus";
    plus.textContent = "Plus";
    const admin = document.createElement("small");
    admin.textContent = "ADMIN";
    wordmark.append(plus, admin);
    brand.setAttribute("aria-label", "CarePlus Admin dashboard");
    brand.replaceChildren(logo, wordmark);
  }

  document.querySelectorAll(".side-nav a").forEach(link => {
    const holder = link.querySelector(":scope > span");
    const label = link.textContent.slice(holder?.textContent.length || 0).trim().toLowerCase().replace(/\s+/g, " ");
    const key = label === "care requests" ? "care" : label === "commission rate" ? "commission" : label === "revenue & reports" ? "revenue" : label.replace(/\s+/g, "");
    if (!holder || !paths[key]) return;
    holder.classList.add("nav-icon");
    holder.replaceChildren(icon(paths[key], "admin-icon"));
  });

  const topbar = document.querySelector(".topbar");
  const sidebarBottom = document.querySelector(".sidebar-bottom");
  const mainArea = document.querySelector(".main-area");
  const menuToggle = topbar?.querySelector(".menu-toggle");
  const logout = topbar?.querySelector("[data-auth-toggle]");
  if (menuToggle && mainArea) mainArea.prepend(menuToggle);
  if (logout && sidebarBottom) sidebarBottom.append(logout);
  topbar?.remove();
  document.querySelectorAll(".menu-toggle").forEach(button => {
    button.replaceChildren(icon('<path d="M4 6h16M4 12h16M4 18h16"/>', "admin-icon"));
  });
})();
