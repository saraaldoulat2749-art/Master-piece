
const params = new URLSearchParams(window.location.search);

const area = params.get("area") || "";
const specialty = params.get("specialty") || "";
const doctor = params.get("doctor") || "";
const image = params.get("image") || "";

// عرض معلومات الدكتور المختار من صفحة Book
document.getElementById("doctorName").textContent =
    doctor || "Doctor not selected";

document.getElementById("doctorSpecialty").textContent =
    specialty || "Specialty not selected";

document.getElementById("doctorArea").textContent =
    area || "Area not selected";

// صورة الدكتور
const doctorImage = document.getElementById("doctorImage");

if (image) {
    doctorImage.src = image;
} else {
    doctorImage.src =
        "https://placehold.co/200x200/e1f3f3/168f9b?text=Doctor";
}

doctorImage.onerror = function () {
    this.onerror = null;
    this.src =
        "https://placehold.co/200x200/e1f3f3/168f9b?text=Doctor";
};

// تحديد تاريخ اليوم ومنع اختيار تاريخ سابق
const dateInput = document.getElementById("appointmentDate");

function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

const today = getToday();

dateInput.min = today;
dateInput.value = today;

// اختيار الوقت
let selectedTime = "";

const errorMessage = document.getElementById("errorMessage");
const continueButton = document.getElementById("continueButton");

document.querySelectorAll(".time-slot").forEach(button => {
    button.addEventListener("click", function () {
        // إزالة التحديد عن الأوقات الأخرى
        document.querySelectorAll(".time-slot").forEach(slot => {
            slot.classList.remove("selected");
        });

        // تحديد الوقت المختار
        this.classList.add("selected");
        selectedTime = this.textContent.trim();

        errorMessage.textContent = "";
        errorMessage.style.display = "none";
    });
});

// إظهار رسالة الخطأ
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
}

// الانتقال إلى صفحة Review
continueButton.addEventListener("click", function (event) {
    event.preventDefault();

    errorMessage.textContent = "";
    errorMessage.style.display = "none";

    // التأكد من وجود معلومات الدكتور
    if (!area || !specialty || !doctor) {
        showError(
            "Please return to Book Appointment and select an area, specialty, and doctor."
        );
        return;
    }

    // التأكد من اختيار التاريخ
    if (!dateInput.value) {
        showError("Please select an appointment date.");
        dateInput.focus();
        return;
    }

    // منع التاريخ السابق لليوم
    if (dateInput.value < getToday()) {
        showError("Please select today or a future date.");
        dateInput.focus();
        return;
    }

    // التأكد من اختيار الوقت
    if (!selectedTime) {
        showError("Please select an available time slot.");
        return;
    }

    // إرسال جميع المعلومات إلى Review
    const reviewParams = new URLSearchParams({
        area: area,
        specialty: specialty,
        doctor: doctor,
        date: dateInput.value,
        time: selectedTime
    });

    if (image) {
        reviewParams.set("image", image);
    }

    // Review فولدر منفصل داخل Book
    window.location.href =
        "../Review/index.html?" + reviewParams.toString();
});
