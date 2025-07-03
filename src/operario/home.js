import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('header').innerHTML = renderHeader();
    const operacionesList = document.getElementById('operacionesList');
    const btnNueva = document.getElementById('btnNueva');

    async function renderOperaciones() {
        operacionesList.innerHTML = '<p class="text-center p-4 text-gray-500">Buscando operaciones en curso...</p>';

        const { data: opsIniciales, error } = await supabase
            .from('operaciones')
            .select('id, created_at, metodo_fumigacion, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)')
            .eq('estado', 'en curso')
            .eq('tipo_registro', 'inicial')
            .order('created_at', { ascending: false });
        
        if(error) {
            console.error("Error fetching operations", error);
            operacionesList.innerHTML = '<p class="text-red-500 text-center p-4">Error al cargar operaciones.</p>';
            return;
        }

        if (opsIniciales.length === 0) {
            operacionesList.innerHTML = '<p class="text-center text-gray-500 p-4">No hay operaciones en curso en este momento.</p>';
            return;
        }
        
        for (const op of opsIniciales) {
            const { data: historial } = await supabase
                .from('operaciones')
                .select('toneladas, producto_usado_cantidad')
                .eq('operacion_original_id', op.id);
            
            op.totalProducto = historial.reduce((sum, reg) => sum + (reg.producto_usado_cantidad || 0), 0);
            op.totalToneladas = historial.reduce((sum, reg) => sum + (reg.toneladas || 0), 0);
        }

        operacionesList.innerHTML = opsIniciales.map((op) => {
            const depositoInfo = op.depositos ? `${op.depositos.tipo.charAt(0).toUpperCase() + op.depositos.tipo.slice(1)} ${op.depositos.nombre}` : 'N/A';
            const unidadLabel = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

            return `
            <div class="bg-white border rounded-lg p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">person</span>
                        <div><strong class="block text-gray-500 font-medium">Cliente:</strong><span class="font-semibold">${op.clientes?.nombre || 'N/A'}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">grass</span>
                        <div><strong class="block text-gray-500 font-medium">Mercadería:</strong><span class="font-semibold">${op.mercaderias?.nombre || 'N/A'}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">science</span>
                        <div><strong class="block text-gray-500 font-medium">Método:</strong><span class="font-semibold">${op.metodo_fumigacion?.charAt(0).toUpperCase() + op.metodo_fumigacion?.slice(1)}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">store</span>
                        <div><strong class="block text-gray-500 font-medium">Depósito:</strong><span class="font-semibold">${depositoInfo}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">calendar_today</span>
                        <div><strong class="block text-gray-500 font-medium">Fecha inicio:</strong><span class="font-semibold">${new Date(op.created_at).toLocaleDateString('es-AR')}</span></div>
                    </div>
                    <div class="flex items-start gap-2">
                        <span class="material-icons text-base text-gray-400 mt-0.5">medication</span>
                        <div><strong class="block text-gray-500 font-medium">Producto usado:</strong><span class="font-semibold">${op.totalProducto.toLocaleString()} ${unidadLabel}</span></div>
                    </div>
                    <div class="flex items-start gap-2 col-span-2 md:col-span-3">
                        <span class="material-icons text-base text-gray-400 mt-0.5">scale</span>
                        <div><strong class="block text-gray-500 font-medium">Toneladas fumigadas:</strong><span class="font-semibold">${op.totalToneladas.toLocaleString()} tn</span></div>
                    </div>
                </div>
                <div class="flex justify-center border-t pt-4 mt-4">
                    <button class="btn btn-primary continue-btn" data-id="${op.id}">
                        <span>Continuar Operación</span>
                        <span class="material-icons">arrow_forward</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');

        operacionesList.querySelectorAll('button.continue-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const opId = e.currentTarget.dataset.id;
                localStorage.setItem('operacion_actual', opId);
                window.location.href = 'operacion.html';
            });
        });
    }

    btnNueva.addEventListener('click', () => {
        localStorage.removeItem('operacion_actual');
        window.location.href = 'index.html';
    });

    // Carga inicial de las operaciones
    renderOperaciones();
});