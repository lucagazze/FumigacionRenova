import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

// --- Funciones de Renderizado ---

function renderSilosEnCurso(operaciones, operationsForDashboard) {
    const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
    const opsEnCurso = operaciones.filter(op => op.estado === 'en curso');
    
    if (opsEnCurso.length === 0) {
        silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso.</p>';
        return;
    }

    const operacionesUnicas = new Map();

    opsEnCurso.forEach(op => {
        const rootId = op.operacion_original_id || op.id;
        if (!operacionesUnicas.has(rootId)) {
            const initialRecord = opsEnCurso.find(o => o.id === rootId && o.tipo_registro === 'inicial');
            if (initialRecord) {
                 operacionesUnicas.set(rootId, { ...initialRecord, totalToneladas: 0 });
            }
        }
        
        if (operacionesUnicas.has(rootId) && op.toneladas) {
            const currentOp = operacionesUnicas.get(rootId);
            currentOp.totalToneladas += op.toneladas;
        }
    });

    silosEnCursoContainer.innerHTML = '';
    operacionesUnicas.forEach((op, rootId) => {
        const deposito = op.depositos;
        const capacidad = deposito?.capacidad_toneladas || 0;
        const porcentajeLlenado = capacidad > 0 ? (op.totalToneladas / capacidad) * 100 : 0;
        const fillHeight = 80 * (Math.min(porcentajeLlenado, 100) / 100);
        const yPos = 95 - fillHeight;

        silosEnCursoContainer.innerHTML += `
            <div class="flex flex-col items-center gap-2 silo-wrapper" data-operacion-id="${rootId}" title="Click para filtrar esta operación">
                <svg viewBox="0 0 100 100" class="silo-svg">
                    <path class="silo-outline" d="M 10 10 H 90 V 90 C 90 95, 80 100, 70 100 H 30 C 20 100, 10 95, 10 90 V 10 Z" />
                    <rect class="silo-fill-rect" x="15" y="${yPos}" width="70" height="${fillHeight}" rx="10"/>
                </svg>
                <div class="text-sm font-bold text-center">${op.clientes?.nombre || 'N/A'}</div>
                <div class="text-xs text-gray-600 text-center">${deposito?.tipo?.charAt(0).toUpperCase() + deposito?.tipo?.slice(1)} ${deposito?.nombre}</div>
                <div class="text-xs font-semibold text-center">${op.totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn (${porcentajeLlenado.toFixed(1)}%)</div>
            </div>`;
    });
    
    silosEnCursoContainer.addEventListener('click', (e) => {
        const siloWrapper = e.target.closest('.silo-wrapper');
        if (siloWrapper) {
            const operacionId = siloWrapper.dataset.operacionId;
            const registrosDeLaOperacion = operationsForDashboard.filter(
                record => record.id === operacionId || record.operacion_original_id === operacionId
            );
            document.getElementById('filtrosRegistro').reset();
            $('#filtroFecha').val('');
            renderOperaciones(document.getElementById('operacionesContainer'), registrosDeLaOperacion, true);
            document.getElementById('operacionesContainer').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

async function renderUltimasFinalizadas() {
    const container = document.getElementById('ultimasFinalizadasContainer');
    container.innerHTML = '<p class="text-center text-gray-500 col-span-full">Cargando...</p>';

    const { data: ops, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .eq('estado', 'finalizada')
        .eq('tipo_registro', 'inicial')
        .order('created_at', { ascending: false })
        .limit(4);

    if (error || !ops || ops.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones finalizadas recientemente.</p>';
        return;
    }

    container.innerHTML = ops.map(op => {
        const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
        return `
            <a href="operacion_detalle.html?id=${op.id}" class="block bg-white rounded-xl shadow border p-4 transition hover:shadow-md hover:border-blue-300">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-md text-gray-800">${op.clientes?.nombre || 'N/A'}</h4>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800">Finalizada</span>
                </div>
                <div class="text-sm text-gray-600">
                    <p><strong>Depósito:</strong> ${depositoInfo}</p>
                    <p><strong>Fecha:</strong> ${new Date(op.created_at).toLocaleDateString('es-AR')}</p>
                </div>
            </a>
        `;
    }).join('');
}


async function poblarFiltros() {
    const { data: clientes } = await supabase.from('clientes').select('id, nombre').order('nombre');
    const filtroCliente = document.getElementById('filtroCliente');
    if (filtroCliente) {
        filtroCliente.innerHTML = '<option value="">Todos</option>';
        clientes.forEach(c => filtroCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
    }

    const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
    const filtroSiloCelda = document.getElementById('filtroSiloCelda');
    if (filtroSiloCelda) {
        filtroSiloCelda.innerHTML = '<option value="">Todos</option>';
        depositos.forEach(d => filtroSiloCelda.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`);
    }
}

function aplicarFiltros(operaciones) {
    const operacionesContainer = document.getElementById('operacionesContainer');
    operacionesContainer.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="mt-2 text-gray-500">Filtrando registros...</p></div>';
    
    let filteredOperations = [...operaciones];
    
    const clienteId = document.getElementById('filtroCliente').value;
    const tipo = document.getElementById('filtroTipo').value;
    const estado = document.getElementById('filtroEstado').value;
    const siloCeldaId = document.getElementById('filtroSiloCelda').value;
    
    const dateRange = $('#filtroFecha').data('daterangepicker');
    const hasDateValue = $('#filtroFecha').val() !== '';
    const fechaDesde = hasDateValue && dateRange.startDate && dateRange.startDate.isValid() ? dateRange.startDate.toDate() : null;
    const fechaHasta = hasDateValue && dateRange.endDate && dateRange.endDate.isValid() ? dateRange.endDate.toDate() : null;

    if (clienteId) filteredOperations = filteredOperations.filter(op => op.cliente_id === clienteId);
    if (tipo) filteredOperations = filteredOperations.filter(op => op.tipo_registro === tipo);
    if (estado) filteredOperations = filteredOperations.filter(op => op.estado === estado);
    if (siloCeldaId) filteredOperations = filteredOperations.filter(op => op.deposito_id === siloCeldaId);
    
    if (fechaDesde) {
        fechaDesde.setHours(0, 0, 0, 0);
        filteredOperations = filteredOperations.filter(op => new Date(op.created_at) >= fechaDesde);
    }
    if (fechaHasta) {
        fechaHasta.setHours(23, 59, 59, 999);
        filteredOperations = filteredOperations.filter(op => new Date(op.created_at) <= fechaHasta);
    }

    renderOperaciones(operacionesContainer, filteredOperations, true);
}

// --- Lógica Principal ---

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    const operacionesContainer = document.getElementById('operacionesContainer');
    operacionesContainer.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="mt-2 text-gray-500">Cargando registros...</p></div>';

    const allOperations = await getOperaciones();
    const operationsForDashboard = allOperations.filter(op => op.tipo_registro !== 'muestreo');

    renderSilosEnCurso(allOperations, operationsForDashboard);
    renderUltimasFinalizadas();
    await poblarFiltros();
    renderOperaciones(operacionesContainer, operationsForDashboard, true);

    // --- Selectores de Filtros y Botones ---
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const filtrosForm = document.getElementById('filtrosRegistro');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
    const filtroFechaInput = document.getElementById('filtroFecha');
    const btnClearSiloFilter = document.getElementById('btnClearSiloFilter'); 

    // --- Inicialización de Date Picker ---
    $(filtroFechaInput).daterangepicker({
        autoUpdateInput: false,
        opens: 'left',
        locale: { cancelLabel: 'Limpiar', applyLabel: 'Aplicar', fromLabel: 'Desde', toLabel: 'Hasta', format: 'DD/MM/YYYY' }
    });

    // --- Event Listeners ---
    $(filtroFechaInput).on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
        aplicarFiltros(operationsForDashboard);
    });
    
    $(filtroFechaInput).on('cancel.daterangepicker', () => {
        $(filtroFechaInput).val('');
        aplicarFiltros(operationsForDashboard);
    });

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    filtrosForm.addEventListener('change', () => aplicarFiltros(operationsForDashboard));
    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
        $(filtroFechaInput).val('');
        aplicarFiltros(operationsForDashboard); 
    });

    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) detailsElement.classList.toggle('hidden');
        }
    });

    btnClearSiloFilter.addEventListener('click', () => {
        filtrosForm.reset();
        $(filtroFechaInput).val('');
        renderOperaciones(operacionesContainer, operationsForDashboard, true);
    });
});