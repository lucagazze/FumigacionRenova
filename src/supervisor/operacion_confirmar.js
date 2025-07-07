import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');

const urlParams = new URLSearchParams(window.location.search);
const operacionId = urlParams.get('id');
const user = getUser();
const DENSIDAD_LIQUIDO = 1.2;

async function renderDetalle() {
    const container = document.getElementById('detalle-container');
    if (!operacionId) {
        container.innerHTML = '<p class="text-red-500">ID de operación no válido.</p>';
        return;
    }

    const { data: op, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)`)
        .eq('id', operacionId)
        .single();
    
    if (error || !op) {
        container.innerHTML = '<p class="text-red-500">No se pudo cargar la operación.</p>';
        return;
    }

    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

    container.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800">Detalles del Registro</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 mt-4 bg-gray-50 rounded-lg border">
            <div><strong>Cliente:</strong><br>${op.clientes?.nombre || 'N/A'}</div>
            <div><strong>Depósito:</strong><br>${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</div>
            <div><strong>Mercadería:</strong><br>${op.mercaderias?.nombre || 'N/A'}</div>
            <div><strong>Método:</strong><br>${op.metodo_fumigacion || 'N/A'}</div>
            <div><strong>Tratamiento:</strong><br>${op.tratamiento || 'N/A'}</div>
            <div><strong>Operario:</strong><br>${op.operario_nombre || 'N/A'}</div>
            <div class="font-semibold"><strong>Total Toneladas:</strong><br>${(op.toneladas || 0).toLocaleString()} tn</div>
            <div class="font-semibold"><strong>Total Producto:</strong><br>${(op.producto_usado_cantidad || 0).toLocaleString()} ${unidadLabel}</div>
        </div>
    `;
}

async function handleRejection() {
    if (!confirm("¿Está seguro de que desea RECHAZAR este registro?")) return;

    const observacion = document.getElementById('observacion_aprobacion').value;
    if (!observacion) {
        alert('Debe ingresar un motivo para rechazar la operación.');
        return;
    }

    const { data: op, error: fetchError } = await supabase.from('operaciones').select('*').eq('id', operacionId).single();
    if(fetchError || !op) return alert('Error al obtener datos para rechazar.');

    // Revertir el stock
    const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('*')
        .eq('deposito', op.deposito_origen_stock)
        .eq('tipo_producto', op.metodo_fumigacion)
        .single();

    if(stockError) return alert('Error al encontrar el stock para revertir.');
    
    let nuevo_kg = parseFloat(stock.cantidad_kg);
    let nuevas_unidades = stock.cantidad_unidades ? parseInt(stock.cantidad_unidades) : 0;
    
    if (op.metodo_fumigacion === 'pastillas') {
        nuevas_unidades += op.producto_usado_cantidad;
        nuevo_kg = nuevas_unidades * 3 / 1000;
    } else {
        nuevo_kg += (op.producto_usado_cantidad * DENSIDAD_LIQUIDO) / 1000;
    }

    await supabase.from('stock').update({ cantidad_kg: nuevo_kg, cantidad_unidades: nuevas_unidades }).eq('id', stock.id);

    // Actualizar el estado de la operación
    const { error: updateError } = await supabase
        .from('operaciones')
        .update({ 
            estado_aprobacion: 'rechazado', 
            observacion_aprobacion: observacion,
            supervisor_id: user.id,
            fecha_aprobacion: new Date().toISOString()
        })
        .eq('id', operacionId);

    if (updateError) {
        alert('Error al rechazar la operación: ' + updateError.message);
    } else {
        alert(`La operación ha sido rechazada con éxito.`);
        window.location.href = 'dashboard.html';
    }
}

async function handleDecision(aprobado) {
    if (!aprobado) return handleRejection();

    if (!confirm("¿Está seguro de que desea APROBAR este registro?")) return;

    const observacion = document.getElementById('observacion_aprobacion').value;

    const { error } = await supabase
        .from('operaciones')
        .update({ 
            estado_aprobacion: 'aprobado',
            observacion_aprobacion: observacion, // Guardar observación también al aprobar
            supervisor_id: user.id,
            fecha_aprobacion: new Date().toISOString()
        })
        .eq('id', operacionId);

    if (error) {
        alert('Error al procesar la decisión: ' + error.message);
    } else {
        alert(`La operación ha sido aprobada con éxito.`);
        window.location.href = 'dashboard.html';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    await renderDetalle();

    document.getElementById('btn-approve').addEventListener('click', () => handleDecision(true));
    document.getElementById('btn-reject').addEventListener('click', () => handleDecision(false));
});