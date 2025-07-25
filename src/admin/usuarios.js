import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM (sin cambios) ---
const form = document.getElementById('formUsuario');
const formTitle = document.getElementById('form-title');
const btnCancel = document.getElementById('btnCancel');
const usuarioIdField = document.getElementById('usuarioId');
const passwordInput = document.getElementById('password');
const passwordHelper = document.getElementById('password-helper');
const roleSelect = document.getElementById('role');
const clienteCheckboxContainer = document.getElementById('cliente-checkbox-container');
const clienteListDiv = document.getElementById('cliente-list');
const listaUsuarios = document.getElementById('listaUsuarios');
const filtrosForm = document.getElementById('filtrosForm');
const filtroNombre = document.getElementById('filtroNombre');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

let allUsersWithClients = [];

// --- Funciones de renderizado y carga (sin cambios) ---
async function poblarSelectClientes() {
    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) { console.error('Error cargando clientes:', error); return; }
    
    clienteListDiv.innerHTML = data.map(c => `
        <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
            <input type="checkbox" name="cliente" value="${c.id}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
            <span>${c.nombre}</span>
        </label>
    `).join('');
    
    const filtroClienteSelect = document.getElementById('filtroCliente');
    filtroClienteSelect.innerHTML = '<option value="">Todos los Clientes</option>';
    data.forEach(c => {
        filtroClienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

function renderUsuarios(usersToRender) {
    if (usersToRender.length === 0) {
        listaUsuarios.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No se encontraron usuarios.</td></tr>`;
        return;
    }
    
    listaUsuarios.innerHTML = usersToRender.map(u => {
        let roleClass = '';
        if (u.role === 'admin') roleClass = 'bg-red-100 text-red-800';
        else if (u.role === 'supervisor') roleClass = 'bg-yellow-100 text-yellow-800';
        else roleClass = 'bg-green-100 text-green-800';

        const passwordDisplay = '••••••••';

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${u.nombre} ${u.apellido}</div>
                    <div class="text-sm text-gray-500">${u.email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${passwordDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleClass}">${u.role}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">
                    ${u.role !== 'admin' ? u.clientes.join(', ') || 'Ninguno' : 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-id="${u.id}" class="edit-btn text-blue-600 hover:text-blue-900 p-1" title="Editar"><span class="material-icons">edit</span></button>
                    <button data-id="${u.id}" class="delete-btn text-red-600 hover:text-red-900 p-1" title="Eliminar"><span class="material-icons">delete</span></button>
                </td>
            </tr>
        `;
    }).join('');
}

async function cargarYRenderizarUsuarios() {
    const { data: usuarios, error } = await supabase.from('usuarios').select('id, nombre, apellido, email, role').order('nombre');
    if (error) { console.error('Error cargando usuarios:', error); return; }
    
    const { data: relaciones, error: relError } = await supabase.from('operario_clientes').select('operario_id, clientes(id, nombre)');
    if(relError) { console.error('Error al cargar relaciones de clientes:', relError); return; }

    allUsersWithClients = usuarios.map(u => {
        const clientesAsignados = relaciones
            .filter(r => r.operario_id === u.id && r.clientes)
            .map(r => ({ id: r.clientes.id, nombre: r.clientes.nombre }));
        return { ...u, clientes: clientesAsignados.map(c => c.nombre), cliente_ids: clientesAsignados.map(c => c.id) };
    });
    
    aplicarFiltros();
}

function aplicarFiltros() {
    const nombreQuery = filtroNombre.value.toLowerCase();
    const rolQuery = document.getElementById('filtroRol').value;
    const clienteQuery = document.getElementById('filtroCliente').value;

    let filteredUsers = allUsersWithClients.filter(user => {
        const matchNombre = user.nombre.toLowerCase().includes(nombreQuery) || user.apellido.toLowerCase().includes(nombreQuery) || user.email.toLowerCase().includes(nombreQuery);
        const matchRol = !rolQuery || user.role === rolQuery;
        const matchCliente = !clienteQuery || (user.cliente_ids && user.cliente_ids.includes(clienteQuery));
        return matchNombre && matchRol && matchCliente;
    });
    renderUsuarios(filteredUsers);
}

function resetForm() {
    form.reset();
    usuarioIdField.value = '';
    formTitle.textContent = 'Añadir Nuevo Usuario';
    btnCancel.classList.add('hidden');
    passwordInput.placeholder = "Contraseña";
    passwordInput.required = true;
    passwordHelper.classList.remove('hidden');
    roleSelect.value = 'operario';
    clienteCheckboxContainer.classList.add('hidden');
    roleSelect.dispatchEvent(new Event('change'));
}

// --- Función handleFormSubmit CORREGIDA ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = usuarioIdField.value;
    
    const userData = {
        email: document.getElementById('email').value,
        nombre: document.getElementById('nombre').value,
        apellido: document.getElementById('apellido').value,
        role: roleSelect.value,
        password: passwordInput.value
    };
    
    let savedUser;

    if (id) {
        // --- ACTUALIZAR USUARIO (FORMA SEGURA) ---
        const { data, error } = await supabase.functions.invoke('actualizar-usuario', { body: { id, ...userData } });
        if (error) return alert(`Error al actualizar: ${error.message}`);
        savedUser = data.user;
    } else {
        // --- CREAR NUEVO USUARIO (FORMA SEGURA) ---
        if (!userData.password) return alert("La contraseña es obligatoria para nuevos usuarios.");
        const { data, error } = await supabase.functions.invoke('crear-usuario', { body: userData });
        if (error) return alert(`Error al crear usuario: ${error.message}`);
        savedUser = data.user;
    }

    // --- LÓGICA MEJORADA PARA ASIGNAR CLIENTES ---
    if (savedUser.user_metadata.role === 'operario' || savedUser.user_metadata.role === 'supervisor') {
        const userToEdit = allUsersWithClients.find(u => u.id === savedUser.id) || { cliente_ids: [] };
        const clientesActuales = new Set(userToEdit.cliente_ids);
        const clientesNuevos = new Set(Array.from(document.querySelectorAll('[name="cliente"]:checked')).map(cb => cb.value));

        const paraAnadir = [...clientesNuevos].filter(id => !clientesActuales.has(id));
        const paraQuitar = [...clientesActuales].filter(id => !clientesNuevos.has(id));

        if (paraQuitar.length > 0) {
            await supabase.from('operario_clientes').delete().eq('operario_id', savedUser.id).in('cliente_id', paraQuitar);
        }
        if (paraAnadir.length > 0) {
            const nuevasRelaciones = paraAnadir.map(cliente_id => ({ operario_id: savedUser.id, cliente_id }));
            await supabase.from('operario_clientes').insert(nuevasRelaciones);
        }
    }
    
    alert(`Usuario ${id ? 'actualizado' : 'creado'} con éxito.`);
    resetForm();
    await cargarYRenderizarUsuarios();
}

