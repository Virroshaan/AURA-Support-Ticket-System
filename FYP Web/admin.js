// admin.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc,
  serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQnERziOOCtj8oHcVJzRXMsh5-ttA5nBc",
  authDomain: "aura-support-ticket-system.firebaseapp.com",
  projectId: "aura-support-ticket-system",
  storageBucket: "aura-support-ticket-system.firebasestorage.app",
  messagingSenderId: "363377520981",
  appId: "1:363377520981:web:2a691829a15977e5cb3fdc",
  measurementId: "G-ZZ0F1EYLHW"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-southeast1");

// callables
const fnAssign   = httpsCallable(functions, "adminAssignTicket");
const fnClose    = httpsCallable(functions, "adminCloseTicket");
const fnCreate   = httpsCallable(functions, "adminCreateUser");
const fnBackfill = httpsCallable(functions, "adminBackfillTicketCodes");
const fnRecount  = httpsCallable(functions, "adminRecountActiveCounts");

// DOM
const $ = (id) => document.getElementById(id);
const ticketsEl = $("tickets");
const logoutBtn = $("menu-logout");
const nameInp   = $("newName");
const emailInp  = $("newEmail");
const roleSel   = $("newRole");
const catSel    = $("techCategory");
const deptSel   = $("newDept");
const phoneInp  = $("newPhone");
const createBtn = $("btnCreate");
const diagStatsEl = $("diagStats");   // dashboard widget

// Profile dropdown
const avatarBtn       = document.getElementById("avatarBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profName        = document.getElementById("profName");
const profEmail       = document.getElementById("profEmail");
const profileLogout   = document.getElementById("profileLogout");

avatarBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = profileDropdown?.style.display === "block";
  if (profileDropdown) profileDropdown.style.display = open ? "none" : "block";
  avatarBtn?.setAttribute("aria-expanded", (!open).toString());
});
document.addEventListener("click", (e) => {
  const root = document.getElementById("topProfile");
  if (root && !root.contains(e.target)) {
    if (profileDropdown) profileDropdown.style.display = "none";
    avatarBtn?.setAttribute("aria-expanded", "false");
  }
});
profileDropdown?.addEventListener("click", (e) => e.stopPropagation());

// helpers
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");
const isValidPhone = (p) => {
  const s = String(p || "").replace(/\D/g, "");
  return s.length >= 9 && s.length <= 12;
};
const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

// buttons style
function stylePrimaryButtons(container) {
  container.querySelectorAll(".btn").forEach((b) => {
    b.style.background = "#2563eb";
    b.style.color = "white";
    b.style.border = "none";
    b.style.borderRadius = "8px";
    b.style.padding = "9px 15px";
    b.style.cursor = "pointer";
    b.style.fontWeight = "600";
    b.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    b.onmouseover = () => (b.style.background = "#1d4ed8");
    b.onmouseout  = () => (b.style.background = "#2563eb");
  });
}

function mountOverlay(html) {
  const overlay = document.createElement("div");
  overlay.className = "custom-popup";
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  return overlay;
}

function showPopup(message, type = "error") {
  document.querySelector(".custom-popup")?.remove();
  const overlay = mountOverlay(`
    <div class="popup-box ${type}">
      ${message}
      <div style="margin-top:12px;"><button id="popup-ok">OK</button></div>
    </div>
  `);
  overlay.querySelector("#popup-ok")?.addEventListener("click", () => overlay.remove());
}

// inline styles for popup
(() => {
  const style = document.createElement("style");
  style.textContent = `
  .custom-popup{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;justify-content:center;align-items:center;z-index:9999;}
  .popup-box{background:#1f2937;border-radius:10px;padding:24px 28px;color:#f9fafb;text-align:center;width:360px;box-shadow:0 4px 20px rgba(0,0,0,.4);}
  .popup-box.success{border:1px solid #10b981}.popup-box.error{border:1px solid #ef4444}
  .popup-box button{background:#2563eb;border:none;color:#fff;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer}
  .popup-box button:hover{background:#1d4ed8}
  code{background:#111827;padding:2px 6px;border-radius:6px}
  `;
  document.head.appendChild(style);
})();

