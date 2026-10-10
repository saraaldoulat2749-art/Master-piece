const form = document.getElementById("bookingForm");
const specialtySelect = document.getElementById("specialty");
const areaSelect = document.getElementById("area");
const doctorSelect = document.getElementById("doctor");
const findButton = document.querySelector(".find-button");

// اختيار التخصص من الكروت
document.querySelectorAll(".specialty").forEach(card => {
    card.addEventListener("click", function () {
        specialtySelect.value = this.dataset.specialty;

        document.querySelectorAll(".specialty").forEach(item => {
            item.classList.remove("selected");
        });

        this.classList.add("selected");
    });
});

// الانتقال لصفحة Time بعد التأكد من تعبئة البيانات
findButton.addEventListener("click", function (event) {
    event.preventDefault();

    const area = areaSelect.value;
    const specialty = specialtySelect.value;
    const doctor = doctorSelect.value;

    if (!area || !specialty || !doctor) {
        alert("Please select your area, specialty, and doctor.");
        return;
    }

    const params = new URLSearchParams({
        area: area,
        specialty: specialty,
        doctor: doctor
    });

    window.location.href = "Time/index.html?" + params.toString();
});