import { supabase } from './supabase.js';
import { renderHeader } from './header.js';

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

// --- NUEVA LÓGICA DE INICIO ---
async function initializePage() {
    // 1. Verificamos si el usuario ya tiene factores 2FA
    const { data, error } = await supabase.auth.mfa.listFactors();
    
    if (error) {
        messageEl.textContent = `Error al verificar estado de 2FA: ${error.message}`;
        return;
    }

    const totpFactor = data.all.find(factor => factor.factor_type === 'totp');

    if (totpFactor) {
        // Si ya tiene 2FA, mostramos el mensaje de éxito y ocultamos la configuración
        mfaSetupFlow.style.display = 'none';
        mfaStatus.style.display = 'block';
    } else {
        // Si no tiene 2FA, iniciamos el proceso para configurar uno nuevo
        await enrollNewFactor();
    }
}

// Iniciar el proceso de enrolamiento (esta función no cambia)
async function enrollNewFactor() {
    try {
        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
        });

        if (error) throw error;

        factorId = data.id;
        qrCodeContainer.innerHTML = data.totp.qr_code;
    } catch (error) {
        messageEl.textContent = `Error al iniciar la configuración: ${error.message}`;
    }
}

startVerificationBtn.addEventListener('click', () => {
    enrollSection.style.display = 'none';
    verifySection.style.display = 'block';
});

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

        mfaSetupFlow.style.display = 'none';
        mfaStatus.style.display = 'block';

    } catch (error) {
        messageEl.textContent = `Código incorrecto o inválido. Inténtalo de nuevo.`;
    }
});

// Llamamos a la nueva función de inicialización
initializePage();