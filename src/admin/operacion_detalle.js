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

    const { data: registroActual } = await supabase.from('operaciones').select('id, operacion_original_id').eq('id', operacionId).single();
    if (!registroActual) {
        container.innerHTML = '<p class="text-red-500">No se pudo encontrar la operación.</p>';
        return;
    }
    const originalId = registroActual.operacion_original_id || registroActual.id;

    const { data: allRecords, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), checklist_items(*), muestreos(*)`)
        .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`)
        .order('created_at', { ascending: true });

    if (error || !allRecords || allRecords.length === 0) {
        container.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        console.error('Error fetching operation details:', error);
        return;
    }
    
    const opData = allRecords.find(r => r.tipo_registro === 'inicial');

    renderizarPagina(container, opData, allRecords);

    btnVolver.addEventListener('click', () => window.history.back());
    const btnEliminar = container.querySelector('#btnEliminar');
    if(btnEliminar) {
      btnEliminar.addEventListener('click', () => eliminarOperacion(originalId));
    }
});

function renderizarPagina(container, op, allRecords) {
    let totalProducto = 0;
    let totalToneladas = 0;
    
    allRecords.forEach(r => {
        if (r.tipo_registro === 'producto' || r.tipo_registro === 'muestreo') totalToneladas += (r.toneladas || 0);
        if (r.tipo_registro === 'producto') totalProducto += (r.producto_usado_cantidad || 0);
    });

    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamientosUnicos = [...new Set(allRecords.map(r => r.tratamiento).filter(Boolean))];
    const tratamiento = tratamientosUnicos.length > 0 ? tratamientosUnicos.join(', ') : 'N/A';
    
    let garantiaHTML = '';
    const registroFinal = allRecords.find(r => r.tipo_registro === 'finalizacion');

    if (op.estado === 'finalizada' && registroFinal) {
        if (registroFinal.con_garantia) {
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            const vencimiento = new Date(registroFinal.fecha_vencimiento_garantia + 'T00:00:00');
            const vencimientoStr = vencimiento.toLocaleDateString('es-AR');
            if (vencimiento >= hoy) {
                garantiaHTML = `<div class="text-green-600 font-bold"><strong>Garantía:</strong><br>Vigente hasta ${vencimientoStr}</div>`;
            } else {
                garantiaHTML = `<div class="text-yellow-600 font-bold"><strong>Garantía:</strong><br>Vencida el ${vencimientoStr}</div>`;
            }
        } else {
            garantiaHTML = `<div class="text-red-600 font-bold"><strong>Garantía:</strong><br>Sin garantía</div>`;
        }
    } else {
         garantiaHTML = `<div><strong>Garantía:</strong><br>En curso</div>`;
    }

    const resumenHTML = `
        <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
            <button id="btnEliminar" class="btn btn-danger flex items-center gap-2">
                <span class="material-icons text-base">delete</span>
                <span>Eliminar Operación Completa</span>
            </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 bg-gray-50 rounded-lg border">
            <div><strong>Cliente:</strong><br>${op.clientes?.nombre || 'N/A'}</div>
            <div><strong>Depósito:</strong><br>${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</div>
            <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
            <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
            <div><strong>Tratamiento(s):</strong><br>${tratamiento}</div>
            <div><strong>Estado:</strong><br><span class="font-bold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</span></div>
            <div class="font-semibold"><strong>Total Toneladas:</strong><br>${totalToneladas.toLocaleString()} tn</div>
            <div class="font-semibold"><strong>Total Producto:</strong><br>${totalProducto.toLocaleString()} ${unidadLabel}</div>
            ${garantiaHTML}
        </div>`;

    const historialHTML = `
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Línea de Tiempo de la Operación</h3>
            <div class="space-y-2">
                ${allRecords.map(registro => {
                    let detalle = '';
                    let extraClasses = '';
                    let dataAttributes = '';
                    let actionButton = '';
                    const deletableTypes = ['producto', 'muestreo'];

                    if (deletableTypes.includes(registro.tipo_registro)) {
                        actionButton = `<button class="btn-delete-registro" data-registro-id="${registro.id}" title="Eliminar este registro"><span class="material-icons text-red-500 hover:text-red-700">delete_forever</span></button>`;
                    }

                    switch(registro.tipo_registro) {
                        case 'inicial': detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; break;
                        case 'producto': detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${registro.producto_usado_cantidad?.toLocaleString()} ${unidadLabel}</b> en ${registro.toneladas?.toLocaleString()} tn (Tratamiento: ${registro.tratamiento}).`; break;
                        case 'muestreo':
                            const muestreo = registro.muestreos && registro.muestreos.length > 0 ? registro.muestreos[0] : null;
                            if (muestreo) {
                                detalle = `<b>${registro.operario_nombre}</b> registró un muestreo. <span class="text-blue-600 font-semibold">Ver detalles</span>`;
                                extraClasses = 'cursor-pointer hover:bg-gray-100';
                                dataAttributes = `data-muestreo-id="${muestreo.id}"`;
                            } else {
                                detalle = `<b>${registro.operario_nombre}</b> registró un muestreo (sin datos adicionales).`;
                            }
                            break;
                        case 'finalizacion': detalle = `Operación finalizada por <b>${registro.operario_nombre}</b>.`; break;
                    }
                    return `<div class="flex items-center justify-between text-sm p-3 bg-gray-50 border-l-4 border-gray-300 rounded-r-lg ${extraClasses}" ${dataAttributes}><div><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}</div>${actionButton}</div>`;
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

    // Event listener para los clics en la línea de tiempo
    container.addEventListener('click', async (e) => {
        const muestreoTarget = e.target.closest('[data-muestreo-id]');
        const deleteTarget = e.target.closest('.btn-delete-registro');

        if (muestreoTarget) {
            const muestreoId = muestreoTarget.dataset.muestreoId;
            const { data: muestreoData, error } = await supabase
                .from('muestreos')
                .select('*')
                .eq('id', muestreoId)
                .single();
            
            if (muestreoData) {
                renderMuestreoModal(muestreoData);
            } else {
                alert('No se encontraron detalles para este muestreo.');
            }
        } else if (deleteTarget) {
            const registroId = deleteTarget.dataset.registroId;
            eliminarRegistro(registroId, allRecords);
        }
    });
}

