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
        const unidad = op.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';
        let tipoRegistro, icono, colorFondo, colorBorde, detalle;

        // --- LÓGICA CORREGIDA AQUÍ ---
        if (op.tipo_registro === 'inicial') {
            tipoRegistro = 'Inicio de Operación';
            icono = 'flag';
            colorFondo = 'bg-blue-50';
            colorBorde = 'border-blue-300 hover:border-blue-500';
            detalle = `<p class="text-sm ml-9">Iniciado por <b>${op.operario_nombre}</b>.</p>`;
        } else if (op.tipo_registro === 'producto') {
            tipoRegistro = 'Aplicación de Producto';
            icono = 'science';
            colorFondo = 'bg-yellow-50';
            colorBorde = 'border-yellow-300 hover:border-yellow-500';
            detalle = `<p class="text-sm ml-9"><b>${op.operario_nombre}</b> aplicó <b>${(op.producto_usado_cantidad ?? 0).toLocaleString()} ${unidad}</b> en <b>${(op.toneladas ?? 0).toLocaleString()} tn</b>.</p>`;
        } else if (op.tipo_registro === 'finalizacion') { // <-- AÑADIDO ESTE CASO
            tipoRegistro = 'Finalización de Operación';
            icono = 'check_circle';
            colorFondo = 'bg-red-50';
            colorBorde = 'border-red-300 hover:border-red-500';
            detalle = `<p class="text-sm ml-9">Solicitado por <b>${op.operario_nombre}</b>.</p>`;
        } else {
            tipoRegistro = 'Registro'; // Caso por defecto
            icono = 'assignment';
            colorFondo = 'bg-gray-50';
            colorBorde = 'border-gray-300 hover:border-gray-500';
            detalle = `<p class="text-sm ml-9">Registrado por <b>${op.operario_nombre}</b>.</p>`;
        }

        return `
        <a href="operacion_confirmar.html?id=${op.id}" class="block p-4 rounded-lg shadow border ${colorFondo} ${colorBorde} transition hover:shadow-md">
            <div class="flex flex-wrap justify-between items-center gap-2">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="material-icons text-lg text-gray-600">${icono}</span>
                        <h3 class="font-bold text-lg text-gray-800">${tipoRegistro}</h3>
                    </div>
                    <p class="text-sm text-gray-500 ml-9">${new Date(op.created_at).toLocaleString('es-AR')}</p>
                    <p class="text-sm font-semibold ml-9 mt-1">${op.clientes.nombre} - Depósito ${op.depositos.nombre}</p>
                    ${detalle}
                </div>
                <div class="flex items-center gap-2 text-blue-600 font-semibold">
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
        <a href="operacion_detalle.html?id=${op.id}" class="block p-4 rounded-lg shadow border bg-green-50 border-green-300 transition hover:shadow-md hover:border-green-500">
            <div class="flex flex-wrap justify-between items-center gap-2">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="material-icons text-lg text-gray-600">gps_fixed</span>
                        <h3 class="font-bold text-lg text-gray-800">Operación en Curso</h3>
                    </div>
                    <p class="text-sm text-gray-500 ml-9">${new Date(op.created_at).toLocaleString('es-AR')}</p>
                    <p class="text-sm font-semibold ml-9 mt-1">${op.clientes.nombre} - Depósito ${op.depositos.nombre}</p>
                </div>
                <div class="flex items-center gap-2 text-red-600 font-semibold">
                    <span>Ver Detalle para Finalizar</span>
                    <span class="material-icons">flag</span>
                </div>
            </div>
        </a>
        `;
    }).join('');
}


document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    await renderPendientes();
    await renderEnCursoParaFinalizar();
});