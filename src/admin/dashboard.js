import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
const filtrosContainer = document.getElementById('filtrosContainer');
const operacionesContainer = document.getElementById('operacionesContainer');
const silosEnCursoContainer = document.getElementById('silosEnCursoContainer');
const filtrosForm = document.getElementById('filtrosRegistro');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

async function renderSilosEnCurso() {
    const { data: opsEnCurso, error } = await supabase
        .from('operaciones')
        .select(`
            toneladas, tipo_registro,
            depositos (id, nombre, tipo, capacidad_toneladas, clientes (nombre))
        `)
        .eq('estado', 'en curso');

    if (error) {
        silosEnCursoContainer.innerHTML = '<p class="col-span-full text-red-500">Error al cargar los depósitos.</p>';
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
    toneladasPorDeposito.forEach((data, id) => {
        const { deposito, totalToneladas } = data;
        const capacidad = deposito.capacidad_toneladas || 0;
        const porcentajeLlenado = capacidad > 0 ? (totalToneladas / capacidad) * 100 : 0;
        
        const fillHeight = 80 * (Math.min(porcentajeLlenado, 100) / 100);
        const yPos = 95 - fillHeight;

        const siloHTML = `
            <div class="flex flex-col items-center gap-2 silo-wrapper" data-deposito-id="${deposito.id}" title="Click para filtrar operaciones de este depósito">
                <svg viewBox="0 0 100 100" class="silo-svg">
                    <path class="silo-outline" d="M 10 10 H 90 V 90 C 90 95, 80 100, 70 100 H 30 C 20 100, 10 95, 10 90 V 10 Z" />
                    <rect class="silo-fill-rect" x="15" y="${yPos}" width="70" height="${fillHeight}" rx="10"/>
                </svg>
                <div class="text-sm font-bold text-center">${deposito.clientes?.nombre || 'N/A'}</div>
                <div class="text-xs text-gray-600 text-center">${deposito.tipo.charAt(0).toUpperCase() + deposito.tipo.slice(1)} ${deposito.nombre}</div>
                <div class="text-xs font-semibold text-center">${totalToneladas.toLocaleString()} / ${capacidad.toLocaleString()} tn</div>
            </div>
        `;
        silosEnCursoContainer.innerHTML += siloHTML;
    });
    
    silosEnCursoContainer.querySelectorAll('[data-deposito-id]').forEach(el => {
        el.addEventListener('click', () => {
            const depositoId = el.dataset.depositoId;
            const filtroDepositoSelect = document.getElementById('filtroDeposito');
            if (filtroDepositoSelect) {
                filtroDepositoSelect.value = depositoId;
                aplicarFiltros();
                filtrosContainer.classList.remove('hidden');
                document.querySelector('#operacionesContainer').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

async function poblarFiltros() {
    // **CORRECCIÓN**: Se destructura la respuesta de supabase en 'depositos'
    const { data: depositos, error } = await supabase.from('depositos').select('id, nombre, tipo, clientes(nombre)').order('nombre');
    if (error) { console.error("Error fetching depositos for filter:", error); return; }
    
    const filtroDeposito = document.getElementById('filtroDeposito');
    filtroDeposito.innerHTML = '<option value="">Todos los Depósitos</option>';
    // **CORRECCIÓN**: Se itera sobre 'depositos', no sobre 'data'
    depositos.forEach(d => filtroDeposito.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo}) - ${d.clientes.nombre}</option>`);
}

async function aplicarFiltros() {
  let operaciones = await getOperaciones();
  
  const depositoId = document.getElementById('filtroDeposito')?.value;
  const estado = document.getElementById('filtroEstado')?.value;

  if (depositoId) {
    operaciones = operaciones.filter(op => op.deposito_id === depositoId);
  }
  if (estado) {
    operaciones = operaciones.filter(op => op.estado === estado);
  }
  
  renderOperaciones(operacionesContainer, operaciones, true);
}

toggleFiltrosBtn.addEventListener('click', () => {
    filtrosContainer.classList.toggle('hidden');
});

filtrosForm.addEventListener('input', aplicarFiltros);
filtrosForm.addEventListener('change', aplicarFiltros);

btnLimpiarFiltros.addEventListener('click', () => {
    filtrosForm.reset();
    aplicarFiltros();
});

document.addEventListener('DOMContentLoaded', () => {
    poblarFiltros();
    renderSilosEnCurso();
    aplicarFiltros();
});