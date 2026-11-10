(() => {
  function init() {
    const api = window.CarePlusLicenses;
    const data = window.CarePlusData;
    if (!api || !data) return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const host = document.querySelector('.page-content') || document.querySelector('main .content');
    if (!host) return;
    const isAdmin = window.CarePlusAuth?.hasDemoAdminSession();
    const role = ['doctor', 'nurse', 'pharmacy'].find(role => document.body.hasAttribute(`data-${role}-protected`));
    if (!isAdmin && !role) return;
    async function viewDocument(metadata) {
      const saved = metadata?.id && await window.CarePlusDoctorDocuments?.get(metadata.id);
      if (!saved?.blob) throw new Error('This document is unavailable in this browser. Ask the professional to upload it again.');
      const url = URL.createObjectURL(saved.blob);
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    if (role && !isAdmin) {
      const account = api.currentProfessional(role);
      if (!account) return;
      const panel = document.createElement('section'); panel.className = 'panel license-status-panel'; panel.setAttribute('aria-label', 'Professional license');
      const dialog = document.createElement('dialog'); dialog.className = 'record-dialog license-renewal-dialog';
      dialog.setAttribute('aria-labelledby', 'license-renewal-title');
      dialog.innerHTML = '<form><div class="dialog-heading"><div><p class="eyebrow">PROFESSIONAL VERIFICATION</p><h2 id="license-renewal-title">Renew License</h2></div><button class="icon-button" type="button" data-license-close aria-label="Close">&times;</button></div><p class="license-help">Upload your renewed license for Admin review. Your current approved license stays in effect until it expires.</p><div class="form-fields"><label class="field-label is-wide">Practice / operating license number<input name="licenseNumber" required maxlength="100"></label><label class="field-label is-wide">License expiration date<input name="licenseExpiry" type="date"></label><label class="license-no-expiry"><input type="checkbox" name="noExpiry"> This license has no expiration date</label><label class="field-label is-wide">Renewed license<input name="licenseFile" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required><small>PDF, PNG or JPG, up to 10 MB.</small></label></div><p class="form-feedback" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-license-close>Cancel</button><button type="submit" class="primary-button">Submit for Admin review</button></div></form>';
      document.body.append(dialog);
      const form = dialog.querySelector('form');
      const feedback = dialog.querySelector('[role="status"]');
      const submit = form.querySelector('[type="submit"]');
      let uploading = false;
      function render() {
        const user = data.get('users', account.id);
        const state = api.licenseState(user, role);
        const warning = !state.valid;
        const profileStatus = document.querySelector('[data-profile-license-status]');
        const profileRenew = document.querySelector('[data-profile-renew-license]');
        if (profileRenew) profileRenew.disabled = Boolean(state.pending);
        if (profileStatus) profileStatus.textContent = state.pending
          ? 'Renewal submitted — awaiting Admin review.'
          : state.latest?.status === 'Rejected' ? `Renewal rejected: ${state.latest.reviewReason}. You can submit a corrected license.` : state.message;
        panel.dataset.licenseState = warning ? 'expired' : 'valid';
        panel.innerHTML = `<div><p class="eyebrow">PROFESSIONAL LICENSE</p><h2>${warning ? 'License renewal required' : 'License status'}</h2><p>${esc(state.message)}</p>${!state.active ? '<p>Account activation is managed separately by Admin.</p>' : ''}${state.pending ? '<p class="license-review-note">Renewal awaiting Admin review. An expired license remains restricted until approval.</p>' : state.latest?.status === 'Rejected' ? `<p class="license-review-note">Renewal rejected: ${esc(state.latest.reviewReason)}. You can submit a corrected renewal.</p>` : ''}</div><button type="button" class="primary-button" data-renew-license ${state.pending ? 'disabled' : ''}>${state.pending ? 'Renewal pending review' : 'Renew License'}</button>`;
      }
      function openRenewal() {
        const state = api.licenseState(data.get('users', account.id), role);
        if (state.pending) return;
        form.reset(); feedback.textContent = '';
        form.elements.licenseNumber.value = state.number;
        form.elements.licenseExpiry.value = state.expiresOn;
        form.elements.licenseExpiry.min = api.today();
        form.elements.licenseExpiry.disabled = false;
        form.elements.licenseExpiry.required = true;
        dialog.showModal();
      }
      panel.addEventListener('click', event => { if (event.target.closest('[data-renew-license]')) openRenewal(); });
      document.addEventListener('careplus:renew-license', openRenewal);
      dialog.querySelectorAll('[data-license-close]').forEach(button => button.addEventListener('click', () => { if (!uploading) dialog.close(); }));
      dialog.addEventListener('cancel', event => { if (uploading) event.preventDefault(); });
      form.elements.noExpiry.addEventListener('change', () => {
        form.elements.licenseExpiry.disabled = form.elements.noExpiry.checked;
        form.elements.licenseExpiry.required = !form.elements.noExpiry.checked;
      });
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (uploading || !form.reportValidity()) return;
        const file = form.elements.licenseFile.files[0];
        if (!file || !/\.(pdf|png|jpe?g)$/i.test(file.name) || !['application/pdf', 'image/png', 'image/jpeg', ''].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
          feedback.textContent = 'Choose a PDF, PNG or JPG file up to 10 MB.'; return;
        }
        uploading = true; submit.disabled = true; feedback.textContent = 'Saving your renewal…';
        let metadata;
        try {
          metadata = await window.CarePlusDoctorDocuments.put(`license-renewal:${account.id}:${crypto.randomUUID()}`, file);
          const result = api.submitRenewal(role, { licenseNumber: form.elements.licenseNumber.value, licenseExpiry: form.elements.licenseExpiry.value, noExpiry: form.elements.noExpiry.checked, document: metadata });
          if (!result.ok) throw new Error(result.error);
          dialog.close(); render();
        } catch (error) {
          if (metadata) await window.CarePlusDoctorDocuments.remove(metadata.id).catch(() => {});
          feedback.textContent = error.message || 'The renewal could not be saved. Please try again.';
        } finally { uploading = false; submit.disabled = false; }
      });
      data.subscribe(render); setInterval(render, 60000); render();
      return;
    }
    if (!document.body.hasAttribute('data-license-renewals-dashboard')) return;
    const filterRole = '';
    const panel = document.createElement('section'); panel.className = 'panel license-admin-panel';
    panel.id = 'license-renewals';
    panel.innerHTML = '<div class="panel-heading"><div><p class="eyebrow">PROFESSIONAL COMPLIANCE</p><h2>License renewals</h2><p>Review renewed licenses before restoring service eligibility.</p></div><label class="license-review-filter">Show<select aria-label="Filter license renewals"><option value="Pending">Pending review</option><option value="All">All requests</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></label></div><div class="table-wrap"><table><thead><tr><th>Professional</th><th>Role</th><th>License expires</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></div><p class="license-help" data-license-empty hidden>No matching license renewal requests.</p>';
    host.append(panel);
    const filter = panel.querySelector('select');
    const review = document.createElement('dialog'); review.className = 'record-dialog license-renewal-dialog';
    review.setAttribute('aria-labelledby', 'license-review-title');
    review.innerHTML = '<div class="license-review-content"><div class="dialog-heading"><div><p class="eyebrow">LICENSE RENEWAL REVIEW</p><h2 id="license-review-title">Review renewed license</h2></div><button type="button" class="icon-button" data-close-review aria-label="Close">&times;</button></div><dl class="license-review-details"></dl><button type="button" class="secondary-button" data-view-license>View uploaded license</button><label class="field-label license-review-reason">Review reason (required when rejecting)<textarea rows="3" maxlength="1000"></textarea></label><p role="status" aria-live="polite" class="form-feedback"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close-review>Close</button><button type="button" class="secondary-button" data-license-decision="reject">Reject renewal</button><button type="button" class="primary-button" data-license-decision="approve">Approve renewal</button></div></div>';
    document.body.append(review);
    let selectedId = '';
    const feedback = review.querySelector('[role="status"]');
    function render() {
      const rows = data.newestFirst(data.list('licenseRenewals')).filter(row => (!filterRole || row.role === filterRole) && (filter.value === 'All' || row.status === filter.value));
      panel.querySelector('tbody').innerHTML = rows.map(row => `<tr><td>${esc(data.get('users', row.userId)?.name || 'Professional')}</td><td>${esc(row.role)}</td><td>${esc(row.licenseExpiry || 'No expiration date')}</td><td>${esc(row.status)}</td><td><button type="button" class="secondary-button" data-review-license="${esc(row.id)}">Review</button></td></tr>`).join('');
      panel.querySelector('[data-license-empty]').hidden = Boolean(rows.length);
    }
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-review-license]'); if (!button) return;
      const row = data.get('licenseRenewals', button.dataset.reviewLicense); if (!row) return;
      selectedId = row.id; feedback.textContent = ''; review.querySelector('textarea').value = row.reviewReason || '';
      const user = data.get('users', row.userId);
      const fields = [['Professional', user?.name], ['Role', row.role], ['Current expiration', api.licenseState(user, row.role).expiresOn || 'No expiration date'], ['Renewed license number', row.licenseNumber], ['Renewed expiration', row.licenseExpiry || 'No expiration date'], ['Document', row.document?.name], ['Review status', row.status]];
      review.querySelector('dl').innerHTML = fields.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
      review.querySelectorAll('[data-license-decision]').forEach(button => { button.hidden = row.status !== 'Pending'; });
      review.showModal();
    });
    review.querySelectorAll('[data-close-review]').forEach(button => button.addEventListener('click', () => review.close()));
    review.querySelector('[data-view-license]').addEventListener('click', async () => {
      try { await viewDocument(data.get('licenseRenewals', selectedId)?.document); } catch (error) { feedback.textContent = error.message; }
    });
    review.querySelectorAll('[data-license-decision]').forEach(button => button.addEventListener('click', () => {
      const result = api.reviewRenewal(selectedId, button.dataset.licenseDecision, review.querySelector('textarea').value);
      if (!result.ok) { feedback.textContent = result.error; return; }
      review.close(); render();
    }));
    filter.addEventListener('change', render); data.subscribe(render); render();
    if (location.hash === '#license-renewals') panel.scrollIntoView({ block: 'start' });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
