const CART_KEY = "careplusCart";
const DRAFT_KEY = "careplusCheckoutDraft";
const ORDER_KEY = "careplusLatestOrder";
const DELIVERY_FEES = { standard: 2.5, express: 5.0 };
const money = amount => `JOD ${Number(amount || 0).toFixed(2)}`;
const byId = id => document.getElementById(id);

function readStorage(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) || fallback; } catch { return fallback; }
}
let cart = readStorage(localStorage, CART_KEY, []);
cart = Array.isArray(cart) ? cart.filter(item => item?.product?.id && Number(item.quantity) > 0) : [];

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadSharedPage() {
  fetch("../../Nav/index.html").then(response => response.text()).then(html => {
    byId("nav-container").innerHTML = html;
    document.querySelectorAll("#nav-container a[href^='../']").forEach(link => link.href = `../${link.getAttribute("href")}`);
    const storeLink = [...document.querySelectorAll("#nav-container nav a")].find(link => link.textContent.trim() === "Medical Store");
    if (storeLink) { storeLink.href = "../index.html"; storeLink.classList.add("active"); }
  }).catch(error => console.error("Could not load CarePlus navigation:", error));
  fetch("../../Footer/index.html").then(response => response.text()).then(html => {
    byId("footer-container").innerHTML = html;
    document.querySelectorAll("#footer-container a[href^='../']").forEach(link => link.href = `../${link.getAttribute("href")}`);
    const storeLink = [...document.querySelectorAll("#footer-container a")].find(link => link.textContent.trim() === "Medical Store");
    if (storeLink) storeLink.href = "../index.html";
  }).catch(error => console.error("Could not load CarePlus footer:", error));
}

function isConfirmationPage() { return window.location.pathname.toLowerCase().endsWith("confirmation.html"); }

function renderCheckoutItems() {
  const itemsContainer = byId("order-items");
  if (!cart.length) {
    itemsContainer.innerHTML = "";
    byId("empty-cart").hidden = false;
    byId("place-order").disabled = true;
  } else {
    byId("empty-cart").hidden = true;
    byId("place-order").disabled = false;
    itemsContainer.innerHTML = cart.map(({ product, quantity }) => `
      <article class="order-item" data-item-id="${product.id}">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="order-item-copy"><strong>${product.name}</strong><span>${money(product.price)} each</span>
          <div class="order-item-controls"><button type="button" data-action="decrease" data-id="${product.id}" aria-label="Decrease ${product.name} quantity">−</button><span>${quantity}</span><button type="button" data-action="increase" data-id="${product.id}" aria-label="Increase ${product.name} quantity">+</button><button class="remove-item" type="button" data-action="remove" data-id="${product.id}">Remove</button></div>
        </div><strong class="order-item-subtotal">${money(product.price * quantity)}</strong>
      </article>`).join("");
  }
  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price) * Number(item.quantity), 0);
  const delivery = DELIVERY_FEES[document.querySelector('input[name="delivery"]:checked')?.value || "standard"];
  byId("subtotal").textContent = money(subtotal);
  byId("delivery-fee").textContent = cart.length ? money(delivery) : money(0);
  byId("grand-total").textContent = money(cart.length ? subtotal + delivery : 0);
}

function loadDraft() {
  const draft = readStorage(sessionStorage, DRAFT_KEY, {});
  Object.entries(draft).forEach(([name, value]) => {
    const field = document.querySelector(`[name="${name}"]`);
    if (field && field.type !== "radio") field.value = value;
  });
  if (draft.delivery) {
    const choice = document.querySelector(`input[name="delivery"][value="${draft.delivery}"]`);
    if (choice) choice.checked = true;
  }
}

