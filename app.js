(function () {
  "use strict";

  // ---------- CONFIG ----------
  var ADMIN_PASSWORD = "mshlAdmin34"; // set by the developer before deploying
  var SESSION_DURATION_HOURS = 24;
  var STORAGE_KEY = "mshl_checkin_session_v1";
  var ADMIN_AUTH_KEY = "mshl_admin_auth_v1";

  // ---------- STORAGE HELPERS ----------
  function loadSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isSessionActive(session) {
    if (!session || !session.active) return false;
    var now = Date.now();
    return now < session.expiresAt;
  }

  // ---------- ELEMENTS ----------
  var viewVisitor = document.getElementById("view-visitor");
  var viewAdminLogin = document.getElementById("view-admin-login");
  var viewAdmin = document.getElementById("view-admin");

  var stepConsent = document.getElementById("step-consent");
  var stepForm = document.getElementById("step-form");
  var stepSuccess = document.getElementById("step-success");
  var stepEnded = document.getElementById("step-ended");

  var seg1 = document.getElementById("seg1");
  var seg2 = document.getElementById("seg2");

  var consentCheck = document.getElementById("consentCheck");
  var consentCheckWrap = document.getElementById("consentCheckWrap");
  var btnContinue = document.getElementById("btnContinue");

  var firstNameInput = document.getElementById("firstName");
  var lastNameInput = document.getElementById("lastName");
  var arrivalTimeDisplay = document.getElementById("arrivalTimeDisplay");
  var formError = document.getElementById("formError");
  var btnSubmit = document.getElementById("btnSubmit");
  var btnBack = document.getElementById("btnBack");
  var successDetail = document.getElementById("successDetail");

  var adminEntryLink = document.getElementById("adminEntryLink");
  var adminPasswordInput = document.getElementById("adminPassword");
  var loginError = document.getElementById("loginError");
  var btnAdminLogin = document.getElementById("btnAdminLogin");
  var btnAdminCancel = document.getElementById("btnAdminCancel");
  var btnLogout = document.getElementById("btnLogout");

  var statusDot = document.getElementById("statusDot");
  var statusLabel = document.getElementById("statusLabel");
  var statusSub = document.getElementById("statusSub");
  var btnNewSession = document.getElementById("btnNewSession");
  var btnCloseSession = document.getElementById("btnCloseSession");
  var qrPanel = document.getElementById("qrPanel");

  var statTotal = document.getElementById("statTotal");
  var statSession = document.getElementById("statSession");
  var statExpires = document.getElementById("statExpires");
  var entriesBody = document.getElementById("entriesBody");
  var emptyState = document.getElementById("emptyState");
  var btnExport = document.getElementById("btnExport");

  var pendingArrivalISO = null;

  // ---------- VISITOR FLOW ----------
  function showVisitorStep(step) {
    [stepConsent, stepForm, stepSuccess, stepEnded].forEach(function (el) {
      el.classList.add("hidden");
    });
    step.classList.remove("hidden");
  }

  function initVisitorFlow() {
    var session = loadSession();

    if (!isSessionActive(session)) {
      showVisitorStep(stepEnded);
      seg1.classList.remove("active");
      seg2.classList.remove("active");
      return;
    }

    showVisitorStep(stepConsent);
    seg1.classList.add("active");
    seg2.classList.remove("active");
  }

  consentCheck.addEventListener("change", function () {
    btnContinue.disabled = !consentCheck.checked;
    consentCheckWrap.classList.toggle("checked", consentCheck.checked);
  });

  btnContinue.addEventListener("click", function () {
    var session = loadSession();
    if (!isSessionActive(session)) {
      seg1.classList.remove("active");
      seg2.classList.remove("active");
      showVisitorStep(stepEnded);
      return;
    }
    pendingArrivalISO = new Date().toISOString();
    arrivalTimeDisplay.textContent = new Date(pendingArrivalISO).toLocaleString("en-ZA", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short"
    });
    showVisitorStep(stepForm);
    seg2.classList.add("active");
    firstNameInput.focus();
  });

  btnBack.addEventListener("click", function () {
    showVisitorStep(stepConsent);
    seg2.classList.remove("active");
  });

  btnSubmit.addEventListener("click", function () {
    var first = firstNameInput.value.trim();
    var last = lastNameInput.value.trim();

    if (!first || !last) {
      formError.classList.add("show");
      return;
    }
    formError.classList.remove("show");

    var session = loadSession();
    if (!isSessionActive(session)) {
      showVisitorStep(stepEnded);
      return;
    }

    session.entries = session.entries || [];
    session.entries.push({
      firstName: first,
      lastName: last,
      arrivalISO: pendingArrivalISO || new Date().toISOString()
    });
    saveSession(session);

    successDetail.textContent =
      "Thanks, " + first + " — your arrival at " +
      new Date(session.entries[session.entries.length - 1].arrivalISO).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) +
      " has been recorded.";
    showVisitorStep(stepSuccess);
  });

  // ---------- ADMIN ACCESS ----------
  function showView(view) {
    [viewVisitor, viewAdminLogin, viewAdmin].forEach(function (v) {
      v.classList.add("hidden");
    });
    view.classList.remove("hidden");
  }

  function isAdminAuthed() {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === "true";
  }

  adminEntryLink.addEventListener("click", function (e) {
    e.preventDefault();
    if (isAdminAuthed()) {
      showView(viewAdmin);
      renderAdmin();
    } else {
      showView(viewAdminLogin);
      adminPasswordInput.value = "";
      adminPasswordInput.focus();
    }
  });

  btnAdminCancel.addEventListener("click", function () {
    showView(viewVisitor);
    initVisitorFlow();
  });

  btnAdminLogin.addEventListener("click", attemptAdminLogin);
  adminPasswordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") attemptAdminLogin();
  });

  function attemptAdminLogin() {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, "true");
      loginError.classList.remove("show");
      showView(viewAdmin);
      renderAdmin();
    } else {
      loginError.classList.add("show");
    }
  }

  btnLogout.addEventListener("click", function () {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    showView(viewVisitor);
    initVisitorFlow();
  });

  // ---------- ADMIN DASHBOARD ----------
  function getCheckinUrl() {
    var url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function renderAdmin() {
    var session = loadSession();
    var active = isSessionActive(session);

    statusDot.classList.toggle("off", !active);
    btnCloseSession.classList.toggle("hidden", !active);

    if (active) {
      statusLabel.textContent = "Session active";
      var expiresDate = new Date(session.expiresAt);
      statusSub.textContent = "Expires " + expiresDate.toLocaleString("en-ZA", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
      });
      statSession.textContent = "Active";
      statExpires.textContent = expiresDate.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
      renderQrPanel();
    } else {
      statusLabel.textContent = "No active session";
      statusSub.textContent = "Generate a new QR code to start accepting check-ins.";
      statSession.textContent = "Closed";
      statExpires.textContent = "—";
      qrPanel.innerHTML = '<p class="card-sub" style="margin-bottom:0;">No active QR code. Click "Generate new QR code" above to start a session.</p>';
    }

    var entries = (session && session.entries) || [];
    statTotal.textContent = entries.length;
    renderEntriesTable(entries);
  }

  function renderQrPanel() {
    var url = getCheckinUrl();
    qrPanel.innerHTML =
      '<p class="card-sub" style="margin-bottom:4px;">Display or print this QR code for the workshop:</p>' +
      '<div id="qrcodeCanvas"></div>' +
      '<div class="url-text">' + url + '</div>';

    if (window.QRCode) {
      new QRCode(document.getElementById("qrcodeCanvas"), {
        text: url,
        width: 200,
        height: 200,
        colorDark: "#1A1A1A",
        colorLight: "#FFFFFF"
      });
    } else {
      document.getElementById("qrcodeCanvas").innerHTML =
        '<p style="color:#B23A2E;font-size:0.85rem;">QR code library failed to load — check your internet connection, or share the link above directly.</p>';
    }
  }

  function renderEntriesTable(entries) {
    entriesBody.innerHTML = "";
    if (entries.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    entries.slice().reverse().forEach(function (entry) {
      var tr = document.createElement("tr");
      var timeStr = new Date(entry.arrivalISO).toLocaleString("en-ZA", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
      });
      tr.innerHTML =
        "<td>" + escapeHtml(entry.firstName) + "</td>" +
        "<td>" + escapeHtml(entry.lastName) + "</td>" +
        "<td>" + timeStr + "</td>";
      entriesBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  btnNewSession.addEventListener("click", function () {
    var existing = loadSession();
    if (isSessionActive(existing)) {
      var confirmReplace = window.confirm(
        "There's already an active session with " + (existing.entries || []).length +
        " check-ins. Generating a new QR code will end the current session and start a fresh one. Continue?"
      );
      if (!confirmReplace) return;
    }
    var now = Date.now();
    var newSession = {
      active: true,
      startedAt: now,
      expiresAt: now + SESSION_DURATION_HOURS * 60 * 60 * 1000,
      entries: []
    };
    saveSession(newSession);
    renderAdmin();
  });

  btnCloseSession.addEventListener("click", function () {
    var session = loadSession();
    if (!session) return;
    var confirmClose = window.confirm("Close this session now? The QR code will stop working immediately.");
    if (!confirmClose) return;
    session.active = false;
    session.expiresAt = Date.now() - 1;
    saveSession(session);
    renderAdmin();
  });

  btnExport.addEventListener("click", function () {
    var session = loadSession();
    var entries = (session && session.entries) || [];
    if (entries.length === 0) {
      window.alert("No check-ins to export yet.");
      return;
    }
    var rows = [["First name", "Surname", "Arrival time"]];
    entries.forEach(function (e) {
      rows.push([e.firstName, e.lastName, new Date(e.arrivalISO).toLocaleString("en-ZA")]);
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "workshop-checkin-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // ---------- INIT ----------
  initVisitorFlow();

  // Re-check session expiry periodically while the visitor page is open
  setInterval(function () {
    if (!viewVisitor.classList.contains("hidden")) {
      var session = loadSession();
      if (!isSessionActive(session) && stepEnded.classList.contains("hidden")) {
        showVisitorStep(stepEnded);
      }
    }
  }, 30000);
})();
