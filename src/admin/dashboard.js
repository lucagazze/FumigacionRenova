import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    // --- Selectores del DOM ---
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const operacionesContainer = document.getElementById('operacionesContainer');
    const filtrosForm = document.getElementById('filtrosRegistro');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
    const filtroFechaInput = document.getElementById('filtroFecha');

    // --- Carga de datos inicial ---
    operacionesContainer.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="mt-2 text-gray-500">Cargando registros...</p></div>';
    const allOperations = await getOperaciones();
    
    // --- Renderizado de componentes ---
    renderSilosEnCurso(allOperations);
    renderUltimasFinalizadas(allOperations);
    await poblarFiltros();
    renderOperaciones(operacionesContainer, allOperations, true);

    // --- Inicialización de Date Range Picker ---
    $(filtroFechaInput).daterangepicker({
        autoUpdateInput: false,
        opens: 'left',
        locale: { cancelLabel: 'Limpiar', applyLabel: 'Aplicar', fromLabel: 'Desde', toLabel: 'Hasta', format: 'DD/MM/YYYY' }
    });

    // --- Event Listeners ---
    $(filtroFechaInput).on('apply.daterangepicker', () => aplicarFiltros(allOperations));
    $(filtroFechaInput).on('cancel.daterangepicker', () => {
        $(filtroFechaInput).val('');
        aplicarFiltros(allOperations);
    });

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    filtrosForm.addEventListener('change', () => aplicarFiltros(allOperations));
    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
        $(filtroFechaInput).data('daterangepicker').setStartDate(moment());
        $(filtroFechaInput).data('daterangepicker').setEndDate(moment());
        $(filtroFechaInput).val('');
        aplicarFiltros(allOperations); 
    });

    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) detailsElement.classList.toggle('hidden');
        }
    });
});

function renderSilosEnCurso(operaciones) {
    const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
    const opsEnCurso = operaciones.filter(op => op.estado === 'en curso');
    
    if (opsEnCurso.length === 0) {
        silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso.</p>';
        return;
    }

    const toneladasPorDeposito = new Map();
    opsEnCurso.forEach(op => {
        if (!op.depositos) return;
        const key = op.depositos.id;
        let currentData = toneladasPorDeposito.get(key) || { deposito: op.depositos, totalToneladas: 0, cliente: op.clientes };
        if ((op.tipo_registro === 'producto' || op.tipo_registro === 'movimiento') && typeof op.toneladas === 'number') {
            currentData.totalToneladas += op.toneladas;
        }
        toneladasPorDeposito.set(key, currentData);
    });

    silosEnCursoContainer.innerHTML = '';
    toneladasPorDeposito.forEach((data) => {
        const { deposito, totalToneladas } = data;
        const capacidad = deposito.capacidad_toneladas || 0;
        const porcentajeLlenado = capacidad > 0 ? (totalToneladas / capacidad) * 100 : 0;
        const fillHeight = 80 * (Math.min(porcentajeLlenado, 100) / 100);
        const yPos = 95 - fillHeight;

        silosEnCursoContainer.innerHTML += `
            <div class="flex flex-col items-center gap-2 silo-wrapper" data-deposito-id="${deposito.id}" title="Click para filtrar operaciones de este depósito">
                <svg viewBox="0 0 100 100" class="silo-svg">
                    <path class="silo-outline" d="M 10 10 H 90 V 90 C 90 95, 80 100, 70 100 H 30 C 20 100, 10 95, 10 90 V 10 Z" />
                    <rect class="silo-fill-rect" x="15" y="${yPos}" width="70" height="${fillHeight}" rx="10"/>
                </svg>
                <div class="text-sm font-bold text-center">${data.cliente?.nombre || 'N/A'}</div>
                <div class="text-xs text-gray-600 text-center">${deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)} ${deposito.nombre}</div>
                <div class="text-xs font-semibold text-center">${totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn</div>
            </div>`;
    });
    
    silosEnCursoContainer.querySelectorAll('[data-deposito-id]').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('filtroSiloCelda').value = el.dataset.depositoId;
            document.getElementById('filtroEstado').value = 'en curso';
            aplicarFiltros(operaciones);
            const filtrosContainer = document.getElementById('filtrosContainer');
            if (filtrosContainer.classList.contains('hidden')) {
                document.getElementById('toggleFiltrosBtn').click();
            }
            document.getElementById('operacionesContainer').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function renderUltimasFinalizadas(operaciones) {
    const container = document.getElementById('ultimasFinalizadasContainer');
    const finalizadas = operaciones
        .filter(op => op.tipo_registro === 'finalizacion')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4);

    if (finalizadas.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones finalizadas recientemente.</p>';
        return;
    }

    container.innerHTML = finalizadas.map(op => {
        const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
        return `
            <a href="operacion_detalle.html?id=${op.id}" class="block bg-white p-4 rounded-xl shadow-md border hover:border-blue-500 hover:shadow-lg transition-all">
                <p class="font-bold text-gray-800">${op.clientes?.nombre || 'N/A'}</p>
                <p class="text-sm text-gray-600">${depositoInfo}</p>
                <p class="text-sm text-gray-500 mt-2">Mercadería: <strong>${op.mercaderias?.nombre || 'N/A'}</strong></p>
                <p class="text-xs text-gray-400 mt-3">Finalizó el ${new Date(op.created_at).toLocaleDateString('es-AR')}</p>
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
    const fechaDesde = dateRange.startDate && dateRange.startDate.isValid() ? dateRange.startDate.toDate() : null;
    const fechaHasta = dateRange.endDate && dateRange.endDate.isValid() ? dateRange.endDate.toDate() : null;

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