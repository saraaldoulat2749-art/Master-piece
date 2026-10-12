/*
 * CarePlus demo access state. This is UI-only and is NOT authentication.
 * Replace these functions with a server-issued session before handling real data.
 */
(function () {
  const KEY = "careplusDemoSession";
  const root = new URL(".", document.currentScript.src);
  const home = new URL("Home/Master.html", root).href;
  const login = new URL("log%20in/login.html", root).href;
  const profile = new URL("Profile/index.html", root).href;

  function hasDemoSession() {
    try { return ["demo", "admin-demo"].includes(sessionStorage.getItem(KEY)); }
    catch { return false; }
  }

  function hasDemoAdminSession() {
    try { return sessionStorage.getItem(KEY) === "admin-demo"; }
    catch { return false; }
  }

  function startDemoSession(role = "user", identity = "") {
    try {
      sessionStorage.setItem(KEY, role === "admin" ? "admin-demo" : "demo");
      if (role !== "admin" && identity) {
        sessionStorage.setItem("careplusDemoIdentity", identity);
        window.CarePlusData?.upsertDemoUser(identity);
      }
      return true;
    }
    catch { return false; }
  }

  function endDemoSession() {
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem("careplusDemoIdentity");
    } catch {}
  }

  function paintNavigation() {
    document.querySelectorAll("[data-profile-link]").forEach(link => { link.href = profile; });
    document.querySelectorAll("[data-auth-toggle]").forEach(link => {
      const loggedIn = hasDemoSession();
      const label = loggedIn ? "LOG OUT" : "LOG IN";
      if (link.textContent !== label) link.textContent = label;
      link.href = loggedIn ? home : login;
      link.setAttribute("aria-label", loggedIn ? "Log out" : "Log in");
      link.onclick = event => {
        event.preventDefault();
        if (loggedIn) {
          endDemoSession();
          window.location.assign(home);
        } else {
          window.location.assign(login);
        }
      };
    });
  }

  function guardProtectedPage() {
    if (document.body?.dataset.protected === "true" && !hasDemoSession()) {
      window.location.replace(login);
      return;
    }
    if (document.body?.dataset.adminProtected === "true" && !hasDemoAdminSession()) {
      window.location.replace(hasDemoSession() ? home : login);
    }
  }

  window.CarePlusAuth = { hasDemoSession, hasDemoAdminSession, startDemoSession, endDemoSession, paintNavigation, guardProtectedPage };
  guardProtectedPage();
  new MutationObserver(paintNavigation).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => { guardProtectedPage(); paintNavigation(); });
  window.addEventListener("pageshow", () => { guardProtectedPage(); paintNavigation(); });
})();
