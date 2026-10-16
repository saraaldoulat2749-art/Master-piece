(() => {
  const pharmacyApi = window.CarePlusPharmacy;
  const rateInput = document.getElementById("defaultCommissionRate");
  const careRateInput = document.getElementById("careCommissionRate");
  const form = document.getElementById("commissionRateForm");
  const message = document.getElementById("commissionSettingsMessage");
  if (!pharmacyApi || !rateInput || !form || !message) return;

  const renderRate = () => { const settings = pharmacyApi.settings(); rateInput.value = settings.defaultRate; careRateInput.value = settings.careCommissionRate; };
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const result = pharmacyApi.saveSettings({ defaultRate: Number(rateInput.value), careCommissionRate: Number(careRateInput.value) });
    message.classList.toggle("error", !result.ok);
    message.textContent = result.ok
      ? "Commission rates saved. New orders and care requests will use the configured rates."
      : result.error;
    if (result.ok) rateInput.value = result.settings.defaultRate;
  });

  document.querySelector(".menu-toggle")?.addEventListener("click", event => {
    const open = document.querySelector(".admin-layout").classList.toggle("sidebar-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  pharmacyApi.subscribe(renderRate);
  renderRate();
})();
