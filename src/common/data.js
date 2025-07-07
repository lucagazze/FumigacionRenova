import { supabase } from './supabase.js';

export async function getOperaciones() {
  const { data, error } = await supabase
    .from('operaciones')
    .select(`
      *,
      eliminado, 
      clientes(nombre), 
      depositos(
        nombre, 
        tipo,
        capacidad_toneladas, 
        limpiezas(fecha_garantia_limpieza)
      ), 
      mercaderias(nombre), 
      muestreos(observacion, media_url)
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

        if (op.toneladas && op.estado_aprobacion !== 'rechazado') {
            summary.totalToneladas += op.toneladas;
        }
        if (op.producto_usado_cantidad && op.estado_aprobacion !== 'rechazado') {
            summary.totalProducto += op.producto_usado_cantidad;
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
            hour: '2-digit', minute: '2-digit', hour12: true 
        });
        
        const isRechazado = op.estado_aprobacion === 'rechazado';
        const rowClass = isRechazado ? 'text-gray-400 line-through' : '';

        let aprobacionHtml = '';
        if (op.tipo_registro === 'producto' || op.tipo_registro === 'inicial') {
            switch(op.estado_aprobacion) {
                case 'aprobado':
                    aprobacionHtml = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Aprobado</span>';
                    break;
                case 'pendiente':
                    aprobacionHtml = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>';
                    break;
                case 'rechazado':
                    aprobacionHtml = `<span title="Motivo: ${op.observacion_aprobacion || 'N/A'}" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 cursor-pointer no-underline">Rechazado</span>`;
                    break;
            }
        }

        const mainRowCells = [
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${fechaFormateada}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tipoClass} no-underline">${tipoText}</span></td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.clientes?.nombre || '-'}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.operario_nombre?.replace(' y ', '<br>y ').replace(/, /g, '<br>')}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap text-sm">${op.depositos?.nombre || '-'} (${op.depositos?.tipo || '-'})</td>`,
            `<td class="px-4 py-4 whitespace-nowrap font-semibold ${op.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${op.estado}</td>`,
            `<td class="px-4 py-4 whitespace-nowrap">${aprobacionHtml}</td>`
        ];

        if (isAdmin || isSupervisor) {
            mainRowCells.push(`<td class="px-4 py-4 text-center">-</td>`);
        }
        
        if (isAdmin) {
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="operacion_detalle.html?id=${op.id}" class="text-blue-600 hover:underline font-semibold no-underline">Ver Detalle</a></td>`);
        } else if (isSupervisor) {
            let link = 'operacion_detalle.html';
             if (op.estado_aprobacion === 'pendiente' && op.tipo_registro !== 'finalizacion') {
                link = 'operacion_confirmar.html';
            }
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="${link}?id=${op.id}" class="text-blue-600 hover:underline font-semibold no-underline">Ver/Gestionar</a></td>`);
        }
        
        mainRowCells.push(`<td class="px-4 py-4 text-center"><span class="material-icons expand-icon">expand_more</span></td>`);
        const mainRow = `<tr class="cursor-pointer hover:bg-gray-50 border-b ${rowClass}" data-toggle-details="details-${op.id}">${mainRowCells.join('')}</tr>`;
        
        let detailsContentHTML = '';

        if (op.tipo_registro === 'inicial') {
            detailsContentHTML = `<div class="p-4 bg-gray-100">...</div>`;
        } else if (op.tipo_registro === 'producto') {
            detailsContentHTML = `<div class="p-4 bg-gray-100">...</div>`;
        }
        
        const detailsRow = `<tr id="details-${op.id}" class="details-row hidden bg-white border-b"><td colspan="${headers.length}">${detailsContentHTML}</td></tr>`;

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