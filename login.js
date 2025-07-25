// src/login/login.js
import { login } from '../common/auth.js';

// Limpiar usuario anterior (moved to auth.js logout)
// localStorage.removeItem('user'); // Keep this line to clear local storage on initial load

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMessage'); // Assuming your HTML has an element with id 'errorMessage'

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = form.email.value;
  const password = form.password.value;

  // Show loading state and hide error message
  loginBtn.disabled = true;
  loginText.style.display = 'none';
  loadingSpinner.style.display = 'block';
  errorMsg.style.display = 'none';

  try {
    const user = await login(email, password);
    if (user.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
    } else if (user.role === 'operario') {
      window.location.href = '../operario/home.html';
    } else {
      // Handle other roles or default redirection
      console.warn("User has an unhandled role:", user.role);
      window.location.href = '../operario/home.html'; // Or a generic dashboard
    }
  } catch (err) {
    document.getElementById('errorText').textContent = 'Credenciales incorrectas: ' + err.message;
    errorMsg.style.display = 'block';
    loginBtn.disabled = false;
    loginText.style.display = 'block';
    loadingSpinner.style.display = 'none';
  }
});

// Initial clearing of user data on login page load
document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('user');
  // Also ensure the button and spinner are in their default state
  const loginBtn = document.getElementById('loginBtn');
  const loginText = document.getElementById('loginText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  loginBtn.disabled = false;
  loginText.style.display = 'block';
  loadingSpinner.style.display = 'none';
});