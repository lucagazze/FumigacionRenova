import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { getOperaciones, renderOperaciones as renderOperacionesComun } from '../common/data.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

const toggleFiltrosBtn = document.getElementById('toggleFiltrosBtn');
const filtrosContainer = document.getElementById('filtrosContainer');
const operacionesContainer = document.getElementById('operacionesContainer');

if (toggleFiltrosBtn && filtrosContainer) {
  toggleFiltrosBtn.addEventListener('click', () => {
    filtrosContainer.classList.toggle('hidden');
  });
}

async function poblarFiltroAreas() {
    const filtroArea = document.getElementById('filtroArea');
    if (!filtroArea) return;

    const { data, error } = await supabase.from('areas').select('nombre, tipo').order('tipo').order('nombre');
    if (error) {
        console.error("Error fetching areas for filter:", error);
        return;
    }
    
    filtroArea.innerHTML = '<option value="">Todos</option>';

    data.forEach(area => {
        const option = document.createElement('option');
        option.value = area.nombre;
        option.textContent = `${area.nombre} (${area.tipo})`;
        filtroArea.appendChild(option);
    });
}

async function aplicarFiltros() {
  let operaciones = await getOperaciones();
  const cliente = document.getElementById('filtroCliente')?.value;
  const mercaderia = document.getElementById('filtroMercaderia')?.value;
  const metodo = document.getElementById('filtroMetodo')?.value; // Cambiado de 'filtroEstado'
  const tipo = document.getElementById('filtroTipo')?.value;
  const fechaDesde = document.getElementById('filtroFechaDesde')?.value;
  const fechaHasta = document.getElementById('filtroFechaHasta')?.value;
  const deposito = document.getElementById('filtroDeposito')?.value;
  const modalidad = document.getElementById('filtroModalidad')?.value;
  const area = document.getElementById('filtroArea')?.value;

  if (cliente) {
    operaciones = operaciones.filter(op => op.cliente && op.cliente.toLowerCase().includes(cliente.toLowerCase()));
  }
  if (mercaderia) {
    operaciones = operaciones.filter(op => op.mercaderia === mercaderia);
  }
  if (metodo) { // Cambiado de 'estado'
    operaciones = operaciones.filter(op => op.metodo_fumigacion === metodo);
  }
  if (tipo) {
    operaciones = operaciones.filter(op => (op.tipo_registro || 'inicial') === tipo);
  }
  if (fechaDesde) {
    operaciones = operaciones.filter(op => new Date(op.created_at) >= new Date(fechaDesde));
  }
  if (fechaHasta) {
    operaciones = operaciones.filter(op => new Date(op.created_at) <= new Date(fechaHasta));
  }
  if (deposito) {
    operaciones = operaciones.filter(op => op.deposito === deposito);
  }
  if (modalidad) {
    operaciones = operaciones.filter(op => op.modalidad === modalidad);
  }
  if (area) {
    operaciones = operaciones.filter(op => op.silo === area || op.celda === area);
  }
  
  renderOperacionesComun(operacionesContainer, operaciones, false);
}

// Añadir event listeners a los filtros
const filtros = document.getElementById('filtrosRegistro');
if (filtros) {
  Array.from(filtros.elements).forEach(el => {
    el.addEventListener('change', aplicarFiltros);
    el.addEventListener('input', aplicarFiltros);
  });
}

const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
if (btnLimpiarFiltros) {
  btnLimpiarFiltros.addEventListener('click', () => {
    if (filtros) {
      Array.from(filtros.elements).forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
          el.value = '';
        }
      });
    }
    aplicarFiltros();
  });
}

// Render inicial y al cambiar tamaño de ventana
document.addEventListener('DOMContentLoaded', () => {
    poblarFiltroAreas();
    aplicarFiltros();
});
window.addEventListener('resize', aplicarFiltros);