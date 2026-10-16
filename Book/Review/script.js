
document.addEventListener("DOMContentLoaded", function () {

    // استلام معلومات الحجز من صفحة Time
    const params = new URLSearchParams(window.location.search);

    const area = params.get("area") || "";
    const specialty = params.get("specialty") || "";
    const doctor = params.get("doctor") || "";
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

    // عرض صورة الدكتور
    const doctorImage = document.getElementById("doctorImage");

    if (image) {
        doctorImage.src = image;
    } else {
        doctorImage.src =
            "https://placehold.co/160x160/e1f3f3/168f9b?text=Doctor";
    }

    doctorImage.onerror = function () {
        this.onerror = null;
        this.src =
            "https://placehold.co/160x160/e1f3f3/168f9b?text=Doctor";
    };

    // عرض التاريخ بتنسيق واضح
    const appointmentDate =
        document.getElementById("appointmentDate");

    if (date) {
        const dateObject = new Date(date + "T12:00:00");

        appointmentDate.textContent =
            dateObject.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric"
            });
    } else {
        appointmentDate.textContent = "Date not selected";
    }

    // عرض الوقت
    document.getElementById("appointmentTime").textContent =
        time || "Time not selected";

    // تأكيد الحجز
    const confirmButton =
        document.getElementById("confirmButton");

    const errorMessage =
        document.getElementById("errorMessage");

    function isCurrentAvailability() {
        return Boolean(window.CarePlusClinic?.isAvailable({ doctor, date, time }));
    }

    confirmButton.addEventListener("click", function (event) {
        event.preventDefault();

        errorMessage.textContent = "";
        errorMessage.style.display = "none";

        // قراءة بيانات المريض
        const patientName =
            document.getElementById("patientName").value.trim();

        const patientPhone =
            document.getElementById("patientPhone").value.trim();

        const patientEmail =
            document.getElementById("patientEmail").value.trim();

        // التحقق من معلومات الدكتور والموعد
        if (!doctor || !specialty || !area || !date || !time) {
            errorMessage.textContent =
                "Appointment details are missing. Please return and complete your booking.";

            errorMessage.style.display = "block";
            return;
        }

        // التحقق من اسم المريض ورقم الهاتف
        if (!patientName || !patientPhone) {
            errorMessage.textContent =
                "Please enter your full name and phone number.";

            errorMessage.style.display = "block";
            return;
        }

        if (!isCurrentAvailability()) {
            errorMessage.textContent = "This time is no longer available. Please return to the schedule and select another time.";
            errorMessage.style.display = "block";
            return;
        }

        const userIdentity = sessionStorage.getItem("careplusDemoIdentity") || localStorage.getItem("careplusDemoIdentity") || "";
        const matchedUser = window.CarePlusData?.list("users").find(user => user.email?.toLowerCase() === userIdentity.toLowerCase() || user.phone === userIdentity);
        const result = window.CarePlusClinic?.createBooking({
            patient: patientName, phone: patientPhone, email: patientEmail, userId: matchedUser?.id || "",
            doctor, specialty, area, date, time
        });
        if (!result?.ok) {
            errorMessage.textContent = result?.error || "Could not save this booking. Please try again.";
            errorMessage.style.display = "block";
            return;
        }
        const appointment = result.appointment;

        // تجهيز جميع المعلومات لصفحة النجاح
        const successParams = new URLSearchParams({
            area: area,
            specialty: specialty,
            doctor: doctor,
            date: date,
            time: time,
            patientName: patientName,
            patientPhone: patientPhone,
            patientEmail: patientEmail,
            appointmentId: appointment.id
        });

        if (image) {
            successParams.set("image", image);
        }

        // الانتقال إلى فولدر Success المنفصل داخل Book
        window.location.href =
            "../Success/index.html?" + successParams.toString();
    });

});
