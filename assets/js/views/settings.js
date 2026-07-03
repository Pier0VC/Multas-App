import { getSettings, updateSettings } from '../database.js';
import { pageHeader, loadingState } from '../components/layout.js';
import { showToast } from '../components/toast.js';
import { notifyDataChanged } from '../utils/appEvents.js';

export async function renderSettings(app) {
  app.innerHTML = loadingState('Cargando configuracion...');
  const settings = await getSettings();
  const rules = settings?.penaltyRules || [];

  app.innerHTML = `
    ${pageHeader('Configuracion')}
    <div class="row g-3">
      <div class="col-lg-7">
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Reglas de multas</h2>
            <form id="settingsForm">
              <div class="table-responsive">
                <table class="table table-sm align-middle">
                  <thead><tr><th>Minutos desde</th><th>Monto S/</th></tr></thead>
                  <tbody>
                    ${rules.map((rule, index) => `
                      <tr>
                        <td><input class="form-control form-control-sm" type="number" name="minutes-${index}" min="0" value="${rule.minutes}" required></td>
                        <td><input class="form-control form-control-sm" type="number" name="amount-${index}" min="0" value="${rule.amount}" required></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <button class="btn btn-primary" type="submit"><i class="bi bi-save me-1"></i>Guardar reglas</button>
            </form>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Firestore</h2>
            <div class="text-secondary">
              La aplicacion usa un unico documento <code>settings/rules</code> para reglas de multas.
              Las multas no se almacenan; se calculan desde las marcaciones y reglas vigentes.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  app.querySelector('#settingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const penaltyRules = rules.map((_, index) => ({
      minutes: Number(form.get(`minutes-${index}`)),
      amount: Number(form.get(`amount-${index}`))
    }));
    await updateSettings({ penaltyRules });
    notifyDataChanged({ source: 'settings' });
    showToast('Configuracion actualizada y dashboard recalculado');
    await renderSettings(app);
  });
}
