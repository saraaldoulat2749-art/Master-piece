let pharmacies = window.CarePlusData.newestFirst(window.CarePlusData.list("pharmacies")).filter(window.CarePlusPharmacy.isActivePharmacy);
const pharmacyApi = window.CarePlusPharmacy;
const params = new URLSearchParams(location.search);
const medicineInput = document.getElementById("medicine");
const areaSelect = document.getElementById("area");
const searchForm = document.getElementById("resultsSearchForm");
const cardsContainer = document.getElementById("pharmacyCards");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const medicineQuery = String(params.get("medicine") || "").trim();
const normalizeMedicine = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const medicineTerms = [...new Set(medicineQuery.split(/[,\u060c;\n]+/).map(name => name.trim()).filter(Boolean))];
const initialArea = String(params.get("area") || "");
medicineInput.value = medicineQuery;
medicineInput.placeholder = 'e.g. Panadol, Ibuprofen';
const availableAreas = [...new Set(pharmacies.map(pharmacy => pharmacy.area).filter(Boolean))];
areaSelect.replaceChildren(...availableAreas.map(area => { const option=document.createElement("option");option.value=area;option.textContent=area;return option; }));
if (availableAreas.includes(initialArea)) areaSelect.value = initialArea;

function updateProgressLinks() {
  const links = [...document.querySelectorAll(".order-progress .order-step-number")];
  const query = `medicine=${encodeURIComponent(medicineQuery)}&area=${encodeURIComponent(areaSelect.value || initialArea)}`;
  if (links[0]) links[0].href = `index.html?${query}`;
  if (links[1]) links[1].href = `results.html?${query}`;
  const firstOrder = cardsContainer.querySelector(".actions a.btn-primary");
  if (links[2] && firstOrder) links[2].href = firstOrder.href;
}

