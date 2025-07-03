// finalizar.js
import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const resumenContainer = document.getElementById('resumenContainer');
const operacionId = localStorage.getItem('operacion_actual');

async function renderResumen() {
    if (!operacionId) { window.location.href = 'home.html'; return; }

    const { data: op, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)`)
        .eq('id', operacionId).single();

    if (error) { console.error(error); return; }

    const { data: historial } = await supabase.from('operaciones')
        .select('producto_usado_cantidad, toneladas')
        .eq('operacion_original_id', operacionId);

    const totalProducto = historial.reduce((acc, o) => acc + (o.producto_usado_cantidad || 0), 0);
    const totalToneladas = historial.reduce((acc, o) => acc + (o.toneladas || 0), 0);
    const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
    
    resumenContainer.innerHTML = `
        <div class="space-y-2 mb-6">
            <p><strong>Cliente:</strong> ${op.clientes?.nombre || '-'}</p>
            <p><strong>Depósito:</strong> ${op.depositos?.nombre || '-'} (${op.depositos?.tipo || '-'})</p>
            <p><strong>Mercadería:</strong> ${op.mercaderias?.nombre || '-'}</p>
            <p><strong>Fecha de inicio:</strong> ${new Date(op.created_at).toLocaleString('es-AR')}</p>
            <p class="font-bold text-black"><strong>Toneladas Totales Movidas:</strong> ${totalToneladas.toLocaleString()} tn</p>
            <p class="font-bold text-black"><strong>Total producto usado:</strong> ${totalProducto.toLocaleString()} ${unidadLabel}</p>
        </div>
        <div class="flex justify-end gap-2">
            <button class="bg-gray-200 rounded-lg h-12 px-6 text-base font-bold" onclick="window.location.href='operacion.html'">Volver</button>
            <button class="btn-primary rounded-lg h-12 px-6 text-base font-bold" id="btnConfirmar">Confirmar y Finalizar</button>
        </div>
    `;

    document.getElementById('btnConfirmar').addEventListener('click', () => finalizarOperacion(op));
}

async function finalizarOperacion(op) {
    if (confirm('¿Está seguro de que desea finalizar esta operación? Esta acción no se puede deshacer.')) {
        const currentUser = getUser();
        const finalizacionTime = new Date();

        // --- LÓGICA DE GARANTÍA ---
        let con_garantia = false;
        let fecha_vencimiento_garantia = null;

        // 1. Verificar duración de la operación (menos de 5 días)
        const { data: allOps } = await supabase.from('operaciones')
            .select('created_at')
            .or(`id.eq.${op.id},operacion_original_id.eq.${op.id}`)
            .order('created_at', { ascending: true });
        
        const fechaInicio = new Date(allOps[0].created_at);
        const duracionMs = finalizacionTime - fechaInicio;
        const duracionDias = duracionMs / (1000 * 60 * 60 * 24);
        const cumplePlazo = duracionDias <= 5;

        // 2. Verificar vigencia de limpieza
        const { data: limpieza } = await supabase.from('limpiezas')
            .select('fecha_garantia_limpieza')
            .eq('deposito_id', op.deposito_id)
            .order('fecha_limpieza', { ascending: false })
            .limit(1).single();

        let cumpleLimpieza = false;
        if (limpieza && limpieza.fecha_garantia_limpieza) {
            const fechaVencLimpieza = new Date(limpieza.fecha_garantia_limpieza + 'T00:00:00');
            if (finalizacionTime <= fechaVencLimpieza) {
                cumpleLimpieza = true;
            }
        }
        
        // 3. Asignar garantía si se cumplen las condiciones
        if (cumplePlazo && cumpleLimpieza) {
            con_garantia = true;
            let vencimiento = new Date(finalizacionTime);
            vencimiento.setDate(vencimiento.getDate() + 40);
            fecha_vencimiento_garantia = vencimiento.toISOString().split('T')[0];
        }

        // Actualizar el estado y la garantía de todos los registros de la operación
        await supabase.from('operaciones').update({ 
            estado: 'finalizada', 
            updated_at: finalizacionTime.toISOString(),
            con_garantia,
            fecha_vencimiento_garantia
        }).or(`id.eq.${op.id},operacion_original_id.eq.${op.id}`);
        
        // Insertar el registro de finalización
        await supabase.from('operaciones').insert([{
            operacion_original_id: op.id,
            cliente_id: op.cliente_id,
            deposito_id: op.deposito_id,
            mercaderia_id: op.mercaderia_id,
            estado: 'finalizada',
            tipo_registro: 'finalizacion',
            operario_nombre: currentUser.name,
            metodo_fumigacion: op.metodo_fumigacion,
            con_garantia,
            fecha_vencimiento_garantia
        }]);

        localStorage.removeItem('operacion_actual');
        alert('Operación finalizada correctamente.');
        window.location.href = 'home.html';
    }
}


document.addEventListener('DOMContentLoaded', renderResumen);