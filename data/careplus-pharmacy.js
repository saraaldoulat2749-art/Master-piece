/*
 * Pharmacy and commission demo adapter. Replace these methods with authenticated API calls.
 * Browser storage is shared only by same-origin tabs and is not secure payment evidence.
 */
(() => {
  const DEFAULT_PHARMACY_ID = "pharmacy-1";
  const SETTINGS_KEY = "careplusCommissionSettingsV1";
  const DEFAULT_DELIVERY_FEE = 2;
  const DEFAULT_DELIVERY_FEES = { near: 1, sameCity: DEFAULT_DELIVERY_FEE, far: 4 };
  const AUDIT_KEY = "careplusCommissionAuditV1";
  const SAMPLE_MARKER = "careplusPharmacySampleOrderV1";
  const sampleInventory = [
    { id: "med-panadol", name: "Panadol 500 mg", category: "Pain relief", price: 2.5, quantity: 18, expiry: "2027-11-30", available: true, listed: true, source: "demo-seed" },
    { id: "med-ibuprofen", name: "Ibuprofen 400 mg", category: "Pain relief", price: 3.25, quantity: 5, expiry: "2027-08-15", available: true, listed: true, source: "demo-seed" },
    { id: "med-vitamin-c", name: "Vitamin C 1000 mg", category: "Vitamins", price: 4.5, quantity: 0, expiry: "2028-02-28", available: false, listed: true, source: "demo-seed" },
    { id: "med-vitamin-d", name: "Vitamin D3 1000 IU", category: "Vitamins", price: 6.75, quantity: 12, expiry: "2027-04-30", available: true, listed: true, source: "demo-seed" },
    { id: "med-cetirizine", name: "Cetirizine 10 mg", category: "Allergy", price: 2, quantity: 2, expiry: "2027-01-31", available: true, listed: true, source: "demo-seed" },
    { id: "med-omeprazole", name: "Omeprazole 20 mg", category: "Digestive health", price: 5.25, quantity: 9, expiry: "2027-09-30", available: true, listed: true, source: "demo-seed" }
  ];
  const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const isExpired = medicine => Boolean(medicine.expiry && new Date(`${medicine.expiry}T23:59:59`) < new Date());
  function makeSampleInventory(pharmacy) {
    const aliases = {
      panadol: sampleInventory[0], paracetamol: { ...sampleInventory[0], id: "med-paracetamol", name: "Paracetamol 500 mg", price: 1.75 },
      ibuprofen: sampleInventory[1], "vitamin c": sampleInventory[2], "vitamin d": sampleInventory[3]
    };
    return (pharmacy.medicines || []).map(rawName => {
      const key = String(rawName).toLowerCase();
      const base = aliases[key] || { name: String(rawName), category: "General", price: 3.5, quantity: 10, expiry: "2027-10-31", available: true, listed: true };
      const item = { ...base, quantity: Number(base.quantity) > 0 ? base.quantity : 8, listed: true, id: `${pharmacy.id}-${base.id || key.replace(/[^a-z0-9]+/g, "-")}`, source: "demo-seed" };
      item.available = Number(item.quantity) > 0 && !isExpired(item);
      return item;
    });
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  }
  function get(id = DEFAULT_PHARMACY_ID) { return window.CarePlusData?.get("pharmacies", id) || null; }
  function isActivePharmacy(pharmacy) {
    const status = String(pharmacy?.status || "Active").replace(/[\s_-]/g, "").toLowerCase();
    return Boolean(pharmacy && pharmacy.deleted !== true && !["inactive", "deleted", "disabled", "removed"].includes(status));
  }
  function listOrders(pharmacyId) {
    return window.CarePlusData.list("orders").filter(order => order.source === "pharmacy-order" && (pharmacyId == null || String(order.pharmacyId) === String(pharmacyId)));
  }
  function effectiveRate(pharmacyId) {
    const config = readJson(SETTINGS_KEY, { defaultRate: 10, pharmacyRates: {}, deliveryFee: DEFAULT_DELIVERY_FEE });
    const pharmacy = get(pharmacyId);
    const override = config.pharmacyRates?.[String(pharmacyId)] ?? pharmacy?.commissionRate;
    const rate = Number(override);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) return rate;
    const fallback = Number(config.defaultRate);
    return Number.isFinite(fallback) && fallback >= 0 && fallback <= 100 ? fallback : 10;
  }
  function syncMedicineNames(pharmacy) {
    pharmacy.medicines = (pharmacy.inventory || []).filter(item => item.available !== false && Number(item.quantity) > 0 && !isExpired(item)).map(item => String(item.name || "").trim().toLowerCase()).filter(Boolean);
    return pharmacy;
  }
  function nextOrderId() {
    const highest = listOrders().reduce((max, order) => {
      const match = String(order.reference || order.id || "").match(/^ORD-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1000);
    return `ORD-${highest + 1}`;
  }
  function customerReference(userId) {
    const value = String(userId || "").replace(/[^a-z0-9]/gi, "").replace(/^demo/i, "") || "GUEST";
    return `CUS-${value.slice(-8).toUpperCase()}`;
  }
  function currentCustomer() {
    let identity = "";
    try { identity = localStorage.getItem("careplusDemoIdentity") || sessionStorage.getItem("careplusDemoIdentity") || ""; } catch {}
    if (!identity) return null;
    const user = window.CarePlusData.list("users").find(row => String(row.email || "").toLowerCase() === identity.toLowerCase() || String(row.phone || "") === identity);
    if (!user || ["admin", "administrator"].includes(String(user.role || "").toLowerCase())) return null;
    return { userId: String(user.id), name: String(user.name || "CarePlus customer"), reference: customerReference(user.id) };
  }
  function auditEntries() { return readJson(AUDIT_KEY, []); }
  function audit(orderId, action, details = {}, actor = "System") {
    const entries = auditEntries();
    entries.push({ id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, orderId: String(orderId || ""), action, details, actor, at: new Date().toISOString() });
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
      window.dispatchEvent(new CustomEvent("careplus:commission", { detail: { type: "audit" } }));
      return true;
    } catch { return false; }
  }
  function emitSettings() { window.dispatchEvent(new CustomEvent("careplus:commission", { detail: { type: "settings" } })); }

  function bootstrap() {
    const pharmacies = window.CarePlusData.list("pharmacies");
    pharmacies.forEach(pharmacy => {
      const changes = {};
      if (!Array.isArray(pharmacy.inventory)) changes.inventory = pharmacy.id === DEFAULT_PHARMACY_ID ? sampleInventory.map(item => ({ ...item })) : makeSampleInventory(pharmacy);
      if (!pharmacy.openingHours) changes.openingHours = pharmacy.hours || "08:00–23:00";
      if (!pharmacy.location) changes.location = pharmacy.area || "Amman";
      if (!pharmacy.description) changes.description = "Your neighborhood pharmacy, here to help.";
      if (Object.keys(changes).length) window.CarePlusData.update("pharmacies", pharmacy.id, syncMedicineNames({ ...pharmacy, ...changes }));
    });
    const record = get();
    if (!record) return null;
    migrateOrders();
    seedSampleOrder(record);
    return record;
  }
  function migrateOrders() {
    listOrders().forEach(order => {
      const changes = {};
      if (order.status === "Accepted") { changes.status = "Confirmed"; changes.inventoryReserved = true; }
      if (order.status === "Rejected") { changes.status = "Cancelled"; changes.cancelReason ||= "Declined in the previous demo flow."; }
      if (order.status === "Ready for Pickup") changes.status = "Preparing for Delivery";
      if (order.status === "Completed") changes.status = "Delivered";
      if (!order.paymentStatus) changes.paymentStatus = "Pending";
      if (!order.paymentMethod || order.paymentMethod === "cash-at-pickup") changes.paymentMethod = "cash-on-delivery";
      if (order.paymentVerified === undefined) changes.paymentVerified = false;
      if (order.commissionRate === undefined) changes.commissionRate = effectiveRate(order.pharmacyId);
      if (order.commissionAmount === undefined) changes.commissionAmount = 0;
      if (!order.commissionStatus) changes.commissionStatus = "Not Eligible";
      if (!order.customerReference) changes.customerReference = customerReference(order.userId);
      if (Object.keys(changes).length) window.CarePlusData.update("orders", order.id, changes);
    });
  }
  function seedSampleOrder(pharmacy) {
    try {
      if (localStorage.getItem(SAMPLE_MARKER) === "1") return;
      if (!listOrders(pharmacy.id).length) {
        const medicine = (pharmacy.inventory || []).find(item => item.available !== false && Number(item.quantity) >= 2 && !isExpired(item));
        if (medicine) {
          const reference = nextOrderId();
          const sampleOrder = {
            id: reference, reference, pharmacyId: String(pharmacy.id), pharmacyName: pharmacy.name, source: "pharmacy-order", demo: true,
            userId: "demo-user-001", customerReference: "CUS-USER001",
            deliveryAddress: "12 King Abdullah Street, Amman (sample)", deliveryPhone: "+962 7 9000 1001",
            items: [{ medicineId: medicine.id, name: medicine.name, price: Number(medicine.price), quantity: 2 }],
            subtotal: roundMoney(Number(medicine.price) * 2), total: roundMoney(Number(medicine.price) * 2), placedAt: new Date().toISOString(),
            status: "Pending", paymentMethod: "cash-on-delivery", paymentStatus: "Pending", paymentVerified: false,
            commissionRate: effectiveRate(pharmacy.id), commissionAmount: 0, commissionStatus: "Not Eligible", cancelReason: "", inventoryReserved: true
          };
          const reserved = updatePharmacy(pharmacy.id, { inventory: pharmacy.inventory.map(item => String(item.id) === String(medicine.id) ? { ...item, quantity: Number(item.quantity) - 2 } : item) });
          if (reserved && !window.CarePlusData.create("orders", sampleOrder)) {
            updatePharmacy(pharmacy.id, { inventory: pharmacy.inventory });
          }
        }
      }
      localStorage.setItem(SAMPLE_MARKER, "1");
    } catch (error) { console.warn("Sample pharmacy order could not be initialized", error); }
  }
  function updatePharmacy(id, changes) {
    const current = get(id);
    if (!current) return null;
    const next = { ...current, ...changes };
    if (Array.isArray(next.inventory)) {
      next.inventory = next.inventory.map(medicine => {
        const quantity = Math.max(0, Number(medicine.quantity) || 0);
        const listed = medicine.listed ?? (quantity === 0 ? true : medicine.available !== false);
        return { ...medicine, quantity, listed, available: quantity > 0 && !isExpired(medicine) && listed };
      });
      syncMedicineNames(next);
    }
    return window.CarePlusData.update("pharmacies", id, next);
  }
  function createOrder({ pharmacyId = DEFAULT_PHARMACY_ID, medicineId, quantity, deliveryAddress, deliveryPhone, deliveryZone = "sameCity", idempotencyKey }) {
    const customer = currentCustomer();
    if (!customer) return { ok: false, error: "Please sign in with a customer account before placing an order." };
    if (idempotencyKey) {
      const duplicate = listOrders(pharmacyId).find(order => order.idempotencyKey === idempotencyKey && String(order.userId) === customer.userId);
      if (duplicate) return { ok: true, order: duplicate, duplicate: true };
    }
    const pharmacy = get(pharmacyId);
    const medicine = pharmacy?.inventory?.find(row => String(row.id) === String(medicineId));
    const count = Number(quantity);
    if (!isActivePharmacy(pharmacy)) return { ok: false, error: "This pharmacy is no longer available." };
    if (pharmacy?.open === false) return { ok: false, error: "This pharmacy is currently closed." };
    if (!pharmacy || !medicine || medicine.available === false || Number(medicine.quantity) < 1 || isExpired(medicine)) return { ok: false, error: "This medicine is currently unavailable." };
    if (!Number.isInteger(count) || count < 1 || count > 99) return { ok: false, error: "Enter a valid quantity." };
    if (count > Number(medicine.quantity)) return { ok: false, error: `Only ${medicine.quantity} item(s) are currently available.` };
    const address = String(deliveryAddress || "").trim();
    const phone = String(deliveryPhone || "").trim();
    if (!["near", "sameCity", "far"].includes(deliveryZone)) return { ok: false, error: "Choose a valid delivery area." };
    if (address.length < 8 || address.length > 300) return { ok: false, error: "Enter a complete delivery address (8–300 characters)." };
    if (phone.replace(/\D/g, "").length < 7 || phone.length > 30) return { ok: false, error: "Enter a valid delivery contact phone number." };
    const reference = nextOrderId();
    const unitPrice = Number(medicine.price);
    const subtotal = roundMoney(unitPrice * count);
    const commissionRate = effectiveRate(pharmacyId);
    const customerCommissionAmount = roundMoney(subtotal * commissionRate / 100);
    const deliveryFee = deliveryFeeForZone(deliveryZone);
    // Backend connection point: create a provider checkout session for this exact total,
    // then set paymentStatus/paymentVerified only from a signed provider notification.
    const order = {
      id: reference, reference, pharmacyId: String(pharmacyId), pharmacyName: pharmacy.name, source: "pharmacy-order", demo: false,
      userId: customer.userId, customerReference: customer.reference,
      deliveryAddress: address, deliveryPhone: phone, deliveryZone, deliveryZoneLabel: deliveryZoneLabel(deliveryZone),
      items: [{ medicineId: medicine.id, name: medicine.name, price: unitPrice, quantity: count }],
      subtotal, customerCommissionAmount, deliveryFee, total: roundMoney(subtotal + customerCommissionAmount + deliveryFee), currency: "JOD", placedAt: new Date().toISOString(), status: "Pending",
      paymentMethod: "online-gateway", paymentStatus: "Pending", paymentVerified: false,
      commissionRate, commissionAmount: 0, commissionStatus: "Not Eligible", cancelReason: "",
      idempotencyKey: idempotencyKey || "", inventoryReserved: true
    };
    // Reserve stock when the customer submits the request so concurrent pending orders cannot oversell it.
    const stockResult = reserveInventory(order, -1);
    if (!stockResult.ok) return stockResult;
    const saved = window.CarePlusData.create("orders", order);
    if (!saved) {
      reserveInventory(order, 1);
      return { ok: false, error: "Could not save the order in this browser." };
    }
    audit(saved.id, "order-created", { pharmacyId: String(pharmacyId), subtotal, customerCommissionAmount, deliveryZone, deliveryFee, total: order.total, inventoryReserved: true }, customer.reference);
    return { ok: true, order: saved };
  }

  function reserveInventory(order, direction) {
    const pharmacy = get(order.pharmacyId);
    if (!pharmacy) return { ok: false, error: "The pharmacy record could not be found." };
    const lines = order.items || [];
    const nextInventory = (pharmacy.inventory || []).map(medicine => {
      const line = lines.find(item => String(item.medicineId) === String(medicine.id));
      if (!line) return medicine;
      return { ...medicine, quantity: Math.max(0, Number(medicine.quantity) + direction * Number(line.quantity)) };
    });
    if (direction < 0) {
      for (const line of lines) {
        const medicine = pharmacy.inventory.find(item => String(item.id) === String(line.medicineId));
        if (!medicine || medicine.available === false || Number(medicine.quantity) < Number(line.quantity) || isExpired(medicine)) return { ok: false, error: `There is not enough ${line.name} in stock to confirm this order.` };
      }
    }
    const updated = updatePharmacy(pharmacy.id, { inventory: nextInventory });
    return updated ? { ok: true, pharmacy } : { ok: false, error: "Could not update pharmacy stock." };
  }
  function setOrderStatus(orderId, status, options = {}) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || order.source !== "pharmacy-order") return { ok: false, error: "Order could not be found." };
    const allowed = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["Preparing for Delivery", "Cancelled"], "Preparing for Delivery": ["Out for Delivery", "Cancelled"] };
    if (!allowed[order.status]?.includes(status)) return { ok: false, error: "This order cannot move to that status." };
    if (status === "Cancelled" && !String(options.reason || "").trim()) return { ok: false, error: "Enter a cancellation reason." };
    if (status === "Delivered" && options.deliveryVerified !== true) return { ok: false, error: "Confirm that the customer received the delivery." };
    if (status === "Delivered" && order.paymentMethod === "cash-on-delivery" && options.paymentCollected !== true) return { ok: false, error: "Confirm delivery and cash collection before completing this order." };
    if (status === "Delivered" && order.paymentStatus === "Refunded") return { ok: false, error: "A refunded order cannot be delivered." };

    let stockResult = null;
    if (status === "Confirmed" && !order.inventoryReserved) {
      stockResult = reserveInventory(order, -1);
      if (!stockResult.ok) return stockResult;
    }
    if (status === "Cancelled" && order.inventoryReserved) {
      stockResult = reserveInventory(order, 1);
      if (!stockResult.ok) return stockResult;
    }
    const changes = { status };
    if (status === "Confirmed") changes.inventoryReserved = true;
    if (status === "Cancelled") {
      changes.inventoryReserved = false;
      changes.cancelReason = String(options.reason).trim();
      changes.commissionStatus = "Not Eligible";
      changes.commissionAmount = 0;
      if (options.paymentFailed === true) changes.paymentStatus = "Failed";
    }
    if (status === "Delivered") {
      changes.inventoryReserved = false;
      changes.deliveredAt = new Date().toISOString();
      changes.saleCompletedAt = changes.deliveredAt;
      if (order.paymentMethod === "cash-on-delivery" && options.paymentCollected === true) {
        changes.paymentStatus = "Paid";
        changes.paymentVerified = true;
        changes.paymentVerifiedAt = new Date().toISOString();
        changes.paymentVerificationMethod = "pharmacist-confirmed-cash-on-delivery-demo";
      }
      if (changes.paymentVerified === true || order.paymentVerified === true && order.paymentStatus === "Paid") {
        changes.commissionAmount = roundMoney(Number(order.customerCommissionAmount ?? ((Number(order.subtotal ?? order.total)) * Number(order.commissionRate) / 100)));
        changes.commissionEligibleSales = Number(order.subtotal ?? order.total);
        changes.commissionStatus = "Pending Verification";
      }
    }
    const updated = window.CarePlusData.update("orders", orderId, changes);
    if (!updated && stockResult?.ok) reserveInventory(order, status === "Confirmed" ? 1 : -1);
    if (!updated) return { ok: false, error: "Could not save the order update." };
    audit(order.id, `order-${status.toLowerCase().replace(/\s+/g, "-")}`, { reason: changes.cancelReason || "", paymentStatus: changes.paymentStatus || order.paymentStatus }, "Pharmacy demo");
    return { ok: true, order: updated };
  }
  function cancelCustomerOrder(orderId, userId, reason = "Cancelled by customer") {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || String(order.userId) !== String(userId) || !["Pending", "Confirmed", "Preparing for Delivery"].includes(order.status)) return { ok: false, error: "This order cannot be cancelled." };
    const result = setOrderStatus(orderId, "Cancelled", { reason });
    if (result.ok) audit(orderId, "customer-cancelled-order", {}, order.customerReference || "Customer");
    return result;
  }
  function confirmCustomerReceipt(orderId, userId) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || order.source !== "pharmacy-order" || String(order.userId) !== String(userId)) return { ok: false, error: "This order does not belong to your account." };
    if (order.status !== "Out for Delivery") return { ok: false, error: "You can confirm receipt after the pharmacy dispatches the order." };
    if (order.paymentStatus === "Refunded" || order.status === "Cancelled") return { ok: false, error: "This order cannot be marked received." };
    const at = new Date().toISOString();
    const changes = { status: "Delivered", deliveredAt: at, saleCompletedAt: at, customerReceivedAt: at, deliveryConfirmationMethod: "customer-account-demo", inventoryReserved: false };
    if (order.paymentStatus === "Paid" && order.paymentVerified === true) {
      changes.commissionAmount = roundMoney(Number(order.customerCommissionAmount ?? (Number(order.subtotal ?? order.total) * Number(order.commissionRate) / 100)));
      changes.commissionEligibleSales = Number(order.subtotal ?? order.total);
      changes.commissionStatus = "Pending Verification";
    }
    const updated = window.CarePlusData.update("orders", orderId, changes);
    if (!updated) return { ok: false, error: "Could not save the receipt confirmation." };
    audit(orderId, "customer-confirmed-receipt", { status: "Delivered", paymentStatus: updated.paymentStatus, paymentVerified: updated.paymentVerified === true }, order.customerReference || "Customer demo");
    return { ok: true, order: updated };
  }

  // Demo only: record a simulated checkout result without recording card data or marking payment Paid.
  function simulateDemoPayment(orderId, userId) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || order.source !== "pharmacy-order" || String(order.userId) !== String(userId) || order.paymentMethod !== "online-gateway") return { ok: false, error: "This order is unavailable for demo checkout." };
    if (order.status === "Cancelled" || order.paymentStatus !== "Pending") return { ok: false, error: "This order is not awaiting payment." };
    if (order.paymentDemoResult === "simulated-success") return { ok: true, order, duplicate: true };
    const updated = window.CarePlusData.update("orders", orderId, { paymentDemoResult: "simulated-success", paymentDemoAt: new Date().toISOString() });
    if (!updated) return { ok: false, error: "The demo payment result could not be saved." };
    audit(orderId, "demo-payment-simulated", { total: order.total, realCharge: false, paymentStatus: "Pending" }, order.customerReference || "Customer");
    return { ok: true, order: updated };
  }

  function settings() {
    const stored = readJson(SETTINGS_KEY, {});
    const defaultRate = Number(stored.defaultRate);
    const careRate = Number(stored.careCommissionRate);
    const legacyDeliveryFee = Number(stored.deliveryFee);
    const configuredFees = stored.deliveryFees || {};
    const deliveryFees = {
      near: Number.isFinite(Number(configuredFees.near)) && Number(configuredFees.near) >= 0 ? roundMoney(configuredFees.near) : DEFAULT_DELIVERY_FEES.near,
      sameCity: Number.isFinite(Number(configuredFees.sameCity)) && Number(configuredFees.sameCity) >= 0 ? roundMoney(configuredFees.sameCity) : Number.isFinite(legacyDeliveryFee) && legacyDeliveryFee >= 0 ? roundMoney(legacyDeliveryFee) : DEFAULT_DELIVERY_FEE,
      far: Number.isFinite(Number(configuredFees.far)) && Number(configuredFees.far) >= 0 ? roundMoney(configuredFees.far) : DEFAULT_DELIVERY_FEES.far
    };
    return { defaultRate: Number.isFinite(defaultRate) && defaultRate >= 0 && defaultRate <= 100 ? defaultRate : 10, careCommissionRate: Number.isFinite(careRate) && careRate >= 0 && careRate <= 100 ? careRate : 10, deliveryFee: deliveryFees.sameCity, deliveryFees, pharmacyRates: stored.pharmacyRates || {} };
  }
  function deliveryFeeForZone(zone = "sameCity") {
    const key = ["near", "sameCity", "far"].includes(zone) ? zone : "sameCity";
    return settings().deliveryFees[key];
  }
  function deliveryZoneLabel(zone = "sameCity") {
    return ({ near: "Nearby area", sameCity: "Same city", far: "Far area" })[zone] || "Same city";
  }
  function saveSettings({ defaultRate, careCommissionRate, pharmacyId, pharmacyRate, deliveryFee, deliveryFees, clearPharmacyOverrides = false }) {
    const current = settings();
    if (defaultRate !== undefined) current.defaultRate = Number(defaultRate);
    if (careCommissionRate !== undefined) current.careCommissionRate = Number(careCommissionRate);
    if (deliveryFee !== undefined) {
      current.deliveryFee = roundMoney(deliveryFee);
      current.deliveryFees.sameCity = current.deliveryFee;
    }
    if (deliveryFees && typeof deliveryFees === "object") {
      for (const zone of ["near", "sameCity", "far"]) {
        if (deliveryFees[zone] !== undefined) current.deliveryFees[zone] = roundMoney(deliveryFees[zone]);
      }
      current.deliveryFee = current.deliveryFees.sameCity;
    }
    if (pharmacyId) {
      if (pharmacyRate === "") delete current.pharmacyRates[String(pharmacyId)];
      else current.pharmacyRates[String(pharmacyId)] = Number(pharmacyRate);
    }
    if (clearPharmacyOverrides) current.pharmacyRates = {};
    if (!Number.isFinite(current.defaultRate) || current.defaultRate < 0 || current.defaultRate > 100 || !Number.isFinite(current.careCommissionRate) || current.careCommissionRate < 0 || current.careCommissionRate > 100 || Object.values(current.deliveryFees).some(fee => !Number.isFinite(Number(fee)) || Number(fee) > 100 || Number(fee) < 0) || Object.values(current.pharmacyRates).some(rate => !Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 100)) return { ok: false, error: "Commission rates must be between 0 and 100%, and each delivery fee between 0 and 100 JOD." };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
      emitSettings();
      audit("", "commission-rates-updated", { defaultRate: current.defaultRate, careCommissionRate: current.careCommissionRate, deliveryFees: { ...current.deliveryFees }, pharmacyRates: { ...current.pharmacyRates } }, "Admin demo");
      return { ok: true, settings: current };
    } catch { return { ok: false, error: "Commission settings could not be saved." }; }
  }
  function reviewCommission(orderId) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || order.source !== "pharmacy-order" || !["Delivered", "Completed"].includes(order.status) || order.paymentStatus !== "Paid" || order.paymentVerified !== true || order.commissionStatus !== "Pending Verification") return { ok: false, error: "Only delivered, payment-verified sales awaiting review can be approved." };
    const updated = window.CarePlusData.update("orders", orderId, { commissionStatus: "Payable", commissionApprovedAt: new Date().toISOString(), commissionApprovedBy: "Admin demo" });
    if (!updated) return { ok: false, error: "Commission could not be approved." };
    audit(orderId, "commission-approved", { rate: order.commissionRate, amount: order.commissionAmount, sourceOrder: order.reference }, "Admin demo");
    return { ok: true, order: updated };
  }
  function markCommissionPaid(orderId, note = "") {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || order.commissionStatus !== "Payable" || order.paymentStatus !== "Paid") return { ok: false, error: "Only approved payable commissions can be marked paid." };
    const updated = window.CarePlusData.update("orders", orderId, { commissionStatus: "Paid", commissionPaidAt: new Date().toISOString(), commissionPaidAmount: Number(order.commissionAmount) || 0, commissionPaymentNote: String(note).trim() });
    if (!updated) return { ok: false, error: "Commission payment could not be saved." };
    audit(orderId, "commission-marked-paid", { amount: order.commissionAmount, note: String(note).trim() }, "Admin demo");
    return { ok: true, order: updated };
  }
  function recordPaymentFailure(orderId, reason) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || !["Pending", "Confirmed", "Preparing for Delivery"].includes(order.status) || order.paymentStatus !== "Pending" || !String(reason || "").trim()) return { ok: false, error: "A pending order and a reason are required to record a failed demo payment." };
    if (order.inventoryReserved) {
      const release = reserveInventory(order, 1);
      if (!release.ok) return release;
    }
    const failureReason = String(reason).trim();
    const updated = window.CarePlusData.update("orders", orderId, {
      status: "Cancelled", inventoryReserved: false, cancelReason: `Payment not collected: ${failureReason}`,
      paymentStatus: "Failed", paymentFailureReason: failureReason, paymentFailedAt: new Date().toISOString(),
      commissionStatus: "Not Eligible", commissionAmount: 0
    });
    if (updated) audit(orderId, "demo-payment-failed-order-cancelled", { reason: failureReason }, "Admin demo");
    return updated ? { ok: true, order: updated } : { ok: false, error: "Payment status could not be saved." };
  }
  function refundOrder(orderId, reason, restock = false) {
    const order = window.CarePlusData.get("orders", orderId);
    if (!order || !["Delivered", "Completed"].includes(order.status) || order.paymentStatus !== "Paid" || order.paymentVerified !== true || !String(reason || "").trim()) return { ok: false, error: "A delivered, payment-verified sale and refund reason are required." };
    if (restock) {
      const pharmacy = get(order.pharmacyId);
      const next = (pharmacy?.inventory || []).map(medicine => {
        const line = (order.items || []).find(item => String(item.medicineId) === String(medicine.id));
        return line ? { ...medicine, quantity: Number(medicine.quantity) + Number(line.quantity) } : medicine;
      });
      if (!pharmacy || !updatePharmacy(order.pharmacyId, { inventory: next })) return { ok: false, error: "Could not restore refunded stock." };
    }
    const updated = window.CarePlusData.update("orders", orderId, {
      paymentStatus: "Refunded", refundedAt: new Date().toISOString(), refundReason: String(reason).trim(), refundRestocked: Boolean(restock),
      commissionStatus: "Reversed", commissionWasPaid: order.commissionStatus === "Paid", commissionReversedAmount: Number(order.commissionAmount) || 0,
      commissionAdjustment: order.commissionStatus === "Paid" ? -(Number(order.commissionAmount) || 0) : 0, commissionReversedAt: new Date().toISOString()
    });
    if (!updated) {
      if (restock) {
        const pharmacy = get(order.pharmacyId);
        const rollback = (pharmacy?.inventory || []).map(medicine => {
          const line = (order.items || []).find(item => String(item.medicineId) === String(medicine.id));
          return line ? { ...medicine, quantity: Math.max(0, Number(medicine.quantity) - Number(line.quantity)) } : medicine;
        });
        if (pharmacy) updatePharmacy(order.pharmacyId, { inventory: rollback });
      }
      return { ok: false, error: "Refund record could not be saved." };
    }
    audit(orderId, "order-refunded-commission-reversed", { amount: order.total, commissionReversed: Number(order.commissionAmount) || 0, restock: Boolean(restock), reason: String(reason).trim() }, "Admin demo");
    return { ok: true, order: updated };
  }
  function subscribe(callback) {
    const unsubscribe = window.CarePlusData.subscribe(callback);
    const handler = () => callback();
    const storageHandler = event => { if ([SETTINGS_KEY, AUDIT_KEY].includes(event.key)) callback(); };
    window.addEventListener("careplus:commission", handler);
    window.addEventListener("storage", storageHandler);
    return () => { unsubscribe(); window.removeEventListener("careplus:commission", handler); window.removeEventListener("storage", storageHandler); };
  }

  window.CarePlusPharmacy = {
    DEFAULT_PHARMACY_ID, DEFAULT_DELIVERY_FEE, sampleInventory, get, isActivePharmacy, bootstrap, updatePharmacy, createOrder, setOrderStatus, cancelCustomerOrder,
    currentCustomer, listOrders, nextOrderId, effectiveRate, isExpired, settings, saveSettings, deliveryFeeForZone, deliveryZoneLabel, auditEntries, audit, simulateDemoPayment,
    confirmCustomerReceipt,
    reviewCommission, markCommissionPaid, recordPaymentFailure, refundOrder, subscribe
  };
  bootstrap();
})();
