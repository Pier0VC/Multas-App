import { renderDashboard } from './views/dashboard.js';
import { renderEmployees } from './views/employees.js';
import { renderImports } from './views/imports.js';
import { renderReports } from './views/reports.js';
import { renderSettings } from './views/settings.js';
import { DATA_CHANGED_EVENT } from './utils/appEvents.js';

const routes = {
  dashboard: renderDashboard,
  employees: renderEmployees,
  imports: renderImports,
  reports: renderReports,
  settings: renderSettings
};

function getRoute() {
  return window.location.hash.replace('#/', '') || 'dashboard';
}

function getCurrentRoute() {
  return routes[getRoute()] ? getRoute() : 'dashboard';
}

function setActiveLink(route) {
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    link.classList.toggle('active', link.dataset.routeLink === route);
  });
}

export async function renderRoute() {
  const app = document.getElementById('app');
  const route = getCurrentRoute();
  setActiveLink(route);
  try {
    await routes[route](app);
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <div class="container py-4">
        <div class="alert alert-danger">
          <h1 class="h5">No se pudo cargar la vista</h1>
          <p class="mb-0">Firestore rechazo la operacion o la conexion fallo. Revisa las reglas y vuelve a intentar.</p>
        </div>
      </div>
    `;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener(DATA_CHANGED_EVENT, () => {
    if (getCurrentRoute() === 'dashboard') {
      renderRoute();
    }
  });
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
    return;
  }
  renderRoute();
}
