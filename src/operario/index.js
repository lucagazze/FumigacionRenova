import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';


requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const clienteSelect = document.getElementById('cliente');
const mercaderiaSelect = document.getElementById('mercaderia');
const metodoFumigacionSelect = document.getElementById('metodo_fumigacion');
const areaTipoSelect = document.getElementById('area_tipo');
const siloSelectorContainer = document.getElementById('silo_selector_container');
const celdaSelectorContainer = document.getElementById('celda_selector_container');
const siloSelect = document.getElementById('silo_selector');
const celdaSelect = document.getElementById('celda_selector');
const form = document.getElementById('nuevaOperacionForm');
const modal = document.getElementById('modalOperacionEnCurso');
const btnCerrarModal = document.getElementById('cerrarModalOperacion');

// --- Funciones para poblar los selects ---

async function poblarClientes() {
  const { data, error } = await supabase.from('clientes').select('nombre');
  if (error) return;
  clienteSelect.innerHTML = '<option value="">Seleccionar Cliente</option>';
  data.forEach(c => {
    clienteSelect.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
  });
}

async function poblarMercaderias() {
  const { data, error } = await supabase.from('mercaderias').select('nombre');
  if (error) return;
  mercaderiaSelect.innerHTML = '<option value="">Seleccionar Mercadería</option>';
  data.forEach(m => {
    mercaderiaSelect.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
  });
}

async function poblarAreas() {
  const { data, error } = await supabase.from('areas').select('nombre, tipo');
  if (error) return;
  
  const silos = data.filter(a => a.tipo === 'silo');
  const celdas = data.filter(a => a.tipo === 'celda');

  siloSelect.innerHTML = '<option value="">Seleccionar Silo</option>';
  silos.forEach(s => {
    siloSelect.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`;
  });

  celdaSelect.innerHTML = '<option value="">Seleccionar Celda</option>';
  celdas.forEach(c => {
    celdaSelect.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
  });
}

// --- Lógica de la página ---

areaTipoSelect.addEventListener('change', function() {
  if (this.value === 'silo') {
    siloSelectorContainer.classList.remove('hidden');
    celdaSelectorContainer.classList.add('hidden');
  } else if (this.value === 'celda') {
    celdaSelectorContainer.classList.remove('hidden');
    siloSelectorContainer.classList.add('hidden');
  } else {
    siloSelectorContainer.classList.add('hidden');
    celdaSelectorContainer.classList.add('hidden');
  }
});

if (btnCerrarModal) {
  btnCerrarModal.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const user = getUser();
  if (!user) {
      alert('Error de autenticación. Por favor, inicie sesión de nuevo.');
      return;
  }
  
  const cliente = clienteSelect.value;
  const area_tipo = areaTipoSelect.value;
  const metodo_fumigacion = metodoFumigacionSelect.value;
  const silo = siloSelect.value;
  const celda = celdaSelect.value;
  const operario_nombre = user.name;

  const { data: duplicada, error: duplicadaError } = await supabase
    .from('operaciones')
    .select('id')
    .eq('cliente', cliente)
    .eq('area_tipo', area_tipo)
    .eq(area_tipo === 'silo' ? 'silo' : 'celda', area_tipo === 'silo' ? silo : celda)
    .eq('estado', 'en curso');

  if (duplicadaError) {
    console.error('Error checking for duplicate operation:', duplicadaError);
    alert('Error al verificar la operación.');
    return;
  }

  if (duplicada.length > 0) {
    modal.querySelector('h3').textContent = 'Operación duplicada';
    modal.querySelector('p').textContent = 'Ya existe una operación activa con el mismo cliente, área y silo/celda.';
    modal.classList.remove('hidden');
    return;
  }

  const { data: opData, error: opError } = await supabase
    .from('operaciones')
    .insert([{
      cliente,
      area_tipo,
      silo: area_tipo === 'silo' ? silo : null,
      celda: area_tipo === 'celda' ? celda : null,
      mercaderia: mercaderiaSelect.value,
      metodo_fumigacion: metodo_fumigacion,
      operario_nombre: operario_nombre,
      estado: 'en curso',
      tipo_registro: 'inicial',
    }])
    .select()
    .single();

  if (opError) {
    console.error('Error creating operation:', opError);
    alert('Error al crear la operación.');
    return;
  }

  const checklistItems = [
    'Tapar ventiladores',
    'Sanitizar',
    'Verificar presencia de IV',
    'Colocar cartelería'
  ];

  const checklistToInsert = checklistItems.map(item => ({
    operacion_id: opData.id,
    item: item,
    completado: false,
  }));

  const { error: checklistError } = await supabase.from('checklist_items').insert(checklistToInsert);

  if (checklistError) {
    console.error('Error creating checklist items:', checklistError);
    alert('Error al crear los ítems del checklist.');
    await supabase.from('operaciones').delete().eq('id', opData.id);
    return;
  }

  localStorage.setItem('operacion_actual', opData.id);
  window.location.href = 'operacion.html';
});

// Carga inicial de datos
document.addEventListener('DOMContentLoaded', () => {
  poblarClientes();
  poblarMercaderias();
  poblarAreas();
});