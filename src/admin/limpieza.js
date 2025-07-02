import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- DOM Elements ---
const formLimpieza = document.getElementById('formLimpieza');
const areaSelect = document.getElementById('area');
const fechaInput = document.getElementById('fecha');
const observacionesInput = document.getElementById('observaciones');
const historialContainer = document.getElementById('historialLimpieza');

// --- Functions ---

async function poblarAreas() {
    const { data, error } = await supabase.from('areas').select('nombre, tipo').order('tipo').order('nombre');
    if (error) {
        console.error('Error fetching areas:', error);
        areaSelect.innerHTML = '<option value="">No se pudieron cargar las áreas</option>';
        return;
    }
    
    areaSelect.innerHTML = '<option value="">Seleccionar un área</option>';
    data.forEach(area => {
        const option = document.createElement('option');
        // Store both name and type in the value attribute, separated by a pipe
        option.value = `${area.nombre}|${area.tipo}`;
        option.textContent = `${area.nombre} (${area.tipo})`;
        areaSelect.appendChild(option);
    });
}

async function renderHistorial() {
    const { data, error } = await supabase.from('limpiezas').select('*').order('fecha_limpieza', { ascending: false });
    
    if (error) {
        console.error('Error fetching cleaning history:', error);
        historialContainer.innerHTML = '<p>Error al cargar el historial.</p>';
        return;
    }
    
    if (data.length === 0) {
        historialContainer.innerHTML = '<p class="text-center text-gray-500">No hay registros de limpieza.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    
    table.innerHTML = `
        <thead class="bg-gray-50">
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${data.map(registro => `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">${new Date(registro.fecha_limpieza).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${registro.area_nombre} (${registro.area_tipo})</td>
                    <td class="px-6 py-4">${registro.observaciones || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button data-id="${registro.id}" class="delete-btn text-red-600 hover:text-red-900">
                            <span class="material-icons">delete</span>
                        </button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    historialContainer.innerHTML = '';
    historialContainer.appendChild(table);
}


// --- Event Listeners ---

formLimpieza.addEventListener('submit', async (e) => {
    e.preventDefault();
    const areaValue = areaSelect.value;
    const fecha = fechaInput.value;
    const observaciones = observacionesInput.value;

    if (!areaValue || !fecha) {
        alert('Por favor, seleccione un área y una fecha.');
        return;
    }

    const [area_nombre, area_tipo] = areaValue.split('|');

    const { error } = await supabase.from('limpiezas').insert([
        { area_nombre, area_tipo, fecha_limpieza: fecha, observaciones }
    ]);

    if (error) {
        console.error('Error inserting cleaning record:', error);
        alert('Hubo un error al guardar el registro.');
    } else {
        alert('Registro de limpieza guardado con éxito.');
        formLimpieza.reset();
        renderHistorial();
    }
});

historialContainer.addEventListener('click', async (e) => {
    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este registro de limpieza?')) {
            const { error } = await supabase.from('limpiezas').delete().eq('id', id);
            if (error) {
                alert('Error al eliminar el registro.');
                console.error('Delete error:', error);
            } else {
                renderHistorial();
            }
        }
    }
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    poblarAreas();
    renderHistorial();
});