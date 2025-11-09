// history.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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

// DOM
const $ = (id) => document.getElementById(id);
const bodyEl   = $("historyBody");
const emptyEl  = $("emptyState");
const qInp     = $("q");
const catSel   = $("category");
const statusSel= $("status");
const dateInp  = $("closedOn");          // harmless if not present
const applyBtn = $("apply");
const clearBtn = $("clear");
const startDateInp = $("startDate");
const endDateInp   = $("endDate");
const printReportBtn = $("printReport");

// sidebar nav
document.getElementById("menu-dashboard")?.addEventListener("click", () => location.href = "main.html");
document.getElementById("menu-chat")?.addEventListener("click", () => location.href = "chat.html");
document.getElementById("menu-techs")?.addEventListener("click", () => location.href = "technicians.html");
document.getElementById("menu-history")?.addEventListener("click", () => location.href = "history.html");

let cache = [];
let userMap = {};

onAuthStateChanged(auth, async (user) => {
  if (!user) return (location.href = "index.html");
  try {
    // confirm super_admin
    const usersSnap = await getDocs(collection(db, "users"));
    userMap = {};
    let meRole = "";
    usersSnap.forEach((u) => {
      const d = u.data() || {};
      userMap[u.id] = d.name || d.fullName || d.email || u.id;
      if (u.id === user.uid) meRole = (d.role || d.Role || "").toLowerCase();
    });
    if (meRole !== "super_admin") {
      await signOut(auth);
      location.href = "index.html";
      return;
    }
    await loadHistory();
  } catch (e) {
    console.error(e);
    await signOut(auth);
    location.href = "index.html";
  }
});

async function loadHistory() {
  bodyEl.innerHTML = `<tr><td colspan="8" style="padding:12px;color:#9ca3af;text-align:center;">Loading...</td></tr>`;

  const qy = query(collection(db, "ticketHistory"), orderBy("closedAt", "desc"));
  const snap = await getDocs(qy);

  cache = [];
  snap.forEach((d) => {
    const t = d.data() || {};
    const ad = t.autoDiagnosis || t.autoDiagnostic || null;

    cache.push({
      id: d.id,
      code: t.ticketCode || t.originalTicketId || d.id,   // show TKT-... when present
      title: t.subject || "",
      category: t.category || "",
      closedAt: t.closedAt?.toDate ? t.closedAt.toDate() : null,
      handledBy: t.handledBy || t.assignedTo || "",
      status: t.status || "Closed",
      auto: ad
        ? {
            ruleId: ad.ruleId || t.ruleId || "",
            title: ad.title || t.ruleTitle || "",
            category: ad.category || "",
            severity: ad.severity || "",
            confidence: typeof ad.confidence === "number" ? ad.confidence : null,
            steps: Array.isArray(ad.steps) ? ad.steps : [],
            explanation: ad.explanation || ""
          }
        : null
    });
  });

  render();
}

// build the same filtered list used for the on-screen table
function getFilteredList() {
  const q = (qInp?.value || "").trim().toLowerCase();
  const cat = (catSel?.value || "").trim();
  const st  = (statusSel?.value || "").trim();
  const dateStr = (dateInp?.value || "").trim(); // yyyy-mm-dd (legacy single-day)

  const startStr = (startDateInp && startDateInp.value ? startDateInp.value : "").trim();
  const endStr   = (endDateInp && endDateInp.value ? endDateInp.value : "").trim();

  let list = cache.slice();

  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q)
    );
  }
  if (cat) list = list.filter(t => t.category === cat);
  if (st)  list = list.filter(t => t.status === st);

  if (startStr || endStr) {
    const start = startStr ? new Date(startStr) : new Date(0);
    const end   = endStr ? new Date(endStr) : new Date();
    end.setHours(23,59,59,999);
    list = list.filter(t => t.closedAt && t.closedAt >= start && t.closedAt <= end);
  } else if (dateStr) {
    const y = Number(dateStr.slice(0,4));
    const m = Number(dateStr.slice(5,7)) - 1;
    const d = Number(dateStr.slice(8,10));
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end   = new Date(y, m, d, 23, 59, 59, 999);
    list = list.filter(t => t.closedAt && t.closedAt >= start && t.closedAt <= end);
  }

  return list;
}

