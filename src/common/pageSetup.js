/**
 * Añade elementos globales a la sección <head> de la página.
 */
export function setupPage() {
    // --- Favicon (Icono de la pestaña) ---
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.href = '/public/assets/img/logotipo.png';
    faviconLink.type = 'image/png';
  
    const shortcutIconLink = document.createElement('link');
    shortcutIconLink.rel = 'shortcut icon';
    shortcutIconLink.href = '/public/assets/img/logotipo.png';
    shortcutIconLink.type = 'image/png';
  
    document.head.appendChild(faviconLink);
    document.head.appendChild(shortcutIconLink);
  
    // Aquí podrías añadir más cosas en el futuro, como fuentes globales, etc.
  }