import { getCurrentUser } from './auth.js';

/**
 * Redirige a otra página de la aplicación.
 * @param {string} url - La URL a la que se quiere navegar.
 */
export function goTo(url) {
  window.location.href = url;
}

/**
 * Protege una página para que solo sea accesible por un rol específico.
 * Si el usuario no tiene el rol correcto, lo redirige al login.
 * @param {string} requiredRole - El rol requerido ('admin', 'supervisor', 'operario').
 */
export function requireRole(requiredRole) {
  const user = getCurrentUser();
  
  // Si no hay usuario o el rol no coincide, lo enviamos al login.
  if (!user || user.role !== requiredRole) {
    // Redirige a la página de login en la raíz del proyecto.
    goTo('/index.html');
  }
}

/**
 * Devuelve el objeto del usuario guardado en localStorage.
 * Es un alias para getCurrentUser para mantener consistencia.
 */
export function getUser() {
  return getCurrentUser();
}