(() => {
  const data = window.CarePlusData;
  const auth = window.CarePlusAuth;
  const store = window.CarePlusDoctorDocuments;
  const profile = document.getElementById('profileForm');
  const role = document.body.hasAttribute('data-pharmacy-protected') ? 'pharmacy'
    : document.body.hasAttribute('data-nurse-protected') ? 'nurse' : 'doctor';
  const account = auth?.[{ doctor: 'demoDoctorAccount', nurse: 'demoNurseAccount', pharmacy: 'demoPharmacyAccount' }[role]]?.();
  if (!profile || !account || !data || !store) return;
  if (role === 'doctor' || role === 'nurse') {
    const heading = document.createElement('div');
    heading.className = 'doctor-profile-heading';
    heading.innerHTML = role === 'doctor'
      ? '<span class="profile-documents-eyebrow">DOCTOR PROFILE</span><h2>Professional details</h2><p>Manage your qualifications, clinic and contact information.</p>'
      : '<span class="profile-documents-eyebrow">NURSE PROFILE</span><h2>Personal &amp; professional details</h2><p>Keep your contact information and working hours up to date.</p>';
    profile.prepend(heading);
    const fieldGrid = profile.querySelector('.form-grid');
    if (fieldGrid && role === 'doctor') {
      const groups = [
        ['Professional information', ['name', 'specialty', 'qualifications', 'experience', 'license', 'workplace']],
        ['Contact information', ['email', 'phone']],
        ['Consultation', ['fee']]
      ];
      for (const [title, names] of groups) {
        const first = fieldGrid.querySelector(`[name="${names[0]}"]`)?.closest('label');
        if (!first) continue;
        const groupHeading = document.createElement('h3');
        groupHeading.className = 'doctor-profile-group-title';
        groupHeading.textContent = title;
        first.before(groupHeading);
      }
    }
  }
  const fields = {
    doctor: [['universityDegree', 'University Degree', true], ['practiceLicense', 'Medical Practice License', true], ['specialtyCertificate', 'Specialization Certificate', 'specialist'], ['proofOfIdentity', 'Proof of Identity', true]],
    nurse: [['nursingDegree', 'Nursing Degree', true], ['practiceLicense', 'Nursing Practice License', true], ['proofOfIdentity', 'Proof of Identity', true], ['additionalCertificate', 'Additional Certificate', false]],
    pharmacy: [['pharmacyLicense', 'Pharmacy Operating License', true], ['pharmacistLicense', 'Responsible Pharmacist License', true], ['proofOfIdentity', 'Owner / Responsible Person ID', true], ['commercialRegistration', 'Commercial Registration', false]]
  }[role];
  const application = () => data.list('professionalApplications').find(item => String(item.userId) === String(account.id) && item.role === role);
  const documents = () => {
    const user = data.get('users', account.id);
    const saved = { ...(application()?.documents || user?.professionalDocuments || {}) };
    if (user?.professionalLicense?.document) saved[role === 'pharmacy' ? 'pharmacyLicense' : 'practiceLicense'] = user.professionalLicense.document;
    return saved;
  };
  const form = document.createElement('form');
  form.className = 'panel profile-documents';
  form.innerHTML = '<div class="profile-documents-heading"><div><span class="profile-documents-eyebrow">PROFESSIONAL CREDENTIALS</span><h2>Certificates &amp; documents</h2><p>Keep your licenses and qualifications up to date.</p></div></div><div class="profile-document-grid"></div><div class="profile-documents-footer"><p role="status" aria-live="polite" class="profile-document-status">Choose a file, then save your documents.</p><button type="submit" class="primary-button button primary">Save documents</button></div>';
  const layout = document.createElement('div');
  layout.className = 'profile-details-layout';
  profile.before(layout);
  layout.append(profile, form);
  const finance = profile.querySelector('.fee-breakdown');
  if (finance) {
    const financePanel = document.createElement('div');
    financePanel.className = 'profile-form profile-finance-panel';
    financePanel.append(finance);
    layout.append(financePanel);
  }
  const grid = form.querySelector('.profile-document-grid');
  const status = form.querySelector('[role="status"]');
  const button = form.querySelector('[type="submit"]');
  const rows = fields.map(([key, title, required]) => {
    const row = document.createElement('div');
    row.className = 'profile-document-row';
    const label = document.createElement('label');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const note = document.createElement('small');
    note.textContent = required === 'specialist' ? 'Required for specialist doctors' : required ? 'Required' : 'Optional';
    const input = document.createElement('input');
    input.type = 'file'; input.name = key;
    input.accept = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
    const upload = document.createElement('span');
    upload.className = 'profile-document-upload';
    upload.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg><span>Choose document<small>Click to browse your files</small></span>';
    upload.append(input);
    label.append(heading, note, upload);
    if (key === (role === 'pharmacy' ? 'pharmacyLicense' : 'practiceLicense')) {
      input.disabled = true;
      upload.remove();
      note.textContent = 'License changes require Admin approval.';
      const renew = document.createElement('button');
      renew.type = 'button'; renew.textContent = 'Renew License';
      renew.dataset.profileRenewLicense = '';
      renew.addEventListener('click', () => document.dispatchEvent(new CustomEvent('careplus:renew-license')));
      label.append(renew);
      const licenseStatus = document.createElement('small');
      licenseStatus.dataset.profileLicenseStatus = '';
      licenseStatus.setAttribute('role', 'status');
      label.append(licenseStatus);
    }
    const current = document.createElement('span');
    current.className = 'profile-document-current';
    const view = document.createElement('button');
    view.type = 'button'; view.textContent = 'View document';
    input.addEventListener('change', () => {
      const file = input.files[0];
      row.classList.toggle('is-selected', Boolean(file));
      current.textContent = file ? `Ready to save: ${file.name}` : documents()[key]?.name || 'No document uploaded';
      status.textContent = file ? 'You have unsaved documents. Save to upload your changes.' : 'Choose a file, then save your documents.';
    });
    view.addEventListener('click', async () => {
      try {
        const saved = await store.get(documents()[key]?.id);
        if (!saved?.blob) throw new Error('This file is unavailable in this browser. Please upload it again.');
        const url = URL.createObjectURL(saved.blob);
        const link = document.createElement('a');
        link.href = url; link.target = '_blank'; link.rel = 'noopener';
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) { status.textContent = error.message; }
    });
    row.append(label, current, view); grid.append(row);
    return { key, required: input.disabled ? false : required, input, current, view, row };
  });
  function refresh() {
    const saved = documents();
    for (const row of rows) {
      row.current.textContent = saved[row.key]?.name || 'No document uploaded';
      row.view.hidden = !saved[row.key]?.id;
      row.row.classList.remove('is-selected');
      row.row.classList.toggle('has-document', Boolean(saved[row.key]?.id));
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); status.textContent = '';
    const saved = documents();
    const selected = rows.filter(row => row.input.files.length);
    for (const row of rows) {
      const file = row.input.files[0];
      const specialty = application()?.specialization || profile.elements.namedItem('specialty')?.value;
      const required = row.required === 'specialist' ? Boolean(specialty && specialty !== 'General Practitioner') : row.required;
      if (required && !file && !saved[row.key]?.id) {
        status.textContent = 'Please upload all required documents.'; row.input.focus(); return;
      }
      if (file && (!/\.(pdf|png|jpe?g)$/i.test(file.name) || !['application/pdf', 'image/png', 'image/jpeg', ''].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size)) {
        status.textContent = 'Choose a non-empty PDF, PNG, or JPG file up to 10 MB.'; row.input.focus(); return;
      }
    }
    if (!selected.length) { status.textContent = 'Choose a document to upload or replace.'; return; }
    button.disabled = true;
    const uploaded = [];
    try {
      for (const row of selected) {
        const id = `${account.id}:${row.key}:${crypto.randomUUID()}`;
        uploaded.push(await store.put(id, row.input.files[0]));
      }
      const latest = application();
      const changes = { ...(latest?.documents || documents()) };
      selected.forEach((row, index) => { changes[row.key] = uploaded[index]; });
      const result = latest
        ? data.update('professionalApplications', latest.id, { documents: changes, documentsUpdatedAt: new Date().toISOString() })
        : data.update('users', account.id, { professionalDocuments: changes });
      if (!result) throw new Error('Documents could not be saved. Please try again.');
      form.reset(); refresh(); status.textContent = 'Documents saved successfully.';
    } catch (error) {
      await Promise.allSettled(uploaded.map(file => store.remove(file.id)));
      status.textContent = error.message || 'Upload failed. Please try again.';
    } finally { button.disabled = false; }
  });
  refresh();
})();
