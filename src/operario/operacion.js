import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const btnChecklist = document.getElementById('btnChecklist');
const btnProducto = document.getElementById('btnProducto');
const btnMuestreo = document.getElementById('btnMuestreo');
// Se elimina btnEnviar
const btnVolver = document.getElementById('btnVolver');
const btnCancelar = document.getElementById('btnCancelar');

const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressLabel = document.getElementById('progressLabel');

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
    const totalItems = checklist.length || 4;
    const porcentaje = totalItems > 0 ? (completados / totalItems) * 100 : 0;
    const checklistCompleto = completados === totalItems && totalItems > 0;

    progressBar.value = porcentaje;
    progressText.textContent = `${completados}/${totalItems}`;

    if (checklistCompleto) {
        progressLabel.textContent = '¡Checklist completado!';
        progressLabel.classList.add('text-green-600', 'font-bold');
    } else {
        progressLabel.textContent = 'Completa el checklist para continuar.';
        progressLabel.classList.remove('text-green-600', 'font-bold');
    }

    btnProducto.disabled = !checklistCompleto;
    btnMuestreo.disabled = !checklistCompleto;
    // Se elimina la lógica de btnEnviar.disabled
    
    const { count } = await supabase
      .from('operaciones')
      .select('id', { count: 'exact' })
      .eq('operacion_original_id', op.id)
      .or('tipo_registro.eq.producto,tipo_registro.eq.muestreo');
      
    if (count > 0) {
        btnCancelar.classList.add('hidden');
    } else {
        btnCancelar.classList.remove('hidden');
        btnCancelar.classList.add('inline-flex');
    }
}

async function handleCancelarOperacion() {
    if (!confirm("¿Está seguro de que desea cancelar esta operación? Todos los datos se eliminarán permanentemente.")) return;
    const op = await getOperacionActual();
    if (!op) return;

    const { error } = await supabase.from('operaciones').delete().eq('id', op.id);
    if (error) {
        alert("Error al cancelar la operación. Por favor, inténtelo de nuevo.");
    } else {
        localStorage.removeItem('operacion_actual');
        alert("La operación ha sido cancelada correctamente.");
        window.location.href = 'home.html';
    }
}

// --- Event Listeners ---
btnChecklist.addEventListener('click', () => { window.location.href = 'checklist.html'; });
btnProducto.addEventListener('click', () => { window.location.href = 'producto.html'; });
btnMuestreo.addEventListener('click', () => { window.location.href = 'muestreo.html'; });
// Se elimina el listener de btnEnviar
btnVolver.addEventListener('click', () => { window.location.href = 'home.html'; });
btnCancelar.addEventListener('click', handleCancelarOperacion);

document.addEventListener('DOMContentLoaded', renderOperacion);