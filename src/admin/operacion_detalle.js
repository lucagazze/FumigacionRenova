import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const btnVolver = document.getElementById('btnVolver');
const btnHabilitarEdicion = document.getElementById('btnHabilitarEdicion');
const btnCancelar = document.getElementById('btnCancelar');
const resumenOperacion = document.getElementById('resumenOperacion');
const formOperacion = document.getElementById('formOperacion');
const checklistContainer = document.getElementById('checklist-container');

const urlParams = new URLSearchParams(window.location.search);
const operacionId = urlParams.get('id');

let operacionActual = {};

async function cargarOperacion() {
  if (!operacionId) {
    alert('ID de operación no encontrado.');
    window.location.href = 'dashboard.html';
    return;
  }

  const { data, error } = await supabase.from('operaciones').select('*').eq('id', operacionId).single();

  if (error) {
    console.error('Error cargando la operación:', error);
    alert('No se pudo cargar la operación.');
    return;
  }
  operacionActual = data;

  const idChecklist = operacionActual.operacion_original_id || operacionActual.id;
  const { data: checklistData, error: checklistError } = await supabase
    .from('checklist_items').select('*').eq('operacion_id', idChecklist);

  if (checklistError) {
    console.error('Error cargando el checklist:', checklistError);
  } else {
    operacionActual.checklist_items = checklistData;
  }

  await renderResumen();
  renderFormulario();
}

async function renderResumen() {
  document.getElementById('resumen-cliente').textContent = operacionActual.cliente || 'N/A';
  document.getElementById('resumen-area').textContent = operacionActual.silo || operacionActual.celda || 'N/A';
  document.getElementById('resumen-mercaderia').textContent = operacionActual.mercaderia || 'N/A';
  document.getElementById('resumen-tratamiento').textContent = operacionActual.tratamiento || 'N/A';
  document.getElementById('resumen-toneladas').textContent = operacionActual.toneladas ? `${operacionActual.toneladas} tn` : 'N/A';
  document.getElementById('resumen-operario').textContent = operacionActual.operario_nombre || 'N/A';
  
  // --- CÁLCULO DE PRODUCTO TOTAL ---
  let totalProducto = 0;
  const operacionIdReferencia = operacionActual.operacion_original_id || operacionActual.id;
  const { data: registrosProducto, error } = await supabase
      .from('operaciones')
      .select('producto_usado_cantidad')
      .eq('operacion_original_id', operacionIdReferencia)
      .eq('tipo_registro', 'producto');
  
  if (error) {
      console.error('Error cargando registros de producto:', error);
  } else {
      totalProducto = registrosProducto.reduce((sum, registro) => sum + (registro.producto_usado_cantidad || 0), 0);
  }
  // --- FIN CÁLCULO ---

  const unidadLabel = operacionActual.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

  // Mostrar producto de este registro específico (si aplica)
  const productoRegistroFila = document.getElementById('resumen-producto-registro-fila');
  const productoRegistroCell = document.getElementById('resumen-producto-registro');
  if (operacionActual.tipo_registro === 'producto' && operacionActual.producto_usado_cantidad) {
      productoRegistroCell.textContent = `${operacionActual.producto_usado_cantidad.toLocaleString()} ${unidadLabel}`;
      productoRegistroFila.classList.remove('hidden');
  } else {
      productoRegistroFila.classList.add('hidden');
  }
  
  // Mostrar producto total de la operación
  const productoTotalCell = document.getElementById('resumen-producto-total');
  if(productoTotalCell) {
    productoTotalCell.textContent = totalProducto > 0 ? `${totalProducto.toLocaleString()} ${unidadLabel}` : 'N/A';
  }
  
  document.getElementById('resumen-estado').textContent = operacionActual.estado || 'N/A';
  document.getElementById('resumen-fechaInicio').textContent = operacionActual.created_at ? new Date(operacionActual.created_at).toLocaleString('es-AR') : 'N/A';
  document.getElementById('resumen-fechaCierre').textContent = operacionActual.estado === 'finalizada' && operacionActual.updated_at ? new Date(operacionActual.updated_at).toLocaleString('es-AR') : 'Pendiente';

  const checklistHtml = (operacionActual.checklist_items || []).map(item => `
    <div class="flex justify-between items-center p-3 border-b">
      <div><span class="font-medium">${item.item}</span><span class="ml-2 text-sm ${item.completado ? 'text-green-600' : 'text-red-600'}">${item.completado ? 'Completado' : 'Pendiente'}</span></div>
      ${item.imagen_url ? `<a href="${item.imagen_url}" target="_blank" class="flex items-center gap-2 text-blue-600 hover:underline"><span class="material-icons">image</span><span>Ver Evidencia</span></a>` : '<span class="text-gray-400">Sin Evidencia</span>'}
    </div>`).join('');
  
  checklistContainer.innerHTML = checklistHtml || '<p class="text-gray-500">No hay ítems en el checklist para esta operación.</p>';
}

