// Router simple para navegación SPA-like y control de acceso
export function goTo(url) {
  window.location.href = url;
}

export function requireRole(role) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== role) {
    window.location.href = '../login/login.html';
  }
}

export function getUser() {
  return JSON.parse(localStorage.getItem('user'));
}
