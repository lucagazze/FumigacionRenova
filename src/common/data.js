import { supabase } from './supabase.js';

export async function getOperaciones() {
    // --- CONSULTA CORREGIDA Y MEJORADA ---
    // Se añade "supervisor:supervisor_id(nombre, apellido)" para que la consulta
    // siempre traiga el nombre y apellido del supervisor asociado a la operación.
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
        muestreos(observacion, media_url),
        supervisor:supervisor_id(nombre, apellido)
      `)
      .order('created_at', { ascending: false });
  

  if (error) {
    console.error('Error fetching operaciones:', error);
    return [];
  }
  return data;
}

export async function renderOperaciones(container, operaciones, isAdmin = false, isSupervisor = false) {
    const operacionesSinMuestreos = operaciones.filter(op => op.tipo_registro !== 'muestreo');
    if (!operacionesSinMuestreos || operacionesSinMuestreos.length === 0) {
        container.innerHTML = '<p class="text-center p-8 text-gray-500">No se encontraron operaciones.</p>';
        return;
    }
  
    await renderOperacionesDesplegables(container, operacionesSinMuestreos, isAdmin, isSupervisor);
}

async function renderOperacionesDesplegables(container, operaciones, isAdmin, isSupervisor) {
    const operationSummaries = new Map();
    const finalizationRecords = operaciones.filter(op => op.tipo_registro === 'finalizacion');

    for (const op of operaciones) {
        const key = op.operacion_original_id || op.id;

        if (!operationSummaries.has(key)) {
            const initialOp = operaciones.find(o => o.id === key) || op;
            operationSummaries.set(key, {
                totalToneladas: 0,
                totalProducto: 0,
                startDate: initialOp.created_at,
                metodo: initialOp.metodo_fumigacion,
                mercaderia: initialOp.mercaderias?.nombre || 'N/A',
                tratamientos: new Set(),
            });
        }

        const summary = operationSummaries.get(key);

        if (op.estado_aprobacion !== 'rechazado') {
            if (op.toneladas) {
                summary.totalToneladas += op.toneladas;
            }
            if (op.producto_usado_cantidad) {
                summary.totalProducto += op.producto_usado_cantidad;
            }
        }
        
        if (op.tipo_registro === 'producto' && op.tratamiento) {
            summary.tratamientos.add(op.tratamiento);
        }
    }
    
    const headers = ["Fecha/Hora", "Tipo", "Cliente", "Operario", "Depósito", "Estado", "Aprobación"];
    if (isAdmin || isSupervisor) headers.push("Garantía");
    if (isAdmin) {
        headers.push("Acciones");
    } else if (isSupervisor) {
        headers.push("Detalle");
    }
    headers.push("");

    const tableHeaders = headers.map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    const tableRows = operaciones.map(op => {
        let tipoText, tipoClass;
        switch(op.tipo_registro) {
            case 'inicial': tipoText = 'Inicio'; tipoClass = 'bg-green-100 text-green-800'; break;
            case 'producto': tipoText = 'Aplicación'; tipoClass = 'bg-blue-100 text-blue-800'; break;
            case 'muestreo': tipoText = 'Muestreo'; tipoClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'finalizacion': tipoText = 'Finalización'; tipoClass = 'bg-red-100 text-red-800'; break;
            default: tipoText = 'N/A'; tipoClass = 'bg-gray-100 text-gray-800';
        }

        const fechaFormateada = new Date(op.created_at).toLocaleString('es-AR', {
            day: 'numeric', month: 'numeric', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', hour12: false 
        });

        let aprobacionHtml = '';
        // --- LA CORRECCIÓN ESTÁ AQUÍ ---
        // Se añade 'finalizacion' a la condición para que también muestre su estado.
        if (op.tipo_registro === 'producto' || op.tipo_registro === 'inicial' || op.tipo_registro === 'finalizacion') {
            switch(op.estado_aprobacion) {
                case 'aprobado':
                    aprobacionHtml = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Aprobado</span>';
                    break;
                case 'pendiente':
                    aprobacionHtml = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>';
                    break;
                case 'rechazado':
                    aprobacionHtml = `<span title="Motivo: ${op.observacion_aprobacion || 'N/A'}" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 cursor-pointer">Rechazado</span>`;
                    break;
            }
        }
        
        let rowClass = 'cursor-pointer hover:bg-gray-50 border-b';
        if (op.estado_aprobacion === 'rechazado') {
            rowClass += ' line-through text-gray-400';
        }

        const mainRowCells = [
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${fechaFormateada}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tipoClass}">${tipoText}</span></td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.clientes?.nombre || '-'}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.operario_nombre?.replace(' y ', '<br>y ').replace(/, /g, '<br>')}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.depositos?.nombre || '-'} (${op.depositos?.tipo || '-'})</td>`,
            `<td class="px-4 py-4 whitespace-nowrap font-semibold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap">${aprobacionHtml}</td>`
        ];

        if (isAdmin || isSupervisor) {
            let garantiaHtml = '<span class="text-gray-400">-</span>';
            const operationId = op.operacion_original_id || op.id;
            const finalRecord = finalizationRecords.find(f => f.operacion_original_id === operationId);

            if (op.estado === 'finalizada' && finalRecord) {
                const initialOp = operaciones.find(o => o.id === operationId) || op;
                const fechaInicio = new Date(initialOp.created_at);
                const fechaFin = new Date(finalRecord.created_at);
                const duracionDias = (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24);
                const cumplePlazo = duracionDias <= 5;
                const ultimaLimpieza = initialOp.depositos?.limpiezas?.[0]?.fecha_garantia_limpieza;
                let cumpleLimpieza = false;
                if (ultimaLimpieza) {
                    const fechaVencLimpieza = new Date(ultimaLimpieza + 'T00:00:00');
                    if (fechaFin <= fechaVencLimpieza) {
                        cumpleLimpieza = true;
                    }
                }

                if (cumplePlazo && cumpleLimpieza) {
                    const hoy = new Date();
                    hoy.setHours(0,0,0,0);
                    const fechaVencimientoGarantia = new Date(fechaFin);
                    fechaVencimientoGarantia.setDate(fechaVencimientoGarantia.getDate() + 40);
                    
                    if (fechaVencimientoGarantia >= hoy) {
                        garantiaHtml = `<span title="Garantía vigente hasta ${fechaVencimientoGarantia.toLocaleDateString('es-AR')}" class="material-icons text-green-600">check_circle</span>`;
                    } else {
                        garantiaHtml = `<span title="Garantía vencida el ${fechaVencimientoGarantia.toLocaleDateString('es-AR')}" class="material-icons text-yellow-600">warning</span>`;
                    }
                } else {
                    garantiaHtml = `<span title="No cumple condiciones para garantía" class="material-icons text-red-600">cancel</span>`;
                }
            } else if (op.estado === 'finalizada') {
                garantiaHtml = `<span title="No cumple condiciones para garantía" class="material-icons text-red-600">cancel</span>`;
            }
            mainRowCells.push(`<td class="px-4 py-4 text-center">${garantiaHtml}</td>`);
        }
        
        if (isAdmin) {
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="operacion_detalle.html?id=${op.id}" class="text-blue-600 hover:underline font-semibold">Ver Detalle</a></td>`);
        } else if (isSupervisor) {
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="operacion_detalle.html?id=${op.id}" class="text-blue-600 hover:underline font-semibold">Ver Detalle</a></td>`);
        }
        
        mainRowCells.push(`<td class="px-4 py-4 text-center"><span class="material-icons expand-icon">expand_more</span></td>`);
        
        const mainRow = `<tr class="${rowClass}" data-toggle-details="details-${op.id}">${mainRowCells.join('')}</tr>`;
        
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
            
            let aprobacionDetalle = '';
            if (op.observacion_aprobacion) {
                aprobacionDetalle = `<div class="col-span-full mt-2"><strong>Obs. Supervisor:</strong><br><p class="mt-1 p-2 bg-white rounded break-words">${op.observacion_aprobacion}</p></div>`;
            }

            detailsContentHTML = `
                <div class="p-4 bg-gray-100 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
                    <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
                    <div class="${vencimientoClass}"><strong>Venc. Vigencia Limpieza:</strong><br>${vencimientoLimpieza}</div>
                    ${aprobacionDetalle}
                </div>
            `;
        } else if (op.tipo_registro === 'producto') {
            const productoAplicado = op.metodo_fumigacion === 'liquido' 
                ? `${(op.producto_usado_cantidad / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
                : `${(op.producto_usado_cantidad || 0).toLocaleString()} un.`;
            
            let aprobacionDetalle = '';
            if (op.observacion_aprobacion) {
                aprobacionDetalle = `<div class="col-span-full mt-2"><strong>Obs. Supervisor:</strong><br><p class="mt-1 p-2 bg-white rounded break-words">${op.observacion_aprobacion}</p></div>`;
            }

             const supervisorName = op.supervisor ? `${op.supervisor.nombre} ${op.supervisor.apellido}` : 'No asignado';
            
            detailsContentHTML = `
                <div class="p-4 bg-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><strong>Tipo de Producto:</strong><br>${op.metodo_fumigacion === 'liquido' ? 'Líquido' : 'Pastillas'}</div>
                    <div><strong>Tratamiento:</strong><br>${op.tratamiento || 'N/A'}</div>
                    <div><strong>Tn. en Registro:</strong><br>${op.toneladas ? op.toneladas.toLocaleString() + ' tn' : 'N/A'}</div>
                    <div><strong>Producto Aplicado:</strong><br>${productoAplicado}</div>
                    <div><strong>Supervisor a Cargo:</strong><br>${supervisorName}</div>
                    <div><strong>Modalidad:</strong><br>${op.modalidad || 'N/A'}</div>
                    ${aprobacionDetalle}
                </div>
            `;
        } else if (op.tipo_registro === 'muestreo') {
            const muestreo = op.muestreos && op.muestreos.length > 0 ? op.muestreos[0] : null;
            let mediaHTML = '';
            if (muestreo && Array.isArray(muestreo.media_url) && muestreo.media_url.length > 0) {
                mediaHTML = muestreo.media_url.map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="block group"><img src="${url}" class="h-24 w-full object-cover rounded-lg shadow-md border group-hover:shadow-xl transition-shadow" alt="Adjunto"></a>`).join('');
            }
            detailsContentHTML = `
                <div class="p-4 bg-gray-100 space-y-3 text-sm">
                    <div>
                        <p class="font-semibold">Observación del muestreo:</p>
                        <p class="mt-1 p-2 bg-white rounded break-words">${muestreo?.observacion || 'Sin observación.'}</p>
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
            const tratamiento = summary.tratamientos.size > 0 ? [...summary.tratamientos].join(', ') : 'N/A';
            const metodo = summary.metodo ? summary.metodo.charAt(0).toUpperCase() + summary.metodo.slice(1) : 'N/A';
            const fechaInicioFormateada = startDate.toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
            const fechaFinFormateada = endDate.toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

            detailsContentHTML = `
                <div class="p-4 bg-gray-100">
                    <h4 class="font-bold text-base mb-3">Resumen de Operación Finalizada</h4>
                    <div class="grid grid-cols-4 gap-4 text-sm">
                        <div><strong>Mercadería:</strong><br>${summary.mercaderia}</div>
                        <div><strong>Método:</strong><br>${metodo}</div>
                        <div><strong>Tratamiento(s):</strong><br>${tratamiento}</div>
                        <div><strong>Total Toneladas:</strong><br>${summary.totalToneladas.toLocaleString()} tn</div>
                        <div><strong>Total Producto:</strong><br>${summary.totalProducto.toLocaleString()} ${unidadLabel}</div>
                        <div><strong>Inicio:</strong><br>${fechaInicioFormateada}</div>
                        <div><strong>Fin:</strong><br>${fechaFinFormateada}</div>
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