function renderFormulario() {
  document.getElementById('operario').value = operacionActual.operario_nombre || '';
  document.getElementById('cliente').value = operacionActual.cliente || '';
  document.getElementById('deposito').value = operacionActual.deposito || '';
  document.getElementById('area').value = operacionActual.silo || operacionActual.celda || '';
  document.getElementById('mercaderia').value = operacionActual.mercaderia || '';
  document.getElementById('tratamiento').value = operacionActual.tratamiento || '';
  document.getElementById('toneladas').value = operacionActual.toneladas || '';
  document.getElementById('producto').value = operacionActual.producto_usado_cantidad || '';
  document.getElementById('estado').value = operacionActual.estado || '';
}

btnHabilitarEdicion.addEventListener('click', () => {
  resumenOperacion.classList.add('hidden');
  formOperacion.classList.remove('hidden');
});

btnCancelar.addEventListener('click', () => {
  formOperacion.classList.add('hidden');
  resumenOperacion.classList.remove('hidden');
});

btnVolver.addEventListener('click', () => { window.location.href = 'dashboard.html'; });

btnEliminar.addEventListener('click', async () => {
  if (confirm('¿Está seguro? Esta acción eliminará este registro y todos los registros asociados (aplicaciones de producto, finalización, checklist). NO SE PUEDE DESHACER.')) {
    
    const operacionOriginalId = operacionActual.operacion_original_id || operacionActual.id;
    
    // Delete all associated records
    await supabase.from('operaciones').delete().eq('operacion_original_id', operacionOriginalId);
    
    // Delete the main record
    const { error } = await supabase.from('operaciones').delete().eq('id', operacionOriginalId);

    if (error) {
      console.error('Error eliminando la operación:', error);
      alert('No se pudo eliminar la operación.');
    } else {
      alert('Operación y todos sus registros asociados eliminados correctamente.');
      window.location.href = 'dashboard.html';
    }
  }
});

formOperacion.addEventListener('submit', async (e) => {
  e.preventDefault();
  const updates = {
    operario_nombre: document.getElementById('operario').value,
    cliente: document.getElementById('cliente').value,
    deposito: document.getElementById('deposito').value,
    [operacionActual.area_tipo === 'silo' ? 'silo' : 'celda']: document.getElementById('area').value,
    mercaderia: document.getElementById('mercaderia').value,
    tratamiento: document.getElementById('tratamiento').value,
    toneladas: parseInt(document.getElementById('toneladas').value, 10),
    producto_usado_cantidad: parseInt(document.getElementById('producto').value, 10),
    estado: document.getElementById('estado').value,
  };

  const { error } = await supabase.from('operaciones').update(updates).eq('id', operacionId);

  if (error) {
    console.error('Error actualizando la operación:', error);
    alert('No se pudo actualizar la operación.');
  } else {
    alert('Operación actualizada correctamente.');
    await cargarOperacion();
    formOperacion.classList.add('hidden');
    resumenOperacion.classList.remove('hidden');
  }
});

cargarOperacion();