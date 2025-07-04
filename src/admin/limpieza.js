import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();

    // --- Elementos del DOM ---
    const formLimpieza = document.getElementById('formLimpieza');
    const depositoSelect = document.getElementById('depositoSelect');
    const historialContainer = document.getElementById('historialLimpieza');
    
    // --- Elementos de Filtros ---
    const filtrosForm = document.getElementById('filtrosForm');
    const filtroClienteSelect = document.getElementById('filtroCliente');
    const filtroDepositoSelect = document.getElementById('filtroDeposito');
    const filtroFechaInput = document.getElementById('filtroFecha');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

    let allLimpiezas = []; // Almacenar todos los registros para filtrar en el cliente

    // --- Inicialización del Date Range Picker ---
    $(filtroFechaInput).daterangepicker({
        autoUpdateInput: false,
        opens: 'left',
        locale: {
            cancelLabel: 'Limpiar',
            applyLabel: 'Aplicar',
            fromLabel: 'Desde',
            toLabel: 'Hasta',
            format: 'DD/MM/YYYY'
        }
    });

    $(filtroFechaInput).on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
        renderHistorial(aplicarFiltros());
    });

    $(filtroFechaInput).on('cancel.daterangepicker', function(ev, picker) {
        $(this).val('');
        renderHistorial(aplicarFiltros());
    });

    // --- Funciones de Carga y Renderizado ---
    async function poblarDepositos(selectElement, clienteId = null) {
        let query = supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
        if (clienteId) {
            query = query.eq('cliente_id', clienteId);
        }
        const { data, error } = await query;
        if (error) { console.error('Error cargando depósitos:', error); return; }
        
        const currentVal = selectElement.value;
        selectElement.innerHTML = `<option value="">${clienteId ? 'Todos los depósitos' : 'Seleccionar Depósito...'}</option>`;
        data.forEach(d => {
            selectElement.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`;
        });
        selectElement.value = currentVal;
    }

    async function poblarFiltroClientes() {
        const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
        if (error) { console.error('Error cargando clientes:', error); return; }
        filtroClienteSelect.innerHTML = '<option value="">Todos los Clientes</option>';
        data.forEach(c => {
            filtroClienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });
    }

    async function cargarHistorial() {
        const { data, error } = await supabase
            .from('limpiezas')
            .select('*, depositos(id, nombre, tipo, clientes(id, nombre))')
            .order('fecha_limpieza', { ascending: false });
        
        if (error) {
            console.error('Error al cargar el historial:', error);
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
        const fechaDesde = dateRange.startDate.isValid() ? dateRange.startDate.toDate() : null;
        const fechaHasta = dateRange.endDate.isValid() ? dateRange.endDate.toDate() : null;

        return allLimpiezas.filter(limpieza => {
            const matchCliente = !clienteId || (limpieza.depositos && limpieza.depositos.clientes && limpieza.depositos.clientes.id === clienteId);
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
    formLimpieza.addEventListener('submit', async (e) => {
        e.preventDefault();
        const deposito_id = depositoSelect.value;
        const fecha_limpieza = document.getElementById('fecha').value;
        const observaciones = document.getElementById('observaciones').value;
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
            await cargarHistorial();
            renderHistorial(aplicarFiltros()); // Re-render con filtros actuales
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
                    renderHistorial(aplicarFiltros());
                }
            }
        }
    });

    // --- Listeners de Filtros ---
    filtroClienteSelect.addEventListener('change', () => {
        poblarDepositos(filtroDepositoSelect, filtroClienteSelect.value);
        renderHistorial(aplicarFiltros());
    });

    filtroDepositoSelect.addEventListener('change', () => {
        renderHistorial(aplicarFiltros());
    });

    btnLimpiarFiltros.addEventListener('click', () => {
        filtrosForm.reset();
        poblarDepositos(filtroDepositoSelect); // Repoblar con todos los depósitos
        $(filtroFechaInput).val('');
        $(filtroFechaInput).data('daterangepicker').setStartDate(moment());
        $(filtroFechaInput).data('daterangepicker').setEndDate(moment());
        renderHistorial(allLimpiezas);
    });

    // --- Carga Inicial ---
    await poblarDepositos(depositoSelect);
    await poblarFiltroClientes();
    await poblarDepositos(filtroDepositoSelect);
    await cargarHistorial();
});