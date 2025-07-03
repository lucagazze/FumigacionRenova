import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {

    document.getElementById('header').innerHTML = renderHeader();
    const btnVolver = document.getElementById('btnVolver');
    const btnEliminar = document.getElementById('btnEliminar');
    const container = document.getElementById('detalleContainer');
    
    const urlParams = new URLSearchParams(window.location.search);
    const operacionId = urlParams.get('id');

    if (!operacionId) {
        container.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
        return;
    }

    // 1. Obtener el registro actual para encontrar el ID original
    const { data: registroActual } = await supabase.from('operaciones').select('id, operacion_original_id').eq('id', operacionId).single();
    if (!registroActual) {
        container.innerHTML = '<p class="text-red-500">No se pudo encontrar la operación.</p>';
        return;
    }
    const originalId = registroActual.operacion_original_id || registroActual.id;

    // 2. Obtener todos los datos de la operación principal y sus registros asociados
    const { data: opData, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), checklist_items(*)`)
        .eq('id', originalId)
        .single();

    const { data: historial } = await supabase.from('operaciones').select('*, movimientos(*)').eq('operacion_original_id', originalId).order('created_at', { ascending: true });

    if (error) {
        container.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        return;
    }

    // 3. Renderizar todo
    renderizarPagina(container, opData, historial);

    // 4. Asignar eventos
    btnVolver.addEventListener('click', () => window.history.back());
    btnEliminar.addEventListener('click', () => eliminarOperacion(originalId));
});

function renderizarPagina(container, op, historial) {
    let totalProducto = 0;
    let totalToneladas = 0;
    historial.forEach(r => {
        if (r.tipo_registro === 'producto') totalProducto += (r.producto_usado_cantidad || 0);
        if (r.tipo_registro === 'producto' || r.tipo_registro === 'movimiento') totalToneladas += (r.toneladas || 0);
    });
    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

    // Renderizar Resumen General
    const resumenHTML = `
        <div id="resumenOperacion">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Resumen General</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 bg-gray-50 rounded-lg border">
                <p><strong>Cliente:</strong> ${op.clientes?.nombre || 'N/A'}</p>
                <p><strong>Depósito:</strong> ${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</p>
                <p><strong>Mercadería:</strong> ${op.mercaderias?.nombre || 'N/A'}</p>
                <p><strong>Método:</strong> ${op.metodo_fumigacion?.charAt(0).toUpperCase() + op.metodo_fumigacion?.slice(1) || 'N/A'}</p>
                <p><strong>Estado:</strong> <span class="font-bold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</span></p>
                <p><strong>Operario Principal:</strong> ${op.operario_nombre || 'N/A'}</p>
                <p class="md:col-span-2 font-semibold"><strong>Total Toneladas Movidas:</strong> ${totalToneladas.toLocaleString()} tn</p>
                <p class="md:col-span-2 font-semibold"><strong>Total Producto Aplicado:</strong> ${totalProducto.toLocaleString()} ${unidadLabel}</p>
            </div>
        </div>`;

    // Renderizar Historial de Registros
    const historialHTML = `
        <div id="historialContainer" class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Historial de Registros</h3>
            <div class="space-y-2">
                ${[op, ...historial].map(registro => {
                    let detalle = '';
                    switch(registro.tipo_registro) {
                        case 'inicial': detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; break;
                        case 'producto': detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${registro.producto_usado_cantidad?.toLocaleString()} ${unidadLabel}</b> en ${registro.toneladas?.toLocaleString()} tn.`; break;
                        case 'movimiento': detalle = `<b>${registro.operario_nombre}</b> registró un movimiento: ${registro.movimientos[0]?.observacion || ''} ${registro.movimientos[0]?.media_url ? `<a href="${registro.movimientos[0].media_url}" target="_blank" class="text-blue-600 hover:underline">[Ver adjunto]</a>` : ''}`; break;
                        case 'finalizacion': detalle = `Operación finalizada por <b>${registro.operario_nombre}</b>.`; break;
                    }
                    return `<div class="text-sm p-2 bg-gray-50 border-l-4 border-gray-300"><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}</div>`;
                }).join('')}
            </div>
        </div>`;

    // Renderizar Checklist
    const checklistHTML = `
        <div id="checklistContainer" class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Checklist de Tareas</h3>
            <div id="checklistItems" class="space-y-3">
                ${op.checklist_items.map(item => `
                    <div class="bg-gray-50 p-3 rounded-lg border flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="material-icons ${item.completado ? 'text-green-500' : 'text-gray-400'}">${item.completado ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span class="ml-3 font-medium text-gray-700">${item.item}</span>
                        </div>
                        ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-sm"><span class="material-icons text-base">image</span> Ver Foto</a>` : '<span class="text-xs text-gray-400">Sin foto</span>'}
                    </div>
                `).join('')}
            </div>
        </div>`;
    
    container.innerHTML = resumenHTML + historialHTML + checklistHTML;
}

async function eliminarOperacion(operacionId) {
    if (confirm('¿ESTÁ SEGURO? Esta acción eliminará la operación y TODOS sus registros asociados de forma PERMANENTE.')) {
        const { error } = await supabase.from('operaciones').delete().eq('id', operacionId);
        if (error) {
            alert('Error al eliminar la operación: ' + error.message);
        } else {
            alert('Operación eliminada correctamente.');
            window.location.href = 'dashboard.html';
        }
    }
}