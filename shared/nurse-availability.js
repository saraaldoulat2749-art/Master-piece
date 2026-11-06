/* Shared scheduling policy for care selection, submission and nurse acceptance.
 * Dates/times are interpreted in Asia/Amman's current fixed UTC+03 offset.
 * A backend must enforce the same conflict checks transactionally.
 */
(() => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function minutes(value) {
    const match = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i.exec(String(value || '').trim());
    if (!match) return null;
    let hour = Number(match[1]);
    if (match[3]) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0); }
    if (hour > 23) return null;
    return hour * 60 + Number(match[2]);
  }
  const timeString = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  function normalizeSchedule(schedule) {
    if (!schedule || !Array.isArray(schedule.days)) return null;
    const days = [...new Set(schedule.days.map(Number))].filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
    const start = minutes(schedule.start), end = minutes(schedule.end);
    if (!days.length || start === null || end === null || start === end && schedule.fullDay !== true) return null;
    return { days, start: schedule.fullDay ? '00:00' : timeString(start), end: schedule.fullDay ? '00:00' : timeString(end), fullDay: schedule.fullDay === true };
  }
  function parseLegacySchedule(value) {
    const text = String(value || '').replace(/[\u2010-\u2015\u2212\ufffd]/g, '-');
    if (/24\s*\/\s*7/.test(text)) return { days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '00:00', fullDay: true };
    const times = text.match(/\d{1,2}:[0-5]\d\s*(?:AM|PM)?/gi);
    if (!times || times.length !== 2) return null;
    const token = '(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?)';
    const range = new RegExp(`\\b${token}\\s*-\\s*${token}\\b`, 'i').exec(text);
    let days = [];
    if (range) {
      const first = dayNames.findIndex(day => day.toLowerCase() === range[1].slice(0, 3).toLowerCase());
      const last = dayNames.findIndex(day => day.toLowerCase() === range[2].slice(0, 3).toLowerCase());
      for (let day = first; days.length < 7; day = (day + 1) % 7) { days.push(day); if (day === last) break; }
    } else {
      days = [...text.matchAll(new RegExp(`\\b${token}\\b`, 'gi'))].map(match => dayNames.findIndex(day => day.toLowerCase() === match[1].slice(0, 3).toLowerCase()));
      if (!days.length && !/[a-z]/i.test(text.replace(times[0], '').replace(times[1], '').replace(/daily|every\s*day|all\s*days/gi, ''))) days = [0, 1, 2, 3, 4, 5, 6];
    }
    return normalizeSchedule({ days, start: times[0].trim(), end: times[1].trim() });
  }
  function scheduleFor(nurse) {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(`carePlusNurseProfileV1:${nurse.nurseId || nurse.id}`) || '{}'); } catch {}
    return normalizeSchedule(nurse.workSchedule) || normalizeSchedule(profile.workSchedule)
      || parseLegacySchedule(profile.availability || nurse.availability);
  }
  function describe(schedule) {
    const normalized = normalizeSchedule(schedule);
    if (!normalized) return 'Working hours not configured';
    return `${normalized.days.map(day => dayNames[day]).join(', ')} · ${normalized.fullDay ? '24 hours' : `${normalized.start}–${normalized.end}`}`;
  }
  function periodFor(request) {
    return /recurring\s*daily/i.test(request.schedule || '') ? 1440 : /recurring\s*weekly/i.test(request.schedule || '') ? 10080 : 0;
  }
  function interval(request, existing = false) {
    const date = String(request.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return null;
    const time = minutes(request.time);
    let duration = Number(request.duration);
    if (existing && (time === null || !Number.isFinite(duration) || duration <= 0)) return { start: Date.parse(`${date}T00:00:00Z`) / 60000, duration: 1440, period: periodFor(request) };
    if (time === null || !Number.isFinite(duration) || duration <= 0 || duration > 24) return null;
    return { start: Date.parse(`${date}T00:00:00Z`) / 60000 + time, duration: duration * 60, period: periodFor(request) };
  }
  const overlaps = (a, b) => a.start < b.start + b.duration && b.start < a.start + a.duration;
  function conflicts(a, b) {
    if (!a.period && !b.period) return overlaps(a, b);
    if (a.period && b.period) {
      const period = a.period === 1440 || b.period === 1440 ? 1440 : 10080;
      const difference = ((b.start - a.start) % period + period) % period;
      return difference < a.duration && difference > -b.duration || difference - period < a.duration && difference - period > -b.duration;
    }
    const repeating = a.period ? a : b, fixed = a.period ? b : a;
    const near = Math.floor((fixed.start - repeating.start) / repeating.period);
    for (let index = Math.max(0, near - 1); index <= Math.max(0, near + 1); index++) {
      if (overlaps(fixed, { start: repeating.start + index * repeating.period, duration: repeating.duration })) return true;
    }
    return false;
  }
  function withinShift(schedule, visit) {
    const startMinute = minutes(schedule.start), endMinute = minutes(schedule.end);
    const length = schedule.fullDay ? 1440 : endMinute > startMinute ? endMinute - startMinute : 1440 - startMinute + endMinute;
    const daysToCheck = visit.period === 1440 ? 7 : 1;
    for (let offset = 0; offset < daysToCheck; offset++) {
      const start = visit.start + offset * 1440;
      const day = Math.floor(start / 1440);
      if (schedule.fullDay) {
        const lastDay = Math.floor((start + visit.duration - 0.001) / 1440);
        for (let covered = day; covered <= lastDay; covered++) if (!schedule.days.includes(new Date(covered * 86400000).getUTCDay())) return false;
        continue;
      }
      const fits = [day - 1, day].some(shiftDay => {
        const weekday = new Date(shiftDay * 86400000).getUTCDay();
        const shiftStart = shiftDay * 1440 + startMinute;
        return schedule.days.includes(weekday) && start >= shiftStart && start + visit.duration <= shiftStart + length;
      });
      if (!fits) return false;
    }
    return true;
  }
  function check(nurseId, request, { ignoreId = '', allowPast = false } = {}) {
    const data = window.CarePlusData;
    const nurse = data?.list('users').find(user => String(user.role || '').toLowerCase() === 'nurse' && [user.id, user.nurseId].some(id => id != null && String(id) === String(nurseId)));
    if (!nurse) return { ok: false, reason: 'Nurse unavailable.' };
    if (window.CarePlusLicenses && !window.CarePlusLicenses.canProvide('nurse', nurse.nurseId || nurse.id)) return { ok: false, reason: 'This nurse is not eligible to accept new care requests.' };
    const schedule = scheduleFor(nurse), visit = interval(request);
    if (!schedule) return { ok: false, reason: 'This nurse has not configured working days and hours.' };
    if (!visit || !allowPast && visit.start * 60000 - 3 * 3600000 <= Date.now()) return { ok: false, reason: 'Choose a valid future date, time and duration.' };
    if (!withinShift(schedule, visit)) return { ok: false, reason: 'The full visit must fit within the nurse’s working days and hours.' };
    const ids = [String(nurse.id), String(nurse.nurseId || nurse.id)];
    const busy = data.list('careRequests').some(other => {
      if (String(other.id) === String(ignoreId) || !ids.includes(String(other.assignedNurseId || other.nurseId || ''))
        || ['cancelled', 'canceled', 'rejected', 'completed', 'closed', 'expired'].includes(String(other.status || '').toLowerCase())) return false;
      const existing = interval(other, true);
      return existing && conflicts(visit, existing);
    });
    return busy ? { ok: false, reason: 'This nurse already has a care request during the selected time.' } : { ok: true, schedule };
  }
  window.CarePlusNurseAvailability = { normalizeSchedule, parseLegacySchedule, scheduleFor, describe, check, conflicts, interval };
})();
