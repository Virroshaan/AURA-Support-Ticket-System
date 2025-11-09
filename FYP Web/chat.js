// chat.js — Admin ↔ Technician direct chat (replaces old ticket chat)

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyAQnERziOOCtj8oHcVJzRXMsh5-ttA5nBc",
  authDomain: "aura-support-ticket-system.firebaseapp.com",
  projectId: "aura-support-ticket-system",
  storageBucket: "aura-support-ticket-system.firebasestorage.app",
  messagingSenderId: "363377520981",
  appId: "1:363377520981:web:2a691829a15977e5cb3fdc",
  measurementId: "G-ZZ0F1EYLHW",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ---
const userList   = document.getElementById("user-list");
const chatMeta   = document.getElementById("chat-meta");
const messagesEl = document.getElementById("messages");
const sendBtn    = document.getElementById("sendBtn");
const inputEl    = document.getElementById("messageInput");

// current session state
let currentRoomId = null;       // directChats roomId (adminUid_techUid, sorted)
let currentTech = null;         // { uid, name, email }
let unsubMessages = null;       // snapshot unsubscribe

// --- Helpers ---
function clearMessagesUI() {
  messagesEl.innerHTML = `<p class="muted" style="text-align:center; margin-top:20px">
    --- Select a user to start chat ---
  </p>`;
}

function unsubscribeMessages() {
  if (unsubMessages) unsubMessages();
  unsubMessages = null;
}

// Same roomId algorithm as Android (sorted UIDs)
function roomIdOf(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Render one message bubble
function renderMessageBubble(m, myUid) {
  const div = document.createElement("div");
  const mine = m.senderId === myUid;
  div.className = mine ? "msg admin" : "msg user";
  div.textContent = m.text || "";
  messagesEl.appendChild(div);
}

// Ensure a direct chat room exists with participants
async function ensureRoom(roomId, adminUid, techUid) {
  await setDoc(
    doc(db, "directChats", roomId),
    {
      participants: [adminUid, techUid],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// --- Load technicians for the left list ---
async function loadTechnicians() {
  const qTechs = query(
    collection(db, "users"),
    where("role", "in", ["technician", "Technician"])
  );
  const snap = await getDocs(qTechs);

  userList.innerHTML = "";
  if (snap.empty) {
    userList.innerHTML = `<p class="placeholder">No technicians found.</p>`;
    clearMessagesUI();
    return;
  }

  snap.forEach((d) => {
    const u = d.data() || {};
    const techUid = d.id;
    const name  = u.name || u.displayName || "Technician";
    const email = u.email || "";
    const photo = u.photoURL || u.photoUrl || "";  // optional photo from your app

    // <div class="user-item" data-uid="...">
    const item = document.createElement("div");
    item.className = "user-item";
    item.dataset.uid = techUid;

    // Avatar (photo or default SVG) – build with DOM to avoid template errors
    let avatarEl;
    if (photo) {
      const img = document.createElement("img");
      img.className = "avatar-img";
      img.src = photo;
      img.alt = "avatar";
      avatarEl = img;
    } else {
      const wrap = document.createElement("div");
      wrap.className = "user-avatar";
      wrap.setAttribute("aria-hidden", "true");
      wrap.innerHTML =
        `<svg viewBox="0 0 24 24" width="22" height="22"
              fill="none" stroke="#cbd5e1" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
           <circle cx="12" cy="8" r="4"></circle>
           <path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path>
         </svg>`;
      avatarEl = wrap;
    }

    // Info block
    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML =
      `<div style="font-weight:600">${name}</div>
       <div class="muted" style="font-size:12px">${email}</div>`;

    item.appendChild(avatarEl);
    item.appendChild(info);

    // Click handler (important)
    item.addEventListener("click", () =>
      selectTechnician({ uid: techUid, name, email })
    );

    userList.appendChild(item);
  });
}


// --- When admin selects a technician from the list ---
async function selectTechnician(tech) {
  const admin = auth.currentUser;
  if (!admin) {
    window.location.replace("login.html");
    return;
  }

  // UI state
  document.querySelectorAll(".user-item").forEach(el => el.classList.remove("active"));
  const selected = document.querySelector(`.user-item[data-uid="${tech.uid}"]`);
  if (selected) selected.classList.add("active");

  chatMeta.textContent = `Chat — ${tech.name || "Technician"}`;
  inputEl.disabled = false;
  sendBtn.disabled = false;

  // compute room, ensure exists
  const roomId = roomIdOf(admin.uid, tech.uid);
  currentRoomId = roomId;
  currentTech   = tech;

  await ensureRoom(roomId, admin.uid, tech.uid);
  attachMessagesListener(roomId, admin.uid);
}

// --- Attach listener to the direct room messages ---
function attachMessagesListener(roomId, myUid) {
  unsubscribeMessages();

  const qMsg = query(
    collection(db, "directChats", roomId, "messages"),
    orderBy("createdAt", "asc")
  );

  unsubMessages = onSnapshot(
    qMsg,
    (snap) => {
      messagesEl.innerHTML = "";
      snap.forEach((d) => {
        renderMessageBubble(d.data(), myUid);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    },
    (err) => {
      console.error("Listen error:", err);
      Swal.fire("Listen error", err.message || String(err), "error");
    }
  );
}

// --- Send message to the current room ---
async function sendMessage() {
  const admin = auth.currentUser;
  if (!admin || !currentRoomId) return;

  const text = inputEl.value.trim();
  if (!text) return;

  await addDoc(collection(db, "directChats", currentRoomId, "messages"), {
    senderId: admin.uid,
    text,
    createdAt: serverTimestamp(),
  });

  inputEl.value = "";
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Navigation ---
document.getElementById("menu-dashboard").addEventListener("click", () => {
  window.location.href = "main.html";
});
document.getElementById("menu-techs").addEventListener("click", () => {
  window.location.href = "technicians.html";
});
document.getElementById("menu-tickets").addEventListener("click", () => {
  window.location.href = "history.html";
});
document.getElementById("menu-logout").addEventListener("click", async () => {
  const result = await Swal.fire({
    title: "Logout?",
    text: "Are you sure you want to logout?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, logout",
    confirmButtonColor: "#dc2626",
  });
  if (result.isConfirmed) {
    await signOut(auth);
    sessionStorage.clear();
    localStorage.clear();
    window.location.replace("login.html");
  }
});

// --- Init ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  await loadTechnicians();
  clearMessagesUI();
});

// --- Events ---
sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
