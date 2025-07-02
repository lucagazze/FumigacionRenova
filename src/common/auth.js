// Módulo de autenticación (stub)

const dummyUsers = [
  { email: 'admin@fagaz.com', password: 'admin', role: 'admin', name: 'Administrador' },
  { email: 'juan.perez@fagaz.com', password: 'password', role: 'operario', name: 'Juan Perez' },
  { email: 'luis.gonzalez@fagaz.com', password: 'password', role: 'operario', name: 'Luis Gonzalez' },
  { email: 'carlos.sanchez@fagaz.com', password: 'password', role: 'operario', name: 'Carlos Sanchez' },
  { email: 'miguel.rodriguez@fagaz.com', password: 'password', role: 'operario', name: 'Miguel Rodriguez' },
  { email: 'pedro.martinez@fagaz.com', password: 'password', role: 'operario', name: 'Pedro Martinez' },
  { email: 'jorge.gomez@fagaz.com', password: 'password', role: 'operario', name: 'Jorge Gomez' },
  { email: 'fernando.diaz@fagaz.com', password: 'password', role: 'operario', name: 'Fernando Diaz' },
  { email: 'roberto.fernandez@fagaz.com', password: 'password', role: 'operario', name: 'Roberto Fernandez' }
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
  window.location.href = '/src/login/login.html'; // CORRECCIÓN AQUÍ
}