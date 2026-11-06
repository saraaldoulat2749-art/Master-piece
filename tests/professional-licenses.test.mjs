import * as fs from 'node:fs/promises';

// Run with Node, or import runLicenseTests() from the project's JS runtime.
// Exercises the real policy and data adapter using an isolated in-memory browser.
export async function runLicenseTests() {
  const root = new URL('../', import.meta.url);
  const previous = Object.fromEntries(['window', 'document', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'setInterval'].map(key => [key, globalThis[key]]));
  let checks = 0;
  const assert = (condition, message) => { checks++; if (!condition) throw new Error(message); };
  const roles = ['doctor', 'nurse', 'pharmacy'];
  const initial = {
    users: roles.map(role => ({ id: `${role}-user`, role: role[0].toUpperCase() + role.slice(1), [`${role}Id`]: `${role}-provider`, name: `${role} test`, email: `${role}@test`, status: 'Active', accountStatus: 'Active', IsActive: true, verificationStatus: 'Approved', profile: { unchanged: true } })),
    professionalApplications: roles.map(role => ({ id: `${role}-app`, role, userId: `${role}-user`, status: 'Approved', licenseNumber: `OLD-${role}`, licenseExpiry: '2000-01-01', documents: { practiceLicense: { id: 'original-document', name: 'original.pdf' } } })),
    appointments: [{ id: 'old-appointment', doctorId: 'doctor-provider', patient: 'Existing patient', status: 'Confirmed' }],
    orders: [{ id: 'old-order', source: 'pharmacy-order', pharmacyId: 'pharmacy-provider', items: [{ medicineId: 'med', quantity: 2 }], status: 'Pending' }],
    pharmacies: [{ id: 'pharmacy-provider', name: 'Existing pharmacy', status: 'Active', inventory: [{ id: 'med', quantity: 10, price: 2 }] }],
    products: [{ id: 'existing-product', quantity: 7 }], careRequests: [{ id: 'old-care', assignedNurseId: 'nurse-provider', status: 'Accepted' }], notifications: [], licenseRenewals: []
  };
  const memory = new Map([['careplusMockDataV1', JSON.stringify(initial)]]);
  let failWrites = false;
  let admin = false;
  let currentRole = 'doctor';
  globalThis.localStorage = { getItem: key => memory.get(key) ?? (key.includes('Seed') || key.includes('Restore') || key.includes('Provisioned') ? '1' : null), setItem: (key, value) => { if (failWrites) throw new Error('Simulated storage failure'); memory.set(key, String(value)); } };
  globalThis.sessionStorage = { getItem: () => 'test-admin' };
  globalThis.location = { href: 'https://careplus.test/Doctor/index.html' };
  globalThis.document = { currentScript: { src: 'https://careplus.test/data/careplus-data.js' } };
  globalThis.CustomEvent = class { constructor(type, values) { this.type = type; this.detail = values?.detail; } };
  globalThis.setInterval = () => 0;
  globalThis.window = { addEventListener() {}, dispatchEvent() {}, CarePlusAuth: {
    hasDemoAdminSession: () => admin,
    demoDoctorAccount: () => currentRole === 'doctor' ? window.CarePlusData.get('users', 'doctor-user') : null,
    demoNurseAccount: () => currentRole === 'nurse' ? window.CarePlusData.get('users', 'nurse-user') : null,
    demoPharmacyAccount: () => currentRole === 'pharmacy' ? window.CarePlusData.get('users', 'pharmacy-user') : null
  } };
  const runtimeFiles = [];
  async function load(relative) {
    const runtime = new URL(`.license-runtime-${runtimeFiles.length}-${Date.now()}.mjs`, import.meta.url);
    runtimeFiles.push(runtime);
    await fs.writeFile(runtime, await fs.readFile(new URL(relative, root), 'utf8'));
    await import(runtime.href);
  }
  try {
    await load('data/careplus-data.js');
    document.currentScript.src = 'https://careplus.test/shared/professional-licenses.js';
    await load('shared/professional-licenses.js');
    const data = window.CarePlusData;
    const api = window.CarePlusLicenses;
    const preserved = JSON.stringify(['appointments', 'orders', 'careRequests', 'products', 'pharmacies'].map(name => data.list(name)));
    const documentMetadata = { id: 'new-document', name: 'renewed.pdf', type: 'application/pdf', size: 1024 };
    for (const role of roles) {
      currentRole = role; admin = false;
      const id = `${role}-user`;
      assert(api.licenseState(data.get('users', id), role).code === 'expired', `${role}: expired application recognized`);
      assert(!api.canProvide(role, `${role}-provider`), `${role}: expired professional restricted`);
      assert(Boolean(api.currentProfessional(role)), `${role}: retains account access`);
      const values = { licenseNumber: `NEW-${role}`, licenseExpiry: '2099-12-31', noExpiry: false, document: documentMetadata };
      assert(!api.submitRenewal(role, { ...values, licenseExpiry: '2000-01-01' }).ok, `${role}: cannot submit expired renewal`);
      assert(!api.submitRenewal(role, { ...values, licenseExpiry: '2027-02-30' }).ok, `${role}: invalid calendar date rejected`);
      assert(!api.submitRenewal(role, { ...values, document: null }).ok, `${role}: upload required`);
      const submission = api.submitRenewal(role, values);
      assert(submission.ok, `${role}: renewal submitted`);
      assert(!api.canProvide(role, `${role}-provider`), `${role}: submission alone does not restore services`);
      assert(!api.submitRenewal(role, values).ok, `${role}: duplicate pending renewal prevented`);
      assert(!api.reviewRenewal(submission.renewal.id, 'approve').ok, `${role}: professional cannot approve own renewal`);
      admin = true;
      assert(!api.reviewRenewal(submission.renewal.id, 'reject', '').ok, `${role}: rejection needs reason`);
      assert(api.reviewRenewal(submission.renewal.id, 'reject', 'License copy is unreadable').ok, `${role}: Admin can reject`);
      assert(!api.canProvide(role, `${role}-provider`), `${role}: rejection retains restriction`);
      admin = false;
      const retry = api.submitRenewal(role, values);
      assert(retry.ok, `${role}: resubmission after rejection`);
      admin = true;
      assert(api.reviewRenewal(retry.renewal.id, 'approve').ok, `${role}: Admin approves renewed license`);
      assert(api.canProvide(role, `${role}-provider`), `${role}: approved renewal restores service eligibility`);
      assert(!api.reviewRenewal(retry.renewal.id, 'approve').ok, `${role}: duplicate review prevented`);
      assert(data.get('professionalApplications', `${role}-app`).licenseExpiry === '2000-01-01', `${role}: original application retained`);
      assert(data.get('users', id).profile.unchanged, `${role}: profile retained`);
      data.update('users', id, { IsActive: false });
      assert(!api.canProvide(role, `${role}-provider`) && api.licenseState(data.get('users', id), role).valid, `${role}: activation independent of valid license`);
      data.update('users', id, { IsActive: true, verificationStatus: 'Rejected' });
      assert(!api.canProvide(role, `${role}-provider`), `${role}: verification still required`);
      data.update('users', id, { verificationStatus: 'Approved' });
    }
    currentRole = 'doctor'; admin = false;
    const noExpiry = api.submitRenewal('doctor', { licenseNumber: 'LIFETIME', noExpiry: true, licenseExpiry: '', document: documentMetadata });
    assert(noExpiry.ok, 'No-expiration licenses supported');
    assert(api.canProvide('doctor', 'doctor-provider'), 'Pending renewal does not invalidate a still-valid approved license');
    admin = true;
    data.update('users', 'doctor-user', { IsActive: false });
    assert(api.reviewRenewal(noExpiry.renewal.id, 'approve').ok, 'Can review renewal of inactive account');
    assert(data.get('users', 'doctor-user').IsActive === false && !api.canProvide('doctor', 'doctor-provider'), 'Renewal approval never reactivates an account');
    data.update('users', 'doctor-user', { IsActive: true });
    assert(api.licenseState(data.get('users', 'doctor-user'), 'doctor').expiresOn === '', 'Approved lifetime license has no expiration');
    assert(api.validDate(api.today()) && !api.validDate('invalid'), 'Calendar date handling');
    data.update('users', 'nurse-user', { professionalLicense: { expiresOn: api.today() } });
    assert(api.canProvide('nurse', 'nurse-provider'), 'License valid through expiration day');
    for (const role of roles) data.update('users', `${role}-user`, { professionalLicense: { expiresOn: '2000-01-01' } });
    assert(!data.create('appointments', { doctorId: 'doctor-provider' }), 'Data boundary rejects new appointments for expired doctor');
    assert(!data.create('careRequests', { assignedNurseId: 'nurse-provider' }), 'Data boundary rejects assignments to expired nurse');
    assert(!data.create('orders', { source: 'pharmacy-order', pharmacyId: 'pharmacy-provider' }), 'Data boundary rejects new orders for expired pharmacy');
    assert(!data.update('orders', 'old-order', { status: 'Accepted' }), 'Expired pharmacy cannot accept existing pending order');
    assert(!data.update('careRequests', 'old-care', { status: 'Confirmed' }), 'Expired nurse cannot accept a new assignment');
    assert(preserved === JSON.stringify(['appointments', 'orders', 'careRequests', 'products', 'pharmacies'].map(name => data.list(name))), 'All existing service records and inventory preserved');
    assert(data.list('notifications').some(row => row.recipientRole === 'admin' && row.recordType === 'licenseRenewal'), 'Admin notified about renewal');
    assert(data.list('notifications').some(row => row.recipientRole === 'doctor' && /approved/.test(row.title)), 'Professional notified about review');
    currentRole = 'doctor'; admin = false;
    const atomic = api.submitRenewal('doctor', { licenseNumber: 'ATOMIC', licenseExpiry: '2099-01-01', document: documentMetadata });
    admin = true; failWrites = true;
    const beforeUser = JSON.stringify(data.get('users', 'doctor-user'));
    const beforeRenewal = JSON.stringify(data.get('licenseRenewals', atomic.renewal.id));
    assert(!api.reviewRenewal(atomic.renewal.id, 'approve').ok, 'Failed persistence reported');
    failWrites = false;
    assert(JSON.stringify(data.get('users', 'doctor-user')) === beforeUser && JSON.stringify(data.get('licenseRenewals', atomic.renewal.id)) === beforeRenewal, 'Approval failure rolls back both records');
    currentRole = 'nurse'; admin = false;
    const countBefore = data.list('licenseRenewals').length;
    failWrites = true;
    assert(!api.submitRenewal('nurse', { licenseNumber: 'UNSAVED', licenseExpiry: '2099-01-01', document: documentMetadata }).ok, 'Failed renewal submission reported');
    failWrites = false;
    assert(data.list('licenseRenewals').length === countBefore, 'Failed submission does not leave a phantom pending renewal');
    return { checks, passed: true };
  } finally {
    await Promise.all(runtimeFiles.map(file => fs.unlink(file).catch(() => {})));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
