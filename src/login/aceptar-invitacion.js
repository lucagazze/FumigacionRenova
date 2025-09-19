import { supabase } from '../common/supabase.js';

const form = document.getElementById('updatePasswordForm');
const passwordInput = document.getElementById('new-password');
const messageEl = document.getElementById('message');
const formContainer = document.getElementById('form-container');

// Supabase detecta automáticamente el token de invitación en la URL 
// y prepara al cliente para la actualización de contraseña.

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = passwordInput.value;

    if (newPassword.length < 6) {
        messageEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        return;
    }

    const { error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) {
        messageEl.textContent = `Error al actualizar: ${error.message}`;
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
    } else {
    formContainer.style.display = 'none';
    // Mensaje actualizado para mayor claridad
    messageEl.innerHTML = '¡Cuenta activada! Ahora serás redirigido para configurar la seguridad de tu cuenta (2FA).';
    messageEl.className = 'mt-4 text-center text-sm text-green-600';
    
    setTimeout(() => {
        // Redirección a la configuración de 2FA
        window.location.href = '/src/common/mfa-setup.html'; // <--- LÍNEA CAMBIADA
    }, 3000);
}
});