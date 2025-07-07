import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');

async function renderPendientes() {
    const container = document.getElementById('pendientes-container');
    const user = getUser();
    container.innerHTML = `<p class="text-center p-4">Buscando operaciones pendientes...</p>`;

    if (!user.cliente_ids || user.cliente_ids.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 p-4">No tiene clientes asignados.</p>`;
        return;
    }

    const { data: operaciones, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .in('cliente_id', user.cliente_ids)
        .eq('estado_aprobacion', 'pendiente')
        .neq('tipo_registro', 'muestreo') // No mostrar muestreos
        .order('created_at', { ascending: true });
        
    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error al cargar operaciones.</p>`;
        return;
    }
    if (operaciones.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay operaciones pendientes de aprobación.</p>`;
        return;
    }

    container.innerHTML = operaciones.map(op => {
        const unidad = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
        return `
        <a href="operacion_confirmar.html?id=${op.id}" class="block bg-white p-4 rounded-lg shadow border border-yellow-300 transition hover:shadow-md hover:border-yellow-500">
            <div class="flex flex-wrap justify-between items-center gap-2">
                <div>
                    <p class="text-sm text-gray-500">${new Date(op.created_at).toLocaleString('es-AR')}</p>
                    <h3 class="font-bold text-lg">${op.clientes.nombre} - Depósito ${op.depositos.nombre}</h3>
                    <p class="text-sm"><b>${op.operario_nombre}</b> aplicó <b>${(op.producto_usado_cantidad ?? 0).toLocaleString()} ${unidad}</b> en <b>${(op.toneladas ?? 0).toLocaleString()} tn</b>.</p>
                </div>
                <div class="flex items-center gap-2 text-blue-600 font-semibold">
                    <span>Revisar y Aprobar</span>
                    <span class="material-icons">arrow_forward</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    await renderPendientes();
});