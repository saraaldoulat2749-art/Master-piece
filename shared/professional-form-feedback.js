(() => {
  function showSuccess(title, message, onContinue) {
    let dialog = document.getElementById('professional-success-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'professional-success-dialog';
      dialog.className = 'success-dialog';
      dialog.innerHTML = '<div class="success-mark" aria-hidden="true">✓</div><p class="success-eyebrow">CAREPLUS</p><h2></h2><p class="success-message"></p><button type="button" class="success-close">Done</button>';
      document.body.append(dialog);
      dialog.querySelector('.success-close').addEventListener('click', () => {
        dialog.close();
        dialog.onContinue?.();
      });
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    }
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('.success-message').textContent = message;
    dialog.onContinue = typeof onContinue === 'function' ? onContinue : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(`${title}\n\n${message}`);
  }
  window.CarePlusFormFeedback = { showSuccess };
})();
