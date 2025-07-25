import { supabase } from './supabase.js';

/**
 * Inicia sesión de un usuario usando el sistema de autenticación de Supabase.
 * @param {string} email - El email del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Promise<object>} - El objeto de sesión del usuario.
 */
export async function login(email, password) {
  // 1. Intenta iniciar sesión en el sistema de Auth de Supabase
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (loginError) {
    throw new Error(loginError.message);
  }
  
  if (!loginData.user) {
    throw new Error("No se encontró el usuario. Revisa tus credenciales.");
  }

  // 2. Una vez autenticado, busca el rol del usuario en tu tabla 'usuarios'
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('role')
    .eq('id', loginData.user.id)
    .single();
  
  if (userError) {
    // Si hay un error, cerramos la sesión para evitar inconsistencias
    await supabase.auth.signOut();
    throw new Error('No se pudo encontrar el perfil del usuario en la base de datos.');
  }

  // 3. Guardamos la información esencial en el almacenamiento local
  const userToStore = {
    email: loginData.user.email,
    id: loginData.user.id,
    role: userData.role, // ¡Guardamos el rol!
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
  window.location.href = '/src/login/login.html';
}