const registerForm = document.getElementById("register-form");
const registerMessage = document.getElementById("register-message");
const registerButton = document.getElementById("register-submit");

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  registerMessage.hidden = true;
  const name = registerForm.elements.namedItem("name").value.trim();
  const email = registerForm.elements.namedItem("email").value.trim().toLowerCase();
  const phone = registerForm.elements.namedItem("phone").value.trim();
  const password = registerForm.elements.namedItem("password").value;
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    registerMessage.textContent = "Enter your name, a valid email, and a password with at least 8 characters.";
    registerMessage.hidden = false;
    return;
  }

  registerButton.disabled = true;
  registerButton.classList.add("is-loading");
  try {
    if (!window.CarePlusAuth?.registerCustomer) {
      throw new Error("Account creation is unavailable in this browser.");
    }
    const result = await window.CarePlusAuth.registerCustomer({ name, email, phone, password });
    if (result?.ok) {
      window.location.assign(new URL("login.html?registered=1", document.baseURI).href);
      return;
    }
    throw new Error(result?.error || "Account creation is unavailable in this browser.");
  } catch (error) {
    registerButton.disabled = false;
    registerButton.classList.remove("is-loading");
    registerMessage.textContent = error.message || "Could not create your account. Please try again.";
    registerMessage.hidden = false;
  }
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const visual = document.querySelector(".health-visual");
  const nodes = [...(visual?.querySelectorAll(".health-node") || [])];
  visual?.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") return;
    const bounds = visual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    nodes.forEach((node, index) => {
      const depth = .35 + (index % 4) * .18;
      node.style.setProperty("--mouse-x", `${x * 30 * depth}px`);
      node.style.setProperty("--mouse-y", `${y * 24 * depth}px`);
    });
  });
  visual?.addEventListener("pointerleave", () => nodes.forEach(node => {
    node.style.setProperty("--mouse-x", "0px");
    node.style.setProperty("--mouse-y", "0px");
  }));
}
