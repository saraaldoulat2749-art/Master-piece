
const params = new URLSearchParams(window.location.search);

// استلام معلومات الحجز من صفحة Time
const doctor = params.get("doctor") || "";
const specialty = params.get("specialty") || "";
const area = params.get("area") || "";
const image = params.get("image") || "";
const date = params.get("date") || "";
const time = params.get("time") || "";

// عرض معلومات الدكتور
document.getElementById("doctorName").textContent =
    doctor || "Doctor not selected";

document.getElementById("doctorSpecialty").textContent =
    specialty || "Specialty not selected";

document.getElementById("doctorArea").textContent =
    area || "Area not selected";

// عرض تفاصيل الموعد
document.getElementById("appointmentDate").textContent =
    date || "Not specified";

document.getElementById("appointmentTime").textContent =
    time || "Not specified";

document.getElementById("appointmentLocation").textContent =
    area || "Not specified";

// عرض صورة الدكتور
const doctorImage = document.getElementById("doctorImage");

if (doctorImage && image) {
    doctorImage.src = image;
}

if (doctorImage) {
    doctorImage.onerror = function () {
        this.onerror = null;
        this.src =
            "https://placehold.co/200x200/e8f8f7/087f86?text=Doctor";
    };
}

// تأكيد الحجز والانتقال إلى Success
const confirmButton = document.getElementById("confirmButton");
const errorMessage = document.getElementById("errorMessage");

if (confirmButton) {
    confirmButton.addEventListener("click", function (event) {
        event.preventDefault();

        // التأكد من تعبئة جميع بيانات الموعد
        if (!doctor || !specialty || !area || !date || !time) {
            if (errorMessage) {
                errorMessage.textContent =
                    "Booking information is incomplete. Please return and complete all required fields.";
                errorMessage.style.display = "block";
            } else {
                alert(
                    "Booking information is incomplete. Please return and complete all required fields."
                );
            }

            return;
        }

        // إرسال المعلومات إلى صفحة النجاح
        const successParams = new URLSearchParams({
            doctor: doctor,
            specialty: specialty,
            area: area,
            date: date,
            time: time
        });

        if (image) {
            successParams.set("image", image);
        }

        window.location.href =
            "../Success/index.html?" + successParams.toString();
    });
}
