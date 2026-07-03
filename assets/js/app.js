import { initializeDatabase } from './database.js';
import { startRouter } from './router.js';
import { showToast } from './components/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeDatabase();
    startRouter();
  } catch (error) {
    console.error(error);
    document.getElementById('app').innerHTML = `
      <div class="container py-4">
        <div class="alert alert-danger">
          <h1 class="h5">No se pudo inicializar Firebase</h1>
          <p>La configuracion de Firebase ya esta cargada, pero Firestore rechazo la operacion.</p>
          <p class="mb-0">Publica reglas para las colecciones de la app. Deje una base lista en <code>firestore.rules</code>.</p>
        </div>
      </div>
    `;
    showToast('Error al inicializar Firebase', 'danger');
  }
});
