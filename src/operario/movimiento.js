import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formMovimiento');
const mediaFileInput = document.getElementById('mediaFile');
const previewContainer = document.getElementById('preview');
const btnGuardar = document.getElementById('btnGuardar');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

mediaFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) { previewContainer.innerHTML = ''; return; }
    const previewURL = URL.createObjectURL(file);
    previewContainer.innerHTML = file.type.startsWith('image/')
        ? `<img src="${previewURL}" class="max-h-48 rounded-lg mx-auto" alt="Vista previa">`
        : `<video src="${previewURL}" class="max-h-48 rounded-lg mx-auto" controls></video>`;
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const operacionId = localStorage.getItem('operacion_actual');
    const user = getUser();
    const file = mediaFileInput.files[0];
    const observacion = document.getElementById('observacion').value;
    const toneladasMovidas = document.getElementById('toneladasMovidas').value;

    if (!operacionId || !user || !file || !observacion) {
        alert('Faltan datos. Asegúrese de tener una operación activa, seleccionado un archivo y escrito una observación.');
        return;
    }

    btnGuardar.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        const filePath = `movimientos/${operacionId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('movimientos-media').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('movimientos-media').getPublicUrl(filePath);
        
        const { data: opData } = await supabase.from('operaciones').select('*').eq('id', operacionId).single();
        if (!opData) throw new Error("No se pudo obtener la operación original.");

        const { data: nuevoRegistroOp, error: insertOpError } = await supabase.from('operaciones').insert({
            operacion_original_id: operacionId,
            cliente_id: opData.cliente_id,
            deposito_id: opData.deposito_id,
            mercaderia_id: opData.mercaderia_id,
            estado: 'en curso',
            tipo_registro: 'movimiento',
            operario_nombre: user.name,
            toneladas: toneladasMovidas ? parseFloat(toneladasMovidas) : null,
            metodo_fumigacion: opData.metodo_fumigacion
        }).select().single();
        
        if(insertOpError) throw insertOpError;

        await supabase.from('movimientos').insert({
            id: nuevoRegistroOp.id, // Usar el mismo ID para la relación 1 a 1
            operacion_id: operacionId,
            observacion,
            media_url: urlData.publicUrl,
            toneladas_movidas: toneladasMovidas ? parseFloat(toneladasMovidas) : null,
        });

        alert('Movimiento registrado con éxito.');
        window.location.href = 'operacion.html';

    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        alert(`Error: ${error.message || 'No se pudo completar la operación.'}`);
    } finally {
        btnGuardar.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'operacion.html';
});