import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const stockList = document.getElementById('stock-list');
const historialStockEl = document.getElementById('historial-stock');
const formAñadirStock = document.getElementById('formAñadirStock');
const formQuitarStock = document.getElementById('formQuitarStock');

// --- Helper para mostrar/ocultar info de gramos ---
function toggleGramosInfo(unitSelectId, infoId) {
    const select = document.getElementById(unitSelectId);
    const info = document.getElementById(infoId);
    select.addEventListener('change', () => {
        info.classList.toggle('hidden', select.value !== 'gramos');
    });
}
toggleGramosInfo('unidad', 'gramosInfo');
toggleGramosInfo('unidadQuitar', 'gramosInfoQuitar');


async function getStock() {
  const { data, error } = await supabase.from('stock').select('*');
  if (error) {
    console.error('Error fetching stock:', error);
    return {};
  }
  return data.reduce((acc, item) => {
    acc[item.deposito] = item.cantidad_gramos;
    return acc;
  }, {});
}

async function getHistorialStock() {
  const { data, error } = await supabase.from('historial_stock').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching stock history:', error);
    return [];
  }
  return data;
}

async function renderStock() {
  const stock = await getStock();
  if (stockList) {
    stockList.innerHTML = '';
    for (const deposito in stock) {
      const div = document.createElement('div');
      div.className = 'flex flex-col';
      const gramos = stock[deposito];
      const pastillas = Math.floor(gramos / 3);
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-medium">${deposito}</span>
        </div>
        <div class="pl-4">
            <p class="text-sm"><span class="font-bold text-lg">${gramos.toLocaleString()}</span> gr</p>
            <p class="text-sm text-gray-600">(~${pastillas.toLocaleString()} pastillas)</p>
        </div>
      `;
      stockList.appendChild(div);
    }
  }
}

async function renderHistorialStock() {
  if (!historialStockEl) return;
  const historial = await getHistorialStock();

  if (historial.length === 0) {
    historialStockEl.innerHTML = '<p class="text-center text-[var(--text-secondary)]">No hay registros de movimientos de stock.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'min-w-full divide-y divide-[var(--border-color)] bg-white';
  
  const thead = `
    <thead>
      <tr>
        <th class="px-4 py-2 text-left text-xs font-semibold text-[var(--muted-text-color)] uppercase">Fecha</th>
        <th class="px-4 py-2 text-left text-xs font-semibold text-[var(--muted-text-color)] uppercase">Tipo</th>
        <th class="px-4 py-2 text-left text-xs font-semibold text-[var(--muted-text-color)] uppercase">Depósito</th>
        <th class="px-4 py-2 text-left text-xs font-semibold text-[var(--muted-text-color)] uppercase">Cantidad (Gramos)</th>
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${historial.map(item => {
        let tipo, tipoClass;
        switch (item.tipo) {
          case 'adicion': tipo = 'Adición'; tipoClass = 'text-green-600'; break;
          case 'extraccion': tipo = 'Extracción'; tipoClass = 'text-yellow-600'; break;
          case 'uso': tipo = 'Uso'; tipoClass = 'text-red-600'; break;
        }
        return `
          <tr class="hover:bg-[var(--border-color)]">
            <td class="px-4 py-2">${new Date(item.created_at).toLocaleString('es-AR')}</td>
            <td class="px-4 py-2"><span class="font-bold ${tipoClass}">${tipo}</span></td>
            <td class="px-4 py-2">${item.deposito}</td>
            <td class="px-4 py-2">${item.cantidad_gramos.toLocaleString()} gr</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;

  table.innerHTML = thead + tbody;
  historialStockEl.innerHTML = '';
  historialStockEl.appendChild(table);
}

if (formAñadirStock) {
  formAñadirStock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deposito = document.getElementById('deposito').value;
    const cantidad = parseInt(document.getElementById('cantidad').value, 10);
    const unidad = document.getElementById('unidad').value;

    if (!deposito || !(cantidad > 0)) {
        alert('Por favor, complete todos los campos correctamente.');
        return;
    }
    
    let cantidadEnGramos = 0;
    if (unidad === 'pastillas') {
        cantidadEnGramos = cantidad * 3;
    } else { // gramos
        if (cantidad % 3 !== 0) {
            alert('La cantidad de gramos debe ser un múltiplo de 3.');
            return;
        }
        cantidadEnGramos = cantidad;
    }

    const { data: stockData, error: stockError } = await supabase
      .from('stock').select('id, cantidad_gramos').eq('deposito', deposito).single();

    if (stockError && stockError.code !== 'PGRST116') {
      console.error('Error fetching stock:', stockError);
      alert('Error al obtener el stock.');
      return;
    }

    const nuevaCantidad = (stockData?.cantidad_gramos || 0) + cantidadEnGramos;
    
    const { error: upsertError } = await supabase
      .from('stock').upsert({ id: stockData?.id, deposito, cantidad_gramos: nuevaCantidad }, { onConflict: 'deposito' });

    if (upsertError) {
      console.error('Error upserting stock:', upsertError);
      alert('Error al actualizar el stock.');
      return;
    }

    const { error: historyError } = await supabase
      .from('historial_stock').insert([{ tipo: 'adicion', deposito, cantidad_gramos: cantidadEnGramos }]);

    if (historyError) {
      console.error('Error inserting stock history:', historyError);
      alert('Error al registrar el historial de stock.');
      return;
    }

    await renderStock();
    await renderHistorialStock();
    formAñadirStock.reset();
    alert(`${cantidad} ${unidad} añadidas al stock de ${deposito}.`);
  });
}

if (formQuitarStock) {
  formQuitarStock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deposito = document.getElementById('depositoQuitar').value;
    const cantidad = parseInt(document.getElementById('cantidadQuitar').value, 10);
    const unidad = document.getElementById('unidadQuitar').value;

    if (!deposito || !(cantidad > 0)) {
      alert('Por favor, complete todos los campos correctamente.');
      return;
    }

    let cantidadEnGramos = 0;
    if (unidad === 'pastillas') {
        cantidadEnGramos = cantidad * 3;
    } else { // gramos
        if (cantidad % 3 !== 0) {
            alert('La cantidad de gramos debe ser un múltiplo de 3.');
            return;
        }
        cantidadEnGramos = cantidad;
    }

    const { data: stockData, error: stockError } = await supabase
      .from('stock').select('id, cantidad_gramos').eq('deposito', deposito).single();

    if (stockError) {
      console.error('Error fetching stock:', stockError);
      alert('Error al obtener el stock.');
      return;
    }

    if (stockData.cantidad_gramos < cantidadEnGramos) {
      alert('No hay suficiente stock para quitar esa cantidad.');
      return;
    }

    const nuevaCantidad = stockData.cantidad_gramos - cantidadEnGramos;

    const { error: updateError } = await supabase
      .from('stock').update({ cantidad_gramos: nuevaCantidad }).eq('id', stockData.id);

    if (updateError) {
      console.error('Error updating stock:', updateError);
      alert('Error al actualizar el stock.');
      return;
    }

    const { error: historyError } = await supabase
      .from('historial_stock').insert([{ tipo: 'extraccion', deposito, cantidad_gramos: cantidadEnGramos }]);

    if (historyError) {
      console.error('Error inserting stock history:', historyError);
      alert('Error al registrar el historial de stock.');
      return;
    }

    await renderStock();
    await renderHistorialStock();
    formQuitarStock.reset();
    alert(`${cantidad} ${unidad} quitadas del stock de ${deposito}.`);
  });
}

renderStock();
renderHistorialStock();