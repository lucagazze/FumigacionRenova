import { renderHeader } from '../common/header.js';
import { requireRole, getUser } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('operario');
document.getElementById('header').innerHTML = renderHeader();

// --- CONSTANTES Y SELECTORES ---
const DENSIDAD_LIQUIDO = 1.2;
const tituloPagina = document.getElementById('tituloPagina');
const unidadProducto = document.getElementById('unidadProducto');
const depositoFijoInfo = document.getElementById('depositoFijoInfo');
const modalidad = document.getElementById('modalidad');
const toneladasContainer = document.getElementById('toneladasContainer');
const toneladasInput = document.getElementById('toneladas');
const camionesContainer = document.getElementById('camionesContainer');
const camionesInput = document.getElementById('camiones');
const tratamiento = document.getElementById('tratamiento');
const resultadoProducto = document.getElementById('resultadoProducto');
const btnRegistrar = document.getElementById('btnRegistrar');
const resumenModalidad = document.getElementById('resumenModalidad');
const resumenToneladas = document.getElementById('resumenToneladas');
const resumenTratamiento = document.getElementById('resumenTratamiento');
const resumenDosis = document.getElementById('resumenDosis');
const resumenTotal = document.getElementById('resumenTotal');
const conCompaneroCheckbox = document.getElementById('conCompanero');
const companeroContainer = document.getElementById('companeroContainer');
const companeroList = document.getElementById('companero-list');
const selectedCompanerosEl = document.getElementById('selected-companeros');
const supervisorSelect = document.getElementById('supervisor');

let operacionActual = {};
let cantidadProductoCalculada = 0;

// --- LÓGICA DE LA PÁGINA ---

async function poblarCompaneros(clienteId) {
    companeroList.innerHTML = '';
    if (!clienteId) return;
    const currentUser = getUser();

    const { data: operariosRel, error: relError } = await supabase
        .from('operario_clientes')
        .select('operario_id')
        .eq('cliente_id', clienteId);

    if (relError || !operariosRel) return;
    
    const operarioIds = operariosRel.map(r => r.operario_id);
    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido')
        .in('id', operarioIds)
        .eq('role', 'operario');
        
    if (error) return;

    data.forEach(c => {
        if (c.id !== currentUser.id) {
            companeroList.innerHTML += `
                <label class="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50">
                    <input type="checkbox" name="companero" value="${c.nombre} ${c.apellido}" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                    <span>${c.nombre} ${c.apellido}</span>
                </label>
            `;
        }
    });
}