function render() {
  const list = getFilteredList();

  bodyEl.innerHTML = "";
  if (!list.length) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  for (const t of list) {
    // main row
    const tr = document.createElement("tr");
    const pillClass =
      t.status === "Resolved" ? "resolved" :
      t.status === "Warranty" ? "warranty" :
      t.status === "Workshop" ? "workshop" : "";

    tr.innerHTML = `
      <td style="font-family:monospace;">${escapeHtml(t.code)}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.category || "-")}</td>
      <td>${t.closedAt ? t.closedAt.toLocaleString() : "-"}</td>
      <td>${escapeHtml(userMap[t.handledBy] || t.handledBy || "-")}</td>
      <td><span class="pill ${pillClass}">${escapeHtml(t.status)}</span></td>
      <td>${t.auto ? '<span class="pill auto">AUTO</span>' : '-'}</td>
      <td><button class="toggle" data-det="${t.id}">Toggle</button></td>
    `;
    bodyEl.appendChild(tr);

    // details row
    const det = document.createElement("tr");
    det.id = `det-${t.id}`;
    det.style.display = "none";
    det.innerHTML = `
      <td colspan="8">
        <div class="details-box">
<button class="print-single" data-print="${t.id}" title="Print this ticket"
  style="position:absolute; top:10px; right:10px; background:none; border:none; cursor:pointer; opacity:0.9; z-index:5; pointer-events:auto;">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#fff" viewBox="0 0 24 24">
    <path d="M6 9V2h12v7h4v10h-4v5H6v-5H2V9h4zm10-5H8v5h8V4zm0 17v-3H8v3h8zM6 11H4v6h16v-6H6z"/>
  </svg>
</button>
          ${renderAuto(t.auto)}
          <div style="color:#cbd5e1">
            <div><b>Ticket:</b> ${escapeHtml(t.code)}</div>
            <div><b>Title:</b> ${escapeHtml(t.title)}</div>
            <div><b>Category:</b> ${escapeHtml(t.category || "-")}</div>
            <div><b>Closed on:</b> ${t.closedAt ? t.closedAt.toLocaleString() : "-"}</div>
            <div><b>Handled by:</b> ${escapeHtml(userMap[t.handledBy] || t.handledBy || "-")}</div>
            <div><b>Status:</b> ${escapeHtml(t.status)}</div>
          </div>
        </div>
      </td>`;
    bodyEl.appendChild(det);
  }

  // wire toggles
  bodyEl.querySelectorAll(".toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-det");
      const row = document.getElementById(`det-${id}`);
      if (row) row.style.display = row.style.display === "none" ? "table-row" : "none";
    });
  });

  // bind individual print
  bodyEl.querySelectorAll(".print-single").forEach(btn => {
    btn.addEventListener("click", handleSinglePrint, { passive: true });
  });
}

function renderAuto(ad) {
  if (!ad) return `<div class="ad-card" style="opacity:.7"><b>Auto-Diagnose:</b> none</div>`;
  const conf = typeof ad.confidence === "number" ? `${Math.round(ad.confidence * 100)}%` : "-";
  const steps = Array.isArray(ad.steps) && ad.steps.length
    ? `<ol style="margin:6px 0 0 18px">${ad.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`
    : `<em>No steps recorded</em>`;
  return `
    <div class="ad-card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <strong>Auto-Diagnose</strong>
        <span style="font-size:12px;color:#bbb">Rule:</span><span style="font-size:12px">${escapeHtml(ad.title || ad.ruleId || "-")}</span>
        <span style="font-size:12px;color:#bbb">Category:</span><span style="font-size:12px">${escapeHtml(ad.category || "-")}</span>
        <span style="font-size:12px;color:#bbb">Severity:</span><span style="font-size:12px">${escapeHtml(ad.severity || "-")}</span>
        <span style="font-size:12px;color:#bbb">Confidence:</span><span style="font-size:12px">${conf}</span>
      </div>
      ${steps}
      ${ad.explanation ? `<p style="margin:8px 0 0;color:#aaa">${escapeHtml(ad.explanation)}</p>` : ""}
    </div>
  `;
}

