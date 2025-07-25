import { login } from '../common/auth.js';

// Limpiar usuario anterior al cargar la página de login
localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMessage'); // Usamos el div de error del HTML
const errorText = document.getElementById('errorText');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = form.email.value;
  const password = form.password.value;
  
  // Reseteamos el estado del botón y el mensaje de error
  window.resetLoginButton();
  errorMsg.style.display = 'none';

  try {
    const user = await login(email, password);
    if (user.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
    } else {
      window.location.href = '../operario/home.html';
    }
  } catch (err) {
    // Usamos las funciones del HTML para mostrar el error
    window.showLoginError(err.message || 'Credenciales incorrectas');
  }
});