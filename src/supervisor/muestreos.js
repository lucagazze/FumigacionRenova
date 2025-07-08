import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

const user = getUser();
requireRole('supervisor');
document.getElementById('header').innerHTML = renderHeader();

// --- Selectores del DOM ---
const container = document.getElementById('muestreos-container');
const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
const filtrosContainer = document.getElementById('filtrosContainer');
const filtrosForm = document.getElementById('filtrosForm');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
const filtroFechaInput = document.getElementById('filtroFecha');

let allMuestreos = []; // Almacenará todos los muestreos para filtrar en el cliente

// --- Funciones de Renderizado ---

function renderMuestreosTabla(muestreos) {
    if (muestreos.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 p-4">No se encontraron muestreos con los filtros aplicados.</p>';
        return;
    }

    const tableHeaders = ["Fecha", "Operario", "Cliente", "Depósito", "Observación", ""].map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">${h}</th>`).join('');

    const tableRows = muestreos.map(op => {
        const muestreo = op.muestreos && op.muestreos.length > 0 ? op.muestreos[0] : {};
        const tieneArchivos = muestreo.media_url && muestreo.media_url.length > 0;

        const mainRow = `
            <tr class="main-row border-b hover:bg-gray-50 cursor-pointer" data-toggle-details="details-${op.id}">
                <td class="px-4 py-4 whitespace-nowrap">${new Date(op.created_at).toLocaleString('es-AR')}</td>
                <td class="px-4 py-4">${op.operario_nombre || 'N/A'}</td>
                <td class="px-4 py-4 whitespace-nowrap">${op.clientes?.nombre || 'N/A'}</td>
                <td class="px-4 py-4 whitespace-nowrap">${op.depositos?.nombre || 'N/A'} (${op.depositos?.tipo || 'N/A'})</td>
                <td class="px-4 py-4">${muestreo.observacion || 'Sin observación'}</td>
                <td class="px-4 py-4 text-center">
                    ${tieneArchivos ? '<span class="material-icons expand-icon">expand_more</span>' : ''}
                </td>
            </tr>
        `;

        let detailsRow = '';
        if (tieneArchivos) {
            const mediaGrid = muestreo.media_url.map(url => `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="block group relative w-full h-40 bg-gray-200 rounded-lg overflow-hidden">
                    <img src="${url}" alt="Archivo adjunto" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                </a>
            `).join('');
            detailsRow = `<tr id="details-${op.id}" class="details-row hidden bg-gray-50 border-b"><td colspan="6"><div class="p-4"><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">${mediaGrid}</div></div></td></tr>`;
        }

        return mainRow + detailsRow;
    }).join('');

    container.innerHTML = `<table class="min-w-full"><thead class="bg-gray-50"><tr>${tableHeaders}</tr></thead><tbody>${tableRows}</tbody></table>`;
}


// --- Funciones de Filtros ---

async function poblarFiltros() {
    const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo').order('nombre');
    const filtroDeposito = document.getElementById('filtroDeposito');
    filtroDeposito.innerHTML = '<option value="">Todos</option>';
    depositos.forEach(d => filtroDeposito.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`);
}

function aplicarFiltros() {
    let filteredMuestreos = [...allMuestreos];

    const depositoId = document.getElementById('filtroDeposito').value;
    const dateRange = $(filtroFechaInput).data('daterangepicker');
    const fechaDesde = dateRange.startDate && dateRange.startDate.isValid() ? dateRange.startDate.toDate() : null;
    const fechaHasta = dateRange.endDate && dateRange.endDate.isValid() ? dateRange.endDate.toDate() : null;

    if (depositoId) filteredMuestreos = filteredMuestreos.filter(op => op.deposito_id === depositoId);

    if (fechaDesde) {
        fechaDesde.setHours(0, 0, 0, 0);
        filteredMuestreos = filteredMuestreos.filter(op => new Date(op.created_at) >= fechaDesde);
    }
    if (fechaHasta) {
        fechaHasta.setHours(23, 59, 59, 999);
        filteredMuestreos = filteredMuestreos.filter(op => new Date(op.created_at) <= fechaHasta);
    }

    renderMuestreosTabla(filteredMuestreos);
}


// --- Carga Inicial y Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
    container.innerHTML = '<p class="text-center p-4">Cargando muestreos...</p>';
    
    let query = supabase
        .from('operaciones')
        .select(`id, created_at, operario_nombre, cliente_id, deposito_id, clientes (nombre), depositos (nombre, tipo), muestreos (observacion, media_url)`)
        .eq('tipo_registro', 'muestreo');

    if (user.role === 'supervisor' && user.cliente_ids && user.cliente_ids.length > 0) {
        query = query.in('cliente_id', user.cliente_ids);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching muestreos:", error);
        container.innerHTML = '<p class="text-red-500 text-center p-4">Error al cargar los muestreos.</p>';
        return;
    }
    allMuestreos = data;
    renderMuestreosTabla(allMuestreos);
    await poblarFiltros();
    
    // Inicializar Date Range Picker
    $(filtroFechaInput).daterangepicker({
        autoUpdateInput: false,
        opens: 'left',
        locale: { cancelLabel: 'Limpiar', applyLabel: 'Aplicar', fromLabel: 'Desde', toLabel: 'Hasta', format: 'DD/MM/YYYY' }
    });

    // Event listeners para los filtros
    $(filtroFechaInput).on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YYYY') + ' - ' + picker.endDate.format('DD/MM/YYYY'));
        aplicarFiltros();
    });
    $(filtroFechaInput).on('cancel.daterangepicker', function() {
        $(this).val('');
        aplicarFiltros();
    });

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    filtrosForm.addEventListener('change', aplicarFiltros);
    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
        $(filtroFechaInput).val('');
        $(filtroFechaInput).data('daterangepicker').setStartDate(moment());
        $(filtroFechaInput).data('daterangepicker').setEndDate(moment());
        aplicarFiltros(); 
    });

    // Event listener para expandir filas
    container.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr.main-row');
        if (headerRow) {
            const detailsId = headerRow.dataset.toggleDetails;
            if (detailsId) {
                const detailsElement = document.getElementById(detailsId);
                if (detailsElement) {
                    headerRow.classList.toggle('is-open');
                    detailsElement.classList.toggle('hidden');
                }
            }
        }
    });
});
