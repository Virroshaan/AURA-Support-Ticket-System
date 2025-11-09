// logout.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// Firebase config (same as login.js)
const firebaseConfig = {
  apiKey: "AIzaSyAQnERziOOCtj8oHcVJzRXMsh5-ttA5nBc",
  authDomain: "aura-support-ticket-system.firebaseapp.com",
  projectId: "aura-support-ticket-system",
  storageBucket: "aura-support-ticket-system.firebasestorage.app",
  messagingSenderId: "363377520981",
  appId: "1:363377520981:web:2a691829a15977e5cb3fdc",
  measurementId: "G-ZZ0F1EYLHW"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  const sidebarLogout  = document.getElementById("menu-logout");   // may not exist anymore
  const profileLogout  = document.getElementById("profileLogout"); // avatar dropdown button

  // Reusable logout
  async function doLogout() {
    try {
      await signOut(auth);
      try { sessionStorage.clear(); localStorage.clear(); } catch {}
      window.location.replace("index.html");
    } catch (error) {
      alert("Error during logout: " + (error?.message || error));
    }
  }

  // Attach a guarded handler (capture phase -> runs before any other listeners)
  function attachGuardedLogout(el) {
    if (!el) return;
    el.addEventListener(
      "click",
      async (e) => {
        // Intercept and block other handlers (like the one in admin.js)
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const confirmOut = confirm("Are you sure you want to logout?");
        if (!confirmOut) return;

        await doLogout();
      },
      true // <-- capture phase
    );
  }

  // Wire up both if present
  attachGuardedLogout(profileLogout);
  attachGuardedLogout(sidebarLogout);

  // 🔹 Auth state watcher
  onAuthStateChanged(auth, (user) => {
    const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
    const isLoginPage = currentPage === "index.html" || currentPage === "";

    if (user) {
      // ✅ Logged in
      if (isLoginPage) {
        const lastPage = sessionStorage.getItem("lastPage") || "main.html";
        window.location.replace(lastPage);
      } else {
        sessionStorage.setItem("lastPage", currentPage || "main.html");
      }
    } else {
      // ❌ Not logged in
      if (!isLoginPage) {
        window.location.replace("index.html");
      }
    }
  });

  // 🔹 Always prevent back navigation tricks
  window.history.pushState(null, "", window.location.href);
  window.onpopstate = () => {
    window.history.pushState(null, "", window.location.href);
  };
});
