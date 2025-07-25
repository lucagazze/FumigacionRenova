// src/common/router.js
import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js'; // Import the new function

export function goTo(url) {
  window.location.href = url;
}

export async function requireRole(requiredRole) {
  const user = await getCurrentUser();
  if (!user || user.role !== requiredRole) {
    goTo('../login/login.html');
  }
}

export function getUser() {
  // This function now primarily reads from localStorage,
  // but for real-time validation, `getCurrentUser` should be preferred
  // especially on page load or critical actions.
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch (e) {
    console.error("Error parsing user from localStorage:", e);
    return null;
  }
}