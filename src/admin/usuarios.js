import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del Formulario ---
const form = document.getElementById('formUsuario');
const formTitle = document.getElementById('form-title');
const btnCancel = document.getElementById('btnCancel');
const usuarioIdField = document.getElementById('usuarioId');
const passwordInput = document.getElementById('password');
const passwordHelper = document.getElementById('password-helper');
const roleSelect = document.getElementById('role');
const clienteCheckboxContainer = document.getElementById('cliente-checkbox-container');
const clienteListDiv = document.getElementById('cliente-list');

// --- Elementos de la Lista y Filtros ---
const listaUsuarios = document.getElementById('listaUsuarios'); // Ahora es el tbody
const filtrosForm = document.getElementById('filtrosForm');
const filtroNombre = document.getElementById('filtroNombre');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

let allUsersWithClients = []; // Variable para almacenar todos los usuarios y poder filtrar

async function poblarSelectClientes() {
    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) { console.error('Error cargando clientes:', error); return; }
    
    // Poblar checkboxes del formulario
    clienteListDiv.innerHTML = data.map(c => `
        <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
            <input type="checkbox" name="cliente" value="${c.id}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
            <span>${c.nombre}</span>
        </label>
    `).join('');
    
    // Poblar select del filtro
    const filtroClienteSelect = document.getElementById('filtroCliente');
    filtroClienteSelect.innerHTML = '<option value="">Todos los Clientes</option>';
    data.forEach(c => {
        filtroClienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

function renderUsuarios(usersToRender) {
    if (usersToRender.length === 0) {
        listaUsuarios.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No se encontraron usuarios con los filtros aplicados.</td></tr>`;
        return;
    }
    
    listaUsuarios.innerHTML = usersToRender.map(u => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${u.nombre} ${u.apellido}</div>
                <div class="text-sm text-gray-500">${u.email}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                ${u.password}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                    ${u.role}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">
                ${u.role === 'operario' ? u.clientes.join(', ') || 'Ninguno' : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-id="${u.id}" class="edit-btn text-blue-600 hover:text-blue-900 p-1"><span class="material-icons">edit</span></button>
                <button data-id="${u.id}" class="delete-btn text-red-600 hover:text-red-900 p-1"><span class="material-icons">delete</span></button>
            </td>
        </tr>
    `).join('');
}


async function cargarYRenderizarUsuarios() {
    const { data: usuarios, error } = await supabase.from('usuarios').select('id, nombre, apellido, email, password, role').order('nombre');
    if (error) { console.error('Error cargando usuarios:', error); return; }
    
    const { data: relaciones } = await supabase.from('operario_clientes').select('*, clientes(id, nombre)');

    allUsersWithClients = usuarios.map(u => {
        const clientesAsignados = relaciones
            .filter(r => r.operario_id === u.id)
            .map(r => ({ id: r.clientes.id, nombre: r.clientes.nombre }));
        return { ...u, clientes: clientesAsignados.map(c => c.nombre), cliente_ids: clientesAsignados.map(c => c.id) };
    });
    
    renderUsuarios(allUsersWithClients);
}

function aplicarFiltros() {
    const nombreQuery = filtroNombre.value.toLowerCase();
    const rolQuery = document.getElementById('filtroRol').value;
    const clienteQuery = document.getElementById('filtroCliente').value;

    let filteredUsers = allUsersWithClients.filter(user => {
        const matchNombre = user.nombre.toLowerCase().includes(nombreQuery) || user.apellido.toLowerCase().includes(nombreQuery) || user.email.toLowerCase().includes(nombreQuery);
        const matchRol = !rolQuery || user.role === rolQuery;
        const matchCliente = !clienteQuery || user.cliente_ids.includes(clienteQuery);
        
        return matchNombre && matchRol && matchCliente;
    });

    renderUsuarios(filteredUsers);
}

// --- Lógica de Formulario ---
function resetForm() {
    form.reset();
    usuarioIdField.value = '';
    formTitle.textContent = 'Añadir Nuevo Usuario';
    btnCancel.classList.add('hidden');
    passwordInput.placeholder = "Nueva contraseña";
    passwordHelper.classList.remove('hidden');
    roleSelect.value = 'operario';
    clienteCheckboxContainer.classList.remove('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = usuarioIdField.value;
    const userData = {
        nombre: document.getElementById('nombre').value,
        apellido: document.getElementById('apellido').value,
        email: document.getElementById('email').value,
        role: roleSelect.value
    };
    if (passwordInput.value) userData.password = passwordInput.value;

    let savedUser;
    if (id) {
        const { data, error } = await supabase.from('usuarios').update(userData).eq('id', id).select().single();
        if (error) return alert(`Error al actualizar usuario: ${error.message}`);
        savedUser = data;
    } else {
        if (!userData.password) return alert("La contraseña es obligatoria para nuevos usuarios.");
        const { data, error } = await supabase.from('usuarios').insert([userData]).select().single();
        if (error) return alert(`Error al crear usuario: ${error.message}`);
        savedUser = data;
    }

    if (savedUser.role === 'operario') {
        await supabase.from('operario_clientes').delete().eq('operario_id', savedUser.id);
        const selectedClientes = Array.from(document.querySelectorAll('[name="cliente"]:checked')).map(cb => cb.value);
        if (selectedClientes.length > 0) {
            const rels = selectedClientes.map(cliente_id => ({ operario_id: savedUser.id, cliente_id }));
            await supabase.from('operario_clientes').insert(rels);
        }
    }
    
    resetForm();
    await cargarYRenderizarUsuarios();
    aplicarFiltros();
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await poblarSelectClientes();
    await cargarYRenderizarUsuarios();
    resetForm(); 
    roleSelect.dispatchEvent(new Event('change'));
});

form.addEventListener('submit', handleFormSubmit);
btnCancel.addEventListener('click', resetForm);
roleSelect.addEventListener('change', () => clienteCheckboxContainer.classList.toggle('hidden', roleSelect.value !== 'operario'));

// Listeners para filtros
filtroNombre.addEventListener('input', aplicarFiltros);
filtrosForm.addEventListener('change', aplicarFiltros);
btnLimpiarFiltros.addEventListener('click', () => {
    filtrosForm.reset();
    filtroNombre.value = '';
    aplicarFiltros();
});

// Listener para la tabla (delegación de eventos)
listaUsuarios.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.edit-btn');
    if (editButton) {
        const id = editButton.dataset.id;
        const userToEdit = allUsersWithClients.find(u => u.id === id);
        if (!userToEdit) return alert('No se pudo encontrar el usuario para editar.');
        
        usuarioIdField.value = userToEdit.id;
        document.getElementById('nombre').value = userToEdit.nombre;
        document.getElementById('apellido').value = userToEdit.apellido;
        document.getElementById('email').value = userToEdit.email;
        roleSelect.value = userToEdit.role;
        passwordInput.placeholder = "Dejar en blanco para no cambiar";
        passwordHelper.classList.add('hidden');
        
        document.querySelectorAll('[name="cliente"]').forEach(cb => cb.checked = false);
        if (userToEdit.role === 'operario') {
            clienteCheckboxContainer.classList.remove('hidden');
            userToEdit.cliente_ids.forEach(clientId => {
                const checkbox = document.querySelector(`input[name="cliente"][value="${clientId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        } else {
            clienteCheckboxContainer.classList.add('hidden');
        }

        formTitle.textContent = 'Editar Usuario';
        btnCancel.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
    }

    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
            const { error } = await supabase.from('usuarios').delete().eq('id', id);
            if (error) { alert(`Error al eliminar: ${error.message}`); } 
            else {
                await cargarYRenderizarUsuarios();
                aplicarFiltros();
            }
        }
    }
});