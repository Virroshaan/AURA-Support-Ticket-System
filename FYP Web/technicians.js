import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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
const db = getFirestore(app);

// DOM
const bodyEl = document.getElementById("techBody");
const emptyEl = document.getElementById("emptyState");
const qInp = document.getElementById("q");
const catSel = document.getElementById("category");
const applyBtn = document.getElementById("apply");
const clearBtn = document.getElementById("clear");

// navigation
document.getElementById("menu-dashboard")?.addEventListener("click", () => location.href = "main.html");
document.getElementById("menu-chat")?.addEventListener("click", () => location.href = "chat.html");
document.getElementById("menu-history")?.addEventListener("click", () => location.href = "history.html");
document.getElementById("menu-techs")?.addEventListener("click", () => location.href = "technicians.html");

let allTechs = [];

async function loadTechnicians() {
  const snap = await getDocs(collection(db, "users"));
  allTechs = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    if ((d.role || "").toLowerCase() === "technician") {
      allTechs.push({
        id: doc.id,
        auraId: d.auraId || "",
        name: d.name || d.fullName || "-",
        email: d.email || "-",
        contact: d.phone || d.contact || "-", 
        category: d.category || "General",
      });
    }
  });
  render();
}

function render(list = allTechs) {
  const q = (qInp?.value || "").trim().toLowerCase();
  const cat = (catSel?.value || "").trim();
  let data = list;

  if (q) {
    data = data.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.auraId.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }
  if (cat) data = data.filter(t => (t.category || "").toLowerCase() === cat.toLowerCase());

  bodyEl.innerHTML = "";
  if (!data.length) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  data.forEach(t => {
    const prettyId = t.auraId || t.id;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.email)}</td>
      <td>${escapeHtml(t.contact)}</td>
      <td class="uid-cell">
        <span>${escapeHtml(prettyId)}</span>
        <button class="copy-btn" data-copy="${escapeAttr(prettyId)}">Copy</button>
      </td>
      <td>${escapeHtml(t.category)}</td>
    `;
    bodyEl.appendChild(tr);
  });

  bodyEl.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1000);
      } catch {
        alert("Failed to copy");
      }
    });
  });
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s = "") {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

applyBtn?.addEventListener("click", () => render());
clearBtn?.addEventListener("click", () => {
  if (qInp) qInp.value = "";
  if (catSel) catSel.value = "";
  render();
});

loadTechnicians();
