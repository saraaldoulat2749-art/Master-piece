/* Read-only admin presentation. Browser demo auth is not backend authorization.
 * Clinical note text is deliberately excluded until a server-authorized endpoint exists.
 */
(() => {
  const missing = "Not provided";
  const present = value => value !== null && value !== undefined && value !== "";
  const money = value => present(value) && Number.isFinite(Number(value)) ? `JOD ${Number(value).toFixed(2)}` : missing;
  const dateTime = value => {
    if (!value) return missing;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? missing : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(date);
  };
  const dateOnly = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return missing;
    const date = new Date(value + "T12:00:00+03:00");
    return Number.isNaN(date.getTime()) ? missing : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Amman" }).format(date);
  };
  function model(record) {
    const raw = String(record.status || "New").toLowerCase();
    const state = ["completed", "closed"].includes(raw) ? "Completed"
      : ["cancelled", "rejected"].includes(raw) ? "Cancelled"
      : raw === "in progress" ? "In Progress"
      : ["confirmed", "accepted", "approved"].includes(raw) ? "Confirmed" : "Pending";
    const demo = record.paymentMode === "demo" && record.demoPaymentStatus === "Succeeded" && Boolean(record.demoTransactionReference);
    const verified = record.paymentMode !== "demo" && record.paymentStatus === "Paid" && record.paymentVerified === true && Boolean(record.transactionReference);
    const recorded = record.paymentStatus === "Paid" || demo;
    const payment = verified ? "Deposit Paid" : demo ? "Demo deposit recorded" : record.paymentStatus === "Paid" ? "Awaiting verification" : record.paymentStatus || missing;
    const requirements = [["Requested Tasks", record.tasks], ["Family Instructions", record.notes]];
    if (/hospital\s*companion/i.test(String(record.service || ""))) {
      requirements.push(["Pickup Address", record.pickupAddress], ["Destination", record.destination], ["Destination Type", record.destinationType], ["Trip Option", record.tripOption], ["Wait During Appointment", record.waitAppointment], ["Support Inside Facility", record.insideFacility], ["Transport Assistance", record.transportHelp], ["Mobility Requirements", record.mobility]);
    }
    return {
      state, verified, payment,
      overview: [["Family Contact", record.client], ["Service", record.service], ["Preferred Date", dateOnly(record.date)], ["Preferred Time", record.time], ["Duration (hours)", record.duration], ["Assigned Nurse", record.assignedNurseName], ["City / Area", [record.city, record.area].filter(Boolean).join(" / ")], ["Schedule", record.schedule], ["Booking Status", state], ...(record.cancelReason ? [["Cancellation Reason", record.cancelReason]] : []), ...(record.rejectionReason ? [["Rejection Reason", record.rejectionReason]] : [])],
      // Read stored financial values; never infer balance settlement from visit completion.
      finances: [["Estimated Total (JOD)", money(record.totalPrice ?? record.estimatedTotal)], ["Deposit Paid (JOD)", money(record.depositPaid ?? (recorded ? record.depositAmount : null))], ["Remaining Balance (JOD)", money(record.remainingBalance)]],
      sections: [
        ["Contact Details", [["Elderly Person", record.elderlyName], ["Contact Phone", record.phone], ["Email", record.email], ["Care Address", record.address || record.pickupAddress], ["Emergency Contact Phone", record.emergencyPhone]]],
        ["Care Requirements", requirements],
        ["Payment Details", [["CarePlus Rate (%)", present(record.careCommissionRate) ? String(record.careCommissionRate) + "%" : missing], ["CarePlus Fee (JOD)", money(record.careCommissionAmount)], ["Transaction Reference", demo ? record.demoTransactionReference : record.transactionReference], ["Payment Date", dateTime(demo ? record.demoPaymentAt : record.paidAt)], ["Payment Method", demo ? record.demoPaymentMethod : record.paymentMethod]]],
        ["Visit History", [["Visit Started", dateTime(record.actualStartAt || record.startedAt)], ["Visit Ended", dateTime(record.actualEndAt)], ["Completed Tasks", record.completedTasks], ["Care Notes", "Restricted — available to authorized care staff only."]]]
      ]
    };
  }
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const display = value => !present(value) || (Array.isArray(value) && !value.length) ? missing : Array.isArray(value) ? value.join(", ") : String(value);
  function grid(rows, className = "") {
    const list = element("dl", "care-details-grid " + className);
    rows.forEach(([label, value]) => {
      const row = element("div", "care-details-field");
      row.append(element("dt", "", label), element("dd", "", display(value)));
      list.append(row);
    });
    return list;
  }
  function open(record) {
    if (!window.CarePlusAuth?.hasDemoAdminSession()) return;
    let dialog = document.querySelector("[data-care-details-dialog]");
    if (!dialog) {
      dialog = element("dialog", "record-dialog care-details-modal");
      dialog.dataset.careDetailsDialog = "";
      dialog.setAttribute("aria-labelledby", "care-details-title");
      dialog.innerHTML = '<header class="care-details-header"><div><p class="eyebrow">CAREPLUS / CARE REQUEST</p><h2 id="care-details-title">Care Request Details</h2><div data-care-booking-badge></div></div><button type="button" class="icon-button" data-care-close aria-label="Close care request details">&times;</button></header><div class="care-details-body" data-care-details-content></div><footer class="care-details-footer"><span>Visit status and payment status are tracked separately.</span><button type="button" class="primary-button" data-care-close>Done</button></footer>';
      dialog.querySelectorAll("[data-care-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener("close", () => {
        dialog.querySelector("[data-care-details-content]").replaceChildren();
        dialog.querySelector("[data-care-booking-badge]").replaceChildren();
      });
      document.body.append(dialog);
    }
    const data = model(record);
    const badge = element("span", "care-details-badge care-details-badge--" + data.state.toLowerCase().replaceAll(" ", "-"), data.state);
    dialog.querySelector("[data-care-booking-badge]").replaceChildren(badge);
    const content = dialog.querySelector("[data-care-details-content]");
    content.replaceChildren();
    const overview = element("section", "care-details-overview");
    overview.setAttribute("aria-label", "Booking information");
    overview.append(element("h3", "care-details-section-title", "Booking Information"), grid(data.overview));
    content.append(overview);
    const payment = element("section", "care-details-payment");
    payment.setAttribute("aria-label", "Payment summary");
    payment.append(element("h3", "care-details-section-title", "Payment Summary"), grid(data.finances, "care-details-amounts"));
    const paymentState = element("div", "care-details-payment-status");
    paymentState.append(element("span", "", "Deposit Payment Status"), element("span", "care-details-badge " + (data.verified ? "care-details-badge--completed" : "care-details-badge--neutral"), data.payment));
    payment.append(paymentState);
    content.append(payment);
    const accordions = element("div", "care-details-accordions");
    data.sections.forEach(([title, rows], index) => {
      const section = element("section", "care-details-accordion");
      const h3 = element("h3");
      const trigger = element("button", "care-details-trigger");
      trigger.type = "button";
      trigger.id = "care-details-trigger-" + index;
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", "care-details-panel-" + index);
      trigger.append(element("span", "", title));
      const chevron = element("span", "care-details-chevron");
      chevron.setAttribute("aria-hidden", "true");
      trigger.append(chevron);
      h3.append(trigger);
      const panel = element("div", "care-details-panel");
      panel.id = "care-details-panel-" + index;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", trigger.id);
      panel.setAttribute("aria-hidden", "true");
      panel.inert = true;
      const inner = element("div", "care-details-panel-inner");
      inner.append(grid(rows));
      panel.append(inner);
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") !== "true";
        trigger.setAttribute("aria-expanded", String(expanded));
        panel.setAttribute("aria-hidden", String(!expanded));
        panel.inert = !expanded;
      });
      section.append(h3, panel); accordions.append(section);
    });
    content.append(accordions);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("[data-care-close]").focus();
  }
  window.CarePlusCareDetails = Object.freeze({ open });
})();
