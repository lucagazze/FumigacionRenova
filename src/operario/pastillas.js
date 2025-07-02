import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const modalidad = document.getElementById('modalidad');
const toneladasContainer = document.getElementById('toneladasContainer');
const toneladasInput = document.getElementById('toneladas');
const camionesContainer = document.getElementById('camionesContainer');
const camionesInput = document.getElementById('camiones');
const tratamiento = document.getElementById('tratamiento');
const resultadoPastillas = document.getElementById('resultadoPastillas');
const btnRegistrar = document.getElementById('btnRegistrar');
const deposito = document.getElementById('deposito');
const resumenDeposito = document.getElementById('resumenDeposito');
const resumenModalidad = document.getElementById('resumenModalidad');
const resumenToneladas = document.getElementById('resumenToneladas');
const resumenTratamiento = document.getElementById('resumenTratamiento');
const resumenDosis = document.getElementById('resumenDosis');
const resumenTotal = document.getElementById('resumenTotal');

let operacionActual = {};

function calcularPastillas() {
  let toneladas = 0;
  if (modalidad.value === 'trasilado') {
    toneladas = Number(toneladasInput.value) || 0;
  } else if (modalidad.value === 'descarga') {
    toneladas = (Number(camionesInput.value) || 0) * 28;
  }
  let pastillas = 0;
  if (tratamiento.value === 'preventivo') {
    pastillas = toneladas * 2;
  } else if (tratamiento.value === 'curativo') {
    pastillas = toneladas * 3;
  }
  resultadoPastillas.textContent = pastillas > 0 ? pastillas : '-';
  return pastillas;
}

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
  calcularPastillas();
});
toneladasInput.addEventListener('input', calcularPastillas);
camionesInput.addEventListener('input', calcularPastillas);
tratamiento.addEventListener('change', calcularPastillas);

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

async function setInputsFromOperacion() {
  operacionActual = await getOperacionActual();
  if (!operacionActual) return;

  if (operacionActual.deposito) deposito.value = operacionActual.deposito;
  if (operacionActual.modalidad) {
    modalidad.value = operacionActual.modalidad;
    modalidad.dispatchEvent(new Event('change'));
    if (operacionActual.modalidad === 'trasilado') {
      toneladasInput.value = operacionActual.toneladas || '';
    } else if (operacionActual.modalidad === 'descarga') {
      camionesInput.value = operacionActual.camiones || '';
    }
  }
  if (operacionActual.tratamiento) tratamiento.value = operacionActual.tratamiento;
  mostrarResumenAuto();
}

function mostrarResumenAuto() {
  const { modalidadTxt, toneladas, tratamientoTxt, dosis, pastillas } = getResumenTextos();
  resumenDeposito.textContent = deposito.value || '-';
  resumenModalidad.textContent = modalidadTxt;
  resumenToneladas.textContent = toneladas || '-';
  resumenTratamiento.textContent = tratamientoTxt;
  resumenDosis.textContent = dosis;
  resumenTotal.textContent = pastillas > 0 ? pastillas : '-';
}

function getResumenTextos() {
  let modalidadTxt = modalidad.value === 'trasilado' ? 'Trasilado' : (modalidad.value === 'descarga' ? 'Descarga de camiones' : '-');
  let toneladas = 0;
  if (modalidad.value === 'trasilado') toneladas = Number(toneladasInput.value) || 0;
  if (modalidad.value === 'descarga') toneladas = (Number(camionesInput.value) || 0) * 28;
  let tratamientoTxt = tratamiento.value === 'preventivo' ? 'Preventivo' : (tratamiento.value === 'curativo' ? 'Curativo' : '-');
  let dosis = tratamiento.value === 'preventivo' ? '2 pastillas/tn' : (tratamiento.value === 'curativo' ? '3 pastillas/tn' : '-');
  let pastillas = calcularPastillas();
  return { modalidadTxt, toneladas, tratamientoTxt, dosis, pastillas };
}

deposito.addEventListener('change', mostrarResumenAuto);
modalidad.addEventListener('change', mostrarResumenAuto);
toneladasInput.addEventListener('input', mostrarResumenAuto);
camionesInput.addEventListener('input', mostrarResumenAuto);
tratamiento.addEventListener('change', mostrarResumenAuto);

btnRegistrar.addEventListener('click', async () => {
  const { pastillas, toneladas } = getResumenTextos();
  if (!deposito.value || !modalidad.value || !tratamiento.value || pastillas <= 0) {
    alert('Complete todos los campos y asegúrese de que la cantidad de pastillas sea válida.');
    return;
  }

  const depositoSeleccionado = deposito.value;

  const { data: stockData, error: stockError } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('deposito', depositoSeleccionado)
    .single();

  if (stockError || !stockData) {
    alert('No se pudo obtener el stock del depósito ' + depositoSeleccionado);
    return;
  }
  if (stockData.cantidad < pastillas) {
    alert('No hay suficiente stock de pastillas en el depósito ' + depositoSeleccionado + '.');
    return;
  }
  
  const nuevaCantidad = stockData.cantidad - pastillas;
  const { error: updateError } = await supabase
    .from('stock')
    .update({ cantidad: nuevaCantidad })
    .eq('id', stockData.id);

  if (updateError) {
    alert('Error al actualizar el stock.');
    return;
  }

  const nuevoRegistro = {
    cliente: operacionActual.cliente,
    area_tipo: operacionActual.area_tipo,
    silo: operacionActual.silo,
    celda: operacionActual.celda,
    mercaderia: operacionActual.mercaderia,
    estado: 'en curso',
    deposito: depositoSeleccionado,
    pastillas: pastillas,
    tipo_registro: 'pastillas',
    operario: operacionActual.operario,
    tratamiento: tratamiento.value,
    toneladas: toneladas,
    operacion_original_id: operacionActual.operacion_original_id || operacionActual.id,
  };

  const { error: insertError } = await supabase.from('operaciones').insert([nuevoRegistro]);

  if (insertError) {
    alert('Error al guardar el registro de pastillas.');
    await supabase.from('stock').update({ cantidad: stockData.cantidad }).eq('id', stockData.id);
    return;
  }

  const { error: historyError } = await supabase
    .from('historial_stock')
    .insert([{ tipo: 'uso', deposito: depositoSeleccionado, cantidad: pastillas }]);

  if (historyError) {
    console.error('Error inserting stock history:', historyError);
  }

  alert('Registro de pastillas guardado y stock descontado correctamente.');
  window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', setInputsFromOperacion);
