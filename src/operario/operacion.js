import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';


requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

document.getElementById('btnChecklist').addEventListener('click', () => {
  window.location.href = 'checklist.html';
});

document.getElementById('btnEnviar').addEventListener('click', () => {
  window.location.href = 'finalizar.html';
});

// Updated to go to the new generic product page
document.getElementById('btnProducto').addEventListener('click', () => {
  window.location.href = 'producto.html';
});

document.getElementById('btnVolver').addEventListener('click', () => {
  window.location.href = 'home.html';
});

async function getOperacionActual() {
  const id = localStorage.getItem('operacion_actual');
  if (!id) return null;
  
  const { data, error } = await supabase
    .from('operaciones')
    .select('*, checklist_items(*)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching operacion actual:', error);
    return null;
  }
  return data;
}

async function renderOperacion() {
  const op = await getOperacionActual();
  if (!op || !op.id) {
    alert('No se encontró la operación actual. Redirigiendo a la página principal.');
    window.location.href = 'home.html';
    return;
  }
  document.getElementById('cliente').textContent = op.cliente || '---';
  document.getElementById('ubicacion').textContent = op.silo || op.celda || '-';
  document.getElementById('fecha').textContent = new Date(op.created_at || Date.now()).toLocaleString('es-AR');
  document.getElementById('mercaderia').textContent = op.mercaderia ? op.mercaderia.charAt(0).toUpperCase() + op.mercaderia.slice(1) : '-';
  
  // Change button text based on fumigation method
  const btnProducto = document.getElementById('btnProducto');
  if (op.metodo_fumigacion === 'pastillas') {
    btnProducto.querySelector('span').textContent = 'Registrar Pastillas Usadas';
  } else if (op.metodo_fumigacion === 'liquido') {
    btnProducto.querySelector('span').textContent = 'Registrar Líquido Usado';
  }

  // Progreso checklist
  const checklist = op.checklist_items || [];
  const completados = checklist.filter(i => i.completado).length;
  document.getElementById('progreso').textContent = `${completados}/4`;
  document.getElementById('progressBar').value = completados * 25;

  // Check if any product has been registered for this operation
  const { data: productosRegistrados, error } = await supabase
    .from('operaciones')
    .select('id')
    .eq('operacion_original_id', op.id)
    .eq('tipo_registro', 'producto');
  
  const productoRegistrado = productosRegistrados && productosRegistrados.length > 0;

  if (completados === 4) {
    btnProducto.disabled = false;
  } else {
    btnProducto.disabled = true;
  }

  // The finalization button is enabled only if checklist is complete AND product is registered
  if (completados === 4 && productoRegistrado) {
    document.getElementById('btnEnviar').disabled = false;
  } else {
    document.getElementById('btnEnviar').disabled = true;
  }
}

renderOperacion();