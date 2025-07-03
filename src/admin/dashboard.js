import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('header').innerHTML = renderHeader();
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const operacionesContainer = document.getElementById('operacionesContainer');
    const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
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

    async function renderSilosEnCurso() {
        const { data: opsEnCurso, error } = await supabase.from('operaciones').select(`toneladas, tipo_registro, depositos (id, nombre, tipo, capacidad_toneladas, clientes (nombre))`).eq('estado', 'en curso');
        
        if (error) {
            silosEnCursoContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar depósitos.</p>';
            return;
        }
        if (opsEnCurso.length === 0) {
            silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso.</p>';
            return;
        }

        const toneladasPorDeposito = new Map();
        opsEnCurso.forEach(op => {
            if (!op.depositos) return;
            const key = op.depositos.id;
            let currentData = toneladasPorDeposito.get(key) || { deposito: op.depositos, totalToneladas: 0, operacionOriginalId: op.operacion_original_id || op.id, cliente: op.clientes };
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
                    <div class="text-sm font-bold text-center">${deposito.clientes?.nombre || 'N/A'}</div>
                    <div class="text-xs text-gray-600 text-center">${deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)} ${deposito.nombre}</div>
                    <div class="text-xs font-semibold text-center">${totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn</div>
                </div>`;
        });
        
        silosEnCursoContainer.querySelectorAll('[data-deposito-id]').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('filtroSiloCelda').value = el.dataset.depositoId;
                document.getElementById('filtroEstado').value = 'en curso';
                aplicarFiltros();
                if (filtrosContainer.classList.contains('hidden')) {
                    toggleFiltrosBtn.click();
                }
                document.getElementById('operacionesContainer').scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

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

        renderOperaciones(operacionesContainer, operaciones, true);
    }

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    
    filtrosForm.addEventListener('change', aplicarFiltros);

    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
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

    poblarFiltros();
    renderSilosEnCurso();
    aplicarFiltros();
});