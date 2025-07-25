import { login } from '../common/auth.js';

// Limpiar cualquier sesión anterior al cargar la página de login
localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMsgDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Deshabilitar botón y mostrar spinner (usando funciones del HTML)
  if (window.resetLoginButton) window.resetLoginButton();
  loginBtn.disabled = true;
  document.getElementById('loginText').style.display = 'none';
  document.getElementById('loadingSpinner').style.display = 'block';
  errorMsgDiv.style.display = 'none';

  const email = form.email.value;
  const password = form.password.value;
  
  try {
    const user = await login(email, password);
    // Redirección según el rol del usuario
    if (user.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
    } else if (user.role === 'operario' || user.role === 'supervisor') {
      window.location.href = '../operario/home.html';
    } else {
       throw new Error("Rol de usuario no reconocido.");
    }
  } catch (err) {
    // Mostrar error usando la función del HTML
    if (window.showLoginError) {
      window.showLoginError(err.message || 'Credenciales incorrectas.');
    } else {
      errorTextSpan.textContent = err.message || 'Credenciales incorrectas.';
      errorMsgDiv.style.display = 'block';
    }
  } finally {
    // Reactivar el botón si no hubo redirección
    if (window.resetLoginButton) window.resetLoginButton();
  }
});