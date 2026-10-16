const form = document.getElementById("login-form");
const message = document.getElementById("form-message");
const password = document.getElementById("password");
const button = form.querySelector(".submit");
const loginScene = document.querySelector(".login-shell");
const loginCard = document.querySelector(".form-side");
const floatingLogos = [...document.querySelectorAll(".floating-logo")];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  loginScene.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || window.innerWidth <= 800) return;
    const bounds = loginScene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const horizontal = x - 0.5;
    const vertical = y - 0.5;
    loginScene.style.setProperty("--pointer-x", `${x * 100}%`);
    loginScene.style.setProperty("--pointer-y", `${y * 100}%`);
    loginCard.style.setProperty("--tilt-x", `${vertical * -5}deg`);
    loginCard.style.setProperty("--tilt-y", `${horizontal * 5}deg`);
    floatingLogos.forEach((logo, index) => {
      const direction = index % 2 ? -1 : 1;
      logo.style.setProperty("--logo-x", `${horizontal * 18 * direction}px`);
      logo.style.setProperty("--logo-y", `${vertical * 18 * direction}px`);
    });
  });
  loginScene.addEventListener("pointerleave", () => {
    loginScene.style.setProperty("--pointer-x", "50%");
    loginScene.style.setProperty("--pointer-y", "45%");
    loginCard.style.setProperty("--tilt-x", "0deg");
    loginCard.style.setProperty("--tilt-y", "0deg");
    floatingLogos.forEach(logo => {
      logo.style.setProperty("--logo-x", "0px");
      logo.style.setProperty("--logo-y", "0px");
    });
  });
  const healthVisual = document.querySelector(".health-visual");
  if (healthVisual) {
    const nodes = [...healthVisual.querySelectorAll(".health-node")];
    healthVisual.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse") return;
      const bounds = healthVisual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      nodes.forEach((node, index) => {
        const depth = 0.35 + (index % 4) * 0.18;
        node.style.setProperty("--mouse-x", `${x * 30 * depth}px`);
        node.style.setProperty("--mouse-y", `${y * 24 * depth}px`);
      });
    });
    healthVisual.addEventListener("pointerleave", () => {
      nodes.forEach(node => {
        node.style.setProperty("--mouse-x", "0px");
        node.style.setProperty("--mouse-y", "0px");
      });
    });
  }
}

function showMessage(state) {
  message.dataset.state = state;
  message.hidden = !state;
}

if (new URLSearchParams(window.location.search).get("registered") === "1") showMessage("success");

document.getElementById("toggle-password").addEventListener("click", () => {
  password.type = password.type === "password" ? "text" : "password";
});

const forgotLink = document.getElementById("forgot-link");
if (forgotLink) {
  forgotLink.addEventListener("click", event => {
    event.preventDefault();
    showMessage("recovery");
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage("");
  const identity = document.getElementById("identity");
  const email = identity.value.trim().toLowerCase();
  if (!email || !password.value || !/^\S+@\S+\.\S+$/.test(email)) {
    showMessage("required");
    (!identity.value.trim() ? identity : password).focus();
    return;
  }
  button.disabled = true;
  button.classList.add("is-loading");
  try {
    await window.CarePlusAuth?.ensureDemoAdmin();
    const result = await window.CarePlusAuth?.loginCustomer(email, password.value);
    if (!result?.ok) {
      button.disabled = false;
      button.classList.remove("is-loading");
      const invalidMessage = message.querySelector(".notice-invalid");
      if (invalidMessage && result?.error) invalidMessage.textContent = result.error;
      showMessage("invalid");
      password.focus();
      return;
    }
    const destinations = { admin: "../Admin/index.html", doctor: "../Doctor/index.html", pharmacy: "../Pharmacy/dashboard.html", nurse: "../Nurse/index.html" };
    let destination = new URL(destinations[result.role] || "../Home/Master.html", document.baseURI);
    if (result.role === "user") {
      const requested = new URLSearchParams(window.location.search).get("returnTo");
      if (requested) {
        try {
          const safeTarget = new URL(requested, window.location.href);
          const path = safeTarget.pathname.toLowerCase();
          const roleDashboard = /\/(admin|doctor|nurse)(\/|$)/.test(path) || /\/pharmacy\/dashboard\.html$/.test(path);
          const authPage = /\/log%20in\/(login|register)\.html$/.test(path);
          if (safeTarget.origin === window.location.origin && !roleDashboard && !authPage) destination = safeTarget;
        } catch {}
      }
    }
    window.location.assign(destination.href);
  } catch {
    button.disabled = false;
    button.classList.remove("is-loading");
    showMessage("invalid");
  }
});
