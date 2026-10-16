let pharmacies = window.CarePlusData.list("pharmacies").filter(window.CarePlusPharmacy.isActivePharmacy);
const pharmacyApi = window.CarePlusPharmacy;
const params = new URLSearchParams(location.search);
const medicineInput = document.getElementById("medicine");
const areaSelect = document.getElementById("area");
const searchForm = document.getElementById("resultsSearchForm");
const cardsContainer = document.getElementById("pharmacyCards");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const medicineQuery = String(params.get("medicine") || "").trim();
const initialArea = String(params.get("area") || "");
medicineInput.value = medicineQuery;
const availableAreas = [...new Set(pharmacies.map(pharmacy => pharmacy.area).filter(Boolean))];
areaSelect.replaceChildren(...availableAreas.map(area => { const option=document.createElement("option");option.value=area;option.textContent=area;return option; }));
if (availableAreas.includes(initialArea)) areaSelect.value = initialArea;

function matches(pharmacy) {
  return (pharmacy.inventory || []).filter(item => item.available !== false && Number(item.quantity) > 0 && !pharmacyApi.isExpired(item) && item.name.toLowerCase().includes(medicineQuery.toLowerCase()));
}
function renderResults() {
  const area = areaSelect.value;
  const found = pharmacies.filter(pharmacy => pharmacy.area === area && matches(pharmacy).length > 0);
  document.getElementById("resultsHeading").textContent = medicineQuery ? `Pharmacies with ${medicineQuery}` : "Available pharmacies";
  document.getElementById("resultsDescription").textContent = `Showing real inventory entries for ${area || "your area"}. Only medicines with available stock are listed.`;
  document.getElementById("resultsTitle").textContent = `Available pharmacies in ${area || "your area"}`;
  document.getElementById("resultCount").textContent = `${found.length} ${found.length === 1 ? "pharmacy" : "pharmacies"} found`;
  if (!found.length) { cardsContainer.innerHTML = `<div class="empty">No pharmacies have ${escapeHtml(medicineQuery || "this medicine")} in stock in ${escapeHtml(area || "your area")}. Try a different medicine or area.</div>`; return; }
  cardsContainer.innerHTML = found.map(pharmacy => {
    const medicines = matches(pharmacy);
    const chosen = medicines[0];
    const inventory = (pharmacy.inventory || []).map(item => {
      const canOrder = item.available !== false && Number(item.quantity) > 0 && !pharmacyApi.isExpired(item);
      return `<div class="pharmacy-detail-medicine"><b>${escapeHtml(item.name)}</b><span>JOD ${Number(item.price).toFixed(2)}</span><small>${canOrder ? `${Number(item.quantity)} available` : "Unavailable"} · Expires ${escapeHtml(item.expiry || "not listed")}</small></div>`;
    }).join("");
    const orderLink = pharmacy.open !== false ? `<a class="btn btn-primary" href="order.html?pharmacyId=${encodeURIComponent(pharmacy.id)}&medicineId=${encodeURIComponent(chosen.id)}">Continue to order</a>` : `<span class="pharmacy-closed-note">Ordering unavailable while closed</span>`;
    return `<article class="card"><div class="card-top"><div class="pharmacy-icon" aria-hidden="true">＋</div><div class="pharmacy-title"><h4>${escapeHtml(pharmacy.name)}</h4><div class="distance">Distance: ${escapeHtml(pharmacy.distance || "Nearby")}</div></div><span class="status ${pharmacy.open ? "open" : "closed"}">${pharmacy.open ? "Open Now" : "Closed"}</span></div>
      <div class="details"><div class="detail"><span class="ico" aria-hidden="true">⌖</span><span>${escapeHtml(pharmacy.address || pharmacy.area)}</span></div><div class="detail"><span class="ico" aria-hidden="true">☎</span><span>${escapeHtml(pharmacy.phone || "Contact pharmacy")}</span></div><div class="detail"><span class="ico" aria-hidden="true">◷</span><span>${escapeHtml(pharmacy.openingHours || pharmacy.hours || "Hours not listed")}</span></div><div class="detail"><span class="ico" aria-hidden="true">＋</span><span>${escapeHtml(chosen.name)} · <strong class="available">JOD ${Number(chosen.price).toFixed(2)} · ${Number(chosen.quantity)} available</strong></span></div></div>
      <div class="pharmacy-expanded-details" data-pharmacy-details="${escapeHtml(pharmacy.id)}" hidden>${inventory}</div><div class="actions"><button class="btn btn-outline" type="button" data-view-pharmacy="${escapeHtml(pharmacy.id)}">View Details</button>${orderLink}</div></article>`;
  }).join("");
}
searchForm.addEventListener("submit", event => { event.preventDefault(); const nextMedicine=medicineInput.value.trim(); location.assign(`results.html?medicine=${encodeURIComponent(nextMedicine)}&area=${encodeURIComponent(areaSelect.value)}`); });
cardsContainer.addEventListener("click", event => { const button=event.target.closest("[data-view-pharmacy]");if(!button)return;const details=cardsContainer.querySelector(`[data-pharmacy-details="${CSS.escape(button.dataset.viewPharmacy)}"]`);if(!details)return;details.hidden=!details.hidden;button.textContent=details.hidden?"View Details":"Hide Details"; });
pharmacyApi.subscribe(() => { pharmacies=window.CarePlusData.list("pharmacies").filter(pharmacyApi.isActivePharmacy);renderResults(); });
if (!medicineQuery) { cardsContainer.innerHTML = `<div class="empty">Enter a medicine name to view pharmacy results. <a href="index.html">Start a search</a>.</div>`; }
else renderResults();
