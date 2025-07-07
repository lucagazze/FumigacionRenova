import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';
import { renderOperaciones } from '../common/data.js';

requireRole('supervisor');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    const filterForm = document.getElementById('filter-form');
    const container = document.getElementById('historial-container');
    const user = getUser();

    async function poblarFiltros() {
        const clienteSelect = document.getElementById('filter-cliente');
        const depositoSelect = document.getElementById('filter-deposito');

        if (!user.cliente_ids || user.cliente_ids.length === 0) {
            clienteSelect.innerHTML = '<option value="">Sin clientes asignados</option>';
            depositoSelect.innerHTML = '<option value="">Sin depósitos</option>';
            return;
        }

        const { data: clientes, error: clientesError } = await supabase
            .from('clientes')
            .select('id, nombre')
            .in('id', user.cliente_ids)
            .order('nombre');
        
        if (clientes) {
            clienteSelect.innerHTML = '<option value="">Todos mis Clientes</option>';
            clientes.forEach(c => clienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
        }

        const { data: depositos, error: depositosError } = await supabase
            .from('depositos')
            .select('id, nombre, tipo')
            .in('cliente_id', user.cliente_ids)
            .order('nombre');

        if (depositos) {
            depositoSelect.innerHTML = '<option value="">Todos los Depósitos</option>';
            depositos.forEach(d => depositoSelect.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`);
        }
    }

    async function cargarHistorial() {
        container.innerHTML = '<p class="text-center p-4">Cargando historial...</p>';
        
        const clienteId = document.getElementById('filter-cliente').value;
        const depositoId = document.getElementById('filter-deposito').value;

        let query = supabase
            .from('operaciones')
            .select(`*, clientes(nombre), depositos(nombre, tipo, limpiezas(fecha_garantia_limpieza)), mercaderias(nombre), muestreos(observacion, media_url)`)
            .in('cliente_id', user.cliente_ids)
            .order('created_at', { ascending: false });

        if (clienteId) {
            query = query.eq('cliente_id', clienteId);
        }
        if (depositoId) {
            query = query.eq('deposito_id', depositoId);
        }

        const { data, error } = await query;

        if (error) {
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar el historial.</p>`;
            return;
        }

        renderOperaciones(container, data, false, true); // isSupervisor: true
    }

    await poblarFiltros();
    await cargarHistorial();

    filterForm.addEventListener('change', cargarHistorial);
    
    // Listener para expandir filas
    container.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            const detailsElement = document.getElementById(headerRow.dataset.toggleDetails);
            if (detailsElement) {
                detailsElement.classList.toggle('hidden');
            }
        }
    });
});