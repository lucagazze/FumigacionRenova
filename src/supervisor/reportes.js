import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
// Solo el supervisor puede acceder
if (user.role !== 'supervisor') {
    window.location.href = '/src/login/login.html';
}

document.getElementById('header').innerHTML = renderHeader();

const formReporte = document.getElementById('formReporte');
const filtroFecha = document.getElementById('filtroFecha');
const reporteContainer = document.getElementById('reporte-container');

function renderReporte(operaciones, fechaDesde, fechaHasta) {
    const reporteGenerado = document.getElementById('reporte-generado');
    const reporteTitulo = document.getElementById('reporte-titulo');
    const reporteFechas = document.getElementById('reporte-fechas');
    const reporteTablaBody = document.getElementById('reporte-tabla-body');
    const reporteTablaFoot = document.getElementById('reporte-tabla-foot');
    const exportarPdfBtn = document.getElementById('exportar-pdf');

    reporteContainer.innerHTML = '';
    
    const operacionesFiltradas = operaciones.filter(op => op.tipo_registro === 'producto' && op.estado_aprobacion !== 'rechazado');

    if (operacionesFiltradas.length === 0) {
        reporteGenerado.classList.add('hidden');
        reporteContainer.innerHTML = '<p class="text-center text-gray-500">No se encontraron operaciones para los filtros seleccionados.</p>';
        return;
    }

    reporteGenerado.classList.remove('hidden');
    
    reporteTitulo.textContent = 'Reporte de Operaciones';
    reporteFechas.textContent = `Del ${moment(fechaDesde).format('DD/MM/YYYY')} al ${moment(fechaHasta).format('DD/MM/YYYY')}`;

    const operacionesAgrupadas = operacionesFiltradas.reduce((acc, op) => {
        const key = `${op.deposito_id}-${op.mercaderia_id}-${op.tratamiento}-${op.estado_aprobacion}`;
        if (!acc[key]) {
            acc[key] = {
                ...op,
                toneladas: 0,
                count: 0
            };
        }
        acc[key].toneladas += op.toneladas || 0;
        acc[key].count++;
        return acc;
    }, {});

    let totalGeneralToneladas = 0;
    let totalPreventivo = 0;
    let totalCurativo = 0;
    reporteTablaBody.innerHTML = '';

    Object.values(operacionesAgrupadas).forEach(op => {
        const estadoAprobacion = op.estado_aprobacion?.charAt(0).toUpperCase() + op.estado_aprobacion?.slice(1) || 'Pendiente';
        const claseAprobacion = op.estado_aprobacion === 'aprobado' ? 'text-green-600' : 'text-yellow-600';
        totalGeneralToneladas += op.toneladas;

        if (op.tratamiento === 'preventivo') {
            totalPreventivo += op.toneladas;
        } else if (op.tratamiento === 'curativo') {
            totalCurativo += op.toneladas;
        }

        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-100 cursor-pointer';
        row.setAttribute('data-id', op.id);
        row.innerHTML = `
            <td class="py-3 px-4 text-left whitespace-nowrap">${moment(fechaDesde).format('DD/MM/YYYY')} - ${moment(fechaHasta).format('DD/MM/YYYY')}</td>
            <td class="py-3 px-4 text-left">${op.clientes?.nombre || 'N/A'}</td>
            <td class="py-3 px-4 text-left">${op.mercaderias?.nombre || 'N/A'}</td>
            <td class="py-3 px-4 text-left">${op.tratamiento || 'N/A'}</td>
            <td class="py-3 px-4 text-left font-semibold">${(op.toneladas).toLocaleString()} tn</td>
            <td class="py-3 px-4 text-left">${op.depositos?.nombre || 'N/A'}</td>
            <td class="py-3 px-4 text-left"><span class="font-semibold ${claseAprobacion}">${estadoAprobacion}</span></td>
        `;
        row.addEventListener('click', () => {
            window.location.href = `operacion_detalle.html?id=${op.id}`;
        });
        reporteTablaBody.appendChild(row);
    });

    reporteTablaFoot.innerHTML = `
        <tr>
            <td colspan="4" class="py-3 px-2 text-left font-bold">Total Preventivo</td>
            <td class="py-3 px-2 text-left font-bold">${totalPreventivo.toLocaleString()} tn</td>
            <td colspan="2" class="py-3 px-2"></td>
        </tr>
        <tr>
            <td colspan="4" class="py-3 px-2 text-left font-bold">Total Curativo</td>
            <td class="py-3 px-2 text-left font-bold">${totalCurativo.toLocaleString()} tn</td>
            <td colspan="2" class="py-3 px-2"></td>
        </tr>
        <tr class="bg-gray-300">
            <td colspan="4" class="py-3 px-2 text-left font-bold">Total General</td>
            <td class="py-3 px-2 text-left font-bold">${totalGeneralToneladas.toLocaleString()} tn</td>
            <td colspan="2" class="py-3 px-2"></td>
        </tr>
    `;

    exportarPdfBtn.onclick = () => exportarAPDF(Object.values(operacionesAgrupadas), fechaDesde, fechaHasta, totalGeneralToneladas, totalPreventivo, totalCurativo);
}

