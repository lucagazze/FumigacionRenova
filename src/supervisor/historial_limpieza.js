import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');
document.getElementById('header').innerHTML = renderHeader();

const historialContainer = document.getElementById('historial-container');

async function renderHistorialLimpieza() {
    const user = getUser();
    if (!user) {
        historialContainer.innerHTML = '<p class="text-red-500">Error: No se pudo identificar al supervisor.</p>';
        return;
    }

    // 1. Obtener los IDs de los clientes asignados al supervisor
    const { data: clientesAsignados, error: clientesError } = await supabase
        .from('supervisor_clientes')
        .select('cliente_id')
        .eq('supervisor_id', user.id);

    if (clientesError) {
        console.error('Error fetching supervisor clients:', clientesError);
        historialContainer.innerHTML = '<p class="text-red-500">No se pudieron cargar los clientes asignados.</p>';
        return;
    }

    const clienteIds = clientesAsignados.map(c => c.cliente_id);
    if (clienteIds.length === 0) {
        historialContainer.innerHTML = '<p>No tiene clientes asignados para ver historiales.</p>';
        return;
    }

    // 2. Obtener los depósitos de esos clientes
    const { data: depositos, error: depositosError } = await supabase
        .from('depositos')
        .select('id, nombre, tipo, clientes(nombre)')
        .in('cliente_id', clienteIds);

    if (depositosError) {
        console.error('Error fetching depositos:', depositosError);
        historialContainer.innerHTML = '<p class="text-red-500">Error al cargar los depósitos.</p>';
        return;
    }
    
    const depositoIds = depositos.map(d => d.id);
    if (depositoIds.length === 0) {
        historialContainer.innerHTML = '<p>No se encontraron depósitos para sus clientes asignados.</p>';
        return;
    }

    // 3. Obtener el historial de limpieza de esos depósitos
    const { data: limpiezas, error: limpiezasError } = await supabase
        .from('limpiezas')
        .select('*')
        .in('deposito_id', depositoIds)
        .order('fecha_limpieza', { ascending: false });

    if (limpiezasError) {
        console.error('Error fetching limpiezas:', limpiezasError);
        historialContainer.innerHTML = '<p class="text-red-500">Error al cargar el historial de limpieza.</p>';
        return;
    }

    if (limpiezas.length === 0) {
        historialContainer.innerHTML = '<p>No hay registros de limpieza para los depósitos de sus clientes.</p>';
        return;
    }

    // 4. Renderizar la tabla con los resultados
    const tableHtml = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depósito</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Limpieza</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento Garantía</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${limpiezas.map(limpieza => {
                    const deposito = depositos.find(d => d.id === limpieza.deposito_id);
                    return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">${deposito ? deposito.clientes.nombre : 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${deposito ? deposito.nombre : 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${deposito ? (deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)) : 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${new Date(limpieza.fecha_limpieza).toLocaleDateString()}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${limpieza.fecha_garantia_limpieza ? new Date(limpieza.fecha_garantia_limpieza).toLocaleDateString() : 'N/A'}</td>
                            <td class="px-6 py-4">${limpieza.observaciones || ''}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    historialContainer.innerHTML = tableHtml;
}

document.addEventListener('DOMContentLoaded', renderHistorialLimpieza);