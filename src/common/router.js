// /src/common/router.js
export function goTo(url) {
  window.location.href = url;
}

export function requireRole(role) {
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user || user.role !== role) {
    window.location.href = '/src/login/login.html';
  }
}

export function getUser() {
  return JSON.parse(sessionStorage.getItem('user'));
}
