import { login } from '../common/auth.js';

// Limpiar usuario anterior al cargar la página
localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessageDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // --- Mostrar estado de carga ---
  loginBtn.disabled = true;
  loginText.style.display = 'none';
  loadingSpinner.style.display = 'block';
  errorMessageDiv.classList.add('hidden'); // Ocultar errores previos

  const email = form.email.value;
  const password = form.password.value;

  try {
    const user = await login(email, password);
    if (user.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
    } else {
      window.location.href = '../operario/home.html';
    }
  } catch (err) {
    // --- Mostrar el mensaje de error ---
    errorTextSpan.textContent = 'El email o la contraseña son erróneos.';
    errorMessageDiv.classList.remove('hidden');

    // --- Restaurar el botón ---
    loginBtn.disabled = false;
    loginText.style.display = 'block';
    loadingSpinner.style.display = 'none';
  }
});