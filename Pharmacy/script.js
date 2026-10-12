let pharmacies = [
  {
    name: "Al Shifa Pharmacy",
    area: "Amman",
    distance: "0.8 km away",
    address: "King Abdullah St., Amman",
    phone: "+962 6 590 1122",
    hours: "Open until 11:00 PM",
    open: true,
    medicines: ["panadol", "paracetamol", "ibuprofen"]
  },
  {
    name: "CarePoint Pharmacy",
    area: "Amman",
    distance: "1.4 km away",
    address: "Prince Hasan St., Amman",
    phone: "+962 6 591 2045",
    hours: "Open until 10:30 PM",
    open: true,
    medicines: ["panadol", "vitamin c", "ibuprofen"]
  },
  {
    name: "LifeCare Pharmacy",
    area: "Amman",
    distance: "2.1 km away",
    address: "New Amman, Amman",
    phone: "+962 6 592 7781",
    hours: "Opens tomorrow at 8:00 AM",
    open: false,
    medicines: ["panadol", "vitamin d", "paracetamol"]
  },
  {
    name: "Al Hayat Pharmacy",
    area: "Zarqa",
    distance: "0.6 km away",
    address: "King Hussein St., Zarqa",
    phone: "+962 5 390 1456",
    hours: "Open until 10:00 PM",
    open: true,
    medicines: ["panadol", "paracetamol", "vitamin c"]
  },
  {
    name: "Al Rahma Pharmacy",
    area: "Zarqa",
    distance: "1.2 km away",
    address: "Prince Mohammad St., Zarqa",
    phone: "+962 5 391 2288",
    hours: "Open until 11:00 PM",
    open: true,
    medicines: ["ibuprofen", "vitamin d"]
  },
  {
    name: "Irbid Care Pharmacy",
    area: "Irbid",
    distance: "0.9 km away",
    address: "University St., Irbid",
    phone: "+962 2 710 3344",
    hours: "Open until 10:00 PM",
    open: true,
    medicines: ["panadol", "vitamin c"]
  },
  {
    name: "Salt Central Pharmacy",
    area: "Salt",
    distance: "0.7 km away",
    address: "Main St., Salt",
    phone: "+962 5 355 4455",
    hours: "Open until 9:30 PM",
    open: true,
    medicines: ["panadol", "paracetamol"]
  },
  {
    name: "Aqaba Marina Pharmacy",
    area: "Aqaba",
    distance: "1.1 km away",
    address: "Al-Hammamat St., Aqaba",
    phone: "+962 3 201 9988",
    hours: "Opens tomorrow at 8:00 AM",
    open: false,
    medicines: ["panadol", "ibuprofen"]
  }
];

window.CarePlusData.seed("pharmacies", pharmacies.map((pharmacy, index) => ({ id: `pharmacy-${index + 1}`, ...pharmacy, status: "Active" })));
pharmacies = window.CarePlusData.list("pharmacies");
window.CarePlusData.subscribe(() => { pharmacies = window.CarePlusData.list("pharmacies"); renderPharmacies(); });

const medicineInput = document.getElementById("medicine");
const areaSelect = document.getElementById("area");
const cardsContainer = document.getElementById("pharmacyCards");
const resultCount = document.getElementById("resultCount");
const resultsTitle = document.getElementById("resultsTitle");

function renderPharmacies() {
  const medicine = medicineInput.value.trim().toLowerCase();
  const selectedArea = areaSelect.value;
  const areas = [...new Set(pharmacies.filter(pharmacy => pharmacy.status !== "Inactive").map(pharmacy => pharmacy.area))];
  areaSelect.replaceChildren(...areas.map(areaName => {
    const option = document.createElement("option");
    option.value = areaName;
    option.textContent = areaName;
    return option;
  }));
  if (areas.includes(selectedArea)) areaSelect.value = selectedArea;
  const area = areaSelect.value;

  const filtered = pharmacies.filter(pharmacy =>
    pharmacy.area === area && pharmacy.status !== "Inactive" &&
    (
      !medicine ||
      (pharmacy.medicines || []).some(item =>
        item.includes(medicine) || medicine.includes(item)
      )
    )
  );

  resultsTitle.textContent = medicine
    ? `Pharmacies with ${medicineInput.value.trim()} near you`
    : "Available pharmacies near you";

  resultCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "pharmacy" : "pharmacies"} found`;

  if (filtered.length === 0) {
    cardsContainer.innerHTML = `
      <div class="empty">
        No pharmacies found for this medicine in ${area}.
        Try another medicine or area.
      </div>`;
    return;
  }

  cardsContainer.innerHTML = filtered.map(pharmacy => `
    <article class="card">
      <div class="card-top">
        <div class="pharmacy-icon">✚</div>

        <div class="pharmacy-title">
          <h4>${pharmacy.name}</h4>
          <div class="distance">📍 ${pharmacy.distance}</div>
        </div>

        <span class="status ${pharmacy.open ? "open" : "closed"}">
          ${pharmacy.open ? "Open Now" : "Closed"}
        </span>
      </div>

      <div class="details">
        <div class="detail">
          <span class="ico">♦</span>
          <span>${pharmacy.address}</span>
        </div>

        <div class="detail">
          <span class="ico">☎</span>
          <span>${pharmacy.phone}</span>
        </div>

        <div class="detail">
          <span class="ico">◷</span>
          <span>${pharmacy.hours}</span>
        </div>

        <div class="detail">
          <span class="ico">♢</span>
          <span>Medicine: <strong class="available">Available</strong></span>
        </div>
      </div>

      <div class="actions">
        <a class="btn btn-outline"
           href="tel:${pharmacy.phone.replace(/\\s/g, "")}">
          ☎ Call Pharmacy
        </a>

        <a class="btn btn-primary"
           target="_blank"
           rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.name + " " + pharmacy.address)}">
          ➤ Get Directions
        </a>
      </div>
    </article>
  `).join("");
}

// Update results immediately when the medicine or area changes.
medicineInput.addEventListener("input", renderPharmacies);
areaSelect.addEventListener("change", renderPharmacies);

renderPharmacies();
