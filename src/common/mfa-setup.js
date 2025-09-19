import { supabase } from './supabase.js';
import { renderHeader } from './header.js';
import { getUser } from './router.js'; // Importamos getUser para obtener el rol

document.getElementById('header').innerHTML = renderHeader();

const mfaSetupFlow = document.getElementById('mfa-setup-flow');
const enrollSection = document.getElementById('enroll-section');
const verifySection = document.getElementById('verify-section');
const qrCodeContainer = document.getElementById('qr-code');
const startVerificationBtn = document.getElementById('start-verification-btn');
const verifyForm = document.getElementById('verify-form');
const totpInput = document.getElementById('totp-code');
const messageEl = document.getElementById('message');
const mfaStatus = document.getElementById('mfa-status');

let factorId = null;

// --- NUEVA FUNCIÓN DE REDIRECCIÓN ---
async function redirectToDashboard() {
    const user = getUser(); // Obtenemos el usuario del localStorage
    if (!user || !user.role) {
        // Si no podemos determinar el rol, lo enviamos al login.
        window.location.href = '/index.html';
        return;
    }

    // Redirigimos según el rol
    if (user.role === 'admin') window.location.href = '/src/admin/dashboard.html';
    else if (user.role === 'supervisor') window.location.href = '/src/supervisor/dashboard.html';
    else if (user.role === 'operario') window.location.href = '/src/operario/home.html';
}


// --- LÓGICA DE INICIO ACTUALIZADA ---
async function initializePage() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    
    if (error) {
        messageEl.textContent = `Error al verificar estado de 2FA: ${error.message}`;
        return;
    }

    const totpFactor = data.all.find(factor => factor.factor_type === 'totp');

    if (totpFactor) {
        // Si ya tiene 2FA, lo redirigimos directamente al dashboard.
        await redirectToDashboard();
    } else {
        // Si no, iniciamos el proceso para configurar uno nuevo.
        await enrollNewFactor();
    }
}

// Iniciar el proceso de enrolamiento (sin cambios)
async function enrollNewFactor() {
    try {
        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
        });

        if (error) throw error;

        factorId = data.id;
qrCodeContainer.innerHTML = `<img src="${data.totp.qr_code}" alt="Escanea este código para configurar 2FA">`;
    } catch (error) {
        messageEl.textContent = `Error al iniciar la configuración: ${error.message}`;
    }
}

startVerificationBtn.addEventListener('click', () => {
    enrollSection.style.display = 'none';
    verifySection.style.display = 'block';
});

// --- LÓGICA DE VERIFICACIÓN ACTUALIZADA ---
verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = totpInput.value;
    messageEl.textContent = '';
    
    try {
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code,
        });
        if (verifyError) throw verifyError;

        // Éxito: ahora redirigimos al usuario.
        await redirectToDashboard();

    } catch (error) {
        messageEl.textContent = `Código incorrecto o inválido. Inténtalo de nuevo.`;
    }
});

// Llamamos a la función de inicialización
initializePage();