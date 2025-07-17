import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header').innerHTML = renderHeader();
    
    const form = document.getElementById('formNuevaOperacion');
    const clienteSelect = document.getElementById('cliente');
    const depositoSelect = document.getElementById('deposito');
    const mercaderiaSelect = document.getElementById('mercaderia');
    const conCompaneroCheckbox = document.getElementById('conCompanero');
    const companeroContainer = document.getElementById('companeroContainer');
    const companeroList = document.getElementById('companero-list');
    const selectedCompanerosEl = document.getElementById('selected-companeros');
    const user = getUser();

    async function poblarCompaneros(clienteId) {
        companeroList.innerHTML = '';
        if (!clienteId) return;

        // 1. Encontrar todos los operarios para ese cliente
        const { data: operariosRel, error: relError } = await supabase
            .from('operario_clientes')
            .select('operario_id')
            .eq('cliente_id', clienteId);

        if (relError || !operariosRel || operariosRel.length === 0) {
            console.error(relError || "No operators for this client");
            return;
        }
        
        const operarioIds = operariosRel.map(r => r.operario_id);

        // 2. Obtener los datos de esos operarios
        const { data, error } = await supabase
            .from('usuarios')
            .select('id, nombre, apellido')
            .in('id', operarioIds)
            .eq('role', 'operario');
            
        if (error) { console.error(error); return; }

        data.forEach(c => {
            if (c.id !== user.id) {
                companeroList.innerHTML += `
                    <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                        <input type="checkbox" name="companero" value="${c.nombre} ${c.apellido}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                        <span>${c.nombre} ${c.apellido}</span>
                    </label>
                `;
            }
        });
    }

    async function poblarClientesAsignados() {
        if (!user.cliente_ids || user.cliente_ids.length === 0) {
            clienteSelect.innerHTML = '<option value="">No tiene clientes asignados</option>';
            clienteSelect.disabled = true;
            return;
        }
        const { data, error } = await supabase.from('clientes').select('id, nombre').in('id', user.cliente_ids).order('nombre');
        if (error) { console.error(error); return; }
        
        clienteSelect.innerHTML = '<option value="">Seleccionar Cliente...</option>';
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

    clienteSelect.addEventListener('change', () => {
        const clienteId = clienteSelect.value;
        poblarDepositos(clienteId);
        poblarCompaneros(clienteId);
        conCompaneroCheckbox.checked = false;
        companeroContainer.classList.add('hidden');
    });

    conCompaneroCheckbox.addEventListener('change', () => {
        companeroContainer.classList.toggle('hidden', !conCompaneroCheckbox.checked);
    });

    companeroList.addEventListener('change', () => {
        const selected = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);
        selectedCompanerosEl.textContent = selected.length > 0 ? selected.join(', ') : 'Ninguno';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
      
        const cliente_id = clienteSelect.value;
        const deposito_id = depositoSelect.value;
        const mercaderia_id = mercaderiaSelect.value;
        const metodo_fumigacion = document.getElementById('metodo_fumigacion').value;
        const companeros = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);

        if (!user || !cliente_id || !deposito_id || !mercaderia_id || !metodo_fumigacion) {
            alert('Por favor, complete todos los campos.');
            return;
        }

        // --- Verificación de operación en curso ---
        const { data: existingOperations, error: existingError } = await supabase
            .from('operaciones')
            .select('id')
            .eq('deposito_id', deposito_id)
            .eq('estado', 'en curso')
            .eq('tipo_registro', 'inicial');

        if (existingError) {
            console.error('Error checking for existing operations:', existingError);
            alert('Error al verificar operaciones existentes.');
            return;
        }

        if (existingOperations && existingOperations.length > 0) {
            alert('Ya existe una operación en curso para este depósito. Por favor, finalice la operación actual antes de iniciar una nueva.');
            return;
        }
        
        let operario_nombre = `${user.nombre} ${user.apellido}`;
        if (conCompaneroCheckbox.checked && companeros.length > 0) {
            operario_nombre += ` y ${companeros.join(', ')}`;
        }
      
        const { data: opData, error: opError } = await supabase
            .from('operaciones')
            .insert([{
                cliente_id,
                deposito_id,
                mercaderia_id,
                metodo_fumigacion,
                operario_nombre,
                estado: 'en curso',
                tipo_registro: 'inicial',
            }])
            .select()
            .single();

        if (opError) {
            console.error('Error creating operation:', opError);
            alert('Error al crear la operación.');
            return;
        }

        const checklistItems = ['Tapar ventiladores', 'Sanitizar', 'Verificar presencia de IV', 'Colocar cartelería'];
        const checklistToInsert = checklistItems.map(item => ({ operacion_id: opData.id, item: item }));
        await supabase.from('checklist_items').insert(checklistToInsert);

        localStorage.setItem('operacion_actual', opData.id);
        window.location.href = 'operacion.html';
    });

    poblarClientesAsignados();
    poblarMercaderias();
});