/* Role UI logic */
function applyRoleUI() {
  const role = (roleSel?.value || "").toLowerCase();
  if (!deptSel || !catSel) return;
  if (role === "technician") {
    catSel.style.display = "inline-block";
    deptSel.style.display = "none";
  } else if (role === "user") {
    deptSel.style.display = "inline-block";
    catSel.style.display = "none";
  } else {
    deptSel.style.display = "none";
    catSel.style.display = "none";
  }
}
roleSel?.addEventListener("change", applyRoleUI);
applyRoleUI();

// Create user
createBtn?.addEventListener("click", async () => {
  const fullName   = (nameInp?.value || "").trim();
  const email      = (emailInp?.value || "").trim().toLowerCase();
  const role       = (roleSel?.value || "").trim().toLowerCase();
  const category   = (catSel?.value || "").trim();
  const department = (deptSel?.value || "").trim();
  const phone      = (phoneInp?.value || "").trim();

  if (!fullName) return showPopup("<p>⚠ Enter full name.</p>");
  if (!email || !isValidEmail(email)) return showPopup("<p>⚠ Enter a valid email.</p>");
  if (!role) return showPopup("<p>⚠ Select a role.</p>");
  if (!isValidPhone(phone)) return showPopup("<p>⚠ Enter a valid contact number (digits, 9–12).</p>");
  if (role === "technician" && !category) return showPopup("<p>⚠ Select a technician category.</p>");
  if (role === "user" && !department) return showPopup("<p>⚠ Select a department.</p>");

  try {
    const res = await fnCreate({
      fullName,
      email,
      role,
      category: role === "technician" ? category : "",
      department: role === "user" ? department : "",
      contactNumber: phone
    });
    const data = res?.data || {};
    showPopup(`
      <div style="text-align:left">
        <p>✅ <b>Account created.</b></p>
        <p><b>Email:</b> ${email}</p>
        <p><b>AURA ID:</b> <code>${data.auraId || "-"}</code></p>
        <p><b>Temp Password:</b> <code>${data.tempPassword || "(server generated)"}</code></p>
        <p style="margin-top:8px;">User must verify email. After verification, first login will force password change.</p>
      </div>
    `, "success");

    if (nameInp) nameInp.value = "";
    if (emailInp) emailInp.value = "";
    if (roleSel) roleSel.value = "";
    if (deptSel) { deptSel.value = ""; deptSel.style.display = "none"; }
    if (phoneInp) phoneInp.value = "";
    if (catSel)  { catSel.value = "";  catSel.style.display = "none"; }
  } catch (err) {
    console.error("Create account error:", err);
    let msg = "❌ Could not create account. ";
    if (err?.code) msg += `(${err.code}) `;
    if (err?.message) msg += err.message;
    showPopup(`<p>${msg}</p>`);
  }
});

/* logout */
logoutBtn?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to logout?")) return;
  await signOut(auth);
  try { sessionStorage.clear(); localStorage.clear(); } catch {}
  window.location.replace("index.html");
});

/* guard + tickets */
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "index.html");
  try {
    const uref = doc(db, "users", user.uid);
    const snap = await getDoc(uref);
    const data = snap.exists() ? snap.data() : {};
    const role = (data.role || data.Role || "").toLowerCase();

    if (role !== "super_admin") {
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const displayName  = (data?.name || data?.fullName || user.displayName || "Super Admin");
    const displayEmail = (data?.email || user.email || "-");
    if (profName)  profName.textContent  = displayName;
    if (profEmail) profEmail.textContent = displayEmail;

    document.querySelector(".logout-btn")?.remove();
    profileLogout?.addEventListener("click", async () => {
      await signOut(auth);
      try { sessionStorage.clear(); localStorage.clear(); } catch {}
      window.location.replace("index.html");
    });

    try { await fnBackfill({}); } catch (e) { console.warn("Backfill callable failed (not critical):", e); }
    try { await fnRecount({}); } catch (e) { console.warn("Recount failed (not critical):", e); }

    try { await renderDiagStats(); } catch (e) { console.warn("diagStats failed:", e); }

    await loadTickets();
  } catch (err) {
    console.error("Role check failed:", err);
    await signOut(auth);
    window.location.href = "index.html";
  }
});

