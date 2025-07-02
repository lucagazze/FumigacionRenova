import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const checklistContainer = document.getElementById('checklistContainer');
const btnContinuar = document.getElementById('btnContinuar');

const checklistItems = [
  'Tapar ventiladores',
  'Sanitizar',
  'Verificar presencia de IV',
  'Colocar cartelería'
];

let operacionId = localStorage.getItem('operacion_actual');

async function getChecklistItems() {
  if (!operacionId) return [];
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('operacion_id', operacionId);
  
  if (error) {
    console.error('Error fetching checklist items:', error);
    return [];
  }
  return data;
}

async function renderChecklist() {
  const savedItems = await getChecklistItems();
  checklistContainer.innerHTML = '';
  checklistItems.forEach((itemText, idx) => {
    const savedItem = savedItems.find(dbItem => dbItem.item === itemText);
    const checked = savedItem ? savedItem.completado : false;
    const fotoUrl = savedItem ? savedItem.imagen_url : '';

    const div = document.createElement('div');
    div.className = 'flex items-center bg-white border border-[#ebf2e9] rounded-lg px-6 py-4 shadow-sm hover:shadow-md transition-shadow';
    div.innerHTML = `
      <input class="h-5 w-5 rounded border-2 border-[#53d22c] text-[#53d22c] focus:ring-2 focus:ring-[#53d22c] focus:ring-offset-1 focus:outline-none mr-4" id="item${idx}" type="checkbox" data-item-text="${itemText}" ${checked ? 'checked' : ''} />
      <label class="flex-1 text-base font-medium leading-normal cursor-pointer select-none text-[#121a0f]" for="item${idx}">${itemText}</label>
      <button type="button" class="flex items-center gap-1.5 text-sm text-[#53d22c] hover:text-green-700 font-semibold px-2 py-1 rounded ml-4" id="btnAdjuntar${idx}">
        <span class="material-icons text-lg">upload_file</span> <span>Adjuntar</span>
      </button>
      <input type="file" accept="image/*" id="foto${idx}" style="display:none" />
      <div id="preview${idx}" class="ml-2">${fotoUrl ? `<img src="${fotoUrl}" alt="Evidencia" class="w-10 h-10 object-cover rounded border" />` : ''}</div>
    `;
    checklistContainer.appendChild(div);
  });

  // Reasignar listeners
  checklistItems.forEach((_, idx) => {
    document.getElementById(`btnAdjuntar${idx}`).addEventListener('click', () => {
      document.getElementById(`foto${idx}`).click();
    });
    document.getElementById(`foto${idx}`).addEventListener('change', e => handleFileUpload(e, idx));
  });
  updateProgress();
}

async function handleFileUpload(event, idx) {
  const file = event.target.files[0];
  if (!file) return;

  const itemText = document.getElementById(`item${idx}`).dataset.itemText;
  const filePath = `${operacionId}/${itemText.replace(/\s+/g, '_')}_${Date.now()}`;
  
  const { error: uploadError } = await supabase.storage.from('checklist-imagenes').upload(filePath, file);
  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    alert('Error al subir la imagen.');
    return;
  }

  const { data: urlData } = supabase.storage.from('checklist-imagenes').getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  document.getElementById(`preview${idx}`).innerHTML = `<img src="${publicUrl}" alt="Evidencia" class="w-10 h-10 object-cover rounded border" />`;
}

function updateProgress() {
  const checks = checklistItems.map((_, idx) => document.getElementById(`item${idx}`));
  const completados = checklistItems.filter((_, idx) => checks[idx].checked).length;
  document.getElementById('progreso').innerHTML = `Progreso: <span class="font-bold">${completados}/4</span>`;
  document.getElementById('progressBar').style.width = `${(completados / 4) * 100}%`;
  btnContinuar.disabled = false;
  document.getElementById('checklistMsg').textContent = completados === 4 ? 'Checklist completo. Puede continuar.' : 'Puede continuar aunque no haya completado todos los ítems.';
}

async function saveChecklist(redirect = true) {
  const itemsToUpdate = checklistItems.map(async (itemText, idx) => {
    const checkbox = document.getElementById(`item${idx}`);
    const preview = document.getElementById(`preview${idx}`);
    const img = preview.querySelector('img');
    
    const { error } = await supabase
      .from('checklist_items')
      .update({ 
        completado: checkbox.checked,
        imagen_url: img ? img.src : null,
      })
      .eq('operacion_id', operacionId)
      .eq('item', itemText);

    if (error) {
      console.error('Error updating checklist item:', error);
    }
  });

  await Promise.all(itemsToUpdate);

  if (redirect) {
    window.location.href = 'operacion.html';
  }
}

btnContinuar.addEventListener('click', () => saveChecklist(true));

document.addEventListener('DOMContentLoaded', renderChecklist);

// Guardar al cambiar un checkbox
checklistContainer.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') {
    saveChecklist(false);
    updateProgress();
  }
});
