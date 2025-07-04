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

    const { data, error } = await supabase
        .from('historial_stock')
        .select(`
            *,
            operaciones (
                deposito_id,
                depositos ( nombre, tipo )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching stock history:', error);
        historialStockEl.innerHTML = `<p class="text-red-500">Error al cargar historial: ${error.message}</p>`;
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
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Origen/Destino</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${data.map(item => {
                    const tipoClass = item.tipo_movimiento === 'adicion' ? 'text-green-600' : 'text-red-600';
                    let cantidadDetalle = '';

                    if (item.tipo_producto === 'pastillas') {
                        const kg = item.cantidad_kg_movido.toFixed(2);
                        cantidadDetalle = `<b>${item.cantidad_unidades_movidas?.toLocaleString() || 0} un.</b> (~${kg} Kg)`;
                    } else { // liquido
                        const litros = (item.cantidad_kg_movido / DENSIDAD_LIQUIDO).toFixed(2);
                        const cm3 = (litros * 1000).toLocaleString();
                        cantidadDetalle = `<b>${cm3} cm³</b> (~${litros} L)`;
                    }
                    
                    const depositoInfo = item.operaciones?.depositos;
                    const depositoUso = depositoInfo ? `${depositoInfo.nombre} (${depositoInfo.tipo})` : 'Operación';
                    
                    const origenDestino = item.tipo_movimiento === 'extraccion' && item.operacion_id 
                        ? `Uso en ${depositoUso}`
                        : `Inventario ${item.deposito}`;

                    const link = item.operacion_id ? `operacion_detalle.html?id=${item.operacion_id}` : '#';
                    const canEdit = item.descripcion && item.descripcion.toLowerCase().includes('manual');
                    
                    return `
                        <tr class="hover:bg-gray-50 ${item.operacion_id ? 'cursor-pointer' : ''}" onclick="${item.operacion_id ? `window.location.href='${link}'` : ''}">
                            <td class="px-4 py-2">${new Date(item.created_at).toLocaleString('es-AR')}</td>
                            <td class="px-4 py-2 font-bold ${tipoClass}">${item.tipo_movimiento.charAt(0).toUpperCase() + item.tipo_movimiento.slice(1)}</td>
                            <td class="px-4 py-2">${origenDestino}</td>
                            <td class="px-4 py-2">${item.tipo_producto.charAt(0).toUpperCase() + item.tipo_producto.slice(1)}</td>
                            <td class="px-4 py-2">${cantidadDetalle}</td>
                            <td class="px-4 py-2">
                                ${canEdit ? `
                                <button class="btn-edit-stock" data-id="${item.id}" title="Editar movimiento manual"><span class="material-icons text-blue-500 hover:text-blue-700">edit</span></button>
                                <button class="btn-delete-stock" data-id="${item.id}" title="Eliminar movimiento manual"><span class="material-icons text-red-500 hover:text-red-700">delete</span></button>
                                ` : ''}
                            </td>
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

historialStockEl.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.btn-edit-stock');
    const deleteButton = e.target.closest('.btn-delete-stock');

    if (editButton) {
        const id = editButton.dataset.id;
        const { data: registro } = await supabase.from('historial_stock').select('*').eq('id', id).single();
        if (registro) {
            renderEditStockModal(registro);
        }
    }

    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este registro? El stock será revertido.')) {
            await eliminarRegistroStock(id);
        }
    }
});

