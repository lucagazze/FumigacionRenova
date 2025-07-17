import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- Elementos del DOM ---
const modalidadSelect = document.getElementById('modalidad');
const toneladasContainer = document.getElementById('toneladasContainer');
const toneladasInput = document.getElementById('toneladas');
const camionesContainer = document.getElementById('camionesContainer');
const camionesInput = document.getElementById('camiones');
const tratamientoSelect = document.getElementById('tratamiento');
const pastillasInput = document.getElementById('cantidadPastillas');
const depositoSelect = document.getElementById('deposito');
const supervisorSelect = document.getElementById('supervisor');
const companerosSelect = document.getElementById('companeros');
const btnRegistrar = document.getElementById('btnRegistrar');

let operacionActual = {};

// --- Funciones de Carga de Datos ---

async function getOperacionActual() {
  const id = localStorage.getItem('operacion_actual');
  if (!id) {
    alert("No se encontró una operación activa.");
    window.location.href = 'home.html';
    return null;
  }
  const { data, error } = await supabase.from('operaciones').select('*, clientes(id, nombre)').eq('id', id).single();
  if (error) {
    console.error('Error fetching operacion:', error);
    return null;
  }
  return data;
}

async function poblarDepositosStock() {
    const { data, error } = await supabase.from('stock').select('deposito');
    if (error) {
        console.error("Error al cargar depósitos de stock:", error);
        return;
    }
    depositoSelect.innerHTML = '<option value="">Seleccionar Depósito</option>';
    data.forEach(d => {
        depositoSelect.innerHTML += `<option value="${d.deposito}">${d.deposito}</option>`;
    });
}

async function poblarUsuarios(clienteId) {
    if (!clienteId) return;

    // Poblar Supervisores
    const { data: supervisores, error: supError } = await supabase
        .from('supervisor_clientes')
        .select('usuarios(id, nombre, apellido)')
        .eq('cliente_id', clienteId);

    if (supError) {
        console.error('Error fetching supervisores:', supError);
        supervisorSelect.innerHTML = '<option value="">Error al cargar</option>';
    } else {
        supervisorSelect.innerHTML = '<option value="">Seleccionar Supervisor</option>';
        supervisores.forEach(item => {
            const supervisor = item.usuarios;
            supervisorSelect.innerHTML += `<option value="${supervisor.id}">${supervisor.nombre} ${supervisor.apellido}</option>`;
        });
    }

    // Poblar Compañeros (Operarios)
    const currentUser = getUser();
    const { data: operarios, error: opError } = await supabase
        .from('operario_clientes')
        .select('usuarios(id, nombre, apellido)')
        .eq('cliente_id', clienteId)
        .neq('operario_id', currentUser.id); // Excluir al operario actual

    if (opError) {
        console.error('Error fetching operarios:', opError);
        companerosSelect.innerHTML = '<option value="">Error al cargar</option>';
    } else {
        companerosSelect.innerHTML = ''; // Limpiar para el modo 'multiple'
        operarios.forEach(item => {
            const operario = item.usuarios;
            companerosSelect.innerHTML += `<option value="${operario.id}">${operario.nombre} ${operario.apellido}</option>`;
        });
    }
}


// --- Lógica de la Interfaz ---

modalidadSelect.addEventListener('change', () => {
  if (modalidadSelect.value === 'trasilado') {
    toneladasContainer.classList.remove('hidden');
    camionesContainer.classList.add('hidden');
  } else if (modalidadSelect.value === 'descarga') {
    camionesContainer.classList.remove('hidden');
    toneladasContainer.classList.add('hidden');
  } else {
    toneladasContainer.classList.add('hidden');
    camionesContainer.classList.add('hidden');
  }
});


// --- Lógica Principal ---

btnRegistrar.addEventListener('click', async (e) => {
  e.preventDefault();
  
  const pastillas = parseInt(pastillasInput.value, 10);
  const deposito = depositoSelect.value;
  const supervisorId = supervisorSelect.value;
  
  if (!deposito || !modalidadSelect.value || !tratamientoSelect.value || !supervisorId || isNaN(pastillas) || pastillas <= 0) {
    alert('Por favor, complete todos los campos y asegúrese de que la cantidad de pastillas sea válida.');
    return;
  }

  // 1. Verificar y descontar stock
  const { data: stockData, error: stockError } = await supabase
    .from('stock')
    .select('cantidad_unidades')
    .eq('deposito', deposito)
    .eq('tipo_producto', 'pastillas')
    .single();

  if (stockError || !stockData) {
    alert(`No se pudo obtener el stock de pastillas del depósito ${deposito}.`);
    return;
  }
  if (stockData.cantidad_unidades < pastillas) {
    alert(`No hay suficiente stock de pastillas en ${deposito}. Stock actual: ${stockData.cantidad_unidades}`);
    return;
  }
  
  const nuevaCantidad = stockData.cantidad_unidades - pastillas;
  const { error: updateStockError } = await supabase
    .from('stock')
    .update({ cantidad_unidades: nuevaCantidad })
    .eq('deposito', deposito)
    .eq('tipo_producto', 'pastillas');

  if (updateStockError) {
    alert('Error al actualizar el stock. No se ha guardado el registro.');
    return;
  }

  // 2. Insertar el nuevo registro de operación de tipo "producto"
  const currentUser = getUser();
  const toneladas = modalidadSelect.value === 'trasilado' ? toneladasInput.value : (camionesInput.value || 0) * 28;

  const nuevoRegistro = {
    cliente_id: operacionActual.cliente_id,
    deposito_id: operacionActual.deposito_id,
    mercaderia_id: operacionActual.mercaderia_id,
    estado: 'en curso', // Mantiene el estado de la operación general
    deposito_origen_stock: deposito,
    producto_usado_cantidad: pastillas,
    tipo_registro: 'producto',
    operario_nombre: `${currentUser.nombre} ${currentUser.apellido}`,
    tratamiento: tratamientoSelect.value,
    modalidad: modalidadSelect.value,
    toneladas: toneladas,
    operacion_original_id: operacionActual.id,
    supervisor_id: supervisorId,
    metodo_fumigacion: 'pastillas',
    // Si necesitas guardar los compañeros, deberás tener una tabla para ello
    // por ejemplo: operacion_companeros (operacion_id, usuario_id)
  };

  const { data: insertedOp, error: insertError } = await supabase
    .from('operaciones')
    .insert([nuevoRegistro])
    .select()
    .single();

  if (insertError) {
    alert('Error al guardar el registro de aplicación. Revirtiendo stock...');
    console.error("Error de inserción:", insertError);
    // Revertir el descuento de stock si la inserción falla
    await supabase.from('stock').update({ cantidad_unidades: stockData.cantidad_unidades }).eq('deposito', deposito).eq('tipo_producto', 'pastillas');
    return;
  }

  // 3. Registrar en el historial de stock
  await supabase.from('historial_stock').insert([{ 
      tipo_movimiento: 'uso', 
      deposito: deposito, 
      tipo_producto: 'pastillas',
      cantidad_unidades_movidas: pastillas,
      operacion_id: insertedOp.id,
      descripcion: `Uso para operación en cliente ${operacionActual.clientes.nombre}`
  }]);

  alert('Registro de aplicación guardado y stock descontado correctamente.');
  window.location.href = 'operacion.html';
});


// --- Carga Inicial ---

document.addEventListener('DOMContentLoaded', async () => {
  operacionActual = await getOperacionActual();
  if (operacionActual) {
      await poblarDepositosStock();
      await poblarUsuarios(operacionActual.cliente_id);
  }
});