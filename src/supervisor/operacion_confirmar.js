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

    async function cargarHistorial() {
        container.innerHTML = '<p class="text-center p-4">Cargando historial...</p>';
        
        const tipoRegistro = document.getElementById('filter-tipo').value;
        const estado = document.getElementById('filter-estado').value;

        let query = supabase
            .from('operaciones')
            .select(`*, clientes(nombre), depositos(nombre, tipo, limpiezas(fecha_garantia_limpieza)), mercaderias(nombre), muestreos(observacion, media_url)`)
            .in('cliente_id', user.cliente_ids)
            .order('created_at', { ascending: false });

        if (tipoRegistro) {
            query = query.eq('tipo_registro', tipoRegistro);
        }
        if (estado) {
            query = query.eq('estado', estado);
        }

        const { data, error } = await query;

        if (error) {
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar el historial.</p>`;
            return;
        }

        renderOperaciones(container, data, false, true); // isAdmin: false, isSupervisor: true
    }
    
    await cargarHistorial();

    filterForm.addEventListener('change', cargarHistorial);
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
        filterForm.reset();
        cargarHistorial();
    });

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