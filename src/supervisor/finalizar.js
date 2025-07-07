import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formFinalizar');
let operacionOriginal = {};
let operacionId = null;

async function setupPage() {
    const urlParams = new URLSearchParams(window.location.search);
    operacionId = urlParams.get('id');

    if (!operacionId) { 
        alert('ID de operación no encontrado en la URL.');
        window.location.href = 'historial.html'; 
        return; 
    }
    
    const { data: operacion, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .eq('id', operacionId)
        .single();
    
    if(error || !operacion) {
        alert('Error al cargar la operación.');
        window.location.href = 'historial.html';
        return;
    }
    operacionOriginal = operacion;
    
    document.getElementById('cliente').textContent = operacion.clientes?.nombre || 'N/A';
    document.getElementById('deposito').textContent = `${operacion.depositos?.nombre} (${operacion.depositos?.tipo})`;
    
    const { data: allRecords } = await supabase
        .from('operaciones')
        .select('*')
        .or(`id.eq.${operacionId},operacion_original_id.eq.${operacionId}`);
        
    const totalToneladas = allRecords.filter(r => r.estado_aprobacion !== 'rechazado').reduce((acc, op) => acc + (op.toneladas || 0), 0);
    const totalProducto = allRecords.filter(r => r.estado_aprobacion !== 'rechazado').reduce((acc, op) => acc + (op.producto_usado_cantidad || 0), 0);
    
    document.getElementById('totalToneladas').textContent = totalToneladas.toLocaleString() + ' tn';
    document.getElementById('totalProducto').textContent = totalProducto.toLocaleString() + (operacion.metodo_fumigacion === 'liquido' ? ' cm³' : ' pastillas');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!confirm("¿Está seguro de que desea finalizar esta operación?")) {
        return;
    }

    const user = getUser();
    if (!user) { alert("Error de autenticación."); return; }
    
    const observacion = document.getElementById('observacion_finalizacion').value;

    const finalizacionData = {
        operacion_original_id: operacionOriginal.id,
        cliente_id: operacionOriginal.cliente_id,
        deposito_id: operacionOriginal.deposito_id,
        mercaderia_id: operacionOriginal.mercaderia_id,
        estado: 'finalizada',
        tipo_registro: 'finalizacion',
        operario_nombre: `${user.nombre} ${user.apellido}`,
        observacion_finalizacion: observacion,
        estado_aprobacion: 'aprobado',
        supervisor_id: user.id,
        fecha_aprobacion: new Date().toISOString()
    };

    const { data, error } = await supabase.from('operaciones').insert(finalizacionData).select().single();
    if (error) {
        alert('Error al finalizar la operación: ' + error.message);
        return;
    }

    // Actualiza el estado de toda la cadena de operaciones a 'finalizada'
    const { error: updateError } = await supabase
        .from('operaciones')
        .update({ estado: 'finalizada' })
        .or(`id.eq.${operacionOriginal.id},operacion_original_id.eq.${operacionOriginal.id}`);
    
    if (updateError) {
        console.error("Error updating original operations:", updateError);
    }

    // ⭐ NUEVO: Se limpian los registros que quedaron pendientes de aprobación
    const { error: updatePendientesError } = await supabase
        .from('operaciones')
        .update({ 
            estado_aprobacion: 'aprobado',
            observacion_aprobacion: 'Aprobado automáticamente por finalización de operación.'
        })
        .eq('operacion_original_id', operacionOriginal.id)
        .eq('estado_aprobacion', 'pendiente');

    if (updatePendientesError) {
        console.error("Error updating pending records:", updatePendientesError);
    }

    alert('¡Operación finalizada con éxito!');
    window.location.href = 'historial.html';
});

document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'historial.html';
});

document.addEventListener('DOMContentLoaded', setupPage);