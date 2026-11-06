import * as fs from 'node:fs/promises';

export async function runReliabilityTests() {
  const root = new URL('../', import.meta.url);
  const previous = Object.fromEntries(['window', 'document', 'localStorage', 'CustomEvent'].map(key => [key, globalThis[key]]));
  let checks = 0, failWrites = false;
  const assert = (condition, message) => { checks++; if (!condition) throw new Error(message); };
  const fixture = { users: [{ id: 'customer', role: 'Customer', name: 'Customer' }, { id: 'nurse', role: 'Nurse', status: 'Active', nurseId: 'nurse' }],
    appointments: [{ id: 'appointment', userId: 'customer', doctorId: 'doctor', doctor: 'Doctor', status: 'Requested' }],
    careRequests: [{ id: 'care', userId: 'customer', status: 'Requested', assignedNurseId: 'nurse' }],
    orders: [{ id: 'order', status: 'Pending' }], products: [], pharmacies: [], notifications: [], professionalApplications: [], licenseRenewals: [] };
  const storage = new Map([['careplusMockDataV1', JSON.stringify(fixture)]]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? (key.includes('Seed') || key.includes('Restore') ? '1' : null), setItem: (key, value) => { if (failWrites) throw new Error('Simulated storage failure'); storage.set(key, String(value)); } };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.document = { currentScript: { src: 'https://careplus.test/data/careplus-data.js' } };
  globalThis.window = { dispatchEvent() {}, addEventListener() {} };
  const temporary = [];
  async function load(file) {
    const path = new URL(`.reliability-runtime-${temporary.length}-${Date.now()}.mjs`, import.meta.url); temporary.push(path);
    await fs.writeFile(path, await fs.readFile(new URL(file, root), 'utf8')); await import(path.href);
  }
  try {
    await load('data/careplus-data.js'); await load('shared/payment-validation.js');
    const data = window.CarePlusData;
    const before = storage.get('careplusMockDataV1');
    const originalAppointment = JSON.stringify(data.get('appointments', 'appointment'));
    const notificationCount = data.list('notifications').length;
    failWrites = true;
    assert(data.create('careRequests', { id: 'unsaved', source: 'user-request', userId: 'customer', assignedNurseId: 'nurse' }) === null, 'Failed create reported');
    assert(!data.get('careRequests', 'unsaved'), 'Failed create leaves no ghost request');
    assert(data.list('notifications').length === notificationCount, 'Failed create leaves no phantom notification');
    assert(data.update('appointments', 'appointment', { status: 'Confirmed', lastActionByRole: 'Doctor', addedField: 'must roll back' }) === null, 'Failed update reported');
    assert(JSON.stringify(data.get('appointments', 'appointment')) === originalAppointment, 'Failed update restores values and removes added fields');
    assert(data.list('notifications').length === notificationCount, 'Failed update rolls back notifications');
    assert(!data.remove('orders', 'order') && data.get('orders', 'order'), 'Failed removal preserves record');
    data.seed('products', [{ id: 'unsaved-product' }]);
    assert(!data.get('products', 'unsaved-product'), 'Failed seeding preserves original data');
    assert(storage.get('careplusMockDataV1') === before, 'Failed operations leave persisted data unchanged');
    failWrites = false;
    assert(data.create('careRequests', { id: 'unsaved', source: 'user-request', userId: 'customer', assignedNurseId: 'nurse' }), 'Retry succeeds');
    assert(data.list('careRequests').filter(row => row.id === 'unsaved').length === 1, 'Retry creates only one record');
    assert(data.update('appointments', 'appointment', { status: 'Confirmed', lastActionByRole: 'Doctor' }), 'Successful updates still work');
    assert(data.remove('orders', 'order') && !data.get('orders', 'order'), 'Successful removals still work');
    const validate = window.CarePlusPaymentValidation.validateCard;
    const now = new Date('2026-11-06T12:00:00+03:00');
    const card = { name: 'Test Customer', number: '4111 1111 1111 1111', expiry: '12 / 30', cvv: '123' };
    assert(validate(card, now).ok, 'Valid demo input accepted');
    assert(!validate({ ...card, name: '' }, now).ok, 'Name required');
    assert(!validate({ ...card, number: '1234' }, now).ok, 'Short number rejected');
    assert(!validate({ ...card, number: '4111111111111111abc' }, now).ok, 'Non-numeric card input rejected');
    assert(!validate({ ...card, expiry: '13/30' }, now).ok, 'Invalid month rejected');
    assert(!validate({ ...card, expiry: '10/26' }, now).ok, 'Expired card rejected');
    assert(validate({ ...card, expiry: '11/26' }, now).ok, 'Current month accepted');
    assert(!validate({ ...card, cvv: '12' }, now).ok, 'Short security code rejected');
    assert(validate({ ...card, cvv: '1234' }, now).ok, 'Four-digit security code accepted');
    assert(!validate({ ...card, expiry: '11/26' }, new Date('2026-11-30T21:01:00Z')).ok, 'Expiry uses Amman month boundary');
    assert(!JSON.stringify(validate(card, now)).includes(card.number), 'Validation result contains no card data');
    return { checks, passed: true };
  } finally {
    await Promise.all(temporary.map(path => fs.unlink(path).catch(() => {})));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
