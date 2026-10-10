const params = new URLSearchParams(window.location.search);

const symptoms = params.getAll("symptom");
const duration = params.get("duration") || "";
const severity = params.get("severity") || "";
const details = params.get("details") || "";

// Return to the form if required information is missing.
if (
  symptoms.length === 0 ||
  !duration ||
  !severity
) {
  alert("Please complete all required fields first.");
  window.location.replace("../index.html");
}
// Display symptoms received from the first page.
const chips = document.getElementById("symptomChips");

if (symptoms.length > 0) {
  symptoms.forEach(function(symptom) {
    const chip = document.createElement("span");

    chip.className = "chip";
    chip.textContent = symptom;

    chips.appendChild(chip);
  });
} else {
  document.getElementById("noSymptoms").hidden = false;

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = "No symptoms selected";

  chips.appendChild(chip);
}

// Display the remaining submitted information.
document.getElementById("duration").textContent = duration;
document.getElementById("severity").textContent = severity;

// Display optional details, if provided.
if (details.trim()) {
  const detailsBox = document.getElementById("detailsBox");

  detailsBox.hidden = false;
  detailsBox.textContent = "Additional details: " + details;
}

// Basic guidance rules, not an AI diagnosis.
const guidance = document.getElementById("guidance");

if (
  severity === "Severe" ||
  symptoms.includes("Shortness of breath")
) {
  guidance.className = "notice warn";
  guidance.textContent =
    "You reported severe symptoms or shortness of breath. " +
    "Seek prompt medical assessment. If breathing difficulty is severe, " +
    "sudden, or worsening, or you have chest pain, confusion, or blue/grey lips, " +
    "seek emergency care now.";

} else if (severity === "Moderate") {
  guidance.className = "notice warn";
  guidance.textContent =
    "Because you reported moderate symptoms, consider contacting a healthcare " +
    "professional for advice, particularly if symptoms persist or worsen.";

} else if (
  symptoms.includes("Fever") ||
  symptoms.includes("Stomach pain") ||
  symptoms.includes("Dizziness")
) {
  guidance.className = "notice info";
  guidance.textContent =
    "Monitor your symptoms and how they change. Contact a healthcare professional " +
    "if symptoms persist, worsen, or you are concerned.";

} else {
  guidance.className = "notice info";
  guidance.textContent =
    "For mild symptoms, rest and fluids may help when appropriate. " +
    "Monitor how you feel and seek professional advice if symptoms persist, " +
    "worsen, or concern you.";
}