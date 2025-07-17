import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');
document.getElementById('header').innerHTML = renderHeader();

const historialContainer = document.getElementById('historial-container');

async function renderHistorialLimpieza() {
    const user = getUser();
    if (!user || !user.cliente_asignado_id) {
        historialContainer.innerHTML = '<p class="text-red-500">No se pudo determinar el cliente asignado.</p>';
        return;
    }

    // 1. Obtener los depósitos (silos/celdas) del cliente asignado al supervisor
    const { data: depositos, error: depositosError } = await supabase
        .from('depositos')
        .select('id, nombre, tipo')
        .eq('cliente_id', user.cliente_asignado_id);

    if (depositosError) {
        console.error('Error fetching depositos:', depositosError);
        historialContainer.innerHTML = '<p class="text-red-500">Error al cargar los depósitos.</p>';
        return;
    }

    if (depositos.length === 0) {
        historialContainer.innerHTML = '<p>No hay depósitos asignados a este cliente.</p>';
        return;
    }

    const depositoIds = depositos.map(d => d.id);

    // 2. Obtener el historial de limpieza para esos depósitos
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
        historialContainer.innerHTML = '<p>No hay registros de limpieza para los depósitos de este cliente.</p>';
        return;
    }

    // 3. Renderizar la tabla
    const tableHtml = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
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