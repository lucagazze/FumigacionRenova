import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    const container = document.getElementById('detalle-container');
    const urlParams = new URLSearchParams(window.location.search);
    const operacionId = urlParams.get('id');

    if (!operacionId) {
        container.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
        return;
    }

    const { data: registroActual, error: fetchRegistroError } = await supabase.from('operaciones').select('id, operacion_original_id').eq('id', operacionId).single();
    if (fetchRegistroError || !registroActual) {
        container.innerHTML = '<p class="text-red-500">No se pudo encontrar el registro de la operación.</p>';
        return;
    }
    const originalId = registroActual.operacion_original_id || registroActual.id;

    const { data: allRecords, error: fetchAllError } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), checklist_items(*), muestreos(*)`)
        .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`)
        .order('created_at', { ascending: true });

    if (fetchAllError || !allRecords || allRecords.length === 0) {
        container.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        return;
    }
    
    const opBaseData = allRecords.find(r => r.id === originalId) || allRecords[0];
    renderizarPagina(container, opBaseData, allRecords);
});

// --- RENDERIZADO DE LA PÁGINA ---
function renderizarPagina(container, opBase, allRecords) {
    let totalProducto = 0;
    let totalToneladas = 0;
    allRecords.forEach(r => {
        totalToneladas += (r.toneladas || 0);
        totalProducto += (r.producto_usado_cantidad || 0);
    });

    const unidadLabel = opBase.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamientosUnicos = [...new Set(allRecords.map(r => r.tratamiento).filter(Boolean))];
    const tratamiento = tratamientosUnicos.length > 0 ? tratamientosUnicos.join(', ') : 'N/A';
    
    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center gap-4">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 mt-4 bg-gray-50 rounded-lg border">
            <div><strong>Cliente:</strong><br>${opBase.clientes?.nombre || 'N/A'}</div>
            <div><strong>Depósito:</strong><br>${opBase.depositos?.nombre || 'N/A'} (${opBase.depositos?.tipo || 'N/A'})</div>
            <div><strong>Mercadería:</strong><br>${opBase.mercaderias?.nombre || 'N/A'}</div>
            <div><strong>Método:</strong><br>${opBase.metodo_fumigacion || 'N/A'}</div>
            <div><strong>Tratamiento(s):</strong><br>${tratamiento}</div>
            <div><strong>Estado:</strong><br><span class="font-bold ${opBase.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${opBase.estado}</span></div>
            <div class="font-semibold"><strong>Total Toneladas:</strong><br>${totalToneladas.toLocaleString()} tn</div>
            <div class="font-semibold"><strong>Total Producto:</strong><br>${totalProducto.toLocaleString()} ${unidadLabel}</div>
        </div>
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Línea de Tiempo de la Operación</h3>
            <div class="space-y-2">
                ${allRecords.map(registro => {
                    let detalle = '';
                    switch(registro.tipo_registro) {
                        case 'inicial': detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; break;
                        case 'producto': detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${(registro.producto_usado_cantidad || 0).toLocaleString()} ${unidadLabel}</b> en ${(registro.toneladas || 0).toLocaleString()} tn.`; break;
                        case 'muestreo': detalle = `<b>${registro.operario_nombre}</b> registró un muestreo.`; break;
                        case 'finalizacion': detalle = `Operación finalizada por <b>${registro.operario_nombre}</b>.`; break;
                    }
                    return `<div class="text-sm p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm">
                                <b>${new Date(registro.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}:</b> ${detalle}
                            </div>`;
                }).join('')}
            </div>
        </div>
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Checklist de Tareas</h3>
            <div class="space-y-3">
                ${(opBase.checklist_items || []).map(item => `
                    <div class="bg-white p-3 rounded-lg border shadow-sm flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="material-icons ${item.completado ? 'text-green-500' : 'text-gray-400'}">${item.completado ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span class="ml-3 font-medium text-gray-700">${item.item}</span>
                        </div>
                        ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-sm"><span class="material-icons text-base">image</span> Ver Foto</a>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
}