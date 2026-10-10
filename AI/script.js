document.getElementById("symptomForm").addEventListener("submit", function(event) {

  const selected = document.querySelectorAll(
    'input[name="symptom"]:checked'
  );

  const duration = document.getElementById("duration").value;
  const severity = document.getElementById("severity").value;

  // Check symptoms
  if (selected.length === 0) {
    event.preventDefault();
    alert("Please select at least one symptom.");
    return;
  }

  // Check duration
  if (!duration) {
    event.preventDefault();
    alert("Please select how long you have had the symptoms.");
    return;
  }

  // Check severity
  if (!severity) {
    event.preventDefault();
    alert("Please select the severity of your symptoms.");
    return;
  }

  // All required fields are completed.
  // The form will submit to Summary/index.html.
});