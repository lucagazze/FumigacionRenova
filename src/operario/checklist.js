import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const checklistContainer = document.getElementById('checklistContainer');
const btnContinuar = document.getElementById('btnContinuar');
const operacionId = localStorage.getItem('operacion_actual');

async function renderChecklist() {
    if (!operacionId) { window.location.href = 'home.html'; return; }
    const { data: items, error } = await supabase.from('checklist_items').select('*').eq('operacion_id', operacionId).order('id');
    if (error) { console.error(error); return; }

    checklistContainer.innerHTML = items.map((item, idx) => `
        <div class="bg-white p-4 rounded-lg border shadow-sm">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <input class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500" id="item${idx}" type="checkbox" data-id="${item.id}" ${item.completado ? 'checked' : ''}>
                    <label class="ml-3 text-base font-medium text-gray-800" for="item${idx}">${item.item}</label>
                </div>
                <div id="preview-${item.id}" class="flex items-center gap-2">
                    ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank"><img src="${item.imagen_url}" class="h-10 w-10 rounded object-cover"></a>` : ''}
                    <label for="foto-${item.id}" class="cursor-pointer text-gray-500 hover:text-green-600"><span class="material-icons">attach_file</span></label>
                    <input type="file" accept="image/*" id="foto-${item.id}" class="hidden" data-id="${item.id}">
                </div>
            </div>
        </div>
    `).join('');
    updateProgress(items);
}

function updateProgress(items) {
    const completados = items.filter(i => i.completado).length;
    document.getElementById('progreso').innerHTML = `Progreso: <span class="font-bold">${completados}/${items.length}</span>`;
}

checklistContainer.addEventListener('change', async (e) => {
    if (e.target.type === 'checkbox') {
        await supabase.from('checklist_items').update({ completado: e.target.checked }).eq('id', e.target.dataset.id);
    } else if (e.target.type === 'file') {
        const file = e.target.files[0];
        const itemId = e.target.dataset.id;
        if (!file) return;

        const filePath = `${operacionId}/${itemId}-${Date.now()}`;
        await supabase.storage.from('checklist-imagenes').upload(filePath, file);
        const { data: { publicUrl } } = supabase.storage.from('checklist-imagenes').getPublicUrl(filePath);
        await supabase.from('checklist_items').update({ imagen_url: publicUrl }).eq('id', itemId);
    }
    renderChecklist();
});

btnContinuar.addEventListener('click', () => { window.location.href = 'operacion.html'; });
document.addEventListener('DOMContentLoaded', renderChecklist);