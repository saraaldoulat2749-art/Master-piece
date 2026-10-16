(() => {
  const data = window.CarePlusData;
  const pharmacyApi = window.CarePlusPharmacy;
  const auth = window.CarePlusAuth;
  const $ = id => document.getElementById(id);
  const form = $("addMedicineForm");
  const message = $("medicineMessage");
  const toast = text => {
    const node = $("toast");
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 3000);
  };
  const pharmacyId = auth?.demoPharmacyId?.();

  if (!data || !pharmacyApi || !pharmacyId || !pharmacyApi.get(pharmacyId)) {
    message.textContent = "This pharmacy account is not linked to an active pharmacy record. Sign in again or contact the administrator.";
    message.classList.add("error");
    form.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    return;
  }

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("medicineExpiry").min = localToday;

  form.addEventListener("submit", event => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("error");

    const name = $("medicineName").value.trim();
    const category = $("medicineCategory").value.trim();
    const price = Number($("medicinePrice").value);
    const quantity = Number($("medicineQuantity").value);
    const expiry = $("medicineExpiry").value;
    const listed = $("medicineAvailable").checked;
    if (!name || !category || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 0 || !expiry) {
      message.textContent = "Enter the medicine name, category, a valid price and quantity, and an expiry date.";
      message.classList.add("error");
      return;
    }
    if (expiry < localToday || Number.isNaN(Date.parse(`${expiry}T23:59:59`))) {
      message.textContent = "Choose today or a future expiry date so customers cannot order expired medicine.";
      message.classList.add("error");
      return;
    }

    const current = pharmacyApi.get(pharmacyId);
    if (!current) {
      message.textContent = "Your pharmacy record is no longer available. Sign in again and retry.";
      message.classList.add("error");
      return;
    }
    const id = `med-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
    const medicine = { id, name, category, price, quantity, expiry, listed, available: listed && quantity > 0 };
    const saved = pharmacyApi.updatePharmacy(pharmacyId, { inventory: [...(current.inventory || []), medicine] });
    const savedItem = saved && pharmacyApi.get(pharmacyId)?.inventory?.find(item => String(item.id) === id);
    if (!savedItem) {
      message.textContent = "The medicine could not be saved. Check browser storage and try again.";
      message.classList.add("error");
      return;
    }

    form.reset();
    $("medicineQuantity").value = "1";
    $("medicineExpiry").min = localToday;
    message.textContent = savedItem.available
      ? `${name} was saved and is now listed in customer pharmacy search.`
      : `${name} was saved to inventory. It will appear in search when enabled and in stock.`;
    toast("Medicine saved to the selected pharmacy.");
  });

  $("menuToggle").addEventListener("click", () => {
    const open = $("sidebar").classList.toggle("open");
    document.querySelector(".app-shell").classList.toggle("menu-open", open);
  });
})();
