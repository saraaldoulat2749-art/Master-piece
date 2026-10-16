const medicineInput = document.getElementById("medicine");
const areaSelect = document.getElementById("area");
const searchForm = document.getElementById("pharmacySearchForm");
const pharmacies = window.CarePlusData.list("pharmacies").filter(window.CarePlusPharmacy.isActivePharmacy);
const currentArea = new URLSearchParams(location.search).get("area") || areaSelect.value;
const areas = [...new Set(pharmacies.map(pharmacy => pharmacy.area).filter(Boolean))];
areaSelect.replaceChildren(...areas.map(area => {
  const option = document.createElement("option");
  option.value = area;
  option.textContent = area;
  return option;
}));
if (areas.includes(currentArea)) areaSelect.value = currentArea;
const previousSearch = new URLSearchParams(location.search).get("medicine");
if (previousSearch) medicineInput.value = previousSearch;
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  const medicine = medicineInput.value.trim();
  if (!medicine) { medicineInput.focus(); return; }
  location.assign(`results.html?medicine=${encodeURIComponent(medicine)}&area=${encodeURIComponent(areaSelect.value)}`);
});
