import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos DOM ---
const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
const filtrosContainer = document.getElementById('filtrosContainer');
const operacionesContainer = document.getElementById('operacionesContainer');
const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');

// --- Visualización de Silos ---
async function renderSilosEnCurso() {
    // 1. Obtener operaciones en curso
    const { data: opsEnCurso, error: opsError } = await supabase
        .from('operaciones')
        .select(`
            id,
            toneladas,
            deposito_id,
            operacion_original_id,
            tipo_registro,
            depositos (id, nombre, tipo, capacidad_toneladas, clientes (nombre))
        `)
        .eq('estado', 'en curso');

    if (opsError) {
        console.error("Error fetching ongoing operations:", opsError);
        silosEnCursoContainer.innerHTML = '<p>Error al cargar silos.</p>';
        return;
    }

    if (opsEnCurso.length === 0) {
        silosEnCursoContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">No hay operaciones en curso actualmente.</p>';
        return;
    }

    // 2. Agrupar toneladas por depósito
    const toneladasPorDeposito = new Map();
    for (const op of opsEnCurso) {
        if (!op.depositos) continue;
        
        const key = op.depositos.id;
        let currentData = toneladasPorDeposito.get(key);
        if (!currentData) {
            currentData = {
                deposito: op.depositos,
                totalToneladas: 0
            };
        }
        
        // Sumar solo si es un registro de producto o movimiento
        if ((op.tipo_registro === 'producto' || op.tipo_registro === 'movimiento') && op.toneladas) {
            currentData.totalToneladas += op.toneladas;
        }
        
        toneladasPorDeposito.set(key, currentData);
    }
    
    // 3. Renderizar cada silo
    silosEnCursoContainer.innerHTML = '';
    for (const [id, data] of toneladasPorDeposito.entries()) {
        const { deposito, totalToneladas } = data;
        const capacidad = deposito.capacidad_toneladas || 0;
        const porcentajeLlenado = capacidad > 0 ? (totalToneladas / capacidad) * 100 : 0;

        const siloHTML = `
            <div class="flex flex-col items-center gap-2" data-deposito-id="${deposito.id}">
                <div class="silo-container" title="Click para ver detalles">
                    <img src="/public/assets/img/silo.png" alt="Silo" class="silo-bg" />
                    <div class="silo-fill" style="height: ${Math.min(porcentajeLlenado, 100)}%;"></div>
                </div>
                <div class="text-sm font-bold">${deposito.clientes?.nombre || 'N/A'}</div>
                <div class="text-xs text-gray-600">${deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)} ${deposito.nombre}</div>
                <div class="text-xs font-semibold">${totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn</div>
            </div>
        `;
        silosEnCursoContainer.innerHTML += siloHTML;
    }
    
    // 4. Añadir event listeners
    silosEnCursoContainer.querySelectorAll('[data-deposito-id]').forEach(el => {
        el.addEventListener('click', () => {
            const depositoId = el.dataset.depositoId;
            // Redirige al registro de operaciones, filtrando por este depósito
            // (La lógica de filtrado se aplicará en dashboard.js al cargar)
            localStorage.setItem('filtro_deposito_id', depositoId);
            document.getElementById('filtroDeposito').value = depositoId; // Asume que el filtro usa el ID
            document.getElementById('filtroDeposito').dispatchEvent(new Event('change'));
            document.querySelector('#operacionesContainer').scrollIntoView({ behavior: 'smooth' });
        });
    });
}


// --- Lógica de Filtros (similar a la anterior, adaptada a nuevos nombres) ---

async function aplicarFiltros() {
    // ... (la lógica de aplicar filtros es similar, solo cambiar 'area' a 'deposito')
    // Se incluye la versión actualizada para claridad.
    let operaciones = await getOperaciones(); // Esta función debería traer los datos relacionados
    const cliente = document.getElementById('filtroCliente')?.value;
    const mercaderia = document.getElementById('filtroMercaderia')?.value;
    const estado = document.getElementById('filtroEstado')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;
    const fechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const fechaHasta = document.getElementById('filtroFechaHasta')?.value;
    const deposito = document.getElementById('filtroDeposito')?.value;
    const modalidad = document.getElementById('filtroModalidad')?.value;
    
    if (cliente) operaciones = operaciones.filter(op => op.clientes?.nombre.toLowerCase().includes(cliente.toLowerCase()));
    if (mercaderia) operaciones = operaciones.filter(op => op.mercaderias?.nombre === mercaderia);
    if (estado) operaciones = operaciones.filter(op => op.estado === estado);
    if (tipo) operaciones = operaciones.filter(op => op.tipo_registro === tipo);
    if (fechaDesde) operaciones = operaciones.filter(op => new Date(op.created_at) >= new Date(fechaDesde));
    if (fechaHasta) operaciones = operaciones.filter(op => new Date(op.created_at) <= new Date(fechaHasta));
    if (deposito) operaciones = operaciones.filter(op => op.deposito_id === deposito);
    if (modalidad) operaciones = operaciones.filter(op => op.modalidad === modalidad);

    renderOperaciones(operacionesContainer, operaciones, true);
}


// --- Carga inicial y Eventos ---
document.addEventListener('DOMContentLoaded', () => {
    // poblarFiltros(); // Función para poblar todos los filtros
    renderSilosEnCurso();
    aplicarFiltros();

    // Limpiar filtro de silo si se recarga la página
    localStorage.removeItem('filtro_deposito_id');
});

// ... resto de los event listeners para filtros