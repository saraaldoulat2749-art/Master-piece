import * as fs from 'node:fs/promises';

export async function runNurseScheduleTests() {
  const root = new URL('../', import.meta.url);
  const previous = Object.fromEntries(['window', 'document', 'localStorage', 'CustomEvent'].map(key => [key, globalThis[key]]));
  const files = [];
  let checks = 0, eligible = true;
  function assert(value, label) { checks++; if (!value) throw new Error(label); }
  const monday = new Date('2099-01-01T00:00:00Z');
  while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
  const date = offset => new Date(+monday + offset * 86400000).toISOString().slice(0, 10);
  const work = { days: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' };
  const initial = { users: [{ id: 'nurse-account', nurseId: 'nurse-provider', role: 'Nurse', status: 'Active', workSchedule: work }],
    careRequests: [{ id: 'historical', assignedNurseId: 'nurse-provider', status: 'Cancelled', date: '2000-01-01', time: '09:00', duration: 1 }],
    appointments: [], products: [], pharmacies: [], orders: [], notifications: [], professionalApplications: [], licenseRenewals: [] };
  const memory = new Map([['careplusMockDataV1', JSON.stringify(initial)]]);
  globalThis.localStorage = { getItem: key => memory.get(key) ?? (key.includes('Seed') || key.includes('Restore') ? '1' : null), setItem: (key, value) => memory.set(key, String(value)) };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.document = { currentScript: { src: 'https://careplus.test/data/careplus-data.js' } };
  globalThis.window = { addEventListener() {}, dispatchEvent() {}, CarePlusLicenses: { canProvide: () => eligible } };
  async function load(relative) {
    const path = new URL(`.schedule-runtime-${files.length}-${Date.now()}.mjs`, import.meta.url); files.push(path);
    await fs.writeFile(path, await fs.readFile(new URL(relative, root), 'utf8')); await import(path.href);
  }
  try {
    await load('data/careplus-data.js'); await load('shared/nurse-availability.js');
    const api = window.CarePlusNurseAvailability, data = window.CarePlusData;
    const visit = { date: date(0), time: '09:00', duration: 2, schedule: 'One-time visit' };
    const available = request => api.check('nurse-provider', { ...visit, ...request }).ok;
    assert(available({}), 'Valid working slot');
    assert(api.check('nurse-account', visit).ok, 'Account and provider ids both supported');
    assert(!available({ date: date(5) }), 'Day off excluded');
    assert(!available({ time: '07:59' }), 'Before shift excluded');
    assert(!available({ time: '15:00' }), 'Whole duration must fit');
    assert(available({ time: '14:00' }), 'Visit may end exactly at shift end');
    assert(!available({ date: '2000-01-01' }), 'Past date excluded');
    assert(!available({ date: '2099-02-30' }), 'Invalid date excluded');
    assert(!available({ time: '25:00' }), 'Invalid time excluded');
    assert(!available({ duration: 0 }) && !available({ duration: 25 }), 'Invalid duration excluded');
    eligible = false; assert(!available({}), 'Expired or unapproved nurse excluded'); eligible = true;
    assert(!api.check('missing', visit).ok, 'Unknown nurse excluded');
    const record = data.create('careRequests', { ...visit, id: 'busy', assignedNurseId: 'nurse-provider', status: 'Requested' });
    assert(record, 'Care request created during working hours');
    assert(!available({}), 'Pending request reserves nurse');
    assert(!available({ time: '08:00' }), 'Partial overlap at start blocked');
    assert(!available({ time: '10:00' }), 'Partial overlap at end blocked');
    assert(!available({ time: '08:00', duration: 4 }), 'Containing interval blocked');
    assert(available({ time: '11:00', duration: 1 }), 'Back-to-back visits allowed');
    assert(available({ time: '08:00', duration: 1 }), 'Visit ending at next start allowed');
    assert(api.check('nurse-provider', visit, { ignoreId: 'busy' }).ok, 'Self ignored when accepting');
    assert(!data.create('careRequests', { ...visit, assignedNurseId: 'nurse-provider', status: 'Requested' }), 'Data boundary prevents overlapping submission');
    assert(data.update('careRequests', 'busy', { status: 'Accepted' }), 'Nurse may accept own pending request');
    assert(!available({}), 'Accepted visit blocks same interval');
    for (const status of ['Cancelled', 'Rejected', 'Completed', 'Closed']) {
      data.update('careRequests', 'busy', { status }); assert(available({}), `${status} releases interval`);
    }
    data.update('users', 'nurse-account', { workSchedule: { days: [1], start: '22:00', end: '06:00' } });
    assert(available({ time: '23:00', duration: 3 }), 'Overnight shift covers midnight');
    assert(available({ date: date(1), time: '02:00', duration: 2 }), 'Previous-day shift covers early morning');
    assert(!available({ date: date(1), time: '05:00', duration: 2 }), 'Cannot overrun overnight shift');
    data.update('users', 'nurse-account', { workSchedule: work });
    assert(available({ schedule: 'Recurring weekly' }), 'Weekly visits fit weekly shift');
    assert(!available({ schedule: 'Recurring daily' }), 'Daily visits cannot include days off');
    data.update('careRequests', 'busy', { ...visit, schedule: 'Recurring weekly', status: 'Accepted' });
    assert(!available({ date: date(7) }), 'Existing weekly recurrence blocks later occurrence');
    assert(available({ date: date(-7) }), 'Recurring series does not block earlier dates');
    assert(available({ date: date(1) }), 'Weekly series does not block other weekday');
    data.update('users', 'nurse-account', { workSchedule: { days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '00:00', fullDay: true } });
    assert(!available({ schedule: 'Recurring daily' }), 'Daily and weekly recurrence conflicts');
    data.update('careRequests', 'busy', { status: 'Cancelled' });
    assert(available({ time: '23:00', duration: 3, schedule: 'Recurring daily' }), 'Full-day schedules cover continuous overnight visits');
    data.update('users', 'nurse-account', { workSchedule: { days: [1], start: '00:00', end: '00:00', fullDay: true } });
    assert(!available({ time: '23:00', duration: 3 }), 'Full-day shift does not cross into day off');
    assert(api.parseLegacySchedule('Sun–Thu, 8:00–16:00')?.days.length === 5, 'Existing day-range text supported');
    assert(api.parseLegacySchedule('Mon, Wed, Fri 8:00 AM - 4:00 PM')?.end === '16:00', 'Legacy AM/PM supported');
    assert(api.parseLegacySchedule('24/7')?.fullDay, 'Legacy 24/7 supported');
    assert(!api.parseLegacySchedule('Contact me for hours'), 'Unstructured unknown hours not assumed available');
    data.update('users', 'nurse-account', { workSchedule: null, availability: '' });
    assert(!available({}), 'Unconfigured nurse excluded');
    memory.set('carePlusNurseProfileV1:nurse-provider', JSON.stringify({ availability: 'Mon-Fri, 08:00-16:00' }));
    assert(available({}), 'Existing profile hours reused');
    assert(!data.update('careRequests', 'busy', { status: 'Accepted', time: '18:00' }), 'Acceptance rechecks current shift');
    assert(data.get('careRequests', 'historical').status === 'Cancelled', 'Historical records preserved');
    return { checks, passed: true };
  } finally {
    await Promise.all(files.map(path => fs.unlink(path).catch(() => {})));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
