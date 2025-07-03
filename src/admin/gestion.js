import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const formCliente = document.getElementById('formCliente');
const nombreCliente = document.getElementById('nombreCliente');
const listaClientes = document.getElementById('listaClientes');

const formMercaderia = document.getElementById('formMercaderia');
const nombreMercaderia = document.getElementById('nombreMercaderia');
const listaMercaderias = document.getElementById('listaMercaderias');

const formDeposito = document.getElementById('formDeposito');
const nombreDeposito = document.getElementById('nombreDeposito');
const tipoDeposito = document.getElementById('tipoDeposito');
const clienteDepositoSelect = document.getElementById('clienteDeposito');
const capacidadDeposito = document.getElementById('capacidadDeposito');
const listaDepositos = document.getElementById('listaDepositos');

// --- Funciones de Renderizado (Definidas en el scope del módulo) ---

async function renderClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nombre');
  if (error) { console.error('Error cargando clientes:', error); return; }
  listaClientes.innerHTML = data.map(c => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${c.nombre}</span>
      <button data-id="${c.id}" data-table="clientes" class="delete-btn text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function renderMercaderias() {
  const { data, error } = await supabase.from('mercaderias').select('*').order('nombre');
  if (error) { console.error('Error cargando mercaderías:', error); return; }
  listaMercaderias.innerHTML = data.map(m => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${m.nombre}</span>
      <button data-id="${m.id}" data-table="mercaderias" class="delete-btn text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function renderDepositos() {
  const { data, error } = await supabase.from('depositos').select('*, clientes(nombre)').order('nombre');
  if (error) { console.error('Error cargando depósitos:', error); return; }
  listaDepositos.innerHTML = data.map(d => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <div class="flex-grow">
        <span>${d.nombre} (${d.tipo})</span><br>
        <span class="text-xs text-gray-500">${d.clientes?.nombre || 'Sin cliente'} - Cap: ${d.capacidad_toneladas} tn</span>
      </div>
      <button data-id="${d.id}" data-table="depositos" class="delete-btn text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function poblarClientesParaDepositos() {
    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) { console.error('Error poblando clientes para depósitos:', error); return; }
    clienteDepositoSelect.innerHTML = '<option value="">Seleccionar Cliente</option>';
    data.forEach(c => {
        clienteDepositoSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Carga inicial de todos los datos
    renderClientes();
    renderMercaderias();
    renderDepositos();
    poblarClientesParaDepositos();

    // Listener para el formulario de Clientes
    formCliente.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = nombreCliente.value.trim();
        if (!nombre) return;
        await supabase.from('clientes').insert([{ nombre }]);
        nombreCliente.value = '';
        renderClientes();
        poblarClientesParaDepositos(); // Actualizar el select en el form de depósitos
    });

    // Listener para el formulario de Mercaderías
    formMercaderia.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = nombreMercaderia.value.trim();
        if (!nombre) return;
        await supabase.from('mercaderias').insert([{ nombre }]);
        nombreMercaderia.value = '';
        renderMercaderias();
    });

    // Listener para el formulario de Depósitos
    formDeposito.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = nombreDeposito.value.trim();
        const tipo = tipoDeposito.value;
        const cliente_id = clienteDepositoSelect.value;
        const capacidad_toneladas = capacidadDeposito.value;

        if (!nombre || !cliente_id || !capacidad_toneladas) {
            alert("Por favor, complete todos los campos para el depósito.");
            return;
        }
        const { error } = await supabase.from('depositos').insert([{ nombre, tipo, cliente_id, capacidad_toneladas }]);
        if (error) {
            alert('Error al crear el depósito. Verifique que no exista uno igual para el mismo cliente.');
            console.error(error);
        } else {
            formDeposito.reset();
            renderDepositos();
        }
    });

    // Listener de click para toda la página (delegación de eventos para botones de borrado)
    document.addEventListener('click', async (e) => {
        const button = e.target.closest('button.delete-btn');
        if (!button) return;

        const id = button.dataset.id;
        const tableName = button.dataset.table;
        
        if (confirm('¿Está seguro de que desea eliminar este elemento? Esta acción podría afectar operaciones relacionadas.')) {
            const { error } = await supabase.from(tableName).delete().eq('id', id);

            if (error) {
                alert(`Error al eliminar: ${error.message}`);
                return;
            }
            
            // Re-renderizar la lista correspondiente
            if (tableName === 'clientes') {
                renderClientes();
                poblarClientesParaDepositos();
                renderDepositos(); // Re-renderizar depósitos por si alguno estaba asociado
            } else if (tableName === 'mercaderias') {
                renderMercaderias();
            } else if (tableName === 'depositos') {
                renderDepositos();
            }
        }
    });
});