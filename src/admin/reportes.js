import { renderHeader } from '../common/header.js';
import { renderFooter } from '../common/footer.js';
import { requireRole } from '../common/router.js';

requireRole('admin');
document.getElementById('header').innerHTML = renderHeader();
document.getElementById('footer').innerHTML = renderFooter();

document.getElementById('btnExportarPDF').addEventListener('click', () => {
  alert('Funcionalidad de exportar a PDF no implementada en esta versión.');
});

document.getElementById('btnExportarExcel').addEventListener('click', () => {
  alert('Funcionalidad de exportar a Excel no implementada en esta versión.');
});
