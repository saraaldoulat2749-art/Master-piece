(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'nurse-picker-dialog';
  dialog.setAttribute('aria-labelledby', 'nurse-picker-title');
  dialog.innerHTML = '<div class="nurse-picker-heading"><div><span>YOUR CARE TEAM</span><h2 id="nurse-picker-title">Choose your nurse</h2><p>Review a nurse’s experience and availability before sending your request. Payment is available after acceptance.</p></div><button type="button" data-close aria-label="Close nurse selection">×</button></div><form><div class="nurse-picker-list"></div><p class="nurse-picker-message" role="status"></p><div class="nurse-picker-actions"><button type="button" data-close>Cancel</button><button type="submit">Send care request</button></div></form>';
  document.body.append(dialog);
  let resolveSelection;
  let candidates = [];
  let visit = null;
  let context = {};
  const form = dialog.querySelector('form');
  const layout = document.createElement('div'); layout.className = 'nurse-picker-layout';
  const results = document.createElement('section');
  const toolbar = document.createElement('div'); toolbar.className = 'nurse-picker-toolbar';
  toolbar.innerHTML = '<span data-count></span><label>Sort by <select><option value="match">Best match</option><option value="experience">Experience</option><option value="name">Name</option></select></label>';
  dialog.querySelector('.nurse-picker-heading p').textContent = 'Pick a nurse for your care visit. The request is sent to the nurse, and the deposit is due after they accept.';
  dialog.querySelector('.nurse-picker-heading button').textContent = '×';
  results.append(toolbar, form.querySelector('.nurse-picker-list'), form.querySelector('.nurse-picker-message'));
  results.append(form.querySelector('.nurse-picker-actions')); layout.append(results); form.append(layout);
  function updateSummary() {
    const nurse = candidates.find(item => item.nurseId === dialog.querySelector('input[name="nurse"]:checked')?.value);
    const submit = form.querySelector('[type="submit"]'); submit.disabled = !nurse;
    submit.textContent = nurse ? 'Send request to ' + nurse.name.split(/\s+/)[0] + ' →' : 'Choose a nurse';
  }
  toolbar.querySelector('select').addEventListener('change', () => renderCandidates());
  form.addEventListener('change', event => { if (event.target.name === 'nurse') updateSummary(); });
  const list = dialog.querySelector('.nurse-picker-list');
  const message = dialog.querySelector('[role="status"]');
  function eligibleNurses() {
    const data = window.CarePlusData;
    return (data?.list('users') || []).filter(user => {
      if (String(user.role).toLowerCase() !== 'nurse') return false;
      if (window.CarePlusLicenses?.licenseState) {
        const state = window.CarePlusLicenses.licenseState(user, 'nurse');
        return state.active && state.code !== 'unverified' && state.code !== 'unavailable';
      }
      if (user.isActive === false || user.IsActive === false || user.archived || user.archivedAt) return false;
      if (['inactive', 'suspended', 'blocked', 'rejected', 'pending', 'draft'].includes(String(user.accountStatus || user.status).toLowerCase())) return false;
      const application = data.list('professionalApplications').find(item => item.role === 'nurse' && String(item.userId) === String(user.id));
      return (!application || String(application.status).toLowerCase() === 'approved')
        && [user.approvalStatus, user.verificationStatus].every(status => !status || ['approved', 'verified'].includes(String(status).toLowerCase()));
    });
  }
  function nurses() {
    return eligibleNurses().map(user => {
      let profile = {};
      try { profile = JSON.parse(localStorage.getItem(`carePlusNurseProfileV1:${user.nurseId || user.id}`) || '{}'); } catch {}
      const workSchedule = window.CarePlusNurseAvailability?.scheduleFor(user);
      const result = visit && window.CarePlusNurseAvailability?.check(user.nurseId || user.id, visit);
      return { ...user, ...profile, name: String(user.name || profile.name || user.fullName || '').trim() || 'CarePlus nurse', id: user.id, nurseId: String(user.nurseId || user.id), available: result?.ok === true, unavailableReason: result?.reason || 'Availability could not be verified. Please refresh and try again.', availability: workSchedule ? window.CarePlusNurseAvailability.describe(workSchedule) : profile.availability || user.availability };
    }).sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));
  }
  function finish(value) { dialog.close(); const resolve = resolveSelection; resolveSelection = null; resolve?.(value); }
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => finish(null)));
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get('nurse');
    const nurse = nurses().find(item => item.nurseId === id && item.available);
    if (!nurse) { renderCandidates(); message.textContent = 'This nurse is no longer available for the selected time. Please choose another nurse.'; return; }
    finish({ ...nurse, selectedVisit: { ...visit } });
  });
  function renderAlternativeSlots(nurse) {
    const slots = window.CarePlusNurseAvailability?.nextSlots(nurse.nurseId, visit) || [];
    slots.forEach(slot => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nurse-picker-slot';
      button.textContent = nurse.name + ' — ' + slot.date + ' at ' + slot.time + ' · ' + slot.duration + ' hours (Jordan time)';
      button.addEventListener('click', () => {
        const result = window.CarePlusNurseAvailability.check(nurse.nurseId, slot);
        if (!result.ok) { renderCandidates(); message.prepend(document.createTextNode('That time is no longer available. ')); return; }
        visit = { ...slot };
        renderCandidates(nurse.nurseId);
        message.textContent = 'Selected visit: ' + visit.date + ' at ' + visit.time + ' (Jordan time), ' + visit.duration + ' hours. Confirm to send your request.';
      });
      list.append(button);
    });
    if (!slots.length) {
      const note = document.createElement('p');
      note.className = 'nurse-picker-message';
      note.textContent = window.CarePlusLicenses && !window.CarePlusLicenses.canProvide('nurse', nurse.nurseId)
        ? 'Booking will become available after the account or license issue above is resolved.'
        : 'No published available times for ' + nurse.name + ' in the next 30 days.';
      list.append(note);
    }
  }
  function renderCandidates(preselected) {
    const selected = preselected || dialog.querySelector('input[name="nurse"]:checked')?.value;
    candidates = nurses().filter(nurse => nurse.available);
    const sort = toolbar.querySelector('select').value;
    if (sort === 'experience') candidates.sort((a, b) => Number(b.available) - Number(a.available) || (parseFloat(b.experience) || 0) - (parseFloat(a.experience) || 0));
    if (sort === 'name') candidates.sort((a, b) => a.name.localeCompare(b.name));
    const selectedId = candidates.some(nurse => nurse.nurseId === selected) ? selected : candidates[0]?.nurseId;
    list.replaceChildren(); message.textContent = '';
    candidates.forEach(nurse => {
      const label = document.createElement('label'); label.className = 'nurse-picker-card';
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'nurse'; radio.value = nurse.nurseId; radio.required = true;
      radio.disabled = !nurse.available;
      radio.checked = nurse.available && nurse.nurseId === selectedId;
      const avatar = document.createElement('span'); avatar.className = 'nurse-picker-avatar'; avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = String(nurse.name || 'Nurse').split(/\s+/).slice(0, 2).map(word => word[0]).join('');
      const details = document.createElement('div'); details.className = 'nurse-picker-details';
      const name = document.createElement('strong'); name.textContent = nurse.name || 'CarePlus nurse'; details.append(name);
      const meta = document.createElement('span'); meta.className = 'nurse-picker-meta';
      const rating = Number(nurse.rating);
      const experience = nurse.experience ? `${nurse.experience} years experience` : '';
      meta.textContent = [rating > 0 && rating <= 5 ? `★ ${rating.toFixed(1)}` : '', experience].filter(Boolean).join(' · ');
      if (meta.textContent) details.append(meta);
      const tags = document.createElement('div'); tags.className = 'nurse-picker-specialties';
      const specialties = Array.isArray(nurse.specialty) ? nurse.specialty : String(nurse.specialty || 'Nursing care').split(/[,;|]/);
      specialties.filter(Boolean).forEach(text => { const tag = document.createElement('span'); tag.textContent = String(text).trim(); tags.append(tag); });
      details.append(tags);
      const available = document.createElement('span'); available.className = nurse.available ? 'nurse-picker-available' : 'nurse-picker-unavailable';
      available.textContent = nurse.available ? '● Available at your time' : 'Unavailable at your time';
      if (!nurse.available) label.title = nurse.unavailableReason;
      details.append(available);
      label.append(radio, avatar, details); list.append(label);
    });
    const availableCount = candidates.filter(nurse => nurse.available).length;
    if (!availableCount) message.textContent = 'No nurses are available for this visit. Please change the date or time in your request.';
    toolbar.querySelector('[data-count]').textContent = availableCount + ' nurses available for your request' + (context.city ? ' in ' + context.city : '');
    updateSummary();
  }
  window.CarePlusData?.subscribe(() => { if (dialog.open) renderCandidates(); });
  window.CarePlusNursePicker = { open(request, requestContext = {}) {
    if (resolveSelection) return Promise.resolve(null);
    visit = request;
    context = requestContext;
    renderCandidates();
    return new Promise(resolve => { resolveSelection = resolve; dialog.showModal(); });
  } };
})();
