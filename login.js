import { login } from './src/common/auth.js';
import { supabase } from './src/common/supabase.js';

// Limpiar sesión al cargar la página de login
localStorage.removeItem('user');
supabase.auth.signOut();

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMsgDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');
const otpModal = document.getElementById('otp-modal');
const otpForm = document.getElementById('otpForm');

let userCredentialsForOtp = null;

// --- FUNCIÓN ÚNICA PARA GUARDAR DATOS Y REDIRIGIR ---
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

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (código para manejar el spinner)
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loadingSpinner.style.display = 'block';
        errorMsgDiv.classList.add('hidden');

        const email = form.email.value;
        const password = form.password.value;

        try {
            const result = await login(email, password);

            if (result.status === 'otp_required') {
                userCredentialsForOtp = { email: result.user.email };
                const { error: otpError } = await supabase.auth.signInWithOtp({ email: userCredentialsForOtp.email });
                if (otpError) throw new Error("Error al enviar el código de verificación.");
                otpModal.classList.remove('hidden');
                
            } else if (result.status === 'success') {
                await completeLoginAndRedirect(result.user);
            }
        } catch (err) {
            // ... (código para manejar errores)
            loginBtn.disabled = false;
            loginText.style.display = 'block';
            loadingSpinner.style.display = 'none';
            errorTextSpan.textContent = err.message;
            errorMsgDiv.classList.remove('hidden');
        }
    });
}

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

            // Éxito: data.user contiene el usuario autenticado
            await completeLoginAndRedirect(data.user);
            
        } catch (error) {
            otpMessage.textContent = error.message;
        }
    });
}