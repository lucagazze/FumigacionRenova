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
    container.innerHTML = '<p class="text-center p-4 text-gray-500 col-span-full">Actualizando y cargando historial...</p>';

    // 1. Obtener todos los datos necesarios en paralelo para mayor eficiencia.
    const [
        { data: finalizadasIniciales, error: opsError },
        { data: todasLasLimpiezas, error: limpiezasError },
        { data: todosLosFinales, error: finalesError }
    ] = await Promise.all([
        supabase.from('operaciones').select('*').eq('estado', 'finalizada').eq('tipo_registro', 'inicial'),
        supabase.from('limpiezas').select('deposito_id, fecha_garantia_limpieza').order('fecha_limpieza', { ascending: false }),
        supabase.from('operaciones').select('operacion_original_id, created_at').eq('estado', 'finalizada').eq('tipo_registro', 'finalizacion')
    ]);

    if (opsError || limpiezasError || finalesError) {
        console.error("Error al obtener datos para la actualización:", opsError || limpiezasError || finalesError);
        container.innerHTML = '<p class="text-red-500 text-center p-4 col-span-full">Error al cargar datos para la actualización.</p>';
        return;
    }

    const updates = [];
    const limpiezasMap = new Map();
    // Optimizar la búsqueda de la última limpieza por depósito
    for (const limpieza of todasLasLimpiezas) {
        if (!limpiezasMap.has(limpieza.deposito_id)) {
            limpiezasMap.set(limpieza.deposito_id, limpieza.fecha_garantia_limpieza);
        }
    }

    // 2. Procesar cada operación finalizada para verificar su garantía.
    for (const op of finalizadasIniciales) {
        const registroFinal = todosLosFinales.find(f => f.operacion_original_id === op.id);
        if (!registroFinal) continue; // Omitir si no tiene registro de finalización

        // Condición 1: Duración de la operación
        const fechaInicio = new Date(op.created_at);
        const fechaFin = new Date(registroFinal.created_at);
        const duracionDias = (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24);
        const cumplePlazo = duracionDias <= 5;

        // Condición 2: Vigencia de la limpieza del depósito
        const fechaGarantiaLimpieza = limpiezasMap.get(op.deposito_id);
        let cumpleLimpieza = false;
        if (fechaGarantiaLimpieza) {
            const fechaVencLimpieza = new Date(fechaGarantiaLimpieza + 'T00:00:00');
            if (fechaFin <= fechaVencLimpieza) {
                cumpleLimpieza = true;
            }
        }

        // Determinar el nuevo estado de la garantía
        let con_garantia = false;
        let fecha_vencimiento_garantia = null;
        if (cumplePlazo && cumpleLimpieza) {
            con_garantia = true;
            let vencimiento = new Date(fechaFin);
            vencimiento.setDate(vencimiento.getDate() + 40);
            fecha_vencimiento_garantia = vencimiento.toISOString().split('T')[0];
        }

        // Si el estado de la garantía ha cambiado, se prepara una actualización.
        if (op.con_garantia !== con_garantia || op.fecha_vencimiento_garantia !== fecha_vencimiento_garantia) {
            updates.push(
                supabase
                    .from('operaciones')
                    .update({ con_garantia, fecha_vencimiento_garantia })
                    .or(`id.eq.${op.id},operacion_original_id.eq.${op.id}`)
            );
        }
    }

    // 3. Ejecutar todas las actualizaciones necesarias.
    if (updates.length > 0) {
        await Promise.all(updates);
    }
    
    // 4. Obtener los datos actualizados para mostrar en la página.
    const { data: operations, error } = await supabase
        .from('operaciones')
        .select('id, created_at, updated_at, con_garantia, fecha_vencimiento_garantia, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)')
        .eq('estado', 'finalizada')
        .eq('tipo_registro', 'inicial')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error al obtener operaciones finalizadas:", error);
        container.innerHTML = '<p class="text-red-500 text-center p-4 col-span-full">Error al cargar el historial.</p>';
        return;
    }

    if (operations.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 p-4 col-span-full">No hay operaciones finalizadas.</p>';
        return;
    }

    // 5. Renderizar las tarjetas con la información ya actualizada.
    container.innerHTML = operations.map(op => {
        const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
        const fechaInicio = op.created_at ? new Date(op.created_at).toLocaleDateString('es-AR') : 'N/A';
        const fechaFin = op.updated_at ? new Date(op.updated_at).toLocaleDateString('es-AR') : 'N/A';

        let garantiaHtml = '';
        if (op.con_garantia) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(op.fecha_vencimiento_garantia + 'T00:00:00');
            const vencimientoStr = vencimiento.toLocaleDateString('es-AR');
            if (vencimiento >= hoy) {
                garantiaHtml = `
                    <div class="flex items-center gap-2" title="Garantía vigente hasta ${vencimientoStr}">
                        <span class="material-icons text-lg text-green-600">check_circle</span>
                        <span>Garantía: <strong class="text-green-700">Vigente</strong></span>
                    </div>`;
            } else {
                garantiaHtml = `
                    <div class="flex items-center gap-2" title="Garantía vencida el ${vencimientoStr}">
                        <span class="material-icons text-lg text-yellow-600">warning</span>
                        <span>Garantía: <strong class="text-yellow-700">Vencida</strong></span>
                    </div>`;
            }
        } else {
            garantiaHtml = `
                <div class="flex items-center gap-2" title="La operación no cumplió los requisitos para la garantía">
                    <span class="material-icons text-lg text-red-600">cancel</span>
                    <span>Garantía: <strong class="text-red-700">No incluida</strong></span>
                </div>`;
        }

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
                ${garantiaHtml}
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