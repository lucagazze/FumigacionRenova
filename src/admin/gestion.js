import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const formCliente = document.getElementById('formCliente');
const listaClientes = document.getElementById('listaClientes');
const clienteIdInput = document.getElementById('clienteId');
const formClienteTitle = document.getElementById('formClienteTitle');
const btnGuardarCliente = document.getElementById('btnGuardarCliente');
const btnCancelarCliente = document.getElementById('btnCancelarCliente');

const formMercaderia = document.getElementById('formMercaderia');
const listaMercaderias = document.getElementById('listaMercaderias');
const mercaderiaIdInput = document.getElementById('mercaderiaId');
const formMercaderiaTitle = document.getElementById('formMercaderiaTitle');
const btnGuardarMercaderia = document.getElementById('btnGuardarMercaderia');
const btnCancelarMercaderia = document.getElementById('btnCancelarMercaderia');

const formDeposito = document.getElementById('formDeposito');
const listaDepositos = document.getElementById('listaDepositos');
const depositoClienteSelect = document.getElementById('depositoClienteSelect');
const depositoIdInput = document.getElementById('depositoId');
const formDepositoTitle = document.getElementById('formDepositoTitle');
const btnGuardarDeposito = document.getElementById('btnGuardarDeposito');
const btnCancelarDeposito = document.getElementById('btnCancelarDeposito');

// --- Almacenamiento de IDs en uso ---
let usedClientIds = new Set();
let usedMercaderiaIds = new Set();
let usedDepositoIds = new Set();

async function fetchUsedIds() {
    const { data, error } = await supabase.from('operaciones').select('cliente_id, mercaderia_id, deposito_id');
    if (error) {
        console.error("Error fetching used IDs:", error);
        return;
    }
    usedClientIds = new Set(data.map(op => op.cliente_id).filter(Boolean));
    usedMercaderiaIds = new Set(data.map(op => op.mercaderia_id).filter(Boolean));
    usedDepositoIds = new Set(data.map(op => op.deposito_id).filter(Boolean));
}

// --- Funciones de Renderizado ---
async function renderClientes() {
    const { data, error } = await supabase.from('clientes').select('*').order('nombre');
    if (error) return;

    listaClientes.innerHTML = data.map(c => {
        const isInUse = usedClientIds.has(c.id);
        const actionButtons = isInUse ? '' : `
            <div class="flex items-center gap-2">
                <button data-id="${c.id}" data-nombre="${c.nombre}" data-action="edit" data-type="cliente" class="text-blue-500 hover:text-blue-700 p-1"><span class="material-icons text-base">edit</span></button>
                <button data-id="${c.id}" data-action="delete" data-type="cliente" class="text-red-500 hover:text-red-700 p-1"><span class="material-icons text-base">delete</span></button>
            </div>
        `;
        return `
            <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
                <span>${c.nombre}</span>
                ${actionButtons}
            </div>`;
    }).join('');

    depositoClienteSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
    data.forEach(cliente => {
        depositoClienteSelect.innerHTML += `<option value="${cliente.id}">${cliente.nombre}</option>`;
    });
}

async function renderMercaderias() {
    const { data, error } = await supabase.from('mercaderias').select('*').order('nombre');
    if (error) return;
    listaMercaderias.innerHTML = data.map(m => {
        const isInUse = usedMercaderiaIds.has(m.id);
        const actionButtons = isInUse ? '' : `
            <div class="flex items-center gap-2">
                <button data-id="${m.id}" data-nombre="${m.nombre}" data-action="edit" data-type="mercaderia" class="text-blue-500 hover:text-blue-700 p-1"><span class="material-icons text-base">edit</span></button>
                <button data-id="${m.id}" data-action="delete" data-type="mercaderia" class="text-red-500 hover:text-red-700 p-1"><span class="material-icons text-base">delete</span></button>
            </div>
        `;
        return `
            <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
                <span>${m.nombre}</span>
                ${actionButtons}
            </div>`;
    }).join('');
}

async function renderDepositos() {
    const { data, error } = await supabase.from('depositos').select('*, clientes(nombre)').order('nombre');
    if (error) { console.error("Error cargando depósitos:", error); return; }

    listaDepositos.innerHTML = data.map(d => {
        const isInUse = usedDepositoIds.has(d.id);
        const actionButtons = isInUse ? '' : `
            <div class="flex items-center gap-2">
                <button data-json='${JSON.stringify(d)}' data-action="edit" data-type="deposito" class="text-blue-500 hover:text-blue-700 p-1"><span class="material-icons text-base">edit</span></button>
                <button data-id="${d.id}" data-action="delete" data-type="deposito" class="text-red-500 hover:text-red-700 p-1"><span class="material-icons text-base">delete</span></button>
            </div>
        `;
        const capacidad = d.capacidad_toneladas ? ` - ${d.capacidad_toneladas.toLocaleString()} tn` : '';
        const nombreCliente = d.clientes ? d.clientes.nombre : 'Sin cliente';
        return `
            <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
                <span class="text-sm">${d.nombre} (${d.tipo})${capacidad} - <b>${nombreCliente}</b></span>
                ${actionButtons}
            </div>`;
    }).join('');
}

