import { supabase } from './supabase.js';

export async function getOperaciones() {
  const { data, error } = await supabase
    .from('operaciones')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching operaciones:', error);
    return [];
  }
  return data;
}

// Function to get the last cleaning date for a set of areas
async function getUltimasLimpiezas(operaciones) {
    const limpiezasMap = new Map();
    // Use an RPC function in a real scenario for performance.
    // For now, query for all and map client-side.
    const { data: todasLimpiezas, error } = await supabase
        .from('limpiezas')
        .select('area_nombre, area_tipo, fecha_limpieza')
        .order('fecha_limpieza', { ascending: true });

    if (error) {
        console.error('Error fetching limpiezas', error);
        return limpiezasMap;
    }

    // Create a map of the latest cleaning date for each unique area
    for (const limpieza of todasLimpiezas) {
        const key = `${limpieza.area_nombre}|${limpieza.area_tipo}`;
        limpiezasMap.set(key, limpieza.fecha_limpieza);
    }
    
    return limpiezasMap;
}


export async function renderOperaciones(container, operaciones, isAdmin = false) {
  container.innerHTML = '<p class="text-center p-8">Cargando operaciones...</p>';

  // --- CORRECTED LOGIC FOR CUMULATIVE TOTALS ---
  const runningTotals = new Map(); // Key: operacion_original_id, Value: current running total
  const recordSpecificTotals = new Map(); // Key: op.id, Value: cumulative total at this specific record
  const sortedOps = [...operaciones].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const op of sortedOps) {
      if (op.tipo_registro === 'producto') {
          const key = op.operacion_original_id;
          const currentTotalForOperation = runningTotals.get(key) || 0;
          const newTotal = currentTotalForOperation + (op.toneladas || 0);
          
          // Store the new running total for the main operation
          runningTotals.set(key, newTotal);
          // Store the cumulative total for this specific record
          recordSpecificTotals.set(op.id, newTotal);
      }
  }
  // --- END OF CORRECTION ---

  const limpiezasMap = await getUltimasLimpiezas(operaciones);

  const isMobile = window.innerWidth <= 768;
  const headers = [
    "Fecha/Hora", "Tipo", "Cliente", "Operario", "Mercadería", "Método", "Tratamiento",
    "Área", "Silo/Celda", "Producto Aplicado", "Tn. Registro", "Tn. Acumuladas", "Estado", "Última Limpieza"
  ];
  if (isAdmin) headers.push("Acciones");

  const tableHeaders = headers.map(h => `<th class="px-3 py-2 text-left text-xs font-semibold text-[var(--muted-text-color)] uppercase">${h}</th>`).join('');

  const tableRows = operaciones.map(op => { // Use original `operaciones` to keep descending order
    const areaNombre = op.silo || op.celda;
    const limpiezaKey = `${areaNombre}|${op.area_tipo}`;
    const ultimaLimpieza = limpiezasMap.get(limpiezaKey);
    const fechaLimpiezaStr = ultimaLimpieza 
        ? new Date(ultimaLimpieza).toLocaleDateString('es-AR', { timeZone: 'UTC' }) 
        : 'N/A';

    let tipoText, tipoClass;
    if (op.tipo_registro === 'producto') { 
        tipoText = 'Aplicacion'; 
        tipoClass = 'bg-blue-100 text-blue-800'; 
    } else if (op.tipo_registro === 'finalizacion') { 
        tipoText = 'Finalizacion'; 
        tipoClass = 'bg-red-100 text-red-800'; 
    } else { 
        tipoText = 'Inicio'; 
        tipoClass = 'bg-green-100 text-green-800'; 
    }

    const productoCantidad = op.producto_usado_cantidad ? `${op.producto_usado_cantidad.toLocaleString()} ${op.metodo_fumigacion === 'liquido' ? 'cm³' : 'un.'}` : '-';
    
    const metodoFumigacion = op.metodo_fumigacion ? op.metodo_fumigacion.charAt(0).toUpperCase() + op.metodo_fumigacion.slice(1) : '-';
    
    const tratamientoTexto = op.tratamiento ? op.tratamiento.charAt(0).toUpperCase() + op.tratamiento.slice(1) : '-';

    const toneladasRegistro = op.toneladas ? `${op.toneladas.toLocaleString()} tn` : '-';
    
    let toneladasAcumuladas = '-';
    if(recordSpecificTotals.has(op.id)) {
        toneladasAcumuladas = `${recordSpecificTotals.get(op.id).toLocaleString()} tn`;
    }

    const cells = [
      `<td class="px-3 py-2 text-xs">${new Date(op.created_at || Date.now()).toLocaleString('es-AR')}</td>`,
      `<td class="px-3 py-2"><span class="px-2 py-1 text-xs font-medium rounded-full ${tipoClass}">${tipoText}</span></td>`,
      `<td class="px-3 py-2 text-xs">${op.cliente || '-'}</td>`,
      `<td class="px-3 py-2 text-xs">${op.operario_nombre || '-'}</td>`,
      `<td class="px-3 py-2 text-xs">${op.mercaderia ? op.mercaderia.charAt(0).toUpperCase() + op.mercaderia.slice(1) : '-'}</td>`,
      `<td class="px-3 py-2 text-xs">${metodoFumigacion}</td>`,
      `<td class="px-3 py-2 text-xs">${tratamientoTexto}</td>`,
      `<td class="px-3 py-2 text-xs">${op.area_tipo === 'silo' ? 'Silo' : 'Celda'}</td>`,
      `<td class="px-3 py-2 text-xs">${areaNombre || '-'}</td>`,
      `<td class="px-3 py-2 text-xs">${productoCantidad}</td>`,
      `<td class="px-3 py-2 text-xs">${toneladasRegistro}</td>`,
      `<td class="px-3 py-2 text-xs font-bold">${toneladasAcumuladas}</td>`,
      `<td class="px-3 py-2 text-xs">${op.estado || 'en curso'}</td>`,
      `<td class="px-3 py-2 text-xs">${fechaLimpiezaStr}</td>`
    ];
    if (isAdmin) {
      cells.push(`<td class="px-4 py-2"><a href="operacion_detalle.html?id=${op.id}" class="font-medium text-blue-600 hover:underline">Ver</a></td>`);
    }
    return `<tr class="hover:bg-[var(--border-color)] cursor-pointer border-t" data-id="${op.id}" data-estado="${op.estado}" data-original-id="${op.operacion_original_id || op.id}">
        ${cells.join('')}
    </tr>`;
  }).join('');
  
  const tableClass = isMobile ? 'overflow-x-auto' : 'bg-white rounded-2xl shadow-2xl p-8 border';
  const innerTableClass = isMobile 
    ? 'min-w-full divide-y divide-[var(--border-color)] bg-white rounded-2xl shadow-md border'
    : 'min-w-full divide-y divide-[var(--border-color)]';

  container.innerHTML = `
    <div class="${tableClass}">
      <table class="${innerTableClass}">
        <thead><tr>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
  
  if (operaciones.length === 0) {
      container.innerHTML = '<p class="text-center p-8">No se encontraron operaciones que coincidan con los filtros.</p>';
  }

  if (isAdmin) {
    Array.from(container.querySelectorAll('[data-id]')).forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        const id = el.getAttribute('data-id');
        window.location.href = `operacion_detalle.html?id=${id}`;
      });
    });
  } else {
    // --- NUEVO BLOQUE DE CÓDIGO ---
    // Agrega el evento de clic para el operario
    Array.from(container.querySelectorAll('[data-id]')).forEach(el => {
      el.addEventListener('click', () => {
        const estado = el.getAttribute('data-estado');
        const originalId = el.getAttribute('data-original-id');

        if (estado === 'en curso') {
          // Guardamos el ID de la operación *original* para continuarla
          localStorage.setItem('operacion_actual', originalId);
          window.location.href = 'operacion.html';
        }
      });
    });
  }
}