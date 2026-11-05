(() => {
  const store = window.CarePlusData;
  const tableBody = document.querySelector("[data-table-body]");
  const page = document.querySelector('[data-admin-page="pharmacies"]');
  if (!store || !tableBody || !page) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  let focused = false;

  function detailField(label, value) {
    return '<div class="cp-table-detail-field"><dt>' + esc(label) + '</dt><dd>' + esc(value || "Not provided") + '</dd></div>';
  }

  function render() {
    tableBody.querySelectorAll("[data-professional-app-request]").forEach(row => row.remove());

    const query = page.querySelector("[data-search]")?.value.trim().toLowerCase() || "";
    const selectedStatus = page.querySelector("[data-pharmacy-status-filter]")?.value || "";
    const applications = store.list("professionalApplications")
      .filter(application => application.role === "pharmacy" && ["Pending Verification", "Additional Documents Required", "Rejected"].includes(application.status))
      .sort((first, second) => String(second.submittedAt || "").localeCompare(String(first.submittedAt || "")))
      .filter(application => {
        const user = store.get("users", application.userId) || {};
        const haystack = [application.pharmacyName, application.responsiblePharmacist, application.email, application.contactPhone,
          application.licenseNumber, application.city, application.address, user.name, user.email].join(" ").toLowerCase();
        return (!query || haystack.includes(query)) && (!selectedStatus || application.status === selectedStatus);
      });

    const rows = applications.map(application => {
      const user = store.get("users", application.userId) || {};
      const name = application.pharmacyName || user.name || "Pharmacy applicant";
      const titleId = "pharmacy-application-title-" + esc(application.id);
      const fields = [
        ["Pharmacy name", name], ["Responsible pharmacist", application.responsiblePharmacist],
        ["Email", user.email || application.email], ["Contact phone", application.contactPhone || user.phone],
        ["Pharmacy license number", application.licenseNumber], ["License expiration date", application.licenseExpiry],
        ["City / governorate", application.city], ["Address", application.address],
        ["Application status", application.status], ["Submitted at", application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Not recorded"]
      ];
      const documents = Object.entries(application.documents || {}).filter(([, file]) => file?.id);
      const documentButtons = documents.length
        ? documents.map(([key, file]) => '<button type="button" data-document-id="' + esc(application.id) + '" data-document-key="' + esc(key) + '">View ' + esc(file.name) + '</button>').join("")
        : '<span>No documents attached.</span>';
      const reviewActions = ["Pending Verification", "Additional Documents Required"].includes(application.status)
        ? '<button type="button" class="application-approve" data-review="approve" data-id="' + esc(application.id) + '">Approve pharmacy</button>'
          + '<button type="button" data-review="request" data-id="' + esc(application.id) + '">Request documents</button>'
          + '<button type="button" class="application-reject" data-review="reject" data-id="' + esc(application.id) + '">Reject</button>'
        : "";
      const dialog = '<dialog class="cp-table-modal pharmacy-application-dialog" aria-labelledby="' + titleId + '" data-application-dialog="' + esc(application.id) + '">'
        + '<header class="cp-table-modal-header"><div><p class="cp-table-eyebrow">PHARMACY VERIFICATION REQUEST</p><h2 id="' + titleId + '">' + esc(name) + '</h2></div>'
        + '<button type="button" class="cp-table-close" data-close-application aria-label="Close details">×</button></header>'
        + '<dl class="cp-table-detail-grid">' + fields.map(([label, value]) => detailField(label, value)).join("") + '</dl>'
        + (application.reviewReason ? '<section class="cp-table-record-note"><h3>Review reason</h3><p class="cp-table-record-note-text">' + esc(application.reviewReason) + '</p></section>' : "")
        + '<section class="cp-table-record-actions"><h3>Submitted documents</h3><div class="pharmacy-application-document-actions">' + documentButtons + '</div></section>'
        + (reviewActions ? '<section class="cp-table-record-actions"><h3>Admin review</h3><div class="pharmacy-application-review-actions">' + reviewActions + '</div></section>' : "")
        + '<footer class="cp-table-modal-footer"><button type="button" class="cp-table-details-button" data-close-application>Done</button></footer></dialog>';
      const row = document.createElement("tr");
      row.className = "is-application-request";
      row.dataset.professionalAppRequest = application.id;
      row.dataset.compactRow = "";
      row.innerHTML = '<td class="cp-table-name">' + esc(name) + '</td><td class="cp-table-status"><span class="cp-table-status-label pharmacy-application-status">'
        + esc(application.status) + '</span></td><td class="cp-table-details"><button type="button" class="cp-table-details-button" data-open-professional-app="' + esc(application.id)
        + '">View details</button>' + dialog + '</td>';
      return row;
    });

    rows.reverse().forEach(row => tableBody.prepend(row));
    const tableEmpty = page.querySelector("[data-table-empty]");
    if (rows.length && tableEmpty) tableEmpty.hidden = true;

    const requestedId = new URLSearchParams(location.search).get("applicationId");
    if (!focused && requestedId) {
      const row = tableBody.querySelector('[data-professional-app-request="' + CSS.escape(requestedId) + '"]');
      const button = row?.querySelector("[data-open-professional-app]");
      if (button) {
        focused = true;
        row.classList.add("is-highlighted");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        button.click();
      }
    }
  }

  tableBody.addEventListener("click", async event => {
    const openButton = event.target.closest("[data-open-professional-app]");
    if (openButton) {
      const dialog = tableBody.querySelector('[data-application-dialog="' + CSS.escape(openButton.dataset.openProfessionalApp) + '"]');
      if (dialog && !dialog.open) dialog.showModal();
      return;
    }
    const closeButton = event.target.closest("[data-close-application]");
    if (closeButton) { closeButton.closest("dialog")?.close(); return; }

    const documentButton = event.target.closest("[data-document-id]");
    if (documentButton) {
      const application = store.get("professionalApplications", documentButton.dataset.documentId);
      const file = application?.documents?.[documentButton.dataset.documentKey];
      if (!file?.id) return;
      const tab = window.open("about:blank", "_blank");
      try {
        const stored = await window.CarePlusDoctorDocuments.get(file.id);
        if (stored?.blob && tab) tab.location.href = URL.createObjectURL(stored.blob);
        else tab?.close();
      } catch { tab?.close(); window.alert("Could not open this document."); }
      return;
    }

    const reviewButton = event.target.closest("[data-review]");
    if (!reviewButton) return;
    const decision = reviewButton.dataset.review;
    const reason = decision === "approve" ? "" : await window.CarePlusReviewReason.ask({
      title: decision === "reject" ? "Reject application" : "Request additional documents",
      message: decision === "reject" ? "Enter a reason for rejecting this pharmacy registration." : "Specify which documents are missing or need clarification.",
      placeholder: decision === "reject" ? "Reason for rejection" : "List the documents or details required",
      submitLabel: decision === "reject" ? "Reject application" : "Send request"
    });
    if (decision !== "approve" && reason === null) return;
    const result = window.CarePlusAuth.reviewPharmacyApplication(reviewButton.dataset.id, decision, reason || "");
    if (!result.ok) { window.alert(result.error); return; }
    reviewButton.closest("dialog")?.close();
    render();
  });

  store.subscribe(render);
  window.addEventListener("storage", render);
  page.querySelector("[data-search]")?.addEventListener("input", render);
  page.querySelector("[data-pharmacy-status-filter]")?.addEventListener("change", render);
  render();
})();
