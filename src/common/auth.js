import { supabase } from './supabase.js';

export async function login(email, password) {
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  
  if (error || !user) {
    throw new Error('Credenciales incorrectas');
  }

  if (user.role === 'operario' || user.role === 'supervisor') {
    const { data: cliente_ids, error: clienteError } = await supabase
      .from('operario_clientes')
      .select('cliente_id')
      .eq('operario_id', user.id);

    if (clienteError) {
      console.error("Error fetching user's clients", clienteError);
      user.cliente_ids = [];
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
