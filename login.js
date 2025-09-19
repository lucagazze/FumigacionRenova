import { login } from './src/common/auth.js';
import { supabase } from './src/common/supabase.js';

// Cierra cualquier sesión activa al cargar la página de login para forzar la re-autenticación.
supabase.auth.signOut();

// --- Selectores del DOM ---
const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMsgDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

// --- Selectores del Modal de OTP (2FA) ---
const otpModal = document.getElementById('otp-modal');
const otpForm = document.getElementById('otpForm');
const otpCancelBtn = document.getElementById('otpCancelBtn');

// --- Selectores del Modal de Restablecer Contraseña ---
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetModal = document.getElementById('reset-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

let userCredentialsForOtp = null;

// --- Función para Completar Login y Redirigir ---
async function completeLoginAndRedirect(userAuth) {
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('role, nombre, apellido, cliente_ids: operario_clientes (cliente_id)')
        .eq('id', userAuth.id)
        .single();

    if (userError) throw new Error('El perfil del usuario no fue encontrado.');
    
    await supabase
        .from('usuarios')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userAuth.id);

    const assignedClientIds = Array.isArray(userData.cliente_ids) ? userData.cliente_ids.map(c => c.cliente_id) : [];
    const userToStore = {
        email: userAuth.email, id: userAuth.id, nombre: userData.nombre,
        apellido: userData.apellido, role: userData.role, cliente_ids: assignedClientIds
    };
    localStorage.setItem('user', JSON.stringify(userToStore));
    
    if (userToStore.role === 'admin') window.location.href = '/src/admin/dashboard.html';
    else if (userToStore.role === 'supervisor') window.location.href = '/src/supervisor/dashboard.html';
    else if (userToStore.role === 'operario') window.location.href = '/src/operario/home.html';
}

// --- Lógica de Login Principal ---
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loadingSpinner.style.display = 'block';
        errorMsgDiv.classList.add('hidden');

        const email = form.email.value;
        const password = form.password.value;

        try {
            const result = await login(email, password);

            if (result.status === 'otp_required') {
                userCredentialsForOtp = { email: result.user.email, password: password };
                const { error: otpError } = await supabase.auth.signInWithOtp({ email: userCredentialsForOtp.email });
                if (otpError) throw new Error("Error al enviar el código de verificación.");
                otpModal.classList.remove('hidden');
                loginBtn.disabled = false;
                loginText.style.display = 'block';
                loadingSpinner.style.display = 'none';

            } else if (result.status === 'success') {
                await completeLoginAndRedirect(result.user);
            }
        } catch (err) {
            loginBtn.disabled = false;
            loginText.style.display = 'block';
            loadingSpinner.style.display = 'none';
            errorTextSpan.textContent = err.message;
            errorMsgDiv.classList.remove('hidden');
        }
    });
}

// --- Lógica del Modal de Código por Email (OTP) ---
if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpCode = document.getElementById('otpCode').value;
        const otpMessage = document.getElementById('otpMessage');
        otpMessage.textContent = '';

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: userCredentialsForOtp.email,
                token: otpCode,
                type: 'email',
            });

            if (error) throw new Error("El código es incorrecto o ha expirado.");

            await completeLoginAndRedirect(data.user);
            
        } catch (error) {
            otpMessage.textContent = error.message;
        }
    });
}

if (otpCancelBtn) {
    otpCancelBtn.addEventListener('click', () => {
        otpModal.classList.add('hidden');
    });
}

// --- Lógica para "Olvidé mi Contraseña" ---
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (resetModal) resetModal.classList.remove('hidden');
    });
}
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (resetModal) resetModal.classList.add('hidden');
        if (resetMessage) resetMessage.textContent = '';
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