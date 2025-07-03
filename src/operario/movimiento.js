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

let filesToUpload = [];

function renderPreviews() {
    previewContainer.innerHTML = '';
    filesToUpload.forEach((file, index) => {
        const previewURL = URL.createObjectURL(file);
        let previewElement;
        const container = document.createElement('div');
        container.className = 'relative group';

        if (file.type.startsWith('image/')) {
            previewElement = `<img src="${previewURL}" class="h-28 w-full object-cover rounded-lg" alt="Vista previa">`;
        } else {
            previewElement = `<video src="${previewURL}" class="h-28 w-full object-cover rounded-lg"></video>`;
        }
        
        container.innerHTML = `
            ${previewElement}
            <button type="button" data-index="${index}" class="absolute top-1 right-1 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity delete-btn">
                <span class="material-icons text-sm">close</span>
            </button>
        `;
        previewContainer.appendChild(container);
    });
}

mediaFileInput.addEventListener('change', (event) => {
    const newFiles = Array.from(event.target.files);
    filesToUpload.push(...newFiles);
    renderPreviews();
    mediaFileInput.value = ''; 
});

previewContainer.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const indexToRemove = parseInt(deleteButton.dataset.index, 10);
        filesToUpload.splice(indexToRemove, 1);
        renderPreviews();
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const operacionId = localStorage.getItem('operacion_actual');
    const user = getUser();
    const observacion = document.getElementById('observacion').value;

    if (!operacionId || !user || filesToUpload.length === 0 || !observacion) {
        alert('Faltan datos. Asegúrese de tener una operación activa, seleccionado al menos un archivo y escrito una observación.');
        return;
    }

    btnGuardar.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
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
        }).select().single();
        
        if (insertOpError) throw insertOpError;

        const uploadPromises = filesToUpload.map(file => {
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `movimientos/${nuevoRegistroOp.id}/${Date.now()}-${cleanFileName}`;
            return supabase.storage.from('movimientos-media').upload(filePath, file);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        
        const mediaUrls = uploadResults.map(result => {
            if (result.error) throw result.error;
            const { data } = supabase.storage.from('movimientos-media').getPublicUrl(result.data.path);
            return data.publicUrl;
        });

        // --- CORRECCIÓN: Se cambia 'id' por 'operacion_id' ---
        const { error: insertMovimientoError } = await supabase.from('movimientos').insert({
            operacion_id: nuevoRegistroOp.id,
            observacion,
            media_url: mediaUrls,
        });

        if (insertMovimientoError) throw insertMovimientoError;

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