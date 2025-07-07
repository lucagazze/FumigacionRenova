import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';
import { renderOperaciones, getOperaciones } from '../common/data.js';

requireRole('supervisor');

function renderSilosEnCursoSupervisor(operaciones, onSiloClick) {
    const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
    const opsEnCurso = operaciones.filter(op => op.estado === 'en curso' && op.tipo_registro === 'inicial');
    
    if (opsEnCurso.length === 0) {
        silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso.</p>';
        return;
    }

    const operacionesUnicas = new Map();
    operaciones.forEach(op => {
        if (op.estado !== 'en curso') return;
        const rootId = op.operacion_original_id || op.id;
        if (!operacionesUnicas.has(rootId)) {
            const initialRecord = opsEnCurso.find(o => o.id === rootId);
            if (initialRecord) {
                 operacionesUnicas.set(rootId, { ...initialRecord, totalToneladas: op.toneladas || 0 });
            }
        } else {
             if (op.toneladas) {
                const currentOp = operacionesUnicas.get(rootId);
                currentOp.totalToneladas += op.toneladas;
            }
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
            onSiloClick({ operacionId });
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    const filterForm = document.getElementById('filter-form');
    const container = document.getElementById('historial-container');
    const user = getUser();

    if (!user.cliente_ids || user.cliente_ids.length === 0) {
        document.body.innerHTML = '<p class="text-center p-8">No tiene clientes asignados.</p>';
        return;
    }

    container.innerHTML = '<p class="text-center p-4">Cargando historial...</p>';

    const { data: allOperations, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo, capacidad_toneladas, limpiezas(fecha_garantia_limpieza)), mercaderias(nombre), muestreos(observacion, media_url)`)
        .in('cliente_id', user.cliente_ids)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error al cargar el historial.</p>`;
        return;
    }

    const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo').in('cliente_id', user.cliente_ids);
    const siloCeldaSelect = document.getElementById('filter-silo-celda');
    depositos.forEach(d => {
        siloCeldaSelect.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`;
    });

    const aplicarTodosLosFiltros = (options = {}) => {
        let operacionesFiltradas = [...allOperations];

        if (options.operacionId) {
            operacionesFiltradas = operacionesFiltradas.filter(op => op.id === options.operacionId || op.operacion_original_id === options.operacionId);
        } else {
            const tipo = document.getElementById('filter-tipo').value;
            const estado = document.getElementById('filter-estado').value;
            const siloCelda = document.getElementById('filter-silo-celda').value;

            if (tipo) operacionesFiltradas = operacionesFiltradas.filter(op => op.tipo_registro === tipo);
            if (estado) operacionesFiltradas = operacionesFiltradas.filter(op => op.estado === estado);
            if (siloCelda) operacionesFiltradas = operacionesFiltradas.filter(op => op.deposito_id === siloCelda);
        }
        
        renderOperaciones(container, operacionesFiltradas, false, true);
    };

    renderSilosEnCursoSupervisor(allOperations, aplicarTodosLosFiltros);
    aplicarTodosLosFiltros();

    filterForm.addEventListener('change', () => aplicarTodosLosFiltros());
    
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
        filterForm.reset();
        aplicarTodosLosFiltros();
    });

    document.getElementById('btnClearSiloFilter').addEventListener('click', () => {
        filterForm.reset();
        aplicarTodosLosFiltros();
    });

    container.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) {
                detailsElement.classList.toggle('hidden');
            }
        }
    });
});