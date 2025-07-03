import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const checklistContainer = document.getElementById('checklistContainer');
const btnContinuar = document.getElementById('btnContinuar');
const operacionId = localStorage.getItem('operacion_actual');

const uploadingItems = new Set();

async function renderChecklist() {
    if (!operacionId) {
        alert('No hay una operación activa.');
        window.location.href = 'home.html'; 
        return; 
    }
    
    const { data: items, error } = await supabase.from('checklist_items').select('*').eq('operacion_id', operacionId).order('id');
    if (error) { console.error(error); return; }

    checklistContainer.innerHTML = items.map(item => {
        const isUploading = uploadingItems.has(item.id);
        const isCompleted = item.completado;

        return `
        <div class="checklist-item-container bg-white p-4 rounded-lg border shadow-sm transition-all cursor-pointer ${isCompleted ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}" data-id="${item.id}">
            <div class="flex items-center justify-between pointer-events-none">
                <div class="flex items-center">
                    <input 
                        id="item-${item.id}" 
                        type="checkbox" 
                        data-id="${item.id}" 
                        class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        ${isCompleted ? 'checked' : ''}
                    >
                    <label for="item-${item.id}" class="ml-4 text-base font-medium text-gray-800">${item.item}</label>
                </div>
                <div class="flex items-center gap-3">
                    ${item.imagen_url ? `
                        <a href="${item.imagen_url}" target="_blank" class="block h-10 w-10 rounded-md overflow-hidden shadow-sm pointer-events-auto">
                            <img src="${item.imagen_url}" class="h-full w-full object-cover" alt="Imagen adjunta">
                        </a>` 
                    : ''}

                    <div id="loader-${item.id}" class="${isUploading ? '' : 'hidden'}">
                        <div class="spinner"></div>
                    </div>
                    
                    <label for="foto-${item.id}" id="upload-icon-${item.id}" class="${isUploading ? 'hidden' : 'cursor-pointer text-gray-500 hover:text-green-600 transition-colors pointer-events-auto'}">
                        <span class="material-icons">attach_file</span>
                    </label>
                    <input type="file" accept="image/*" id="foto-${item.id}" class="hidden pointer-events-auto" data-id="${item.id}">
                </div>
            </div>
        </div>
    `;
    }).join('');
    updateProgress(items);
}

function updateProgress(items) {
    const completados = items.filter(i => i.completado).length;
    document.getElementById('progreso').innerHTML = `Progreso: <span class="font-bold">${completados}/${items.length}</span>`;
}

checklistContainer.addEventListener('click', (e) => {
    const container = e.target.closest('.checklist-item-container');
    if (!container) return;

    // Si el clic fue en un elemento que debe tener su propio evento (como el link o el botón de subir), no hagas nada.
    if (e.target.closest('a') || e.target.closest('label') || e.target.closest('input[type="file"]')) {
        return;
    }

    const checkbox = container.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        const changeEvent = new Event('change', { bubbles: true });
        checkbox.dispatchEvent(changeEvent);
    }
});

checklistContainer.addEventListener('change', async (e) => {
    const target = e.target;
    const itemId = target.dataset.id;

    if (!itemId) return;

    if (target.type === 'checkbox') {
        await supabase.from('checklist_items').update({ completado: target.checked }).eq('id', itemId);
        renderChecklist();
    } 
    else if (target.type === 'file') {
        const file = target.files[0];
        if (!file) return;

        uploadingItems.add(itemId);
        renderChecklist();

        try {
            const filePath = `checklist-imagenes/${operacionId}/${itemId}-${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('checklist-imagenes').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('checklist-imagenes').getPublicUrl(filePath);
            await supabase.from('checklist_items').update({ imagen_url: publicUrl }).eq('id', itemId);

        } catch (error) {
            console.error('Error al subir imagen:', error);
            alert('No se pudo subir la imagen.');
        } finally {
            uploadingItems.delete(itemId);
            renderChecklist();
        }
    }
});

btnContinuar.addEventListener('click', () => { window.location.href = 'operacion.html'; });
document.addEventListener('DOMContentLoaded', renderChecklist);