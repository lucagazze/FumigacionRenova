// /src/common/auth.js
import { supabase } from './supabase.js';

export async function login(email, password) {
  // En un entorno de producción, la contraseña NUNCA debe ser enviada y comparada en texto plano.
  // Esto es solo una simulación. Se debería usar un sistema de autenticación real como Supabase Auth.
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('password', password) // ¡SOLO PARA FINES DEMOSTRATIVOS!
    .single();
  
  if (error || !user) {
    throw new Error('Credenciales incorrectas');
  }

  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem('user');
  window.location.href = '/src/login/login.html';
}