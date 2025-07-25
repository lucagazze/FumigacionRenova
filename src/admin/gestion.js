import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const formCliente = document.getElementById('formCliente');
const listaClientes = document.getElementById('listaClientes');

const formMercaderia = document.getElementById('formMercaderia');
const listaMercaderias = document.getElementById('listaMercaderias');

// Apuntamos a los nuevos IDs del formulario de depósitos
const formDeposito = document.getElementById('formDeposito');
const listaDepositos = document.getElementById('listaDepositos');
const depositoClienteSelect = document.getElementById('depositoClienteSelect');

// --- Funciones de Renderizado ---

async function renderClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nombre');
  if (error) return;
  
  listaClientes.innerHTML = data.map(c => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${c.nombre}</span>
      <button data-id="${c.id}" data-table="clientes" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');

  // Llena el selector de clientes en el formulario de Depósitos
  depositoClienteSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
  data.forEach(cliente => {
    depositoClienteSelect.innerHTML += `<option value="${cliente.id}">${cliente.nombre}</option>`;
  });
}

async function renderMercaderias() {
  const { data, error } = await supabase.from('mercaderias').select('*').order('nombre');
  if (error) return;
  listaMercaderias.innerHTML = data.map(m => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${m.nombre}</span>
      <button data-id="${m.id}" data-table="mercaderias" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

// Función corregida para renderizar DEPÓSITOS
async function renderDepositos() {
  const { data, error } = await supabase
    .from('depositos')
    .select('id, nombre, tipo, capacidad_toneladas, clientes(nombre)')
    .order('nombre');

  if (error) {
    console.error("Error cargando depósitos:", error);
    return;
  }

  listaDepositos.innerHTML = data.map(d => {
    const nombreCliente = d.clientes ? d.clientes.nombre : 'Sin cliente';
    return `
        <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
          <span>${d.nombre} (${d.tipo}) - <b>${nombreCliente}</b></span>
          <button data-id="${d.id}" data-table="depositos" class="text-red-500 hover:text-red-700">
            <span class="material-icons">delete</span>
          </button>
        </div>
    `;
  }).join('');
}

// --- Event Listeners ---

formCliente.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombreCliente').value.trim();
  if (!nombre) return;
  const { error } = await supabase.from('clientes').insert([{ nombre }]);
  if (error) {
    alert('Error al añadir cliente: ' + error.message);
  } else {
    formCliente.reset();
    renderClientes();
  }
});

formMercaderia.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombreMercaderia').value.trim();
  if (!nombre) return;
  const { error } = await supabase.from('mercaderias').insert([{ nombre }]);
  if (error) {
    alert('Error al añadir mercadería: ' + error.message);
  } else {
    formMercaderia.reset();
    renderMercaderias();
  }
});

// Listener del formulario de Depósitos CORREGIDO
formDeposito.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombreDeposito').value.trim();
  const tipo = document.getElementById('tipoDeposito').value;
  const cliente_id = depositoClienteSelect.value;
  const capacidad_toneladas = document.getElementById('capacidadDeposito').value || null;

  if (!nombre || !cliente_id) {
    alert("Por favor, complete todos los campos, incluyendo el cliente.");
    return;
  }

  // Insertamos en la tabla 'depositos'
  const { error } = await supabase.from('depositos').insert([
    { nombre, tipo, cliente_id, capacidad_toneladas }
  ]);
  
  if (error) {
    alert('Error al añadir depósito: ' + error.message);
  } else {
    formDeposito.reset();
    renderDepositos();
  }
});

// Delegación de eventos para botones de borrado
document.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-id][data-table]');
  if (!button) return;

  const { id, table } = button.dataset;
  
  if (confirm('¿Está seguro de que desea eliminar este elemento?')) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        // Vuelve a renderizar la sección correspondiente
        if (table === 'clientes') renderClientes();
        if (table === 'mercaderias') renderMercaderias();
        if (table === 'depositos') renderDepositos();
    }
  }
});

// Carga inicial de datos
function init() {
    renderClientes();
    renderMercaderias();
    renderDepositos();
}

init();