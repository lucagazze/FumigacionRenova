import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('header').innerHTML = renderHeader();
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const operacionesContainer = document.getElementById('operacionesContainer');
    const filtrosForm = document.getElementById('filtrosRegistro');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

    async function poblarFiltros() {
        const { data: mercaderias } = await supabase.from('mercaderias').select('nombre').order('nombre');
        const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
        
        const filtroMercaderia = document.getElementById('filtroMercaderia');
        filtroMercaderia.innerHTML = '<option value="">Todas</option>';
        mercaderias.forEach(m => filtroMercaderia.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`);

        const filtroSiloCelda = document.getElementById('filtroSiloCelda');
        filtroSiloCelda.innerHTML = '<option value="">Todos</option>';
        depositos.forEach(d => filtroSiloCelda.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`);
    }

    async function aplicarFiltros() {
        let operaciones = await getOperaciones();
        
        const cliente = document.getElementById('filtroCliente').value.toLowerCase();
        const mercaderia = document.getElementById('filtroMercaderia').value;
        const metodo = document.getElementById('filtroMetodo').value;
        const tipo = document.getElementById('filtroTipo').value;
        const fechaDesde = document.getElementById('filtroFechaDesde').value;
        const fechaHasta = document.getElementById('filtroFechaHasta').value;
        const depositoStock = document.getElementById('filtroDepositoStock').value;
        const siloCeldaId = document.getElementById('filtroSiloCelda').value;

        if (cliente) operaciones = operaciones.filter(op => op.clientes?.nombre.toLowerCase().includes(cliente));
        if (mercaderia) operaciones = operaciones.filter(op => op.mercaderias?.nombre === mercaderia);
        if (metodo) operaciones = operaciones.filter(op => op.metodo_fumigacion === metodo);
        if (tipo) operaciones = operaciones.filter(op => op.tipo_registro === tipo);
        if (depositoStock) operaciones = operaciones.filter(op => op.deposito_origen_stock === depositoStock);
        if (siloCeldaId) operaciones = operaciones.filter(op => op.deposito_id === siloCeldaId);
        if (fechaDesde) operaciones = operaciones.filter(op => new Date(op.created_at) >= new Date(fechaDesde));
        if (fechaHasta) operaciones = operaciones.filter(op => new Date(op.created_at) <= new Date(fechaHasta + 'T23:59:59'));

        renderOperaciones(operacionesContainer, operaciones, false);
    }

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    filtrosForm.addEventListener('input', aplicarFiltros);
    filtrosForm.addEventListener('change', aplicarFiltros);
    btnLimpiarFiltros.addEventListener('click', () => { filtrosForm.reset(); aplicarFiltros(); });

    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            document.getElementById(headerRow.dataset.toggleDetails)?.classList.toggle('hidden');
        }
    });

    poblarFiltros();
    aplicarFiltros();
});