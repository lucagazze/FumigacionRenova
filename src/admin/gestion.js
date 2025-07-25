import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

// Elementos del DOM
const formCliente = document.getElementById('formCliente');
const nombreCliente = document.getElementById('nombreCliente');
const listaClientes = document.getElementById('listaClientes');

const formMercaderia = document.getElementById('formMercaderia');
const nombreMercaderia = document.getElementById('nombreMercaderia');
const listaMercaderias = document.getElementById('listaMercaderias');

const formArea = document.getElementById('formArea');
const nombreArea = document.getElementById('nombreArea');
const tipoArea = document.getElementById('tipoArea');
const listaAreas = document.getElementById('listaAreas');

const formUsuario = document.getElementById('formUsuario');
const listaUsuarios = document.getElementById('listaUsuarios');

// --- Funciones de Renderizado ---

async function renderClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nombre');
  if (error) return;
  listaClientes.innerHTML = data.map(c => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${c.nombre}</span>
      <button data-id="${c.id}" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function renderMercaderias() {
  const { data, error } = await supabase.from('mercaderias').select('*').order('nombre');
  if (error) return;
  listaMercaderias.innerHTML = data.map(m => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${m.nombre}</span>
      <button data-id="${m.id}" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function renderAreas() {
  const { data, error } = await supabase.from('areas').select('*').order('tipo').order('nombre');
  if (error) return;
  listaAreas.innerHTML = data.map(a => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${a.nombre} (${a.tipo})</span>
      <button data-id="${a.id}" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}

async function renderUsuarios() {
    const { data, error } = await supabase.from('usuarios').select('id, nombre, apellido, role').order('nombre');
    if (error) {
        console.error('Error al renderizar usuarios:', error);
        return;
    }
    listaUsuarios.innerHTML = data.map(u => `
    <div class="flex justify-between items-center p-2 rounded hover:bg-gray-100">
      <span>${u.nombre} ${u.apellido} (${u.role})</span>
      <button data-id="${u.id}" class="text-red-500 hover:text-red-700">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `).join('');
}


// --- Event Listeners ---

formCliente.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = nombreCliente.value.trim();
  if (!nombre) return;
  await supabase.from('clientes').insert([{ nombre }]);
  nombreCliente.value = '';
  renderClientes();
});

formMercaderia.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = nombreMercaderia.value.trim();
  if (!nombre) return;
  await supabase.from('mercaderias').insert([{ nombre }]);
  nombreMercaderia.value = '';
  renderMercaderias();
});

formArea.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = nombreArea.value.trim();
  const tipo = tipoArea.value;
  if (!nombre) return;
  await supabase.from('areas').insert([{ nombre, tipo }]);
  nombreArea.value = '';
  renderAreas();
});

formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreUsuario').value;
    const apellido = document.getElementById('apellidoUsuario').value;
    const email = document.getElementById('emailUsuario').value;
    const password = document.getElementById('passwordUsuario').value;
    const role = document.getElementById('rolUsuario').value;

    const { data, error } = await supabase.functions.invoke('crear-usuario', {
        body: { email, password, nombre, apellido, role },
    });

    if (error) {
        alert('Error al crear el usuario: ' + error.message);
    } else {
        alert('Usuario creado correctamente');
        formUsuario.reset();
        renderUsuarios();
    }
});


// Delegación de eventos para botones de borrado
document.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-id]');
  if (!button) return;

  const id = button.dataset.id;
  const listContainer = button.closest('div[id^="lista"]');
  
  if (confirm('¿Está seguro de que desea eliminar este elemento?')) {
    let tableName, renderFunction;
    if (listContainer.id === 'listaClientes') {
      tableName = 'clientes';
      renderFunction = renderClientes;
    } else if (listContainer.id === 'listaMercaderias') {
      tableName = 'mercaderias';
      renderFunction = renderMercaderias;
    } else if (listContainer.id === 'listaAreas') {
      tableName = 'areas';
      renderFunction = renderAreas;
    } else if (listContainer.id === 'listaUsuarios') {
        // Para borrar usuarios, debemos llamar a una función segura también
        const { error } = await supabase.functions.invoke('eliminar-usuario', {
            body: { id },
        });
        if (error) {
            alert('Error al eliminar usuario: ' + error.message);
        } else {
            alert('Usuario eliminado correctamente');
            renderUsuarios();
        }
        return; // Salimos para no ejecutar el borrado genérico
    }
    
    if (tableName) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if(error){
        alert("Error al eliminar: " + error.message);
      } else {
        renderFunction();
      }
    }
  }
});

// Carga inicial
renderClientes();
renderMercaderias();
renderAreas();
renderUsuarios();