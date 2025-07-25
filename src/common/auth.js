// src/common/auth.js
import { supabase } from './supabase.js';
import { goTo } from './router.js';

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Store user session in localStorage if needed for client-side checks
  // Supabase usually manages sessions automatically with its client,
  // but if you have custom roles or profile data in 'public.usuarios', you'll fetch it here.
  const { data: userProfile, error: profileError } = await supabase
    .from('usuarios') // Your custom 'usuarios' table
    .select('id, email, role, nombre') // Select relevant fields
    .eq('email', email)
    .single();

  if (profileError) {
    console.error("Error fetching user profile:", profileError);
    // Even if profile fetch fails, if signInWithPassword succeeded, the user is authenticated.
    // You might want to handle this case based on your application's needs.
    // For now, we'll proceed with basic user info from auth if profile not found.
    localStorage.setItem('user', JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      role: 'unknown', // Default or handle
      name: data.user.email, // Default or handle
    }));
  } else {
    localStorage.setItem('user', JSON.stringify(userProfile));
  }
  
  return userProfile || { id: data.user.id, email: data.user.email, role: 'unknown', name: data.user.email };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error logging out:", error);
    alert("Error al cerrar sesión.");
  } else {
    localStorage.removeItem('user');
    goTo('../login/login.html');
  }
}

// Function to get the current authenticated user's session
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Optionally, fetch detailed profile from your 'usuarios' table
    const { data: userProfile, error } = await supabase
      .from('usuarios')
      .select('id, email, role, nombre')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error("Error fetching current user profile:", error);
      return { id: user.id, email: user.email, role: 'unknown', name: user.email };
    }
    return userProfile;
  }
  return null;
}