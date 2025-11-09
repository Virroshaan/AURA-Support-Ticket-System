// login.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAQnERziOOCtj8oHcVJzRXMsh5-ttA5nBc",
  authDomain: "aura-support-ticket-system.firebaseapp.com",
  projectId: "aura-support-ticket-system",
  storageBucket: "aura-support-ticket-system.firebasestorage.app",
  messagingSenderId: "363377520981",
  appId: "1:363377520981:web:2a691829a15977e5cb3fdc",
  measurementId: "G-ZZ0F1EYLHW"
};

// Init
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Only redirect from login page if this tab actually logged in AND email is verified
onAuthStateChanged(auth, (user) => {
  try {
    const currentPage = window.location.pathname.split('/').pop();
    const isLoginPage = currentPage === 'index.html' || currentPage === '' || currentPage === '/';

    const didThisTabLogin = sessionStorage.getItem('auraAuth') === 'true';
    if (user && didThisTabLogin && user.emailVerified) {
      if (isLoginPage) {
        const lastPage = sessionStorage.getItem('lastPage') || 'main.html';
        window.location.replace(lastPage);
      }
    }
    // if user exists but not verified or not this tab -> do nothing
  } catch (e) {
    console.error('Auth state handler error:', e);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const submit = document.getElementById('submit');
  if (!submit) return;

  submit.addEventListener('click', async function (event) {
    event.preventDefault();

    const form = submit.closest('form') || document.querySelector('form');
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';
    if (!email || !password) { if (form) form.reportValidity(); return; }

    submit.disabled = true;

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // ✅ 2-step: block unverified accounts
      if (!user.emailVerified) {
        try { await sendEmailVerification(user); } catch (_) {}
        alert(`Please verify your email first. We just sent a verification email to ${email}.`);
        sessionStorage.removeItem('auraAuth');
        await signOut(auth);
        return; // stop here
      }

      // Verified → allow entry
      sessionStorage.setItem('auraAuth', 'true');
      const lastPage = sessionStorage.getItem('lastPage') || 'main.html';
      alert('Logging in...');
      window.location.replace(lastPage);
    } catch (err) {
      alert(err.message || 'Login failed');
    } finally {
      submit.disabled = false;
    }
  });
});
