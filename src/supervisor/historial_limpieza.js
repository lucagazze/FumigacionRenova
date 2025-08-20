import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();

    // --- Elementos del DOM ---
    const formLimpieza = document.getElementById('formLimpieza');
    const depositoSelect = document.getElementById('depositoSelect');
    const historialContainer = document.getElementById('historial-container');
    const user = getUser();

    // --- Elementos del Modal ---
    const addRecordBtn = document.getElementById('add-record-btn');
    const addRecordModal = document.getElementById('add-record-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // --- Funciones de Carga y Renderizado ---

    async function poblarDepositosAsignados() {
        if (!user.cliente_ids || user.cliente_ids.length === 0) {
            depositoSelect.innerHTML = '<option value="">No tiene depósitos asignados</option>';
            depositoSelect.disabled = true;
            return;
        }

        const { data, error } = await supabase
            .from('depositos')
            .select('id, nombre, tipo, clientes(nombre)')
            .in('cliente_id', user.cliente_ids)
            .order('nombre');
            
        if (error) { 
            console.error('Error cargando depósitos:', error); 
            depositoSelect.innerHTML = '<option value="">Error al cargar</option>';
            return; 
        }

        depositoSelect.innerHTML = '<option value="">Seleccionar Depósito...</option>';
        if (data.length === 0) {
            depositoSelect.innerHTML = '<option value="">No hay depósitos para sus clientes</option>';
        } else {
            data.forEach(d => {
                depositoSelect.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`;
            });
        }
        depositoSelect.disabled = false;
    }

    async function renderHistorialLimpieza() {
        if (!user || !user.cliente_ids || user.cliente_ids.length === 0) {
            historialContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No tiene clientes asignados para ver historiales.</p>';
            return;
        }

        const { data: depositos, error: depositosError } = await supabase
            .from('depositos')
            .select('id')
            .in('cliente_id', user.cliente_ids);

        if (depositosError) {
            console.error('Error fetching depositos:', depositosError);
            historialContainer.innerHTML = '<p class="text-red-500">Error al cargar los depósitos.</p>';
            return;
        }

        const depositoIds = depositos.map(d => d.id);
        if (depositoIds.length === 0) {
            historialContainer.innerHTML = '<p>No se encontraron depósitos para sus clientes asignados.</p>';
            return;
        }

        const { data: limpiezas, error } = await supabase
            .from('limpiezas')
            .select('*, depositos(id, nombre, tipo, clientes(id, nombre))')
            .in('deposito_id', depositoIds)
            .order('fecha_limpieza', { ascending: false });

        if (error) {
            console.error('Error al cargar el historial:', error);
            historialContainer.innerHTML = '<p class="text-red-500">No se pudo cargar el historial.</p>';
            return;
        }

        if (limpiezas.length === 0) {
            historialContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay registros de limpieza para sus clientes.</p>';
            return;
        }

        const tableHTML = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depósito</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Limpieza</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vto. Garantía</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${limpiezas.map(l => {
                        const deposito = l.depositos;
                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        const vtoGarantia = l.fecha_garantia_limpieza ? new Date(l.fecha_garantia_limpieza + 'T00:00:00') : null;
                        let garantiaClass = '';
                        if (vtoGarantia) {
                            garantiaClass = vtoGarantia < hoy ? 'text-red-500 font-bold' : 'text-green-600';
                        }
                        return `
                            <tr>
                                <td class="px-6 py-4">
                                    <div class="text-sm font-medium text-gray-900">${deposito?.nombre || 'N/A'} (${deposito?.tipo || 'N/A'})</div>
                                    <div class="text-sm text-gray-500">${deposito?.clientes?.nombre || 'Cliente no encontrado'}</div>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-700">${new Date(l.fecha_limpieza + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                                <td class="px-6 py-4 text-sm ${garantiaClass}">${vtoGarantia ? vtoGarantia.toLocaleDateString('es-AR') : 'N/A'}</td>
                                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">${l.observaciones || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        historialContainer.innerHTML = tableHTML;
    }

    // --- Event Listeners ---

    // Modal
    addRecordBtn.addEventListener('click', () => addRecordModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => addRecordModal.classList.add('hidden'));
    addRecordModal.addEventListener('click', (e) => {
        if (e.target === addRecordModal) {
            addRecordModal.classList.add('hidden');
        }
    });

    // Formulario
    formLimpieza.addEventListener('submit', async (e) => {
        e.preventDefault();
        const deposito_id = depositoSelect.value;
        const fecha_limpieza = document.getElementById('fecha').value;
        const observaciones = document.getElementById('observaciones').value;

        if (!deposito_id || !fecha_limpieza) {
            alert("Por favor, seleccione un depósito y una fecha.");
            return;
        }

        const fechaGarantia = new Date(fecha_limpieza);
        fechaGarantia.setMonth(fechaGarantia.getMonth() + 3);

        const { error } = await supabase.from('limpiezas').insert({
            deposito_id,
            fecha_limpieza,
            fecha_garantia_limpieza: fechaGarantia.toISOString().split('T')[0],
            observaciones
        });

        if (error) {
            alert('Error al guardar el registro: ' + error.message);
        } else {
            alert('Registro guardado con éxito.');
            formLimpieza.reset();
            addRecordModal.classList.add('hidden');
            await renderHistorialLimpieza();
        }
    });

    // --- Carga Inicial ---
    await poblarDepositosAsignados();
    await renderHistorialLimpieza();
});