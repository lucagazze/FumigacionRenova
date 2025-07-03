import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';


requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- DOM Elements ---
const tituloPagina = document.getElementById('tituloPagina');
const unidadProducto = document.getElementById('unidadProducto');

const depositoContainer = document.getElementById('depositoContainer');
const deposito = document.getElementById('deposito');
const modalidad = document.getElementById('modalidad');
const toneladasContainer = document.getElementById('toneladasContainer');
const toneladasInput = document.getElementById('toneladas');
const camionesContainer = document.getElementById('camionesContainer');
const camionesInput = document.getElementById('camiones');
const tratamiento = document.getElementById('tratamiento');
const resultadoProducto = document.getElementById('resultadoProducto');
const btnRegistrar = document.getElementById('btnRegistrar');

const resumenDepositoContainer = document.getElementById('resumenDepositoContainer');
const resumenDeposito = document.getElementById('resumenDeposito');
const resumenModalidad = document.getElementById('resumenModalidad');
const resumenToneladas = document.getElementById('resumenToneladas');
const resumenTratamiento = document.getElementById('resumenTratamiento');
const resumenDosis = document.getElementById('resumenDosis');
const resumenTotal = document.getElementById('resumenTotal');

let operacionActual = {};

function calcularProducto() {
  const metodo = operacionActual.metodo_fumigacion;
  if (!metodo) return 0;
  
  let toneladas = 0;
  if (modalidad.value === 'trasilado') {
    toneladas = Number(toneladasInput.value) || 0;
  } else if (modalidad.value === 'descarga') {
    toneladas = (Number(camionesInput.value) || 0) * 28;
  }

  let cantidad = 0;
  if (metodo === 'pastillas') {
    if (tratamiento.value === 'preventivo') cantidad = toneladas * 2;
    else if (tratamiento.value === 'curativo') cantidad = toneladas * 3;
  } else if (metodo === 'liquido') {
    if (tratamiento.value === 'preventivo') cantidad = toneladas * 12;
    else if (tratamiento.value === 'curativo') cantidad = toneladas * 20;
  }
  
  resultadoProducto.textContent = cantidad > 0 ? cantidad.toLocaleString() : '-';
  return cantidad;
}

function getResumenTextos() {
    let modalidadTxt = modalidad.value === 'trasilado' ? 'Trasilado' : (modalidad.value === 'descarga' ? 'Descarga de camiones' : '-');
    let toneladas = 0;
    if (modalidad.value === 'trasilado') toneladas = Number(toneladasInput.value) || 0;
    if (modalidad.value === 'descarga') toneladas = (Number(camionesInput.value) || 0) * 28;
    
    let tratamientoTxt = tratamiento.value === 'preventivo' ? 'Preventivo' : (tratamiento.value === 'curativo' ? 'Curativo' : '-');
    let dosis = '-';
    let cantidad = calcularProducto();
    let unidadLabel = '-';
    
    if (operacionActual.metodo_fumigacion === 'pastillas') {
        unidadLabel = 'pastillas';
        if (tratamiento.value === 'preventivo') dosis = '2 pastillas/tn';
        else if (tratamiento.value === 'curativo') dosis = '3 pastillas/tn';
    } else if (operacionActual.metodo_fumigacion === 'liquido') {
        unidadLabel = 'cm³';
        if (tratamiento.value === 'preventivo') dosis = '12 cm³/tn';
        else if (tratamiento.value === 'curativo') dosis = '20 cm³/tn';
    }
    
    return { modalidadTxt, toneladas, tratamientoTxt, dosis, cantidad, unidadLabel };
}

function mostrarResumenAuto() {
  const { modalidadTxt, toneladas, tratamientoTxt, dosis, cantidad, unidadLabel } = getResumenTextos();
  resumenDeposito.textContent = deposito.value || '-';
  resumenModalidad.textContent = modalidadTxt;
  resumenToneladas.textContent = toneladas.toLocaleString() || '-';
  resumenTratamiento.textContent = tratamientoTxt;
  resumenDosis.textContent = dosis;
  resumenTotal.textContent = cantidad > 0 ? `${cantidad.toLocaleString()} ${unidadLabel}` : '-';
}

async function getOperacionActual() {
  const id = localStorage.getItem('operacion_actual');
  if (!id) return null;
  const { data, error } = await supabase.from('operaciones').select('*').eq('id', id).single();
  if (error) {
    console.error('Error fetching operacion:', error);
    return null;
  }
  return data;
}

