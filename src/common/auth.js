import { supabase } from './supabase.js';

/**
 * Inicia sesión de un usuario usando el sistema de autenticación de Supabase.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Promise<object>} - El objeto de sesión del usuario.
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Ahora, obtén el rol de tu tabla `usuarios`
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('role')
    .eq('id', data.user.id)
    .single();
  
  if (userError) {
    throw new Error('No se pudo obtener el rol del usuario.');
  }

  // Guardamos la información esencial en localStorage
  const userToStore = {
    email: data.user.email,
    id: data.user.id,
    role: userData.role,
  };
  localStorage.setItem('user', JSON.stringify(userToStore));
  
  return userToStore;
}

/**
 * Cierra la sesión del usuario.
 */
export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('user');
  window.location.href = '/src/login/login.html'; // Redirige al login
}