applyBtn?.addEventListener("click", render);
clearBtn?.addEventListener("click", () => {
  if (qInp) qInp.value = "";
  if (catSel) catSel.value = "";
  if (statusSel) statusSel.value = "";
  if (dateInp) dateInp.value = "";
  if (startDateInp) startDateInp.value = "";
  if (endDateInp) endDateInp.value = "";
  render();
});

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ------- printing (loads library only when needed) ------- */
function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
    s.onload = () => resolve(window.html2pdf);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* === FINAL ROW LAYOUT: no Auto column, dates fit, A4-safe === */
function buildGridDoc(tickets, heading) {
  const wrap = document.createElement("div");
  const stamp = new Date().toLocaleString();
  wrap.innerHTML = `
    <style>
      * { color:#000 !important; background:#fff !important; box-shadow:none !important; }
      .doc{
        font-family:"Segoe UI", Arial, Helvetica, sans-serif;
        font-size:7.6pt;                  /* compact so timestamps stay inline */
        line-height:1.25;
      }
      .top{
        display:flex; justify-content:space-between; align-items:flex-start;
        margin-bottom:5px;
      }
      .title{ font-size:11pt; font-weight:700; margin:0; }
      .stamp{ font-size:7pt; white-space:nowrap; color:#444; }

      /* Columns: ID | Title | Category | Closed on | Handled By | Status */
      /* Percentages sum to 100% and give extra space to date/person */
      .header, .row{
        display:grid;
        grid-template-columns: 12% 28% 12% 18% 18% 12%;
        column-gap:6px;
        align-items:center;
        width:100%;
      }
      .header{
        font-size:7.2pt;
        font-weight:700;
        padding:3px 0 4px 0;
        border-bottom:1px solid #e5e5e5;
      }
      .row{
        padding:3px 0 4px 0;
        border-bottom:1px solid #f1f1f1;
      }
      .cell{
        white-space:nowrap;        /* keep everything on one line */
        overflow:hidden;
        text-overflow:ellipsis;    /* truncate gracefully if needed */
      }
    </style>

    <div class="doc">
      <div class="top">
        <div class="title">${escapeHtml(heading)}</div>
        <div class="stamp">${stamp}</div>
      </div>

      <div class="header">
        <div class="cell">Ticket ID</div>
        <div class="cell">Title</div>
        <div class="cell">Category</div>
        <div class="cell">Closed on</div>
        <div class="cell">Handled By</div>
        <div class="cell">Status</div>
      </div>

      ${tickets.map(t => `
        <div class="row">
          <div class="cell">${escapeHtml(t.code)}</div>
          <div class="cell">${escapeHtml(t.title)}</div>
          <div class="cell">${escapeHtml(t.category || "-")}</div>
          <div class="cell">${t.closedAt ? t.closedAt.toLocaleString() : "-"}</div>
          <div class="cell">${escapeHtml(userMap[t.handledBy] || t.handledBy || "-")}</div>
          <div class="cell">${escapeHtml(t.status)}</div>
        </div>
      `).join("")}
    </div>
  `;
  return wrap;
}



/* Overall report print */
printReportBtn?.addEventListener("click", async () => {
  try {
    const list = getFilteredList();
    const ok = window.confirm(`Generate PDF for ${list.length} ticket(s) with current filters?`);
    if (!ok) return;
    await loadHtml2Pdf();

    const doc = buildGridDoc(list, "AURA Tickets Report");
    const opt = {
      margin: 0.5,
      filename: `Aura_Report_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };
    window.html2pdf().set(opt).from(doc).save();
  } catch (e) {
    console.error(e);
  }
});

/* Individual ticket print: same header + one row */
async function handleSinglePrint(ev) {
  try {
    ev?.stopPropagation?.();
    const btn = ev?.currentTarget || ev?.target?.closest?.(".print-single");
    if (!btn) return;
    const id = btn.getAttribute("data-print");
    const ticket = cache.find(t => t.id === id);
    if (!ticket) return;

    const ok = window.confirm(`Generate PDF for ticket ${ticket.code}?`);
    if (!ok) return;

    await loadHtml2Pdf();

    const doc = buildGridDoc([ticket], "Ticket Details");
    const opt = {
      margin: 0.5,
      filename: `${ticket.code}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };
    window.html2pdf().set(opt).from(doc).save();
  } catch (err) {
    console.error(err);
  }
}

// delegated fallback just in case
document.body.addEventListener("click", (e) => {
  const maybe = e.target.closest?.(".print-single");
  if (maybe) handleSinglePrint(e);
});