function saveDraft() {
  const draft = Object.fromEntries([...document.querySelectorAll("#checkout-form [name]")].filter(field => field.type !== "radio").map(field => [field.name, field.value]));
  draft.delivery = document.querySelector('input[name="delivery"]:checked')?.value || "standard";
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function setFieldError(field, message) {
  const error = document.querySelector(`[data-error="${field.name}"]`);
  if (error) error.textContent = message;
  field.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateForm() {
  let firstInvalid = null;
  const fields = [...document.querySelectorAll("#checkout-form [required]")];
  for (const field of fields) {
    let message = "";
    if (!field.value.trim()) message = "This field is required.";
    else if (field.name === "fullName" && field.value.trim().length < 3) message = "Enter your full name.";
    else if (field.name === "email" && !field.validity.valid) message = "Enter a valid email address.";
    else if (field.name === "phone" && !/^(?:\+962|00962|0)?7[789]\d{7}$/.test(field.value.replace(/[\s-]/g, ""))) message = "Enter a valid Jordanian mobile number.";
    else if (field.name === "address" && field.value.trim().length < 8) message = "Please enter a complete delivery address.";
    setFieldError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) { firstInvalid.focus(); return false; }
  return true;
}

function submitOrder(event) {
  event.preventDefault();
  const formMessage = byId("form-message");
  formMessage.hidden = true;
  if (!cart.length) {
    formMessage.textContent = "Your cart is empty. Add a product before checkout.";
    formMessage.hidden = false;
    return;
  }
  if (!validateForm()) return;
  const formData = new FormData(byId("checkout-form"));
  const deliveryMethod = formData.get("delivery") || "standard";
  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price) * Number(item.quantity), 0);
  const deliveryFee = DELIVERY_FEES[deliveryMethod];
  const order = {
    reference: `CP-${Date.now().toString(36).toUpperCase()}`,
    items: cart,
    customer: {
      fullName: formData.get("fullName").trim(), email: formData.get("email").trim(), phone: formData.get("phone").trim(),
      city: formData.get("city"), area: formData.get("area").trim(), address: formData.get("address").trim(), instructions: formData.get("instructions").trim()
    },
    deliveryMethod, deliveryFee, payment: "Cash on Delivery", subtotal, total: subtotal + deliveryFee,
    placedAt: new Date().toISOString()
  };
  const signedInIdentity = String(sessionStorage.getItem("careplusDemoIdentity") || "").trim().toLowerCase();
  const signedInUser = window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === signedInIdentity || user.phone === sessionStorage.getItem("careplusDemoIdentity"));
  const orderOwner = signedInUser || window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === order.customer.email.toLowerCase());
  const sharedOrder = window.CarePlusData?.create("orders", {
    reference: order.reference, customerName: order.customer.fullName, items: order.items, customer: order.customer,
    userId: orderOwner?.id || "",
    deliveryMethod, deliveryFee, payment: order.payment, subtotal, total: order.total,
    placedAt: order.placedAt, status: "Placed", source: "store-checkout"
  });
  if (!sharedOrder) {
    formMessage.textContent = "Your order could not be saved in this browser. Please try again.";
    formMessage.hidden = false;
    return;
  }
  order.id = sharedOrder.id;
  sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
  sessionStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(CART_KEY);
  window.location.href = "confirmation.html";
}

function renderConfirmation() {
  const order = readStorage(sessionStorage, ORDER_KEY, null);
  if (!order) { byId("confirmation-card").hidden = true; byId("no-order").hidden = false; return; }
  byId("order-reference").textContent = order.reference;
  byId("confirmed-items").innerHTML = order.items.map(({ product, quantity }) => `
    <article class="order-item confirmed-item"><img src="${product.image}" alt="${product.name}" loading="lazy"><div class="order-item-copy"><strong>${product.name}</strong><span>${money(product.price)} × ${quantity}</span></div><strong class="order-item-subtotal">${money(product.price * quantity)}</strong></article>`).join("");
  byId("confirmed-subtotal").textContent = money(order.subtotal);
  byId("confirmed-delivery-fee").textContent = `${money(order.deliveryFee)} (${order.deliveryMethod === "express" ? "Express" : "Standard"})`;
  byId("confirmed-total").textContent = money(order.total);
  const customer = order.customer;
  byId("delivery-details").innerHTML = `<dt>Name</dt><dd>${escapeHtml(customer.fullName)}</dd><dt>Phone</dt><dd>${escapeHtml(customer.phone)}</dd><dt>Email</dt><dd>${escapeHtml(customer.email)}</dd><dt>Address</dt><dd>${escapeHtml(customer.address)}, ${escapeHtml(customer.area)}, ${escapeHtml(customer.city)}</dd>${customer.instructions ? `<dt>Instructions</dt><dd>${escapeHtml(customer.instructions)}</dd>` : ""}`;
  byId("confirmed-payment").textContent = order.payment;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

loadSharedPage();
if (isConfirmationPage()) {
  renderConfirmation();
} else {
  loadDraft();
  renderCheckoutItems();
  byId("order-items").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = String(button.dataset.id);
    const item = cart.find(entry => String(entry.product.id) === id);
    if (!item) return;
    if (button.dataset.action === "remove") cart = cart.filter(entry => String(entry.product.id) !== id);
    if (button.dataset.action === "increase") item.quantity += 1;
    if (button.dataset.action === "decrease") { item.quantity -= 1; if (item.quantity <= 0) cart = cart.filter(entry => String(entry.product.id) !== id); }
    saveCart(); renderCheckoutItems();
  });
  document.querySelectorAll('input[name="delivery"]').forEach(input => input.addEventListener("change", () => { updateTotals(); saveDraft(); }));
  byId("checkout-form").addEventListener("input", event => { if (event.target.name) { setFieldError(event.target, ""); saveDraft(); } });
  byId("checkout-form").addEventListener("change", event => { if (event.target.name) saveDraft(); });
  byId("checkout-form").addEventListener("submit", submitOrder);
}
