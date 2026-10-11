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
}

function showMessage(state) {
  message.dataset.state = state;
  message.hidden = !state;
}

document.getElementById("toggle-password").addEventListener("click", () => {
  password.type = password.type === "password" ? "text" : "password";
});

document.getElementById("forgot-link").addEventListener("click", event => {
  event.preventDefault();
  showMessage("recovery");
});

form.addEventListener("submit", event => {
  event.preventDefault();
  showMessage("");
  const identity = document.getElementById("identity");
  if (!identity.value.trim() || !password.value) {
    showMessage("required");
    (!identity.value.trim() ? identity : password).focus();
    return;
  }
  button.disabled = true;
  button.classList.add("is-loading");
  window.setTimeout(() => {
    button.disabled = false;
    button.classList.remove("is-loading");
    showMessage("unavailable");
  }, 350);
});
