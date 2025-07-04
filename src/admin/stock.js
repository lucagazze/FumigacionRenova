import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- SELECTORES ---
const stockList = document.getElementById('stock-list');
const historialStockEl = document.getElementById('historial-stock');
const formModificarStock = document.getElementById('formModificarStock');
const tipoProductoSelect = document.getElementById('tipo_producto');
const unidadSelect = document.getElementById('unidad');
const DENSIDAD_LIQUIDO = 1.2; // kg/L

// --- FUNCIONES ---

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
  
  stockList.innerHTML = ''; // Limpiar antes de renderizar
  const depositos = ['Fagaz', 'Baigorria'];
  
  depositos.forEach(deposito => {
      const stockDeposito = data.filter(s => s.deposito === deposito);
      const pastillasStock = stockDeposito.find(s => s.tipo_producto === 'pastillas');
      const liquidoStock = stockDeposito.find(s => s.tipo_producto === 'liquido');
      const liquidoLitros = (liquidoStock?.cantidad_kg || 0) / DENSIDAD_LIQUIDO;
      const liquidoCm3 = liquidoLitros * 1000;

      stockList.innerHTML += `
        <div class="p-4 border rounded-lg bg-gray-50">
            <h3 class="font-bold text-lg text-gray-800">${deposito}</h3>
            <div class="mt-2 space-y-1 text-sm text-gray-700">
                <p><b>Pastillas:</b> ${pastillasStock?.cantidad_unidades?.toLocaleString() || 0} un. (~${pastillasStock?.cantidad_kg?.toFixed(2) || '0.00'} Kg)</p>
                <p><b>Líquido:</b> ${liquidoCm3.toLocaleString(undefined, {maximumFractionDigits:0})} cm³ (~${liquidoLitros.toFixed(2)} L)</p>
            </div>
        </div>
      `;
  });
}

async function renderHistorialStock() {
    if (!historialStockEl) return;

    const { data, error } = await supabase
        .from('historial_stock')
        .select(`*, operaciones(id)`)
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        historialStockEl.innerHTML = `<p class="text-red-500">Error al cargar historial: ${error.message}</p>`;
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
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${data.map(item => {
                    let tipoDisplay, tipoClass, tipoIcon;
                    switch (item.tipo_movimiento) {
                        case 'adicion':
                            tipoDisplay = 'Adición'; tipoClass = 'text-green-600'; tipoIcon = 'add_circle'; break;
                        case 'extraccion':
                            tipoDisplay = 'Extracción'; tipoClass = 'text-yellow-700'; tipoIcon = 'remove_circle'; break;
                        case 'uso':
                            tipoDisplay = 'Uso'; tipoClass = 'text-red-600'; tipoIcon = 'build'; break;
                        default:
                            tipoDisplay = item.tipo_movimiento; tipoClass = 'text-gray-600'; tipoIcon = 'help_outline';
                    }

                    let cantidadDetalle = '';
                    if (item.tipo_producto === 'pastillas') {
                        cantidadDetalle = `<b>${item.cantidad_unidades_movidas?.toLocaleString() || 0} un.</b>`;
                    } else {
                        const cm3 = (item.cantidad_kg_movido / DENSIDAD_LIQUIDO * 1000).toLocaleString(undefined, {maximumFractionDigits: 0});
                        cantidadDetalle = `<b>${cm3} cm³</b>`;
                    }
                    
                    const link = item.operacion_id ? `operacion_detalle.html?id=${item.operacion_id}` : '#';
                    const isClickable = item.operacion_id ? 'cursor-pointer hover:bg-blue-50' : '';
                    
                    return `
                        <tr class="${isClickable}" onclick="${item.operacion_id ? `window.location.href='${link}'` : ''}">
                            <td class="px-4 py-2 text-sm">${new Date(item.created_at).toLocaleString('es-AR')}</td>
                            <td class="px-4 py-2 font-bold ${tipoClass} flex items-center gap-1"><span class="material-icons text-base">${tipoIcon}</span>${tipoDisplay}</td>
                            <td class="px-4 py-2">${item.deposito}</td>
                            <td class="px-4 py-2">${item.tipo_producto.charAt(0).toUpperCase() + item.tipo_producto.slice(1)}</td>
                            <td class="px-4 py-2">${cantidadDetalle}</td>
                            <td class="px-4 py-2 text-xs text-gray-600">${item.descripcion || '-'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>`;
    historialStockEl.innerHTML = table;
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    renderStock();
    renderHistorialStock();
    updateUnidadOptions();
});

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
            cantidad_unidades = Math.floor(cantidad * 1000 / 3);
        } else {
            cantidad_unidades = cantidad;
            cantidad_kg = cantidad * 3 / 1000;
        }
    } else {
        if(unidad === 'cm3'){
            cantidad_kg = (cantidad / 1000) * DENSIDAD_LIQUIDO;
        } else {
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