/* --- Resolve AURA ID or Firebase UID to a real UID --- */
async function resolveTechUid(inputValue) {
  const val = (inputValue || "").trim();
  if (!val) throw new Error("Please enter a technician ID or UID.");
  const looksLikeUid = /^[A-Za-z0-9_-]{20,40}$/.test(val);
  if (looksLikeUid) return val;

  const qy = query(collection(db, "users"), where("auraId", "==", val));
  const snap = await getDocs(qy);
  if (snap.empty) throw new Error(`No technician found for AURA ID "${val}".`);
  return snap.docs[0].id;
}

async function loadTickets() {
  if (ticketsEl) ticketsEl.innerHTML = `<div style="color:#9ca3af;padding:16px;text-align:center;">Loading tickets...</div>`;

  const usersSnap = await getDocs(collection(db, "users"));
  const nameMap = {};
  usersSnap.forEach((u) => {
    const d = u.data();
    nameMap[u.id] = d.name || d.fullName || u.id;
  });

  const qy = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
  onSnapshot(qy, (snap) => {
    if (!ticketsEl) return;
    ticketsEl.innerHTML = "";

    snap.forEach((d) => {
      const t = d.data();
      const id = d.id;
      const userDisplay = nameMap[t.userId] || t.userId || "-";
      const techDisplay = nameMap[t.assignedTo] || t.assignedTo || "-";

      const prettyId =
        (t.ticketCode && String(t.ticketCode).trim()) ? String(t.ticketCode).trim() :
        (t.code && String(t.code).trim())             ? String(t.code).trim() :
        id;

      const statusColors = {
        Queued: "#de0707ff",
        Open: "#062bffff",
        "In Progress": "#eaaa16ff",
        Resolved: "#4f9904ff",
        Closed: "#6b7280",
        Warranty: "#520057ff",
        Workshop: "#02b3c0ff"
      };
      const statusColor = statusColors[t.status] || "#111827";

      const hasAuto = !!(t.autoDiagnosis || t.autoDiagnostic);
      const autoDiagTag = t.resolvedBy === "auto-diagnostic" || hasAuto
        ? `<span style="font-size:12px;color:#6b7280;">(auto-diagnose)</span>`
        : "";

      const row = document.createElement("div");
      row.style = `
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(6px);
        color: black;
        border-radius: 12px;
        padding: 16px;
        margin: 10px 0;
        font-family: 'Poppins', sans-serif;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        transition: transform 0.2s ease;
      `;
      row.onmouseover = () => (row.style.transform = "scale(1.02)");
      row.onmouseout  = () => (row.style.transform = "scale(1)");

      row.innerHTML = `
        <div style="font-weight:bold;font-size:17px;">
          ${escapeHtml(t.subject || "(No Subject)")}
          <span style="color:${statusColor};">[${t.status || "-"}]</span> ${autoDiagTag} —
          <span style="font-weight:normal;font-size:14px;">${prettyId}</span>
        </div>
        <div style="font-size:14px;margin-top:3px;color:black;">
          User: ${escapeHtml(userDisplay)} | Assigned: ${escapeHtml(techDisplay)}
        </div>
        <div id="action-${id}" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;"></div>
        <div id="details-${id}" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:rgba(0,0,0,0.05);"></div>
      `;
      ticketsEl.appendChild(row);

      const detailsEl = document.getElementById(`details-${id}`);
      if (detailsEl) {
        const ad = t.autoDiagnosis || t.autoDiagnostic;
        const conf = typeof ad?.confidence === "number" ? `${Math.round(ad.confidence * 100)}%` : "-";
        const steps = Array.isArray(ad?.steps) ? ad.steps : [];
        const adHtml = ad ? `
          <div style="border:1px solid #2a2a2a;border-radius:10px;padding:12px;margin:0 0 12px;background:#0f0f12;color:#e5e7eb">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
              <strong>Auto-Diagnose</strong>
              <span style="font-size:12px;color:#bbb">Rule:</span><span style="font-size:12px">${escapeHtml(ad.title || ad.ruleId || "-")}</span>
              <span style="font-size:12px;color:#bbb">Category:</span><span style="font-size:12px">${escapeHtml(ad.category || "-")}</span>
              <span style="font-size:12px;color:#bbb">Severity:</span><span style="font-size:12px">${escapeHtml(ad.severity || "-")}</span>
              <span style="font-size:12px;color:#bbb">Confidence:</span><span style="font-size:12px">${conf}</span>
            </div>
            ${steps.length ? `<ol style="margin:6px 0 0 18px">${steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>` : ""}
            ${ad.explanation ? `<p style="margin:8px 0 0;color:#aaa">${escapeHtml(ad.explanation)}</p>` : ""}
          </div>` : "";

        detailsEl.innerHTML = `
          ${adHtml}
          <p><strong>Description:</strong> ${escapeHtml(t.description || "-")}</p>
          <p><strong>Category:</strong> ${escapeHtml(t.category || "-")}</p>
          <p><strong>Created:</strong> ${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : "-"}</p>
          <p><strong>Updated:</strong> ${t.updatedAt?.toDate ? t.updatedAt.toDate().toLocaleString() : "-"}</p>
          ${
            t.photoURL || t.photoUrl
              ? `<img src="${t.photoURL || t.photoUrl}" alt="Ticket Photo"
                  style="max-width:100%;max-height:250px;height:auto;width:auto;margin-top:8px;border-radius:8px;display:block;object-fit:contain;box-shadow:0 2px 6px rgba(0,0,0,0.2);" />`
              : `<p><em>No photo uploaded</em></p>`
          }
        `;
      }

      const actionEl = document.getElementById(`action-${id}`);

      if (["Resolved", "Warranty", "Workshop"].includes(String(t.status))) {
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close Ticket";
        Object.assign(closeBtn.style, {
          background: "#dc2626", color: "white", border: "none", borderRadius: "8px",
          padding: "9px 15px", cursor: "pointer", fontWeight: "600",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
        });
        closeBtn.onmouseover = () => (closeBtn.style.background = "#b91c1c");
        closeBtn.onmouseout  = () => (closeBtn.style.background = "#dc2626");

        const editLink = document.createElement("span");
        editLink.textContent = "Edit";
        editLink.style.cssText = `
          color:#2563eb; text-decoration:underline; cursor:pointer;
          font-weight:100; margin-left:8px; align-self:center;
        `;

        editLink.onclick = () => {
          const overlay = mountOverlay(`
            <div class="popup-box" style="position:relative;">
              <p style="margin-bottom:12px;">Revert ticket from <b>${t.status}</b> to <b>In Progress</b>?</p>
              <div style="display:flex;gap:10px;justify-content:center;">
                <button id="edit-confirm-${id}">Yes, revert</button>
                <button id="edit-cancel-${id}" style="background:#6b7280;">Cancel</button>
              </div>
            </div>
          `);
          overlay.querySelector(`#edit-cancel-${id}`)?.addEventListener("click", () => overlay.remove());
          overlay.querySelector(`#edit-confirm-${id}`)?.addEventListener("click", async () => {
            try {
              await updateDoc(doc(db, "tickets", id), { status: "In Progress", updatedAt: serverTimestamp() });
              overlay.remove();
              showPopup("✅ Ticket reverted to In Progress.", "success");
            } catch (e) {
              console.error("Revert Error:", e);
              overlay.remove();
              showPopup("❌ Failed to revert ticket.");
            }
          });
        };

        closeBtn.onclick = async () => {
          const closedTime = new Date().toLocaleString();
          const currentStatus = String(t.status || "");
          const overlay = mountOverlay(`
            <div class="popup-box success" style="position:relative;">
              <button id="cancel-close-${id}" 
                style="position:absolute;top:6px;right:8px;background:none;border:none;
                       color:#f87171;font-size:20px;font-weight:bold;cursor:pointer;">×</button>
              <p><strong>Technician:</strong> ${escapeHtml(techDisplay)}</p>
              <p><strong>UID:</strong> ${escapeHtml(t.assignedTo || "-")}</p>
              <p><strong>Status:</strong> ${escapeHtml(t.status || "-")}</p>
              <p><strong>Closed Time:</strong> ${closedTime}</p>
              <select id="close-option-${id}" 
                style="margin-top:10px;width:100%;padding:8px;border-radius:6px;
                       background:#111827;color:#f9fafb;border:1px solid #374151;">
                <option value="Closed"   ${currentStatus === "Closed"   ? "selected" : ""}>Close Ticket</option>
                <option value="Warranty" ${currentStatus === "Warranty" ? "selected" : ""}>Warranty</option>
                <option value="Workshop" ${currentStatus === "Workshop" ? "selected" : ""}>Workshop</option>
              </select>
              <button id="confirm-close-${id}" style="margin-top:14px;">Confirm</button>
            </div>
          `);
          overlay.querySelector(`#cancel-close-${id}`)?.addEventListener("click", () => overlay.remove());
          overlay.querySelector(`#confirm-close-${id}`)?.addEventListener("click", async () => {
            try {
              const selectedStatus = overlay.querySelector(`#close-option-${id}`).value;
              await fnClose({ ticketId: id, finalStatus: selectedStatus });
              overlay.remove();
              showPopup(`✅ Ticket moved to ${selectedStatus} section!`, "success");
            } catch (err) {
              console.error("Close Ticket Error:", err);
              let msg = "❌ Failed to close ticket. ";
              if (err?.code) msg += `(${err.code}) `;
              if (err?.message) msg += err.message;
              showPopup(msg);
            }
          });
        };

        actionEl.appendChild(closeBtn);
        actionEl.appendChild(editLink);
      } else {
        actionEl.innerHTML = `
          <label>Assign Technician:</label>
          <input id="tech-${id}" placeholder="Technician ID or UID"/>
          <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#374151;">
            <input type="checkbox" id="ovr-${id}"/> Override capacity
          </label>
          <button id="as-${id}" class="btn">Assign</button>
          <label>Status:</label>
          <select id="st-${id}">
            ${["Open","In Progress","Resolved"].map((s) => `<option ${s === t.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <button id="up-${id}" class="btn">Update</button>
          <button id="desc-${id}" class="btn">Description</button>
        `;
      }

      stylePrimaryButtons(row);

      const assignBtn = document.getElementById(`as-${id}`);
      assignBtn?.addEventListener("click", async () => {
        const typed = (document.getElementById(`tech-${id}`)?.value || "").trim();
        const override = !!document.getElementById(`ovr-${id}`)?.checked;
        if (!typed) return showPopup("⚠ Please enter a technician ID or UID before assigning.");

        try {
          const uid = await resolveTechUid(typed);

          const techSnap = await getDoc(doc(db, "users", uid));
          if (!techSnap.exists()) return showPopup("⚠ Technician not found.");
          const techData = techSnap.data() || {};
          if ((techData.role || "").toLowerCase() !== "technician") {
            return showPopup("⚠ This account is not a technician.");
          }
          if (techData.active !== true) {
            return showPopup("⚠ This technician is inactive. Set 'active: true' to allow assignments.");
          }

          await fnAssign({ ticketId: id, techUid: uid, override });
          showPopup("✅ Ticket assigned to technician.", "success");
        } catch (err) {
          console.error("Assign Error:", err);
          const m = String(err?.message || "");
          if (m.includes("TECH_AT_CAPACITY")) {
            return showPopup("⚠ Technician is at capacity (4 active). Check 'Override capacity' to force assign.");
          }
          if (m.includes("TECH_INACTIVE")) {
            return showPopup("⚠ Technician is inactive.");
          }
          if (m.includes("NOT_TECH") || m.includes("NOT_TECHNICIAN")) {
            return showPopup("⚠ This account is not a technician.");
          }
          if (m.includes("TICKET_ALREADY_ASSIGNED")) {
            return showPopup("⚠ Ticket is already assigned.");
          }
          showPopup("❌ Failed to assign technician.");
        }
      });

      const updateBtn = document.getElementById(`up-${id}`);
      updateBtn?.addEventListener("click", async () => {
        const s = (document.getElementById(`st-${id}`)?.value || "");
        try {
          const tSnap = await getDoc(doc(db, "tickets", id));
          const ticketData = tSnap.data() || {};
          if (!ticketData.assignedTo || ticketData.assignedTo === "-") {
            return showPopup("⚠ Assign a technician before updating status.");
          }
          await updateDoc(doc(db, "tickets", id), { status: s, updatedAt: serverTimestamp() });
          showPopup("✅ Status updated.", "success");
        } catch (err) {
          console.error("Update Error:", err);
          showPopup("❌ Failed to update status.");
        }
      });

      const descBtn = document.getElementById(`desc-${id}`);
      descBtn?.addEventListener("click", () => {
        const det = document.getElementById(`details-${id}`);
        if (!det) return;
        det.style.display = det.style.display === "none" ? "block" : "none";
      });
    });
  });
}

window.addEventListener("pageshow", (e) => { if (e.persisted) window.location.reload(); });

/* ---------- Dashboard: Auto-Diagnose Impact ---------- */
async function renderDiagStats() {
  if (!diagStatsEl) return;

  diagStatsEl.innerHTML = `
    <div style="border:1px solid #2a2a2a;border-radius:10px;padding:12px;background:#0f0f12;color:#e5e7eb;margin:16px;">
      <div>Loading Auto-Diagnose Impact…</div>
    </div>
  `;

  const tally = new Map();

  const histSnap = await getDocs(collection(db, "ticketHistory"));
  histSnap.forEach(d => {
    const x = d.data() || {};
    const key = x.ruleId || "unknown";
    if (!tally.has(key)) tally.set(key, { title: x.ruleTitle || key, autoResolved: 0, tickets: 0 });
    tally.get(key).autoResolved++;
  });

  const tSnap = await getDocs(collection(db, "tickets"));
  tSnap.forEach(d => {
    const t = d.data() || {};
    const ad = t.autoDiagnosis || t.autoDiagnostic;
    if (!ad) return;
    const key = ad.ruleId || "unknown";
    if (!tally.has(key)) tally.set(key, { title: ad.title || key, autoResolved: 0, tickets: 0 });
    tally.get(key).tickets++;
  });

  const rows = Array.from(tally.values())
    .sort((a,b) => (b.autoResolved + b.tickets) - (a.autoResolved + a.tickets))
    .slice(0, 10);

  diagStatsEl.innerHTML = `
    <div style="border:1px solid #2a2a2a;border-radius:10px;padding:12px;background:#0f0f12;color:#e5e7eb;margin:16px;">
      <h3 style="margin:0 0 8px">Auto-Diagnose Impact</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>
          <th style="text-align:left;border-bottom:1px solid #333;padding:6px 0">Rule</th>
          <th style="text-align:right;border-bottom:1px solid #333;padding:6px 0">Auto-resolved</th>
          <th style="text-align:right;border-bottom:1px solid #333;padding:6px 0">Tickets</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="padding:6px 0">${escapeHtml(r.title)}</td>
              <td style="text-align:right">${r.autoResolved}</td>
              <td style="text-align:right">${r.tickets}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}
