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
        if (clienteFilterContainer) clienteFilterContainer.style.display = 'none';
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

function getQuincena(dateStr) {
    const day = moment(dateStr).date();
    return day <= 15 ? '1er Quincena' : '2da Quincena';
}


function renderReporte(operaciones, fechaDesde, fechaHasta) {
    const reporteGenerado = document.getElementById('reporte-generado');
    const reporteTitulo = document.getElementById('reporte-titulo');
    const reporteFechas = document.getElementById('reporte-fechas');
    const reporteTablaBody = document.getElementById('reporte-tabla-body');
    const reporteTablaFoot = document.getElementById('reporte-tabla-foot');
    const exportarPdfBtn = document.getElementById('exportar-pdf');

    reporteContainer.innerHTML = '';
    
    const operacionesFiltradas = operaciones
        .filter(op => op.tipo_registro === 'producto') // Solo mostrar aplicaciones
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));


    if (operacionesFiltradas.length === 0) {
        reporteGenerado.classList.add('hidden');
        reporteContainer.innerHTML = '<p class="text-center text-gray-500">No se encontraron aplicaciones de producto para los filtros seleccionados.</p>';
        return;
    }

    reporteGenerado.classList.remove('hidden');
    
    if (user.role === 'admin') {
        const clienteSeleccionado = filtroCliente.options[filtroCliente.selectedIndex];
        reporteTitulo.textContent = clienteSeleccionado.value ? `Reporte de ${clienteSeleccionado.text}` : 'Reporte General de Operaciones';
    } else {
        reporteTitulo.textContent = 'Reporte de Operaciones';
    }
    reporteFechas.textContent = `Del ${moment(fechaDesde).format('DD/MM/YYYY')} al ${moment(fechaHasta).format('DD/MM/YYYY')}`;

    let totalCamionesPrev = 0, totalTonPrev = 0, totalPastillasPrev = 0;
    let totalCamionesCur = 0, totalTonCur = 0, totalPastillasCur = 0;

    reporteTablaBody.innerHTML = operacionesFiltradas.map(op => {
        const camiones = op.modalidad === 'descarga' ? (op.toneladas / 28) : 0;
        
        const camionesPrev = op.tratamiento === 'preventivo' ? camiones : 0;
        const tonPrev = op.tratamiento === 'preventivo' ? op.toneladas : 0;
        const pastillasPrev = op.tratamiento === 'preventivo' ? op.producto_usado_cantidad : 0;

        const camionesCur = op.tratamiento === 'curativo' ? camiones : 0;
        const tonCur = op.tratamiento === 'curativo' ? op.toneladas : 0;
        const pastillasCur = op.tratamiento === 'curativo' ? op.producto_usado_cantidad : 0;

        totalCamionesPrev += camionesPrev;
        totalTonPrev += tonPrev;
        totalPastillasPrev += pastillasPrev;
        totalCamionesCur += camionesCur;
        totalTonCur += tonCur;
        totalPastillasCur += pastillasCur;

        let supervisorInfo = '<span class="text-yellow-600">Pendiente de Aprobación</span>';
        if (op.estado_aprobacion === 'aprobado' && op.supervisor) {
            supervisorInfo = `${op.supervisor.nombre} ${op.supervisor.apellido}`;
        } else if (op.estado_aprobacion === 'rechazado') {
            supervisorInfo = '<span class="text-red-600">Rechazado</span>';
        }

        return `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="py-2 px-2 border-r">${getQuincena(op.created_at)}</td>
                <td class="py-2 px-2 border-r">${moment(op.created_at).format('DD/MM/YYYY')}</td>
                <td class="py-2 px-2 border-r">${op.depositos?.nombre || 'N/A'}</td>
                <td class="py-2 px-2 border-r-2 border-gray-400">${op.mercaderias?.nombre || 'N/A'}</td>
                <td class="py-2 px-2 text-center border-r">${Math.round(camionesPrev).toLocaleString() || 0}</td>
                <td class="py-2 px-2 text-center border-r">${tonPrev.toLocaleString() || 0}</td>
                <td class="py-2 px-2 text-center border-r-2 border-gray-400">${pastillasPrev.toLocaleString() || 0}</td>
                <td class="py-2 px-2 text-center border-r">${Math.round(camionesCur).toLocaleString() || 0}</td>
                <td class="py-2 px-2 text-center border-r">${tonCur.toLocaleString() || 0}</td>
                <td class="py-2 px-2 text-center border-r-2 border-gray-400">${pastillasCur.toLocaleString() || 0}</td>
                <td class="py-2 px-2 border-r-2 border-gray-400">${op.observacion_aprobacion || ''}</td>
                <td class="py-2 px-2">${supervisorInfo}</td>
            </tr>
        `;
    }).join('');
    
    reporteTablaFoot.innerHTML = `
        <tr>
            <td class="py-2 px-2 border-r" colspan="4"><b>TOTALES</b></td>
            <td class="py-2 px-2 text-center border-r"><b>${Math.round(totalCamionesPrev).toLocaleString()}</b></td>
            <td class="py-2 px-2 text-center border-r"><b>${totalTonPrev.toLocaleString()}</b></td>
            <td class="py-2 px-2 text-center border-r-2 border-gray-400"><b>${totalPastillasPrev.toLocaleString()}</b></td>
            <td class="py-2 px-2 text-center border-r"><b>${Math.round(totalCamionesCur).toLocaleString()}</b></td>
            <td class="py-2 px-2 text-center border-r"><b>${totalTonCur.toLocaleString()}</b></td>
            <td class="py-2 px-2 text-center border-r-2 border-gray-400"><b>${totalPastillasCur.toLocaleString()}</b></td>
            <td class="py-2 px-2 border-r-2 border-gray-400" colspan="2"></td>
        </tr>
    `;

    exportarPdfBtn.onclick = () => exportarAPDF(operacionesFiltradas, fechaDesde, fechaHasta);
}

