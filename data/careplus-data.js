/*
 * CarePlus shared browser demo repository. Data persists in localStorage and is
 * shared by same-origin tabs in this browser only; it is not a backend/database.
 */
(() => {
  // LocalStorage event adapter; replace notifyCreated/notifyUpdated with API writes and a SignalR subscription when the ASP.NET Core backend is added.
  const KEY = "careplusMockDataV1";
  const collections = ["users", "appointments", "products", "pharmacies", "careRequests", "orders", "notifications", "professionalApplications", "licenseRenewals"];
  const appRoot = new URL("../", document.currentScript.src);
  const id = () => globalThis.crypto?.randomUUID?.() || `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.fromEntries(collections.map(name => [name, Array.isArray(data[name]) ? data[name] : []]));
    } catch { return Object.fromEntries(collections.map(name => [name, []])); }
  }
  let data = read();
  let hasSavedData = false;
  try { hasSavedData = localStorage.getItem(KEY) !== null; } catch {}
  if (!hasSavedData) {
    const productRows = [
      ["Digital Blood Pressure Monitor","devices",34.9,true],["Blood Glucose Meter","devices",18.5,true],["Fingertip Pulse Oximeter","devices",15.75,true],["Digital Thermometer","devices",6.9,true],["Compressor Nebulizer","devices",29,true],["Oxygen Concentrator","devices",685,true],["Portable Oxygen Equipment","devices",920,false],["Digital Weighing Scale","devices",19.9,true],
      ["Blood Pressure Monitor Cuff","accessories",11.5,true],["Glucose Test Strips · 50 pack","accessories",14.25,true],["Safety Lancets · 100 pack","accessories",8.5,true],["Thermometer Probe Covers · 20 pack","accessories",3.75,true],["Nebulizer Mask & Tubing Set","accessories",7.9,true],
      ["Classic White Lab Coat","clothing",27,true],["Unisex Medical Scrubs","clothing",32,true],["Nursing Uniform Set","clothing",29.5,true],["Professional Medical Shoes","clothing",38,false],["Disposable Surgical Caps · 10 pack","clothing",4.5,true],
      ["Nitrile Medical Gloves · 100 pack","consumables",8.75,true],["Latex Medical Gloves · 100 pack","consumables",7.5,true],["Surgical Masks · 50 pack","consumables",5.9,true],["Disposable Isolation Gown","consumables",3.25,true],["Sterile Gauze Pads · 25 pack","consumables",4.8,true],["Elastic Bandage Roll","consumables",2.25,true],["Disposable Syringes · 10 pack","consumables",3.5,true],["Medical Paper Tape · 3 rolls","consumables",2.9,true],["Wound Dressing Set","consumables",9.25,true],
      ["Dual-Head Stethoscope","professional",24.5,true],["Portable Otoscope Set","professional",42,true],["LED Medical Examination Light","professional",78,true],["Diagnostic Set","professional",119,true],["Medical Instrument Kit","professional",36.5,true]
    ];
    data.products = productRows.map(([name, category, price, inStock], index) => ({ id: index + 1, name, category, description: `${name} for home healthcare and medical use.`, price, inStock, quantity: inStock ? 20 : 0, stock: inStock ? 20 : 0, status: inStock ? "Available" : "Unavailable", image: "", rating: null, reviews: null }));
    const pharmacyRows = [
      ["Al Shifa Pharmacy","Amman","0.8 km away","King Abdullah St., Amman","+962 6 590 1122","Open until 11:00 PM",true,["panadol","paracetamol","ibuprofen"]],
      ["CarePoint Pharmacy","Amman","1.4 km away","Prince Hasan St., Amman","+962 6 591 2045","Open until 10:30 PM",true,["panadol","vitamin c","ibuprofen"]],
      ["LifeCare Pharmacy","Amman","2.1 km away","New Amman, Amman","+962 6 592 7781","Opens tomorrow at 8:00 AM",false,["panadol","vitamin d","paracetamol"]],
      ["Al Hayat Pharmacy","Zarqa","0.6 km away","King Hussein St., Zarqa","+962 5 390 1456","Open until 10:00 PM",true,["panadol","paracetamol","vitamin c"]],
      ["Al Rahma Pharmacy","Zarqa","1.2 km away","Prince Mohammad St., Zarqa","+962 5 391 2288","Open until 11:00 PM",true,["ibuprofen","vitamin d"]],
      ["Irbid Care Pharmacy","Irbid","0.9 km away","University St., Irbid","+962 2 710 3344","Open until 10:00 PM",true,["panadol","vitamin c"]],
      ["Salt Central Pharmacy","Salt","0.7 km away","Main St., Salt","+962 5 355 4455","Open until 9:30 PM",true,["panadol","paracetamol"]],
      ["Aqaba Marina Pharmacy","Aqaba","1.1 km away","Al-Hammamat St., Aqaba","+962 3 201 9988","Opens tomorrow at 8:00 AM",false,["panadol","ibuprofen"]]
    ];
    data.pharmacies = pharmacyRows.map(([name, area, distance, address, phone, hours, open, medicines], index) => ({ id: `pharmacy-${index + 1}`, name, area, distance, address, phone, hours, open, medicines, status: "Active" }));
  }
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); window.dispatchEvent(new CustomEvent("careplus:data", { detail: { data } })); return true; }
    catch (error) { console.error("CarePlus demo data could not be saved", error); return false; }
  };
  const safeName = value => String(value || "").trim() || "Customer";
  const roleName = value => String(value || "").toLowerCase();
  function portalUrl(path, params = {}) {
    const url = new URL(path, appRoot);
    Object.entries(params).forEach(([key, value]) => { if (value != null && value !== "") url.searchParams.set(key, String(value)); });
    return url.href;
  }
  function customerAccount(record) {
    const relatedUserIds = [record.bookingUserId, record.userId].filter(Boolean).map(String);
    return data.users.find(user => relatedUserIds.includes(String(user.id)))
      || data.users.find(user => record.email && String(user.email || "").toLowerCase() === String(record.email).toLowerCase())
      || data.users.find(user => record.phone && String(user.phone || "") === String(record.phone))
      || null;
  }
  function addNotification(recipientRole, recipientId, category, eventKey, title, message, recordType, recordId, link) {
    if (!recipientId) return;
    const duplicate = data.notifications.some(item => item.eventKey === eventKey && item.recipientRole === recipientRole && String(item.recipientId) === String(recipientId));
    if (duplicate) return;
    data.notifications.push({
      id: id(), eventKey, recipientRole, recipientId: String(recipientId), category, title, message,
      createdAt: new Date().toISOString(), readAt: "", deletedAt: "", recordType, recordId: String(recordId), link,
      actionLabel: recordType === "appointment" ? recipientRole === "doctor" ? "View Booking" : "View Appointment"
        : recordType === "order" || recordType === "storeOrder" ? "View Order"
          : recordType === "professionalApplication" ? recipientRole === "admin" ? "Review application" : "View status" : "View Request"
    });
  }
  function nurseRecipients(request) {
    const assigned = request.assignedNurseId || request.nurseId;
    if (assigned) return [String(assigned)];
    return data.users.filter(user => roleName(user.role) === "nurse" && roleName(user.accountStatus || user.status) === "active" && user.archived !== true && !user.archivedAt)
      .map(user => String(user.nurseId || user.id));
  }
  function notifyCreated(collection, record) {
    const eventTime = record.createdAt || new Date().toISOString();
    const baseKey = `${collection}:${record.id}:created:${eventTime}`;
    if (collection === "professionalApplications" && ["doctor", "nurse", "pharmacy"].includes(record.role) && record.status === "Pending Verification") {
      const roleName = record.role;
      const reviewPage = record.role === "nurse" ? "Admin/Nurses/index.html" : record.role === "pharmacy" ? "Admin/Pharmacies/index.html" : "Admin/Doctors/index.html";
      addNotification("admin", "*", "professional", `professionalApplications:${record.id}:submitted:${eventTime}`, `New ${roleName} application`,
        `${safeName(record.pharmacyName || record.name)} submitted a ${roleName} verification request.`, "professionalApplication", record.id,
        portalUrl(reviewPage, { applicationId: record.id }));
      return;
    }
    if (collection === "appointments" && record.source === "user-booking") {
      const doctor = String(record.doctor || "your practice");
      const customer = safeName(record.patient || customerAccount(record)?.name);
      addNotification("doctor", record.doctorId, "appointment", baseKey, "New appointment request",
        `${customer} · ${record.id} · ${record.specialty || "Appointment"} · ${record.date || "Date pending"} ${record.time || ""}`,
        "appointment", record.id, portalUrl("Doctor/index.html", { page: "appointments", appointmentId: record.id }));
      return;
    }
    if (collection === "orders" && record.source === "pharmacy-order") {
      const item = record.items?.[0] || {};
      addNotification("pharmacy", record.pharmacyId, "pharmacy", baseKey, "New medicine order",
        `${safeName(record.customerName || customerAccount(record)?.name)} · ${record.reference || record.id} · ${item.name || "Medicine"} × ${Number(item.quantity) || 1} · ${new Date(record.placedAt || eventTime).toLocaleString()}`,
        "order", record.id, portalUrl("Pharmacy/dashboard.html", { page: "orders", orderId: record.id }));
      return;
    }
    if (collection === "careRequests" && record.source === "user-request") {
      const customer = safeName(record.client || customerAccount(record)?.name);
      nurseRecipients(record).filter(nurseId => !window.CarePlusLicenses || window.CarePlusLicenses.canProvide('nurse', nurseId)).forEach(nurseId => addNotification("nurse", nurseId, "care", baseKey, "New elderly-care request",
        `${customer} · ${record.id} · ${record.service || "Care request"} · ${record.date || "Date pending"} ${record.time || ""}`,
        "careRequest", record.id, portalUrl("Nurse/index.html", { page: "requests", requestId: record.id })));
      return;
    }
    if (collection === "orders" && record.source === "store-checkout") {
      addNotification("customer", customerAccount(record)?.id || record.userId, "store", baseKey, "Store order placed",
        `Order ${record.reference || record.id} was received and is being reviewed.`,
        "storeOrder", record.id, portalUrl("Profile/index.html", { tab: "orders", recordId: record.id }));
    }
  }
  function notifyUpdated(collection, before, after) {
    if (!before || !after) return;
    const at = after.updatedAt || new Date().toISOString();
    if (collection === "professionalApplications" && ["doctor", "nurse", "pharmacy"].includes(after.role) && after.status === "Pending Verification"
      && (before.status !== "Pending Verification" || before.submittedAt !== after.submittedAt)) {
      const roleName = after.role;
      const reviewPage = after.role === "nurse" ? "Admin/Nurses/index.html" : after.role === "pharmacy" ? "Admin/Pharmacies/index.html" : "Admin/Doctors/index.html";
      addNotification("admin", "*", "professional", `professionalApplications:${after.id}:submitted:${at}`, `New ${roleName} application`,
        `${safeName(after.pharmacyName || after.name)} submitted a ${roleName} verification request.`, "professionalApplication", after.id,
        portalUrl(reviewPage, { applicationId: after.id }));
      return;
    }
    if (collection === "professionalApplications" && ["doctor", "nurse", "pharmacy"].includes(after.role)
      && ["Approved", "Rejected", "Additional Documents Required"].includes(after.status)
      && String(before.status || "") !== String(after.status || "")) {
      const applicant = data.users.find(user => String(user.id) === String(after.userId));
      const approved = after.status === "Approved";
      const requestedDocuments = after.status === "Additional Documents Required";
      const roleName = after.role;
      const recipientRole = approved ? roleName : "customer";
      const recipientId = approved ? String(applicant?.[roleName + "Id"] || applicant?.id || after.userId) : String(after.userId || "");
      const title = approved ? `${roleName[0].toUpperCase() + roleName.slice(1)} application approved` : requestedDocuments ? "Additional documents required" : `${roleName[0].toUpperCase() + roleName.slice(1)} application rejected`;
      const message = approved ? "Your professional account is approved. You can now access the " + roleName + " dashboard."
        : `${requestedDocuments ? "Please provide the requested documents" : "Your application was rejected"}.${after.reviewReason ? ` Reason: ${after.reviewReason}` : ""}`;
      const destination = roleName === "doctor" ? "Doctor/index.html" : roleName === "nurse" ? "Nurse/index.html" : "Pharmacy/dashboard.html";
      const statusLink = approved ? destination : roleName === "doctor" ? "DoctorVerification/index.html" : roleName === "nurse" ? "NurseVerification/index.html" : "PharmacyVerification/index.html";
      addNotification(recipientRole, recipientId, "professional", `professionalApplications:${after.id}:status:${String(after.status).toLowerCase()}:${at}`,
        title, message, "professionalApplication", after.id,
        portalUrl(statusLink));
      return;
    }
    const actor = roleName(after.lastActionByRole || after.statusHistory?.at?.(-1)?.actor || "");
    const statusChanged = String(before.status || "") !== String(after.status || "");
    const scheduleChanged = ["date", "time", "service", "schedule"].some(key => before[key] !== after[key]);
    const assignmentChanged = String(before.assignedNurseId || before.nurseId || "") !== String(after.assignedNurseId || after.nurseId || "");
    const eventKind = statusChanged ? `status-${String(after.status || "updated").toLowerCase()}` : scheduleChanged ? "details-updated" : assignmentChanged ? "assigned" : "";
    if (!eventKind) return;
    const baseKey = `${collection}:${after.id}:${eventKind}:${at}`;
    const customer = customerAccount(after);
    const customerId = customer?.id || after.bookingUserId || after.userId;
    if (collection === "appointments") {
      const customerName = safeName(after.patient || customer?.name);
      const appointmentText = `${after.id} · ${after.specialty || "Appointment"} · ${after.date || "Date pending"} ${after.time || ""}`;
      const depositReady = ["Demo Simulated", "Paid"].includes(after.depositPaymentStatus)
        || String(after.paymentStatus || "").toLowerCase().startsWith("demo")
        || String(after.paymentStatus || "").toLowerCase() === "paid"
        || Number(after.depositAmount) > 0 && Number(after.depositPaid) >= Number(after.depositAmount);
      const depositJustPaid = statusChanged && String(after.status).toLowerCase() === "requested" && depositReady;
      if ((statusChanged || scheduleChanged) && customerId) {
        const rejected = String(after.status).toLowerCase() === "rejected";
        const rejectionReason = rejected && after.rejectionReason ? ` Rejection reason: ${after.rejectionReason}` : "";
        const cancelled = String(after.status).toLowerCase() === "cancelled";
        const cancellationReason = cancelled && after.cancelReason ? ` Cancellation reason: ${after.cancelReason}` : "";
        addNotification("customer", customerId, "appointment", baseKey, rejected ? "Appointment request rejected" : cancelled ? "Appointment cancelled" : "Appointment updated",
          `Your appointment with ${after.doctor || "your doctor"} is now ${after.status || "updated"}. ${appointmentText}${rejectionReason}${cancellationReason}`,
          "appointment", after.id, portalUrl("Profile/index.html", { tab: "appointments", recordId: after.id }));
      }
      if ((statusChanged || scheduleChanged) && actor !== "doctor") {
        const title = depositJustPaid ? "Deposit received · booking ready" : String(after.status).toLowerCase() === "cancelled" ? "Appointment cancelled" : statusChanged ? `Appointment status: ${after.status || "updated"}` : "Appointment changed";
        const cancellationReason = String(after.status).toLowerCase() === "cancelled" && after.cancelReason ? ` · Patient reason: ${after.cancelReason}` : "";
        const statusText = statusChanged && !depositJustPaid ? ` · Status: ${after.status || "updated"}` : "";
        addNotification("doctor", after.doctorId, "appointment", baseKey, title,
          `${customerName} · ${appointmentText}${statusText}${cancellationReason}`,
          "appointment", after.id, portalUrl("Doctor/index.html", { page: "appointments", appointmentId: after.id }));
      }
      return;
    }
    if (collection === "orders" && after.source === "pharmacy-order" && statusChanged) {
      const lastEvent = after.statusHistory?.at?.(-1) || {};
      const status = String(after.status || "updated");
      const reason = after.rejectionReason || after.cancelReason || lastEvent.reason || "";
      const message = `${after.reference || after.id} · ${(after.items || []).map(item => `${item.name} × ${Number(item.quantity) || 1}`).join(", ") || "Medicine order"}${reason ? ` · Reason: ${reason}` : ""}`;
      const customerDidIt = actor === "customer" || lastEvent.actor === "Customer" || Boolean(after.customerCancelledAt);
      if (customerDidIt) {
        addNotification("pharmacy", after.pharmacyId, "pharmacy", baseKey, "Customer updated an order", `${safeName(after.customerName || customer?.name)} · ${status} · ${message}`,
          "order", after.id, portalUrl("Pharmacy/dashboard.html", { page: "orders", orderId: after.id }));
      } else if (customerId) {
        addNotification("customer", customerId, "pharmacy", baseKey, `Order ${status.toLowerCase()}`, message,
          "order", after.id, portalUrl("Profile/index.html", { tab: "orders" }));
      }
      return;
    }
    if (collection === "careRequests") {
      const customerName = safeName(after.client || customer?.name);
      const serviceText = `${after.id} · ${after.service || "Care request"} · ${after.date || "Date pending"} ${after.time || ""}`;
      if ((statusChanged || scheduleChanged) && ["nurse", "admin", "administrator"].includes(actor) && customerId) {
        const reason = after.rejectionReason ? ` · Reason: ${after.rejectionReason}` : "";
        addNotification("customer", customerId, "care", baseKey, `Care request ${String(after.status || "updated").toLowerCase()}`,
          `${serviceText}${reason}`, "careRequest", after.id, portalUrl("Profile/index.html", { tab: "care", recordId: after.id }));
      } else if ((statusChanged || scheduleChanged) && !assignmentChanged && ["customer", ""].includes(actor)) {
        nurseRecipients(after).forEach(nurseId => addNotification("nurse", nurseId, "care", baseKey,
          String(after.status).toLowerCase() === "cancelled" ? "Care request cancelled" : "Care request updated",
          `${customerName} · ${serviceText}`, "careRequest", after.id,
          portalUrl("Nurse/index.html", { page: "requests", requestId: after.id })));
      }
      const assignedNurseId = after.assignedNurseId || after.nurseId;
      if (assignedNurseId && assignmentChanged && actor !== "nurse") {
        addNotification("nurse", assignedNurseId, "care", `${baseKey}:assigned`, "Care request assigned to you", `${customerName} · ${serviceText}`,
          "careRequest", after.id, portalUrl("Nurse/index.html", { page: "requests", requestId: after.id }));
      }
      return;
    }
    if (collection === "orders" && after.source === "store-checkout" && statusChanged && customerId) {
      const status = String(after.status || "updated");
      const reason = after.rejectionReason || after.cancelReason;
      addNotification("customer", customerId, "store", baseKey, `Store order ${status.toLowerCase()}`,
        `Order ${after.reference || after.id} is now ${status}.${reason ? ` Reason: ${reason}` : ""}`,
        "storeOrder", after.id, portalUrl("Profile/index.html", { tab: "orders", recordId: after.id }));
    }
  }
  function seedDemoCollection(name, rows, marker) {
    let seeded = false;
    try { seeded = localStorage.getItem(marker) === "1"; } catch {}
    if (seeded) return;
    if (!data[name].length) {
      data[name] = rows;
      if (!write()) return;
    }
    try { localStorage.setItem(marker, "1"); } catch {}
  }
  seedDemoCollection("appointments", [
      { id: "demo-appt-001", userId: "demo-user-001", patient: "Maya Haddad", doctor: "Dr. Lina Haddad", specialty: "Family Medicine", date: "2026-10-14", time: "10:30", area: "CarePlus Medical Center, Amman", status: "Confirmed" },
      { id: "demo-appt-002", userId: "demo-user-002", patient: "Omar Khalil", doctor: "Dr. Omar Khalil", specialty: "Cardiology", date: "2026-10-15", time: "12:00", area: "Jordan Heart Clinic, Amman", status: "Requested" },
      { id: "demo-appt-003", userId: "demo-user-003", patient: "Lina Nasser", doctor: "Dr. Sara Nasser", specialty: "Dermatology", date: "2026-10-16", time: "09:15", area: "CarePlus Medical Center, Amman", status: "Confirmed" },
      { id: "demo-appt-004", userId: "demo-user-004", patient: "Yazan Saleh", doctor: "Dr. Ahmad Saleh", specialty: "Pediatrics", date: "2026-10-17", time: "11:00", area: "Al Hayat Clinic, Zarqa", status: "Requested" },
      { id: "demo-appt-005", userId: "demo-user-001", patient: "Maya Haddad", doctor: "Dr. Maya Rami", specialty: "Family Medicine", date: "2026-10-10", time: "14:00", area: "CarePlus Medical Center, Amman", status: "Completed" }
    ], "careplusAppointmentsSeededV1");
  seedDemoCollection("users", [
      { id: "demo-user-001", name: "Maya Haddad", email: "maya.haddad@example.test", phone: "+962 7 9000 1001", dateOfBirth: "1992-04-18", gender: "Female", address: "Al Rabieh, Amman", city: "Amman", emergencyContact: "Rana Haddad · +962 7 9000 1006", role: "Customer", status: "Active", createdAt: "2024-03-12T09:00:00.000Z", source: "demo-seed" },
      { id: "demo-user-002", name: "Omar Khalil", email: "omar.khalil@example.test", phone: "+962 7 9000 1002", role: "Customer", status: "Active", source: "demo-seed" },
      { id: "demo-user-003", name: "Lina Nasser", email: "lina.nasser@example.test", phone: "+962 7 9000 1003", role: "Customer", status: "Inactive", source: "demo-seed" },
      { id: "demo-user-004", name: "Yazan Saleh", email: "yazan.saleh@example.test", phone: "+962 7 9000 1004", role: "Customer", status: "Active", source: "demo-seed" },
      { id: "demo-user-005", name: "Sara Rami", email: "sara.rami@example.test", phone: "+962 7 9000 1005", role: "Customer", status: "Active", source: "demo-seed" }
    ], "careplusUsersSeededV1");
  seedDemoCollection("pharmacies", [
    { id: "pharmacy-1", name: "Al Shifa Pharmacy", area: "Amman", distance: "0.8 km away", address: "King Abdullah St., Amman", phone: "+962 6 590 1122", hours: "Open until 11:00 PM", open: true, medicines: ["panadol", "paracetamol", "ibuprofen"], status: "Active" },
    { id: "pharmacy-2", name: "CarePoint Pharmacy", area: "Amman", distance: "1.4 km away", address: "Prince Hasan St., Amman", phone: "+962 6 591 2045", hours: "Open until 10:30 PM", open: true, medicines: ["panadol", "vitamin c", "ibuprofen"], status: "Active" },
    { id: "pharmacy-3", name: "Al Hayat Pharmacy", area: "Zarqa", distance: "0.6 km away", address: "King Hussein St., Zarqa", phone: "+962 5 390 1456", hours: "Open until 10:00 PM", open: true, medicines: ["panadol", "paracetamol", "vitamin c"], status: "Active" }
  ], "careplusPharmaciesSeededV1");
  const carePointRestoreMarker = "careplusCarePointRestoreV1";
  try {
    if (localStorage.getItem(carePointRestoreMarker) !== "1") {
      const carePoint = data.pharmacies.find(pharmacy => String(pharmacy.name || "").trim().toLowerCase() === "carepoint pharmacy");
      if (carePoint) {
        const needsRestore = carePoint.status !== "Active" || carePoint.deleted === true;
        carePoint.status = "Active";
        delete carePoint.deleted;
        if (needsRestore && !write()) throw new Error("Could not save pharmacy restoration");
      } else {
        data.pharmacies.push({ id: "pharmacy-2", name: "CarePoint Pharmacy", area: "Amman", distance: "1.4 km away", address: "Prince Hasan St., Amman", phone: "+962 6 591 2045", hours: "Open until 10:30 PM", open: true, medicines: ["panadol", "vitamin c", "ibuprofen"], status: "Active" });
        if (!write()) throw new Error("Could not save pharmacy restoration");
      }
      localStorage.setItem(carePointRestoreMarker, "1");
    }
  } catch (error) { console.error("CarePoint Pharmacy restoration could not be saved", error); }
  const alShifaRestoreMarker = "careplusLinkedPharmacyRestoreV1";
  try {
    if (localStorage.getItem(alShifaRestoreMarker) !== "1") {
      const pharmacyAccount = data.users.find(user => String(user.role || "").toLowerCase() === "pharmacy" && user.pharmacyId && user.email);
      const linkedPharmacyId = String(pharmacyAccount?.pharmacyId || "pharmacy-1");
      const alShifa = data.pharmacies.find(pharmacy => String(pharmacy.id) === linkedPharmacyId);
      if (alShifa) {
        alShifa.status = "Active";
        delete alShifa.deleted;
        delete alShifa.archived;
        delete alShifa.archivedAt;
        if (pharmacyAccount?.email) alShifa.email = pharmacyAccount.email;
      } else {
        data.pharmacies.push({ id: linkedPharmacyId, name: pharmacyAccount?.name || "Al Shifa Pharmacy", email: pharmacyAccount?.email || "pharmacy@careplus.test", area: "Amman", distance: "0.8 km away", address: "King Abdullah St., Amman", phone: "+962 6 590 1122", hours: "Open until 11:00 PM", open: true, medicines: ["panadol", "paracetamol", "ibuprofen"], status: "Active" });
      }
      if (!write()) throw new Error("Could not save pharmacy restoration");
      localStorage.setItem(alShifaRestoreMarker, "1");
    }
  } catch (error) { console.error("Al Shifa Pharmacy restoration could not be saved", error); }
  seedDemoCollection("careRequests", [
    { id: "demo-care-request-001", userId: "demo-user-001", client: "Maya Haddad", elderlyName: "Nadia Haddad", email: "maya.haddad@example.test", phone: "+962 7 9000 1001", service: "Home care", date: "2026-10-14", createdAt: "2026-10-01T09:00:00.000Z", time: "09:00", duration: 3, schedule: "Recurring daily", city: "Amman", area: "Al Rabieh", address: "Al Rabieh, Amman", emergencyName: "Rana Haddad", emergencyPhone: "+962 7 9000 1006", status: "Accepted", notes: "Companionship and assistance with daily activities." },
    { id: "demo-care-request-002", userId: "demo-user-002", client: "Omar Khalil", elderlyName: "Salma Khalil", email: "omar.khalil@example.test", phone: "+962 7 9000 1002", service: "Hospital companion", date: "2026-10-16", createdAt: "2026-10-03T09:00:00.000Z", time: "10:00", duration: 4, schedule: "One-time visit", city: "Amman", area: "Shmeisani", address: "Shmeisani, Amman", emergencyName: "Rana Khalil", emergencyPhone: "+962 7 9000 1012", status: "Reviewing", notes: "Companion for a scheduled hospital visit." },
    { id: "demo-care-request-003", userId: "demo-user-003", client: "Lina Nasser", elderlyName: "Huda Nasser", email: "lina.nasser@example.test", phone: "+962 7 9000 1003", service: "Home care", date: "2026-10-19", createdAt: "2026-10-05T09:00:00.000Z", time: "11:00", duration: 2, schedule: "Recurring weekly", city: "Zarqa", area: "New Zarqa", address: "New Zarqa", emergencyName: "Rami Nasser", emergencyPhone: "+962 7 9000 1013", status: "Contacted", notes: "Follow-up completed; confirming preferred schedule." }
  ], "careplusCareRequestsSeededV1");
  seedDemoCollection("orders", [
    { id: "demo-order-001", reference: "CP-DEMO-1001", userId: "demo-user-001", customerName: "Maya Haddad", customer: { fullName: "Maya Haddad", email: "maya.haddad@example.test", phone: "+962 7 9000 1001", city: "Amman", area: "Al Rabieh", address: "Al Rabieh, Amman" }, items: [{ product: { id: 1, name: "Digital Blood Pressure Monitor", category: "devices", price: 34.9, image: "" }, quantity: 1 }], deliveryMethod: "standard", payment: "Cash on Delivery", subtotal: 34.9, deliveryFee: 2, total: 36.9, placedAt: "2026-10-08T10:30:00.000Z", status: "Processing", source: "demo-seed" },
    { id: "demo-order-002", reference: "CP-DEMO-1002", userId: "demo-user-001", customerName: "Maya Haddad", customer: { fullName: "Maya Haddad", email: "maya.haddad@example.test", phone: "+962 7 9000 1001", city: "Amman", area: "Al Rabieh", address: "Al Rabieh, Amman" }, items: [{ product: { id: 2, name: "Blood Glucose Meter", category: "devices", price: 18.5, image: "" }, quantity: 2 }], deliveryMethod: "express", payment: "Cash on Delivery", subtotal: 37, deliveryFee: 4, total: 41, placedAt: "2026-09-20T12:00:00.000Z", status: "Delivered", source: "demo-seed" }
  ], "careplusOrdersSeededV1");
  let demoDataUpdated = false;
  const fillMissing = (record, values) => Object.entries(values).forEach(([key, value]) => {
    if (record[key] === undefined || record[key] === null || record[key] === "") { record[key] = value; demoDataUpdated = true; }
  });
  const demoUserDetails = {
    "demo-user-001": { dateOfBirth: "1992-04-18", gender: "Female", address: "Al Rabieh, Amman", city: "Amman", emergencyContact: "Rana Haddad · +962 7 9000 1006", createdAt: "2024-03-12T09:00:00.000Z" },
    "demo-user-002": { dateOfBirth: "1988-09-02", gender: "Male", address: "Shmeisani, Amman", city: "Amman", emergencyContact: "Salma Khalil · +962 7 9000 1012", createdAt: "2024-05-06T09:00:00.000Z" },
    "demo-user-003": { dateOfBirth: "1995-01-27", gender: "Female", address: "New Zarqa, Zarqa", city: "Zarqa", emergencyContact: "Huda Nasser · +962 7 9000 1013", createdAt: "2024-06-18T09:00:00.000Z" },
    "demo-user-004": { dateOfBirth: "1990-11-09", gender: "Male", address: "Irbid City, Irbid", city: "Irbid", emergencyContact: "Demo Contact · +962 7 9000 1014", createdAt: "2024-08-22T09:00:00.000Z" },
    "demo-user-005": { dateOfBirth: "1993-07-14", gender: "Female", address: "Aqaba City, Aqaba", city: "Aqaba", emergencyContact: "Demo Contact · +962 7 9000 1015", createdAt: "2024-10-11T09:00:00.000Z" }
  };
  data.users.forEach(user => { if (demoUserDetails[user.id]) fillMissing(user, demoUserDetails[user.id]); });
  const sampleAppointments = {
    "demo-appt-001": { userId: "demo-user-001", time: "10:30", area: "CarePlus Medical Center, Amman", source: "demo-seed" },
    "demo-appt-002": { userId: "demo-user-002", time: "12:00", area: "Jordan Heart Clinic, Amman", source: "demo-seed" },
    "demo-appt-003": { userId: "demo-user-003", time: "09:15", area: "CarePlus Medical Center, Amman", source: "demo-seed" },
    "demo-appt-004": { userId: "demo-user-004", time: "11:00", area: "Al Hayat Clinic, Zarqa", source: "demo-seed" },
    "demo-appt-005": { userId: "demo-user-001", time: "14:00", area: "CarePlus Medical Center, Amman", source: "demo-seed" }
  };
  data.appointments.forEach(appointment => { if (sampleAppointments[appointment.id]) fillMissing(appointment, sampleAppointments[appointment.id]); });
  const sampleCareRequests = {
    "demo-care-request-001": { userId: "demo-user-001", elderlyName: "Nadia Haddad", email: "maya.haddad@example.test", time: "09:00", duration: 3, schedule: "Recurring daily", city: "Amman", area: "Al Rabieh", address: "Al Rabieh, Amman", emergencyName: "Rana Haddad", emergencyPhone: "+962 7 9000 1006", createdAt: "2026-10-01T09:00:00.000Z" },
    "demo-care-request-002": { userId: "demo-user-002", elderlyName: "Salma Khalil", email: "omar.khalil@example.test", time: "10:00", duration: 4, schedule: "One-time visit", city: "Amman", area: "Shmeisani", address: "Shmeisani, Amman", emergencyName: "Rana Khalil", emergencyPhone: "+962 7 9000 1012", createdAt: "2026-10-03T09:00:00.000Z" },
    "demo-care-request-003": { userId: "demo-user-003", elderlyName: "Huda Nasser", email: "lina.nasser@example.test", time: "11:00", duration: 2, schedule: "Recurring weekly", city: "Zarqa", area: "New Zarqa", address: "New Zarqa", emergencyName: "Rami Nasser", emergencyPhone: "+962 7 9000 1013", createdAt: "2026-10-05T09:00:00.000Z" }
  };
  data.careRequests.forEach(request => { if (sampleCareRequests[request.id]) fillMissing(request, sampleCareRequests[request.id]); });
  if (demoDataUpdated) write();
  // One-time cleanup requested for Lina's existing bookings; future bookings are retained.
  try {
    const marker = 'careplusLinaBookingsCleared20261110V1';
    if (localStorage.getItem(marker) !== '1') {
      const linaIds = new Set(['nurse-demo-lina']);
      data.users.filter(user => roleName(user.role) === 'nurse'
        && (user.nurseId === 'nurse-demo-lina' || String(user.email || '').toLowerCase() === 'nurse@careplus.test'))
        .forEach(user => [user.id, user.nurseId].filter(Boolean).forEach(value => linaIds.add(String(value))));
      const removed = data.careRequests.filter(request => linaIds.has(String(request.assignedNurseId || request.nurseId || '')));
      const removedIds = new Set(removed.map(request => String(request.id)));
      const notifications = data.notifications.filter(item => ['careRequest', 'careRequests'].includes(item.recordType) && removedIds.has(String(item.recordId)));
      if (removed.length) {
        localStorage.setItem(marker + ':backup', JSON.stringify({ careRequests: removed, notifications }));
        const previousRequests = data.careRequests;
        const previousNotifications = data.notifications;
        data.careRequests = data.careRequests.filter(request => !removedIds.has(String(request.id)));
        data.notifications = data.notifications.filter(item => !notifications.includes(item));
        if (!write()) {
          data.careRequests = previousRequests;
          data.notifications = previousNotifications;
          throw new Error('Unable to save Lina booking cleanup');
        }
      }
      localStorage.setItem(marker, '1');
    }
  } catch (error) { console.warn('Lina booking cleanup could not be completed.', error); }

  const api = {
    mode: "browser-demo",
    newestFirst(rows) {
      const timestamp = row => {
        const value = Date.parse(row.createdAt || row.placedAt || row.addedAt || "");
        return Number.isFinite(value) ? value : 0;
      };
      return rows.map((row, index) => ({ row, index }))
        .sort((a, b) => timestamp(b.row) - timestamp(a.row) || b.index - a.index)
        .map(item => item.row);
    },
    list(name) { return (data[name] || []).map(item => ({ ...item })); },
    get(name, recordId) { const item = (data[name] || []).find(row => String(row.id) === String(recordId)); return item ? { ...item } : null; },
    seed(name, rows) { if (!data[name]?.length && rows?.length) { const previous = data[name]; data[name] = rows.map(row => ({ id: row.id ?? id(), ...row })); if (!write()) data[name] = previous || []; } return api.list(name); },
    create(name, row) {
      if (!collections.includes(name)) return null;
      const licenses = window.CarePlusLicenses;
      if (licenses && name === 'appointments' && row.doctorId && !licenses.canProvide('doctor', row.doctorId)) return null;
      if (licenses && name === 'careRequests' && (row.assignedNurseId || row.nurseId) && !licenses.canProvide('nurse', row.assignedNurseId || row.nurseId)) return null;
      if (window.CarePlusNurseAvailability && name === 'careRequests' && (row.assignedNurseId || row.nurseId)
        && !window.CarePlusNurseAvailability.check(row.assignedNurseId || row.nurseId, row).ok) return null;
      if (licenses && name === 'orders' && row.source === 'pharmacy-order' && !row.demo && !licenses.canProvide('pharmacy', row.pharmacyId)) return null;
      const record = { id: row.id ?? id(), createdAt: new Date().toISOString(), ...row };
      const notificationsBefore = data.notifications.slice();
      data[name].push(record);
      if (name !== "notifications") notifyCreated(name, record);
      if (write()) return { ...record };
      data[name].splice(data[name].indexOf(record), 1);
      data.notifications = notificationsBefore;
      return null;
    },
    reviewLicenseRenewal(recordId, changes, approvedLicense) {
      if (!window.CarePlusAuth?.hasDemoAdminSession()) return null;
      const renewal = data.licenseRenewals.find(item => String(item.id) === String(recordId));
      const user = renewal && data.users.find(item => String(item.id) === String(renewal.userId));
      if (!renewal || !user || renewal.status !== 'Pending' || !['Approved', 'Rejected'].includes(changes.status)) return null;
      const previousRenewal = { ...renewal };
      const previousUser = { ...user };
      Object.assign(renewal, changes, { updatedAt: new Date().toISOString() });
      if (changes.status === 'Approved') {
        if (!approvedLicense) { Object.assign(renewal, previousRenewal); return null; }
        user.professionalLicense = approvedLicense;
      }
      if (write()) return { ...renewal };
      Object.keys(renewal).forEach(key => { delete renewal[key]; }); Object.assign(renewal, previousRenewal);
      Object.keys(user).forEach(key => { delete user[key]; }); Object.assign(user, previousUser);
      return null;
    },
    update(name, recordId, changes) {
      const row = (data[name] || []).find(item => String(item.id) === String(recordId));
      if (!row) return null;
      const before = { ...row };
      const licenses = window.CarePlusLicenses;
      const accepting = ['accepted', 'confirmed'].includes(String(changes.status || '').toLowerCase()) && changes.status !== row.status;
      if (licenses && accepting && name === 'appointments' && row.doctorId && !licenses.canProvide('doctor', row.doctorId)) return null;
      if (licenses && accepting && name === 'careRequests' && !licenses.canProvide('nurse', changes.assignedNurseId || changes.nurseId || row.assignedNurseId || row.nurseId)) return null;
      if (window.CarePlusNurseAvailability && name === 'careRequests' && (accepting || ['date', 'time', 'duration', 'schedule', 'assignedNurseId', 'nurseId'].some(key => Object.hasOwn(changes, key) && changes[key] !== row[key]))) {
        const next = { ...row, ...changes };
        const assigned = next.assignedNurseId || next.nurseId;
        if (assigned && !['Cancelled', 'Rejected', 'Completed', 'Closed'].includes(next.status)
          && !window.CarePlusNurseAvailability.check(assigned, next, { ignoreId: row.id }).ok) return null;
      }
      if (licenses && accepting && name === 'orders' && row.source === 'pharmacy-order' && !licenses.canProvide('pharmacy', row.pharmacyId)) return null;
      const notificationsBefore = data.notifications.slice();
      Object.assign(row, changes, { updatedAt: new Date().toISOString() });
      if (name !== "notifications") notifyUpdated(name, before, row);
      if (write()) return { ...row };
      Object.keys(row).forEach(key => { delete row[key]; }); Object.assign(row, before);
      data.notifications = notificationsBefore;
      return null;
    },
    remove(name, recordId) { const rows = data[name] || []; const index = rows.findIndex(item => String(item.id) === String(recordId)); if (index < 0) return false; const [removed] = rows.splice(index, 1); if (write()) return true; rows.splice(index, 0, removed); return false; },
    upsertDemoUser(identity) {
      const value = String(identity || "").trim(); if (!value) return null;
      const email = value.includes("@") ? value.toLowerCase() : "";
      const row = data.users.find(user => email && user.email?.toLowerCase() === email || !email && user.phone === value);
      if (row) return { ...row };
      return api.create("users", { name: email ? value.split("@")[0] : value, email, phone: email ? "" : value, role: "Customer", status: "Active", source: "demo-login" });
    },
    subscribe(callback) { const handler = event => { data = event.detail?.data || read(); callback(); }; const storage = event => { if (event.key === KEY) { data = read(); callback(); } }; window.addEventListener("careplus:data", handler); window.addEventListener("storage", storage); return () => { window.removeEventListener("careplus:data", handler); window.removeEventListener("storage", storage); }; }
  };
  let applicationNotificationsAdded = false;
  let notificationLinksMigrated = false;
  data.notifications.forEach(notification => {
    if (notification.recordType !== "professionalApplication" || !String(notification.link || "").includes("Admin/Doctors/applications.html")) return;
    const application = data.professionalApplications.find(item => String(item.id) === String(notification.recordId));
    if (!application) return;
    const reviewPage = application.role === "nurse" ? "Admin/Nurses/index.html" : application.role === "pharmacy" ? "Admin/Pharmacies/index.html" : "Admin/Doctors/index.html";
    notification.link = portalUrl(reviewPage, { applicationId: application.id });
    notificationLinksMigrated = true;
  });
  data.professionalApplications.filter(application => ["doctor", "nurse", "pharmacy"].includes(application.role) && ["Pending Verification", "Additional Documents Required"].includes(application.status)).forEach(application => {
    const alreadyNotified = data.notifications.some(item => item.recipientRole === "admin" && item.category === "professional"
      && item.recordType === "professionalApplication" && String(item.recordId) === String(application.id));
    if (alreadyNotified) return;
    const user = data.users.find(item => String(item.id) === String(application.userId));
    const roleName = application.role;
    const reviewPage = application.role === "nurse" ? "Admin/Nurses/index.html" : application.role === "pharmacy" ? "Admin/Pharmacies/index.html" : "Admin/Doctors/index.html";
    const at = application.submittedAt || application.updatedAt || application.createdAt || new Date().toISOString();
    addNotification("admin", "*", "professional", `professionalApplications:${application.id}:submitted:backfill:${at}`, `New ${roleName} application`,
      `${safeName(application.pharmacyName || user?.name || application.name)} submitted a ${roleName} verification request.`, "professionalApplication", application.id,
      portalUrl(reviewPage, { applicationId: application.id }));
    applicationNotificationsAdded = true;
  });
  if (applicationNotificationsAdded || notificationLinksMigrated) write();
  window.CarePlusData = api;
})();
