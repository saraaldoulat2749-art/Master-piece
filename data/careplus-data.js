/*
 * CarePlus shared browser demo repository. Data persists in localStorage and is
 * shared by same-origin tabs in this browser only; it is not a backend/database.
 */
(() => {
  const KEY = "careplusMockDataV1";
  const collections = ["users", "appointments", "products", "pharmacies", "careRequests", "orders"];
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
  const api = {
    mode: "browser-demo",
    list(name) { return (data[name] || []).map(item => ({ ...item })); },
    get(name, recordId) { const item = (data[name] || []).find(row => String(row.id) === String(recordId)); return item ? { ...item } : null; },
    seed(name, rows) { if (!data[name]?.length && rows?.length) { data[name] = rows.map(row => ({ id: row.id ?? id(), ...row })); write(); } return api.list(name); },
    create(name, row) { if (!collections.includes(name)) return null; const record = { id: row.id ?? id(), createdAt: new Date().toISOString(), ...row }; data[name].push(record); return write() ? { ...record } : null; },
    update(name, recordId, changes) { const row = (data[name] || []).find(item => String(item.id) === String(recordId)); if (!row) return null; Object.assign(row, changes, { updatedAt: new Date().toISOString() }); return write() ? { ...row } : null; },
    remove(name, recordId) { const rows = data[name] || []; const index = rows.findIndex(item => String(item.id) === String(recordId)); if (index < 0) return false; rows.splice(index, 1); return write(); },
    upsertDemoUser(identity) {
      const value = String(identity || "").trim(); if (!value) return null;
      const email = value.includes("@") ? value.toLowerCase() : "";
      const row = data.users.find(user => email && user.email?.toLowerCase() === email || !email && user.phone === value);
      if (row) return { ...row };
      return api.create("users", { name: email ? value.split("@")[0] : value, email, phone: email ? "" : value, role: "Customer", status: "Active", source: "demo-login" });
    },
    subscribe(callback) { const handler = event => { data = event.detail?.data || read(); callback(); }; const storage = event => { if (event.key === KEY) { data = read(); callback(); } }; window.addEventListener("careplus:data", handler); window.addEventListener("storage", storage); return () => { window.removeEventListener("careplus:data", handler); window.removeEventListener("storage", storage); }; }
  };
  window.CarePlusData = api;
})();
