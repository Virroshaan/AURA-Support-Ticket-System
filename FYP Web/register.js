// register.js  (admin Create Account flow, ported from admin.js)

// Firebase
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
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
getAuth(app);            // not used here directly, but kept identical init
getFirestore(app);       // same
const functions = getFunctions(app, "asia-southeast1");

// callable exactly like admin.js
const fnCreate = httpsCallable(functions, "adminCreateUser");

// DOM shortcuts map to same IDs you used on dashboard
const $ = (id) => document.getElementById(id);
const nameInp = $("newName");
const emailInp = $("newEmail");
const roleSel  = $("newRole");
const deptSel  = $("newDept");
const catSel   = $("techCategory");
const phoneInp = $("newPhone");
const createBtn = $("btnCreate");
const backBtn   = $("btnBack");

// popup styling and helpers (mirrors admin.js look & feel)
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
function mountOverlay(html) {
  const overlay = document.createElement("div");
  overlay.className = "custom-popup";
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  return overlay;
}
function showPopup(message, type = "error", onOk) {
  document.querySelector(".custom-popup")?.remove();
  const overlay = mountOverlay(`
    <div class="popup-box ${type}">
      ${message}
      <div style="margin-top:12px;"><button id="popup-ok">OK</button></div>
    </div>
  `);
  overlay.querySelector("#popup-ok")?.addEventListener("click", () => {
    overlay.remove();
    if (typeof onOk === "function") onOk();
  });
}

// validations identical in spirit
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || "");
const isValidPhone = (p) => {
  const s = String(p || "").replace(/\D/g, "");
  return s.length >= 9 && s.length <= 12;
};

// role UI like admin.js
function applyRoleUI() {
  const role = (roleSel?.value || "").toLowerCase();
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

// Create
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

    // success popup same style, then redirect to dashboard
    showPopup(`
      <div style="text-align:left">
        <p>✅ <b>Account created.</b></p>
        <p><b>Email:</b> ${email}</p>
        <p><b>AURA ID:</b> <code>${data.auraId || "-"}</code></p>
        <p><b>Temp Password:</b> <code>${data.tempPassword || "(server generated)"}</code></p>
        <p style="margin-top:8px;">User must verify email. After verification, first login will force password change.</p>
      </div>
    `, "success", () => { window.location.href = "main.html"; });

    // clear fields
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

// Back button with confirm
backBtn?.addEventListener("click", () => {
  if (confirm("Cancel and go back to dashboard?")) {
    window.location.href = "main.html";
  }
});
