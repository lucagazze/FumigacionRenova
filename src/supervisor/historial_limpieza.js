import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');
document.getElementById('header').innerHTML = renderHeader();

const historialContainer = document.getElementById('historial-container');

async function renderHistorialLimpieza() {
    const user = getUser();
    if (!user || !user.cliente_ids || user.cliente_ids.length === 0) {
        historialContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No tiene clientes asignados para ver historiales.</p>';
        return;
    }

    const { data: depositos, error: depositosError } = await supabase
        .from('depositos')
        .select('id')
        .in('cliente_id', user.cliente_ids);

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

    const { data: limpiezas, error } = await supabase
        .from('limpiezas')
        .select('*, depositos(id, nombre, tipo, clientes(id, nombre))')
        .in('deposito_id', depositoIds)
        .order('fecha_limpieza', { ascending: false });

    if (error) {
        console.error('Error al cargar el historial:', error);
        historialContainer.innerHTML = '<p class="text-red-500">No se pudo cargar el historial.</p>';
        return;
    }

    if (limpiezas.length === 0) {
        historialContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay registros de limpieza para los depósitos de sus clientes.</p>';
        return;
    }

    const tableHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depósito</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Limpieza</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vto. Garantía</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${limpiezas.map(l => {
                    const deposito = l.depositos;
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    const vtoGarantia = l.fecha_garantia_limpieza ? new Date(l.fecha_garantia_limpieza + 'T00:00:00') : null;
                    let garantiaClass = '';
                    if (vtoGarantia) {
                        garantiaClass = vtoGarantia < hoy ? 'text-red-500 font-bold' : 'text-green-600';
                    }
                    return `
                        <tr>
                            <td class="px-6 py-4">
                                <div class="text-sm font-medium text-gray-900">${deposito?.nombre || 'N/A'} (${deposito?.tipo || 'N/A'})</div>
                                <div class="text-sm text-gray-500">${deposito?.clientes?.nombre || 'Cliente no encontrado'}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-700">${new Date(l.fecha_limpieza + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                            <td class="px-6 py-4 text-sm ${garantiaClass}">${vtoGarantia ? vtoGarantia.toLocaleDateString('es-AR') : 'N/A'}</td>
                            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">${l.observaciones || '-'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    historialContainer.innerHTML = tableHTML;
}

document.addEventListener('DOMContentLoaded', renderHistorialLimpieza);
