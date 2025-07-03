import { supabase } from './supabase.js';

export async function getOperaciones() {
  const { data, error } = await supabase
    .from('operaciones')
    .select(`
      *, 
      clientes(nombre), 
      depositos(
        nombre, 
        tipo,
        capacidad_toneladas, 
        limpiezas(fecha_garantia_limpieza)
      ), 
      mercaderias(nombre), 
      movimientos(observacion, media_url)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching operaciones:', error);
    return [];
  }
  return data;
}

export async function renderOperaciones(container, operaciones, isAdmin = false) {
  if (!operaciones || operaciones.length === 0) {
      container.innerHTML = '<p class="text-center p-8 text-gray-500">No se encontraron operaciones.</p>';
      return;
  }
  
  await renderOperacionesDesplegables(container, operaciones, isAdmin);
}

async function renderOperacionesDesplegables(container, operaciones, isAdmin) {
    const operationSummaries = new Map();

    for (const op of operaciones) {
        const key = op.operacion_original_id || op.id;

        if (!operationSummaries.has(key)) {
            operationSummaries.set(key, {
                totalToneladas: 0,
                totalProducto: 0,
                startDate: null,
                metodo: null,
                mercaderia: null,
                tratamiento: null,
            });
        }

        const summary = operationSummaries.get(key);

        if (op.toneladas) {
            summary.totalToneladas += op.toneladas;
        }
        if (op.producto_usado_cantidad) {
            summary.totalProducto += op.producto_usado_cantidad;
        }

        if (op.tipo_registro === 'inicial') {
            summary.startDate = op.created_at;
            summary.metodo = op.metodo_fumigacion;
            summary.mercaderia = op.mercaderias?.nombre || 'N/A';
        }
        
        if (op.tipo_registro === 'producto' && op.tratamiento) {
            summary.tratamiento = op.tratamiento;
        }
    }
    
    const headers = ["Fecha/Hora", "Tipo", "Cliente", "Operario", "Depósito", "Estado"];
    if (isAdmin) headers.push("Garantía", "Acciones");
    headers.push("");

    const tableHeaders = headers.map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    const tableRows = operaciones.map(op => {
        let tipoText, tipoClass;
        switch(op.tipo_registro) {
            case 'inicial': tipoText = 'Inicio'; tipoClass = 'bg-green-100 text-green-800'; break;
            case 'producto': tipoText = 'Aplicación'; tipoClass = 'bg-blue-100 text-blue-800'; break;
            case 'movimiento': tipoText = 'Movimiento'; tipoClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'finalizacion': tipoText = 'Finalización'; tipoClass = 'bg-red-100 text-red-800'; break;
            default: tipoText = 'N/A'; tipoClass = 'bg-gray-100 text-gray-800';
        }

        const mainRowCells = [
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${new Date(op.created_at).toLocaleString('es-AR')}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tipoClass}">${tipoText}</span></td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.clientes?.nombre || '-'}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.operario_nombre || '-'}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.depositos?.nombre || '-'} (${op.depositos?.tipo || '-'})</td>`,
            `<td class="px-4 py-4 whitespace-nowrap font-semibold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</td>`
        ];

        if (isAdmin) {
            let garantiaHtml = '<span class="text-gray-400">-</span>';
            if (op.estado === 'finalizada') {
                if (op.con_garantia) {
                    const hoy = new Date();
                    hoy.setHours(0,0,0,0);
                    const vencimiento = new Date(op.fecha_vencimiento_garantia + 'T00:00:00');
                    if (vencimiento >= hoy) {
                        garantiaHtml = `<span title="Vence el ${vencimiento.toLocaleDateString('es-AR')}" class="material-icons text-green-600">check_circle</span>`;
                    } else {
                        garantiaHtml = `<span title="Venció el ${vencimiento.toLocaleDateString('es-AR')}" class="material-icons text-yellow-600">warning</span>`;
                    }
                } else {
                    garantiaHtml = `<span title="No cumple condiciones" class="material-icons text-red-600">cancel</span>`;
                }
            }
            mainRowCells.push(`<td class="px-4 py-4 text-center">${garantiaHtml}</td>`);
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="operacion_detalle.html?id=${op.id}" class="text-blue-600 hover:underline font-semibold">Ver Detalle</a></td>`);
        }
        mainRowCells.push(`<td class="px-4 py-4 text-center"><span class="material-icons expand-icon">expand_more</span></td>`);
        const mainRow = `<tr class="cursor-pointer hover:bg-gray-50 border-b" data-toggle-details="details-${op.id}">${mainRowCells.join('')}</tr>`;
        
        let detailsContentHTML = '';

        if (op.tipo_registro === 'inicial') {
            let vencimientoLimpieza = 'N/A';
            let vencimientoClass = 'text-gray-700';
            if(op.depositos && op.depositos.limpiezas && op.depositos.limpiezas.length > 0){
                const ultimaGarantia = op.depositos.limpiezas.reduce((a, b) => new Date(a.fecha_garantia_limpieza) > new Date(b.fecha_garantia_limpieza) ? a : b);
                if(ultimaGarantia.fecha_garantia_limpieza) {
                    const fechaVenc = new Date(ultimaGarantia.fecha_garantia_limpieza + 'T00:00:00');
                    vencimientoLimpieza = fechaVenc.toLocaleDateString('es-AR');
                    if (fechaVenc < new Date()) vencimientoClass = 'text-red-600 font-bold';
                }
            }
            detailsContentHTML = `
                <div class="p-4 bg-gray-100 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
                    <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
                    <div class="${vencimientoClass}"><strong>Venc. Vigencia Limpieza:</strong><br>${vencimientoLimpieza}</div>
                </div>
            `;
        } else if (op.tipo_registro === 'producto') {
            detailsContentHTML = `
                <div class="p-4 bg-gray-100 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Tratamiento:</strong><br>${op.tratamiento || 'N/A'}</div>
                    <div><strong>Tn. en Registro:</strong><br>${op.toneladas ? op.toneladas.toLocaleString() + ' tn' : 'N/A'}</div>
                    <div><strong>Producto Aplicado:</strong><br>${(op.producto_usado_cantidad || 0).toLocaleString()} ${op.metodo_fumigacion === 'liquido' ? 'cm³' : 'un.'}</div>
                </div>
            `;
        } else if (op.tipo_registro === 'movimiento') {
            // --- CORRECCIÓN: Se extrae el objeto del movimiento de la lista (array) ---
            const movimiento = op.movimientos && op.movimientos.length > 0 ? op.movimientos[0] : null;
            let mediaHTML = '';
            // Se comprueba que 'movimiento' exista antes de acceder a sus propiedades
            if (movimiento && Array.isArray(movimiento.media_url) && movimiento.media_url.length > 0) {
                mediaHTML = movimiento.media_url.map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="block group"><img src="${url}" class="h-24 w-full object-cover rounded-lg shadow-md border group-hover:shadow-xl transition-shadow" alt="Adjunto"></a>`).join('');
            }
            detailsContentHTML = `
                <div class="p-4 bg-gray-100 space-y-3 text-sm">
                    <div>
                        <p class="font-semibold">Observación del movimiento:</p>
                        <p class="mt-1 p-2 bg-white rounded break-words">${movimiento?.observacion || 'Sin observación.'}</p>
                    </div>
                    <div>
                        <p class="font-semibold">Archivos Adjuntos:</p>
                        <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">${mediaHTML || '<p class="col-span-full text-gray-500">No hay archivos.</p>'}</div>
                    </div>
                </div>
            `;
        } else if (op.tipo_registro === 'finalizacion') {
            const summary = operationSummaries.get(op.operacion_original_id);
            const unidadLabel = summary.metodo === 'liquido' ? 'cm³' : 'un.';
            const startDate = new Date(summary.startDate);
            const endDate = new Date(op.created_at);
            const durationMs = endDate - startDate;
            const durationHours = Math.floor(durationMs / 3600000);
            const durationMins = Math.round((durationMs % 3600000) / 60000);
            const tratamiento = summary.tratamiento ? summary.tratamiento.charAt(0).toUpperCase() + summary.tratamiento.slice(1) : 'N/A';
            const metodo = summary.metodo ? summary.metodo.charAt(0).toUpperCase() + summary.metodo.slice(1) : 'N/A';

            detailsContentHTML = `
                <div class="p-4 bg-gray-100">
                    <h4 class="font-bold text-base mb-3">Resumen de Operación Finalizada</h4>
                    <div class="grid grid-cols-4 gap-4 text-sm">
                        <div><strong>Mercadería:</strong><br>${summary.mercaderia}</div>
                        <div><strong>Método:</strong><br>${metodo}</div>
                        <div><strong>Tratamiento:</strong><br>${tratamiento}</div>
                        <div><strong>Total Toneladas:</strong><br>${summary.totalToneladas.toLocaleString()} tn</div>
                        <div><strong>Total Producto:</strong><br>${summary.totalProducto.toLocaleString()} ${unidadLabel}</div>
                        <div><strong>Inicio:</strong><br>${startDate.toLocaleString('es-AR')}</div>
                        <div><strong>Fin:</strong><br>${endDate.toLocaleString('es-AR')}</div>
                        <div><strong>Duración:</strong><br>~ ${durationHours}h ${durationMins}m</div>
                    </div>
                </div>
            `;
        }
        
        const detailsRow = `
            <tr id="details-${op.id}" class="details-row hidden bg-white border-b">
                <td colspan="${headers.length}">
                    ${detailsContentHTML}
                </td>
            </tr>
        `;

        return mainRow + detailsRow;
    }).join('');

    container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md border overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-gray-50"><tr>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}