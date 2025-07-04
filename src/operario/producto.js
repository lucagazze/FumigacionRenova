import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const tituloPagina = document.getElementById('tituloPagina');
const unidadProducto = document.getElementById('unidadProducto');
const depositoFijoInfo = document.getElementById('depositoFijoInfo');
const modalidad = document.getElementById('modalidad');
const toneladasContainer = document.getElementById('toneladasContainer');
const toneladasInput = document.getElementById('toneladas');
const camionesContainer = document.getElementById('camionesContainer');
const camionesInput = document.getElementById('camiones');
const tratamiento = document.getElementById('tratamiento');
const resultadoProducto = document.getElementById('resultadoProducto');
const btnRegistrar = document.getElementById('btnRegistrar');
const resumenModalidad = document.getElementById('resumenModalidad');
const resumenToneladas = document.getElementById('resumenToneladas');
const resumenTratamiento = document.getElementById('resumenTratamiento');
const resumenDosis = document.getElementById('resumenDosis');
const resumenTotal = document.getElementById('resumenTotal');
const conCompaneroCheckbox = document.getElementById('conCompanero');
const companeroContainer = document.getElementById('companeroContainer');
const companeroList = document.getElementById('companero-list');
const selectedCompanerosEl = document.getElementById('selected-companeros');

let operacionActual = {};
let cantidadSinFormato = 0;

async function poblarCompaneros() {
    const { data, error } = await supabase.from('usuarios').select('id, nombre, apellido').eq('role', 'operario');
    if (error) { console.error(error); return; }
    const currentUser = getUser();
    data.forEach(c => {
        if (c.id !== currentUser.id) {
            companeroList.innerHTML += `
                <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                    <input type="checkbox" name="companero" value="${c.nombre} ${c.apellido}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                    <span>${c.nombre} ${c.apellido}</span>
                </label>
            `;
        }
    });
}

async function setupPage() {
  const opId = localStorage.getItem('operacion_actual');
  if (!opId) { window.location.href = 'home.html'; return; }

  const { data, error } = await supabase.from('operaciones').select('*').eq('id', opId).single();
  if (error) { console.error(error); window.location.href = 'home.html'; return; }
  
  operacionActual = data;
  const metodo = operacionActual.metodo_fumigacion;
  const depositoOrigen = operacionActual.deposito_origen_stock || 'Fagaz'; // Fallback por si no está definido

  if (metodo === 'pastillas') {
      tituloPagina.textContent = 'Registrar Pastillas Usadas';
      unidadProducto.textContent = 'pastillas';
  } else if (metodo === 'liquido') {
      tituloPagina.textContent = 'Registrar Líquido Usado';
      unidadProducto.textContent = 'L'; // Cambiado a Litros
  }
  
  depositoFijoInfo.querySelector('b').textContent = depositoOrigen;
  depositoFijoInfo.style.display = 'block';
  
  poblarCompaneros();
  updateCalculations();
}

function updateCalculations() {
    let toneladas = 0;
    if (modalidad.value === 'trasilado') {
        toneladas = Number(toneladasInput.value) || 0;
    } else if (modalidad.value === 'descarga') {
        toneladas = (Number(camionesInput.value) || 0) * 28;
    }

    let cantidad = 0;
    let dosis = '-';
    let unidadLabel = '-';
    const metodo = operacionActual.metodo_fumigacion;

    if (metodo === 'pastillas') {
        unidadLabel = 'pastillas';
        if (tratamiento.value === 'preventivo') { dosis = '2 pastillas/tn'; cantidad = toneladas * 2; }
        else if (tratamiento.value === 'curativo') { dosis = '3 pastillas/tn'; cantidad = toneladas * 3; }
    } else if (metodo === 'liquido') {
        unidadLabel = 'L';
        if (tratamiento.value === 'preventivo') { dosis = '12 cm³/tn'; cantidad = (toneladas * 12) / 1000; }
        else if (tratamiento.value === 'curativo') { dosis = '20 cm³/tn'; cantidad = (toneladas * 20) / 1000; }
    }
    
    cantidadSinFormato = cantidad; // Guardar el valor sin formato
    if (metodo === 'pastillas') {
        resultadoProducto.textContent = cantidad > 0 ? Math.round(cantidad).toLocaleString('es-AR') : '-';
    } else {
        resultadoProducto.textContent = cantidad > 0 ? cantidad.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    }
    resumenModalidad.textContent = modalidad.options[modalidad.selectedIndex]?.text || '-';
    resumenToneladas.textContent = `${toneladas.toLocaleString()} tn`;
    resumenTratamiento.textContent = tratamiento.options[tratamiento.selectedIndex]?.text || '-';
    resumenDosis.textContent = dosis;
    resumenTotal.textContent = `${resultadoProducto.textContent} ${unidadLabel}`;
}

modalidad.addEventListener('change', () => {
    toneladasContainer.style.display = modalidad.value === 'trasilado' ? 'block' : 'none';
    camionesContainer.style.display = modalidad.value === 'descarga' ? 'block' : 'none';
    updateCalculations();
});

[toneladasInput, camionesInput, tratamiento].forEach(el => el.addEventListener('input', updateCalculations));

conCompaneroCheckbox.addEventListener('change', () => {
    companeroContainer.classList.toggle('hidden', !conCompaneroCheckbox.checked);
});

companeroList.addEventListener('change', () => {
    const selected = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);
    selectedCompanerosEl.textContent = selected.length > 0 ? selected.join(', ') : 'Ninguno';
});

