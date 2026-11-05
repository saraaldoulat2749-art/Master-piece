
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
  const professionalRoutes = {
    doctor: { application: "DoctorVerification/index.html", dashboard: "Doctor/index.html" },
    nurse: { application: "NurseVerification/index.html", dashboard: "Nurse/index.html" },
    pharmacy: { application: "PharmacyVerification/index.html", dashboard: "Pharmacy/dashboard.html" }
  };
  function selectedProfessionalRole(account) {
    const selected = String(account?.selectedRole || "").trim().toLowerCase();
    return professionalRoutes[selected] ? selected : "";
  }
  function isProfessionalApplicant(account) {
    const selected = selectedProfessionalRole(account);
    return Boolean(selected && accountRole(account) !== selected);
  }
  function professionalDestination(account) {
    const selected = selectedProfessionalRole(account);
    if (!selected) return "";
    const route = accountRole(account) === selected ? professionalRoutes[selected].dashboard : professionalRoutes[selected].application;
    return new URL(route, root).href;
  }
  function isValidEmail(value) {
    const email = String(value || "").trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }
  function isValidPassword(value) { return typeof value === "string" && value.length >= 8 && value.length <= 128; }
  function isValidJordanianPhone(value) { return /^07\d{8}$/.test(String(value || "").trim()); }
  function configurePhoneInputs() {
    document.querySelectorAll('input[type="tel"]').forEach(input => {
      input.inputMode = "numeric";
      input.maxLength = 10;
      input.pattern = "07[0-9]{8}";
      input.title = "Enter exactly 10 digits starting with 07, for example 0790000000.";
      const digits = input.value.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("9627")) input.value = `0${digits.slice(-9)}`;
    });
  }
  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.noValidate) return;
    const invalid = [...form.querySelectorAll('input[type="tel"]')].find(input => {
      const value = input.value.trim();
      const valid = !value && !input.required || isValidJordanianPhone(value);
      input.setCustomValidity(valid ? "" : "Phone number must be exactly 10 digits and start with 07, for example 0790000000.");
      return !valid;
    });
    if (invalid) {
      event.preventDefault();
      event.stopImmediatePropagation();
      invalid.reportValidity();
      invalid.focus();
    }
  }, true);
  document.addEventListener("input", event => {
    if (event.target instanceof HTMLInputElement && event.target.type === "tel") event.target.setCustomValidity("");
  }, true);
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
    if (account?.archived === true || account?.archivedAt) return "archived";
    const role = accountRole(account);
    if (["doctor", "pharmacy", "nurse"].includes(role)) {
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
      const account = currentAccount();
      return hasDemoSession()
        && (localStorage.getItem(KEY) === "demo" || sessionStorage.getItem(KEY) === "demo")
        && Boolean(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY))
        && !isProfessionalApplicant(account);
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
    try {
      if (!hasDemoSession() || sessionStorage.getItem(KEY) !== "doctor-demo") return false;
      const account = currentAccount();
      if (accountRole(account) !== "doctor") return false;
      const application = window.CarePlusData?.list("professionalApplications")
        .find(item => String(item.userId) === String(account.id) && item.role === "doctor");
      if (application) return application.status === "Approved";
      return ["approved", "verified"].includes(String(account.approvalStatus || account.verificationStatus || "").toLowerCase());
    }
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

  async function registerCustomer({ name, email, phone, password, role = "patient" }) {
    role = String(role || "patient").toLowerCase();
    if (!["patient", "doctor", "nurse", "pharmacy"].includes(role)) return { ok: false, error: "Choose a valid account type." };
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) return { ok: false, error: "Enter a valid email address." };
    if (!isValidPassword(password)) return { ok: false, error: "Password must be between 8 and 128 characters." };
    if (String(phone || "").trim() && !isValidJordanianPhone(phone)) return { ok: false, error: "Phone number must be exactly 10 digits and start with 07." };
    if (!window.CarePlusData) return { ok: false, error: "Account storage is unavailable in this browser." };
    if (window.CarePlusData.list("users").some(user => user.email?.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: "An account with this email already exists. Please log in." };
    }
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(String(password), salt);
      const user = window.CarePlusData.create("users", {
        name: String(name).trim(), email: normalizedEmail, phone: String(phone || "").trim(),
        role: "Customer", selectedRole: role, status: "Active", source: "demo-signup"
      });
      if (!user) return { ok: false, error: "Could not save the account. Please try again." };
      const credentials = readCredentials();
      credentials[normalizedEmail] = { salt: toBase64(salt), hash: toBase64(hash) };
      try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); }
      catch {
        window.CarePlusData.remove("users", user.id);
        return { ok: false, error: "Account storage is full or unavailable." };
      }
      const autoLogin = ["doctor", "nurse", "pharmacy"].includes(role) && startDemoSession("user", normalizedEmail);
      return { ok: true, role, autoLogin };
    } catch {
      return { ok: false, error: "Password protection is unavailable in this browser. Open the site over localhost or HTTPS." };
    }
  }

  async function loginCustomer(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail) || typeof password !== "string" || !password.length || password.length > 128) {
      return { ok: false, error: "Enter a valid email and password." };
    }
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
      if (["doctor", "nurse", "pharmacy"].includes(user.selectedRole) && role !== user.selectedRole) {
        const application = window.CarePlusData?.list("professionalApplications").find(item => String(item.userId) === String(user.id) && item.role === user.selectedRole);
        if (!application || application.status !== "Approved") {
          return startDemoSession("user", normalizedEmail)
            ? { ok: true, user, role: `${user.selectedRole}-application` }
            : { ok: false, error: "Could not start your session." };
        }
      }
      if (role === "doctor" && String(user.verificationStatus || "").toLowerCase() === "rejected") {
        return { ok: false, error: "Your doctor application was rejected. Contact CarePlus administration for assistance." };
      }
      const targetRole = ["admin", "administrator"].includes(role) ? "admin" : role === "doctor" ? "doctor" : role === "pharmacy" ? "pharmacy" : role === "nurse" ? "nurse" : "user";
      if (accountState(user) !== "active") return { ok: false, error: "This account is pending approval or inactive. Contact CarePlus administration." };
      if (targetRole === "doctor" && !user.doctorId) return { ok: false, error: "This doctor account is not linked to a doctor profile yet." };
      if (targetRole === "pharmacy" && (!user.pharmacyId || !window.CarePlusData?.get("pharmacies", user.pharmacyId))) return { ok: false, error: "This pharmacy account is not linked to a pharmacy profile yet." };
      return startDemoSession(targetRole, normalizedEmail) ? { ok: true, user, role: targetRole, mustChangePassword: Boolean(user.mustChangePassword) } : { ok: false, error: "Could not start your session." };
    } catch { return { ok: false, error: "Could not verify your account in this browser." }; }
  }

  function submitDoctorApplication(application, draft = false) {
    const account = currentAccount();
    if (!account || account.selectedRole !== "doctor") return { ok: false, error: "Sign in with a doctor account to continue." };
    const existing = window.CarePlusData.list("professionalApplications").find(item => String(item.userId) === String(account.id));
    const record = {
      ...(existing || {}), ...application, role: "doctor", userId: account.id,
      status: draft ? "Draft" : "Pending Verification",
      submittedAt: draft ? existing?.submittedAt || "" : new Date().toISOString(),
      reviewReason: ""
    };
    const saved = existing
      ? window.CarePlusData.update("professionalApplications", existing.id, record)
      : window.CarePlusData.create("professionalApplications", record);
    if (!saved) return { ok: false, error: "Could not save the application. Please try again." };
    window.CarePlusData.update("users", account.id, {
      selectedRole: "doctor",
      verificationStatus: draft ? "Draft" : "Pending",
      doctorApplicationId: saved.id,
      rejectionReason: ""
    });
    return { ok: true, application: saved };
  }

  function submitNurseApplication(application, draft = false) {
    const account = currentAccount();
    if (!account || account.selectedRole !== "nurse") return { ok: false, error: "Sign in with a nurse account to continue." };
    const existing = window.CarePlusData.list("professionalApplications").find(item => String(item.userId) === String(account.id) && item.role === "nurse");
    const record = { ...(existing || {}), ...application, role: "nurse", userId: account.id,
      status: draft ? "Draft" : "Pending Verification",
      submittedAt: draft ? existing?.submittedAt || "" : new Date().toISOString(), reviewReason: "" };
    const saved = existing ? window.CarePlusData.update("professionalApplications", existing.id, record)
      : window.CarePlusData.create("professionalApplications", record);
    if (!saved) return { ok: false, error: "Could not save the application. Please try again." };
    window.CarePlusData.update("users", account.id, { selectedRole: "nurse", verificationStatus: draft ? "Draft" : "Pending", nurseApplicationId: saved.id, rejectionReason: "" });
    return { ok: true, application: saved };
  }

  function reviewNurseApplication(id, decision, reason = "") {
    if (!hasDemoAdminSession()) return { ok: false, error: "Administrator access required." };
    const application = window.CarePlusData.get("professionalApplications", id);
    const user = application && window.CarePlusData.get("users", application.userId);
    if (!application || !user || application.role !== "nurse") return { ok: false, error: "Nurse application not found." };
    if (!["approve", "reject", "request"].includes(decision)) return { ok: false, error: "Choose a valid review action." };
    if (decision !== "approve" && !String(reason).trim()) return { ok: false, error: "A reason is required for this action." };
    const status = decision === "approve" ? "Approved" : decision === "reject" ? "Rejected" : "Additional Documents Required";
    const now = new Date().toISOString();
    window.CarePlusData.update("professionalApplications", id, { status, reviewReason: String(reason).trim(), reviewedAt: now });
    const changes = decision === "approve"
      ? { role: "Nurse", nurseId: user.nurseId || user.id, status: "Active", accountStatus: "Active", approvalStatus: "Approved", verificationStatus: "Approved", verifiedAt: now, rejectionReason: "" }
      : { role: "Customer", selectedRole: "nurse", status: "Active", accountStatus: "Active", approvalStatus: "Pending", verificationStatus: status, rejectionReason: decision === "reject" ? String(reason).trim() : "", additionalDocumentsReason: decision === "request" ? String(reason).trim() : "" };
    window.CarePlusData.update("users", user.id, changes);
    return { ok: true };
  }

  function submitPharmacyApplication(application, draft = false) {
    const account = currentAccount();
    if (!account || account.selectedRole !== "pharmacy") return { ok: false, error: "Sign in with a pharmacy account to continue." };
    const existing = window.CarePlusData.list("professionalApplications").find(item => String(item.userId) === String(account.id) && item.role === "pharmacy");
    const record = { ...(existing || {}), ...application, role: "pharmacy", userId: account.id,
      status: draft ? "Draft" : "Pending Verification",
      submittedAt: draft ? existing?.submittedAt || "" : new Date().toISOString(), reviewReason: "" };
    const saved = existing ? window.CarePlusData.update("professionalApplications", existing.id, record)
      : window.CarePlusData.create("professionalApplications", record);
    if (!saved) return { ok: false, error: "Could not save the application. Please try again." };
    window.CarePlusData.update("users", account.id, { selectedRole: "pharmacy", verificationStatus: draft ? "Draft" : "Pending", pharmacyApplicationId: saved.id, rejectionReason: "" });
    return { ok: true, application: saved };
  }

  function reviewPharmacyApplication(id, decision, reason = "") {
    if (!hasDemoAdminSession()) return { ok: false, error: "Administrator access required." };
    const application = window.CarePlusData.get("professionalApplications", id);
    const user = application && window.CarePlusData.get("users", application.userId);
    if (!application || !user || application.role !== "pharmacy") return { ok: false, error: "Pharmacy application not found." };
    if (!["approve", "reject", "request"].includes(decision)) return { ok: false, error: "Choose a valid review action." };
    if (decision !== "approve" && !String(reason).trim()) return { ok: false, error: "A reason is required for this action." };
    const status = decision === "approve" ? "Approved" : decision === "reject" ? "Rejected" : "Additional Documents Required";
    const now = new Date().toISOString();
    if (decision === "approve") {
      const pharmacy = window.CarePlusData.create("pharmacies", {
        name: application.pharmacyName, ownerName: application.responsiblePharmacist, licenseNumber: application.licenseNumber,
        email: user.email, phone: application.contactPhone || user.phone || "", address: application.address,
        area: application.city, city: application.city, hours: "Hours not provided", open: false, medicines: [], inventory: [], status: "Active"
      });
      if (!pharmacy) return { ok: false, error: "Could not create the pharmacy profile. Please retry the approval." };
      window.CarePlusData.update("users", user.id, { role: "Pharmacy", pharmacyId: String(pharmacy.id), name: application.responsiblePharmacist || user.name,
        status: "Active", accountStatus: "Active", approvalStatus: "Approved", verificationStatus: "Approved", verifiedAt: now, rejectionReason: "" });
    } else {
      window.CarePlusData.update("users", user.id, { role: "Customer", selectedRole: "pharmacy", status: "Active", accountStatus: "Active", approvalStatus: "Pending", verificationStatus: status,
        rejectionReason: decision === "reject" ? String(reason).trim() : "", additionalDocumentsReason: decision === "request" ? String(reason).trim() : "" });
    }
    window.CarePlusData.update("professionalApplications", id, { status, reviewReason: String(reason).trim(), reviewedAt: now });
    return { ok: true };
  }

  function reviewDoctorApplication(id, decision, reason = "") {
    if (!hasDemoAdminSession()) return { ok: false, error: "Administrator access required." };
    const application = window.CarePlusData.get("professionalApplications", id);
    const user = application && window.CarePlusData.get("users", application.userId);
    if (!application || !user || application.role !== "doctor") return { ok: false, error: "Doctor application not found." };
    if (!["approve", "reject", "request"].includes(decision)) return { ok: false, error: "Choose a valid review action." };
    if (decision !== "approve" && !String(reason).trim()) return { ok: false, error: "A reason is required for this action." };
    const status = decision === "approve" ? "Approved" : decision === "reject" ? "Rejected" : "Additional Documents Required";
    const now = new Date().toISOString();
    window.CarePlusData.update("professionalApplications", id, { status, reviewReason: String(reason).trim(), reviewedAt: now });
    const userChanges = decision === "approve"
      ? { role: "Doctor", doctorId: user.doctorId || user.id, status: "Active", accountStatus: "Active", approvalStatus: "Approved", verificationStatus: "Approved", verifiedAt: now, rejectionReason: "" }
      : { role: "Customer", selectedRole: "doctor", status: "Active", accountStatus: "Active", approvalStatus: "Pending", verificationStatus: status, rejectionReason: decision === "reject" ? String(reason).trim() : "", additionalDocumentsReason: decision === "request" ? String(reason).trim() : "" };
    window.CarePlusData.update("users", user.id, userChanges);
    return { ok: true };
  }

  function paintNavigation() {
    configurePhoneInputs();
    document.querySelectorAll("[data-profile-link]").forEach(link => { link.href = profile; });
    const customer = hasDemoCustomerSession();
    const professionalApplicant = hasDemoSession() && isProfessionalApplicant(currentAccount());
    const admin = hasDemoAdminSession();
    const pharmacy = hasDemoPharmacySession();
    const doctor = hasDemoDoctorSession();
    const nurse = hasDemoNurseSession();
    const loggedIn = customer || admin || pharmacy || doctor || nurse;
    let notificationWidget = document.querySelector("#careplus-notification-widget.cpn-floating-slot") || document.getElementById("careplus-notification-widget");
    if (customer || professionalApplicant) {
      document.querySelectorAll("#careplus-notification-widget").forEach(node => { if (node !== notificationWidget) node.remove(); });
      if (!notificationWidget) {
        notificationWidget = document.createElement("div");
        notificationWidget.id = "careplus-notification-widget";
      }
      notificationWidget.className = "cpn-floating-slot cpn-widget";
      notificationWidget.hidden = false;
      if (notificationWidget.parentElement !== document.body) document.body.appendChild(notificationWidget);
      const notificationCss = new URL("shared/notifications.css?v=doctor-status-notification-dot-1", root).href;
      const notificationJs = new URL("shared/notifications.js?v=floating-customer-2", root).href;
      if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => new URL(link.href).pathname.endsWith("/shared/notifications.css"))) {
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = notificationCss; document.head.appendChild(link);
      }
      if (window.CarePlusData && ![...document.scripts].some(script => new URL(script.src || location.href).pathname.endsWith("/shared/notifications.js"))) {
        const script = document.createElement("script"); script.src = notificationJs; script.dataset.careplusNotifications = "true"; document.body.appendChild(script);
      }
    }
    const dashboard = admin ? new URL("Admin/index.html", root).href
      : doctor ? new URL("Doctor/index.html", root).href
      : nurse ? new URL("Nurse/index.html", root).href
      : pharmacy ? new URL("Pharmacy/dashboard.html", root).href : profile;
    document.querySelectorAll(".careplus-navbar__signup, .careplus-navbar__signup-mobile").forEach(link => { link.hidden = loggedIn; });
    document.querySelectorAll("[data-customer-profile]").forEach(profileControl => { profileControl.hidden = !customer; });
    document.querySelectorAll("[data-auth-toggle]").forEach(link => {
      if (!link.closest('.careplus-navbar')) {
        link.hidden = false;
        if (link.textContent !== 'LOG OUT') link.textContent = 'LOG OUT';
        link.href = home;
        link.setAttribute('aria-label', 'Log out');
        link.onclick = event => {
          event.preventDefault();
          endDemoSession();
          window.location.assign(home);
        };
        return;
      }
      if (customer) { link.hidden = true; return; }
      link.hidden = false;
      const label = loggedIn ? (customer ? "My Profile" : "Dashboard") : "Log In";
      if (link.textContent !== label) link.textContent = label;
      link.href = loggedIn ? dashboard : login;
      link.setAttribute("aria-label", loggedIn ? (customer ? "Go to my profile" : "Back to dashboard") : "Log in");
      link.onclick = event => {
        event.preventDefault();
        if (loggedIn) {
          window.location.assign(dashboard);
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
    const changePasswordPage = decodeURIComponent(location.pathname).toLowerCase().endsWith("/log in/change-password.html");
    if (hasDemoSession() && currentAccount()?.mustChangePassword && !changePasswordPage) {
      window.location.replace(new URL("log%20in/change-password.html", root).href);
      return;
    }
    const customerRoute = document.body?.dataset.customerProtected === "true"
      || document.body?.dataset.protected === "true"
        && document.body?.dataset.adminProtected !== "true"
        && document.body?.dataset.pharmacyProtected !== "true"
        && document.body?.dataset.doctorProtected !== "true"
        && document.body?.dataset.nurseProtected !== "true";
    const notificationsPage = decodeURIComponent(location.pathname).toLowerCase().endsWith("/shared/notifications.html");
    const professionalPage = Object.values(professionalRoutes).some(routes =>
      location.pathname.toLowerCase().endsWith("/" + routes.application.toLowerCase())
      || location.pathname.toLowerCase().endsWith("/" + routes.dashboard.toLowerCase()));
    if (customerRoute && !changePasswordPage && !notificationsPage && !professionalPage && hasDemoSession()) {
      const account = currentAccount();
      const destination = professionalDestination(account);
      if (destination) { window.location.replace(destination); return; }
    }
    if (document.body?.dataset.adminProtected === "true" && !hasDemoAdminSession()) {
      window.location.replace(hasDemoSession() ? home : login);
    }
    if (document.body?.dataset.pharmacyProtected === "true" && !hasDemoPharmacySession()) {
      window.location.replace(loginUrl());
    }
    if (document.body?.dataset.doctorProtected === "true" && !hasDemoDoctorSession()) {
      const account = currentAccount();
      if (hasDemoSession() && (account?.selectedRole === "doctor" || accountRole(account) === "doctor")) endDemoSession();
      window.location.replace(home);
    }
    if (document.body?.dataset.nurseProtected === "true" && !hasDemoNurseSession()) window.location.replace(loginUrl());
  }

  async function setDemoPassword(email, password) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalized) || !isValidPassword(password)) return false;
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(String(password), salt);
      const credentials = readCredentials(); credentials[normalized] = { salt: toBase64(salt), hash: toBase64(hash) };
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); return true;
    } catch { return false; }
  }
  async function changeOwnPassword(password) {
    const account = currentAccount();
    const nextPassword = String(password || "");
    if (!account || !account.mustChangePassword) return { ok: false, error: "No password change is required for this account." };
    if (!isValidPassword(nextPassword)) return { ok: false, error: "Your new password must be between 8 and 128 characters." };
    try {
      const email = String(account.email || "").trim().toLowerCase();
      const current = readCredentials()[email];
      if (current) {
        const candidate = new Uint8Array(await passwordHash(nextPassword, fromBase64(current.salt)));
        const existingHash = fromBase64(current.hash);
        let same = candidate.length ^ existingHash.length;
        for (let index = 0; index < Math.min(candidate.length, existingHash.length); index += 1) same |= candidate[index] ^ existingHash[index];
        if (!same) return { ok: false, error: "Choose a password different from your temporary password." };
      }
      const updated = window.CarePlusData.update("users", account.id, { mustChangePassword: false, passwordChangedAt: new Date().toISOString() });
      if (!updated) return { ok: false, error: "Could not update your account. Please try again." };
      if (!(await setDemoPassword(email, nextPassword))) {
        window.CarePlusData.update("users", account.id, { mustChangePassword: true, passwordChangedAt: "" });
        return { ok: false, error: "Could not save your new password. Please try again." };
      }
      return { ok: true, role: accountRole(account) };
    } catch { return { ok: false, error: "Could not update the password in this browser." }; }
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
  window.CarePlusAuth = { isValidEmail, isValidPassword, isValidJordanianPhone, hasDemoSession, hasDemoAdminSession, hasDemoPharmacySession, demoPharmacyId, demoPharmacyAccount, updatePharmacyLoginEmail, hasDemoDoctorSession, demoDoctorAccount, hasDemoNurseSession, demoNurseAccount, hasDemoCustomerSession, endDemoSession, registerCustomer, loginCustomer, submitDoctorApplication, reviewDoctorApplication, submitNurseApplication, reviewNurseApplication, submitPharmacyApplication, reviewPharmacyApplication, setDemoPassword, changeOwnPassword, removeDemoPassword, moveDemoPassword, ensureDemoAdmin, ensureDemoRoleAccounts, paintNavigation, guardProtectedPage };
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
