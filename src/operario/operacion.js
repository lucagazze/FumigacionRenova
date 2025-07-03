import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const btnChecklist = document.getElementById('btnChecklist');
const btnProducto = document.getElementById('btnProducto');
const btnMovimiento = document.getElementById('btnMovimiento');
const btnEnviar = document.getElementById('btnEnviar');
const btnVolver = document.getElementById('btnVolver');
const finalizarMsg = document.getElementById('finalizarMsg');

async function getOperacionActual() {
    const id = localStorage.getItem('operacion_actual');
    if (!id) return null;
    
    const { data, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), checklist_items(*)`)
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

    document.getElementById('cliente').textContent = op.clientes?.nombre || '---';
    const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : '---';
    document.getElementById('ubicacion').textContent = depositoInfo;
    document.getElementById('fecha').textContent = new Date(op.created_at).toLocaleString('es-AR');
    document.getElementById('mercaderia').textContent = op.mercaderias?.nombre || '---';

    const checklist = op.checklist_items || [];
    const completados = checklist.filter(i => i.completado).length;
    document.getElementById('progreso').textContent = `${completados}/4`;
    document.getElementById('progressBar').value = (completados / 4) * 100;

    const checklistCompleto = completados === 4;
    btnProducto.disabled = !checklistCompleto;

    const { data: productosRegistrados } = await supabase
      .from('operaciones')
      .select('id', { count: 'exact' })
      .eq('operacion_original_id', op.id)
      .eq('tipo_registro', 'producto');
    
    const productoRegistrado = productosRegistrados.length > 0;
    
    const puedeFinalizar = checklistCompleto && productoRegistrado;
    btnEnviar.disabled = !puedeFinalizar;
    finalizarMsg.style.display = puedeFinalizar ? 'none' : 'block';
}

btnChecklist.addEventListener('click', () => { window.location.href = 'checklist.html'; });
btnProducto.addEventListener('click', () => { window.location.href = 'producto.html'; });
btnMovimiento.addEventListener('click', () => { window.location.href = 'movimiento.html'; });
btnEnviar.addEventListener('click', () => { window.location.href = 'finalizar.html'; });
btnVolver.addEventListener('click', () => { window.location.href = 'home.html'; });

document.addEventListener('DOMContentLoaded', renderOperacion);