import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('supervisor');

async function renderPendientes() {
    const container = document.getElementById('pendientes-container');
    const user = getUser();
    container.innerHTML = `<p class="text-center p-4">Buscando operaciones pendientes...</p>`;

    if (!user.cliente_ids || user.cliente_ids.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 p-4">No tiene clientes asignados.</p>`;
        return;
    }

    const { data: operaciones, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .in('cliente_id', user.cliente_ids)
        .eq('estado_aprobacion', 'pendiente')
        .order('created_at', { ascending: true });
        
    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error al cargar operaciones.</p>`;
        return;
    }
    if (operaciones.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay operaciones pendientes de aprobación.</p>`;
        return;
    }

    container.innerHTML = operaciones.map(op => {
        let tipoRegistro, icono, colorFondo, colorBorde, detalleSimple;

        if (op.tipo_registro === 'inicial') {
            tipoRegistro = 'Inicio de Operación';
            icono = 'flag';
            colorFondo = 'bg-blue-50';
            colorBorde = 'border-blue-300 hover:border-blue-500';
            detalleSimple = `Por <b>${op.operario_nombre}</b>`;
        } else if (op.tipo_registro === 'producto') {
            tipoRegistro = 'Aplicación de Producto';
            icono = 'science';
            colorFondo = 'bg-yellow-50';
            colorBorde = 'border-yellow-300 hover:border-yellow-500';
            
            const toneladas = (op.toneladas ?? 0).toLocaleString();
            const tratamiento = op.tratamiento ? op.tratamiento.charAt(0).toUpperCase() + op.tratamiento.slice(1) : 'N/A';
            const modalidad = op.modalidad ? op.modalidad.charAt(0).toUpperCase() + op.modalidad.slice(1) : 'N/A';
            detalleSimple = `<b>${toneladas} tn</b> (${tratamiento} - ${modalidad})`;

        } else if (op.tipo_registro === 'finalizacion') {
            tipoRegistro = 'Finalización de Operación';
            icono = 'check_circle';
            colorFondo = 'bg-red-50';
            colorBorde = 'border-red-300 hover:border-red-500';
            detalleSimple = `Solicitado por <b>${op.operario_nombre}</b>`;
        } else {
            return ''; // No mostrar otros tipos en esta vista
        }

        return `
        <a href="operacion_confirmar.html?id=${op.id}" class="block p-3 rounded-lg shadow-sm border ${colorFondo} ${colorBorde} transition hover:shadow-md">
            <div class="flex items-center justify-between gap-4 w-full">
                <div class="flex items-center gap-3">
                    <span class="material-icons text-gray-600">${icono}</span>
                    <div class="text-sm">
                        <p class="font-bold text-gray-800">${tipoRegistro}: <span class="font-medium">${op.clientes.nombre} - Depósito ${op.depositos.nombre}</span></p>
                        <p class="text-xs text-gray-500">${new Date(op.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} hs</p>
                    </div>
                </div>
                <div class="hidden md:block text-sm text-gray-600 flex-shrink-0">
                    ${detalleSimple}
                </div>
                <div class="flex-shrink-0 flex items-center gap-2 text-blue-600 font-semibold text-sm">
                    <span>Revisar y Aprobar</span>
                    <span class="material-icons">arrow_forward</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}


async function renderEnCursoParaFinalizar() {
    const container = document.getElementById('en-curso-container');
    const user = getUser();
    container.innerHTML = `<p class="text-center p-4">Buscando operaciones en curso...</p>`;

    if (!user.cliente_ids || user.cliente_ids.length === 0) {
        return; 
    }

    const { data: operaciones, error } = await supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo)`)
        .in('cliente_id', user.cliente_ids)
        .eq('estado', 'en curso')
        .eq('tipo_registro', 'inicial')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-red-500 text-center">Error al cargar operaciones en curso.</p>`;
        return;
    }
    if (operaciones.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay operaciones en curso para finalizar.</p>`;
        return;
    }

    container.innerHTML = operaciones.map(op => {
        return `
        <a href="operacion_detalle.html?id=${op.id}" class="block p-3 rounded-lg shadow-sm border bg-green-50 border-green-300 transition hover:shadow-md hover:border-green-500">
            <div class="flex items-center justify-between gap-4 w-full">
                <div class="flex items-center gap-3">
                    <span class="material-icons text-green-700">gps_fixed</span>
                    <div class="text-sm">
                        <p class="font-bold text-gray-800">En Curso: <span class="font-medium">${op.clientes.nombre} - Depósito ${op.depositos.nombre}</span></p>
                        <p class="text-xs text-gray-500">${new Date(op.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} hs</p>
                    </div>
                </div>
                <div class="flex-shrink-0 flex items-center gap-2 text-red-600 font-semibold text-sm">
                    <span>Ver Detalle para Finalizar</span>
                    <span class="material-icons">flag</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}

// --- Función para cargar todos los datos del dashboard ---
async function loadDashboardData() {
    await renderPendientes();
    await renderEnCursoParaFinalizar();
}

// Carga inicial cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('header').innerHTML = renderHeader();
    loadDashboardData();
});

// --- MODIFICACIÓN AQUÍ ---
// Vuelve a cargar los datos cada vez que la página se muestra
// (incluyendo cuando se presiona el botón "atrás" del navegador)
window.addEventListener('pageshow', (event) => {
    // La propiedad 'persisted' es true si la página se carga desde el cache.
    // Recargamos los datos para asegurar que la información esté actualizada.
    loadDashboardData();
});