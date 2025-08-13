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

    let limpiezaHtml = '<div><strong>Vigencia Limpieza:</strong><br><span class="text-gray-500">Sin registros</span></div>';
    if (limpieza) {
        const fechaGarantia = new Date(limpieza.fecha_garantia_limpieza + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const estaVigente = fechaGarantia >= hoy;
        const colorClass = estaVigente ? 'text-green-600' : 'text-red-600';
        limpiezaHtml = `<div><strong>Vigencia Limpieza:</strong><br><span class="font-semibold ${colorClass}">${fechaGarantia.toLocaleDateString('es-AR')}</span></div>`;
    }

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

    let garantiaHtml = '';
    if (opBase.estado === 'finalizada') {
        if (opBase.con_garantia && opBase.fecha_vencimiento_garantia) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(opBase.fecha_vencimiento_garantia + 'T00:00:00');
            
            if (vencimiento >= hoy) {
                garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-green-600 flex items-center gap-1"><span class="material-icons text-base">check_circle</span>Vigente</span></div>`;
            } else {
                garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-yellow-600 flex items-center gap-1"><span class="material-icons text-base">warning</span>Vencida</span></div>`;
            }
        } else {
            garantiaHtml = `<div><strong>Garantía:</strong><br><span class="font-semibold text-red-600 flex items-center gap-1"><span class="material-icons text-base">cancel</span>No Incluida</span></div>`;
        }
    }
    
    const algunaTareaAprobada = allRecords.some(r => r.estado_aprobacion === 'aprobado');
    const eliminarBtnHtml = !algunaTareaAprobada ? `
        <button id="btnEliminarOperacionCompleta" class="btn btn-danger flex items-center gap-2">
            <span class="material-icons text-base">delete_forever</span>
            <span>Eliminar Operación Completa</span>
        </button>
    ` : '';

    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center gap-4">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
            ${eliminarBtnHtml}
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
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-800">Línea de Tiempo de la Operación</h3>
                <label for="toggleMuestreos" class="flex items-center cursor-pointer">
                    <span id="toggleMuestreosLabel" class="mr-3 text-sm font-medium text-gray-900">Ocultar Muestreos</span>
                    <div class="relative">
                        <input type="checkbox" id="toggleMuestreos" class="sr-only peer">
                        <div class="block bg-gray-200 w-14 h-8 rounded-full peer-checked:bg-green-500 transition"></div>
                        <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform transform peer-checked:translate-x-full"></div>
                    </div>
                </label>
            </div>
            <div class="space-y-2">
                ${allRecords.map(registro => {
                    let detalle = '';
                    let actionButtons = '';
                    let estadoBadge = '';
                    const isRechazado = registro.estado_aprobacion === 'rechazado';
                    const isMuestreo = registro.tipo_registro === 'muestreo';
                    let itemClass = isRechazado ? 'line-through text-gray-400' : '';
                    if (isMuestreo) itemClass += ' registro-muestreo';

                    if (registro.tipo_registro !== 'muestreo') {
                        switch (registro.estado_aprobacion) {
                            case 'aprobado':
                                estadoBadge = `<span class="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800 ml-2">Aprobado</span>`;
                                break;
                            case 'pendiente':
                                estadoBadge = `<span class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 ml-2">Pendiente</span>`;
                                break;
                            case 'rechazado':
                                estadoBadge = `<span class="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-800 ml-2">Rechazado</span>`;
                                break;
                        }
                    }

                    if (registro.tipo_registro !== 'inicial' && registro.estado_aprobacion !== 'aprobado') {
                        actionButtons += `<button class="btn-delete-registro p-1" data-registro-id="${registro.id}" title="Eliminar"><span class="material-icons text-red-500 hover:text-red-700">delete</span></button>`;
                    }
                    if (registro.observacion_aprobacion) {
                        actionButtons += `<button class="btn-show-observacion p-1" data-observacion="${registro.observacion_aprobacion}" title="Ver observación"><span class="material-icons text-yellow-500 hover:text-yellow-700">comment</span></button>`;
                    }

                    let finalHtml;

                    switch(registro.tipo_registro) {
                        case 'inicial': 
                            detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; 
                            break;
                        case 'producto': 
                            const tratamientoProducto = registro.tratamiento ? `(${registro.tratamiento})` : '';
                            detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${registro.producto_usado_cantidad?.toLocaleString() || 0} ${unidadLabel}</b> en ${registro.toneladas?.toLocaleString() || 0} tn. <span class="font-semibold">${tratamientoProducto}</span>`; 
                            break;
                        case 'muestreo': 
                            detalle = `<b>${registro.operario_nombre}</b> registró un muestreo.`; 
                            actionButtons += `<button class="btn-ver-muestreo p-1" data-muestreo-id="${registro.id}" title="Ver detalles del muestreo"><span class="material-icons text-blue-500 hover:text-blue-700">visibility</span></button>`;
                            
                            const muestreoData = registro.muestreos && registro.muestreos.length > 0 ? registro.muestreos[0] : {};
                            const tieneArchivos = muestreoData.media_url && muestreoData.media_url.length > 0;
                            let muestreoDetailsHTML = '';
                            if (tieneArchivos || muestreoData.observacion) {
                                muestreoDetailsHTML = `
                                    <div id="muestreo-details-${registro.id}" class="hidden p-4 mt-2 bg-gray-50 rounded-lg border">
                                        <p class="mb-3 text-gray-700 whitespace-pre-wrap">${muestreoData.observacion || '<em>Sin observación.</em>'}</p>
                                        ${tieneArchivos ? `
                                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                ${muestreoData.media_url.map(url => `
                                                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="block group relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                                                        <img src="${url}" alt="Archivo de muestreo" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                                                    </a>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            finalHtml = `<div class="p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm ${itemClass}">
                                            <div class="flex items-center justify-between">
                                                <div><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}</div>
                                                <div class="flex-shrink-0 ml-4 flex items-center gap-2">${actionButtons}</div>
                                            </div>
                                            ${muestreoDetailsHTML}
                                        </div>`;
                            break;
                        case 'finalizacion': 
                            detalle = `Operación finalizada por <b>${registro.operario_nombre_finalizacion || registro.operario_nombre}</b>.`; 
                            break;
                    }

                    if (finalHtml) return finalHtml;

                    return `<div class="flex items-center justify-between text-sm p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm ${itemClass}">
                                <div><b>${new Date(registro.created_at).toLocaleString('es-AR')}:</b> ${detalle}${estadoBadge}</div>
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
        const deleteTarget = e.target.closest('.btn-delete-registro');
        const deleteOpTarget = e.target.closest('#btnEliminarOperacionCompleta');
        const muestreoBtn = e.target.closest('.btn-ver-muestreo');
        const obsBtn = e.target.closest('.btn-show-observacion');

        if (deleteTarget) {
            const registroId = deleteTarget.dataset.registroId;
            const registro = allRecords.find(r => r.id === registroId);
            if(registro) {
                if (registro.tipo_registro === 'finalizacion') {
                    await revertirFinalizacion(registro);
                } else {
                    if (confirm('¿Seguro que deseas borrar este registro?')) {
                        await eliminarRegistro(registro, container, opBase, allRecords, limpieza);
                    }
                }
            }
        } else if (deleteOpTarget) {
            await eliminarOperacionCompleta(opBase.id);
        } else if (muestreoBtn) {
            const muestreoId = muestreoBtn.dataset.muestreoId;
            const detailsContainer = document.getElementById(`muestreo-details-${muestreoId}`);
            if (detailsContainer) {
                detailsContainer.classList.toggle('hidden');
            }
        } else if (obsBtn) {
            const observacion = obsBtn.dataset.observacion;
            mostrarObservacionModal(observacion);
        }
    });
// --- MODAL PARA OBSERVACIÓN ---
function mostrarObservacionModal(observacion) {
    let modal = document.getElementById('modal-observacion');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-observacion';
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
                    <button id="cerrar-modal-observacion" class="absolute top-2 right-2 text-gray-500 hover:text-gray-700"><span class="material-icons">close</span></button>
                    <h2 class="text-lg font-bold mb-2">Observación</h2>
                    <div id="texto-observacion" class="text-gray-800 whitespace-pre-line"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.querySelector('#texto-observacion').textContent = observacion || 'Sin observación.';
    modal.style.display = 'block';
    modal.querySelector('#cerrar-modal-observacion').onclick = () => {
        modal.style.display = 'none';
    };
}
// --- FUNCION PARA ELIMINAR REGISTRO PENDIENTE ---
async function eliminarRegistro(registro, container, opBase, allRecords, limpieza) {
    // Elimina el registro de la base de datos
    const { error } = await supabase.from('operaciones').delete().eq('id', registro.id);
    if (error) {
        alert('Error al eliminar el registro: ' + error.message);
        return;
    }
    // Elimina el registro del array local y vuelve a renderizar la página
    const idx = allRecords.findIndex(r => r.id === registro.id);
    if (idx !== -1) {
        allRecords.splice(idx, 1);
    }
    renderizarPagina(container, opBase, allRecords, limpieza);
}

    const toggleMuestreos = document.getElementById('toggleMuestreos');
    const toggleLabel = document.getElementById('toggleMuestreosLabel');
    toggleMuestreos.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const muestreoRecords = container.querySelectorAll('.registro-muestreo');
        muestreoRecords.forEach(record => {
            record.classList.toggle('hidden', isChecked);
        });
        toggleLabel.textContent = isChecked ? 'Mostrar Muestreos' : 'Ocultar Muestreos';
    });
}