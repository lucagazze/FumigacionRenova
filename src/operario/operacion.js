import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const btnChecklist = document.getElementById('btnChecklist');
const btnProducto = document.getElementById('btnProducto');
const btnMovimiento = document.getElementById('btnMovimiento');
const btnEnviar = document.getElementById('btnEnviar');
const btnVolver = document.getElementById('btnVolver');
const btnCancelar = document.getElementById('btnCancelar');
const cardChecklist = document.querySelector('[data-action-target="btnChecklist"]');

// --- Lógica de la página ---

let areCardListenersSetup = false;
function setupCardClickListeners() {
    if (areCardListenersSetup) return;
    document.querySelectorAll('.action-card[data-action-target]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button, a, input')) return;
            const targetButton = document.getElementById(card.dataset.actionTarget);
            if (targetButton && !targetButton.disabled) targetButton.click();
        });
    });
    areCardListenersSetup = true;
}

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

    // Renderizar detalles de la operación
    document.getElementById('cliente').textContent = op.clientes?.nombre || '---';
    const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : '---';
    document.getElementById('ubicacion').textContent = depositoInfo;
    document.getElementById('fecha').textContent = new Date(op.created_at).toLocaleString('es-AR');
    document.getElementById('mercaderia').textContent = op.mercaderias?.nombre || '---';

    // Lógica del Checklist
    const checklist = op.checklist_items || [];
    const completados = checklist.filter(i => i.completado).length;
    const totalItems = checklist.length || 4;
    const checklistCompleto = completados === totalItems && totalItems > 0;
    const checklistConfirmado = op.checklist_confirmado === true;

    const progresoEl = document.getElementById('progreso');
    progresoEl.textContent = `${completados}/${totalItems}`;
    
    if (checklistConfirmado) {
        progresoEl.textContent = 'Confirmado';
        progresoEl.classList.replace('bg-yellow-100', 'bg-green-100');
        progresoEl.classList.replace('text-yellow-800', 'text-green-800');
        btnChecklist.textContent = 'Ver';
        cardChecklist.classList.add('disabled-card');
    } else if (checklistCompleto) {
        progresoEl.textContent = 'Completo';
        progresoEl.classList.replace('bg-yellow-100', 'bg-green-100');
        progresoEl.classList.replace('text-yellow-800', 'text-green-800');
    } else {
        progresoEl.classList.replace('bg-green-100', 'bg-yellow-100');
        progresoEl.classList.replace('text-green-800', 'text-yellow-800');
        cardChecklist.classList.remove('disabled-card');
    }
    btnChecklist.disabled = false;


    const cardAcciones = document.getElementById('cardAcciones');
    const accionesMsgContainer = document.getElementById('accionesMsgContainer');
    const accionesButtons = document.getElementById('accionesButtons');

    const paso2Bloqueado = !checklistCompleto;
    cardAcciones.classList.toggle('disabled-card', paso2Bloqueado);
    accionesMsgContainer.classList.toggle('hidden', !paso2Bloqueado);
    accionesButtons.classList.toggle('hidden', paso2Bloqueado);
    
    btnProducto.disabled = paso2Bloqueado;
    btnMovimiento.disabled = paso2Bloqueado;
    
    // Verificar si hay acciones para ocultar el botón de cancelar
    const { data: historialAcciones } = await supabase
      .from('operaciones')
      .select('id', { count: 'exact' })
      .eq('operacion_original_id', op.id)
      .or('tipo_registro.eq.producto,tipo_registro.eq.movimiento');
      
    if (historialAcciones.length > 0) {
        btnCancelar.classList.add('hidden');
    } else {
        btnCancelar.classList.remove('hidden');
        btnCancelar.classList.add('inline-flex');
    }
    
    // --- LÓGICA DE FINALIZACIÓN SIMPLIFICADA ---
    // El botón y la tarjeta ya no se deshabilitan
    btnEnviar.disabled = false;
    document.getElementById('cardFinalizar').classList.remove('disabled-card');

    setupCardClickListeners();
}

async function handleCancelarOperacion() {
    if (!confirm("¿Está seguro de que desea cancelar esta operación? Todos los datos se eliminarán permanentemente.")) return;

    const op = await getOperacionActual();
    if (!op) return;

    const { error } = await supabase.from('operaciones').delete().eq('id', op.id);

    if (error) {
        alert("Error al cancelar la operación. Por favor, inténtelo de nuevo.");
        console.error("Error deleting operation:", error);
    } else {
        localStorage.removeItem('operacion_actual');
        alert("La operación ha sido cancelada correctamente.");
        window.location.href = 'home.html';
    }
}


// --- Event Listeners ---
btnChecklist.addEventListener('click', () => { window.location.href = 'checklist.html'; });
btnProducto.addEventListener('click', () => { window.location.href = 'producto.html'; });
btnMovimiento.addEventListener('click', () => { window.location.href = 'movimiento.html'; });
btnEnviar.addEventListener('click', () => { window.location.href = 'finalizar.html'; });
btnVolver.addEventListener('click', () => { window.location.href = 'home.html'; });
btnCancelar.addEventListener('click', handleCancelarOperacion);

document.addEventListener('DOMContentLoaded', renderOperacion);