import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
if (user.role !== 'admin' && user.role !== 'supervisor') {
    requireRole('supervisor');
}

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

    renderizarDetalles(container, operacion);
    setupActionButtons(operacionId);
});

function renderizarDetalles(container, operacion) {
    const unidadLabel = operacion.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    const tratamiento = operacion.tratamiento || 'N/A';
    const metodoCapitalizado = operacion.metodo_fumigacion ? operacion.metodo_fumigacion.charAt(0).toUpperCase() + operacion.metodo_fumigacion.slice(1) : 'N/A';

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Información General</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Cliente:</strong><br>${operacion.clientes?.nombre || 'N/A'}</div>
                    <div><strong>Depósito:</strong><br>${operacion.depositos?.nombre || 'N/A'} (${operacion.depositos?.tipo || 'N/A'})</div>
                    <div><strong>Mercadería:</strong><br>${operacion.mercaderias?.nombre || 'N/A'}</div>
                    <div><strong>Operario:</strong><br>${operacion.operario_nombre || 'N/A'}</div>
                    <div><strong>Fecha:</strong><br>${new Date(operacion.created_at).toLocaleString('es-AR')}</div>
                </div>
            </div>
            <div>
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Detalles del Tratamiento</h3>
                <div class="space-y-2 text-sm">
                    <p><strong>Método:</strong> ${metodoCapitalizado}</p>
                    <p><strong>Tratamiento:</strong> ${tratamiento}</p>
                    <p><strong>Cantidad Aplicada:</strong> ${(operacion.producto_usado_cantidad || 0).toLocaleString()} ${unidadLabel}</p>
                    <p><strong>Toneladas Tratadas:</strong> ${(operacion.toneladas || 0).toLocaleString()} tn</p>
                </div>
            </div>
        </div>
    `;
}

function setupActionButtons(operacionId) {
    document.getElementById('btnAprobar').addEventListener('click', async () => {
        await updateOperationStatus(operacionId, 'aprobado', document.getElementById('observacion').value);
    });
}

async function updateOperationStatus(operacionId, estado, observacion) {
    const { error } = await supabase
        .from('operaciones')
        .update({
            estado_aprobacion: estado,
            observacion_aprobacion: observacion,
            supervisor_id: getUser().id
        })
        .eq('id', operacionId);

    if (error) {
        alert('Error al actualizar la operación.');
        console.error(error);
    } else {
        alert('Operación actualizada correctamente.');
        window.location.href = 'dashboard.html';
    }
}
