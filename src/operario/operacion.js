import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- Event Listeners de Navegación ---
document.getElementById('btnChecklist').addEventListener('click', () => {
  window.location.href = 'checklist.html';
});

document.getElementById('btnProducto').addEventListener('click', () => {
  window.location.href = 'producto.html';
});

// NUEVO: Listener para el botón de movimiento
document.getElementById('btnMovimiento').addEventListener('click', () => {
  window.location.href = 'movimiento.html';
});

document.getElementById('btnEnviar').addEventListener('click', () => {
  window.location.href = 'finalizar.html';
});

document.getElementById('btnVolver').addEventListener('click', () => {
  window.location.href = 'home.html';
});


// --- Lógica de la página (adaptada) ---
async function getOperacionActual() {
    const id = localStorage.getItem('operacion_actual');
    if (!id) return null;
    
    const { data, error } = await supabase
        .from('operaciones')
        .select(`
            *,
            clientes(nombre),
            depositos(nombre, tipo),
            mercaderias(nombre),
            checklist_items(*)
        `)
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
    if (!op) {
        alert('No se encontró la operación. Redirigiendo...');
        window.location.href = 'home.html';
        return;
    }

    // ... (código para rellenar cliente, fecha, mercadería, etc. es similar)
    document.getElementById('cliente').textContent = op.clientes?.nombre || '---';
    const depositoInfo = op.depositos ? `${op.depositos.tipo} ${op.depositos.nombre}` : '---';
    document.getElementById('ubicacion').textContent = depositoInfo;
    document.getElementById('fecha').textContent = new Date(op.created_at || Date.now()).toLocaleString('es-AR');
    document.getElementById('mercaderia').textContent = op.mercaderias?.nombre || '---';

    // Progreso checklist
    const checklist = op.checklist_items || [];
    const completados = checklist.filter(i => i.completado).length;
    document.getElementById('progreso').textContent = `${completados}/4`;
    document.getElementById('progressBar').value = completados * 25;

    // Habilitar botón de producto si el checklist está completo
    document.getElementById('btnProducto').disabled = completados < 4;

    // Verificar si ya se registró producto para habilitar finalización
    const { data: productosRegistrados, error } = await supabase
      .from('operaciones')
      .select('id')
      .eq('operacion_original_id', op.id)
      .eq('tipo_registro', 'producto');
    
    const productoRegistrado = productosRegistrados && productosRegistrados.length > 0;

    // Habilitar botón de finalizar si checklist está OK y hay producto
    document.getElementById('btnEnviar').disabled = !(completados === 4 && productoRegistrado);
}

renderOperacion();