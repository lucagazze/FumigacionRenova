// Header común para todas las páginas
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
    const inactiveClasses = "text-[var(--text-primary)] hover:text-[var(--primary-color)]";
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
    navLinks = `
        <a class="${getLinkClasses('home.html')}" href="home.html">Operaciones en curso</a>
        <a class="${getLinkClasses('index.html')}" href="index.html">Registrar Nueva Operación</a>
        <a class="${getLinkClasses('registro.html')}" href="registro.html">Registro de operaciones</a>
    `;
  }
  
  return `
    <header class="flex items-center justify-between border-b border-[var(--border-color)] px-6 md:px-10 py-4 bg-white shadow-sm relative">
      <div class="flex items-center gap-3">
        <a href="/src/login/login.html">
            <img src="/public/assets/img/logotipo.png" alt="Fagaz Logo" class="h-12">
        </a>
        <h1 class="text-xl font-bold">Gestión Fumigación</h1>
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
            <span class="block w-7 h-1 bg-[var(--primary-color)] rounded mb-1"></span>
            <span class="block w-7 h-1 bg-[var(--primary-color)] rounded mb-1"></span>
            <span class="block w-7 h-1 bg-[var(--primary-color)] rounded"></span>
        </button>
        <div id="mobileMenu" class="fixed inset-0 bg-black bg-opacity-40 z-50 flex md:hidden hidden">
          <div class="bg-white w-4/5 max-w-xs h-full shadow-xl p-8 flex flex-col gap-8 animate-slideInLeft justify-between">
            <div class="w-full flex flex-col">
              <button id="closeMobileMenu" class="self-end mb-6" aria-label="Cerrar menú">
                <span class="material-icons text-3xl text-[var(--primary-color)]">close</span>
              </button>
              <nav class="flex flex-col gap-6 text-xl font-semibold w-full">
                ${navLinks}
              </nav>
            </div>
            <button id="logoutMobile" class="btn-logout-mobile rounded-lg px-4 py-3 font-bold flex items-center justify-center text-lg w-full">
              <span class="material-icons mr-2">logout</span>
              Cerrar sesión
            </button>
          </div>
          <div class="flex-1" id="mobileMenuOverlay"></div>
        </div>
        <style>
            @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            .animate-slideInLeft { animation: slideInLeft 0.2s; }
            #mobileMenu nav a { padding: 0.75rem 0; border-radius: 0.5rem; transition: background 0.15s, color 0.15s; width: 100%; text-align: left; }
            #mobileMenu nav a.text-green-600 { color: #22c55e !important; font-weight: bold; }
            .btn-logout-mobile { background: #f8d7da; color: #b71c1c; border: none; transition: background 0.2s; }
            .btn-logout-mobile:hover { background: #f1b0b7; }
        </style>
      </div>
    </header>
  `;
}

document.addEventListener('click', (e) => {
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/src/login/login.html'; // CORRECCIÓN AQUÍ
  };

  if (e.target.matches('#btnLogout') || e.target.closest('#btnLogout')) handleLogout();
  if (e.target.matches('#logoutMobile') || e.target.closest('#logoutMobile')) handleLogout();

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

  if (hamburgerBtn && (hamburgerBtn.contains(e.target) || e.target === hamburgerBtn)) mobileMenu?.classList.remove('hidden');
  if (closeMobileMenu && (closeMobileMenu.contains(e.target) || e.target === closeMobileMenu)) mobileMenu?.classList.add('hidden');
  if (mobileMenuOverlay && (mobileMenuOverlay.contains(e.target) || e.target === mobileMenuOverlay)) mobileMenu?.classList.add('hidden');
});