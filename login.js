import { login } from './src/common/auth.js';

// Limpiar cualquier sesión anterior al cargar la página de login
localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMsgDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Ocultar errores previos y mostrar spinner
    errorMsgDiv.classList.add('hidden');
    loginBtn.disabled = true;
    document.getElementById('loginText').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'block';

    const email = form.email.value;
    const password = form.password.value;

    try {
        const user = await login(email, password);
        // Redirección según el rol del usuario
        if (user.role === 'admin') {
            window.location.href = '/src/admin/dashboard.html';
        } else if (user.role === 'supervisor') {
            window.location.href = '/src/supervisor/dashboard.html';
        } else if (user.role === 'operario') {
            window.location.href = '/src/operario/home.html';
        } else {
            throw new Error("Rol de usuario no reconocido.");
        }
    } catch (err) {
        // Mostrar error
        errorTextSpan.textContent = err.message || 'Credenciales incorrectas.';
        errorMsgDiv.classList.remove('hidden');
    } finally {
        // Reactivar el botón
        loginBtn.disabled = false;
        document.getElementById('loginText').style.display = 'block';
        document.getElementById('loadingSpinner').style.display = 'none';
    }
});

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    
    // Aquí iría la lógica para llamar a Supabase y enviar el correo de recuperación
    // Por ahora, solo mostraremos un mensaje
    resetMessage.textContent = `Si existe una cuenta para ${email}, se ha enviado un correo para reestablecer la contraseña.`;
    resetMessage.classList.remove('text-red-500');
    resetMessage.classList.add('text-green-500');
});