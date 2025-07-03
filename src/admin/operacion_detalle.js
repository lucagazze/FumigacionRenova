import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    const btnVolver = document.getElementById('btnVolver');
    const container = document.getElementById('detalle-container');
    
    const urlParams = new URLSearchParams(window.location.search);
    const operacionId = urlParams.get('id');

    if (!operacionId) {
        container.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
        return;
    }

    // --- LÓGICA DE DATOS CORREGIDA ---

    // 1. Obtener el registro actual para encontrar el ID original de la operación.
    const { data: registroActual } = await supabase.from('operaciones').select('id, operacion_original_id').eq('id', operacionId).single();
    if (!registroActual) {
        container.innerHTML = '<p class="text-red-500">No se pudo encontrar la operación.</p>';
        return;
    }
    const originalId = registroActual.operacion_original_id || registroActual.id;

    // 2. Obtener TODOS los registros relacionados con esa operación en una sola consulta.
    const { data: allRecords, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), checklist_items(*), movimientos(*)`)
        .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`) // Trae el registro inicial Y todos sus hijos.
        .order('created_at', { ascending: true }); // Ordena los eventos cronológicamente.

    if (error || !allRecords || allRecords.length === 0) {
        container.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        console.error('Error fetching operation details:', error);
        return;
    }
    
    // El registro inicial (opData) es el primero de la lista cronológica
    const opData = allRecords.find(r => r.tipo_registro === 'inicial');

    // 3. Renderizar todo con la lista completa de registros.
    renderizarPagina(container, opData, allRecords);

    // 4. Asignar eventos
    btnVolver.addEventListener('click', () => window.history.back());
    // La lógica para eliminar se mantiene igual, ya que elimina la operación por su ID original.
    container.querySelector('#btnEliminar')?.addEventListener('click', () => eliminarOperacion(originalId));
});

function renderizarPagina(container, op, allRecords) {
    let totalProducto = 0;
    let totalToneladas = 0;
    
    allRecords.forEach(r => {
        if (r.tipo_registro === 'producto' || r.tipo_registro === 'movimiento') totalToneladas += (r.toneladas || 0);
        if (r.tipo_registro === 'producto') totalProducto += (r.producto_usado_cantidad || 0);
    });
    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamiento = allRecords.find(r => r.tratamiento)?.tratamiento || 'N/A';

    const resumenHTML = `
        <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
            <button id="btnEliminar" class="btn btn-danger flex items-center gap-2">
                <span class="material-icons text-base">delete</span>
                <span>Eliminar Operación</span>
            </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 bg-gray-50 rounded-lg border">
            <div><strong>Cliente:</strong><br>${op.clientes?.nombre || 'N/A'}</div>
            <div><strong>Depósito:</strong><br>${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</div>
            <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
            <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
            <div><strong>Tratamiento:</strong><br>${tratamiento}</div>
            <div><strong>Estado:</strong><br><span class="font-bold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</span></div>
            <div class="font-semibold"><strong>Total Toneladas:</strong><br>${totalToneladas.toLocaleString()} tn</div>
            <div class="font-semibold"><strong>Total Producto:</strong><br>${totalProducto.toLocaleString()} ${unidadLabel}</div>
        </div>`;

    // --- RENDERIZADO DE LÍNEA DE TIEMPO CORREGIDO ---
    const historialHTML = `
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Línea de Tiempo de la Operación</h3>
            <div class="space-y-2">
                ${allRecords.map(registro => { // Se usa la lista completa 'allRecords'
                    let detalle = '';
                    switch(registro.tipo_registro) {
                        case 'inicial': detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; break;
                        case 'producto': detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${registro.producto_usado_cantidad?.toLocaleString()} ${unidadLabel}</b> en ${registro.toneladas?.toLocaleString()} tn.`; break;
                        case 'movimiento':
                            const movimiento = registro.movimientos && registro.movimientos.length > 0 ? registro.movimientos[0] : null;
                            const observacion = movimiento?.observacion || 'Sin observación.';
                            detalle = `<b>${registro.operario_nombre}</b> registró un movimiento: ${observacion}`;
                            break;
                        case 'finalizacion': detalle = `Operación finalizada por <b>${registro.operario_nombre}</b>.`; break;
                    }
                    return `<div class="text-sm p-3 bg-gray-50 border-l-4 border-gray-300 rounded-r-lg"><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}</div>`;
                }).join('')}
            </div>
        </div>`;

    const checklistHTML = `
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Checklist de Tareas</h3>
            <div class="space-y-3">
                ${op.checklist_items.map(item => `
                    <div class="bg-gray-50 p-3 rounded-lg border flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="material-icons ${item.completado ? 'text-green-500' : 'text-gray-400'}">${item.completado ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span class="ml-3 font-medium text-gray-700">${item.item}</span>
                        </div>
                        ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-sm"><span class="material-icons text-base">image</span> Ver Foto</a>` : ''}
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