async function setupPage() {
  operacionActual = await getOperacionActual();
  if (!operacionActual) {
      alert('No se encontró una operación activa.');
      window.location.href = 'home.html';
      return;
  }

  const metodo = operacionActual.metodo_fumigacion;

  if (metodo === 'pastillas') {
      tituloPagina.textContent = 'Registrar Pastillas Usadas';
      unidadProducto.textContent = 'pastillas';
      depositoContainer.classList.remove('hidden');
      resumenDepositoContainer.classList.remove('hidden');
      btnRegistrar.textContent = 'Registrar Aplicación y Descontar Stock';
  } else if (metodo === 'liquido') {
      tituloPagina.textContent = 'Registrar Líquido Usado';
      unidadProducto.textContent = 'cm³';
      depositoContainer.classList.add('hidden'); // No se descuenta stock de líquido por ahora
      resumenDepositoContainer.classList.add('hidden');
      btnRegistrar.textContent = 'Registrar Aplicación';
  }

  // Pre-fill form if data exists
  if (operacionActual.deposito) deposito.value = operacionActual.deposito;
  if (operacionActual.modalidad) {
    modalidad.value = operacionActual.modalidad;
    modalidad.dispatchEvent(new Event('change'));
    if (operacionActual.modalidad === 'trasilado') toneladasInput.value = operacionActual.toneladas || '';
    else if (operacionActual.modalidad === 'descarga') camionesInput.value = operacionActual.camiones || '';
  }
  if (operacionActual.tratamiento) tratamiento.value = operacionActual.tratamiento;
  
  mostrarResumenAuto();
}

btnRegistrar.addEventListener('click', async () => {
  const { cantidad, toneladas, unidadLabel } = getResumenTextos();
  const metodo = operacionActual.metodo_fumigacion;

  const currentUser = getUser();
  if (!currentUser) {
    alert("Error de autenticación. Por favor, inicie sesión de nuevo.");
    return;
  }

  if (!modalidad.value || !tratamiento.value || cantidad <= 0) {
    alert('Complete todos los campos y asegúrese de que la cantidad de producto sea válida.');
    return;
  }

  if (metodo === 'pastillas') {
      const depositoSeleccionado = deposito.value;
      if (!depositoSeleccionado) {
          alert('Por favor, seleccione un depósito.');
          return;
      }
      const cantidadEnGramos = cantidad * 3;

      const { data: stockData, error: stockError } = await supabase
        .from('stock').select('id, cantidad_gramos').eq('deposito', depositoSeleccionado).single();

      if (stockError || !stockData) {
        alert('No se pudo obtener el stock del depósito ' + depositoSeleccionado);
        return;
      }
      if (stockData.cantidad_gramos < cantidadEnGramos) {
        alert(`No hay suficiente stock en ${depositoSeleccionado}. Se necesitan ${cantidadEnGramos} gr y hay ${stockData.cantidad_gramos} gr.`);
        return;
      }
      
      const nuevaCantidad = stockData.cantidad_gramos - cantidadEnGramos;
      const { error: updateError } = await supabase
        .from('stock').update({ cantidad_gramos: nuevaCantidad }).eq('id', stockData.id);

      if (updateError) {
        alert('Error al actualizar el stock.');
        return;
      }
      
      const { error: historyError } = await supabase
        .from('historial_stock').insert([{ tipo: 'uso', deposito: depositoSeleccionado, cantidad_gramos: cantidadEnGramos }]);

      if (historyError) console.error('Error inserting stock history:', historyError);
  }

  const nuevoRegistro = {
    operacion_original_id: operacionActual.operacion_original_id || operacionActual.id,
    cliente: operacionActual.cliente,
    area_tipo: operacionActual.area_tipo,
    silo: operacionActual.silo,
    celda: operacionActual.celda,
    mercaderia: operacionActual.mercaderia,
    estado: 'en curso',
    deposito: metodo === 'pastillas' ? deposito.value : null,
    metodo_fumigacion: metodo,
    producto_usado_cantidad: cantidad,
    tipo_registro: 'producto',
    operario_nombre: currentUser.name, // CORRECCIÓN: Usar el nombre del usuario actual
    tratamiento: tratamiento.value,
    toneladas: toneladas,
  };

  const { error: insertError } = await supabase.from('operaciones').insert([nuevoRegistro]);

  if (insertError) {
    alert('Error al guardar el registro del producto.');
    // Rollback stock if insert fails
    if (metodo === 'pastillas') {
        const { data: stockData } = await supabase.from('stock').select('id, cantidad_gramos').eq('deposito', deposito.value).single();
        await supabase.from('stock').update({ cantidad_gramos: stockData.cantidad_gramos + (cantidad*3) }).eq('id', stockData.id);
    }
    return;
  }
  
  alert(`Registro de ${cantidad} ${unidadLabel} guardado correctamente.`);
  window.location.href = 'operacion.html';
});

// --- Event Listeners ---
modalidad.addEventListener('change', () => {
  if (modalidad.value === 'trasilado') {
    toneladasContainer.classList.remove('hidden');
    camionesContainer.classList.add('hidden');
  } else if (modalidad.value === 'descarga') {
    camionesContainer.classList.remove('hidden');
    toneladasContainer.classList.add('hidden');
  } else {
    toneladasContainer.classList.add('hidden');
    camionesContainer.classList.add('hidden');
  }
  calcularProducto();
  mostrarResumenAuto();
});

[toneladasInput, camionesInput, tratamiento, deposito, modalidad].forEach(el => {
    el.addEventListener('input', () => {
        calcularProducto();
        mostrarResumenAuto();
    });
    el.addEventListener('change', () => {
        calcularProducto();
        mostrarResumenAuto();
    });
});

document.addEventListener('DOMContentLoaded', setupPage);