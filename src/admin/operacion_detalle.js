import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

// --- CONSTANTES ---
const DENSIDAD_LIQUIDO = 1.2; // g/cm³ o kg/L

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

    const { data: limpiezaData } = await supabase
        .from('limpiezas')
        .select('fecha_limpieza, fecha_garantia_limpieza')
        .eq('deposito_id', opBaseData.deposito_id)
        .order('fecha_limpieza', { ascending: false })
        .limit(1)
        .single();
    
    renderizarPagina(container, opBaseData, allRecords, limpiezaData);

    document.getElementById('btnVolver').addEventListener('click', () => {
        window.history.back();
    });
});

// --- RENDERIZADO DE LA PÁGINA ---
function renderizarPagina(container, opBase, allRecords, limpieza) {
    let totalProducto = 0;
    let totalToneladas = 0;
    allRecords.forEach(r => {
        if(r.estado_aprobacion !== 'rechazado') {
            totalToneladas += (r.toneladas || 0);
            totalProducto += (r.producto_usado_cantidad || 0);
        }
    });

    const unidadLabel = opBase.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamientosUnicos = [...new Set(allRecords.map(r => r.tratamiento).filter(Boolean))];
    const tratamiento = tratamientosUnicos.length > 0 ? tratamientosUnicos.join(', ') : 'N/A';
    
    const registroFinal = allRecords.find(r => r.tipo_registro === 'finalizacion');
    const observacionFinal = registroFinal?.observacion_finalizacion 
        ? `<div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 class="font-bold text-yellow-800">Observación de Finalización:</h4>
              <p class="text-yellow-700 mt-1">${registroFinal.observacion_finalizacion}</p>
           </div>` 
        : '';

    // Lógica para la vigencia de la limpieza
    let limpiezaHtml = '<div><strong>Vigencia Limpieza:</strong><br><span class="text-gray-500">Sin registros</span></div>';
    if (limpieza) {
        const fechaGarantia = new Date(limpieza.fecha_garantia_limpieza + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const estaVigente = fechaGarantia >= hoy;
        const colorClass = estaVigente ? 'text-green-600' : 'text-red-600';
        limpiezaHtml = `<div><strong>Vigencia Limpieza:</strong><br><span class="font-semibold ${colorClass}">${fechaGarantia.toLocaleDateString('es-AR')}</span></div>`;
    }

    // Lógica para el plazo de la garantía de fumigación (solo para operaciones en curso)
    let plazoHtml = '';
    if (opBase.estado === 'en curso') {
        const fechaInicio = new Date(opBase.created_at);
        const fechaLimite = new Date(fechaInicio);
        fechaLimite.setDate(fechaLimite.getDate() + 5);
        const hoy = new Date();
        const diffDays = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            plazoHtml = `<div><strong>Plazo Garantía:</strong><br><span class="font-semibold text-orange-500">${diffDays} día(s) restante(s)</span></div>`;
        } else {
            plazoHtml = `<div><strong>Plazo Garantía:</strong><br><span class="font-semibold text-red-600">Vencido</span></div>`;
        }
    }

    // ===== LÓGICA DE GARANTÍA UNIFICADA Y CORREGIDA =====
    // Esta lógica ahora es idéntica a la de historial.js
    let garantiaHtml = '';
    if (opBase.estado === 'finalizada') {
        if (opBase.con_garantia && opBase.fecha_vencimiento_garantia) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(opBase.fecha_vencimiento_garantia + 'T00:00:00');
            const vencimientoStr = vencimiento.toLocaleDateString('es-AR');
            
            if (vencimiento >= hoy) {
                garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-green-600 flex items-center gap-1"><span class="material-icons text-base">check_circle</span>Vigente</span></div>`;
            } else {
                garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-yellow-600 flex items-center gap-1"><span class="material-icons text-base">warning</span>Vencida</span></div>`;
            }
        } else {
            garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-red-600 flex items-center gap-1"><span class="material-icons text-base">cancel</span>No Incluida</span></div>`;
        }
    }


    // Contenido HTML principal
    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center gap-4">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
            <button id="btnEliminarOperacionCompleta" class="btn btn-danger flex items-center gap-2">
                <span class="material-icons text-base">delete_forever</span>
                <span>Eliminar Operación Completa</span>
            </button>
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
            ${limpiezaHtml}
            ${plazoHtml}
            ${garantiaHtml}
        </div>

        ${observacionFinal}

        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Línea de Tiempo de la Operación</h3>
            <div class="space-y-2">
                ${allRecords.map(registro => {
                    let detalle = '';
                    let actionButtons = '';
                    const isRechazado = registro.estado_aprobacion === 'rechazado';
                    const itemClass = isRechazado ? 'line-through text-gray-400' : '';

                    if (['producto', 'inicial'].includes(registro.tipo_registro)) {
                         actionButtons += `<button class="btn-edit-registro p-1" data-registro-id="${registro.id}" title="Editar"><span class="material-icons text-blue-500 hover:text-blue-700">edit</span></button>`;
                    }
                    if (registro.tipo_registro !== 'inicial') {
                        actionButtons += `<button class="btn-delete-registro p-1" data-registro-id="${registro.id}" title="Eliminar"><span class="material-icons text-red-500 hover:text-red-700">delete</span></button>`;
                    }
                    if (registro.observacion_aprobacion) {
                        actionButtons += `<button class="btn-show-observacion p-1" data-observacion="${registro.observacion_aprobacion}" title="Ver observación"><span class="material-icons text-yellow-500 hover:text-yellow-700">comment</span></button>`;
                    }

                    switch(registro.tipo_registro) {
                        case 'inicial': detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; break;
                        case 'producto': detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${registro.producto_usado_cantidad?.toLocaleString() || 0} ${unidadLabel}</b> en ${registro.toneladas?.toLocaleString() || 0} tn.`; break;
                        case 'muestreo': detalle = `<b>${registro.operario_nombre}</b> registró un muestreo.`; break;
                        case 'finalizacion': detalle = `Operación finalizada por <b>${registro.operario_nombre_finalizacion || registro.operario_nombre}</b>.`; break;
                    }
                    const rechazoLabel = isRechazado ? ` <b class="text-red-500 no-underline">(RECHAZADO)</b>` : '';

                    return `<div class="flex items-center justify-between text-sm p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm ${itemClass}" data-muestreo-op-id="${registro.id}">
                                <div><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}${rechazoLabel}</div>
                                <div class="flex-shrink-0 ml-4 flex items-center gap-2">${actionButtons}</div>
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
    
    // EVENT LISTENER GLOBAL
    container.addEventListener('click', async (e) => {
        const editTarget = e.target.closest('.btn-edit-registro');
        const deleteTarget = e.target.closest('.btn-delete-registro');
        const deleteOpTarget = e.target.closest('#btnEliminarOperacionCompleta');
        const muestreoTarget = e.target.closest('[data-muestreo-op-id]');
        const obsBtn = e.target.closest('.btn-show-observacion');

        if (editTarget) {
            const registro = allRecords.find(r => r.id === editTarget.dataset.registroId);
            if (registro) renderEditModal(registro);
        } else if (deleteTarget) {
            const registroId = deleteTarget.dataset.registroId;
            const registro = allRecords.find(r => r.id === registroId);
            if(registro) {
                if (registro.tipo_registro === 'finalizacion') {
                    await revertirFinalizacion(registro);
                } else {
                    await eliminarRegistro(registro);
                }
            }
        } else if (deleteOpTarget) {
            await eliminarOperacionCompleta(opBase.id);
        } else if (muestreoTarget && muestreoTarget.querySelector('.text-blue-600')) {
            const muestreoData = allRecords.find(r => r.id === muestreoTarget.dataset.muestreoOpId)?.muestreos?.[0];
            if (muestreoData) renderMuestreoModal(muestreoData);
        } else if (obsBtn) {
            const observacion = obsBtn.dataset.observacion;
            renderObservacionModal(observacion);
        }
    });
}

// --- MODALES Y ACCIONES ---

async function revertirFinalizacion(registroFinal) {
    if (!confirm('¿Está seguro? La operación volverá al estado "en curso" y podrá continuar registrando acciones.')) return;
    try {
        await supabase.from('operaciones').delete().eq('id', registroFinal.id);
        await supabase
            .from('operaciones')
            .update({ estado: 'en curso', con_garantia: false, fecha_vencimiento_garantia: null })
            .or(`id.eq.${registroFinal.operacion_original_id},operacion_original_id.eq.${registroFinal.operacion_original_id}`);
        alert('Operación revertida a "en curso" con éxito.');
        location.reload();
    } catch(error) {
        alert('ERROR al revertir la finalización: ' + error.message);
    }
}

async function eliminarRegistro(registro) {
    if (!confirm('¿SEGURO que desea eliminar este registro? El stock asociado será restaurado. Esta acción es irreversible.')) return;
    try {
        if (registro.tipo_registro === 'producto' && registro.producto_usado_cantidad > 0) {
            await ajustarStock(registro, -registro.producto_usado_cantidad);
        }
        if (registro.tipo_registro === 'muestreo') {
            const muestreo = registro.muestreos?.[0];
            if (muestreo?.media_url?.length > 0) {
                const filePaths = muestreo.media_url.map(url => url.substring(url.indexOf('muestreos-media/')));
                await supabase.storage.from('muestreos-media').remove(filePaths);
            }
        }
        await supabase.from('operaciones').delete().eq('id', registro.id);
        alert('Registro eliminado y stock restaurado.');
        location.reload();
    } catch (error) {
        alert('ERROR al eliminar: ' + error.message);
    }
}

function renderObservacionModal(observacion) {
    const modalHTML = `
        <div id="observacion-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><span class="material-icons">close</span></button>
                <h4 class="text-2xl font-bold mb-4">Observación del Supervisor</h4>
                <div class="space-y-4">
                    <p class="p-3 bg-gray-100 rounded-lg text-gray-700 whitespace-pre-wrap">${observacion || 'N/A'}</p>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('observacion-modal');
    const closeModal = () => modal.remove();
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'observacion-modal' || e.target.closest('#close-modal')) closeModal();
    });
}

function renderMuestreoModal(muestreo) {
    const modalHTML = `
        <div id="muestreo-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><span class="material-icons">close</span></button>
                <h4 class="text-2xl font-bold mb-4">Detalle del Muestreo</h4>
                <div class="space-y-4">
                    <div><p class="font-semibold text-gray-800">Observación:</p><p class="p-3 bg-gray-100 rounded-lg text-gray-700 whitespace-pre-wrap">${muestreo.observacion || 'N/A'}</p></div>
                    <div><p class="font-semibold text-gray-800 mb-2">Archivos:</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        ${(muestreo.media_url || []).map(url => {
                            const isVideo = ['.mp4', '.mov', '.webm'].some(ext => url.toLowerCase().includes(ext));
                            return isVideo
                                ? `<a href="${url}" target="_blank" class="block group"><video controls src="${url}" class="w-full h-32 object-cover rounded-lg bg-black"></video></a>`
                                : `<a href="${url}" target="_blank" class="block group"><img src="${url}" class="w-full h-32 object-cover rounded-lg" alt="Adjunto"></a>`;
                        }).join('') || '<p class="text-gray-500 col-span-full">No hay archivos.</p>'}
                    </div></div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('muestreo-modal');
    const closeModal = () => modal.remove();
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'muestreo-modal' || e.target.closest('#close-modal')) closeModal();
    });
}

