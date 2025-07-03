import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const form = document.getElementById('formUsuario');
const formTitle = document.getElementById('form-title');
const listaUsuarios = document.getElementById('listaUsuarios');
const btnCancel = document.getElementById('btnCancel');
const usuarioIdField = document.getElementById('usuarioId');
const passwordInput = document.getElementById('password');
const passwordHelper = document.getElementById('password-helper');

async function renderUsuarios() {
    const { data, error } = await supabase.from('usuarios').select('*').order('nombre');
    if (error) {
        console.error('Error cargando usuarios:', error);
        return;
    }
    listaUsuarios.innerHTML = data.map(u => `
        <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
            <div>
                <span class="font-bold">${u.nombre} ${u.apellido}</span>
                <span class="text-sm text-gray-600">(${u.role})</span><br>
                <span class="text-xs text-gray-500">Email: ${u.email}</span><br>
                <span class="text-xs text-gray-500 font-mono">Clave: ${u.password}</span>
            </div>
            <div class="flex gap-2">
                <button data-id="${u.id}" class="edit-btn text-blue-500 hover:text-blue-700 p-1"><span class="material-icons">edit</span></button>
                <button data-id="${u.id}" class="delete-btn text-red-500 hover:text-red-700 p-1"><span class="material-icons">delete</span></button>
            </div>
        </div>
    `).join('');
}

function resetForm() {
    form.reset();
    usuarioIdField.value = '';
    formTitle.textContent = 'Añadir Nuevo Usuario';
    btnCancel.classList.add('hidden');
    passwordInput.placeholder = "Nueva contraseña";
    passwordHelper.classList.remove('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = usuarioIdField.value;
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const email = document.getElementById('email').value;
    const password = passwordInput.value;
    const role = document.getElementById('role').value;

    const userData = { nombre, apellido, email, role };
    if (password) {
        userData.password = password;
    }

    let error;
    if (id) {
        ({ error } = await supabase.from('usuarios').update(userData).eq('id', id));
    } else {
        if (!password) {
            alert("La contraseña es obligatoria para nuevos usuarios.");
            return;
        }
        ({ error } = await supabase.from('usuarios').insert([userData]));
    }

    if (error) {
        alert(`Error al guardar el usuario: ${error.message}`);
    } else {
        resetForm();
        renderUsuarios();
    }
}

listaUsuarios.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.edit-btn');
    if (editButton) {
        const id = editButton.dataset.id;
        const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).single();
        if (error) {
            alert('No se pudo cargar el usuario para editar.');
            return;
        }
        usuarioIdField.value = data.id;
        document.getElementById('nombre').value = data.nombre;
        document.getElementById('apellido').value = data.apellido;
        document.getElementById('email').value = data.email;
        document.getElementById('role').value = data.role;
        passwordInput.placeholder = "Dejar en blanco para no cambiar";
        passwordHelper.classList.add('hidden');
        
        formTitle.textContent = 'Editar Usuario';
        btnCancel.classList.remove('hidden');
    }

    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
            const { error } = await supabase.from('usuarios').delete().eq('id', id);
            if (error) {
                alert(`Error al eliminar: ${error.message}`);
            } else {
                renderUsuarios();
            }
        }
    }
});

form.addEventListener('submit', handleFormSubmit);
btnCancel.addEventListener('click', resetForm);

document.addEventListener('DOMContentLoaded', () => {
    renderUsuarios();
    resetForm(); 
});