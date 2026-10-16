
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

function renderAvailableSlots() {
    const schedule = window.CarePlusClinic?.getSchedule();
    const grid = document.getElementById("timeGrid");
    if (!schedule || !doctor) return;
    const date = dateInput.value;
    const day = new Date(`${date}T12:00:00`).getDay();
    const dayHours = schedule.dayHours?.[day];
    const start = dayHours?.start || schedule.start || "09:00";
    const end = dayHours?.end || schedule.end || "17:00";
    const duration = Math.max(15, Number(schedule.duration) || 30);
    const unavailable = (schedule.holidays || []).some(item => item.date === date);
    const slots = [];
    if (!unavailable && (schedule.days || [0,1,2,3,4,5,6]).includes(day) && start < end) {
        let cursor = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
        const finish = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
        const breakStart = schedule.breakStart ? Number(schedule.breakStart.slice(0,2))*60 + Number(schedule.breakStart.slice(3,5)) : -1;
        const breakEnd = schedule.breakEnd ? Number(schedule.breakEnd.slice(0,2))*60 + Number(schedule.breakEnd.slice(3,5)) : -1;
        while (cursor + duration <= finish) {
            const slot = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
            const duringBreak = breakStart >= 0 && cursor < breakEnd && cursor + duration > breakStart;
            const labelHour = Math.floor(cursor / 60) % 12 || 12;
            const labelSuffix = Math.floor(cursor / 60) >= 12 ? "PM" : "AM";
            const slotLabel = `${String(labelHour).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")} ${labelSuffix}`;
            if (!duringBreak && window.CarePlusClinic.isAvailable({ doctor, date, time: slotLabel })) slots.push(slot);
            cursor += duration;
        }
    }
    selectedTime = "";
    grid.innerHTML = slots.length ? slots.map(slot => {
        const [hour, minute] = slot.split(":").map(Number);
        const labelHour = hour % 12 || 12;
        const suffix = hour >= 12 ? "PM" : "AM";
        return `<button type="button" class="time-slot">${String(labelHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}</button>`;
    }).join("") : `<p class="time-hint">No available times for this date. Choose another date.</p>`;
    grid.querySelectorAll(".time-slot").forEach(button => button.addEventListener("click", function () {
        grid.querySelectorAll(".time-slot").forEach(slot => slot.classList.remove("selected"));
        this.classList.add("selected");
        selectedTime = this.textContent.trim();
        errorMessage.textContent = "";
        errorMessage.style.display = "none";
    }));
}

dateInput.addEventListener("change", renderAvailableSlots);
window.CarePlusClinic?.subscribe(renderAvailableSlots);
renderAvailableSlots();

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
