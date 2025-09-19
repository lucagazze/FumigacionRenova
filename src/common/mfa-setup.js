import { supabase } from './supabase.js';
import { renderHeader } from './header.js';

document.getElementById('header').innerHTML = renderHeader();

const enrollSection = document.getElementById('enroll-section');
const verifySection = document.getElementById('verify-section');
const qrCodeContainer = document.getElementById('qr-code');
const startVerificationBtn = document.getElementById('start-verification-btn');
const verifyForm = document.getElementById('verify-form');
const totpInput = document.getElementById('totp-code');
const messageEl = document.getElementById('message');
const mfaStatus = document.getElementById('mfa-status');

let factorId = null;

// Iniciar el proceso de enrolamiento
async function enrollNewFactor() {
    try {
        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
        });

        if (error) throw error;

        factorId = data.id;
        qrCodeContainer.innerHTML = data.totp.qr_code; // El QR es un string SVG
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
        // 1. Crear el "desafío"
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) throw challengeError;

        // 2. Verificar el código con el desafío
        const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code,
        });

        if (verifyError) throw verifyError;

        // Éxito
        document.getElementById('mfa-setup-flow').style.display = 'none';
        mfaStatus.style.display = 'block';

    } catch (error) {
        messageEl.textContent = `Código incorrecto o inválido. Inténtalo de nuevo.`;
    }
});

// Carga inicial
enrollNewFactor();