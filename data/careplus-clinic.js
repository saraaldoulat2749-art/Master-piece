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
  function isAvailable({ doctor, doctorId = "", date, time, ignoreId = "" }) {
    if (!doctor || !date) return false;
    const profile = getProfile(doctorId);
    if (!profile.name || String(profile.name).trim().toLowerCase() !== String(doctor).trim().toLowerCase()) return false;
    const schedule = getSchedule(doctorId);
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
    const doctorAccount = window.CarePlusData?.list("users").find(user => String(user.role || "").toLowerCase() === "doctor"
      && String(user.accountStatus || user.status || "").toLowerCase() === "active"
      && String(user.name || "").trim().toLowerCase() === String(booking.doctor || "").trim().toLowerCase());
    const doctorId = booking.doctorId || doctorAccount?.doctorId || "";
    const profile = getProfile(doctorId);
    const bookingWithDoctor = { ...booking, doctorId };
    if (profile.specialty && booking.specialty !== profile.specialty) return { ok: false, error: "The selected specialty does not match this doctor's profile." };
    if (!isAvailable(bookingWithDoctor)) return { ok: false, error: "That appointment time is no longer available." };
    const record = window.CarePlusData?.create("appointments", { ...bookingWithDoctor, duration: getSchedule(doctorId).duration, status: "Requested", source: "user-booking" });
    return record ? { ok: true, appointment: record } : { ok: false, error: "Could not save the appointment in this browser." };
  }
  function updateAppointment(id, changes) { return window.CarePlusData?.update("appointments", id, changes) || null; }
  function subscribe(callback) {
    const unsubscribeData = window.CarePlusData?.subscribe(callback) || (() => {});
    const handler = event => { if (event.key === PROFILE_KEY || event.key === SCHEDULE_KEY || event.key?.startsWith(`${PROFILE_KEY}:`) || event.key?.startsWith(`${SCHEDULE_KEY}:`)) callback(); };
    window.addEventListener("storage", handler);
    window.addEventListener("careplus:clinic", callback);
    return () => { unsubscribeData(); window.removeEventListener("storage", handler); window.removeEventListener("careplus:clinic", callback); };
  }
  window.CarePlusClinic = { getProfile, saveProfile, getSchedule, saveSchedule, listAppointments, isAvailable, createBooking, updateAppointment, subscribe };
})();
