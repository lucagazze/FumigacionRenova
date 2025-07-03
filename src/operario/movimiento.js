import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- DOM Elements ---
const form = document.getElementById('formMovimiento');
const mediaFileInput = document.getElementById('mediaFile');
const previewContainer = document.getElementById('preview');
const btnGuardar = document.getElementById('btnGuardar');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');

// --- Functions ---

mediaFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        previewContainer.innerHTML = '';
        return;
    }

    const previewURL = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
        previewContainer.innerHTML = `<img src="${previewURL}" class="max-h-48 rounded-lg mx-auto" alt="Vista previa">`;
    } else if (file.type.startsWith('video/')) {
        previewContainer.innerHTML = `<video src="${previewURL}" class="max-h-48 rounded-lg mx-auto" controls></video>`;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const operacionId = localStorage.getItem('operacion_actual');
    const user = getUser();
    const file = mediaFileInput.files[0];
    const observacion = document.getElementById('observacion').value;
    const toneladasMovidas = document.getElementById('toneladasMovidas').value;

    if (!operacionId || !user || !file || !observacion) {
        alert('Faltan datos. Asegúrese de tener una operación activa, haber iniciado sesión, seleccionado un archivo y escrito una observación.');
        return;
    }

    // Deshabilitar botón y mostrar spinner
    btnGuardar.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        // 1. Subir archivo a Supabase Storage
        const filePath = `movimientos/${operacionId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('movimientos-media') // Asume que tienes un bucket con este nombre
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Obtener la URL pública del archivo
        const { data: urlData } = supabase.storage
            .from('movimientos-media')
            .getPublicUrl(filePath);

        const media_url = urlData.publicUrl;

        // 3. Crear el registro en la tabla de operaciones como 'movimiento'
        const { data: opData, error: opError } = await supabase
            .from('operaciones')
            .select('cliente_id, deposito_id, mercaderia_id, metodo_fumigacion')
            .eq('id', operacionId)
            .single();
        
        if (opError) throw new Error("No se pudo obtener la operación original.");

        const { error: insertOpError } = await supabase.from('operaciones').insert({
            operacion_original_id: operacionId,
            cliente_id: opData.cliente_id,
            deposito_id: opData.deposito_id,
            mercaderia_id: opData.mercaderia_id,
            estado: 'en curso',
            tipo_registro: 'movimiento',
            operario_nombre: user.name,
            toneladas: toneladasMovidas ? parseFloat(toneladasMovidas) : null,
            metodo_fumigacion: opData.metodo_fumigacion // Heredar el método
        });
        
        if(insertOpError) throw insertOpError;


        // 4. Crear el registro en la tabla `movimientos`
        const { error: insertMovError } = await supabase.from('movimientos').insert({
            operacion_id: operacionId,
            observacion,
            media_url,
            toneladas_movidas: toneladasMovidas ? parseFloat(toneladasMovidas) : null,
        });

        if (insertMovError) throw insertMovError;

        alert('Movimiento registrado con éxito.');
        window.location.href = 'operacion.html';

    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        alert(`Error: ${error.message || 'No se pudo completar la operación.'}`);
    } finally {
        // Habilitar botón y ocultar spinner
        btnGuardar.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});


document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'operacion.html';
});