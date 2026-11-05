
document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("register-form");

    const message =
        document.getElementById("register-message");

    const button =
        document.getElementById("register-submit");

    if (!form) return;

    function showMessage(text) {
        message.textContent = text || "";
        message.hidden = !text;

        window.CarePlusMotion?.updateHeight();
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        showMessage("");

        const name = form.elements
            .namedItem("name").value.trim();

        const email = form.elements
            .namedItem("email").value.trim().toLowerCase();

        const phone = form.elements
            .namedItem("phone").value.trim();

        const role = form.elements.namedItem("role")?.value || "patient";

        const password = form.elements
            .namedItem("password").value;

        const confirm = form.elements
            .namedItem("confirm").value;

        if (
            name.length < 2 ||
            !(window.CarePlusAuth?.isValidEmail?.(email) ?? /^\S+@\S+\.\S{2,}$/.test(email))
        ) {
            showMessage(
                "Enter your full name and a valid email."
            );
            return;
        }

        if (password.length < 8 || password.length > 128) {
            showMessage(
                "Password must be between 8 and 128 characters."
            );
            return;
        }

        if (password !== confirm) {
            showMessage(
                "Passwords do not match."
            );
            return;
        }

        button.disabled = true;
        button.classList.add("is-loading");

        try {
            if (!window.CarePlusAuth?.registerCustomer) {
                throw new Error(
                    "Registration service is unavailable."
                );
            }

            const result =
                await window.CarePlusAuth.registerCustomer({
                    name,
                    email,
                    phone,
                    password,
                    role
                });

            if (!result?.ok) {
                throw new Error(
                    result?.error ||
                    "Account creation failed."
                );
            }

            if (result.autoLogin && ["doctor", "nurse", "pharmacy"].includes(result.role)) {
                const applicationPages = { doctor: "../DoctorVerification/index.html", nurse: "../NurseVerification/index.html", pharmacy: "../PharmacyVerification/index.html" };
                window.location.assign(applicationPages[result.role]);
                return;
            }

            // Clear the form
            form.reset();

            // Switch back to login with animation
            window.CarePlusMotion?.switchTo("login");

            const loginMessage =
                document.getElementById("form-message");

            if (loginMessage) {
                loginMessage.textContent =
                    "Account created successfully! Please log in.";

                loginMessage.classList.add("success");
                loginMessage.hidden = false;
            }

            window.CarePlusMotion?.updateHeight();

        } catch (error) {
            showMessage(
                error.message ||
                "Could not create your account."
            );

        } finally {
            button.disabled = false;
            button.classList.remove("is-loading");
        }
    });
});
