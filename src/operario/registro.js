import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('header').innerHTML = renderHeader();
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const operacionesContainer = document.getElementById('operacionesContainer');
    const filtrosForm = document.getElementById('filtrosRegistro');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
    const filtroFechaInput = document.getElementById('filtroFecha');

    // Inicializar el selector de rango de fechas
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
        aplicarFiltros();
    });

    $(filtroFechaInput).on('cancel.daterangepicker', function(ev, picker) {
        $(this).val('');
        aplicarFiltros();
    });


    async function poblarFiltros() {
        // Poblar Clientes
        const { data: clientes } = await supabase.from('clientes').select('id, nombre').order('nombre');
        const filtroCliente = document.getElementById('filtroCliente');
        if (filtroCliente) {
            filtroCliente.innerHTML = '<option value="">Todos</option>';
            clientes.forEach(c => filtroCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        }

        // Poblar Depósitos (Silos y Celdas)
        const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
        const filtroSiloCelda = document.getElementById('filtroSiloCelda');
        if (filtroSiloCelda) {
            filtroSiloCelda.innerHTML = '<option value="">Todos</option>';
            depositos.forEach(d => filtroSiloCelda.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`);
        }
    }

    async function aplicarFiltros() {
        operacionesContainer.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="mt-2 text-gray-500">Cargando registros...</p></div>';
        let operaciones = await getOperaciones();
        
        const clienteId = document.getElementById('filtroCliente').value;
        const tipo = document.getElementById('filtroTipo').value;
        const estado = document.getElementById('filtroEstado').value;
        const siloCeldaId = document.getElementById('filtroSiloCelda').value;
        
        const dateRange = $(filtroFechaInput).data('daterangepicker');
        const fechaDesde = dateRange.startDate.isValid() ? dateRange.startDate.toDate() : null;
        const fechaHasta = dateRange.endDate.isValid() ? dateRange.endDate.toDate() : null;

        if (clienteId) operaciones = operaciones.filter(op => op.cliente_id === clienteId);
        if (tipo) operaciones = operaciones.filter(op => op.tipo_registro === tipo);
        if (estado) operaciones = operaciones.filter(op => op.estado === estado);
        if (siloCeldaId) operaciones = operaciones.filter(op => op.deposito_id === siloCeldaId);
        
        if (fechaDesde) {
            fechaDesde.setHours(0, 0, 0, 0);
            operaciones = operaciones.filter(op => new Date(op.created_at) >= fechaDesde);
        }
        if (fechaHasta) {
            fechaHasta.setHours(23, 59, 59, 999);
            operaciones = operaciones.filter(op => new Date(op.created_at) <= fechaHasta);
        }

        renderOperaciones(operacionesContainer, operaciones, false);
    }

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    
    filtrosForm.addEventListener('change', aplicarFiltros);

    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
        // Limpiar el campo de fecha manualmente
        $(filtroFechaInput).data('daterangepicker').setStartDate(moment());
        $(filtroFechaInput).data('daterangepicker').setEndDate(moment());
        $(filtroFechaInput).val('');
        
        aplicarFiltros(); 
    });

    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) {
                detailsElement.classList.toggle('hidden');
            }
        }
    });

    // Carga Inicial
    poblarFiltros();
    aplicarFiltros();
});