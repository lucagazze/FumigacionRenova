import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formMuestreo');
const mediaFileInput = document.getElementById('mediaFile');
const previewContainer = document.getElementById('preview');
const btnGuardar = document.getElementById('btnGuardar');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');
const conCompaneroCheckbox = document.getElementById('conCompanero');
const companeroContainer = document.getElementById('companeroContainer');
const companeroList = document.getElementById('companero-list');

let filesToUpload = [];

async function poblarCompaneros(clienteId) {
    if (!clienteId) return;
    const currentUser = getUser();
    
    // 1. Encontrar todos los usuarios (operarios/supervisores) asignados a ese cliente
    const { data: operariosRel, error: relError } = await supabase
        .from('operario_clientes')
        .select('operario_id')
        .eq('cliente_id', clienteId);

    if (relError || !operariosRel || operariosRel.length === 0) {
        console.error(relError || "No hay operarios asignados a este cliente");
        companeroList.innerHTML = '<p class="text-sm text-gray-500">No hay otros operarios asignados a este cliente.</p>';
        return;
    }
    
    const operarioIds = operariosRel.map(r => r.operario_id);

    // 2. Obtener los datos de esos usuarios, PERO FILTRANDO SOLO POR EL ROL 'operario'
    const { data: operarios, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido')
        .in('id', operarioIds)
        .eq('role', 'operario'); // <-- ESTA ES LA CORRECCIÓN CLAVE
    
    if (error) { 
        console.error(error); 
        return; 
    }
    
    const companerosDisponibles = operarios.filter(c => c.id !== currentUser.id);

    if (companerosDisponibles.length === 0) {
        companeroList.innerHTML = '<p class="text-sm text-gray-500">No hay otros operarios disponibles para este cliente.</p>';
        return;
    }

    companeroList.innerHTML = ''; // Limpiar antes de añadir
    companerosDisponibles.forEach(c => {
        companeroList.innerHTML += `
            <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                <input type="checkbox" name="companero" value="${c.nombre} ${c.apellido}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                <span>${c.nombre} ${c.apellido}</span>
            </label>
        `;
    });
}

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
    const companeros = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);

    if (!operacionId || !user || !observacion) {
        alert('Faltan datos. Asegúrese de tener una operación activa y haber escrito una observación.');
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
            tipo_registro: 'muestreo',
            operario_nombre: conCompaneroCheckbox.checked && companeros.length > 0 ? `${user.nombre} ${user.apellido} y ${companeros.join(', ')}` : `${user.nombre} ${user.apellido}`,
            estado_aprobacion: 'aprobado'
        }).select().single();
        
        if (insertOpError) throw insertOpError;

        const uploadPromises = filesToUpload.map(file => {
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `muestreos-media/${nuevoRegistroOp.id}/${Date.now()}-${cleanFileName}`;
            return supabase.storage.from('muestreos-media').upload(filePath, file);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        
        const mediaUrls = uploadResults.map(result => {
            if (result.error) throw result.error;
            const { data } = supabase.storage.from('muestreos-media').getPublicUrl(result.data.path);
            return data.publicUrl;
        });

        const { error: insertMuestreoError } = await supabase.from('muestreos').insert({
            operacion_id: nuevoRegistroOp.id,
            observacion,
            media_url: mediaUrls,
        });

        if (insertMuestreoError) throw insertMuestreoError;

        alert('Muestreo registrado con éxito.');
        window.location.href = 'operacion.html';

    } catch (error) {
        console.error('Error al registrar muestreo:', error);
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

conCompaneroCheckbox.addEventListener('change', () => {
    companeroContainer.style.display = conCompaneroCheckbox.checked ? 'block' : 'none';
});

document.addEventListener('DOMContentLoaded', async () => {
    const opId = localStorage.getItem('operacion_actual');
    if (!opId) return;
    const { data: op } = await supabase.from('operaciones').select('cliente_id').eq('id', opId).single();
    if (op) {
        poblarCompaneros(op.cliente_id);
    }
});