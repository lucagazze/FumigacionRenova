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
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetModal = document.getElementById('reset-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');
const mfaModal = document.getElementById('mfa-modal');
const mfaForm = document.getElementById('mfaForm');

// Guarda los detalles del usuario en localStorage y devuelve el objeto del usuario.
async function saveUserDetailsToStorage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('role, nombre, apellido, cliente_ids: operario_clientes (cliente_id)')
        .eq('id', user.id)
        .single();

    if (userError) throw new Error('El perfil del usuario no fue encontrado.');

    const assignedClientIds = Array.isArray(userData.cliente_ids) ? userData.cliente_ids.map(c => c.cliente_id) : [];
    const userToStore = {
        email: user.email, id: user.id, nombre: userData.nombre,
        apellido: userData.apellido, role: userData.role, cliente_ids: assignedClientIds
    };
    localStorage.setItem('user', JSON.stringify(userToStore));
    return userToStore;
}

// Redirige al dashboard correcto.
function redirectToDashboard(user) {
    if (!user || !user.role) {
        window.location.href = '/index.html';
        return;
    }
    if (user.role === 'admin') window.location.href = '/src/admin/dashboard.html';
    else if (user.role === 'supervisor') window.location.href = '/src/supervisor/dashboard.html';
    else if (user.role === 'operario') window.location.href = '/src/operario/home.html';
}

// --- Lógica de Login Principal ---
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsgDiv.classList.add('hidden');
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loadingSpinner.style.display = 'block';

        const email = form.email.value;
        const password = form.password.value;

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            const user = await saveUserDetailsToStorage();
            if (!user) throw new Error("No se pudieron cargar los detalles del perfil.");

            const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            
            if (mfaData.nextLevel === 'aal2') {
                mfaModal.classList.remove('hidden');
                loginBtn.disabled = false;
                loginText.style.display = 'block';
                loadingSpinner.style.display = 'none';
            } else if (mfaData.currentLevel === 'aal1') {
                window.location.href = '/src/common/mfa-setup.html';
            } else {
                redirectToDashboard(user);
            }
        } catch (err) {
            setTimeout(() => {
                errorTextSpan.textContent = 'Credenciales incorrectas o error de autenticación.';
                errorMsgDiv.classList.remove('hidden');
                loginBtn.disabled = false;
                loginText.style.display = 'block';
                loadingSpinner.style.display = 'none';
            }, 1000);
        }
    });
}

// --- Lógica del Modal de 2FA ---
if (mfaForm) {
    mfaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('mfaCode').value;
        const mfaMessage = document.getElementById('mfaMessage');
        mfaMessage.textContent = '';
        
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorType: 'totp', code,
            });
            if (error) throw error;

            mfaModal.classList.add('hidden');
            const user = await saveUserDetailsToStorage();
            redirectToDashboard(user);
            
        } catch (error) {
            mfaMessage.textContent = 'Código incorrecto. Inténtalo de nuevo.';
        }
    });
}


// Lógica para "Olvidé mi contraseña" (sin cambios)
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

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/src/login/restablecer-contraseña.html`,
        });

        if (error) {
            resetMessage.textContent = `Error: ${error.message}`;
            resetMessage.className = 'text-sm mt-4 text-center text-red-600';
        } else {
            resetMessage.textContent = 'Si existe una cuenta para este correo, recibirás un enlace.';
            resetMessage.className = 'text-sm mt-4 text-center text-green-600';
        }
    });
}