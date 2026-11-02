
document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("login-form");
    const message = document.getElementById("form-message");
    const password = document.getElementById("password");
    const identity = document.getElementById("identity");
    const button = form?.querySelector(".submit");

    if (!form) return;

    function showMessage(text, success = false) {
        message.textContent = text || "";
        message.hidden = !text;
        message.classList.toggle("success", success);

        window.CarePlusMotion?.updateHeight();
    }

    const params = new URLSearchParams(location.search);

    if (params.get("registered") === "1") {
        showMessage(
            "Account created successfully! Please log in.",
            true
        );
    }

    if (params.get("reset") === "1") {
        showMessage("Password updated. You can now sign in.", true);
    }

    document.getElementById("forgot-link")
        ?.addEventListener("click", event => {

            event.preventDefault();
            window.location.assign("forgot-password.html");
        });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        showMessage("");

        const email =
            identity.value.trim().toLowerCase();

        if (
            !(window.CarePlusAuth?.isValidEmail?.(email) ?? /^\S+@\S+\.\S{2,}$/.test(email)) ||
            !password.value || password.value.length > 128
        ) {
            showMessage(
                "Please enter a valid email and password."
            );
            return;
        }

        button.disabled = true;
        button.classList.add("is-loading");

        try {
            if (!window.CarePlusAuth?.loginCustomer) {
                throw new Error(
                    "Login service is unavailable."
                );
            }

            await window.CarePlusAuth.ensureDemoAdmin?.();

            const result =
                await window.CarePlusAuth.loginCustomer(
                    email,
                    password.value
                );

            if (!result?.ok) {
                throw new Error(
                    result?.error ||
                    "Incorrect email or password."
                );
            }

            if (result.mustChangePassword) {
                window.location.assign("change-password.html");
                return;
            }

            const destinations = {
                admin: "../Admin/index.html",
                doctor: "../Doctor/index.html",
                nurse: "../Nurse/index.html",
                pharmacy: "../Pharmacy/dashboard.html"
            };

            let destination = new URL(
                destinations[result.role] ||
                "../Home/Master.html",
                document.baseURI
            );

            // Safe return destination for customers
            if (result.role === "user") {
                const requested = new URLSearchParams(
                    location.search
                ).get("returnTo");

                if (requested) {
                    try {
                        const target = new URL(
                            requested,
                            location.href
                        );

                        const path =
                            target.pathname.toLowerCase();

                        const restricted =
                            /\/(admin|doctor|nurse)(\/|$)/.test(path) ||
                            /\/pharmacy\/dashboard\.html$/.test(path);

                        const authPage =
                            /\/(login|register)\.html$/.test(path);

                        if (
                            target.origin === location.origin &&
                            !restricted &&
                            !authPage
                        ) {
                            destination = target;
                        }
                    } catch {
                        // Ignore invalid URL
                    }
                }
            }

            window.location.assign(destination.href);

        } catch (error) {
            showMessage(
                error.message ||
                "Unable to sign in. Please try again."
            );
            password.focus();

        } finally {
            button.disabled = false;
            button.classList.remove("is-loading");
        }
    });
});
