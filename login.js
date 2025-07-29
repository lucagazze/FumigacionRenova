import { supabase } from './src/common/supabase.js';
import { login } from './src/common/auth.js';

localStorage.removeItem('user');

const form = document.getElementById('loginForm');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetModal = document.getElementById('reset-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... (Lógica de inicio de sesión sin cambios)
});

// --- NUEVA LÓGICA PARA RECUPERAR CONTRASEÑA ---

// Mostrar el modal
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetModal.classList.remove('hidden');
});

// Ocultar el modal
closeModalBtn.addEventListener('click', () => {
    resetModal.classList.add('hidden');
    resetMessage.textContent = ''; // Limpiar mensaje
});

// Enviar el correo de recuperación
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