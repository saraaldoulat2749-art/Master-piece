/* Shared presentation only: callers retain authorization and perform the mutation. */
(() => {
  const script = document.currentScript;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("delete-dialog.css", script.src).href;
  document.head.append(css);
  let pending = false;
  const make = (selector, titleId, descriptionId) => {
    const dialog = document.createElement("dialog");
    dialog.className = "cp-delete-modal";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", descriptionId);
    dialog.dataset.deletePopup = selector;
    document.body.append(dialog);
    return dialog;
  };
  const trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7"/></svg>';
  async function confirmDelete({ kind = "item", name = "", meta = "", description = "" } = {}) {
    if (pending) return false;
    pending = true;
    const dialog = make("confirm", "cp-delete-title", "cp-delete-description");
    dialog.innerHTML = '<div class="cp-delete-content"><button type="button" class="cp-delete-close" data-cancel aria-label="Close delete confirmation">&times;</button><div class="cp-delete-intro"><span class="cp-delete-symbol" aria-hidden="true">' + trash + '</span><p class="cp-delete-eyebrow">CAREPLUS MANAGEMENT</p><h2 id="cp-delete-title"></h2><p id="cp-delete-description"></p></div><div class="cp-delete-record"><span class="cp-delete-record-label">SELECTED ITEM</span><strong data-name></strong><span data-meta></span></div><p class="cp-delete-warning"><span aria-hidden="true">!</span>This action cannot be undone.</p><div class="cp-delete-actions"><button type="button" class="cp-delete-keep" data-cancel></button><button type="button" class="cp-delete-confirm" data-confirm></button></div></div>';
    dialog.querySelector("h2").textContent = `Delete this ${kind}?`;
    dialog.querySelector("#cp-delete-description").textContent = description || `You are about to permanently delete this ${kind} and its saved details.`;
    dialog.querySelector("[data-name]").textContent = name || kind;
    dialog.querySelector("[data-meta]").textContent = meta;
    dialog.querySelector(".cp-delete-keep").textContent = `Keep ${kind}`;
    dialog.querySelector("[data-confirm]").textContent = `Yes, delete ${kind}`;
    dialog.querySelectorAll("[data-cancel]").forEach(button => button.addEventListener("click", () => dialog.close("cancel")));
    dialog.querySelector("[data-confirm]").addEventListener("click", () => dialog.close("delete"));
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close("cancel"); });
    dialog.returnValue = "cancel";
    return new Promise(resolve => {
      dialog.addEventListener("close", () => {
        const confirmed = dialog.returnValue === "delete";
        dialog.remove(); pending = false; resolve(confirmed);
      }, { once: true });
      dialog.showModal();
      dialog.querySelector(".cp-delete-keep").focus();
    });
  }
  function showDeleted({ kind = "item" } = {}) {
    if (document.querySelector('[data-delete-popup="success"]')) return;
    const dialog = make("success", "cp-deleted-title", "cp-deleted-description");
    dialog.classList.add("cp-deleted-modal");
    dialog.innerHTML = '<div class="cp-delete-content"><div class="cp-delete-intro"><span class="cp-deleted-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg></span><h2 id="cp-deleted-title"></h2><p id="cp-deleted-description">The item has been removed.</p></div><button type="button" class="cp-deleted-done">Done</button></div>';
    dialog.querySelector("h2").textContent = `${kind.charAt(0).toUpperCase() + kind.slice(1)} deleted successfully`;
    dialog.querySelector("#cp-deleted-description").textContent = `The ${kind} has been removed.`;
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal(); dialog.querySelector("button").focus();
  }
  window.CarePlusDelete = Object.freeze({ confirm: confirmDelete, success: showDeleted });
})();
