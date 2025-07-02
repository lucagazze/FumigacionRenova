import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('header').innerHTML = renderHeader();

  const operacionId = localStorage.getItem('operacion_actual');
  if (!operacionId) {
    alert('No se encontró la operación actual.');
    window.location.href = 'home.html';
    return;
  }

  const { data: op, error: opError } = await supabase
    .from('operaciones')
    .select('*, checklist_items(*)')
    .eq('id', operacionId)
    .single();

  if (opError) {
    alert('Error al obtener la operación.');
    console.error(opError);
    return;
  }

  const { data: historial, error: historialError } = await supabase
    .from('operaciones')
    .select('producto_usado_cantidad, toneladas')
    .eq('operacion_original_id', op.operacion_original_id || op.id)
    .eq('tipo_registro', 'producto');

  let totalProducto = 0;
  let totalToneladas = 0;
  if (historialError) {
    alert('Error al obtener los datos de producto de la operación.');
    console.error(historialError);
  } else {
    totalProducto = historial.reduce((acc, o) => acc + (o.producto_usado_cantidad || 0), 0);
    totalToneladas = historial.reduce((acc, o) => acc + (o.toneladas || 0), 0);
  }

  // Display data
  let productoLabel = 'Total producto usado';
  let unidadLabel = 'un.';
  if (op.metodo_fumigacion === 'liquido') {
    productoLabel = 'Total líquido usado';
    unidadLabel = 'cm³';
  } else if (op.metodo_fumigacion === 'pastillas') {
    productoLabel = 'Total pastillas usadas';
    unidadLabel = 'un.';
  }

  document.getElementById('cliente').textContent = op.cliente || '---';
  document.getElementById('mercaderia').textContent = op.mercaderia ? op.mercaderia.charAt(0).toUpperCase() + op.mercaderia.slice(1) : '-';
  document.getElementById('area').textContent = op.silo || op.celda || '---';
  document.getElementById('tratamiento').textContent = op.tratamiento || '---';
  document.getElementById('toneladas').textContent = `${totalToneladas.toLocaleString()} tn`;
  document.getElementById('fechaInicio').textContent = new Date(op.created_at).toLocaleString('es-AR');
  document.getElementById('fechaCierre').textContent = new Date().toLocaleString('es-AR');
  
  document.getElementById('productoTotalLabel').textContent = productoLabel;
  document.getElementById('productoTotal').textContent = `${totalProducto.toLocaleString()} ${unidadLabel}`;

  const checklist = op.checklist_items || [];
  const resumen = document.getElementById('checklistResumen');
  if (resumen) {
    resumen.innerHTML = checklist.map(i => `<li>${i.item} <span class='text-green-600'>${i.completado ? '✔' : '✗'}</span></li>`).join('');
  }

  const btnConfirmar = document.getElementById('btnConfirmar');
  if (btnConfirmar) {
    if (op.estado === 'finalizada') {
      btnConfirmar.style.display = 'none';
    } else {
      btnConfirmar.addEventListener('click', async () => {
        if (confirm('¿Está seguro de que desea finalizar esta operación? Esta acción no se puede deshacer.')) {
          
          const operacionOriginalId = op.operacion_original_id || op.id;

          const { error: updateError } = await supabase
            .from('operaciones')
            .update({ estado: 'finalizada', updated_at: new Date().toISOString() })
            .eq('operacion_original_id', operacionOriginalId);

          if (updateError) {
            alert('Error al finalizar la operación.');
            console.error(updateError);
            return;
          }
          
          await supabase
            .from('operaciones')
            .update({ estado: 'finalizada', updated_at: new Date().toISOString() })
            .eq('id', operacionOriginalId);

          const { error: insertError } = await supabase.from('operaciones').insert([{
              operacion_original_id: operacionOriginalId,
              cliente: op.cliente,
              area_tipo: op.area_tipo,
              silo: op.silo,
              celda: op.celda,
              mercaderia: op.mercaderia,
              estado: 'finalizada',
              tipo_registro: 'finalizacion',
              operario_nombre: op.operario_nombre,
              tratamiento: op.tratamiento,
              toneladas: op.toneladas,
              metodo_fumigacion: op.metodo_fumigacion,
          }]);

          if (insertError) {
            alert('Error al crear el registro de finalización.');
            console.error(insertError);
            return;
          }

          localStorage.removeItem('operacion_actual');
          alert('Operación finalizada correctamente.');
          window.location.href = 'home.html';
        }
      });
    }
  }
});