import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
// Permite el acceso a 'admin' y 'supervisor'
if (user.role !== 'admin' && user.role !== 'supervisor') {
    requireRole('supervisor');
}

let originalId; // Hacemos el ID original accesible en un scope más amplio

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
    originalId = registroActual.operacion_original_id || registroActual.id;

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
    renderMuestreos(document.getElementById('muestreos-container'), allRecords.filter(r => r.tipo_registro === 'muestreo'));

    document.getElementById('btnVolver').addEventListener('click', () => {
        window.history.back();
    });
});


// --- RENDERIZADO DE LA PÁGINA ---
function renderizarPagina(container, opBase, allRecords) {
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
    const metodoCapitalizado = opBase.metodo_fumigacion ? opBase.metodo_fumigacion.charAt(0).toUpperCase() + opBase.metodo_fumigacion.slice(1) : 'N/A';


    const finalizarButtonHTML = opBase.estado === 'en curso' ? `
        <button id="btnFinalizarOperacion" class="btn btn-primary bg-red-600 hover:bg-red-700">
            <span class="material-icons">check_circle</span>
            Finalizar Operación
        </button>
    ` : '';

    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center gap-4">
            <h3 class="text-xl font-bold text-gray-800">Resumen General</h3>
            ${finalizarButtonHTML}
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 mt-4 bg-gray-50 rounded-lg border">
            <div><strong>Cliente:</strong><br>${opBase.clientes?.nombre || 'N/A'}</div>
            <div><strong>Depósito:</strong><br>${opBase.depositos?.nombre || 'N/A'} (${opBase.depositos?.tipo || 'N/A'})</div>
            <div><strong>Mercadería:</strong><br>${opBase.mercaderias?.nombre || 'N/A'}</div>
            <div><strong>Método:</strong><br>${metodoCapitalizado}</div>
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
                    let actionButtons = '';

                    const isRechazado = registro.estado_aprobacion === 'rechazado';
                    const itemClass = isRechazado ? 'line-through text-gray-400' : '';

                    if (user.role === 'supervisor' && registro.estado_aprobacion === 'pendiente' && registro.tipo_registro !== 'muestreo') {
                        actionButtons += `<a href="../supervisor/operacion_confirmar.html?id=${registro.id}" class="btn bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600">Revisar</a>`;
                    }

                    if (registro.observacion_aprobacion) {
                        actionButtons += `<button class="btn-show-observacion p-1" data-observacion="${registro.observacion_aprobacion}" title="Ver observación"><span class="material-icons text-yellow-500 hover:text-yellow-700">comment</span></button>`;
                    }

                    switch(registro.tipo_registro) {
                        case 'inicial': 
                            detalle = `Operación iniciada por <b>${registro.operario_nombre}</b>.`; 
                            break;
                        case 'producto': 
                            const tratamientoProducto = registro.tratamiento ? `(${registro.tratamiento})` : '';
                            detalle = `<b>${registro.operario_nombre}</b> aplicó <b>${(registro.producto_usado_cantidad || 0).toLocaleString()} ${unidadLabel}</b> en ${(registro.toneladas || 0).toLocaleString()} tn. <span class="font-semibold">${tratamientoProducto}</span>`;
                            break;
                        case 'muestreo':
                            const muestreoData = registro.muestreos && registro.muestreos.length > 0 ? registro.muestreos[0] : {};
                            const tieneArchivos = muestreoData.media_url && muestreoData.media_url.length > 0;
                            detalle = `<b>${registro.operario_nombre}</b> registró un muestreo. <button class="text-blue-600 hover:underline btn-ver-muestreo" data-muestreo-id="${registro.id}">Ver detalles</button>`;
                            
                            let muestreoDetailsHTML = '';
                            if (tieneArchivos || muestreoData.observacion) {
                                muestreoDetailsHTML = `
                                    <div id="muestreo-details-${registro.id}" class="hidden p-4 mt-2 bg-gray-50 rounded-lg border">
                                        <p class="mb-3">${muestreoData.observacion || '<em>Sin observación.</em>'}</p>
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
        
                            return `<div class="text-sm p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm ${itemClass}">
                                        <div class="flex items-center justify-between">
                                            <div><b>${new Date(registro.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}:</b> ${detalle}</div>
                                            <div class="flex-shrink-0 ml-4 flex items-center gap-2">${actionButtons}</div>
                                        </div>
                                        ${muestreoDetailsHTML}
                                    </div>`;
                        case 'finalizacion': 
                            detalle = `Operación finalizada por <b>${registro.operario_nombre}</b>.`; 
                            break;
                    }

                    return `<div class="flex items-center justify-between text-sm p-3 bg-white border-l-4 border-gray-300 rounded-r-lg shadow-sm ${itemClass}">
                                <div><b>${new Date(registro.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}:</b> ${detalle}</div>
                                <div class="flex-shrink-0 ml-4 flex items-center gap-2">${actionButtons}</div>
                            </div>`;
                }).join('')}
            </div>
        </div>
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Checklist de Tareas</h3>
            <div id="checklist-container" class="space-y-3">
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

    if (opBase.estado === 'en curso') {
        document.getElementById('btnFinalizarOperacion').addEventListener('click', () => {
            if (originalId) {
                window.location.href = `finalizar.html?id=${originalId}`;
            } else {
                alert("No se pudo identificar la operación a finalizar.");
            }
        });
    }

    container.addEventListener('click', (e) => {
        const obsBtn = e.target.closest('.btn-show-observacion');
        if (obsBtn) {
            const observacion = obsBtn.dataset.observacion;
            renderObservacionModal(observacion);
        }

        const muestreoBtn = e.target.closest('.btn-ver-muestreo');
        if (muestreoBtn) {
            const muestreoId = muestreoBtn.dataset.muestreoId;
            const detailsContainer = document.getElementById(`muestreo-details-${muestreoId}`);
            if (detailsContainer) {
                detailsContainer.classList.toggle('hidden');
            }
        }
    });
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

function renderMuestreos(container, muestreos) {
    if (!muestreos || muestreos.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="border-t pt-6 mt-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">Muestreos Realizados</h3>
            <div class="space-y-6">
            </div>
        </div>
    `;
}
