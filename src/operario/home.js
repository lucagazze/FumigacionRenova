import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const operacionesList = document.getElementById('operacionesList');
const btnNueva = document.getElementById('btnNueva');

async function renderOperaciones() {
  operacionesList.innerHTML = '<p class="text-center p-4 text-gray-500">Buscando operaciones en curso...</p>';

  // 1. Obtener las operaciones iniciales que están "en curso"
  const { data: opsIniciales, error } = await supabase
    .from('operaciones')
    .select('id, created_at, metodo_fumigacion, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)')
    .eq('estado', 'en curso')
    .eq('tipo_registro', 'inicial')
    .order('created_at', { ascending: false });
  
  if(error) {
    console.error("Error fetching operations", error);
    operacionesList.innerHTML = '<p class="text-red-500 text-center p-4">Error al cargar operaciones.</p>';
    return;
  }

  if (opsIniciales.length === 0) {
    operacionesList.innerHTML = '<p class="text-center text-gray-500 p-4">No hay operaciones en curso en este momento.</p>';
    return;
  }
  
  // 2. Para cada operación, buscar sus registros de producto y movimiento para calcular totales
  for (const op of opsIniciales) {
    const { data: historial } = await supabase
        .from('operaciones')
        .select('toneladas, producto_usado_cantidad')
        .eq('operacion_original_id', op.id);
    
    op.totalProducto = historial.reduce((sum, reg) => sum + (reg.producto_usado_cantidad || 0), 0);
    op.totalToneladas = historial.reduce((sum, reg) => sum + (reg.toneladas || 0), 0);
  }

  // 3. Renderizar las tarjetas con todos los datos
  operacionesList.innerHTML = opsIniciales.map((op) => {
    const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

    return `
      <div class="border rounded-lg p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">person</span>
                <div><strong>Cliente:</strong><br>${op.clientes?.nombre || 'N/A'}</div>
            </div>
            <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">grass</span>
                <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
            </div>
             <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">science</span>
                <div><strong>Método:</strong><br>${op.metodo_fumigacion?.charAt(0).toUpperCase() + op.metodo_fumigacion?.slice(1)}</div>
            </div>
            <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">store</span>
                <div><strong>Depósito:</strong><br>${depositoInfo}</div>
            </div>
             <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">calendar_today</span>
                <div><strong>Fecha inicio:</strong><br>${new Date(op.created_at).toLocaleDateString('es-AR')}</div>
            </div>
            <div class="flex items-center gap-2">
                <span class="material-icons text-gray-500">warning</span>
                <div><strong>Producto usado:</strong><br>${op.totalProducto.toLocaleString()} ${unidadLabel}</div>
            </div>
             <div class="flex items-center gap-2 col-span-full sm:col-span-1 md:col-span-3">
                <span class="material-icons text-gray-500">scale</span>
                <div><strong>Toneladas fumigadas:</strong><br>${op.totalToneladas.toLocaleString()} tn</div>
            </div>
        </div>
        <div class="flex justify-center border-t pt-4 mt-4">
            <button class="bg-green-500 text-white font-bold py-2 px-8 rounded-lg flex items-center justify-center gap-2 continue-btn" data-id="${op.id}">
                <span>Continuar</span>
                <span class="material-icons">arrow_forward</span>
            </button>
        </div>
      </div>
    `;
  }).join('');

  operacionesList.querySelectorAll('button.continue-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const opId = e.currentTarget.dataset.id;
      localStorage.setItem('operacion_actual', opId);
      window.location.href = 'operacion.html';
    });
  });
}

btnNueva.addEventListener('click', () => {
  localStorage.removeItem('operacion_actual');
  window.location.href = 'index.html';
});

document.addEventListener('DOMContentLoaded', renderOperaciones);