import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
if (user.role !== 'admin' && user.role !== 'supervisor') {
    requireRole('supervisor');
}

let operacionParaConfirmar = {}; // Variable para guardar la operación actual

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    const container = document.getElementById('detalle-container');
    const urlParams = new URLSearchParams(window.location.search);
    const operacionId = urlParams.get('id');

    if (!operacionId) {
        container.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
        return;
    }

    const { data: operacion, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)`)
        .eq('id', operacionId)
        .single();

    if (error || !operacion) {
        container.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        return;
    }
    
    operacionParaConfirmar = operacion;
    renderizarDetalles(container, operacion);
    setupActionButtons(operacion.id);
});

function renderizarDetalles(container, operacion) {
    const unidadLabel = operacion.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamiento = operacion.tratamiento || 'N/A';
    const tipoRegistro = operacion.tipo_registro.charAt(0).toUpperCase() + operacion.tipo_registro.slice(1);

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Revisión de ${tipoRegistro}</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Cliente:</strong><br>${operacion.clientes?.nombre || 'N/A'}</div>
                    <div><strong>Depósito:</strong><br>${operacion.depositos?.nombre || 'N/A'} (${operacion.depositos?.tipo || 'N/A'})</div>
                    <div><strong>Mercadería:</strong><br>${operacion.mercaderias?.nombre || 'N/A'}</div>
                    <div><strong>Operario:</strong><br>${operacion.operario_nombre || 'N/A'}</div>
                    <div><strong>Fecha:</strong><br>${new Date(operacion.created_at).toLocaleString('es-AR')}</div>
                </div>
            </div>
            ${operacion.tipo_registro === 'producto' ? `
            <div>
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Detalles del Tratamiento</h3>
                <div class="space-y-2 text-sm">
                    <p><strong>Tratamiento:</strong> ${tratamiento}</p>
                    <p><strong>Cantidad Aplicada:</strong> ${(operacion.producto_usado_cantidad || 0).toLocaleString()} ${unidadLabel}</p>
                    <p><strong>Toneladas Tratadas:</strong> ${(operacion.toneladas || 0).toLocaleString()} tn</p>
                </div>
            </div>
            ` : ''}
             ${operacion.tipo_registro === 'finalizacion' ? `
            <div class="md:col-span-2">
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Observación de Finalización</h3>
                <p class="text-sm p-3 bg-gray-50 rounded-md">${operacion.observacion_finalizacion || '<em>Sin observaciones.</em>'}</p>
            </div>
             ` : ''}
        </div>
    `;
}

function setupActionButtons(operacionId) {
    document.getElementById('btnAprobar').addEventListener('click', async () => {
        await updateOperationStatus(operacionId, 'aprobado', document.getElementById('observacion').value);
    });
}

async function updateOperationStatus(operacionId, estado, observacion) {
    // 1. Actualiza el registro actual
    const { error } = await supabase
        .from('operaciones')
        .update({
            estado_aprobacion: estado,
            observacion_aprobacion: observacion,
            supervisor_id: getUser().id,
            fecha_aprobacion: new Date().toISOString()
        })
        .eq('id', operacionId);

    if (error) {
        alert('Error al actualizar el registro: ' + error.message);
        return;
    }

    // 2. --- CORRECCIÓN CLAVE ---
    // Si el registro que se está aprobando es una 'finalizacion',
    // actualizamos el estado de toda la operación a 'finalizada'.
    if (operacionParaConfirmar.tipo_registro === 'finalizacion') {
        const originalId = operacionParaConfirmar.operacion_original_id || operacionParaConfirmar.id;
        
        const { error: updateStateError } = await supabase
            .from('operaciones')
            .update({ estado: 'finalizada' })
            .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`);

        if (updateStateError) {
            alert("Se aprobó la finalización, pero hubo un error al actualizar el estado general de la operación.");
            return;
        }
    }

    alert('Operación actualizada correctamente.');
    window.location.href = 'dashboard.html';
}