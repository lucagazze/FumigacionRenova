import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
// Solo el admin y supervisor pueden acceder
if (user.role !== 'admin' && user.role !== 'supervisor') {
    window.location.href = '/src/login/login.html';
}

document.getElementById('header').innerHTML = renderHeader();

const formReporte = document.getElementById('formReporte');
const filtroCliente = document.getElementById('filtroCliente');
const filtroFecha = document.getElementById('filtroFecha');
const reporteContainer = document.getElementById('reporte-container');
const clienteFilterContainer = document.getElementById('cliente-filter-container');


async function poblarClientes() {
    if (user.role !== 'admin') {
        clienteFilterContainer.style.display = 'none';
        return;
    }

    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) {
        console.error('Error cargando clientes:', error);
        return;
    }
    
    filtroCliente.innerHTML = '<option value="">Todos los Clientes</option>';
    data.forEach(c => {
        filtroCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

function renderReporte(operaciones) {
    reporteContainer.innerHTML = ''; 

    if (operaciones.length === 0) {
        reporteContainer.innerHTML = '<p class="text-center text-gray-500">No se encontraron operaciones para los filtros seleccionados.</p>';
        return;
    }

    // Agrupar todos los registros por operacion_original_id
    const operacionesAgrupadas = operaciones.reduce((acc, op) => {
        const key = op.operacion_original_id || op.id;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(op);
        return acc;
    }, {});

    const reportCardsHTML = Object.values(operacionesAgrupadas).map(grupo => {
        const opInicial = grupo.find(op => op.tipo_registro === 'inicial') || grupo[0];
        const detalleUrl = user.role === 'admin' ? `/src/admin/operacion_detalle.html` : `/src/supervisor/operacion_detalle.html`;
        
        let totalToneladas = 0;
        let toneladasPreventivo = 0;
        let toneladasCurativo = 0;
        
        grupo.forEach(op => {
            if (op.tipo_registro === 'producto' && op.estado_aprobacion !== 'rechazado') {
                const toneladas = op.toneladas || 0;
                totalToneladas += toneladas;
                if (op.tratamiento === 'preventivo') {
                    toneladasPreventivo += toneladas;
                } else if (op.tratamiento === 'curativo') {
                    toneladasCurativo += toneladas;
                }
            }
        });

        const tratamientos = [...new Set(grupo.map(op => op.tratamiento).filter(Boolean))].join(', ') || 'N/A';
        const metodo = opInicial.metodo_fumigacion?.charAt(0).toUpperCase() + opInicial.metodo_fumigacion?.slice(1) || 'N/A';

        return `
            <a href="${detalleUrl}?id=${opInicial.id}" class="block bg-white rounded-xl shadow border p-6 transition hover:shadow-md hover:border-blue-400">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><strong>Cliente:</strong><br>${opInicial.clientes?.nombre || 'N/A'}</div>
                    <div><strong>Depósito:</strong><br>${opInicial.depositos?.nombre || 'N/A'} (${opInicial.depositos?.tipo || 'N/A'})</div>
                    <div><strong>Mercadería:</strong><br>${opInicial.mercaderias?.nombre || 'N/A'}</div>
                    <div><strong>Método:</strong><br>${metodo}</div>
                    <div><strong>Tratamiento(s):</strong><br>${tratamientos}</div>
                    <div><strong>Estado:</strong><br><span class="font-semibold ${opInicial.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${opInicial.estado}</span></div>
                    <div><strong>Total Toneladas:</strong><br>${totalToneladas.toLocaleString()} tn</div>
                    <div class="col-span-full md:col-span-1 grid grid-cols-2 gap-x-4">
                        <div><strong>Tn Preventivo:</strong><br>${toneladasPreventivo.toLocaleString()} tn</div>
                        <div><strong>Tn Curativo:</strong><br>${toneladasCurativo.toLocaleString()} tn</div>
                    </div>
                </div>
            </a>
        `;
    }).join('');

    reporteContainer.innerHTML = reportCardsHTML;
}


formReporte.addEventListener('submit', async (e) => {
    e.preventDefault();
    reporteContainer.innerHTML = '<p class="text-center p-8">Generando reporte...</p>';

    const dateRange = $(filtroFecha).data('daterangepicker');
    const fechaDesde = dateRange.startDate.format('YYYY-MM-DD');
    const fechaHasta = dateRange.endDate.format('YYYY-MM-DD');
    const clienteId = filtroCliente.value;
    
    let query = supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)`)
        .gte('created_at', fechaDesde)
        .lte('created_at', `${fechaHasta}T23:59:59`);

    if (user.role === 'admin' && clienteId) {
        query = query.eq('cliente_id', clienteId);
    } else if (user.role === 'supervisor' && user.cliente_ids) {
        query = query.in('cliente_id', user.cliente_ids);
    }
    
    const { data, error } = await query;

    if (error) {
        reporteContainer.innerHTML = '<p class="text-red-500 text-center">Error al generar el reporte.</p>';
        console.error(error);
        return;
    }
    
    renderReporte(data);
});

document.addEventListener('DOMContentLoaded', () => {
    poblarClientes();

    $(filtroFecha).daterangepicker({
        opens: 'left',
        locale: {
            cancelLabel: 'Limpiar',
            applyLabel: 'Aplicar',
            fromLabel: 'Desde',
            toLabel: 'Hasta',
            format: 'DD/MM/YYYY'
        }
    });
});
