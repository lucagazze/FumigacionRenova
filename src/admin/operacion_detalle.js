import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();

    const btnVolver = document.getElementById('btnVolver');
    const btnEliminar = document.getElementById('btnEliminar');
    const resumenContainer = document.getElementById('resumenOperacion');
    const checklistItemsContainer = document.getElementById('checklistItems');
    
    const urlParams = new URLSearchParams(window.location.search);
    const operacionId = urlParams.get('id');

    if (!operacionId) {
        resumenContainer.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
        return;
    }

    // 1. Obtener el registro actual para encontrar el ID original
    const { data: registroActual, error: registroError } = await supabase
        .from('operaciones')
        .select('id, operacion_original_id')
        .eq('id', operacionId)
        .single();

    if (registroError) {
        resumenContainer.innerHTML = '<p class="text-red-500">Error al cargar la operación.</p>';
        console.error(registroError);
        return;
    }

    const originalId = registroActual.operacion_original_id || registroActual.id;

    // 2. Obtener todos los datos de la operación, incluyendo el checklist
    const { data: opData, error: opError } = await supabase
        .from('operaciones')
        .select(`
            *, 
            clientes(nombre), 
            depositos(nombre, tipo), 
            mercaderias(nombre),
            checklist_items(*)
        `)
        .eq('id', originalId)
        .single();

    if (opError) {
        resumenContainer.innerHTML = '<p class="text-red-500">Error al cargar los detalles de la operación.</p>';
        console.error(opError);
        return;
    }

    renderResumen(opData, resumenContainer);
    renderChecklist(opData.checklist_items, checklistItemsContainer);

    btnVolver.addEventListener('click', () => window.history.back());
    btnEliminar.addEventListener('click', () => eliminarOperacion(originalId));
});

function renderResumen(op, container) {
    container.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800 mb-4">Resumen General</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p><strong>Cliente:</strong> ${op.clientes?.nombre || 'N/A'}</p>
            <p><strong>Depósito:</strong> ${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</p>
            <p><strong>Mercadería:</strong> ${op.mercaderias?.nombre || 'N/A'}</p>
            <p><strong>Método:</strong> ${op.metodo_fumigacion?.charAt(0).toUpperCase() + op.metodo_fumigacion?.slice(1) || 'N/A'}</p>
            <p><strong>Estado:</strong> <span class="font-bold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</span></p>
            <p><strong>Operario Principal:</strong> ${op.operario_nombre || 'N/A'}</p>
        </div>`;
}

function renderChecklist(items, container) {
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No se encontraron ítems en el checklist para esta operación.</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="bg-gray-50 p-3 rounded-lg border flex justify-between items-center">
            <div class="flex items-center">
                <span class="material-icons ${item.completado ? 'text-green-500' : 'text-gray-400'}">
                    ${item.completado ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span class="ml-3 font-medium text-gray-700">${item.item}</span>
            </div>
            ${item.imagen_url 
                ? `<a href="${item.imagen_url}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                        <span class="material-icons text-base">image</span> Ver Foto
                   </a>` 
                : '<span class="text-xs text-gray-400">Sin foto</span>'
            }
        </div>
    `).join('');
}

async function eliminarOperacion(operacionId) {
    if (confirm('¿Está REALMENTE seguro de que desea eliminar esta operación? Se borrarán TODOS sus registros asociados (aplicaciones, movimientos, checklist, etc.) de forma permanente. Esta acción no se puede deshacer.')) {
        
        // Gracias al 'ON DELETE CASCADE' en la base de datos, solo necesitamos borrar la operación original.
        const { error } = await supabase
            .from('operaciones')
            .delete()
            .eq('id', operacionId);

        if (error) {
            alert('Error al eliminar la operación: ' + error.message);
            console.error(error);
        } else {
            alert('Operación y todos sus registros asociados han sido eliminados correctamente.');
            window.location.href = 'dashboard.html';
        }
    }
}