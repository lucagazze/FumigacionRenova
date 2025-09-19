import { supabase } from './src/common/supabase.js';

// Selectores del DOM
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

// Selectores del Modal de MFA
const mfaModal = document.getElementById('mfa-modal');
const mfaForm = document.getElementById('mfaForm');

// Función para completar el login y redirigir
async function completeLoginAndRedirect() {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('role, nombre, apellido, cliente_ids: operario_clientes (cliente_id)')
        .eq('id', user.id)
        .single();

    if (userError) throw new Error('El perfil del usuario no fue encontrado.');

    const assignedClientIds = Array.isArray(userData.cliente_ids) 
        ? userData.cliente_ids.map(c => c.cliente_id) 
        : [];

    const userToStore = {
        email: user.email,
        id: user.id,
        nombre: userData.nombre,
        apellido: userData.apellido,
        role: userData.role,
        cliente_ids: assignedClientIds
    };
    localStorage.setItem('user', JSON.stringify(userToStore));

    // Redirección
    if (userToStore.role === 'admin') window.location.href = '/src/admin/dashboard.html';
    else if (userToStore.role === 'supervisor') window.location.href = '/src/supervisor/dashboard.html';
    else if (userToStore.role === 'operario') window.location.href = '/src/operario/home.html';
}

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
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            
            if (mfaData.nextLevel === 'aal2') {
                mfaModal.classList.remove('hidden');
            } else {
                await completeLoginAndRedirect();
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

// Evento para el formulario del modal de 2FA
if (mfaForm) {
    mfaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('mfaCode').value;
        const mfaMessage = document.getElementById('mfaMessage');
        mfaMessage.textContent = '';
        
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorType: 'totp',
                code,
            });

            if (error) throw error;

            mfaModal.classList.add('hidden');
            await completeLoginAndRedirect();
            
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