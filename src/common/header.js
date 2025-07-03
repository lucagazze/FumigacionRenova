import { getUser } from './router.js';

export function renderHeader() {
  const user = getUser();
  
  function getCurrentPage() {
    const path = window.location.pathname;
    return path.split('/').pop();
  }
  
  function isActiveLink(href) {
    return href === getCurrentPage();
  }
  
  function getLinkClasses(href) {
    const baseClasses = "text-sm font-medium transition-colors";
    const activeClasses = "text-green-600 font-bold";
    const inactiveClasses = "text-gray-600 hover:text-green-600";
    return `${baseClasses} ${isActiveLink(href) ? activeClasses : inactiveClasses}`;
  }
  
  let navLinks = '';
  if (user?.role === 'admin') {
    navLinks = `
        <a class="${getLinkClasses('dashboard.html')}" href="dashboard.html">Dashboard</a>
        <a class="${getLinkClasses('stock.html')}" href="stock.html">Stock</a>
        <a class="${getLinkClasses('gestion.html')}" href="gestion.html">Gestión</a>
        <a class="${getLinkClasses('limpieza.html')}" href="limpieza.html">Limpieza</a>
    `;
  } else if (user?.role === 'operario') {
    // --- APARTADO CORREGIDO ---
    navLinks = `
        <a class="${getLinkClasses('home.html')}" href="home.html">Operaciones en curso</a>
        <a class="${getLinkClasses('index.html')}" href="index.html">Registrar Nueva Operación</a>
        <a class="${getLinkClasses('registro.html')}" href="registro.html">Registro de operaciones</a>
    `;
  }
  
  return `
    <header class="flex items-center justify-between border-b bg-white px-6 md:px-10 py-4 shadow-sm sticky top-0 z-40">
      <div class="flex items-center gap-3">
        <a href="/src/login/login.html">
            <img src="/public/assets/img/logotipo.png" alt="Fagaz Logo" class="h-12">
        </a>
        <h1 class="text-xl font-bold text-gray-800">Gestión Fumigación</h1>
      </div>
      <nav class="hidden md:flex items-center gap-6" id="mainNav">
        ${navLinks}
      </nav>
      <div class="flex items-center gap-4">
        <button id="btnLogout" class="hidden md:flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800">
          <span class="material-icons">logout</span>
          <span>Cerrar Sesión</span>
        </button>
        <button id="hamburgerBtn" class="md:hidden flex flex-col justify-center items-center w-10 h-10" aria-label="Abrir menú">
            <span class="block w-7 h-0.5 bg-gray-800 rounded mb-1.5"></span>
            <span class="block w-7 h-0.5 bg-gray-800 rounded mb-1.5"></span>
            <span class="block w-7 h-0.5 bg-gray-800 rounded"></span>
        </button>
        <div id="mobileMenu" class="fixed inset-0 bg-black bg-opacity-40 z-50 flex md:hidden hidden">
          <div class="bg-white w-4/5 max-w-xs h-full shadow-xl p-8 flex flex-col gap-8">
            <div class="w-full flex flex-col">
              <button id="closeMobileMenu" class="self-end mb-6" aria-label="Cerrar menú">
                <span class="material-icons text-3xl text-gray-700">close</span>
              </button>
              <nav class="flex flex-col gap-6 text-xl font-semibold w-full">
                ${navLinks}
              </nav>
            </div>
          </div>
          <div class="flex-1" id="mobileMenuOverlay"></div>
        </div>
      </div>
    </header>
  `;
}

document.addEventListener('click', (e) => {
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/src/login/login.html';
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