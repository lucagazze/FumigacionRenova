import { renderHeader } from '../common/header.js';
import { requireRole } from '../common/router.js';
import { supabase } from '../common/supabase.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();

const btnVolver = document.getElementById('btnVolver');
const resumenContainer = document.getElementById('resumenOperacion');
const urlParams = new URLSearchParams(window.location.search);
const operacionId = urlParams.get('id'); // Este puede ser el ID de cualquier registro de la operación

async function cargarOperacion() {
  if (!operacionId) {
    resumenContainer.innerHTML = '<p class="text-red-500">ID de operación no encontrado.</p>';
    return;
  }

  // 1. Obtener el registro actual para encontrar el ID original
  const { data: registroActual, error: registroError } = await supabase
    .from('operaciones')
    .select('id, operacion_original_id')
    .eq('id', operacionId)
    .single();

  if (registroError) {
    resumenContainer.innerHTML = '<p class="text-red-500">Error al cargar la operación.</p>';
    console.error(registroError);
    return;
  }

  const originalId = registroActual.operacion_original_id || registroActual.id;

  // 2. Obtener todos los registros relacionados con la operación original
  const { data: todosLosRegistros, error: todosError } = await supabase
    .from('operaciones')
    .select('*, clientes(nombre), depositos(nombre, tipo), mercaderias(nombre), movimientos(*)')
    .or(`id.eq.${originalId},operacion_original_id.eq.${originalId}`)
    .order('created_at', { ascending: true });

  if (todosError) {
    resumenContainer.innerHTML = '<p class="text-red-500">Error al cargar el historial completo de la operación.</p>';
    console.error(todosError);
    return;
  }
  
  renderResumen(todosLosRegistros);
}

function renderResumen(registros) {
    if (!registros || registros.length === 0) {
        resumenContainer.innerHTML = '<p>No se encontraron datos para esta operación.</p>';
        return;
    }

    const opInicial = registros[0];
    let totalProducto = 0;
    let totalToneladas = 0;

    registros.forEach(r => {
        if (r.tipo_registro === 'producto' && typeof r.producto_usado_cantidad === 'number') {
            totalProducto += r.producto_usado_cantidad;
        }
        if ((r.tipo_registro === 'producto' || r.tipo_registro === 'movimiento') && typeof r.toneladas === 'number') {
            totalToneladas += r.toneladas;
        }
    });

    const unidadLabel = opInicial.metodo_fumigacion === 'liquido' ? 'cm³' : 'pastillas';

    let resumenHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-b pb-4 mb-4">
            <p><strong>Cliente:</strong> ${opInicial.clientes?.nombre || 'N/A'}</p>
            <p><strong>Depósito:</strong> ${opInicial.depositos?.nombre || 'N/A'} (${opInicial.depositos?.tipo || 'N/A'})</p>
            <p><strong>Mercadería:</strong> ${opInicial.mercaderias?.nombre || 'N/A'}</p>
            <p><strong>Método:</strong> ${opInicial.metodo_fumigacion?.charAt(0).toUpperCase() + opInicial.metodo_fumigacion?.slice(1) || 'N/A'}</p>
            <p><strong>Estado:</strong> <span class="font-bold ${opInicial.estado === 'finalizada' ? 'text-red-600' : 'text-green-600'}">${opInicial.estado}</span></p>
            <p><strong>Total Toneladas Movidas:</strong> ${totalToneladas.toLocaleString()} tn</p>
            <p><strong>Total Producto Aplicado:</strong> ${totalProducto.toLocaleString()} ${unidadLabel}</p>
        </div>
        <h3 class="text-xl font-bold mb-2">Historial de Registros</h3>
        <div class="space-y-3">
    `;

    registros.forEach(r => {
        let detalleRegistro = '';
        switch(r.tipo_registro) {
            case 'inicial': detalleRegistro = `Operación iniciada por <b>${r.operario_nombre}</b>.`; break;
            case 'producto': detalleRegistro = `<b>${r.operario_nombre}</b> aplicó <b>${r.producto_usado_cantidad?.toLocaleString()} ${unidadLabel}</b> en ${r.toneladas?.toLocaleString()} tn. (Tratamiento: ${r.tratamiento})`; break;
            case 'movimiento':
                const mov = r.movimientos && r.movimientos.length > 0 ? r.movimientos[0] : null;
                detalleRegistro = `<b>${r.operario_nombre}</b> registró un movimiento: ${mov?.observacion || ''} (${r.toneladas?.toLocaleString()} tn). ${mov?.media_url ? `<a href="${mov.media_url}" target="_blank" class="text-blue-600 hover:underline">Ver adjunto</a>` : ''}`;
                break;
            case 'finalizacion': detalleRegistro = `Operación finalizada por <b>${r.operario_nombre}</b>.`; break;
        }

        resumenHTML += `
            <div class="p-3 bg-gray-50 rounded-lg border">
                <p class="font-semibold">${new Date(r.created_at).toLocaleString('es-AR')}</p>
                <p class="text-gray-700">${detalleRegistro}</p>
            </div>
        `;
    });
    
    resumenHTML += `</div>`;
    resumenContainer.innerHTML = resumenHTML;
}

btnVolver.addEventListener('click', () => { window.history.back(); });

document.addEventListener('DOMContentLoaded', cargarOperacion);