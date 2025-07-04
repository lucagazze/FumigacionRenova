import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formFinalizar');

let operacionOriginal = {};

async function setupPage() {
    const opId = localStorage.getItem('operacion_actual');
    if (!opId) { window.location.href = 'home.html'; return; }
    
    const { data: operacion, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo, limpiezas(fecha_garantia_limpieza))`)
        .eq('id', opId)
        .single();
    
    if(error || !operacion) {
        alert('Error al cargar la operación.');
        window.location.href = 'home.html';
        return;
    }
    operacionOriginal = operacion;
    
    document.getElementById('cliente').textContent = operacion.clientes?.nombre || 'N/A';
    document.getElementById('deposito').textContent = `${operacion.depositos?.nombre} (${operacion.depositos?.tipo})`;
    
    const { data: allRecords } = await supabase
        .from('operaciones')
        .select('*')
        .or(`id.eq.${opId},operacion_original_id.eq.${opId}`);
        
    const totalToneladas = allRecords.reduce((acc, op) => acc + (op.toneladas || 0), 0);
    const totalProducto = allRecords.reduce((acc, op) => acc + (op.producto_usado_cantidad || 0), 0);
    
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
        con_garantia: false,
        fecha_vencimiento_garantia: null,
        observacion_finalizacion: observacion
    };

    const { data, error } = await supabase.from('operaciones').insert(finalizacionData).select().single();
    if (error) {
        alert('Error al finalizar la operación: ' + error.message);
        return;
    }

    const { error: updateError } = await supabase
        .from('operaciones')
        .update({ estado: 'finalizada' })
        .or(`id.eq.${operacionOriginal.id},operacion_original_id.eq.${operacionOriginal.id}`);
    
    if (updateError) {
        console.error("Error updating original operations:", updateError);
    }

    localStorage.removeItem('operacion_actual');
    alert('¡Operación finalizada con éxito!');
    window.location.href = 'home.html';
});

document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'operacion.html';
});

document.addEventListener('DOMContentLoaded', setupPage);