function renderEditModal(registro) {
    const isProducto = registro.tipo_registro === 'producto';
    const metodo = registro.metodo_fumigacion;
    const unidadLabel = metodo === 'pastillas' ? 'pastillas' : 'cm³';
    const fechaLocal = new Date(new Date(registro.created_at).getTime() - (new Date().getTimezoneOffset() * 60000));
    const fechaFormateada = fechaLocal.toISOString().slice(0, 16);

    const modalHTML = `
        <div id="edit-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
                <button id="close-edit-modal" class="absolute top-4 right-4"><span class="material-icons">close</span></button>
                <h4 class="text-2xl font-bold mb-4">Editar Aplicación</h4>
                <form id="edit-form" class="space-y-4">
                    <input type="hidden" id="edit-registro-id" value="${registro.id}">
                    <div><label for="edit-fecha" class="block font-semibold mb-1">Fecha y Hora</label><input type="datetime-local" id="edit-fecha" class="input-field" value="${fechaFormateada}"></div>
                    ${isProducto ? `
                    <div><label for="edit-tratamiento" class="block font-semibold mb-1">Tratamiento</label><select id="edit-tratamiento" class="input-field"><option value="preventivo" ${registro.tratamiento === 'preventivo' ? 'selected' : ''}>Preventivo</option><option value="curativo" ${registro.tratamiento === 'curativo' ? 'selected' : ''}>Curativo</option></select></div>
                    <div><label for="edit-toneladas" class="block font-semibold mb-1">Toneladas</label><input type="number" id="edit-toneladas" class="input-field" value="${registro.toneladas || ''}" step="any"></div>
                    <div class="p-3 bg-green-50 rounded-lg border"><label class="block font-semibold text-green-800">Producto Recalculado</label><p id="edit-producto-calculado" class="text-xl font-bold text-green-700">-</p></div>
                    ` : ''}
                    <div class="flex justify-end gap-4 pt-4"><button type="button" id="cancel-edit" class="btn btn-secondary">Cancelar</button><button type="submit" class="btn btn-primary">Guardar y Ajustar</button></div>
                </form>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('edit-modal');
    const closeModal = () => modal.remove();
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal' || e.target.closest('#close-edit-modal') || e.target.closest('#cancel-edit')) closeModal();
    });

    if (isProducto) {
        const tratamientoEl = document.getElementById('edit-tratamiento');
        const toneladasEl = document.getElementById('edit-toneladas');
        const productoCalculadoEl = document.getElementById('edit-producto-calculado');
        const updateCalculo = () => {
            const toneladas = parseFloat(toneladasEl.value) || 0;
            let cantidad = 0;
            if (metodo === 'pastillas') {
                cantidad = Math.round(toneladas * (tratamientoEl.value === 'curativo' ? 3 : 2));
            } else {
                cantidad = toneladas * (tratamientoEl.value === 'curativo' ? 20 : 12);
            }
            productoCalculadoEl.textContent = `${cantidad.toLocaleString('es-AR')} ${unidadLabel}`;
            productoCalculadoEl.dataset.cantidad = cantidad;
        };
        tratamientoEl.addEventListener('change', updateCalculo);
        toneladasEl.addEventListener('input', updateCalculo);
        updateCalculo();
    }

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const updates = { created_at: new Date(document.getElementById('edit-fecha').value).toISOString() };
            if (isProducto) {
                const nuevaCantidad = parseFloat(document.getElementById('edit-producto-calculado').dataset.cantidad);
                const stockDifference = nuevaCantidad - registro.producto_usado_cantidad;
                updates.toneladas = parseFloat(document.getElementById('edit-toneladas').value);
                updates.tratamiento = document.getElementById('edit-tratamiento').value;
                updates.producto_usado_cantidad = nuevaCantidad;
                if (stockDifference !== 0) await ajustarStock(registro, stockDifference);
            }
            const { error } = await supabase.from('operaciones').update(updates).eq('id', registro.id);
            if (error) throw error;
            alert('Registro actualizado.');
            closeModal();
            location.reload();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

async function ajustarStock(registro, diferencia) {
    const deposito = registro.deposito_origen_stock;
    if (!deposito) throw new Error("Registro sin depósito de origen.");
    const { data: stock, error } = await supabase.from('stock').select('*').eq('deposito', deposito).eq('tipo_producto', registro.metodo_fumigacion).single();
    if (error) throw new Error(`Stock no encontrado para ${registro.metodo_fumigacion} en ${deposito}.`);

    let nuevo_kg = parseFloat(stock.cantidad_kg) || 0;
    let nuevas_unidades = stock.cantidad_unidades ? parseInt(stock.cantidad_unidades) : 0;
    let kg_movido = 0;
    let unidades_movidas = null;

    if (registro.metodo_fumigacion === 'pastillas') {
        nuevas_unidades -= diferencia;
        unidades_movidas = Math.abs(diferencia);
        nuevo_kg = nuevas_unidades * 3 / 1000;
        kg_movido = unidades_movidas * 3 / 1000;
    } else {
        const kg_diferencia = (diferencia * DENSIDAD_LIQUIDO) / 1000;
        nuevo_kg -= kg_diferencia;
        kg_movido = Math.abs(kg_diferencia);
    }
    
    if (nuevo_kg < 0 || nuevas_unidades < 0) throw new Error("Ajuste resulta en stock negativo.");
    await supabase.from('stock').update({ cantidad_kg: nuevo_kg, cantidad_unidades: nuevas_unidades }).eq('id', stock.id);
    await supabase.from('historial_stock').insert({
        tipo_movimiento: diferencia > 0 ? 'extraccion' : 'adicion',
        deposito,
        tipo_producto: registro.metodo_fumigacion,
        cantidad_kg_movido: kg_movido,
        cantidad_unidades_movidas: unidades_movidas,
        descripcion: `Ajuste por edición de op. ID: ${registro.id.substring(0,8)}`,
        operacion_id: registro.operacion_original_id || registro.id
    });
}

// ===== FUNCIÓN ELIMINAR OPERACIÓN CORREGIDA =====
async function eliminarOperacionCompleta(originalId) {
    if (!confirm('¿SEGURO? Se eliminará toda la operación (incluyendo su historial) y se RESTAURARÁ el stock utilizado. Esta acción es irreversible.')) return;
    
    try {
        // 1. Encontrar todos los registros de la operación a eliminar.
        const { data: records, error: recordsError } = await supabase
            .from('operaciones')
            .select('id')
            .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`);
        if (recordsError) throw recordsError;
        
        const recordIds = records.map(r => r.id);

        // 2. Encontrar todos los movimientos de stock asociados a esos registros.
        const { data: history, error: historyErr } = await supabase
            .from('historial_stock')
            .select('*')
            .in('operacion_id', recordIds);
        if (historyErr) throw historyErr;

        // 3. Calcular el total de stock a restaurar por depósito y tipo de producto.
        const stockToRestore = {};
        for (const rec of history) {
            const key = `${rec.deposito}_${rec.tipo_producto}`;
            if (!stockToRestore[key]) {
                stockToRestore[key] = { kg: 0, unidades: 0 };
            }
            // Si fue un 'uso' o 'extraccion', lo sumamos para devolverlo. Si fue una 'adicion', lo restamos.
            const factor = rec.tipo_movimiento.includes('uso') || rec.tipo_movimiento.includes('extraccion') ? 1 : -1;
            stockToRestore[key].kg += (rec.cantidad_kg_movido || 0) * factor;
            stockToRestore[key].unidades += (rec.cantidad_unidades_movidas || 0) * factor;
        }

        // 4. Actualizar la tabla de stock con los valores restaurados.
        for (const key in stockToRestore) {
            const [deposito, tipo_producto] = key.split('_');
            const { kg, unidades } = stockToRestore[key];

            // Obtenemos el stock actual para sumarle lo que devolvemos.
            const { data: currentStock, error: fetchErr } = await supabase
                .from('stock')
                .select('*')
                .eq('deposito', deposito)
                .eq('tipo_producto', tipo_producto)
                .single();

            if (fetchErr) {
                console.warn(`No se encontró stock para ${key}, omitiendo restauración.`);
                continue; // Si no hay stock, no podemos restaurar nada.
            }
            
            await supabase.from('stock').update({
                cantidad_kg: (currentStock.cantidad_kg || 0) + kg,
                cantidad_unidades: (currentStock.cantidad_unidades || 0) + unidades
            }).eq('id', currentStock.id);
        }

        // 5. Finalmente, eliminar la operación original. 
        // Si configuraste el ON DELETE CASCADE, esto eliminará en cascada todos los registros hijos.
        const { error: deleteOpError } = await supabase.from('operaciones').delete().eq('id', originalId);
        if (deleteOpError) throw deleteOpError;

        alert('Operación eliminada y stock restaurado correctamente.');
        window.location.href = 'dashboard.html';

    } catch (error) {
        alert('ERROR al eliminar la operación: ' + error.message);
        console.error("Error en eliminarOperacionCompleta:", error);
    }
}