function exportarAPDF(operaciones, fechaDesde, fechaHasta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    let titulo = 'Reporte de Operaciones';
    let clienteSeleccionado;
    if (user.role === 'admin') {
        clienteSeleccionado = filtroCliente.options[filtroCliente.selectedIndex];
        titulo = clienteSeleccionado.value ? `Reporte de ${clienteSeleccionado.text}` : 'Reporte General de Operaciones';
    }
    const subtitulo = `Período: ${moment(fechaDesde).format('DD/MM/YYYY')} - ${moment(fechaHasta).format('DD/MM/YYYY')}`;

    doc.setFontSize(18);
    doc.text(titulo, 14, 22);
    doc.setFontSize(11);
    doc.text(subtitulo, 14, 30);

    const head = [
        [
            { content: 'QUINCENA', rowSpan: 2, styles: { halign: 'center' } }, { content: 'FECHA', rowSpan: 2, styles: { halign: 'center' } }, { content: 'SILO', rowSpan: 2, styles: { halign: 'center' } }, { content: 'PRODUCTO', rowSpan: 2, styles: { halign: 'center' } },
            { content: 'PREVENTIVO', colSpan: 3, styles: { halign: 'center' } }, { content: 'CURATIVO', colSpan: 3, styles: { halign: 'center' } },
            { content: 'OBSERVACIONES', rowSpan: 2, styles: { halign: 'center' } }, { content: 'SUPERVISOR', rowSpan: 2, styles: { halign: 'center' } }
        ],
        [
            'CAMIONES', 'TONELADAS', 'PASTILLAS',
            'CAMIONES', 'TONELADAS', 'PASTILLAS'
        ]
    ];

    let totalCamionesPrev = 0, totalTonPrev = 0, totalPastillasPrev = 0;
    let totalCamionesCur = 0, totalTonCur = 0, totalPastillasCur = 0;
    
    const body = operaciones.map(op => {
        const camiones = op.modalidad === 'descarga' ? (op.toneladas / 28) : 0;
        const camionesPrev = op.tratamiento === 'preventivo' ? camiones : 0;
        const tonPrev = op.tratamiento === 'preventivo' ? op.toneladas : 0;
        const pastillasPrev = op.tratamiento === 'preventivo' ? op.producto_usado_cantidad : 0;
        const camionesCur = op.tratamiento === 'curativo' ? camiones : 0;
        const tonCur = op.tratamiento === 'curativo' ? op.toneladas : 0;
        const pastillasCur = op.tratamiento === 'curativo' ? op.producto_usado_cantidad : 0;

        totalCamionesPrev += camionesPrev; totalTonPrev += tonPrev; totalPastillasPrev += pastillasPrev;
        totalCamionesCur += camionesCur; totalTonCur += tonCur; totalPastillasCur += pastillasCur;

        let supervisorInfo = 'Pendiente';
        if (op.estado_aprobacion === 'aprobado' && op.supervisor) {
            supervisorInfo = `${op.supervisor.nombre} ${op.supervisor.apellido}`;
        } else if (op.estado_aprobacion === 'rechazado') {
            supervisorInfo = 'Rechazado';
        }
        
        return [
            getQuincena(op.created_at),
            moment(op.created_at).format('DD/MM/YYYY'),
            op.depositos?.nombre || 'N/A',
            op.mercaderias?.nombre || 'N/A',
            Math.round(camionesPrev).toLocaleString(),
            tonPrev.toLocaleString(),
            pastillasPrev.toLocaleString(),
            Math.round(camionesCur).toLocaleString(),
            tonCur.toLocaleString(),
            pastillasCur.toLocaleString(),
            op.observacion_aprobacion || '',
            supervisorInfo
        ];
    });

    const foot = [[
        { content: 'TOTALES', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: Math.round(totalCamionesPrev).toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: totalTonPrev.toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: totalPastillasPrev.toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: Math.round(totalCamionesCur).toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: totalTonCur.toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: totalPastillasCur.toLocaleString(), styles: { fontStyle: 'bold', halign: 'center' } },
        { content: '', colSpan: 2 },
    ]];

    doc.autoTable({
        head: head,
        body: body,
        foot: foot,
        startY: 36,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, halign: 'center', valign: 'middle', fontSize: 7 },
        footStyles: { fillColor: [210, 210, 210], textColor: 0, halign: 'center' },
        styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: 200, lineWidth: 0.1 },
        didDrawCell: (data) => {
            const thickCols = [3, 6, 9, 10];
            if (thickCols.includes(data.column.index)) {
                doc.setLineWidth(0.4);
                doc.setDrawColor(150); // Un gris un poco más oscuro para las líneas gruesas
                doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                doc.setDrawColor(200); // Volver al color por defecto de la grilla
                doc.setLineWidth(0.1);
            }
        },
    });
    
    const clienteNombre = clienteSeleccionado && clienteSeleccionado.value ? clienteSeleccionado.text : 'General';
    const fechaStr = `${moment(fechaDesde).format('DD-MM-YY')}_al_${moment(fechaHasta).format('DD-MM-YY')}`;
    const fileName = `Reporte_${clienteNombre}_${fechaStr}.pdf`;
    doc.save(fileName);
}


