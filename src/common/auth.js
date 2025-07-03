// /src/common/auth.js
const dummyUsers = [
  { email: 'admin@fagaz.com', password: 'admin', role: 'admin', name: 'Administrador' },
  { email: 'briancasco@fagaz.com', password: 'operario', role: 'operario', name: 'Brian Casco' },
  { email: 'gustavoalbornoz@fagaz.com', password: 'operario', role: 'operario', name: 'Gustavo Albornoz' },
  { email: 'sergioruhl@fagaz.com', password: 'operario', role: 'operario', name: 'Sergio Ruhl' },
  { email: 'josegauna@fagaz.com', password: 'operario', role: 'operario', name: 'Jose Gauna' },
  { email: 'leandrobianchini@fagaz.com', password: 'operario', role: 'operario', name: 'Leandro Bianchini' },
  { email: 'darioaranda@fagaz.com', password: 'operario', role: 'operario', name: 'Dario Aranda' },
  { email: 'walterbustamante@fagaz.com', password: 'operario', role: 'operario', name: 'Walter Bustamante' },
];

export function login(email, password) {
  return new Promise((resolve, reject) => {
    const user = dummyUsers.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      resolve(user);
    } else {
      reject('Credenciales incorrectas');
    }
  });
}

export function logout() {
  localStorage.removeItem('user');
  window.location.href = '/src/login/login.html';
}