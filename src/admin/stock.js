import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const stockList = document.getElementById('stock-list');
const historialStockEl = document.getElementById('historial-stock');
const formModificarStock = document.getElementById('formModificarStock');
const tipoProductoSelect = document.getElementById('tipo_producto');
const unidadSelect = document.getElementById('unidad');
const DENSIDAD_LIQUIDO = 1.2; // kg/L

function updateUnidadOptions() {
    const tipo = tipoProductoSelect.value;
    if (tipo === 'pastillas') {
        unidadSelect.innerHTML = `
            <option value="kilos">Kilos (Kg)</option>
            <option value="unidades">Pastillas (unidades)</option>
        `;
    } else { // liquido
        unidadSelect.innerHTML = `
            <option value="litros">Litros (L)</option>
            <option value="cm3">Centímetros cúbicos (cm³)</option>
        `;
    }
}


async function renderStock() {
  const { data, error } = await supabase.from('stock').select('*');
  if (error) {
    console.error('Error fetching stock:', error);
    stockList.innerHTML = '<p class="text-red-500">Error al cargar stock.</p>';
    return;
  }
  
  stockList.innerHTML = '';
  const depositos = ['Fagaz', 'Baigorria'];
  
  depositos.forEach(deposito => {
      const stockDeposito = data.filter(s => s.deposito === deposito);
      const pastillasStock = stockDeposito.find(s => s.tipo_producto === 'pastillas');
      const liquidoStock = stockDeposito.find(s => s.tipo_producto === 'liquido');
      const liquidoLitros = (liquidoStock?.cantidad_kg || 0) / DENSIDAD_LIQUIDO;
      const liquidoCm3 = liquidoLitros * 1000;

      stockList.innerHTML += `
        <div class="p-4 border rounded-lg">
            <h3 class="font-bold text-lg">${deposito}</h3>
            <div class="mt-2 space-y-1 text-sm">
                <p><b>Pastillas:</b> ${pastillasStock?.cantidad_unidades?.toLocaleString() || 0} unidades (~${pastillasStock?.cantidad_kg?.toLocaleString() || 0} Kg)</p>
                <p><b>Líquido:</b> ${liquidoCm3.toLocaleString()} cm³ (~${liquidoLitros.toFixed(2)} L)</p>
            </div>
        </div>
      `;
  });
}

async function renderHistorialStock() {
  if (!historialStockEl) return;
  const { data, error } = await supabase.from('historial_stock').select('*').order('created_at', { ascending: false }).limit(50);
  
  if (error) {
    console.error('Error fetching stock history:', error);
    historialStockEl.innerHTML = '<p class="text-red-500">Error al cargar historial.</p>';
    return;
  }

  if (data.length === 0) {
    historialStockEl.innerHTML = '<p class="text-center text-gray-500">No hay movimientos de stock.</p>';
    return;
  }

  const table = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Movimiento</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Depósito</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
          <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Detalle</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${data.map(item => {
          const tipoClass = item.tipo_movimiento === 'adicion' ? 'text-green-600' : 'text-red-600';
          let cantidadDetalle = '';
            if (item.tipo_producto === 'pastillas') {
                cantidadDetalle = `${item.cantidad_unidades_movidas?.toLocaleString()} unidades (${item.cantidad_kg_movido} Kg)`;
            } else {
                const litros = (item.cantidad_kg_movido / DENSIDAD_LIQUIDO);
                const cm3 = litros * 1000;
                cantidadDetalle = `${cm3.toLocaleString()} cm³ (~${litros.toFixed(2)} L)`;
            }

          return `
            <tr>
              <td class="px-4 py-2">${new Date(item.created_at).toLocaleString('es-AR')}</td>
              <td class="px-4 py-2 font-bold ${tipoClass}">${item.tipo_movimiento.charAt(0).toUpperCase() + item.tipo_movimiento.slice(1)}</td>
              <td class="px-4 py-2">${item.deposito}</td>
              <td class="px-4 py-2">${item.tipo_producto.charAt(0).toUpperCase() + item.tipo_producto.slice(1)}</td>
              <td class="px-4 py-2">${cantidadDetalle}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>`;

  historialStockEl.innerHTML = table;
}

tipoProductoSelect.addEventListener('change', updateUnidadOptions);

formModificarStock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deposito = document.getElementById('deposito').value;
    const tipo_producto = document.getElementById('tipo_producto').value;
    const unidad = document.getElementById('unidad').value;
    const cantidad = parseFloat(document.getElementById('cantidad').value);
    const tipo_movimiento = document.getElementById('tipo_movimiento').value;

    if (!deposito || !tipo_producto || !cantidad || cantidad <= 0) {
        alert('Complete todos los campos correctamente.');
        return;
    }
    
    let cantidad_kg = 0;
    let cantidad_unidades = null;

    if (tipo_producto === 'pastillas') {
        if (unidad === 'kilos') {
            cantidad_kg = cantidad;
            cantidad_unidades = Math.floor(cantidad * 1000 / 3); // 3 gramos por pastilla
        } else { // unidades
            cantidad_unidades = cantidad;
            cantidad_kg = cantidad * 3 / 1000;
        }
    } else { // liquido
        if(unidad === 'cm3'){
            cantidad_kg = (cantidad / 1000) * DENSIDAD_LIQUIDO;
        } else { // litros
            cantidad_kg = cantidad * DENSIDAD_LIQUIDO;
        }
    }

    const { data: stockActual, error: fetchError } = await supabase
      .from('stock')
      .select('id, cantidad_kg, cantidad_unidades')
      .eq('deposito', deposito)
      .eq('tipo_producto', tipo_producto)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      alert('Error al obtener el stock actual.');
      console.error(fetchError);
      return;
    }
    
    let nuevo_kg = stockActual?.cantidad_kg || 0;
    let nuevas_unidades = stockActual?.cantidad_unidades || 0;

    const factor = tipo_movimiento === 'adicion' ? 1 : -1;
    
    nuevo_kg += cantidad_kg * factor;
    if (tipo_producto === 'pastillas') {
        nuevas_unidades += cantidad_unidades * factor;
    }

    if (nuevo_kg < 0 || nuevas_unidades < 0) {
        alert('No hay suficiente stock para quitar esa cantidad.');
        return;
    }

    const { error: upsertError } = await supabase
        .from('stock')
        .upsert({ 
            id: stockActual?.id, 
            deposito, 
            tipo_producto, 
            cantidad_kg: nuevo_kg, 
            cantidad_unidades: tipo_producto === 'pastillas' ? nuevas_unidades : null
        }, { onConflict: 'deposito, tipo_producto' });
    
    if (upsertError) {
        alert('Error al actualizar el stock.');
        console.error(upsertError);
        return;
    }

    await supabase.from('historial_stock').insert([{
        tipo_movimiento,
        deposito,
        tipo_producto,
        cantidad_kg_movido: cantidad_kg,
        cantidad_unidades_movidas: cantidad_unidades,
        descripcion: `Movimiento manual desde admin.`
    }]);

    await renderStock();
    await renderHistorialStock();
    formModificarStock.reset();
    updateUnidadOptions();
    alert('Movimiento de stock registrado con éxito.');
});


document.addEventListener('DOMContentLoaded', () => {
    renderStock();
    renderHistorialStock();
    updateUnidadOptions();
});
