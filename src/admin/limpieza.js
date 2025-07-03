import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const formLimpieza = document.getElementById('formLimpieza');
const depositoSelect = document.getElementById('depositoSelect');
const fechaInput = document.getElementById('fecha');
const observacionesInput = document.getElementById('observaciones');
const historialContainer = document.getElementById('historialLimpieza');

async function poblarDepositos() {
    const { data, error } = await supabase.from('depositos').select('id, nombre, tipo').order('nombre');
    if (error) {
        console.error('Error fetching depositos:', error);
        depositoSelect.innerHTML = '<option value="">No se pudieron cargar</option>';
        return;
    }
    
    depositoSelect.innerHTML = '<option value="">Seleccionar un depósito</option>';
    data.forEach(deposito => {
        const option = document.createElement('option');
        option.value = deposito.id;
        option.textContent = `${deposito.nombre} (${deposito.tipo})`;
        depositoSelect.appendChild(option);
    });
}

async function renderHistorial() {
    const { data, error } = await supabase.from('limpiezas').select('*, depositos(nombre, tipo)').order('fecha_limpieza', { ascending: false });
    
    if (error) {
        console.error('Error fetching cleaning history:', error);
        historialContainer.innerHTML = '<p class="text-red-500">Error al cargar el historial.</p>';
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
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depósito</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Limpieza</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venc. Garantía</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${data.map(registro => {
                const vencimiento = new Date(registro.fecha_garantia_limpieza + 'T00:00:00'); // Considerar zona horaria
                const hoy = new Date();
                hoy.setHours(0,0,0,0);
                const vencido = vencimiento < hoy;

                return `
                <tr>
                    <td class="px-6 py-4">${registro.depositos?.nombre || 'N/A'} (${registro.depositos?.tipo || 'N/A'})</td>
                    <td class="px-6 py-4">${new Date(registro.fecha_limpieza + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td class="px-6 py-4 font-semibold ${vencido ? 'text-red-600' : 'text-green-600'}">
                        ${new Date(registro.fecha_garantia_limpieza + 'T00:00:00').toLocaleDateString('es-AR')}
                    </td>
                    <td class="px-6 py-4">${registro.observaciones || 'N/A'}</td>
                    <td class="px-6 py-4">
                        <button data-id="${registro.id}" class="delete-btn text-red-600 hover:text-red-900">
                            <span class="material-icons">delete</span>
                        </button>
                    </td>
                </tr>
            `}).join('')}
        </tbody>
    `;
    
    historialContainer.innerHTML = '';
    historialContainer.appendChild(table);
}

formLimpieza.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deposito_id = depositoSelect.value;
    const fecha = fechaInput.value;
    const observaciones = observacionesInput.value;

    if (!deposito_id || !fecha) {
        alert('Por favor, seleccione un depósito y una fecha.');
        return;
    }

    const fechaLimpieza = new Date(fecha);
    fechaLimpieza.setDate(fechaLimpieza.getUTCDate() + 180);
    const fecha_garantia_limpieza = fechaLimpieza.toISOString().split('T')[0];

    const { error } = await supabase.from('limpiezas').insert([
        { deposito_id, fecha_limpieza: fecha, observaciones, fecha_garantia_limpieza }
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

document.addEventListener('DOMContentLoaded', () => {
    poblarDepositos();
    renderHistorial();
});