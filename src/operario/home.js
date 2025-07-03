import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';


requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const operacionesList = document.getElementById('operacionesList');
const btnNueva = document.getElementById('btnNueva');

async function renderOperaciones() {
  const { data: ops, error: opsError } = await supabase
    .from('operaciones')
    .select('*')
    .eq('estado', 'en curso')
    .eq('tipo_registro', 'inicial');
  
  if(opsError) {
    console.error("Error fetching operations", opsError);
    operacionesList.innerHTML = '<p class="text-red-500">Error al cargar operaciones.</p>';
    return;
  }

  if (ops.length === 0) {
    operacionesList.innerHTML = '<p class="text-center text-[var(--text-secondary)] p-4">No hay operaciones en curso.</p>';
    return;
  }
  
  for (const op of ops) {
    const { data: historial, error } = await supabase
      .from('operaciones')
      .select('producto_usado_cantidad, toneladas')
      .eq('operacion_original_id', op.id)
      .eq('tipo_registro', 'producto');
    
    if (error) {
      console.error(`Error fetching product history for op ${op.id}:`, error);
      op.totalProducto = 0;
      op.totalToneladas = 0;
    } else {
      op.totalProducto = historial.reduce((sum, reg) => sum + (reg.producto_usado_cantidad || 0), 0);
      op.totalToneladas = historial.reduce((sum, reg) => sum + (reg.toneladas || 0), 0);
    }
  }

  operacionesList.innerHTML = ops.map((op) => {
    const areaTipo = op.area_tipo === 'silo' ? 'Silo' : 'Celda';
    const areaValor = op.silo || op.celda || '-';
    const mercaderia = op.mercaderia ? op.mercaderia.charAt(0).toUpperCase() + op.mercaderia.slice(1) : '-';
    
    let productoLabel = 'Producto usado';
    let unidadLabel = 'un.';
    if (op.metodo_fumigacion === 'liquido') {
        productoLabel = 'Líquido usado';
        unidadLabel = 'cm³';
    } else if (op.metodo_fumigacion === 'pastillas') {
        productoLabel = 'Pastillas usadas';
        unidadLabel = 'un.';
    }

    const productoUsado = op.totalProducto > 0 ? `${op.totalProducto.toLocaleString()} ${unidadLabel}` : '0';
    const toneladasFumigadas = op.totalToneladas > 0 ? `${op.totalToneladas.toLocaleString()} tn` : '0 tn';
    
    return `
      <div class="bg-white rounded-lg shadow-md p-6 border border-[var(--border-color)] mb-4 hover:shadow-lg hover:border-green-500 transition-all duration-200 cursor-pointer" data-id="${op.id}">
        <div class="flex flex-col justify-between items-start gap-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm w-full">
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">person</span><span class="font-semibold">Cliente:</span> <span>${op.cliente || '-'}</span></div>
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">grass</span><span class="font-semibold">Mercadería:</span> <span>${mercaderia}</span></div>
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">waves</span><span class="font-semibold">Método:</span> <span>${op.metodo_fumigacion || '-'}</span></div>
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">store</span><span class="font-semibold">${areaTipo}:</span> <span>${areaValor}</span></div>
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">calendar_today</span><span class="font-semibold">Fecha inicio:</span> <span>${new Date(op.created_at || Date.now()).toLocaleDateString('es-AR')}</span></div>
            <div class="flex items-center gap-2"><span class="material-icons text-gray-500">science</span><span class="font-semibold">${productoLabel}:</span> <span>${productoUsado}</span></div>
            <div class="flex items-center gap-2 lg:col-span-3"><span class="material-icons text-gray-500">scale</span><span class="font-semibold">Toneladas fumigadas:</span> <span>${toneladasFumigadas}</span></div>
          </div>
          <div class="w-full border-t border-gray-200 mt-2 pt-2 flex justify-center items-center text-green-600">
             <span class="font-bold">Continuar</span>
             <span class="material-icons ml-1">arrow_forward</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  Array.from(operacionesList.querySelectorAll('div[data-id]')).forEach(card => {
    card.addEventListener('click', () => {
      localStorage.setItem('operacion_actual', card.getAttribute('data-id'));
      window.location.href = 'operacion.html';
    });
  });
}

btnNueva.onclick = () => {
  localStorage.removeItem('operacion');
  localStorage.removeItem('operacion_actual');
  window.location.href = 'index.html';
};

renderOperaciones();