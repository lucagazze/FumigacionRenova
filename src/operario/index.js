import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    // --- Selectores del DOM ---
    const form = document.getElementById('formNuevaOperacion'); // ID CORREGIDO
    const clienteSelect = document.getElementById('cliente');
    const depositoSelect = document.getElementById('deposito');
    const mercaderiaSelect = document.getElementById('mercaderia');

    // --- Funciones de Carga de Datos ---
    async function poblarClientes() {
        const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
        if (error) { console.error(error); return; }
        data.forEach(c => clienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);
    }

    async function poblarMercaderias() {
        const { data, error } = await supabase.from('mercaderias').select('id, nombre').order('nombre');
        if (error) { console.error(error); return; }
        mercaderiaSelect.innerHTML = '<option value="">Seleccionar Mercadería...</option>';
        data.forEach(m => mercaderiaSelect.innerHTML += `<option value="${m.id}">${m.nombre}</option>`);
    }

    async function poblarDepositos(clienteId) {
        depositoSelect.innerHTML = '<option value="">Cargando depósitos...</option>';
        depositoSelect.disabled = true;
        
        if (!clienteId) {
            depositoSelect.innerHTML = '<option value="">Seleccione un cliente primero...</option>';
            return;
        }

        const { data, error } = await supabase.from('depositos').select('id, nombre, tipo').eq('cliente_id', clienteId).order('nombre');
        if (error) { console.error(error); return; }

        depositoSelect.innerHTML = '<option value="">Seleccionar Depósito...</option>';
        if (data.length === 0) {
            depositoSelect.innerHTML = '<option value="">No hay depósitos para este cliente</option>';
        } else {
            data.forEach(d => depositoSelect.innerHTML += `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`);
        }
        depositoSelect.disabled = false;
    }

    // --- Event Listeners ---
    clienteSelect.addEventListener('change', () => {
        poblarDepositos(clienteSelect.value);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
      
        const user = getUser();
        const cliente_id = clienteSelect.value;
        const deposito_id = depositoSelect.value;
        const mercaderia_id = mercaderiaSelect.value;
        const metodo_fumigacion = document.getElementById('metodo_fumigacion').value;

        if (!user || !cliente_id || !deposito_id || !mercaderia_id || !metodo_fumigacion) {
            alert('Por favor, complete todos los campos.');
            return;
        }
      
        const { data: opData, error: opError } = await supabase
            .from('operaciones')
            .insert([{
                cliente_id,
                deposito_id,
                mercaderia_id,
                metodo_fumigacion,
                operario_nombre: `${user.nombre} ${user.apellido}`,
                estado: 'en curso',
                tipo_registro: 'inicial',
            }])
            .select()
            .single();

        if (opError) {
            console.error('Error creating operation:', opError);
            alert('Error al crear la operación. Es posible que ya exista una operación activa para este depósito.');
            return;
        }

        const checklistItems = ['Tapar ventiladores', 'Sanitizar', 'Verificar presencia de IV', 'Colocar cartelería'];
        const checklistToInsert = checklistItems.map(item => ({ operacion_id: opData.id, item: item }));
        await supabase.from('checklist_items').insert(checklistToInsert);

        localStorage.setItem('operacion_actual', opData.id);
        window.location.href = 'operacion.html';
    });

    // --- Carga Inicial ---
    poblarClientes();
    poblarMercaderias();
});