import { login } from '../common/auth.js';

// Limpiar usuario anterior
localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('loginError');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
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
    errorMsg.textContent = 'Credenciales incorrectas';
    errorMsg.classList.remove('hidden');
  }
});