function renderMuestreoModal(muestreo) {
    const modalHTML = `
        <div id="muestreo-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <span class="material-icons">close</span>
                </button>
                <h4 class="text-2xl font-bold mb-4">Detalle del Muestreo</h4>
                <div class="space-y-4">
                    <div>
                        <p class="font-semibold text-gray-800">Observación:</p>
                        <p class="p-3 bg-gray-100 rounded-lg text-gray-700 whitespace-pre-wrap">${muestreo.observacion || 'No se proporcionó observación.'}</p>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800 mb-2">Archivos Adjuntos:</p>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            ${muestreo.media_url && muestreo.media_url.length > 0 
                                ? muestreo.media_url.map(url => {
                                    const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
                                    if (isVideo) {
                                        return `<a href="${url}" target="_blank" class="block relative group"><video controls src="${url}" class="w-full h-32 object-cover rounded-lg"></video><div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span class="material-icons text-white text-4xl">play_circle_outline</span></div></a>`;
                                    } else {
                                        return `<a href="${url}" target="_blank" class="block relative group"><img src="${url}" class="w-full h-32 object-cover rounded-lg" alt="Archivo adjunto"><div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span class="material-icons text-white text-4xl">zoom_in</span></div></a>`;
                                    }
                                }).join('') 
                                : '<p class="text-gray-500 col-span-full">No hay archivos adjuntos.</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('muestreo-modal');
    const closeModalBtn = document.getElementById('close-modal');
    
    const closeModal = () => modal.remove();
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'muestreo-modal') {
            closeModal();
        }
    });
}

async function eliminarRegistro(registroId, allRecords) {
    if (!confirm('¿Está seguro de que desea eliminar este registro? Esta acción es PERMANENTE y el stock asociado será restaurado.')) return;

    const registro = allRecords.find(r => r.id === registroId);
    if (!registro) {
        alert('No se pudo encontrar el registro a eliminar.');
        return;
    }

    // Restaurar el stock si es un registro de producto
    if (registro.tipo_registro === 'producto' && registro.producto_usado_cantidad > 0) {
        const stockDeposito = registro.deposito_origen_stock;
        if (!stockDeposito) {
             alert('Error: No se pudo determinar el depósito de origen del stock para este registro.');
             return;
        }

        const { data: stock, error: stockError } = await supabase
            .from('stock')
            .select('*')
            .eq('deposito', stockDeposito)
            .eq('tipo_producto', registro.metodo_fumigacion)
            .single();

        if (stockError) {
            alert('Error al obtener el stock para restaurar: ' + stockError.message);
            return;
        }

        const DENSIDAD_LIQUIDO = 1.2;
        let kg_a_restaurar = 0;
        let unidades_a_restaurar = 0;

        if (registro.metodo_fumigacion === 'liquido') {
            kg_a_restaurar = (registro.producto_usado_cantidad / 1000) * DENSIDAD_LIQUIDO;
        } else { // pastillas
            unidades_a_restaurar = registro.producto_usado_cantidad;
            kg_a_restaurar = unidades_a_restaurar * 3 / 1000;
        }

        const { error: restoreError } = await supabase
            .from('stock')
            .update({
                cantidad_kg: (stock.cantidad_kg || 0) + kg_a_restaurar,
                cantidad_unidades: (stock.cantidad_unidades || 0) + unidades_a_restaurar
            })
            .eq('id', stock.id);

        if (restoreError) {
            alert('Error al restaurar el stock: ' + restoreError.message);
            return;
        }
    }

    // Eliminar permanentemente el registro
    const { error: deleteError } = await supabase.from('operaciones').delete().eq('id', registroId);
    if (deleteError) {
        alert('Error al eliminar el registro: ' + deleteError.message);
        alert('ATENCIÓN: El registro no se pudo eliminar, pero el stock puede haber sido restaurado. Por favor, verifique el stock manualmente.');
        return;
    }

    alert('Registro eliminado y stock restaurado.');
    location.reload();
}

async function eliminarOperacion(operacionId) {
    if (confirm('¿ESTÁ SEGURO? Esta acción eliminará la operación y TODOS sus registros asociados de forma PERMANENTE.')) {
        const { error } = await supabase.from('operaciones').delete().or(`id.eq.${operacionId},operacion_original_id.eq.${operacionId}`);
        if (error) {
            alert('Error al eliminar la operación: ' + error.message);
        } else {
            alert('Operación eliminada correctamente.');
            window.location.href = 'dashboard.html';
        }
    }
}
