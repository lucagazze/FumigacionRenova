import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('header').innerHTML = renderHeader();
    renderFinishedOperations();
});

async function renderFinishedOperations() {
    const container = document.getElementById('historial-container');
    container.innerHTML = '<p class="text-center p-4 text-gray-500 col-span-full">Buscando operaciones finalizadas...</p>';

    // --- CAMBIO: Se añade 'created_at' a la consulta para obtener la fecha de inicio ---
    const { data: operations, error } = await supabase
        .from('operaciones')
        .select('id, created_at, updated_at, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)')
        .eq('estado', 'finalizada')
        .eq('tipo_registro', 'inicial')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error fetching finished operations", error);
        container.innerHTML = '<p class="text-red-500 text-center p-4 col-span-full">Error al cargar el historial.</p>';
        return;
    }

    if (operations.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 p-4 col-span-full">No hay operaciones finalizadas.</p>';
        return;
    }

    container.innerHTML = operations.map(op => {
        const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
        // --- CAMBIO: Se formatean ambas fechas ---
        const fechaInicio = op.created_at ? new Date(op.created_at).toLocaleDateString('es-AR') : 'N/A';
        const fechaFin = op.updated_at ? new Date(op.updated_at).toLocaleDateString('es-AR') : 'N/A';

        return `
        <a href="operacion_detalle.html?id=${op.id}" class="block bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition hover:shadow-xl hover:border-blue-500 cursor-pointer">
            <div class="flex justify-between items-start mb-4">
                <h3 class="font-bold text-xl text-gray-800">${op.clientes?.nombre || 'N/A'}</h3>
                <span class="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800">
                    Finalizada
                </span>
            </div>
            <div class="space-y-2 text-sm text-gray-700">
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">store</span><span>Depósito: <strong class="text-gray-900">${depositoInfo}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">grass</span><span>Mercadería: <strong class="text-gray-900">${op.mercaderias?.nombre || 'N/A'}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">event</span><span>Fecha Inicio: <strong class="text-gray-900">${fechaInicio}</strong></span></div>
                <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">event_available</span><span>Fecha Fin: <strong class="text-gray-900">${fechaFin}</strong></span></div>
            </div>
             <div class="border-t border-gray-200 mt-6 pt-4 text-center">
                <div class="font-semibold text-blue-600 flex items-center justify-center w-full gap-2">
                    <span>Ver Resumen Completo</span>
                    <span class="material-icons">arrow_forward</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}