// --- Event Listeners (sin cambios importantes, solo el de borrado) ---
document.addEventListener('DOMContentLoaded', async () => {
    await poblarSelectClientes();
    await cargarYRenderizarUsuarios();
    
    const togglePassword = document.getElementById('togglePassword');
    togglePassword.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePassword.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
    });
    resetForm();
});

form.addEventListener('submit', handleFormSubmit);
btnCancel.addEventListener('click', resetForm);
roleSelect.addEventListener('change', () => {
    const showClientes = roleSelect.value === 'operario' || roleSelect.value === 'supervisor';
    clienteCheckboxContainer.classList.toggle('hidden', !showClientes);
});

filtroNombre.addEventListener('input', aplicarFiltros);
filtrosForm.addEventListener('change', aplicarFiltros);
btnLimpiarFiltros.addEventListener('click', () => {
    filtrosForm.reset();
    filtroNombre.value = '';
    aplicarFiltros();
});

listaUsuarios.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.edit-btn');
    if (editButton) {
        const id = editButton.dataset.id;
        const userToEdit = allUsersWithClients.find(u => u.id === id);
        if (!userToEdit) return alert('No se pudo encontrar el usuario.');
        
        usuarioIdField.value = userToEdit.id;
        document.getElementById('nombre').value = userToEdit.nombre;
        document.getElementById('apellido').value = userToEdit.apellido;
        document.getElementById('email').value = userToEdit.email;
        roleSelect.value = userToEdit.role;
        passwordInput.placeholder = "Dejar en blanco para no cambiar";
        passwordInput.required = false;
        passwordHelper.classList.add('hidden');
        
        document.querySelectorAll('[name="cliente"]').forEach(cb => cb.checked = false);
        const showClientes = userToEdit.role === 'operario' || userToEdit.role === 'supervisor';
        clienteCheckboxContainer.classList.toggle('hidden', !showClientes);
        if (showClientes && userToEdit.cliente_ids) {
            userToEdit.cliente_ids.forEach(clientId => {
                const checkbox = document.querySelector(`input[name="cliente"][value="${clientId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        formTitle.textContent = 'Editar Usuario';
        btnCancel.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth' });
    }

    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este usuario? Esta acción es irreversible.')) {
            const { error } = await supabase.functions.invoke('eliminar-usuario', { body: { id } });
            if (error) {
                alert(`Error al eliminar usuario: ${error.message}`);
            } else {
                alert('Usuario eliminado correctamente.');
                await cargarYRenderizarUsuarios();
            }
        }
    }
});