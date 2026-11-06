/* Frontend simulation only. A backend must enforce this policy and review uploads.
 * License dates are valid through the specified day in Asia/Amman.
 * Account activation, initial verification and license validity are independent.
 */
(() => {
  const roles = ['doctor', 'nurse', 'pharmacy'];
  const data = () => window.CarePlusData;
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  }
  function findUser(role, id) {
    return data()?.list('users').find(user => String(user.role || '').toLowerCase() === role
      && [user.id, user[`${role}Id`]].some(value => value != null && String(value) === String(id)));
  }
  const currentProfessional = role => window.CarePlusAuth?.[{ doctor: 'demoDoctorAccount', nurse: 'demoNurseAccount', pharmacy: 'demoPharmacyAccount' }[role]]?.();
  function application(user, role) {
    return data()?.list('professionalApplications').find(item => item.role === role && String(item.userId) === String(user.id));
  }
  function licenseState(user, role = String(user?.role || '').toLowerCase()) {
    if (!user || !roles.includes(role)) return { valid: false, code: 'unavailable', message: 'Professional account unavailable.' };
    const app = application(user, role);
    const approved = user.professionalLicense;
    const expiry = String(approved ? approved.expiresOn || '' : app?.licenseExpiry ?? user.licenseExpiry ?? '').trim();
    const verified = (!app || app.status === 'Approved')
      && (!user.approvalStatus || ['approved', 'verified'].includes(String(user.approvalStatus).toLowerCase()))
      && (!user.verificationStatus || ['approved', 'verified'].includes(String(user.verificationStatus).toLowerCase()));
    const active = user.IsActive !== false && user.isActive !== false && !user.archived && !user.archivedAt
      && String(user.accountStatus || user.status || 'Active').toLowerCase() === 'active';
    const expired = Boolean(expiry && validDate(expiry) && expiry < today());
    const invalidDate = Boolean(expiry && !validDate(expiry));
    const code = !verified ? 'unverified' : invalidDate ? 'invalid' : expired ? 'expired' : 'valid';
    const message = code === 'expired' ? 'Your professional license has expired. Renew it and obtain Admin approval before providing new services.'
      : code === 'unverified' ? 'Professional verification is required before providing services.'
      : code === 'invalid' ? 'Your license expiration date needs to be corrected and reviewed.'
      : expiry ? `License valid through ${expiry}.` : 'License has no recorded expiration date.';
    const renewals = (data()?.list('licenseRenewals') || []).filter(item => item.role === role && String(item.userId) === String(user.id));
    return { valid: verified && !expired && !invalidDate, active, canProvideServices: active && verified && !expired && !invalidDate,
      code, message, expiresOn: expiry, number: approved?.number || app?.licenseNumber || user.licenseNumber || '',
      document: approved?.document || app?.documents?.[role === 'pharmacy' ? 'pharmacyLicense' : 'practiceLicense'],
      pending: renewals.find(item => item.status === 'Pending'), latest: renewals.slice().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0] };
  }
  function canProvide(role, id) {
    if (role === 'pharmacy') {
      const pharmacy = data()?.get('pharmacies', id);
      if (!pharmacy || pharmacy.IsActive === false || pharmacy.isActive === false || pharmacy.deleted || pharmacy.archived || pharmacy.archivedAt
        || ['inactive', 'disabled', 'deleted', 'removed'].includes(String(pharmacy.status || 'Active').toLowerCase())) return false;
    }
    const user = findUser(role, id);
    // Existing pharmacies may have no linked account. Their explicit license date still applies.
    if (!user && role === 'pharmacy') {
      const pharmacy = data()?.get('pharmacies', id);
      if (!pharmacy) return false;
      if (data().list('users').some(item => String(item.pharmacyId || '') === String(id))) return false;
      const expiry = String(pharmacy.licenseExpiry || '').trim();
      return pharmacy.IsActive !== false && pharmacy.isActive !== false && !pharmacy.archived && !pharmacy.archivedAt
        && !['inactive', 'disabled', 'deleted', 'removed'].includes(String(pharmacy.status || 'Active').toLowerCase())
        && (!expiry || validDate(expiry) && expiry >= today());
    }
    return licenseState(user, role).canProvideServices === true;
  }
  function notify(role, recipientId, title, message, recordId) {
    const prefix = role === 'admin' ? 'Admin/index.html' : role === 'doctor' ? 'Doctor/index.html' : role === 'nurse' ? 'Nurse/index.html' : 'Pharmacy/dashboard.html';
    data().create('notifications', { recipientRole: role, recipientId: String(recipientId), category: 'professional', title, message,
      recordType: 'licenseRenewal', recordId, createdAt: new Date().toISOString(), readAt: '', deletedAt: '',
      link: new URL(`../${prefix}${role === 'admin' ? '#license-renewals' : ''}`, document.currentScript?.src || window.CarePlusLicenses.baseUrl).href });
  }
  function submitRenewal(role, values) {
    const account = currentProfessional(role);
    const user = account && data().get('users', account.id);
    if (!user || String(user.role).toLowerCase() !== role) return { ok: false, error: 'Sign in with the matching professional account.' };
    const state = licenseState(user, role);
    if (state.pending) return { ok: false, error: 'A renewal is already awaiting Admin review.' };
    const number = String(values.licenseNumber || '').trim();
    const expiry = String(values.licenseExpiry || '').trim();
    if (!number || number.length > 100) return { ok: false, error: 'Enter your license number (up to 100 characters).' };
    if (!values.noExpiry && (!validDate(expiry) || expiry < today())) return { ok: false, error: 'Choose a valid current or future expiration date, or select no expiration date.' };
    if (!values.document?.id || !values.document.name) return { ok: false, error: 'Upload the renewed license.' };
    const record = data().create('licenseRenewals', { userId: user.id, role, licenseNumber: number, licenseExpiry: values.noExpiry ? '' : expiry,
      noExpiry: Boolean(values.noExpiry), document: values.document, status: 'Pending', submittedAt: new Date().toISOString(), reviewReason: '', reviewedAt: '', reviewedBy: '' });
    if (!record) return { ok: false, error: 'Unable to save the renewal request. Please try again.' };
    notify('admin', '*', 'License renewal awaiting review', `${user.name || role} submitted a ${role} license renewal.`, record.id);
    return { ok: true, renewal: record };
  }
  function reviewRenewal(id, decision, reason = '') {
    if (!window.CarePlusAuth?.hasDemoAdminSession()) return { ok: false, error: 'Administrator access required.' };
    const renewal = data().get('licenseRenewals', id);
    if (!renewal || renewal.status !== 'Pending') return { ok: false, error: 'This renewal is no longer pending.' };
    if (!['approve', 'reject'].includes(decision)) return { ok: false, error: 'Choose a valid review action.' };
    if (decision === 'reject' && !String(reason).trim()) return { ok: false, error: 'Enter a rejection reason.' };
    if (decision === 'approve' && renewal.licenseExpiry && (!validDate(renewal.licenseExpiry) || renewal.licenseExpiry < today())) return { ok: false, error: 'This renewed license has already expired. Reject it and request a current document.' };
    if (decision === 'approve' && (!renewal.document?.id || (!renewal.noExpiry && !renewal.licenseExpiry))) return { ok: false, error: 'This renewal is missing its license document or expiration information.' };
    const user = data().get('users', renewal.userId);
    if (!user || String(user.role).toLowerCase() !== renewal.role) return { ok: false, error: 'The professional account is unavailable.' };
    const now = new Date().toISOString();
    const reviewer = sessionStorage.getItem('careplusDemoIdentity') || localStorage.getItem('careplusDemoIdentity') || 'Admin';
    const approvedLicense = decision === 'approve' ? {
      number: renewal.licenseNumber, expiresOn: renewal.licenseExpiry, document: renewal.document,
      approvedAt: now, approvedBy: reviewer, sourceRenewalId: renewal.id
    } : null;
    const saved = data().reviewLicenseRenewal(id, { status: decision === 'approve' ? 'Approved' : 'Rejected', reviewReason: String(reason).trim(), reviewedAt: now, reviewedBy: reviewer }, approvedLicense);
    if (!saved) return { ok: false, error: 'The review could not be saved. Please retry.' };
    notify(renewal.role, user[`${renewal.role}Id`] || user.id, `License renewal ${saved.status.toLowerCase()}`,
      decision === 'approve' ? 'Your renewed license was approved. Service access follows your account activation and verification status.' : `Your license renewal was rejected. ${String(reason).trim()}`, id);
    return { ok: true, renewal: saved };
  }
  window.CarePlusLicenses = { today, validDate, findUser, licenseState, canProvide, submitRenewal, reviewRenewal, currentProfessional,
    baseUrl: document.currentScript?.src || new URL('shared/professional-licenses.js', location.href).href };
  let lastDay = today();
  function refreshDate() {
    const day = today();
    if (day === lastDay) return;
    lastDay = day;
    window.dispatchEvent(new CustomEvent('careplus:license-policy'));
  }
  setInterval(refreshDate, 60000);
  window.addEventListener('focus', refreshDate);
  // API-shaped methods above can be replaced with backend requests without changing dashboard UI.
})();
