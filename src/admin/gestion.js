import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos DOM ---
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

// --- Filtros Depósito ---
const filtrosDepositosForm = document.getElementById('filtrosDepositos');
const btnLimpiarFiltrosDeposito = document.getElementById('btnLimpiarFiltrosDeposito');

let allClientes = [];
let allDepositos = [];

// --- Funciones de Renderizado ---
function renderClientes(clientes) {
  listaClientes.innerHTML = clientes.map(c => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-2 text-sm font-medium text-gray-800">${c.nombre}</td>
      <td class="px-4 py-2 text-right">
        <button data-id="${c.id}" data-table="clientes" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
      </td>
    </tr>
  `).join('');
}

function renderMercaderias(mercaderias) {
  listaMercaderias.innerHTML = mercaderias.map(m => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-2 text-sm font-medium text-gray-800">${m.nombre}</td>
      <td class="px-4 py-2 text-right">
        <button data-id="${m.id}" data-table="mercaderias" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
      </td>
    </tr>
  `).join('');
}

function renderDepositos(depositos) {
  listaDepositos.innerHTML = depositos.map(d => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-2 text-sm font-medium text-gray-800">${d.nombre}</td>
      <td class="px-4 py-2 text-sm text-gray-600">${d.tipo}</td>
      <td class="px-4 py-2 text-sm text-gray-600">${d.clientes?.nombre || 'Sin cliente'}</td>
      <td class="px-4 py-2 text-sm text-gray-600">${d.capacidad_toneladas?.toLocaleString() || 'N/A'}</td>
      <td class="px-4 py-2 text-right">
        <button data-id="${d.id}" class="edit-deposito-btn text-blue-500 hover:text-blue-700 p-1"><span class="material-icons text-sm">edit</span></button>
        <button data-id="${d.id}" data-table="depositos" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons text-sm">delete</span></button>
      </td>
    </tr>
  `).join('');
}

async function fetchAndRenderAll() {
    const { data: clientesData, error: clientesError } = await supabase.from('clientes').select('*').order('nombre');
    if (clientesError) { console.error('Error cargando clientes:', clientesError); return; }
    allClientes = clientesData;
    renderClientes(allClientes);
    poblarSelectsClientes(allClientes);

    const { data: mercaderiasData, error: mercaderiasError } = await supabase.from('mercaderias').select('*').order('nombre');
    if (mercaderiasError) { console.error('Error cargando mercaderías:', mercaderiasError); return; }
    renderMercaderias(mercaderiasData);

    const { data: depositosData, error: depositosError } = await supabase.from('depositos').select('*, clientes(nombre)').order('nombre');
    if (depositosError) { console.error('Error cargando depósitos:', depositosError); return; }
    allDepositos = depositosData;
    renderDepositos(allDepositos);
}

function poblarSelectsClientes(clientes) {
    const filtroClienteSelect = document.getElementById('filtroClienteDeposito');
    
    // Guardar valor actual para no perderlo al repoblar
    const currentFormVal = clienteDepositoSelect.value;
    const currentFilterVal = filtroClienteSelect.value;

    clienteDepositoSelect.innerHTML = '<option value="">Seleccionar Cliente</option>';
    filtroClienteSelect.innerHTML = '<option value="">Todos los Clientes</option>';

    clientes.forEach(c => {
        clienteDepositoSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        filtroClienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    clienteDepositoSelect.value = currentFormVal;
    filtroClienteSelect.value = currentFilterVal;
}

function aplicarFiltrosDepositos() {
    const clienteId = document.getElementById('filtroClienteDeposito').value;
    const tipo = document.getElementById('filtroTipoDeposito').value;

    const filtered = allDepositos.filter(d => {
        const matchCliente = !clienteId || d.cliente_id === clienteId;
        const matchTipo = !tipo || d.tipo === tipo;
        return matchCliente && matchTipo;
    });
    renderDepositos(filtered);
}

// --- Lógica de Formularios y Edición ---
function resetDepositoForm() {
    formDeposito.reset();
    depositoIdInput.value = '';
    depositoFormTitle.textContent = 'Añadir Depósito';
    btnCancelarEdicion.classList.add('hidden');
}

async function handleEditDepositoClick(id) {
    const { data, error } = await supabase.from('depositos').select('*').eq('id', id).single();
    if (error) { alert('Error al cargar datos del depósito.'); return; }
    
    depositoIdInput.value = data.id;
    nombreDeposito.value = data.nombre;
    tipoDeposito.value = data.tipo;
    clienteDepositoSelect.value = data.cliente_id;
    capacidadDeposito.value = data.capacidad_toneladas;
    depositoFormTitle.textContent = 'Editar Depósito';
    btnCancelarEdicion.classList.remove('hidden');
    formDeposito.scrollIntoView({ behavior: 'smooth' });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchAndRenderAll();

    document.getElementById('formCliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreInput = document.getElementById('nombreCliente');
        const nombre = nombreInput.value.trim();
        if (!nombre) return;
        await supabase.from('clientes').insert([{ nombre }]);
        nombreInput.value = '';
        await fetchAndRenderAll(); // Recargar todo para mantener consistencia
    });

    document.getElementById('formMercaderia').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreInput = document.getElementById('nombreMercaderia');
        const nombre = nombreInput.value.trim();
        if (!nombre) return;
        await supabase.from('mercaderias').insert([{ nombre }]);
        nombreInput.value = '';
        await fetchAndRenderAll();
    });

    formDeposito.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = depositoIdInput.value;
        const data = {
            nombre: nombreDeposito.value.trim(),
            tipo: tipoDeposito.value,
            cliente_id: clienteDepositoSelect.value,
            capacidad_toneladas: capacidadDeposito.value
        };
        if (!data.nombre || !data.cliente_id || !data.capacidad_toneladas) {
            return alert("Por favor, complete todos los campos para el depósito.");
        }
        const { error } = id
            ? await supabase.from('depositos').update(data).eq('id', id)
            : await supabase.from('depositos').insert([data]);

        if (error) { alert('Error al guardar el depósito: ' + error.message); }
        else {
            resetDepositoForm();
            await fetchAndRenderAll();
        }
    });
    
    btnCancelarEdicion.addEventListener('click', resetDepositoForm);
    filtrosDepositosForm.addEventListener('change', aplicarFiltrosDepositos);
    btnLimpiarFiltrosDeposito.addEventListener('click', () => {
        filtrosDepositosForm.reset();
        aplicarFiltrosDepositos();
    });

    // Delegación de eventos para botones de borrado y edición
    document.body.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('button.delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const tableName = deleteBtn.dataset.table;
            if (confirm('¿Está seguro? Esta acción podría afectar registros asociados.')) {
                await supabase.from(tableName).delete().eq('id', id);
                await fetchAndRenderAll();
            }
        }
        
        const editDepositoBtn = e.target.closest('button.edit-deposito-btn');
        if(editDepositoBtn) {
            handleEditDepositoClick(editDepositoBtn.dataset.id);
        }
    });
});