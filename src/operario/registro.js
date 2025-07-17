import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
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
    const user = getUser();

    async function poblarFiltros() {
        const filtroCliente = document.getElementById('filtroCliente');
        if (user.cliente_ids && user.cliente_ids.length > 0) {
            const { data: clientes } = await supabase.from('clientes').select('id, nombre').in('id', user.cliente_ids).order('nombre');
            filtroCliente.innerHTML = '<option value="">Todos mis Clientes</option>';
            clientes.forEach(c => filtroCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        } else {
             filtroCliente.innerHTML = '<option value="">No tiene clientes asignados</option>';
             filtroCliente.disabled = true;
        }

        const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo').in('cliente_id', user.cliente_ids).order('nombre');
        const filtroSiloCelda = document.getElementById('filtroSiloCelda');
        filtroSiloCelda.innerHTML = '<option value="">Todos los Depósitos</option>';
        depositos.forEach(d => filtroSiloCelda.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`);
    }

    async function aplicarFiltros() {
        operacionesContainer.innerHTML = '<div class="text-center p-8"><div class="spinner"></div><p class="mt-2 text-gray-500">Cargando registros...</p></div>';
        
        let query = supabase.from('operaciones').select(`
            *, 
            clientes(nombre), 
            depositos(nombre, tipo, limpiezas(fecha_garantia_limpieza)), 
            mercaderias(nombre), 
            muestreos(observacion, media_url),
            supervisor:supervisor_id(nombre, apellido)
        `).order('created_at', { ascending: false });

        if (user.cliente_ids && user.cliente_ids.length > 0) {
            query = query.in('cliente_id', user.cliente_ids);
        } else {
            operacionesContainer.innerHTML = '<p class="text-center p-8 text-gray-500">No tiene clientes asignados para ver registros.</p>';
            return;
        }

        let { data: operaciones, error } = await query;
        if (error) { console.error("Error fetching data", error); return; }

        const clienteId = document.getElementById('filtroCliente').value;
        const tipo = document.getElementById('filtroTipo').value;
        const estado = document.getElementById('filtroEstado').value;
        const siloCeldaId = document.getElementById('filtroSiloCelda').value;
        
        if (clienteId) operaciones = operaciones.filter(op => op.cliente_id === clienteId);
        if (tipo) operaciones = operaciones.filter(op => op.tipo_registro === tipo);
        if (estado) operaciones = operaciones.filter(op => op.estado === estado);
        if (siloCeldaId) operaciones = operaciones.filter(op => op.deposito_id === siloCeldaId);

        renderOperaciones(operacionesContainer, operaciones, false);
    }

    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    
    filtrosForm.addEventListener('change', aplicarFiltros);

    btnLimpiarFiltros.addEventListener('click', () => { 
        filtrosForm.reset();
        aplicarFiltros(); 
    });

    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) {
                detailsElement.classList.toggle('hidden');
            }
        }
    });

    poblarFiltros();
    aplicarFiltros();
});