function matches(pharmacy) {
  return (pharmacy.inventory || []).filter(item => item.available !== false && Number(item.quantity) > 0 && !pharmacyApi.isExpired(item) && medicineTerms.some(term => normalizeMedicine(item.name).includes(normalizeMedicine(term))));
}
function renderResults() {
  const area = areaSelect.value;
  const found = pharmacies.filter(pharmacy => String(pharmacy.area || pharmacy.city || "").trim().toLowerCase() === area.trim().toLowerCase() && medicineTerms.length && medicineTerms.every(term => matches(pharmacy).some(item => normalizeMedicine(item.name).includes(normalizeMedicine(term)))));
  document.getElementById("resultsHeading").textContent = medicineQuery ? `Pharmacies with ${medicineQuery}` : "Available pharmacies";
  document.getElementById("resultsDescription").textContent = `Pharmacies in ${area || "your area"} with all requested medicines in stock. Separate medicine names with commas.`;
  document.getElementById("resultsTitle").textContent = `Available pharmacies in ${area || "your area"}`;
  document.getElementById("resultCount").textContent = `${found.length} ${found.length === 1 ? "pharmacy" : "pharmacies"} found`;
  if (!found.length) {
    const unavailable = pharmacies.filter(pharmacy => String(pharmacy.area || pharmacy.city || '').trim().toLowerCase() === area.trim().toLowerCase()).map(pharmacy => {
      const inventory = pharmacy.inventory || [];
      if (!medicineTerms.every(term => inventory.some(item => normalizeMedicine(item.name).includes(normalizeMedicine(term))))) return '';
      const missing = medicineTerms.filter(term => !matches(pharmacy).some(item => normalizeMedicine(item.name).includes(normalizeMedicine(term))));
      return `<p><strong>${escapeHtml(pharmacy.name)}</strong>: currently unavailable or out of stock: ${missing.map(escapeHtml).join(', ')}.</p>`;
    }).filter(Boolean).join('');
    cardsContainer.innerHTML = `<div class="empty">No pharmacy currently has all requested medicines in stock in ${escapeHtml(area || 'your area')}.${unavailable || '<p>Try different medicine names or another area.</p>'}</div>`;
    updateProgressLinks(); return;
  }
  cardsContainer.innerHTML = found.map(pharmacy => {
    const medicines = matches(pharmacy);
    const chosen = medicines[0];
    const inventory = (pharmacy.inventory || []).map(item => {
      const canOrder = item.available !== false && Number(item.quantity) > 0 && !pharmacyApi.isExpired(item);
      return `<div class="pharmacy-detail-medicine"><b>${escapeHtml(item.name)}</b><span>JOD ${Number(item.price).toFixed(2)}</span><small>${canOrder ? `${Number(item.quantity)} available` : "Unavailable"} · Expires ${escapeHtml(item.expiry || "not listed")}</small></div>`;
    }).join("");
    const isOpen = pharmacy.open !== false;
    const orderLink = isOpen ? `<a class="btn btn-primary" href="order.html?pharmacyId=${encodeURIComponent(pharmacy.id)}&medicineIds=${encodeURIComponent(medicines.map(item => item.id).join(','))}">Order ${medicines.length > 1 ? 'medicines' : 'medicine'}</a>` : `<span class="pharmacy-closed-note">Ordering unavailable while closed</span>`;
    return `<article class="card"><div class="card-top"><div class="pharmacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg></div><div class="pharmacy-title"><h4>${escapeHtml(pharmacy.name)}</h4><div class="distance">Distance: ${escapeHtml(pharmacy.distance || "Nearby")}</div></div><span class="status ${isOpen ? "open" : "closed"}">${isOpen ? "Open Now" : "Closed"}</span></div>
      <div class="details"><div class="detail"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span>${escapeHtml(pharmacy.address || pharmacy.area)}</span></div><div class="detail"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 16.5v3a2 2 0 0 1-2.2 2A19 19 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7l.5 2.6a2 2 0 0 1-.6 1.8L8.7 10a16 16 0 0 0 5.3 5.3l.9-1.2a2 2 0 0 1 1.8-.6l2.6.5a2 2 0 0 1 1.7 2.5Z"/></svg></span><span>${escapeHtml(pharmacy.phone || "Contact pharmacy")}</span></div><div class="detail"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span>${escapeHtml(pharmacy.openingHours || pharmacy.hours || "Hours not listed")}</span></div><div class="detail"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3h8v4l2 2v11H6V9l2-2V3Z"/><path d="M8 7h8m-4 5v5m-2.5-2.5h5"/></svg></span><span>${escapeHtml(medicines.map(item => item.name).join(", "))} · <strong class="available">${medicines.length} medicine(s) in stock</strong></span></div></div>
      <div class="pharmacy-expanded-details" data-pharmacy-details="${escapeHtml(pharmacy.id)}" hidden>${inventory}</div><div class="actions"><button class="btn btn-outline" type="button" data-view-pharmacy="${escapeHtml(pharmacy.id)}">View Details</button>${orderLink}</div></article>`;
  }).join("");
  updateProgressLinks();
}
searchForm.addEventListener("submit", event => { event.preventDefault(); const nextMedicine=medicineInput.value.trim(); location.assign(`results.html?medicine=${encodeURIComponent(nextMedicine)}&area=${encodeURIComponent(areaSelect.value)}`); });
cardsContainer.addEventListener("click", event => { const button=event.target.closest("[data-view-pharmacy]");if(!button)return;const details=cardsContainer.querySelector(`[data-pharmacy-details="${CSS.escape(button.dataset.viewPharmacy)}"]`);if(!details)return;details.hidden=!details.hidden;button.textContent=details.hidden?"View Details":"Hide Details"; });
pharmacyApi.subscribe(() => { pharmacies=window.CarePlusData.newestFirst(window.CarePlusData.list("pharmacies")).filter(pharmacyApi.isActivePharmacy);renderResults(); });
if (!medicineQuery) { cardsContainer.innerHTML = `<div class="empty">Enter a medicine name to view pharmacy results. <a href="index.html">Start a search</a>.</div>`; }
else renderResults();
