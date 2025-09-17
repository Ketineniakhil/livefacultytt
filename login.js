import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const SUPABASE_URL = 'https://ezpvndamsyabfbdpadeh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cHZuZGFtc3lhYmZiZHBhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0ODU3NjksImV4cCI6MjA3MzA2MTc2OX0.yOi2-xn4UAnOC2H142x5daoS4DhNvJBtIv1RQCkeK94';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('login-form');
const messageEl = document.getElementById('message');

// ---- If already logged in, skip login page ----
async function checkAlreadyLoggedIn() {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session) {
    window.location.href = "admin.html";
  }
}
checkAlreadyLoggedIn();

// ---- Handle login form submit ----
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    messageEl.textContent = "Logging in...";

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      messageEl.textContent = error.message;
      messageEl.style.color = "red";
    } else {
      messageEl.textContent = "Login successful! Redirecting...";
      messageEl.style.color = "green";
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 800);
    }
  });
}
