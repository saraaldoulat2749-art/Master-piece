(() => {
  const form = document.getElementById('doctor-form');
  const statusBox = document.getElementById('app-status');
  const errorBox = document.getElementById('form-error');
  const yearSelect = document.getElementById('graduation-year');
  const specialization = form.elements.namedItem('specialization');
  const certInput = form.elements.namedItem('specialtyCertificate');
  const id = sessionStorage.getItem('careplusDemoAccountIdV1');
  const account = window.CarePlusAuth?.hasDemoSession()
    ? window.CarePlusData?.list('users').find(user => String(user.id) === id)
    : null;

  if (!account || account.selectedRole !== 'doctor') {
    location.replace('../log%20in/login.html');
    return;
  }

  let application = window.CarePlusData.list('professionalApplications')
    .find(item => String(item.userId) === String(account.id) && item.role === 'doctor') || null;

  for (let year = new Date().getFullYear(); year >= 1950; year -= 1) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.append(option);
  }

  if (application?.graduationYear) yearSelect.value = application.graduationYear;
  for (const name of ['specialization', 'university', 'licenseNumber', 'licenseExpiry']) {
    if (application?.[name] != null) form.elements.namedItem(name).value = application[name];
  }

  document.querySelectorAll('input[type="file"]').forEach(input => setupUpload(input));
  specialization.addEventListener('change', updateSpecialtyRequirement);
  updateSpecialtyRequirement();
  form.addEventListener('submit', event => {
    event.preventDefault();
    save(false);
  });

  if (application?.status === 'Approved' && account.role === 'Doctor') {
    showStatus('Approved', 'Your doctor account is approved. You may now open the doctor dashboard.');
    form.hidden = true;
    addDashboardLink();
  } else if (application?.status === 'Pending Verification' || application?.status === 'Additional Documents Required') {
    const request = application.reviewReason || account.additionalDocumentsReason;
    showStatus(application.status, request ? `Administrator request: ${request}` : 'Your application is under administrator review. Doctor features remain locked until approval.');
  } else if (application?.status === 'Rejected') {
    showStatus('Rejected', `Please update your application and resubmit. Reason: ${application.reviewReason || account.rejectionReason || 'No reason was provided.'}`);
  } else if (application?.status === 'Draft') {
    showStatus('Draft', 'Your saved draft is ready to complete and submit.');
  }

  async function setupUpload(input) {
    const card = input.closest('.drop-area');
    const name = card.querySelector('.file-name');
    const remove = card.querySelector('.remove-file');
    const stored = application?.documents?.[input.name];
    if (stored?.id) {
      input.required = false;
      name.textContent = stored.name;
      remove.hidden = false;
    }
    input.addEventListener('change', () => {
      const file = input.files[0];
      name.textContent = file?.name || (stored?.id ? stored.name : '');
      remove.hidden = !file && !stored?.id;
      input.dataset.removed = 'false';
      validateFile(input, file);
    });
    remove.addEventListener('click', async () => {
      if (stored?.id) {
        await window.CarePlusDoctorDocuments.remove(stored.id);
        input.dataset.removed = 'true';
        input.required = input.name === 'specialtyCertificate'
          ? Boolean(specialization.value && specialization.value !== 'General Practitioner')
          : true;
      }
      input.value = '';
      name.textContent = '';
      remove.hidden = true;
    });
    card.addEventListener('dragover', event => { event.preventDefault(); card.classList.add('dragging'); });
    card.addEventListener('dragleave', () => card.classList.remove('dragging'));
    card.addEventListener('drop', event => {
      event.preventDefault();
      card.classList.remove('dragging');
      const file = event.dataTransfer.files[0];
      if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function validateFile(input, file) {
    if (!file) return true;
    const extension = file.name.split('.').pop().toLowerCase();
    const valid = ['pdf', 'png', 'jpg', 'jpeg'].includes(extension)
      && ['application/pdf', 'image/png', 'image/jpeg', ''].includes(file.type)
      && file.size <= 10 * 1024 * 1024;
    input.setCustomValidity(valid ? '' : 'Choose a PDF, PNG, or JPG file up to 10 MB.');
    if (!valid) input.reportValidity();
    return valid;
  }

  function updateSpecialtyRequirement() {
    const isSpecialist = Boolean(specialization.value) && specialization.value !== 'General Practitioner';
    certInput.required = isSpecialist && !application?.documents?.specialtyCertificate?.id;
    document.getElementById('specialty-document').classList.toggle('is-required', isSpecialist);
  }

  async function save(draft) {
    errorBox.hidden = true;
    if (!draft && !form.reportValidity()) {
      errorBox.textContent = 'Complete the required fields, attach the required documents, and confirm the information before submitting.';
      errorBox.hidden = false;
      form.querySelector(':invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const data = {
      name: account.name,
      email: account.email,
      phone: account.phone || '',
      specialization: specialization.value,
      university: form.elements.namedItem('university').value.trim(),
      graduationYear: yearSelect.value,
      licenseNumber: form.elements.namedItem('licenseNumber').value.trim(),
      licenseExpiry: form.elements.namedItem('licenseExpiry').value,
      confirmation: form.elements.namedItem('confirmation').checked,
      documents: { ...(application?.documents || {}) }
    };
    try {
      for (const input of form.querySelectorAll('input[type="file"]')) {
        const file = input.files[0];
        if (file) {
          if (!validateFile(input, file)) return;
          data.documents[input.name] = await window.CarePlusDoctorDocuments.put(`${account.id}:${input.name}`, file);
        } else if (input.dataset.removed === 'true') {
          delete data.documents[input.name];
        }
      }
      const result = window.CarePlusAuth.submitDoctorApplication(data, draft);
      if (!result.ok) throw new Error(result.error);
      application = result.application;
      showStatus(draft ? 'Draft' : 'Pending Verification', draft
        ? 'Your draft was saved. You can return to complete it later.'
        : 'Your application has been submitted. An administrator must approve it before you can use doctor features.');
      window.CarePlusFormFeedback?.showSuccess(draft ? 'Draft saved' : 'Application sent', draft
        ? 'Your doctor application draft was saved successfully.'
        : 'Your doctor application was sent successfully. Doctor features will be available after administrator approval.',
      draft ? undefined : () => {
        window.CarePlusAuth?.endDemoSession();
        window.location.assign('../Home/Master.html');
      });
    } catch (error) {
      errorBox.textContent = error.message || 'Could not save your application.';
      errorBox.hidden = false;
    }
  }

  function showStatus(status, message) {
    statusBox.hidden = false;
    statusBox.className = `status status-${status.toLowerCase().replaceAll(' ', '-')}`;
    statusBox.innerHTML = `<strong>${escapeHtml(status)}</strong><span>${escapeHtml(message)}</span>`;
  }

  function addDashboardLink() {
    const link = document.createElement('a');
    link.href = '../Doctor/index.html';
    link.className = 'dashboard-link';
    link.textContent = 'Open doctor dashboard';
    statusBox.append(link);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
})();
