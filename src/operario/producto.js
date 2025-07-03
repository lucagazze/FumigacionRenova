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

let operacionActual = {};

async function setupPage() {
  const opId = localStorage.getItem('operacion_actual');
  if (!opId) { window.location.href = 'home.html'; return; }

  const { data, error } = await supabase.from('operaciones').select('*').eq('id', opId).single();
  if (error) { console.error(error); window.location.href = 'home.html'; return; }
  
  operacionActual = data;
  const metodo = operacionActual.metodo_fumigacion;

  if (metodo === 'pastillas') {
      tituloPagina.textContent = 'Registrar Pastillas Usadas';
      unidadProducto.textContent = 'pastillas';
      depositoFijoInfo.style.display = 'block';
  } else if (metodo === 'liquido') {
      tituloPagina.textContent = 'Registrar Líquido Usado';
      unidadProducto.textContent = 'cm³';
      depositoFijoInfo.style.display = 'block'; // Mostrar también para líquido
  }
  
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
        unidadLabel = 'cm³';
        if (tratamiento.value === 'preventivo') { dosis = '12 cm³/tn'; cantidad = toneladas * 12; }
        else if (tratamiento.value === 'curativo') { dosis = '20 cm³/tn'; cantidad = toneladas * 20; }
    }
    
    resultadoProducto.textContent = cantidad > 0 ? cantidad.toLocaleString() : '-';
    resumenModalidad.textContent = modalidad.options[modalidad.selectedIndex]?.text || '-';
    resumenToneladas.textContent = `${toneladas.toLocaleString()} tn`;
    resumenTratamiento.textContent = tratamiento.options[tratamiento.selectedIndex]?.text || '-';
    resumenDosis.textContent = dosis;
    resumenTotal.textContent = `${cantidad.toLocaleString()} ${unidadLabel}`;
}

modalidad.addEventListener('change', () => {
    toneladasContainer.style.display = modalidad.value === 'trasilado' ? 'block' : 'none';
    camionesContainer.style.display = modalidad.value === 'descarga' ? 'block' : 'none';
    updateCalculations();
});

[toneladasInput, camionesInput, tratamiento].forEach(el => el.addEventListener('input', updateCalculations));

btnRegistrar.addEventListener('click', async () => {
  const currentUser = getUser();
  if (!currentUser) { alert("Error de autenticación."); return; }
  
  let toneladas = 0;
  if (modalidad.value === 'trasilado') toneladas = Number(toneladasInput.value);
  else if (modalidad.value === 'descarga') toneladas = (Number(camionesInput.value) || 0) * 28;

  const cantidad = parseFloat(resultadoProducto.textContent.replace(/,/g, '')) || 0;

  if (!modalidad.value || !tratamiento.value || cantidad <= 0) {
    alert('Complete todos los campos y asegúrese de que la cantidad sea válida.');
    return;
  }
  
  const depositoOrigen = "Fagaz";
  
  if (operacionActual.metodo_fumigacion === 'pastillas') {
      const cantidadKg = (cantidad * 3) / 1000;
      
      const { data: stockData, error } = await supabase.rpc('descontar_stock_pastillas', {
          deposito_nombre: depositoOrigen,
          unidades_a_descontar: cantidad,
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
          cantidad_unidades_movidas: cantidad,
          cantidad_kg_movido: cantidadKg,
          descripcion: `Uso en operación por ${currentUser.name}`
      }]);

  } else if (operacionActual.metodo_fumigacion === 'liquido') {
      // --- INICIO: Lógica para descontar líquido ---
      const DENSIDAD_LIQUIDO = 1.2; // g/cm³ -> kg/L
      const cantidadKg = (cantidad * DENSIDAD_LIQUIDO) / 1000; // Convertir cm³ a kg

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
          descripcion: `Uso en operación por ${currentUser.name}`
      }]);
      // --- FIN: Lógica para descontar líquido ---
  }

  const { error: insertError } = await supabase.from('operaciones').insert([{
    operacion_original_id: operacionActual.id,
    cliente_id: operacionActual.cliente_id,
    deposito_id: operacionActual.deposito_id,
    mercaderia_id: operacionActual.mercaderia_id,
    estado: 'en curso',
    deposito_origen_stock: depositoOrigen,
    metodo_fumigacion: operacionActual.metodo_fumigacion,
    producto_usado_cantidad: cantidad,
    tipo_registro: 'producto',
    operario_nombre: currentUser.name,
    tratamiento: tratamiento.value,
    modalidad: modalidad.value,
    toneladas: toneladas
  }]);

  if (insertError) {
    alert('Error al guardar el registro de aplicación.');
    console.error(insertError);
    // Idealmente aquí se haría un rollback del stock si la inserción falla.
    return;
  }
  
  alert(`Registro de aplicación guardado y stock descontado correctamente.`);
  window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', setupPage);