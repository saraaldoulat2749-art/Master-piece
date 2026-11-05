(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'nurse-picker-dialog';
  dialog.setAttribute('aria-labelledby', 'nurse-picker-title');
  dialog.innerHTML = '<div class="nurse-picker-heading"><div><span>YOUR CARE TEAM</span><h2 id="nurse-picker-title">Choose your nurse</h2><p>Review a nurse’s experience and availability before sending your request. Payment is available after acceptance.</p></div><button type="button" data-close aria-label="Close nurse selection">×</button></div><form><div class="nurse-picker-list"></div><p class="nurse-picker-message" role="status"></p><div class="nurse-picker-actions"><button type="button" data-close>Cancel</button><button type="submit">Send care request</button></div></form>';
  document.body.append(dialog);
  let resolveSelection;
  let candidates = [];
  const list = dialog.querySelector('.nurse-picker-list');
  const message = dialog.querySelector('[role="status"]');
  function nurses() {
    const data = window.CarePlusData;
    return (data?.list('users') || []).filter(user => {
      if (String(user.role).toLowerCase() !== 'nurse') return false;
      if (['inactive', 'suspended', 'blocked', 'rejected', 'pending', 'draft'].includes(String(user.accountStatus || user.status).toLowerCase())) return false;
      const application = data.list('professionalApplications').find(item => item.role === 'nurse' && String(item.userId) === String(user.id));
      return application ? application.status === 'Approved' : !user.verificationStatus || user.verificationStatus === 'Approved';
    }).map(user => {
      let profile = {};
      try { profile = JSON.parse(localStorage.getItem(`carePlusNurseProfileV1:${user.nurseId || user.id}`) || '{}'); } catch {}
      return { ...user, ...profile, id: user.id, nurseId: String(user.nurseId || user.id) };
    });
  }
  function finish(value) { dialog.close(); const resolve = resolveSelection; resolveSelection = null; resolve?.(value); }
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => finish(null)));
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get('nurse');
    const nurse = nurses().find(item => item.nurseId === id);
    if (!nurse) { message.textContent = 'Select an available nurse to continue.'; return; }
    finish(nurse);
  });
  window.CarePlusNursePicker = { open() {
    if (resolveSelection) return Promise.resolve(null);
    candidates = nurses(); list.replaceChildren(); message.textContent = '';
    candidates.forEach(nurse => {
      const label = document.createElement('label'); label.className = 'nurse-picker-card';
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'nurse'; radio.value = nurse.nurseId; radio.required = true;
      const avatar = document.createElement('span'); avatar.className = 'nurse-picker-avatar'; avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = String(nurse.name || 'Nurse').split(/\s+/).slice(0, 2).map(word => word[0]).join('');
      const details = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = nurse.name || 'CarePlus nurse'; details.append(name);
      [nurse.specialty || 'Nursing care', nurse.experience ? `${nurse.experience} years of experience` : 'Experience not provided', nurse.availability || 'Working hours to be confirmed', nurse.serviceAreas || nurse.city || 'Service area to be confirmed'].forEach(text => {
        const line = document.createElement('span'); line.textContent = text; details.append(line);
      });
      label.append(radio, avatar, details); list.append(label);
    });
    if (!candidates.length) message.textContent = 'No approved nurses are available yet. Please try again later.';
    dialog.querySelector('[type="submit"]').disabled = !candidates.length;
    return new Promise(resolve => { resolveSelection = resolve; dialog.showModal(); });
  } };
})();
