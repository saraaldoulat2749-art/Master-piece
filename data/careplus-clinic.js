/*
 * Browser storage adapter for the doctor booking flow.
 * Replace this adapter's localStorage/CarePlusData calls with API requests when
 * the backend is ready; keep the public methods stable for page scripts.
 */
(() => {
  const PROFILE_KEY = "careplusDoctorProfileV1";
  const SCHEDULE_KEY = "careplusDoctorScheduleV1";
  const DEFAULT_SCHEDULE = Object.freeze({
    days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", duration: 30,
    breakStart: "", breakEnd: "", holidays: []
  });
  const safeRead = (key, fallback) => {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") }; }
    catch { return { ...fallback }; }
  };
  const parseTime = value => {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return -1;
    let hour = Number(match[1]);
    if (match[3]) {
      hour %= 12;
      if (match[3].toUpperCase() === "PM") hour += 12;
    }
    return hour * 60 + Number(match[2]);
  };
  const emit = type => window.dispatchEvent(new CustomEvent("careplus:clinic", { detail: { type } }));
  const scopedKey = (key, doctorId) => doctorId ? `${key}:${String(doctorId)}` : key;
  function getProfile(doctorId = "") { return safeRead(scopedKey(PROFILE_KEY, doctorId), {}); }
  function saveProfile(profile, doctorId = profile?.doctorId || "") {
    try { localStorage.setItem(scopedKey(PROFILE_KEY, doctorId), JSON.stringify(profile)); emit("profile"); return true; }
    catch { return false; }
  }
  function getSchedule(doctorId = "") { return safeRead(scopedKey(SCHEDULE_KEY, doctorId), DEFAULT_SCHEDULE); }
  function saveSchedule(schedule, doctorId = "") {
    try { localStorage.setItem(scopedKey(SCHEDULE_KEY, doctorId), JSON.stringify(schedule)); emit("schedule"); return true; }
    catch { return false; }
  }
  function listAppointments() { return window.CarePlusData?.list("appointments") || []; }
  function resolveDoctor(doctorName, requestedId = "") {
    const accounts = window.CarePlusData?.list("users") || [];
    const account = accounts.find(user => String(user.role || "").toLowerCase() === "doctor"
      && String(user.accountStatus || user.status || "").toLowerCase() === "active"
      && (requestedId ? String(user.doctorId || user.id) === String(requestedId) : String(user.name || "").trim().toLowerCase() === String(doctorName || "").trim().toLowerCase()));
    if (!account) return null;
    const doctorId = account.doctorId || account.id;
    const scopedProfile = getProfile(doctorId);
    const sharedProfile = getProfile();
    const onlyActiveDoctor = accounts.filter(user => String(user.role || "").toLowerCase() === "doctor" && String(user.accountStatus || user.status || "").toLowerCase() === "active").length === 1;
    const savedProfile = scopedProfile.name || scopedProfile.fee ? scopedProfile : (sharedProfile.name && (onlyActiveDoctor || String(sharedProfile.name).trim().toLowerCase() === String(account.name || "").trim().toLowerCase()) ? sharedProfile : scopedProfile);
    return { account, doctorId, profile: { ...savedProfile, name: savedProfile.name || account.name, doctorId } };
  }
  function listDoctors() {
    return (window.CarePlusData?.list("users") || []).filter(user => String(user.role || "").toLowerCase() === "doctor"
      && String(user.accountStatus || user.status || "").toLowerCase() === "active")
      .map(user => {
        const doctorId = user.doctorId || user.id;
        const scopedProfile = getProfile(doctorId);
        const sharedProfile = getProfile();
        const onlyActiveDoctor = (window.CarePlusData?.list("users") || []).filter(item => String(item.role || "").toLowerCase() === "doctor" && String(item.accountStatus || item.status || "").toLowerCase() === "active").length === 1;
        const profile = scopedProfile.name || scopedProfile.fee ? scopedProfile : (sharedProfile.name && (onlyActiveDoctor || String(sharedProfile.name).trim().toLowerCase() === String(user.name || "").trim().toLowerCase()) ? sharedProfile : scopedProfile);
        return { ...user, doctorId, profile };
      });
  }
  function isAvailable({ doctor, doctorId = "", date, time, ignoreId = "" }) {
    if (!doctor || !date) return false;
    const resolved = resolveDoctor(doctor, doctorId);
    const resolvedDoctorId = resolved?.doctorId || doctorId;
    const profile = resolved?.profile || getProfile(resolvedDoctorId);
    if (!resolved || !profile.name || String(profile.name).trim().toLowerCase() !== String(doctor).trim().toLowerCase()) return false;
    const schedule = getSchedule(resolvedDoctorId);
    const dateObject = new Date(`${date}T12:00:00`);
    if (Number.isNaN(+dateObject)) return false;
    const weekday = dateObject.getDay();
    const dayHours = schedule.dayHours?.[weekday];
    const start = parseTime(dayHours?.start || schedule.start);
    const end = parseTime(dayHours?.end || schedule.end);
    const selected = parseTime(time);
    const duration = Math.max(15, Number(schedule.duration) || 30);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (date < localToday || date === localToday && selected <= now.getHours() * 60 + now.getMinutes()) return false;
    if (selected < 0 || start < 0 || end <= start || selected < start || selected + duration > end) return false;
    if (!(schedule.days || []).includes(weekday)) return false;
    if ((schedule.holidays || []).some(item => item.date === date)) return false;
    if ((selected - start) % duration !== 0) return false;
    const breakStart = schedule.breakStart ? parseTime(schedule.breakStart) : -1;
    const breakEnd = schedule.breakEnd ? parseTime(schedule.breakEnd) : -1;
    if (breakStart >= 0 && breakEnd > breakStart && selected < breakEnd && selected + duration > breakStart) return false;
    const normalizedDoctor = String(doctor).trim().toLowerCase();
    const taken = listAppointments().some(item => {
      if (String(item.id) === String(ignoreId) || String(item.doctor || "").trim().toLowerCase() !== normalizedDoctor
        || item.date !== date || ["Cancelled", "Rejected"].includes(item.status)) return false;
      const existingStart = parseTime(item.time);
      const existingDuration = Math.max(15, Number(item.duration) || duration);
      return existingStart >= 0 && existingStart < selected + duration && existingStart + existingDuration > selected;
    });
    return !taken;
  }
  function createBooking(booking) {
    const resolved = resolveDoctor(booking.doctor, booking.doctorId);
    if (!resolved) return { ok: false, error: "This doctor's account is not active." };
    const doctorId = resolved.doctorId;
    const profile = resolved.profile;
    const bookingWithDoctor = { ...booking, doctorId };
    if (profile.specialty && booking.specialty !== profile.specialty) return { ok: false, error: "The selected specialty does not match this doctor's profile." };
    const rawFee = Number(profile.fee);
    if (!Number.isFinite(rawFee) || rawFee <= 0) return { ok: false, error: "This doctor has not set a consultation fee yet." };
    const fee = Number(rawFee.toFixed(2));
    const existing = listAppointments().slice().reverse().find(item => item.source === "user-booking" && item.idempotencyKey && item.idempotencyKey === booking.idempotencyKey && !["Cancelled", "Rejected"].includes(item.status));
    if (existing) return { ok: true, appointment: existing };
    if (!isAvailable(bookingWithDoctor)) return { ok: false, error: "That appointment time is no longer available." };
    const commissionRate = 10;
    const depositRate = 10;
    const commissionAmount = Number((fee * commissionRate / 100).toFixed(2));
    const depositAmount = Number((fee * depositRate / 100).toFixed(2));
    const appointmentId = globalThis.crypto?.randomUUID?.() || `appt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record = window.CarePlusData?.create("appointments", {
      ...bookingWithDoctor, id: appointmentId, consultationFee: fee, depositRate, depositAmount,
      depositPaid: 0, remainingBalance: Number((fee - depositAmount).toFixed(2)), commissionRate,
      commissionAmount, commissionCollected: 0, commissionRemainingToSettle: commissionAmount,
      doctorNetEarnings: Number((fee - commissionAmount).toFixed(2)),
      commissionAppointmentId: appointmentId, commissionStatus: "Pending Deposit",
      paymentStatus: "Pending", depositPaymentStatus: "Pending", balancePaymentStatus: "Pending",
      status: "Pending Deposit", duration: getSchedule(doctorId).duration,
      source: "user-booking", idempotencyKey: booking.idempotencyKey || ""
    });
    return record ? { ok: true, appointment: record } : { ok: false, error: "Could not save the appointment in this browser." };
  }
  function updateAppointment(id, changes) { return window.CarePlusData?.update("appointments", id, changes) || null; }
  function recordDemoDepositStep(id) {
    const appointment = window.CarePlusData?.get("appointments", id);
    if (!appointment || appointment.commissionAppointmentId !== appointment.id) return null;
    if (appointment.depositPaymentStatus === "Demo Simulated" || appointment.depositPaymentStatus === "Paid") return appointment;
    if (appointment.status !== "Pending Deposit") return null;
    return updateAppointment(id, {
      depositPaymentStatus: "Demo Simulated",
      paymentStatus: "Demo Simulated (Not Charged)",
      paymentMethod: "Demo checkout",
      paymentVerification: "Simulated only; no funds collected",
      status: "Requested", commissionStatus: "Awaiting appointment"
    });
  }
  function subscribe(callback) {
    const unsubscribeData = window.CarePlusData?.subscribe(callback) || (() => {});
    const handler = event => { if (event.key === PROFILE_KEY || event.key === SCHEDULE_KEY || event.key?.startsWith(`${PROFILE_KEY}:`) || event.key?.startsWith(`${SCHEDULE_KEY}:`)) callback(); };
    window.addEventListener("storage", handler);
    window.addEventListener("careplus:clinic", callback);
    return () => { unsubscribeData(); window.removeEventListener("storage", handler); window.removeEventListener("careplus:clinic", callback); };
  }
  window.CarePlusClinic = { getProfile, saveProfile, getSchedule, saveSchedule, listAppointments, listDoctors, resolveDoctor, isAvailable, createBooking, recordDemoDepositStep, updateAppointment, subscribe };
})();
