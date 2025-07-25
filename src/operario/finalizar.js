import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formFinalizar');
const opId = localStorage.getItem('operacion_actual');
let operacionOriginal = {};

async function setupPage() {
    if (!opId) {
        alert('No se encontró una operación activa.');
        window.location.href = 'home.html';
        return;
    }
    
    const { data: operacion, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .eq('id', opId)
        .single();
    
    if (error || !operacion) {
        alert('Error al cargar la operación.');
        window.location.href = 'home.html';
        return;
    }
    operacionOriginal = operacion;
    
    document.getElementById('cliente').textContent = operacion.clientes?.nombre || 'N/A';
    document.getElementById('deposito').textContent = `${operacion.depositos?.nombre} (${operacion.depositos?.tipo})`;
    
    const { data: allRecords } = await supabase
        .from('operaciones')
        .select('toneladas, producto_usado_cantidad')
        .or(`id.eq.${opId},operacion_original_id.eq.${opId}`)
        .neq('estado_aprobacion', 'rechazado');
        
    const totalToneladas = allRecords.reduce((acc, op) => acc + (op.toneladas || 0), 0);
    const totalProducto = allRecords.reduce((acc, op) => acc + (op.producto_usado_cantidad || 0), 0);
    
    document.getElementById('totalToneladas').textContent = totalToneladas.toLocaleString() + ' tn';
    document.getElementById('totalProducto').textContent = totalProducto.toLocaleString() + (operacion.metodo_fumigacion === 'liquido' ? ' cm³' : ' pastillas');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!confirm("¿Está seguro de que desea solicitar la finalización de esta operación?")) {
        return;
    }

    const user = getUser();
    const observacion = document.getElementById('observacion_finalizacion').value;

    const finalizacionData = {
        operacion_original_id: operacionOriginal.id,
        cliente_id: operacionOriginal.cliente_id,
        deposito_id: operacionOriginal.deposito_id,
        mercaderia_id: operacionOriginal.mercaderia_id,
        estado: 'en curso', // El estado general sigue "en curso" hasta la aprobación final
        tipo_registro: 'finalizacion',
        operario_nombre: `${user.nombre} ${user.apellido}`,
        observacion_finalizacion: observacion,
        estado_aprobacion: 'pendiente' // CORREGIDO: La finalización ahora queda pendiente
    };

    const { error: insertError } = await supabase
        .from('operaciones')
        .insert(finalizacionData);

    if (insertError) {
        alert('Error al crear el registro de finalización: ' + insertError.message);
        return;
    }

    localStorage.removeItem('operacion_actual');
    alert('Solicitud de finalización enviada. Queda pendiente de aprobación por un supervisor.');
    window.location.href = 'home.html';
});

document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', setupPage);