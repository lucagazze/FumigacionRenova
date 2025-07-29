import { supabase } from '../common/supabase.js';

// --- Selectores del DOM ---
const form = document.getElementById('updatePasswordForm');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const messageEl = document.getElementById('message');
const passwordMatchMessage = document.getElementById('password-match-message');
const submitBtn = document.getElementById('submit-btn');
const toggleNewPasswordBtn = document.getElementById('toggle-new-password');
const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');
const formContainer = document.getElementById('form-container');

let sessionValida = false;

// --- LÓGICA DE SEGURIDAD PARA VALIDAR EL ENLACE ÚNICO ---
supabase.auth.onAuthStateChange(async (event, session) => {
  // Este evento se dispara automáticamente si Supabase detecta un token en la URL
  if (event === 'PASSWORD_RECOVERY') {
    sessionValida = true;
    messageEl.textContent = 'Enlace válido. Por favor, introduce tu nueva contraseña.';
    messageEl.className = 'mt-4 text-center text-sm text-blue-600';
  }
});

// --- Función para alternar la visibilidad de la contraseña ---
function setupPasswordToggle(input, button) {
    button.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
    });
}

// --- Función para validar las contraseñas en tiempo real ---
function validatePasswords() {
    const pass1 = newPasswordInput.value;
    const pass2 = confirmPasswordInput.value;

    if (pass1.length > 0 && pass1.length < 6) {
        passwordMatchMessage.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        passwordMatchMessage.className = 'text-xs mt-2 h-4 text-red-600';
        submitBtn.disabled = true;
        return;
    }

    if (pass1 && pass2) {
        if (pass1 === pass2) {
            passwordMatchMessage.textContent = 'Las contraseñas coinciden.';
            passwordMatchMessage.className = 'text-xs mt-2 h-4 text-green-600';
            submitBtn.disabled = false;
        } else {
            passwordMatchMessage.textContent = 'Las contraseñas no coinciden.';
            passwordMatchMessage.className = 'text-xs mt-2 h-4 text-red-600';
            submitBtn.disabled = true;
        }
    } else {
        passwordMatchMessage.textContent = '';
        submitBtn.disabled = true;
    }
}

// --- Event Listeners ---
setupPasswordToggle(newPasswordInput, toggleNewPasswordBtn);
setupPasswordToggle(confirmPasswordInput, toggleConfirmPasswordBtn);
newPasswordInput.addEventListener('input', validatePasswords);
confirmPasswordInput.addEventListener('input', validatePasswords);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Doble chequeo para asegurar que la sesión del token es válida
    if (!sessionValida) {
        messageEl.textContent = 'Error: El enlace de recuperación no es válido o ha expirado. Por favor, solicita uno nuevo.';
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Actualizando...';
    
    const newPassword = newPasswordInput.value;

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
        messageEl.textContent = `Error al actualizar: ${error.message}`;
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Actualizar Contraseña';
    } else {
        formContainer.style.display = 'none'; // Ocultamos el formulario
        messageEl.innerHTML = '¡Contraseña actualizada con éxito! Serás redirigido al login en 3 segundos...';
        messageEl.className = 'mt-4 text-center text-sm text-green-600';
        
        // Redirección automática después de 3 segundos
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);
    }
});