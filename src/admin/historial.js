import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    const filterForm = document.getElementById('filter-form');
    
    await populateFilters();
    
    // --- INICIALIZACIÓN DEL DATE RANGE PICKER CORREGIDA ---
    $('#filter-fecha').daterangepicker({
        autoUpdateInput: false, // Clave: no actualiza el input automáticamente
        opens: 'left',
        locale: {
            cancelLabel: 'Limpiar',
            applyLabel: 'Aplicar',
            fromLabel: 'Desde',
            toLabel: 'Hasta',
            format: 'DD/MM/YYYY'
        }
    });

    // Nos aseguramos de que el campo de fecha comience vacío
    $('#filter-fecha').val('');

    $('#filter-fecha').on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
        renderFinishedOperations();
    });

    $('#filter-fecha').on('cancel.daterangepicker', function() {
        $(this).val('');
        renderFinishedOperations();
    });
    
    // La primera carga ahora se hará sin filtros de fecha
    await renderFinishedOperations();

    filterForm.addEventListener('change', renderFinishedOperations);
    filterForm.addEventListener('reset', () => {
        $('#filter-fecha').val('');
        setTimeout(renderFinishedOperations, 0); // setTimeout para asegurar que el reset se aplique antes de re-renderizar
    });
});

async function populateFilters() {
    const clienteSelect = document.getElementById('filter-cliente');
    const depositoSelect = document.getElementById('filter-deposito');

    const [{ data: clientes }, { data: depositos }] = await Promise.all([
        supabase.from('clientes').select('id, nombre').order('nombre'),
        supabase.from('depositos').select('id, nombre, tipo').order('nombre')
    ]);

    if (clientes) {
        clientes.forEach(c => clienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
    }
    if (depositos) {
        depositos.forEach(d => depositoSelect.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`);
    }
}

async function renderFinishedOperations() {
    const container = document.getElementById('historial-container');
    container.innerHTML = '<p class="text-center p-4 text-gray-500 col-span-full">Actualizando y cargando historial...</p>';

    const clienteId = document.getElementById('filter-cliente').value;
    const depositoId = document.getElementById('filter-deposito').value;
    const sortOrder = document.getElementById('sort-order').value;
    const dateRangeInput = $('#filter-fecha');
    let fechaDesde = null;
    let fechaHasta = null;

    // --- LÓGICA DE LECTURA DE FILTROS CORREGIDA ---
    // Solo aplicamos el filtro de fecha si el campo de texto tiene un valor
    if (dateRangeInput.val()) {
        const dateRange = dateRangeInput.data('daterangepicker');
        fechaDesde = dateRange.startDate?.isValid() ? dateRange.startDate.format('YYYY-MM-DD') : null;
        fechaHasta = dateRange.endDate?.isValid() ? dateRange.endDate.format('YYYY-MM-DD') : null;
    }
    
    // 1. Obtener datos para el cálculo de garantías.
    const [{ data: finalizadasIniciales }, { data: todasLasLimpiezas }, { data: todosLosFinales }] = await Promise.all([
        supabase.from('operaciones').select('*').eq('estado', 'finalizada').eq('tipo_registro', 'inicial'),
        supabase.from('limpiezas').select('deposito_id, fecha_garantia_limpieza').order('fecha_limpieza', { ascending: false }),
        supabase.from('operaciones').select('operacion_original_id, created_at').eq('estado', 'finalizada').eq('tipo_registro', 'finalizacion')
    ]);
    
    // 2. Procesar y actualizar las garantías en la base de datos si es necesario (sin cambios).
    if (finalizadasIniciales) {
        const updates = [];
        const limpiezasMap = new Map();
        if (todasLasLimpiezas) {
            for (const limpieza of todasLasLimpiezas) {
                if (!limpiezasMap.has(limpieza.deposito_id)) {
                    limpiezasMap.set(limpieza.deposito_id, limpieza.fecha_garantia_limpieza);
                }
            }
        }
    
        for (const op of finalizadasIniciales) {
            const registroFinal = todosLosFinales.find(f => f.operacion_original_id === op.id);
            if (!registroFinal) continue;
    
            const fechaFin = new Date(registroFinal.created_at);
            const duracionDias = (fechaFin - new Date(op.created_at)) / (1000 * 60 * 60 * 24);
            const cumplePlazo = duracionDias <= 5;
    
            let cumpleLimpieza = false;
            const fechaGarantiaLimpieza = limpiezasMap.get(op.deposito_id);
            if (fechaGarantiaLimpieza) {
                if (fechaFin <= new Date(fechaGarantiaLimpieza + 'T00:00:00')) cumpleLimpieza = true;
            }
    
            const con_garantia = cumplePlazo && cumpleLimpieza;
            let fecha_vencimiento_garantia = null;
            if (con_garantia) {
                let vencimiento = new Date(fechaFin);
                vencimiento.setDate(vencimiento.getDate() + 40);
                fecha_vencimiento_garantia = vencimiento.toISOString().split('T')[0];
            }
    
            if (op.con_garantia !== con_garantia || op.fecha_vencimiento_garantia !== fecha_vencimiento_garantia) {
                updates.push(
                    supabase.from('operaciones').update({ con_garantia, fecha_vencimiento_garantia }).eq('id', op.id)
                );
            }
        }
        if (updates.length > 0) await Promise.all(updates);
    }
    
    // 3. Obtener los datos ya actualizados para mostrar en la página.
    let query = supabase
        .from('operaciones')
        .select('*, clientes(nombre), depositos(nombre, tipo)')
        .eq('estado', 'finalizada')
        .eq('tipo_registro', 'inicial');
    
    if (fechaDesde) query = query.gte('created_at', fechaDesde);
    if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);
    
    const { data: operations, error } = await query;
    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center p-4 col-span-full">Error al cargar el historial.</p>`;
        return;
    }

    const { data: allMercaderias } = await supabase.from('mercaderias').select('id, nombre');
    const mercaderiasMap = new Map((allMercaderias || []).map(m => [m.id, m.nombre]));

    const operationsWithData = operations.map(op => ({
        ...op,
        mercaderias: { nombre: mercaderiasMap.get(op.mercaderia_id) || 'N/A' }
    }));
    
    const finalizationDateMap = new Map();
    if (todosLosFinales) {
        for (const final of todosLosFinales) {
            if (final.operacion_original_id) finalizationDateMap.set(final.operacion_original_id, new Date(final.created_at));
        }
    }

    const filteredOps = operationsWithData.filter(op => {
        if (clienteId && op.cliente_id != clienteId) return false;
        if (depositoId && op.deposito_id != depositoId) return false;
        return true;
    }).map(op => ({
        ...op,
        fecha_fin_real: finalizationDateMap.get(op.id) || (op.updated_at ? new Date(op.updated_at) : null)
    })).sort((a, b) => {
        const dateA = a.fecha_fin_real || 0;
        const dateB = b.fecha_fin_real || 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    if (filteredOps.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 p-4 col-span-full">No hay operaciones que coincidan con los filtros.</p>';
        return;
    }

    container.innerHTML = filteredOps.map(op => {
        const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
        const fechaInicio = op.created_at ? new Date(op.created_at).toLocaleString('es-AR') : 'N/A';
        const fechaFin = op.fecha_fin_real ? op.fecha_fin_real.toLocaleString('es-AR') : 'N/A';
        
        let garantiaHtml = '';
        if (op.con_garantia && op.fecha_vencimiento_garantia) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(op.fecha_vencimiento_garantia + 'T00:00:00');
            const vencimientoStr = vencimiento.toLocaleDateString('es-AR');
            if (vencimiento >= hoy) {
                garantiaHtml = `<div class="flex items-center gap-2" title="Garantía vigente hasta ${vencimientoStr}"><span class="material-icons text-lg text-green-600">check_circle</span><span>Garantía: <strong class="text-green-700">Vigente</strong></span></div>`;
            } else {
                garantiaHtml = `<div class="flex items-center gap-2" title="Garantía vencida el ${vencimientoStr}"><span class="material-icons text-lg text-yellow-600">warning</span><span>Garantía: <strong class="text-yellow-700">Vencida</strong></span></div>`;
            }
        } else {
            garantiaHtml = `<div class="flex items-center gap-2" title="La operación no cumplió los requisitos para la garantía"><span class="material-icons text-lg text-red-600">cancel</span><span>Garantía: <strong class="text-red-700">No incluida</strong></span></div>`;
        }

        return `
        <a href="operacion_detalle.html?id=${op.id}" class="block bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition hover:shadow-xl hover:border-blue-500 cursor-pointer">
            <div class="flex justify-between items-start mb-4">
                <h3 class="font-bold text-xl text-gray-800">${op.clientes?.nombre || 'N/A'}</h3>
                <span class="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800">Finalizada</span>
            </div>
            <div class="space-y-2 text-sm text-gray-700">
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">store</span><span>Depósito: <strong class="text-gray-900">${depositoInfo}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">grass</span><span>Mercadería: <strong class="text-gray-900">${op.mercaderias?.nombre || 'N/A'}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">event</span><span>Fecha Inicio: <strong class="text-gray-900">${fechaInicio}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">event_available</span><span>Fecha Fin: <strong class="text-gray-900">${fechaFin}</strong></span></div>
                ${garantiaHtml}
            </div>
             <div class="border-t border-gray-200 mt-6 pt-4 text-center">
                <div class="font-semibold text-blue-600 flex items-center justify-center w-full gap-2">
                    <span>Ver Resumen Completo</span>
                    <span class="material-icons">arrow_forward</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}