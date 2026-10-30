/* Present existing table rows compactly without changing their data or handlers.
 * Controls stay under their original tbody so delegated actions/forms still work.
 */
(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("compact-tables.css", document.currentScript.src).href;
  document.head.append(css);
  const columns = new WeakMap();
  let sequence = 0;
  const node = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const normalize = text => text.trim().toLowerCase().replace(/\s+/g, " ");
  function indexes(labels) {
    let name = labels.findIndex(label => /^(name|patient|family contact|customer|customer ref\.?|medicine|elderly person|request \/ elderly person)$/.test(normalize(label)));
    if (name < 0) name = 0;
    let status = labels.findIndex(label => /^(status|booking status|appointment status|order status)$/.test(normalize(label)));
    if (status < 0) status = labels.findIndex(label => /^(availability|stock status)$/.test(normalize(label)));
    return { name, status };
  }
  function plainName(cell) {
    return (cell?.querySelector("strong,b,h3")?.textContent || cell?.childNodes[0]?.textContent || cell?.textContent || "Not provided").trim() || "Not provided";
  }
  function compact(table) {
    // The medicine catalog has inline edit/delete actions; keep them directly in its table.
    if (table.closest("#view-medicines, #view-orders")) return;
    const head = table.tHead;
    if (!head?.rows.length) return;
    let labels = columns.get(table);
    if (!head.rows[0].hasAttribute("data-compact-header")) {
      labels = [...head.rows[0].cells].map(cell => cell.textContent.trim());
      if (labels.length < 2) return;
      columns.set(table, labels);
      const row = document.createElement("tr"); row.dataset.compactHeader = "";
      ["Name", "Status", "Details"].forEach(label => {
        const th = node("th", "", label); th.scope = "col"; row.append(th);
      });
      head.replaceChildren(row);
    }
    if (!labels) return;
    table.classList.add("cp-compact-table");
    const { name, status } = indexes(labels);
    for (const body of table.tBodies) for (const row of [...body.rows]) {
      if (row.hasAttribute("data-compact-row")) continue;
      const cells = [...row.cells];
      if (cells.length < 2 || cells[0].colSpan > 1) continue;
      row.dataset.compactRow = "";
      const nameText = plainName(cells[name]);
      const nameCell = node("td", "cp-table-name", nameText);
      const statusCell = node("td", "cp-table-status");
      const badge = cells[status]?.querySelector(".status, .status-badge, .stock-badge");
      if (badge) statusCell.append(badge.cloneNode(true));
      else statusCell.append(node("span", "cp-table-status-label", cells[status]?.textContent.trim() || "Not provided"));
      const detailCell = node("td", "cp-table-details");
      const button = node("button", "cp-table-details-button", "View details");
      button.type = "button"; button.setAttribute("aria-label", "View details for " + nameText);
      detailCell.append(button);
      cells.forEach(cell => { cell.hidden = true; });
      row.append(nameCell, statusCell, detailCell);

      // Keep the existing rich care request modal and its privacy controls.
      const careRequest = table.closest('[data-admin-page="careRequests"]');
      const nurseRequest = ["requestRows", "visitRows"].includes(body.id);
      const pharmacyOrder = body.hasAttribute("data-orders");
      const existingDetails = careRequest || nurseRequest ? row.querySelector('button[data-action="details"]') : pharmacyOrder ? row.querySelector('button[data-order-detail]') : null;
      if (existingDetails) {
        button.addEventListener("click", () => {
          existingDetails.click();
          const dialog = document.querySelector(careRequest ? "[data-care-details-dialog]" : nurseRequest ? "#requestDialog" : "[data-order-dialog]");
          const footer = dialog?.querySelector(careRequest ? ".care-details-footer" : ".dialog-actions");
          if (!footer) return;
          footer.querySelector("[data-compact-actions]")?.remove();
          const actions = node("div", "cp-table-extra-actions"); actions.dataset.compactActions = "";
          cells.flatMap(cell => [...cell.querySelectorAll("button,select,a")]).forEach(original => {
            if (original === existingDetails) return;
            if (original.tagName === "SELECT") {
              const proxy = original.cloneNode(true);
              proxy.removeAttribute("id");
              proxy.addEventListener("change", () => { original.value = proxy.value; original.dispatchEvent(new Event("change", { bubbles: true })); });
              actions.append(proxy); return;
            }
            const proxy = node("button", ["delete", "reject"].includes(original.dataset.action) ? "cp-table-action-danger" : "cp-table-details-button", original.textContent);
            proxy.type = "button";
            proxy.disabled = original.disabled;
            proxy.addEventListener("click", () => { dialog.close(); original.click(); }); actions.append(proxy);
          });
          footer.append(actions);
        });
        continue;
      }

      // Native dialog remains inside this row: existing delegated listeners still receive events.
      const dialog = node("dialog", "cp-table-modal");
      const id = "cp-table-title-" + ++sequence;
      dialog.setAttribute("aria-labelledby", id);
      const header = node("header", "cp-table-modal-header");
      const copy = node("div");
      copy.append(node("p", "cp-table-eyebrow", "CAREPLUS / RECORD DETAILS"));
      const title = node("h2", "", nameText); title.id = id; copy.append(title);
      const close = node("button", "cp-table-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close record details");
      close.addEventListener("click", () => dialog.close());
      header.append(copy, close);
      const list = node("dl", "cp-table-detail-grid");
      const actionSection = node("section", "cp-table-record-actions");
      actionSection.setAttribute("aria-label", "Record actions");
      actionSection.append(node("h3", "", "Actions"));
      const actionControls = node("div", "cp-table-record-action-controls");
      actionSection.append(actionControls);
      cells.forEach((cell, index) => {
        if (/actions|manage|review|update stock/i.test(labels[index] || "") && cell.querySelector("button,form,select,a")) {
          const group = node("div", "cp-table-record-action-group");
          group.append(...cell.childNodes);
          actionControls.append(group);
          return;
        }
        const field = node("div", "cp-table-detail-field");
        field.append(node("dt", "", labels[index] || "Additional details"));
        const value = node("dd");
        if (!cell.textContent.trim() && !cell.querySelector("input,select,button,a,form")) value.textContent = "Not provided";
        else value.append(...cell.childNodes);
        field.append(value);
        if (value.querySelector("button,form,select")) field.classList.add("cp-table-detail-field--wide");
        list.append(field);
      });
      const footer = node("footer", "cp-table-modal-footer");
      const done = node("button", "cp-table-details-button", "Done"); done.type = "button";
      done.addEventListener("click", () => dialog.close()); footer.append(done);
      dialog.append(header, list);
      if (actionControls.children.length) dialog.append(actionSection);
      dialog.append(footer); detailCell.append(dialog);
      button.addEventListener("click", () => { if (!dialog.open) dialog.showModal(); close.focus(); });
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    }
  }
  let observer;
  function refresh() {
    observer?.disconnect();
    document.querySelectorAll("table").forEach(compact);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function start() { observer = new MutationObserver(refresh); refresh(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
