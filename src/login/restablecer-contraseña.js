import { supabase } from '../common/supabase.js';

const form = document.getElementById('updatePasswordForm');
const messageEl = document.getElementById('message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword.length < 6) {
        messageEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        return;
    }

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Las contraseñas no coinciden.';
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
        messageEl.textContent = `Error: ${error.message}`;
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
    } else {
        messageEl.innerHTML = '¡Contraseña actualizada con éxito! Ya puedes <a href="/index.html" class="font-bold text-green-600 hover:underline">iniciar sesión</a>.';
        messageEl.className = 'mt-4 text-center text-sm text-green-600';
        form.reset();
    }
});