formReporte.addEventListener('submit', async (e) => {
    e.preventDefault();
    reporteContainer.innerHTML = '<p class="text-center p-8">Generando reporte...</p>';
    document.getElementById('reporte-generado').classList.add('hidden');

    const dateRange = $(filtroFecha).data('daterangepicker');
    const fechaDesde = dateRange.startDate.format('YYYY-MM-DD');
    const fechaHasta = dateRange.endDate.format('YYYY-MM-DD');
    let clienteId = null;
    if (user.role === 'admin') {
        clienteId = filtroCliente.value;
    }
    
    let query = supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), supervisor:supervisor_id(nombre, apellido)`)
        .gte('created_at', fechaDesde)
        .lte('created_at', `${fechaHasta}T23:59:59`);

    if (user.role === 'admin' && clienteId) {
        query = query.eq('cliente_id', clienteId);
    } else if (user.role === 'supervisor' && user.cliente_ids) {
        query = query.in('cliente_id', user.cliente_ids);
    }
    
    const { data, error } = await query;

    if (error) {
        reporteContainer.innerHTML = `<p class="text-red-500 text-center">Error al generar el reporte.</p>`;
        console.error(error);
        return;
    }
    
    renderReporte(data, fechaDesde, fechaHasta);
});

document.addEventListener('DOMContentLoaded', async () => {
    await poblarClientes();
    $(filtroFecha).daterangepicker({
        opens: 'left',
        locale: { cancelLabel: 'Limpiar', applyLabel: 'Aplicar', format: 'DD/MM/YYYY' }
    });
});