function exportarAPDF(operacionesAgrupadas, fechaDesde, fechaHasta, totalGeneralToneladas, totalPreventivo, totalCurativo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape'
    });

    const titulo = 'Reporte de Operaciones';
    const subtitulo = `Período: ${moment(fechaDesde).format('DD/MM/YYYY')} - ${moment(fechaHasta).format('DD/MM/YYYY')}`;

    doc.setFontSize(18);
    doc.text(titulo, 14, 22);
    doc.setFontSize(11);
    doc.text(subtitulo, 14, 30);
    doc.text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 14, 36);

    const tableColumn = ["Fecha", "Cliente", "Producto", "Tratamiento", "Toneladas Registradas", "Depósito", "Aprobación"];
    const tableRows = [];

    operacionesAgrupadas.forEach(op => {
        const rowData = [
            `${moment(fechaDesde).format('DD/MM/YYYY')} - ${moment(fechaHasta).format('DD/MM/YYYY')}`,
            op.clientes?.nombre || 'N/A',
            op.mercaderias?.nombre || 'N/A',
            op.tratamiento || 'N/A',
            (op.toneladas).toLocaleString() + ' tn',
            op.depositos?.nombre || 'N/A',
            op.estado_aprobacion?.charAt(0).toUpperCase() + op.estado_aprobacion?.slice(1) || 'Pendiente'
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 42,
        theme: 'striped',
        headStyles: { fillColor: [22, 160, 133] },
        didDrawPage: function (data) {
            // Footer
            let str = "Página " + doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });
    
    let finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    
    doc.text('Total Preventivo:', 110, finalY + 10);
    doc.text(`${totalPreventivo.toLocaleString()} tn`, 150, finalY + 10);
    
    doc.text('Total Curativo:', 110, finalY + 16);
    doc.text(`${totalCurativo.toLocaleString()} tn`, 150, finalY + 16);

    doc.text('Total General:', 110, finalY + 22);
    doc.text(`${totalGeneralToneladas.toLocaleString()} tn`, 150, finalY + 22);

    const fechaStr = `${moment(fechaDesde).format('DD-MM-YY')} al ${moment(fechaHasta).format('DD-MM-YY')}`;
    const fileName = `Registro Fumigacion Fagaz (${fechaStr}).pdf`;
    doc.save(fileName);
}


formReporte.addEventListener('submit', async (e) => {
    e.preventDefault();
    reporteContainer.innerHTML = '<p class="text-center p-8">Generando reporte...</p>';
    document.getElementById('reporte-generado').classList.add('hidden');

    const dateRange = $(filtroFecha).data('daterangepicker');
    const fechaDesde = dateRange.startDate.format('YYYY-MM-DD');
    const fechaHasta = dateRange.endDate.format('YYYY-MM-DD');

    // Guardar en localStorage
    localStorage.setItem('reporteFechaDesde', fechaDesde);
    localStorage.setItem('reporteFechaHasta', fechaHasta);
    
    let query = supabase
        .from('operaciones')
        .select(`*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre)`)
        .gte('created_at', fechaDesde)
        .lte('created_at', `${fechaHasta}T23:59:59`)
        .order('created_at', { ascending: true });

    if (user.role === 'supervisor' && user.cliente_ids && user.cliente_ids.length > 0) {
        query = query.in('cliente_id', user.cliente_ids);
    }
    
    const { data, error } = await query;

    if (error) {
        reporteContainer.innerHTML = '<p class="text-red-500 text-center">Error al generar el reporte.</p>';
        console.error(error);
        return;
    }
    
    renderReporte(data, fechaDesde, fechaHasta);
});

document.addEventListener('DOMContentLoaded', () => {
    const clienteFilterContainer = document.getElementById('cliente-filter-container');
    if (clienteFilterContainer) {
        clienteFilterContainer.style.display = 'none';
    }

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

    // Restaurar desde localStorage
    const savedFechaDesde = localStorage.getItem('reporteFechaDesde');
    const savedFechaHasta = localStorage.getItem('reporteFechaHasta');

    if (savedFechaDesde && savedFechaHasta) {
        $(filtroFecha).data('daterangepicker').setStartDate(moment(savedFechaDesde));
        $(filtroFecha).data('daterangepicker').setEndDate(moment(savedFechaHasta));
        $(filtroFecha).val(moment(savedFechaDesde).format('DD/MM/YYYY') + ' - ' + moment(savedFechaHasta).format('DD/MM/YYYY'));
        
        // Trigger form submission
        formReporte.dispatchEvent(new Event('submit'));
    }
});