btnRegistrar.addEventListener('click', async () => {
  const currentUser = getUser();
  if (!currentUser) { alert("Error de autenticación."); return; }
  
  let toneladas = 0;
  if (modalidad.value === 'trasilado') toneladas = Number(toneladasInput.value);
  else if (modalidad.value === 'descarga') toneladas = (Number(camionesInput.value) || 0) * 28;

  const metodo = operacionActual.metodo_fumigacion;
  let cantidadAUsar = cantidadSinFormato;

  if (metodo === 'pastillas') {
    cantidadAUsar = Math.round(cantidadSinFormato);
  } else if (metodo === 'liquido') {
    // En líquidos, la cantidad está en litros, la pasamos a cm³ para la BD
    cantidadAUsar = cantidadSinFormato * 1000;
  }

  if (!modalidad.value || !tratamiento.value || cantidadAUsar <= 0) {
    alert('Complete todos los campos y asegúrese de que la cantidad sea válida.');
    return;
  }
  
  const depositoOrigen = operacionActual.deposito_origen_stock || "Fagaz";
  
  if (operacionActual.metodo_fumigacion === 'pastillas') {
      const cantidadKg = (cantidadAUsar * 3) / 1000;
      
      const { data: stockData, error } = await supabase.rpc('descontar_stock_pastillas', {
          deposito_nombre: depositoOrigen,
          unidades_a_descontar: cantidadAUsar,
          kg_a_descontar: cantidadKg
      });
      
      if (error || (stockData && stockData.error)) {
          alert(`Error al descontar stock: ${error?.message || stockData.error}`);
          return;
      }

      await supabase.from('historial_stock').insert([{
          tipo_movimiento: 'uso',
          deposito: depositoOrigen,
          tipo_producto: 'pastillas',
          cantidad_unidades_movidas: cantidadAUsar,
          cantidad_kg_movido: cantidadKg,
          descripcion: `Uso en operación por ${currentUser.nombre} ${currentUser.apellido}`
      }]);

  } else if (operacionActual.metodo_fumigacion === 'liquido') {
      const DENSIDAD_LIQUIDO = 1.2; // g/cm³ -> kg/L
      const cantidadKg = (cantidadAUsar * DENSIDAD_LIQUIDO) / 1000;

      const { data: stockActual, error: fetchError } = await supabase
        .from('stock')
        .select('id, cantidad_kg')
        .eq('deposito', depositoOrigen)
        .eq('tipo_producto', 'liquido')
        .single();

      if (fetchError) {
          alert('Error al obtener el stock de líquido.');
          console.error(fetchError);
          return;
      }
      
      if (stockActual.cantidad_kg < cantidadKg) {
          alert(`No hay suficiente stock de líquido en ${depositoOrigen}. Stock actual: ${stockActual.cantidad_kg.toFixed(2)} Kg. Necesario: ${cantidadKg.toFixed(2)} Kg.`);
          return;
      }

      const nuevoStockKg = stockActual.cantidad_kg - cantidadKg;
      const { error: updateError } = await supabase
        .from('stock')
        .update({ cantidad_kg: nuevoStockKg })
        .eq('id', stockActual.id);
        
      if (updateError) {
          alert('Error al actualizar el stock de líquido.');
          console.error(updateError);
          return;
      }

      await supabase.from('historial_stock').insert([{
          tipo_movimiento: 'uso',
          deposito: depositoOrigen,
          tipo_producto: 'liquido',
          cantidad_kg_movido: cantidadKg,
          cantidad_unidades_movidas: null,
          descripcion: `Uso en operación por ${currentUser.nombre} ${currentUser.apellido}`
      }]);
  }

  const { data: newOperationData, error: insertError } = await supabase.from('operaciones').insert([{
    operacion_original_id: operacionActual.id,
    cliente_id: operacionActual.cliente_id,
    deposito_id: operacionActual.deposito_id,
    mercaderia_id: operacionActual.mercaderia_id,
    estado: 'en curso',
    deposito_origen_stock: depositoOrigen,
    metodo_fumigacion: operacionActual.metodo_fumigacion,
    producto_usado_cantidad: cantidadAUsar,
    tipo_registro: 'producto',
    operario_nombre: conCompaneroCheckbox.checked ? `${currentUser.nombre} ${currentUser.apellido} y ${Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value).join(', ')}` : `${currentUser.nombre} ${currentUser.apellido}`,
    tratamiento: tratamiento.value,
    modalidad: modalidad.value,
    toneladas: toneladas
  }]).select();

  if (insertError || !newOperationData || newOperationData.length === 0) {
    alert('Error al guardar el registro de aplicación.');
    console.error(insertError);
    // Aquí deberías considerar revertir el descuento de stock si la inserción de la operación falla.
    return;
  }

  const newOperationId = newOperationData[0].id;

  // Ahora que tenemos el ID de la operación, lo usamos para actualizar el historial de stock.
  const { error: historialUpdateError } = await supabase
    .from('historial_stock')
    .update({ operacion_id: newOperationId })
    .order('created_at', { ascending: false })
    .limit(1);

  if (historialUpdateError) {
      console.warn("No se pudo vincular el historial de stock a la operación:", historialUpdateError.message);
      // No es un error fatal, pero es bueno saberlo.
  }
  
  alert(`Registro de aplicación guardado y stock descontado correctamente.`);
  window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', setupPage);
