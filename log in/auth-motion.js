
document.addEventListener("DOMContentLoaded", () => {

    const body = document.body;
    const stage = document.getElementById("auth-stage");

    const loginPanel =
        document.getElementById("login-panel");

    const registerPanel =
        document.getElementById("register-panel");

    if (!stage || !loginPanel || !registerPanel) {
        return;
    }

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    let currentView =
        body.dataset.initial === "register"
            ? "register"
            : "login";

    function getPanel(view) {
        return view === "login"
            ? loginPanel
            : registerPanel;
    }

    function updateHeight() {
        const activePanel = getPanel(currentView);
        stage.style.height = activePanel.scrollHeight + "px";
    }

    function updateAccess() {
        [loginPanel, registerPanel].forEach(panel => {
            const active =
                panel === getPanel(currentView);

            panel.inert = !active;

            panel.setAttribute(
                "aria-hidden",
                String(!active)
            );
        });
    }

    function switchTo(view, updateUrl = true) {
        if (
            view !== "login" &&
            view !== "register"
        ) {
            return;
        }

        if (view === currentView) {
            return;
        }

        const oldPanel = getPanel(currentView);
        const newPanel = getPanel(view);

        // Remove outgoing panel
        oldPanel.classList.remove("is-active");

        // Activate incoming panel
        newPanel.classList.add("is-active");

        currentView = view;
        body.dataset.view = view;

        updateAccess();

        // Smooth card resizing
        requestAnimationFrame(updateHeight);

        document.title =
            view === "login"
                ? "Login | CarePlus"
                : "Sign Up | CarePlus";

        // Change URL without reloading the page
        if (updateUrl) {
            const target = view === "login"
                ? "login.html"
                : "register.html";

            const url = new URL(target, location.href);

            history.pushState(
                { authView: view },
                "",
                url.pathname + url.search
            );
        }

        if (reducedMotion) {
            updateHeight();
        }
    }

    // Initialize the currently active panel
    getPanel(currentView).classList.add("is-active");

    updateHeight();
    updateAccess();

    // Remove initial CSS override after initialization
    body.removeAttribute("data-initial");
    body.dataset.view = currentView;

    // Switch when clicking Sign Up / Sign In
    document.querySelectorAll("[data-switch]")
        .forEach(link => {

            link.addEventListener("click", event => {
                if (
                    event.button !== 0 ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                ) {
                    return;
                }

                event.preventDefault();

                const nextView = link.dataset.switch;

                switchTo(nextView);
            });
        });

    // Browser back/forward support
    window.addEventListener("popstate", () => {
        const path = location.pathname.toLowerCase();

        const view = path.endsWith("register.html")
            ? "register"
            : "login";

        switchTo(view, false);
    });

    window.addEventListener("resize", updateHeight);

    // Resize card when an error message appears
    const observer = new MutationObserver(() => {
        requestAnimationFrame(updateHeight);
    });

    observer.observe(loginPanel, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["hidden", "class"]
    });

    observer.observe(registerPanel, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["hidden", "class"]
    });

    // Show / Hide Password
    document.querySelectorAll(".eye-button")
        .forEach(button => {

            button.addEventListener("click", () => {
                const input = document.getElementById(
                    button.dataset.toggle
                );

                if (!input) return;

                const visible = input.type === "password";

                input.type = visible ? "text" : "password";

                button.textContent =
                    visible ? "◌" : "◉";

                button.setAttribute(
                    "aria-label",
                    visible
                        ? "Hide password"
                        : "Show password"
                );
            });
        });

    // Available for other scripts if needed
    window.CarePlusMotion = {
        switchTo,
        updateHeight
    };
});
