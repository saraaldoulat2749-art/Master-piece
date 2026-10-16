
(function () {
  // Browser-only demo auth adapter. Replace account lookup, password checks, and
  // session creation with server-validated ASP.NET Core endpoints before production.
  const KEY = "careplusDemoSession";
  const USER_KEY = "careplusDemoIdentity";
  const CREDENTIALS_KEY = "careplusDemoCredentialsV1";
  const ACCOUNT_ID_KEY = "careplusDemoAccountIdV1";
  const SESSION_VERSION_KEY = "careplusDemoSessionVersionV1";
  const root = new URL(".", document.currentScript.src);
  const home = new URL("Home/Master.html", root).href;
  const login = new URL("log%20in/login.html", root).href;
  const profile = new URL("Profile/index.html", root).href;
  function loginUrl(returnTo = window.location.href) {
    const destination = new URL(login);
    const target = new URL(returnTo, window.location.href);
    if (target.origin === window.location.origin) destination.searchParams.set("returnTo", target.href);
    return destination.href;
  }

  function findAccount(identity) {
    const email = String(identity || "").trim().toLowerCase();
    return window.CarePlusData?.list("users").find(user => String(user.email || "").trim().toLowerCase() === email) || null;
  }
  function accountRole(account) { return String(account?.role || "Customer").trim().toLowerCase(); }
  function accountState(account) {
    const role = accountRole(account);
    if (["doctor", "pharmacy"].includes(role)) {
      const state = String(account.accountStatus || account.status || "Pending").toLowerCase();
      return state === "active" && String(account.approvalStatus || "Approved").toLowerCase() === "approved" ? "active" : state;
    }
    return String(account?.status || "Active").toLowerCase();
  }
  function currentAccount() {
    if (!window.CarePlusData) return null;
    const identity = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) || "";
    const id = sessionStorage.getItem(ACCOUNT_ID_KEY) || "";
    const account = findAccount(identity);
    if (!account || (id && String(account.id) !== id) || accountState(account) !== "active") return null;
    return account;
  }
  function hasDemoSession() {
    try {
      const session = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
      if (!session) return false;
      if (!window.CarePlusData) return false;
      if (sessionStorage.getItem(SESSION_VERSION_KEY) !== "2") { endDemoSession(); return false; }
      const account = currentAccount();
      if (!account) { endDemoSession(); return false; }
      const role = accountRole(account);
      const roleMatches = session === "admin-demo" ? ["admin", "administrator"].includes(role)
        : session === "pharmacy-demo" ? role === "pharmacy"
        : session === "doctor-demo" ? role === "doctor"
        : session === "nurse-demo" ? role === "nurse"
        : session === "demo" ? !["admin", "administrator", "doctor", "pharmacy", "nurse"].includes(role) : false;
      if (!roleMatches) { endDemoSession(); return false; }
      return true;
    }
    catch { return false; }
  }

  function hasDemoCustomerSession() {
    try {
      return hasDemoSession()
        && (localStorage.getItem(KEY) === "demo" || sessionStorage.getItem(KEY) === "demo")
        && Boolean(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY));
    }
    catch { return false; }
  }

  function hasDemoAdminSession() {
    try { return hasDemoSession() && sessionStorage.getItem(KEY) === "admin-demo"; }
    catch { return false; }
  }

  function hasDemoPharmacySession() {
    try {
      return hasDemoSession() && sessionStorage.getItem(KEY) === "pharmacy-demo"
        && Boolean(currentAccount()?.pharmacyId && window.CarePlusData?.get("pharmacies", currentAccount().pharmacyId));
    }
    catch { return false; }
  }

  function demoPharmacyId() {
    return hasDemoPharmacySession() ? String(currentAccount().pharmacyId) : null;
  }
  function demoPharmacyAccount() {
    return hasDemoPharmacySession() ? currentAccount() : null;
  }

  function hasDemoDoctorSession() {
    try { return hasDemoSession() && sessionStorage.getItem(KEY) === "doctor-demo" && accountRole(currentAccount()) === "doctor"; }
    catch { return false; }
  }
  function demoDoctorAccount() { return hasDemoDoctorSession() ? currentAccount() : null; }

  function hasDemoNurseSession() {
    try { return hasDemoSession() && sessionStorage.getItem(KEY) === "nurse-demo" && accountRole(currentAccount()) === "nurse"; }
    catch { return false; }
  }
  function demoNurseAccount() { return hasDemoNurseSession() ? currentAccount() : null; }

  function startDemoSession(role = "user", identity = "") {
    try {
      const account = findAccount(identity);
      if (!account || accountState(account) !== "active") return false;
      const actualRole = accountRole(account);
      const expected = actualRole === "administrator" || actualRole === "admin" ? "admin"
        : actualRole === "doctor" ? "doctor" : actualRole === "pharmacy" ? "pharmacy" : actualRole === "nurse" ? "nurse" : "user";
      if (role !== expected) return false;
      endDemoSession();
      sessionStorage.setItem(KEY, expected === "admin" ? "admin-demo" : expected === "pharmacy" ? "pharmacy-demo" : expected === "doctor" ? "doctor-demo" : expected === "nurse" ? "nurse-demo" : "demo");
      sessionStorage.setItem(USER_KEY, String(account.email).toLowerCase());
      sessionStorage.setItem(ACCOUNT_ID_KEY, String(account.id));
      sessionStorage.setItem(SESSION_VERSION_KEY, "2");
      if (expected === "user") localStorage.setItem(KEY, "demo");
      return true;
    }
    catch { return false; }
  }

  function endDemoSession() {
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem("careplusDemoPharmacyIdV1");
      sessionStorage.removeItem(ACCOUNT_ID_KEY);
      sessionStorage.removeItem(SESSION_VERSION_KEY);
      localStorage.removeItem(KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }

  function readCredentials() {
    try { return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "{}"); }
    catch { return {}; }
  }

  function toBase64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
  function fromBase64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
  async function passwordHash(password, salt) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
  }

  async function registerCustomer({ name, email, phone, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!window.CarePlusData) return { ok: false, error: "Account storage is unavailable in this browser." };
    if (window.CarePlusData.list("users").some(user => user.email?.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: "An account with this email already exists. Please log in." };
    }
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(String(password), salt);
      const user = window.CarePlusData.create("users", {
        name: String(name).trim(), email: normalizedEmail, phone: String(phone || "").trim(),
        role: "Customer", status: "Active", source: "demo-signup"
      });
      if (!user) return { ok: false, error: "Could not save the account. Please try again." };
      const credentials = readCredentials();
      credentials[normalizedEmail] = { salt: toBase64(salt), hash: toBase64(hash) };
      try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); }
      catch {
        window.CarePlusData.remove("users", user.id);
        return { ok: false, error: "Account storage is full or unavailable." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Password protection is unavailable in this browser. Open the site over localhost or HTTPS." };
    }
  }

  async function loginCustomer(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = findAccount(normalizedEmail);
    const credential = readCredentials()[normalizedEmail];
    if (!user || !credential) return { ok: false, error: "Email or password is incorrect." };
    try {
      const candidate = new Uint8Array(await passwordHash(String(password), fromBase64(credential.salt)));
      const expected = fromBase64(credential.hash);
      let mismatch = candidate.length ^ expected.length;
      for (let index = 0; index < Math.min(candidate.length, expected.length); index += 1) mismatch |= candidate[index] ^ expected[index];
      if (mismatch) return { ok: false, error: "Email or password is incorrect." };
      const role = accountRole(user);
      const targetRole = ["admin", "administrator"].includes(role) ? "admin" : role === "doctor" ? "doctor" : role === "pharmacy" ? "pharmacy" : role === "nurse" ? "nurse" : "user";
      if (accountState(user) !== "active") return { ok: false, error: "This account is pending approval or inactive. Contact CarePlus administration." };
      if (targetRole === "doctor" && !user.doctorId) return { ok: false, error: "This doctor account is not linked to a doctor profile yet." };
      if (targetRole === "pharmacy" && (!user.pharmacyId || !window.CarePlusData?.get("pharmacies", user.pharmacyId))) return { ok: false, error: "This pharmacy account is not linked to a pharmacy profile yet." };
      return startDemoSession(targetRole, normalizedEmail) ? { ok: true, user, role: targetRole } : { ok: false, error: "Could not start your session." };
    } catch { return { ok: false, error: "Could not verify your account in this browser." }; }
  }

  function paintNavigation() {
    document.querySelectorAll("[data-profile-link]").forEach(link => { link.href = profile; });
    const customer = hasDemoCustomerSession();
    const admin = hasDemoAdminSession();
    const pharmacy = hasDemoPharmacySession();
    const doctor = hasDemoDoctorSession();
    const nurse = hasDemoNurseSession();
    document.querySelectorAll(".careplus-navbar__signup, .careplus-navbar__signup-mobile").forEach(link => { link.hidden = customer; });
    document.querySelectorAll("[data-customer-profile]").forEach(profileControl => { profileControl.hidden = !customer; });
    document.querySelectorAll("[data-auth-toggle]").forEach(link => {
      if (customer) { link.hidden = true; return; }
      link.hidden = false;
      const loggedIn = admin || pharmacy || doctor || nurse;
      const label = loggedIn ? "LOG OUT" : "Log In";
      if (link.textContent !== label) link.textContent = label;
      link.href = loggedIn ? home : login;
      link.setAttribute("aria-label", loggedIn ? "Log out" : "Log in");
      link.onclick = event => {
        event.preventDefault();
        if (loggedIn) {
          endDemoSession();
          window.location.assign(home);
        } else {
          window.location.assign(loginUrl());
        }
      };
    });
    document.querySelectorAll("[data-profile-trigger]").forEach(trigger => {
      const menu = trigger.parentElement.querySelector("[data-profile-menu]");
      trigger.onclick = event => {
        event.stopPropagation();
        const open = trigger.getAttribute("aria-expanded") !== "true";
        trigger.setAttribute("aria-expanded", String(open));
        menu.hidden = !open;
      };
    });
    document.querySelectorAll("[data-profile-logout]").forEach(button => {
      button.onclick = () => { endDemoSession(); window.location.assign(home); };
    });
  }

  function guardProtectedPage() {
    if (!window.CarePlusData) return;
    if (document.body?.dataset.protected === "true" && !hasDemoSession()) {
      window.location.replace(loginUrl());
      return;
    }
    if (document.body?.dataset.adminProtected === "true" && !hasDemoAdminSession()) {
      window.location.replace(hasDemoSession() ? home : login);
    }
    if (document.body?.dataset.pharmacyProtected === "true" && !hasDemoPharmacySession()) {
      window.location.replace(loginUrl());
    }
    if (document.body?.dataset.doctorProtected === "true" && !hasDemoDoctorSession()) window.location.replace(loginUrl());
    if (document.body?.dataset.nurseProtected === "true" && !hasDemoNurseSession()) window.location.replace(loginUrl());
  }

  async function setDemoPassword(email, password) {
    const normalized = String(email || "").trim().toLowerCase();
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(String(password), salt);
      const credentials = readCredentials(); credentials[normalized] = { salt: toBase64(salt), hash: toBase64(hash) };
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); return true;
    } catch { return false; }
  }
  function removeDemoPassword(email) { const credentials = readCredentials(); delete credentials[String(email || "").trim().toLowerCase()]; try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); } catch {} }
  function moveDemoPassword(oldEmail, newEmail) {
    const oldKey = String(oldEmail || "").trim().toLowerCase(), newKey = String(newEmail || "").trim().toLowerCase();
    if (!oldKey || !newKey || oldKey === newKey) return true;
    const credentials = readCredentials();
    if (!credentials[oldKey]) return true;
    credentials[newKey] = credentials[oldKey]; delete credentials[oldKey];
    try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); return true; } catch { return false; }
  }
  function updatePharmacyLoginEmail(email, pharmacyId = "") {
    const pharmacySession = hasDemoPharmacySession();
    const adminSession = hasDemoAdminSession();
    const targetPharmacyId = String(pharmacyId || (pharmacySession ? demoPharmacyId() : ""));
    if ((!pharmacySession && !adminSession) || !targetPharmacyId) return { ok: false, error: "You are not authorized to update this pharmacy email." };
    if (pharmacySession && String(demoPharmacyId()) !== targetPharmacyId) return { ok: false, error: "You can update only your own pharmacy account." };
    const account = pharmacySession
      ? currentAccount()
      : window.CarePlusData?.list("users").find(user => String(user.role || "").toLowerCase() === "pharmacy" && String(user.pharmacyId) === targetPharmacyId);
    const normalized = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { ok: false, error: "Enter a valid email address." };
    if (!account) return { ok: true, email: normalized, linked: false, previousEmail: "" };
    const collision = window.CarePlusData?.list("users").some(user => String(user.id) !== String(account.id) && String(user.email || "").trim().toLowerCase() === normalized);
    if (collision) return { ok: false, error: "An account already uses this email address." };
    const oldEmail = String(account.email || "").trim().toLowerCase();
    if (normalized === oldEmail) return { ok: true, email: normalized, linked: true, previousEmail: oldEmail };

    if (!moveDemoPassword(oldEmail, normalized)) return { ok: false, error: "Could not move the saved sign-in credential. Try again." };
    const isCurrentPharmacy = pharmacySession && String(account.id) === String(currentAccount()?.id);
    if (isCurrentPharmacy) {
      try { sessionStorage.setItem(USER_KEY, normalized); }
      catch { moveDemoPassword(normalized, oldEmail); return { ok: false, error: "Could not update the current sign-in session." }; }
    }
    const updated = window.CarePlusData?.update("users", account.id, { email: normalized });
    if (!updated) {
      if (isCurrentPharmacy) try { sessionStorage.setItem(USER_KEY, oldEmail); } catch {}
      moveDemoPassword(normalized, oldEmail);
      return { ok: false, error: "Could not save the updated account email." };
    }
    return { ok: true, email: normalized, linked: true, previousEmail: oldEmail };
  }
  async function ensureDemoAdmin() {
    if (!window.CarePlusData) return;
    let account = findAccount("admin@careplus.test");
    let seeded = false; try { seeded = localStorage.getItem("careplusDemoAdminProvisionedV1") === "1"; } catch {}
    if (!account && !seeded) {
      account = window.CarePlusData.create("users", { id: "careplus-demo-admin", name: "CarePlus Admin", email: "admin@careplus.test", role: "Administrator", status: "Active", accountStatus: "Active", source: "demo-seed" });
      if (account) try { localStorage.setItem("careplusDemoAdminProvisionedV1", "1"); } catch {}
    }
    if (account && !readCredentials()["admin@careplus.test"]) await setDemoPassword("admin@careplus.test", "CarePlusDemo123!");
    await ensureDemoRoleAccounts();
  }
  async function ensureDemoRoleAccounts() {
    if (!window.CarePlusData) return;
    const accounts = [
      { marker: "careplusDemoUserProvisionedV1", email: "user@careplus.test", password: "CarePlusUser123!", name: "Demo User", role: "Customer", status: "Active", source: "demo-seed" },
      { marker: "careplusDemoDoctorProvisionedV1", email: "doctor@careplus.test", password: "CarePlusDoctor123!", name: "Dr. Omar Khalil", role: "Doctor", doctorId: "doctor-demo-omar", specialty: "Cardiology", approvalStatus: "Approved", accountStatus: "Active", status: "Active", source: "demo-seed" },
      { marker: "careplusDemoPharmacyProvisionedV1", email: "pharmacy@careplus.test", password: "CarePlusPharmacy123!", name: "Al Shifa Pharmacy", role: "Pharmacy", pharmacyId: "pharmacy-1", approvalStatus: "Approved", accountStatus: "Active", status: "Active", source: "demo-seed" },
      { marker: "careplusDemoNurseProvisionedV1", email: "nurse@careplus.test", password: "CarePlusNurse123!", name: "Lina Haddad", role: "Nurse", nurseId: "nurse-demo-lina", accountStatus: "Active", status: "Active", phone: "+962 7 9000 2001", specialty: "Elderly home care", experience: "5", source: "demo-seed" }
    ];
    for (const demo of accounts) {
      let provisioned = false; try { provisioned = localStorage.getItem(demo.marker) === "1"; } catch {}
      if (provisioned) continue;
      let account = findAccount(demo.email);
      if (!account) {
        const { marker, password, ...record } = demo;
        account = window.CarePlusData.create("users", record);
      }
      if (!account) continue;
      if (!readCredentials()[demo.email] && !(await setDemoPassword(demo.email, demo.password))) continue;
      try { localStorage.setItem(demo.marker, "1"); } catch {}
    }
  }
  window.CarePlusAuth = { hasDemoSession, hasDemoAdminSession, hasDemoPharmacySession, demoPharmacyId, demoPharmacyAccount, updatePharmacyLoginEmail, hasDemoDoctorSession, demoDoctorAccount, hasDemoNurseSession, demoNurseAccount, hasDemoCustomerSession, endDemoSession, registerCustomer, loginCustomer, setDemoPassword, removeDemoPassword, moveDemoPassword, ensureDemoAdmin, ensureDemoRoleAccounts, paintNavigation, guardProtectedPage };
  guardProtectedPage();
  new MutationObserver(paintNavigation).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => { guardProtectedPage(); paintNavigation(); });
  window.addEventListener("pageshow", () => { guardProtectedPage(); paintNavigation(); });
  const syncAuthentication = () => { guardProtectedPage(); paintNavigation(); };
  window.addEventListener("storage", syncAuthentication);
  window.addEventListener("careplus:data", syncAuthentication);
  document.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("[data-customer-profile]")) return;
    document.querySelectorAll("[data-profile-menu]").forEach(menu => {
      menu.hidden = true;
      menu.parentElement.querySelector("[data-profile-trigger]")?.setAttribute("aria-expanded", "false");
    });
  });
})();
