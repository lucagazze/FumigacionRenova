import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const checklistContainer = document.getElementById('checklistContainer');
const btnContinuar = document.getElementById('btnContinuar');
const operacionId = localStorage.getItem('operacion_actual');

async function renderChecklist() {
  if (!operacionId) {
    alert('No se encontró operación. Redirigiendo...');
    window.location.href = 'home.html';
    return;
  }

  const { data, error } = await supabase.from('checklist_items').select('*').eq('operacion_id', operacionId);
  if (error) { console.error('Error fetching checklist items:', error); return; }
  
  checklistContainer.innerHTML = '';
  data.forEach((item, idx) => {
    checklistContainer.innerHTML += `
      <div class="flex items-center bg-white border rounded-lg px-6 py-4 shadow-sm">
        <input class="h-5 w-5 rounded border-2 border-green-500 text-green-500 focus:ring-green-500" id="item${idx}" type="checkbox" data-id="${item.id}" ${item.completado ? 'checked' : ''}>
        <label class="flex-1 text-base font-medium ml-4" for="item${idx}">${item.item}</label>
      </div>
    `;
  });
  updateProgress(data);
}

function updateProgress(items) {
  const completados = items.filter(i => i.completado).length;
  document.getElementById('progreso').innerHTML = `Progreso: <span class="font-bold">${completados}/${items.length}</span>`;
}

checklistContainer.addEventListener('change', async (e) => {
  if (e.target.type === 'checkbox') {
    const itemId = e.target.dataset.id;
    const completado = e.target.checked;
    await supabase.from('checklist_items').update({ completado }).eq('id', itemId);
    renderChecklist();
  }
});

btnContinuar.addEventListener('click', () => {
    window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', renderChecklist);