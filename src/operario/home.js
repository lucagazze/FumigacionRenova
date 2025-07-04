import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('header').innerHTML = renderHeader();
    const operacionesList = document.getElementById('operacionesList');
    const btnNueva = document.getElementById('btnNueva');
    const user = getUser();

    async function renderOperaciones() {
        operacionesList.innerHTML = '<p class="text-center p-4 text-gray-500 col-span-full">Buscando operaciones en curso...</p>';

        if (!user.cliente_ids || user.cliente_ids.length === 0) {
            operacionesList.innerHTML = '<p class="text-center text-gray-500 p-4 col-span-full">No tiene clientes asignados. Contacte a un administrador.</p>';
            return;
        }

        const { data: opsIniciales, error } = await supabase
            .from('operaciones')
            .select('id, created_at, metodo_fumigacion, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)')
            .eq('estado', 'en curso')
            .eq('tipo_registro', 'inicial')
            .in('cliente_id', user.cliente_ids)
            .order('created_at', { ascending: false });
        
        if(error) {
            console.error("Error fetching operations", error);
            operacionesList.innerHTML = '<p class="text-red-500 text-center p-4 col-span-full">Error al cargar operaciones.</p>';
            return;
        }

        if (opsIniciales.length === 0) {
            operacionesList.innerHTML = '<p class="text-center text-gray-500 p-4 col-span-full">No hay operaciones en curso para sus clientes asignados.</p>';
            return;
        }
        
        const promises = opsIniciales.map(async (op) => {
            const { data: historial } = await supabase
                .from('operaciones')
                .select('toneladas, producto_usado_cantidad')
                .eq('operacion_original_id', op.id);
            
            op.totalProducto = historial.reduce((sum, reg) => sum + (reg.producto_usado_cantidad || 0), 0);
            return op;
        });

        const operacionesCompletas = await Promise.all(promises);

        operacionesList.innerHTML = operacionesCompletas.map((op) => {
            const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
            const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
            const productoTotal = op.totalProducto ? op.totalProducto.toLocaleString() : '0';

            return `
            <div class="operation-card bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col justify-between transition hover:shadow-xl hover:border-gray-300 cursor-pointer" data-id="${op.id}">
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="font-bold text-xl text-gray-800">${op.clientes?.nombre || 'N/A'}</h3>
                        <span class="text-xs font-bold px-3 py-1 rounded-full ${op.metodo_fumigacion === 'liquido' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                            ${op.metodo_fumigacion?.charAt(0).toUpperCase() + op.metodo_fumigacion?.slice(1)}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm text-gray-700">
                        <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">grass</span><span>Mercadería: <strong class="text-gray-900">${op.mercaderias?.nombre || 'N/A'}</strong></span></div>
                        <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">store</span><span>Depósito: <strong class="text-gray-900">${depositoInfo}</strong></span></div>
                        <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">calendar_today</span><span>Fecha inicio: <strong class="text-gray-900">${new Date(op.created_at).toLocaleDateString('es-AR')}</strong></span></div>
                        <div class="flex items-center gap-2"><span class="material-icons text-lg text-gray-400">science</span><span>Producto usado: <strong class="text-gray-900">${productoTotal} ${unidadLabel}</strong></span></div>
                    </div>
                </div>

                <div class="border-t border-gray-200 mt-6 pt-4 text-center">
                    <div class="font-semibold text-green-600 flex items-center justify-center w-full gap-2">
                        <span>Continuar Operación</span>
                        <span class="material-icons">arrow_forward</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    operacionesList.addEventListener('click', (e) => {
        const card = e.target.closest('.operation-card');
        if (card) {
            const opId = card.dataset.id;
            if (opId) {
                localStorage.setItem('operacion_actual', opId);
                window.location.href = 'operacion.html';
            }
        }
    });

    btnNueva.addEventListener('click', () => {
        localStorage.removeItem('operacion_actual');
        window.location.href = 'index.html';
    });

    renderOperaciones();
});