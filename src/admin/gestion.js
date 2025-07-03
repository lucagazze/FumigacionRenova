import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos Comunes ---
const listaClientes = document.getElementById('listaClientes');
const listaMercaderias = document.getElementById('listaMercaderias');
const listaDepositos = document.getElementById('listaDepositos');

// --- Formulario Depósito ---
const formDeposito = document.getElementById('formDeposito');
const depositoIdInput = document.getElementById('depositoId');
const nombreDeposito = document.getElementById('nombreDeposito');
const tipoDeposito = document.getElementById('tipoDeposito');
const clienteDepositoSelect = document.getElementById('clienteDeposito');
const capacidadDeposito = document.getElementById('capacidadDeposito');
const depositoFormTitle = document.getElementById('depositoFormTitle');
const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');


// --- Render Functions ---

async function renderClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nombre');
  if (error) { console.error('Error cargando clientes:', error); return; }
  listaClientes.innerHTML = data.map(c => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${c.nombre}</span>
      <button data-id="${c.id}" data-table="clientes" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
    </div>
  `).join('');
}

async function renderMercaderias() {
  const { data, error } = await supabase.from('mercaderias').select('*').order('nombre');
  if (error) { console.error('Error cargando mercaderías:', error); return; }
  listaMercaderias.innerHTML = data.map(m => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${m.nombre}</span>
      <button data-id="${m.id}" data-table="mercaderias" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
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
        <span class="text-xs text-gray-500">${d.clientes?.nombre || 'Sin cliente'} - Cap: ${d.capacidad_toneladas || 0} tn</span>
      </div>
      <div class="flex gap-2">
        <button data-id="${d.id}" class="edit-deposito-btn text-blue-500 hover:text-blue-700 p-1"><span class="material-icons text-sm">edit</span></button>
        <button data-id="${d.id}" data-table="depositos" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
      </div>
    </div>
  `).join('');
}

async function poblarClientesParaDepositos() {
    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) { console.error('Error poblando clientes para depósitos:', error); return; }
    const currentVal = clienteDepositoSelect.value;
    clienteDepositoSelect.innerHTML = '<option value="">Seleccionar Cliente</option>';
    data.forEach(c => {
        clienteDepositoSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
    clienteDepositoSelect.value = currentVal;
}

// --- Lógica de Edición de Depósitos ---

function resetDepositoForm() {
    formDeposito.reset();
    depositoIdInput.value = '';
    depositoFormTitle.textContent = 'Añadir Depósito';
    btnCancelarEdicion.classList.add('hidden');
}

async function handleEditDepositoClick(id) {
    const { data, error } = await supabase.from('depositos').select('*').eq('id', id).single();
    if (error) {
        alert('Error al cargar los datos del depósito.');
        console.error(error);
        return;
    }
    depositoIdInput.value = data.id;
    nombreDeposito.value = data.nombre;
    tipoDeposito.value = data.tipo;
    clienteDepositoSelect.value = data.cliente_id;
    capacidadDeposito.value = data.capacidad_toneladas;

    depositoFormTitle.textContent = 'Editar Depósito';
    btnCancelarEdicion.classList.remove('hidden');
    nombreDeposito.focus();
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    renderClientes();
    renderMercaderias();
    renderDepositos();
    poblarClientesParaDepositos();

    // Listener para Clientes
    document.getElementById('formCliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreInput = document.getElementById('nombreCliente');
        const nombre = nombreInput.value.trim();
        if (!nombre) return;
        await supabase.from('clientes').insert([{ nombre }]);
        nombreInput.value = '';
        await renderClientes();
        await poblarClientesParaDepositos();
    });

    // Listener para Mercaderías
    document.getElementById('formMercaderia').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreInput = document.getElementById('nombreMercaderia');
        const nombre = nombreInput.value.trim();
        if (!nombre) return;
        await supabase.from('mercaderias').insert([{ nombre }]);
        nombreInput.value = '';
        await renderMercaderias();
    });

    // Listener para Depósitos (Crear y Actualizar)
    formDeposito.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = depositoIdInput.value;
        const depositoData = {
            nombre: nombreDeposito.value.trim(),
            tipo: tipoDeposito.value,
            cliente_id: clienteDepositoSelect.value,
            capacidad_toneladas: capacidadDeposito.value
        };

        if (!depositoData.nombre || !depositoData.cliente_id || !depositoData.capacidad_toneladas) {
            alert("Por favor, complete todos los campos para el depósito.");
            return;
        }

        let error;
        if (id) {
            // Actualizar
            ({ error } = await supabase.from('depositos').update(depositoData).eq('id', id));
        } else {
            // Crear
            ({ error } = await supabase.from('depositos').insert([depositoData]));
        }

        if (error) {
            alert('Error al guardar el depósito: ' + error.message);
        } else {
            resetDepositoForm();
            await renderDepositos();
        }
    });
    
    btnCancelarEdicion.addEventListener('click', resetDepositoForm);

    // Delegación de eventos para botones de borrado y edición
    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('button.delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const tableName = deleteBtn.dataset.table;
            if (confirm('¿Está seguro de que desea eliminar este elemento?')) {
                const { error } = await supabase.from(tableName).delete().eq('id', id);
                if (error) return alert(`Error al eliminar: ${error.message}`);
                
                if (tableName === 'clientes') {
                    await renderClientes();
                    await poblarClientesParaDepositos();
                    await renderDepositos();
                } else if (tableName === 'mercaderias') {
                    await renderMercaderias();
                } else if (tableName === 'depositos') {
                    await renderDepositos();
                }
            }
        }
        
        const editDepositoBtn = e.target.closest('button.edit-deposito-btn');
        if(editDepositoBtn) {
            handleEditDepositoClick(editDepositoBtn.dataset.id);
        }
    });
});