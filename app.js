(function () {
  "use strict";

  // ---------- CONFIG ----------
  var ADMIN_PASSWORD = "mshlAdmin34"; // set by the developer before deploying
  var ADMIN_AUTH_KEY = "mshl_admin_auth_v1";
  var FIREBASE_DB_URL = "https://mshl-workshop-default-rtdb.firebaseio.com";
  var SESSION_PATH = "/session.json";

  // ---------- FIREBASE (REST API) HELPERS ----------
  function fetchSession() {
    return fetch(FIREBASE_DB_URL + SESSION_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error("Firebase fetch failed: " + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.error("Error loading session from Firebase:", err);
        return null;
      });
  }

  function putSession(session) {
    return fetch(FIREBASE_DB_URL + SESSION_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Firebase write failed: " + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.error("Error saving session to Firebase:", err);
        return null;
      });
  }

  // ---------- SESSION HELPERS ----------
  function generateSessionId() {
    var chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/o, 1/l/i)
    var id = "";
    for (var i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function getUrlSessionId() {
    var params = new URLSearchParams(window.location.search);
    return params.get("s");
  }

  function isSessionActive(session) {
    if (!session || !session.active) return false;
    var now = Date.now();
    if (now >= session.expiresAt) return false;
    // If this page load came in via a session-specific URL (?s=...),
    // that ID must match the currently active session — otherwise this
    // is an old QR code/link pointing at a session that's been replaced.
    var urlId = getUrlSessionId();
    if (urlId && session.id && urlId !== session.id) return false;
    return true;
  }

  // ---------- ELEMENTS ----------
  var viewVisitor = document.getElementById("view-visitor");
  var viewAdminLogin = document.getElementById("view-admin-login");
  var viewAdmin = document.getElementById("view-admin");

  var stepConsent = document.getElementById("step-consent");
  var stepForm = document.getElementById("step-form");
  var stepSuccess = document.getElementById("step-success");
  var stepEnded = document.getElementById("step-ended");
  var stepLoading = document.getElementById("step-loading");

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
    [stepConsent, stepForm, stepSuccess, stepEnded, stepLoading].forEach(function (el) {
      if (el) el.classList.add("hidden");
    });
    step.classList.remove("hidden");
  }

  function initVisitorFlow() {
    if (stepLoading) showVisitorStep(stepLoading);

    fetchSession().then(function (session) {
      if (!isSessionActive(session)) {
        showVisitorStep(stepEnded);
        seg1.classList.remove("active");
        seg2.classList.remove("active");
        return;
      }
      showVisitorStep(stepConsent);
      seg1.classList.add("active");
      seg2.classList.remove("active");
    });
  }

  consentCheck.addEventListener("change", function () {
    btnContinue.disabled = !consentCheck.checked;
    consentCheckWrap.classList.toggle("checked", consentCheck.checked);
  });

  btnContinue.addEventListener("click", function () {
    btnContinue.disabled = true;
    fetchSession().then(function (session) {
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
      btnContinue.disabled = false;
    });
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
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Signing in...";

    fetchSession().then(function (session) {
      if (!isSessionActive(session)) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Sign in";
        showVisitorStep(stepEnded);
        return;
      }

      session.entries = session.entries || [];
      var arrivalISO = pendingArrivalISO || new Date().toISOString();
      session.entries.push({
        firstName: first,
        lastName: last,
        arrivalISO: arrivalISO
      });

      return putSession(session).then(function (result) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Sign in";

        if (!result) {
          formError.textContent = "Couldn't reach the server — please check your connection and try again.";
          formError.classList.add("show");
          return;
        }

        successDetail.textContent =
          "Thanks, " + first + " — your arrival at " +
          new Date(arrivalISO).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) +
          " has been recorded.";
        showVisitorStep(stepSuccess);
      });
    });
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
  function getCheckinUrl(session) {
    var url = new URL(window.location.href);
    url.hash = "";
    if (session && session.id) {
      url.searchParams.set("s", session.id);
    } else {
      url.searchParams.delete("s");
    }
    return url.toString();
  }

  function renderAdmin() {
    qrPanel.innerHTML = '<p class="card-sub" style="margin-bottom:0;">Loading session…</p>';
    statusLabel.textContent = "Loading…";
    statusSub.textContent = "";

    fetchSession().then(function (session) {
      var active = isSessionActive(session);

      statusDot.classList.toggle("off", !active);
      btnCloseSession.classList.toggle("hidden", !active);

      if (active) {
        statusLabel.textContent = "Session active";
        var startedDate = new Date(session.startedAt);
        var expiresDate = new Date(session.expiresAt);
        statusSub.textContent = "Created " + startedDate.toLocaleString("en-ZA", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        }) + " — Expires " + expiresDate.toLocaleString("en-ZA", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
        statSession.textContent = "Active";
        statExpires.textContent = expiresDate.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
        renderQrPanel(session);
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
    });
  }

  function renderQrPanel(session) {
    var url = getCheckinUrl(session);
    qrPanel.innerHTML =
      '<p class="card-sub" style="margin-bottom:4px;">Display or print this QR code for the workshop:</p>' +
      '<div id="qrcodeCanvas"></div>' +
      '<div class="url-text">' + url + '</div>' +
      '<p class="card-sub" style="margin-top:10px; font-size:0.78rem;">Session code: ' + (session && session.id ? session.id : "—") + '</p>';

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

  var durationPanel = document.getElementById("durationPanel");
  var durationHours = document.getElementById("durationHours");
  var durationPreview = document.getElementById("durationPreview");
  var btnConfirmDuration = document.getElementById("btnConfirmDuration");
  var btnCancelDuration = document.getElementById("btnCancelDuration");

  function updateDurationPreview() {
    var hours = parseFloat(durationHours.value);
    if (!hours || hours <= 0) {
      durationPreview.innerHTML = "Enter a valid number of hours.";
      return;
    }
    var expires = new Date(Date.now() + hours * 60 * 60 * 1000);
    durationPreview.innerHTML = "This session will expire at <strong>" +
      expires.toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) +
      "</strong> (" + hours + " hour" + (hours === 1 ? "" : "s") + " from now).";
  }

  durationHours.addEventListener("input", updateDurationPreview);

  btnNewSession.addEventListener("click", function () {
    btnNewSession.disabled = true;
    fetchSession().then(function (existing) {
      btnNewSession.disabled = false;
      if (isSessionActive(existing)) {
        var confirmReplace = window.confirm(
          "There's already an active session with " + (existing.entries || []).length +
          " check-ins. Creating a new one will end the current session. Continue?"
        );
        if (!confirmReplace) return;
      }
      durationHours.value = "24";
      updateDurationPreview();
      durationPanel.classList.remove("hidden");
    });
  });

  btnCancelDuration.addEventListener("click", function () {
    durationPanel.classList.add("hidden");
  });

  btnConfirmDuration.addEventListener("click", function () {
    var hours = parseFloat(durationHours.value);
    if (!hours || hours <= 0) {
      durationPreview.innerHTML = '<span style="color:#B23A2E;">Enter a valid number of hours greater than 0.</span>';
      return;
    }
    btnConfirmDuration.disabled = true;
    btnConfirmDuration.textContent = "Creating...";

    var now = Date.now();
    var newSession = {
      id: generateSessionId(),
      active: true,
      startedAt: now,
      expiresAt: now + hours * 60 * 60 * 1000,
      durationHours: hours,
      entries: []
    };

    putSession(newSession).then(function (result) {
      btnConfirmDuration.disabled = false;
      btnConfirmDuration.textContent = "Create session";

      if (!result) {
        durationPreview.innerHTML = '<span style="color:#B23A2E;">Could not create session — check your connection and try again.</span>';
        return;
      }
      durationPanel.classList.add("hidden");
      renderAdmin();
    });
  });

  btnCloseSession.addEventListener("click", function () {
    var confirmClose = window.confirm("Close this session now? The QR code will stop working immediately.");
    if (!confirmClose) return;

    fetchSession().then(function (session) {
      if (!session) return;
      session.active = false;
      session.expiresAt = Date.now() - 1;
      putSession(session).then(function () {
        renderAdmin();
      });
    });
  });

  btnExport.addEventListener("click", function () {
    fetchSession().then(function (session) {
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
  });

  // ---------- INIT ----------
  initVisitorFlow();

  // Re-check session expiry periodically while the visitor page is open
  setInterval(function () {
    if (!viewVisitor.classList.contains("hidden") && stepEnded.classList.contains("hidden") &&
        (!stepLoading || stepLoading.classList.contains("hidden"))) {
      fetchSession().then(function (session) {
        if (!isSessionActive(session)) {
          showVisitorStep(stepEnded);
        }
      });
    }
  }, 30000);
})();