async function poblarSupervisores(clienteId) {
    supervisorSelect.innerHTML = '<option value="">Cargando...</option>';
    if (!clienteId) {
        supervisorSelect.innerHTML = '<option value="">Error: Cliente no definido</option>';
        return;
    }

    const { data: supervisoresRel, error: relError } = await supabase
        .from('operario_clientes')
        .select('operario_id')
        .eq('cliente_id', clienteId);

    if (relError || !supervisoresRel) {
        supervisorSelect.innerHTML = '<option value="">Error al cargar</option>';
        return;
    }

    const supervisorIds = supervisoresRel.map(r => r.operario_id);
    const { data: supervisores, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido')
        .in('id', supervisorIds)
        .eq('role', 'supervisor');

    if (error) {
        supervisorSelect.innerHTML = '<option value="">Error al cargar</option>';
        return;
    }

    supervisorSelect.innerHTML = '<option value="">-- Seleccionar Supervisor --</option>';
    if (supervisores.length === 0) {
        supervisorSelect.innerHTML = '<option value="">No hay supervisores para este cliente</option>';
    } else {
        supervisores.forEach(s => {
            supervisorSelect.innerHTML += `<option value="${s.id}">${s.nombre} ${s.apellido}</option>`;
        });
    }
}

async function setupPage() {
    const opId = localStorage.getItem('operacion_actual');
    if (!opId) { window.location.href = 'home.html'; return; }

    const { data, error } = await supabase.from('operaciones').select('*, clientes(id, nombre)').eq('id', opId).single();
    if (error) { console.error(error); window.location.href = 'home.html'; return; }
    
    operacionActual = data;
    const metodo = operacionActual.metodo_fumigacion;
    const depositoOrigen = operacionActual.deposito_origen_stock || 'Fagaz';

    if (metodo === 'pastillas') {
        tituloPagina.textContent = 'Registrar Pastillas Usadas';
        unidadProducto.textContent = 'pastillas';
    } else if (metodo === 'liquido') {
        tituloPagina.textContent = 'Registrar Líquido Usado';
        unidadProducto.textContent = 'cm³';
    }
    
    depositoFijoInfo.querySelector('b').textContent = depositoOrigen;
    depositoFijoInfo.style.display = 'block';
    
    await poblarCompaneros(operacionActual.cliente_id);
    await poblarSupervisores(operacionActual.cliente_id); 
    
    updateCalculations();
}

function updateCalculations() {
    let toneladas = 0;
    if (modalidad.value === 'trasilado') {
        toneladas = Number(toneladasInput.value) || 0;
    } else if (modalidad.value === 'descarga') {
        toneladas = (Number(camionesInput.value) || 0) * 28;
    }

    let cantidad = 0;
    let dosis = '-';
    let unidadLabel = '-';
    const metodo = operacionActual.metodo_fumigacion;

    if (metodo === 'pastillas') {
        unidadLabel = 'pastillas';
        if (tratamiento.value === 'preventivo') { dosis = '2 pastillas/tn'; cantidad = toneladas * 2; }
        else if (tratamiento.value === 'curativo') { dosis = '3 pastillas/tn'; cantidad = toneladas * 3; }
        cantidadProductoCalculada = Math.round(cantidad);
    } else if (metodo === 'liquido') {
        unidadLabel = 'cm³';
        if (tratamiento.value === 'preventivo') { dosis = '12 cm³/tn'; cantidad = toneladas * 12; }
        else if (tratamiento.value === 'curativo') { dosis = '20 cm³/tn'; cantidad = toneladas * 20; }
        cantidadProductoCalculada = cantidad;
    }
    
    resultadoProducto.textContent = cantidadProductoCalculada > 0 ? cantidadProductoCalculada.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '-';
    resumenModalidad.textContent = modalidad.options[modalidad.selectedIndex]?.text || '-';
    resumenToneladas.textContent = `${toneladas.toLocaleString()} tn`;
    resumenTratamiento.textContent = tratamiento.options[tratamiento.selectedIndex]?.text || '-';
    resumenDosis.textContent = dosis;
    resumenTotal.textContent = `${resultadoProducto.textContent} ${unidadLabel}`;
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', setupPage);

modalidad.addEventListener('change', () => {
    toneladasContainer.classList.toggle('hidden', modalidad.value !== 'trasilado');
    camionesContainer.classList.toggle('hidden', modalidad.value !== 'descarga');
    updateCalculations();
});

[toneladasInput, camionesInput, tratamiento].forEach(el => el.addEventListener('input', updateCalculations));

conCompaneroCheckbox.addEventListener('change', () => {
    companeroContainer.classList.toggle('hidden', !conCompaneroCheckbox.checked);
});

companeroList.addEventListener('change', () => {
    const selected = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);
    selectedCompanerosEl.textContent = selected.length > 0 ? selected.join(', ') : 'Ninguno';
});

btnRegistrar.addEventListener('click', async () => {
    btnRegistrar.disabled = true;
    const currentUser = getUser();
    if (!currentUser) {
        alert("Error de autenticación.");
        btnRegistrar.disabled = false;
        return;
    }
    
    const supervisorId = supervisorSelect.value;
    if (!supervisorId) {
        alert('Debe seleccionar un supervisor a cargo.');
        btnRegistrar.disabled = false;
        return;
    }

    const toneladas = (modalidad.value === 'trasilado') 
        ? Number(toneladasInput.value) 
        : (Number(camionesInput.value) || 0) * 28;

    if (!modalidad.value || !tratamiento.value || cantidadProductoCalculada <= 0) {
        alert('Complete todos los campos y asegúrese de que la cantidad sea válida.');
        btnRegistrar.disabled = false;
        return;
    }

    try {
        const depositoOrigen = operacionActual.deposito_origen_stock || "Fagaz";
        const tipoProducto = operacionActual.metodo_fumigacion;

        const { data: stock, error: fetchError } = await supabase
            .from('stock')
            .select('*')
            .eq('deposito', depositoOrigen)
            .eq('tipo_producto', tipoProducto)
            .single();

        if (fetchError) throw new Error(`No se pudo encontrar stock para ${tipoProducto} en ${depositoOrigen}.`);

        let nuevo_kg = parseFloat(stock.cantidad_kg);
        let nuevas_unidades = stock.cantidad_unidades ? parseInt(stock.cantidad_unidades) : 0;
        let cantidad_kg_movido = 0;
        let cantidad_unidades_movidas = null;
        
        if (tipoProducto === 'pastillas') {
            cantidad_unidades_movidas = cantidadProductoCalculada;
            cantidad_kg_movido = (cantidad_unidades_movidas * 3) / 1000;
            if (nuevas_unidades < cantidad_unidades_movidas) throw new Error("Stock insuficiente de pastillas.");
            nuevas_unidades -= cantidad_unidades_movidas;
            nuevo_kg -= cantidad_kg_movido;
        } else {
            cantidad_kg_movido = (cantidadProductoCalculada * DENSIDAD_LIQUIDO) / 1000;
            if (nuevo_kg < cantidad_kg_movido) throw new Error("Stock insuficiente de líquido.");
            nuevo_kg -= cantidad_kg_movido;
        }

        const { error: updateError } = await supabase.from('stock').update({
            cantidad_kg: nuevo_kg,
            cantidad_unidades: nuevas_unidades
        }).eq('id', stock.id);
        if (updateError) throw updateError;
        
        const companerosSeleccionados = Array.from(document.querySelectorAll('[name="companero"]:checked')).map(cb => cb.value);
        let operario_nombre = `${currentUser.nombre} ${currentUser.apellido}`;
        if (conCompaneroCheckbox.checked && companerosSeleccionados.length > 0) {
            operario_nombre += ` y ${companerosSeleccionados.join(', ')}`;
        }

        const { data: newOpData, error: insertOpError } = await supabase.from('operaciones').insert({
            operacion_original_id: operacionActual.id,
            cliente_id: operacionActual.cliente_id,
            deposito_id: operacionActual.deposito_id,
            mercaderia_id: operacionActual.mercaderia_id,
            estado: 'en curso',
            deposito_origen_stock: depositoOrigen,
            metodo_fumigacion: tipoProducto,
            producto_usado_cantidad: cantidadProductoCalculada,
            tipo_registro: 'producto',
            operario_nombre: operario_nombre,
            tratamiento: tratamiento.value,
            modalidad: modalidad.value,
            toneladas: toneladas,
            estado_aprobacion: 'pendiente', // CORREGIDO: Siempre pendiente
            supervisor_id: supervisorId 
        }).select('id').single();
        if (insertOpError) throw insertOpError;

        await supabase.from('historial_stock').insert({
            tipo_movimiento: 'uso',
            deposito: depositoOrigen,
            tipo_producto: tipoProducto,
            cantidad_kg_movido: cantidad_kg_movido,
            cantidad_unidades_movidas: cantidad_unidades_movidas,
            descripcion: `Uso en operación por ${operario_nombre}`,
            operacion_id: newOpData.id
        });

        alert(`Registro de aplicación guardado y stock descontado correctamente.`);
        window.location.href = 'operacion.html';

    } catch (error) {
        alert('ERROR: ' + error.message);
        console.error("Error al registrar aplicación:", error);
    } finally {
        btnRegistrar.disabled = false;
    }
});