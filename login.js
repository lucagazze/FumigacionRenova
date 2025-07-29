import { login } from './src/common/auth.js';
import { supabase } from './src/common/supabase.js';

// Limpiar cualquier sesión anterior al cargar la página de login
localStorage.removeItem('user');

// Selectores de elementos del DOM
const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMsgDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetModal = document.getElementById('reset-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

// Evento para el formulario de login principal
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ocultar errores previos y mostrar spinner
        errorMsgDiv.classList.add('hidden');
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loadingSpinner.style.display = 'block';

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
            // --- LÓGICA DE FEEDBACK DE ERROR MEJORADA ---
            // Simula una pequeña demora para seguridad y UX
            setTimeout(() => {
                errorTextSpan.textContent = err.message || 'Credenciales incorrectas.';
                errorMsgDiv.classList.remove('hidden');
                
                // Reactivar el botón
                loginBtn.disabled = false;
                loginText.style.display = 'block';
                loadingSpinner.style.display = 'none';
            }, 1000); // Espera 1 segundo antes de mostrar el error
        }
    });
}

// --- Lógica para "Olvidé mi contraseña" ---

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        if(resetModal) resetModal.classList.remove('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if(resetModal) resetModal.classList.add('hidden');
        if(resetMessage) resetMessage.textContent = '';
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;
        resetMessage.textContent = 'Enviando...';
        resetMessage.className = 'text-sm mt-4 text-center text-gray-600';

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/src/login/restablecer-contraseña.html`,
        });

        if (error) {
            resetMessage.textContent = `Error: ${error.message}`;
            resetMessage.className = 'text-sm mt-4 text-center text-red-600';
        } else {
            resetMessage.textContent = 'Si existe una cuenta para este correo, recibirás un enlace para restablecer tu contraseña en breve.';
            resetMessage.className = 'text-sm mt-4 text-center text-green-600';
        }
    });
}