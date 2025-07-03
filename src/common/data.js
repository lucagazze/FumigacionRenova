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
  
  renderOperacionesDesplegables(container, operaciones, isAdmin);
}

function renderOperacionesDesplegables(container, operaciones, isAdmin) {
    const runningTotals = new Map();
    const recordSpecificTotals = new Map();
    const sortedOps = [...operaciones].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (const op of sortedOps) {
        const key = op.operacion_original_id || op.id;
        const currentTotal = runningTotals.get(key) || 0;
        const newTotal = currentTotal + (op.toneladas || 0);
        runningTotals.set(key, newTotal);
        recordSpecificTotals.set(op.id, newTotal);
    }
    
    const headers = ["Fecha/Hora", "Tipo", "Cliente", "Operario", "Depósito", "Estado"];
    if (isAdmin) headers.push("Acciones");
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
            mainRowCells.push(`<td class="px-4 py-4 whitespace-nowrap text-sm"><a href="operacion_detalle.html?id=${op.id}" class="text-blue-600 hover:underline font-semibold">Ver Detalle</a></td>`);
        }
        mainRowCells.push(`<td class="px-4 py-4 text-center"><span class="material-icons expand-icon">expand_more</span></td>`);
        const mainRow = `<tr class="cursor-pointer hover:bg-gray-50 border-b" data-toggle-details="details-${op.id}">${mainRowCells.join('')}</tr>`;
        
        // --- LÓGICA CONDICIONAL PARA LOS DETALLES ---
        let detailsContentHTML = '';

        if (op.tipo_registro === 'movimiento') {
            const movimiento = op.movimientos && op.movimientos.length > 0 ? op.movimientos[0] : null;
            let mediaHTML = '<p><strong>Adjunto:</strong> Ninguno</p>';
            if (movimiento && movimiento.media_url) {
                const url = movimiento.media_url;
                if (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.gif')) {
                    mediaHTML = `<img src="${url}" class="mt-2 max-w-xs md:max-w-sm rounded-lg shadow-md" alt="Adjunto">`;
                } else {
                    mediaHTML = `<video src="${url}" class="mt-2 max-w-xs md:max-w-sm rounded-lg shadow-md" controls></video>`;
                }
            }
            detailsContentHTML = `
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p><strong>Observación del movimiento:</strong></p>
                        <p class="mt-1 p-2 bg-gray-100 rounded">${movimiento?.observacion || 'Sin observación.'}</p>
                    </div>
                    <div>
                        ${mediaHTML}
                    </div>
                </div>
            `;
        } else {
            // --- VISTA DE DETALLE POR DEFECTO PARA LOS DEMÁS TIPOS ---
            const tnRegistro = op.toneladas ? `${op.toneladas.toLocaleString()} tn` : 'N/A';
            const productoAplicado = op.tipo_registro === 'producto' ? `${(op.producto_usado_cantidad || 0).toLocaleString()} ${op.metodo_fumigacion === 'liquido' ? 'cm³' : 'un.'}` : 'N/A';
            const tnAcumuladas = op.tipo_registro === 'producto' ? `${(recordSpecificTotals.get(op.id) || 0).toLocaleString()} tn` : 'N/A';
            
            let vencimientoLimpieza = 'N/A';
            let vencimientoClass = 'text-gray-700';
            if(op.depositos && op.depositos.limpiezas.length > 0){
                const ultimaGarantia = op.depositos.limpiezas.reduce((a, b) => new Date(a.fecha_garantia_limpieza) > new Date(b.fecha_garantia_limpieza) ? a : b);
                if(ultimaGarantia.fecha_garantia_limpieza) {
                    const fechaVenc = new Date(ultimaGarantia.fecha_garantia_limpieza + 'T00:00:00');
                    vencimientoLimpieza = fechaVenc.toLocaleDateString('es-AR');
                    if (fechaVenc < new Date()) vencimientoClass = 'text-red-600 font-bold';
                }
            }
            
            detailsContentHTML = `
                <div class="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
                    <div><strong>Tratamiento:</strong><br>${op.tratamiento || 'N/A'}</div>
                    <div><strong>Tn. en Registro:</strong><br>${tnRegistro}</div>
                    <div><strong>Tn. Acumuladas:</strong><br>${tnAcumuladas}</div>
                    <div><strong>Producto Aplicado:</strong><br>${productoAplicado}</div>
                    <div class="${vencimientoClass}"><strong>Venc. Vigencia Limpieza:</strong><br>${vencimientoLimpieza}</div>
                </div>
            `;
        }
        
        const detailsRow = `
            <tr id="details-${op.id}" class="details-row hidden bg-gray-50 border-b">
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