function renderEditStockModal(registro) {
    const isPastillas = registro.tipo_producto === 'pastillas';
    const cantidadLabel = isPastillas ? 'Unidades de Pastillas' : 'Litros (L) de Líquido';
    const currentValue = isPastillas 
        ? registro.cantidad_unidades_movidas 
        : (registro.cantidad_kg_movido / DENSIDAD_LIQUIDO).toFixed(3);

    const modalHTML = `
        <div id="edit-stock-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
                <button id="close-edit-stock-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                    <span class="material-icons">close</span>
                </button>
                <h4 class="text-2xl font-bold mb-4">Editar Movimiento Manual</h4>
                <form id="edit-stock-form" class="space-y-4">
                    <input type="hidden" id="edit-stock-id" value="${registro.id}">
                    <div>
                        <label for="edit-stock-cantidad" class="block font-semibold mb-1">${cantidadLabel}</label>
                        <input type="number" step="any" id="edit-stock-cantidad" class="input-field" value="${currentValue}">
                    </div>
                    <div class="flex justify-end gap-4 pt-4">
                        <button type="button" id="cancel-edit-stock" class="btn btn-secondary">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => document.getElementById('edit-stock-modal').remove();
    document.getElementById('close-edit-stock-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-stock').addEventListener('click', closeModal);
    document.getElementById('edit-stock-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-stock-modal') closeModal();
    });

    document.getElementById('edit-stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-stock-id').value;
        const newAmountInput = parseFloat(document.getElementById('edit-stock-cantidad').value);

        if (isNaN(newAmountInput) || newAmountInput < 0) {
            alert('Por favor, ingrese una cantidad válida.');
            return;
        }

        const { data: originalRecord, error: fetchError } = await supabase.from('historial_stock').select('*').eq('id', id).single();
        if (fetchError) {
            alert('Error al recuperar el registro original: ' + fetchError.message);
            return;
        }

        let new_kg_movido, new_unidades_movidas;
        const old_kg_movido = originalRecord.cantidad_kg_movido;
        
        if (isPastillas) {
            new_unidades_movidas = Math.round(newAmountInput);
            new_kg_movido = new_unidades_movidas * 3 / 1000;
        } else { // liquido
            new_unidades_movidas = null;
            new_kg_movido = newAmountInput * DENSIDAD_LIQUIDO;
        }

        const kg_difference = new_kg_movido - old_kg_movido;

        await updateStockFromEdit(originalRecord, kg_difference);
        
        const newDescription = `Compensación por edición manual. (ID original: ${id.substring(0,8)})`;
        const { error: updateError } = await supabase.from('historial_stock').update({
            cantidad_kg_movido: new_kg_movido,
            cantidad_unidades_movidas: new_unidades_movidas,
            descripcion: newDescription
        }).eq('id', id);

        if (updateError) {
            alert('Error al actualizar el registro de historial: ' + updateError.message);
        } else {
            alert('Registro y stock actualizados correctamente.');
            closeModal();
            renderStock();
            renderHistorialStock();
        }
    });
}

async function updateStockFromEdit(originalRecord, kg_difference) {
    const { data: stock, error: stockFetchError } = await supabase
        .from('stock')
        .select('*')
        .eq('deposito', originalRecord.deposito)
        .eq('tipo_producto', originalRecord.tipo_producto)
        .single();

    if (stockFetchError) {
        throw new Error('Error fatal: No se pudo encontrar el stock para ajustar. ' + stockFetchError.message);
    }

    const factor = originalRecord.tipo_movimiento === 'adicion' ? 1 : -1;
    const new_stock_kg = (stock.cantidad_kg || 0) + (kg_difference * factor);
    
    let new_stock_unidades = stock.cantidad_unidades;
    if (originalRecord.tipo_producto === 'pastillas') {
        new_stock_unidades = Math.round(new_stock_kg * 1000 / 3);
    }

    if (new_stock_kg < 0) {
        throw new Error('La edición resulta en stock negativo.');
    }

    const { error: updateError } = await supabase.from('stock').update({
        cantidad_kg: new_stock_kg,
        cantidad_unidades: new_stock_unidades
    }).eq('id', stock.id);

    if (updateError) {
        throw new Error('Error al actualizar el inventario principal: ' + updateError.message);
    }
}

async function eliminarRegistroStock(id) {
    const { data: registro, error: fetchError } = await supabase.from('historial_stock').select('*').eq('id', id).single();
    if (fetchError || !registro) {
        alert('No se pudo encontrar el registro a eliminar.');
        return;
    }

    try {
        const kg_a_revertir = registro.cantidad_kg_movido;
        await updateStockFromEdit(registro, -kg_a_revertir);

        const { error: deleteError } = await supabase.from('historial_stock').delete().eq('id', id);
        if (deleteError) {
            throw new Error('Error al eliminar el registro del historial: ' + deleteError.message + '. El stock ha sido revertido, pero el registro persiste. Contacte a soporte.');
        } else {
            alert('Registro eliminado y stock revertido correctamente.');
            renderStock();
            renderHistorialStock();
        }
    } catch (error) {
        alert('Falló la operación de eliminación: ' + error.message);
    }
}