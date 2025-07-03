import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');

// Se envuelve toda la lógica en este evento para garantizar que el HTML esté cargado
document.addEventListener('DOMContentLoaded', () => {

    // --- Elementos del DOM ---
    document.getElementById('header').innerHTML = renderHeader();
    const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
    const filtrosContainer = document.getElementById('filtrosContainer');
    const operacionesContainer = document.getElementById('operacionesContainer');
    const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
    const filtrosForm = document.getElementById('filtrosRegistro');
    const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

    // --- Definición de Funciones ---

    async function renderSilosEnCurso() {
        const { data: opsEnCurso, error } = await supabase.from('operaciones').select(`toneladas, tipo_registro, depositos (id, nombre, tipo, capacidad_toneladas, clientes (nombre))`).eq('estado', 'en curso');
        
        if (error) {
            silosEnCursoContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar depósitos.</p>';
            return;
        }
        if (opsEnCurso.length === 0) {
            silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso.</p>';
            return;
        }

        const toneladasPorDeposito = new Map();
        opsEnCurso.forEach(op => {
            if (!op.depositos) return;
            const key = op.depositos.id;
            let currentData = toneladasPorDeposito.get(key) || { deposito: op.depositos, totalToneladas: 0 };
            if ((op.tipo_registro === 'producto' || op.tipo_registro === 'movimiento') && typeof op.toneladas === 'number') {
                currentData.totalToneladas += op.toneladas;
            }
            toneladasPorDeposito.set(key, currentData);
        });

        silosEnCursoContainer.innerHTML = '';
        toneladasPorDeposito.forEach((data) => {
            const { deposito, totalToneladas } = data;
            const capacidad = deposito.capacidad_toneladas || 0;
            const porcentajeLlenado = capacidad > 0 ? (totalToneladas / capacidad) * 100 : 0;
            const fillHeight = 80 * (Math.min(porcentajeLlenado, 100) / 100);
            const yPos = 95 - fillHeight;

            silosEnCursoContainer.innerHTML += `
                <div class="flex flex-col items-center gap-2 silo-wrapper" data-deposito-id="${deposito.id}" title="Click para filtrar operaciones">
                    <svg viewBox="0 0 100 100" class="silo-svg">
                        <path class="silo-outline" d="M 10 10 H 90 V 90 C 90 95, 80 100, 70 100 H 30 C 20 100, 10 95, 10 90 V 10 Z" />
                        <rect class="silo-fill-rect" x="15" y="${yPos}" width="70" height="${fillHeight}" rx="10"/>
                    </svg>
                    <div class="text-sm font-bold text-center">${deposito.clientes?.nombre || 'N/A'}</div>
                    <div class="text-xs text-gray-600 text-center">${deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)} ${deposito.nombre}</div>
                    <div class="text-xs font-semibold text-center">${totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn</div>
                </div>`;
        });
        
        silosEnCursoContainer.querySelectorAll('[data-deposito-id]').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('filtroSiloCelda').value = el.dataset.depositoId;
                aplicarFiltros();
                if (filtrosContainer.classList.contains('hidden')) toggleFiltrosBtn.click();
                document.querySelector('#operacionesContainer').scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    async function poblarFiltros() {
        const { data: mercaderias } = await supabase.from('mercaderias').select('nombre').order('nombre');
        const { data: depositos } = await supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
        
        const filtroMercaderia = document.getElementById('filtroMercaderia');
        filtroMercaderia.innerHTML = '<option value="">Todas</option>';
        mercaderias.forEach(m => filtroMercaderia.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`);

        // **CORRECCIÓN CLAVE**: El ID del select de silo/celda es 'filtroSiloCelda'
        const filtroSiloCelda = document.getElementById('filtroSiloCelda');
        filtroSiloCelda.innerHTML = '<option value="">Todos</option>';
        depositos.forEach(d => filtroSiloCelda.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`);
    }

    async function aplicarFiltros() {
        operacionesContainer.innerHTML = `<p class="text-center p-8">Cargando operaciones...</p>`;
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

        renderOperaciones(operacionesContainer, operaciones, true);
    }

    // --- Asignación de Event Listeners ---
    toggleFiltrosBtn.addEventListener('click', () => filtrosContainer.classList.toggle('hidden'));
    filtrosForm.addEventListener('input', aplicarFiltros);
    btnLimpiarFiltros.addEventListener('click', () => { filtrosForm.reset(); aplicarFiltros(); });
    
    operacionesContainer.addEventListener('click', (e) => {
        const headerRow = e.target.closest('tr[data-toggle-details]');
        if (headerRow) {
            headerRow.classList.toggle('is-open');
            document.getElementById(headerRow.dataset.toggleDetails)?.classList.toggle('hidden');
        }
    });

    // --- Carga Inicial ---
    poblarFiltros();
    renderSilosEnCurso();
    aplicarFiltros();
});