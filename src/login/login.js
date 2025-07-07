import { login } from '../common/auth.js';

localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessageDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  loginBtn.disabled = true;
  loginText.style.display = 'none';
  loadingSpinner.style.display = 'block';
  errorMessageDiv.classList.add('hidden');

  const email = form.email.value;
  const password = form.password.value;

  try {
    const user = await login(email, password);
    if (user.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
    } else if (user.role === 'supervisor') {
      window.location.href = '../supervisor/dashboard.html';
    } else {
      window.location.href = '../operario/home.html';
    }
  } catch (err) {
    errorTextSpan.textContent = 'El email o la contraseña son erróneos.';
    errorMessageDiv.classList.remove('hidden');

    loginBtn.disabled = false;
    loginText.style.display = 'block';
    loadingSpinner.style.display = 'none';
  }
});