(() => {
  let dialog;
  let resolver;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "review-reason-dialog";
    dialog.setAttribute("aria-labelledby", "review-reason-title");
    dialog.innerHTML = '<form class="review-reason-dialog__form"><header><div><p class="review-reason-dialog__eyebrow">CAREPLUS ADMIN</p><h2 id="review-reason-title"></h2></div><button type="button" class="review-reason-dialog__close" aria-label="Close">×</button></header><p class="review-reason-dialog__message"></p><label class="review-reason-dialog__label"><span>Reason</span><textarea name="reason" rows="4" maxlength="1000"></textarea></label><p class="review-reason-dialog__error" role="alert" hidden>Please enter a reason to continue.</p><footer><button type="button" class="review-reason-dialog__cancel">Cancel</button><button type="submit" class="review-reason-dialog__submit"></button></footer></form>';
    document.body.append(dialog);

    const form = dialog.querySelector("form");
    const finish = value => {
      const current = resolver;
      resolver = null;
      dialog.close();
      current?.(value);
    };
    form.addEventListener("submit", event => {
      event.preventDefault();
      const field = form.elements.namedItem("reason");
      const value = field.value.trim();
      if (!value) {
        dialog.querySelector(".review-reason-dialog__error").hidden = false;
        field.focus();
        return;
      }
      finish(value);
    });
    form.elements.namedItem("reason").addEventListener("input", () => {
      dialog.querySelector(".review-reason-dialog__error").hidden = true;
    });
    dialog.querySelector(".review-reason-dialog__cancel").addEventListener("click", () => finish(null));
    dialog.querySelector(".review-reason-dialog__close").addEventListener("click", () => finish(null));
    dialog.addEventListener("click", event => { if (event.target === dialog) finish(null); });
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
    dialog.addEventListener("close", () => {
      if (resolver) { const current = resolver; resolver = null; current(null); }
    });
    return dialog;
  }

  function ask({ title, message, placeholder, submitLabel }) {
    const current = ensureDialog();
    if (resolver) {
      const previous = resolver;
      resolver = null;
      if (current.open) current.close();
      previous(null);
    }
    return new Promise(resolve => {
      resolver = resolve;
      const form = current.querySelector("form");
      form.reset();
      current.querySelector("#review-reason-title").textContent = title;
      current.querySelector(".review-reason-dialog__message").textContent = message;
      const submitButton = current.querySelector(".review-reason-dialog__submit");
      submitButton.textContent = submitLabel;
      submitButton.classList.toggle("is-danger", title.toLowerCase().includes("reject"));
      current.querySelector(".review-reason-dialog__error").hidden = true;
      form.elements.namedItem("reason").placeholder = placeholder;
      current.showModal();
      window.setTimeout(() => form.elements.namedItem("reason").focus(), 0);
    });
  }

  window.CarePlusReviewReason = { ask };
})();
