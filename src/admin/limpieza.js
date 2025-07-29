import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();

    // --- Elementos del DOM ---
    const formLimpieza = document.getElementById('formLimpieza');
    const clienteSelect = document.getElementById('clienteSelect'); // Selector de cliente del formulario
    const depositoSelect = document.getElementById('depositoSelect');
    const historialContainer = document.getElementById('historialLimpieza');
    
    // --- Elementos de Filtros ---
    const filtrosForm = document.getElementById('filtrosForm');
    const filtroClienteSelect = document.getElementById('filtroCliente');
    const filtroDepositoSelect = document.getElementById('filtroDeposito');
    const filtroFechaInput = document.getElementById('filtroFecha');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

    // Verificación de que todos los elementos existen para evitar errores
    if (!formLimpieza || !clienteSelect || !depositoSelect || !historialContainer || !filtrosForm) {
        console.error("Error: No se encontraron todos los elementos necesarios en el HTML.");
        return;
    }

    let allLimpiezas = []; // Almacena todos los registros para poder filtrar sin volver a llamar a la DB

    // --- Inicialización del Date Range Picker ---
    $(filtroFechaInput).daterangepicker({
        autoUpdateInput: false,
        opens: 'left',
        locale: { cancelLabel: 'Limpiar', applyLabel: 'Aplicar', format: 'DD/MM/YYYY' }
    });
    $(filtroFechaInput).on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
        renderHistorial(aplicarFiltros());
    });
    $(filtroFechaInput).on('cancel.daterangepicker', function() {
        $(this).val('');
        renderHistorial(aplicarFiltros());
    });

    // --- Funciones de Carga y Renderizado ---

    async function poblarClientes(selectElement) {
        const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
        if (error) { console.error('Error cargando clientes:', error); return; }
        
        if (selectElement) {
            selectElement.innerHTML = `<option value="">Seleccione un Cliente</option>`;
            data.forEach(c => {
                selectElement.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
            });
        }
    }

    async function poblarDepositos(selectElement, clienteId = null) {
        if (!selectElement) return;

        if (!clienteId) {
            selectElement.innerHTML = `<option value="">Seleccione un cliente primero</option>`;
            selectElement.disabled = true;
            return;
        }

        selectElement.innerHTML = `<option value="">Cargando depósitos...</option>`;
        selectElement.disabled = true;

        const { data, error } = await supabase.from('depositos').select('id, nombre, tipo').eq('cliente_id', clienteId).order('nombre');
        if (error) { console.error('Error cargando depósitos:', error); return; }
        
        selectElement.innerHTML = `<option value="">Seleccionar Depósito...</option>`;
        if (data.length === 0) {
            selectElement.innerHTML = `<option value="">No hay depósitos para este cliente</option>`;
        } else {
            data.forEach(d => {
                selectElement.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`;
            });
            selectElement.disabled = false;
        }
    }

    async function cargarHistorial() {
        const { data, error } = await supabase
            .from('limpiezas')
            .select('*, depositos(id, nombre, tipo, clientes(id, nombre))')
            .order('fecha_limpieza', { ascending: false });
        
        if (error) {
            historialContainer.innerHTML = '<p class="text-red-500">No se pudo cargar el historial.</p>';
            return;
        }
        allLimpiezas = data;
        renderHistorial(allLimpiezas);
    }

    function renderHistorial(limpiezas) {
        if (limpiezas.length === 0) {
            historialContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay registros que coincidan con los filtros.</p>';
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
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
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
                                <td class="px-6 py-4 text-right">
                                    <button data-id="${l.id}" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons">delete</span></button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        historialContainer.innerHTML = tableHTML;
    }

    function aplicarFiltros() {
        const clienteId = filtroClienteSelect.value;
        const depositoId = filtroDepositoSelect.value;
        const dateRange = $(filtroFechaInput).data('daterangepicker');
        const fechaDesde = (dateRange.startDate && dateRange.startDate.isValid()) ? dateRange.startDate.toDate() : null;
        const fechaHasta = (dateRange.endDate && dateRange.endDate.isValid()) ? dateRange.endDate.toDate() : null;

        return allLimpiezas.filter(limpieza => {
            const matchCliente = !clienteId || (limpieza.depositos?.clientes?.id === clienteId);
            const matchDeposito = !depositoId || limpieza.deposito_id === depositoId;
            
            let matchFecha = true;
            if (fechaDesde && fechaHasta) {
                const fechaLimpieza = new Date(limpieza.fecha_limpieza + 'T00:00:00');
                fechaDesde.setHours(0,0,0,0);
                fechaHasta.setHours(23,59,59,999);
                matchFecha = fechaLimpieza >= fechaDesde && fechaLimpieza <= fechaHasta;
            }
            
            return matchCliente && matchDeposito && matchFecha;
        });
    }

    // --- Event Listeners ---

    clienteSelect.addEventListener('change', () => {
        const clienteId = clienteSelect.value;
        poblarDepositos(depositoSelect, clienteId);
    });

    formLimpieza.addEventListener('submit', async (e) => {
        e.preventDefault();
        const deposito_id = depositoSelect.value;
        const fecha_limpieza = document.getElementById('fecha').value;
        const observaciones = document.getElementById('observaciones').value;
        
        if (!deposito_id || !fecha_limpieza) {
            alert("Por favor, seleccione un cliente, un depósito y una fecha.");
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
            depositoSelect.innerHTML = '<option value="">Seleccione un cliente primero</option>';
            depositoSelect.disabled = true;
            await cargarHistorial();
        }
    });

    historialContainer.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            if (confirm('¿Está seguro de que desea eliminar este registro de limpieza?')) {
                const { error } = await supabase.from('limpiezas').delete().eq('id', id);
                if (error) {
                    alert('Error al eliminar: ' + error.message);
                } else {
                    await cargarHistorial();
                }
            }
        }
    });

    filtroClienteSelect.addEventListener('change', () => {
        poblarDepositos(filtroDepositoSelect, filtroClienteSelect.value || null);
        renderHistorial(aplicarFiltros());
    });
    filtroDepositoSelect.addEventListener('change', () => renderHistorial(aplicarFiltros()));
    btnLimpiarFiltros.addEventListener('click', () => {
        filtrosForm.reset();
        poblarDepositos(filtroDepositoSelect);
        $(filtroFechaInput).val('');
        renderHistorial(allLimpiezas);
    });

    // --- Carga Inicial ---
    await poblarClientes(clienteSelect);
    const filtroClienteOption = document.createElement('option');
    filtroClienteOption.value = "";
    filtroClienteOption.textContent = "Todos los Clientes";
    filtroClienteSelect.prepend(filtroClienteOption);
    await poblarClientes(filtroClienteSelect);
    
    await poblarDepositos(filtroDepositoSelect);
    await cargarHistorial();
});