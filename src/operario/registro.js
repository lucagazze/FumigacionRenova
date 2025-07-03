import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
const filtrosContainer = document.getElementById('filtrosContainer');
const operacionesContainer = document.getElementById('operacionesContainer');
const filtrosForm = document.getElementById('filtrosRegistro');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

async function aplicarFiltros() {
  const todasOperaciones = await getOperaciones();
  renderOperaciones(operacionesContainer, todasOperaciones, false); // Siempre se llama para el rol de operario
}

toggleFiltrosBtn.addEventListener('click', () => {
    filtrosContainer.classList.toggle('hidden');
});

// Listener para el evento de click en la tabla para desplegar los detalles
operacionesContainer.addEventListener('click', (e) => {
    const headerRow = e.target.closest('tr[data-toggle-details]');
    if (!headerRow) return;

    const detailsId = headerRow.dataset.toggleDetails;
    const detailsRow = document.getElementById(detailsId);
    const icon = headerRow.querySelector('.expand-icon');

    if (detailsRow) {
        detailsRow.classList.toggle('hidden');
        icon.textContent = detailsRow.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    }
});

// Los filtros ya no son necesarios para el operario según tu nuevo diseño,
// pero dejo la estructura por si la necesitas en el futuro.
filtrosForm.style.display = 'none';
toggleFiltrosBtn.style.display = 'none';

document.addEventListener('DOMContentLoaded', () => {
    aplicarFiltros();
});