// --- Lógica de Formularios ---
function setupForm(type, formEl, idInput, titleEl, btnGuardar, btnCancelar) {
    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = idInput.value;
        let data = {};
        let tableName = '';

        if (type === 'cliente') {
            data = { nombre: document.getElementById('nombreCliente').value.trim() };
            tableName = 'clientes';
        } else if (type === 'mercaderia') {
            data = { nombre: document.getElementById('nombreMercaderia').value.trim() };
            tableName = 'mercaderias';
        } else if (type === 'deposito') {
            tableName = 'depositos';
            data = {
                nombre: document.getElementById('nombreDeposito').value.trim(),
                tipo: document.getElementById('tipoDeposito').value,
                cliente_id: depositoClienteSelect.value,
                capacidad_toneladas: document.getElementById('capacidadDeposito').value || null
            };
        }

        if (Object.values(data).some(val => !val) && type !== 'deposito') {
            return;
        }

        let error;
        if (id) { // Modo Edición
            const { error: updateError } = await supabase.from(tableName).update(data).eq('id', id);
            error = updateError;
        } else { // Modo Creación
            const { error: insertError } = await supabase.from(tableName).insert([data]);
            error = insertError;
        }

        if (error) {
            alert(`Error al guardar: ${error.message}`);
        } else {
            resetForm(type, formEl, idInput, titleEl, btnGuardar, btnCancelar);
            init();
        }
    });

    btnCancelar.addEventListener('click', () => {
        resetForm(type, formEl, idInput, titleEl, btnGuardar, btnCancelar);
    });
}

function resetForm(type, formEl, idInput, titleEl, btnGuardar, btnCancelar) {
    formEl.reset();
    idInput.value = '';
    btnCancelar.classList.add('hidden');
    if (type === 'cliente') {
        titleEl.textContent = 'Añadir Cliente';
        btnGuardar.textContent = 'Añadir';
    } else if (type === 'mercaderia') {
        titleEl.textContent = 'Añadir Mercadería';
        btnGuardar.textContent = 'Añadir';
    } else if (type === 'deposito') {
        titleEl.textContent = 'Añadir Depósito';
        btnGuardar.textContent = 'Añadir Depósito';
    }
}


// --- Delegación de Eventos para botones de acción ---
document.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const { action, type, id } = button.dataset;

    if (action === 'delete') {
        const tableName = type === 'cliente' ? 'clientes' : type === 'mercaderia' ? 'mercaderias' : 'depositos';
        if (confirm(`¿Está seguro de que desea eliminar este elemento?`)) {
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) {
                alert("Error al eliminar: " + error.message);
            } else {
                init();
            }
        }
    } else if (action === 'edit') {
        if (type === 'cliente') {
            clienteIdInput.value = id;
            document.getElementById('nombreCliente').value = button.dataset.nombre;
            formClienteTitle.textContent = 'Editar Cliente';
            btnGuardarCliente.textContent = 'Guardar';
            btnCancelarCliente.classList.remove('hidden');
        } else if (type === 'mercaderia') {
            mercaderiaIdInput.value = id;
            document.getElementById('nombreMercaderia').value = button.dataset.nombre;
            formMercaderiaTitle.textContent = 'Editar Mercadería';
            btnGuardarMercaderia.textContent = 'Guardar';
            btnCancelarMercaderia.classList.remove('hidden');
        } else if (type === 'deposito') {
            const data = JSON.parse(button.dataset.json);
            depositoIdInput.value = data.id;
            document.getElementById('nombreDeposito').value = data.nombre;
            document.getElementById('tipoDeposito').value = data.tipo;
            document.getElementById('capacidadDeposito').value = data.capacidad_toneladas;
            depositoClienteSelect.value = data.cliente_id;
            formDepositoTitle.textContent = 'Editar Depósito';
            btnGuardarDeposito.textContent = 'Guardar';
            btnCancelarDeposito.classList.remove('hidden');
        }
    }
});

// Carga inicial de datos
async function init() {
    await fetchUsedIds();
    renderClientes();
    renderMercaderias();
    renderDepositos();
}

setupForm('cliente', formCliente, clienteIdInput, formClienteTitle, btnGuardarCliente, btnCancelarCliente);
setupForm('mercaderia', formMercaderia, mercaderiaIdInput, formMercaderiaTitle, btnGuardarMercaderia, btnCancelarMercaderia);
setupForm('deposito', formDeposito, depositoIdInput, formDepositoTitle, btnGuardarDeposito, btnCancelarDeposito);

init();