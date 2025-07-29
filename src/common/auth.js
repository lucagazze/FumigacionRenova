import { supabase } from './supabase.js';

export function getCurrentUser() {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error("Error al obtener el usuario de localStorage:", e);
    return null;
  }
}

export async function login(email, password) {
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (loginError) {
    throw new Error('Credenciales incorrectas o el usuario no existe.');
  }
  
  if (!loginData.user) {
    throw new Error("No se pudo verificar el usuario. Inténtalo de nuevo.");
  }

  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('role, nombre, apellido, cliente_ids: operario_clientes (cliente_id)')
    .eq('id', loginData.user.id)
    .single();
  
  if (userError) {
    await supabase.auth.signOut();
    throw new Error('El perfil del usuario no fue encontrado en la base de datos.');
  }

  const assignedClientIds = Array.isArray(userData.cliente_ids) 
    ? userData.cliente_ids.map(c => c.cliente_id) 
    : [];

  const userToStore = {
    email: loginData.user.email,
    id: loginData.user.id,
    nombre: userData.nombre,
    apellido: userData.apellido,
    role: userData.role,
    cliente_ids: assignedClientIds
  };
  localStorage.setItem('user', JSON.stringify(userToStore));
  
  return userToStore;
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}