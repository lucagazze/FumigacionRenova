// /src/common/auth.js
import { supabase } from './supabase.js';

export async function login(email, password) {
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('password', password) // ¡SOLO PARA FINES DEMOSTRATIVOS!
    .single();
  
  if (error || !user) {
    throw new Error('Credenciales incorrectas');
  }

  // Si el usuario es un operario, buscamos sus clientes asignados
  if (user.role === 'operario') {
    const { data: cliente_ids, error: clienteError } = await supabase
      .from('operario_clientes')
      .select('cliente_id')
      .eq('operario_id', user.id);

    if (clienteError) {
      console.error("Error fetching operator's clients", clienteError);
      user.cliente_ids = []; // Asignar un array vacío si hay un error
    } else {
      user.cliente_ids = cliente_ids.map(item => item.cliente_id);
    }
  }

  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem('user');
  window.location.href = '/src/login/login.html';
}