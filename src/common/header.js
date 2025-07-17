import { getUser } from './router.js';

export function renderHeader() {
  const user = getUser();
  const currentPage = window.location.pathname.split('/').pop();
  
  const getLinkClasses = (href) => {
    const base = "text-sm font-medium transition-colors px-3 py-2 rounded-md";
    const isActive = href.split('/').pop() === currentPage;
    return isActive 
      ? `${base} bg-green-100 text-green-700 font-semibold` 
      : `${base} text-gray-500 hover:bg-gray-100 hover:text-gray-900`;
  };
  
  let navLinks = '';
  if (user?.role === 'admin') {
    navLinks = `
        <a class="${getLinkClasses('dashboard.html')}" href="/src/admin/dashboard.html">Dashboard</a>
        <a class="${getLinkClasses('historial.html')}" href="/src/admin/historial.html">Historial</a>
        <a class="${getLinkClasses('stock.html')}" href="/src/admin/stock.html">Stock</a>
        <a class="${getLinkClasses('gestion.html')}" href="/src/admin/gestion.html">Gestión</a>
        <a class="${getLinkClasses('limpieza.html')}" href="/src/admin/limpieza.html">Limpieza</a>
        <a class="${getLinkClasses('muestreos.html')}" href="/src/admin/muestreos.html">Muestreos</a>
        <a class="${getLinkClasses('usuarios.html')}" href="/src/admin/usuarios.html">Usuarios</a>
        <a class="${getLinkClasses('reportes.html')}" href="/src/admin/reportes.html">Reportes</a>
    `;
  } else if (user?.role === 'supervisor') {
    navLinks = `
        <a class="${getLinkClasses('dashboard.html')}" href="/src/supervisor/dashboard.html">Pendientes</a>
        <a class="${getLinkClasses('historial.html')}" href="/src/supervisor/historial.html">Historial Gral.</a>
        <a class="${getLinkClasses('historial_limpieza.html')}" href="/src/supervisor/historial_limpieza.html">Historial Limpieza</a>
        <a class="${getLinkClasses('muestreos.html')}" href="/src/supervisor/muestreos.html">Muestreos</a>
        <a class="${getLinkClasses('reportes.html')}" href="/src/supervisor/reportes.html">Reportes</a>
    `;
  } else if (user?.role === 'operario') {
    navLinks = `
        <a class="${getLinkClasses('home.html')}" href="/src/operario/home.html">Operaciones en curso</a>
        <a class="${getLinkClasses('index.html')}" href="/src/operario/index.html">Registrar Nueva Operación</a>
        <a class="${getLinkClasses('registro.html')}" href="/src/operario/registro.html">Mis Registros</a>
    `;
  }
  
  return `
    <header class="flex items-center justify-between border-b bg-white px-4 sm:px-6 py-3 shadow-sm sticky top-0 z-50">
      <div class="flex items-center gap-4">
        <a href="/index.html">
            <img src="/public/assets/img/logotipo.png" alt="Fagaz Logo" class="h-10">
        </a>
        <h1 class="text-lg font-bold text-gray-800 hidden sm:block">Gestión Fumigación</h1>
      </div>
      <nav class="hidden md:flex items-center gap-2">${navLinks}</nav>
      <div class="flex items-center gap-4">
        <button id="btnLogout" class="text-sm font-medium text-gray-600 hover:text-red-600 flex items-center gap-2">
          <span class="hidden sm:inline">Cerrar Sesión</span>
          <span class="material-icons">logout</span>
        </button>
        <button id="hamburgerBtn" class="md:hidden"><span class="material-icons">menu</span></button>
      </div>
    </header>
    <div id="mobileMenu" class="hidden fixed inset-0 z-50">
        <div id="mobileMenuOverlay" class="absolute inset-0 bg-black bg-opacity-50"></div>
        <div class="relative bg-white w-72 h-full p-6 flex flex-col">
            <div class="flex justify-between items-center mb-8">
                <img src="/public/assets/img/logotipo.png" alt="Fagaz Logo" class="h-10">
                <button id="closeMobileMenu"><span class="material-icons">close</span></button>
            </div>
            <nav class="flex flex-col gap-3">${navLinks}</nav>
            <div class="mt-auto">
                <button id="logoutMobile" class="w-full text-left text-sm font-medium text-gray-600 hover:text-red-600 flex items-center gap-2 p-3 rounded-md hover:bg-gray-100">
                    <span class="material-icons">logout</span>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </div>
    </div>
  `;
}

document.addEventListener('click', (e) => {
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  };

  if (e.target.closest('#btnLogout') || e.target.closest('#logoutMobile')) {
      handleLogout();
  }

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

  if (hamburgerBtn?.contains(e.target)) mobileMenu?.classList.remove('hidden');
  if (closeMobileMenu?.contains(e.target)) mobileMenu?.classList.add('hidden');
  if (mobileMenuOverlay?.contains(e.target)) mobileMenu?.classList.add('hidden');
});
