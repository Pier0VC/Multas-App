import { getDashboardData, savePayment } from '../database.js';
import { pageHeader, loadingState, metricCard } from '../components/layout.js';
import { getCurrentPeriod } from '../utils/dates.js';
import { showToast } from '../components/toast.js';
import { notifyDataChanged } from '../utils/appEvents.js';

export async function renderDashboard(app) {
  const period = getCurrentPeriod();
  app.innerHTML = loadingState('Cargando dashboard...');

  const data = await getDashboardData(period);

  app.innerHTML = `
    ${pageHeader('Dashboard', `
      <a class="btn btn-primary" href="#/imports"><i class="bi bi-file-earmark-arrow-up me-1"></i>Nueva Importacion</a>
    `)}
    <div class="row g-3 mb-3">
      <div class="col-sm-6 col-xl-3">${metricCard('Colaboradores activos', data.kpis.activeEmployees, 'bi-people', 'primary')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Marcaciones del periodo', data.kpis.importedRecords, 'bi-fingerprint', 'secondary')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Multas calculadas', `S/ ${data.kpis.totalPenalty}`, 'bi-cash-coin', 'warning')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Saldo pendiente', `S/ ${data.kpis.totalBalance}`, 'bi-wallet2', 'success')}</div>
    </div>

    <div class="row g-3">
      <div class="col-xl-8">
        <div class="card metric-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 class="h5 mb-1">Consolidado de multas</h2>
                <div class="text-secondary small">Periodo ${period}. Las multas se calculan desde las marcaciones; solo se guardan abonos y estado.</div>
              </div>
              <span class="badge text-bg-light">Abonado S/ ${data.kpis.totalPaid}</span>
            </div>
            ${renderPenaltyTable(data.penaltySummary)}
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="card metric-card mb-3">
          <div class="card-body">
            <h2 class="h5 mb-3">Resumen del periodo</h2>
            <div class="d-flex justify-content-between py-2 border-bottom"><span>Periodo</span><strong>${period}</strong></div>
            <div class="d-flex justify-content-between py-2 border-bottom"><span>Tardanzas</span><strong>${data.kpis.lateRecords}</strong></div>
            <div class="d-flex justify-content-between py-2 border-bottom"><span>Minutos tarde</span><strong>${data.kpis.totalMinutesLate}</strong></div>
            <div class="d-flex justify-content-between py-2 border-bottom"><span>Total multas</span><strong>S/ ${data.kpis.totalPenalty}</strong></div>
            <div class="d-flex justify-content-between py-2"><span>Saldo</span><strong>S/ ${data.kpis.totalBalance}</strong></div>
          </div>
        </div>
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Acciones rapidas</h2>
            <div class="d-grid gap-2">
              <a class="btn btn-outline-primary text-start" href="#/imports"><i class="bi bi-upload me-2"></i>Importar Excel de Microsoft Forms</a>
              <a class="btn btn-outline-secondary text-start" href="#/employees"><i class="bi bi-person-plus me-2"></i>Administrar colaboradores y horarios</a>
              <a class="btn btn-outline-secondary text-start" href="#/settings"><i class="bi bi-sliders me-2"></i>Revisar reglas de multas</a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12">
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Ultimas importaciones</h2>
            ${data.imports.length ? data.imports.map((item) => `
              <div class="d-flex justify-content-between border-bottom py-2">
                <span class="text-truncate">${item.fileName}</span>
                <span class="text-secondary small">${item.records || 0} registros</span>
              </div>
            `).join('') : '<div class="text-secondary">Aun no hay importaciones.</div>'}
          </div>
        </div>
      </div>
    </div>
    ${paymentModal(period)}
  `;

  bindPaymentEvents(app, period);
}

function renderPenaltyTable(rows) {
  if (!rows.length) return '<div class="text-secondary">No hay colaboradores para mostrar.</div>';

  return `
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th>Colaborador</th>
            <th class="text-end">Tardanzas</th>
            <th class="text-end">Minutos</th>
            <th class="text-end">Multa</th>
            <th class="text-end">Abonado</th>
            <th class="text-end">Saldo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>
                <div class="fw-semibold">${row.employeeName}</div>
                <div class="text-secondary small">${row.records} marcaciones</div>
              </td>
              <td class="text-end">${row.lateRecords}</td>
              <td class="text-end">${row.minutesLate}</td>
              <td class="text-end">S/ ${row.totalPenalty}</td>
              <td class="text-end">S/ ${row.amountPaid}</td>
              <td class="text-end fw-semibold">S/ ${row.balance}</td>
              <td>${statusBadge(row.status)}</td>
              <td class="text-end">
                <button
                  class="btn btn-outline-primary btn-sm"
                  data-payment-button
                  data-employee-id="${row.employeeId}"
                  data-employee-name="${row.employeeName}"
                  data-total-penalty="${row.totalPenalty}"
                  data-amount-paid="${row.amountPaid}"
                  data-status="${row.status}"
                  data-observation="${row.observation || ''}">
                  <i class="bi bi-wallet2 me-1"></i>Pago
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function statusBadge(status) {
  const variants = {
    PAGADO: 'success',
    PARCIAL: 'warning',
    PENDIENTE: 'danger',
    'SIN MULTA': 'secondary'
  };
  return `<span class="badge text-bg-${variants[status] || 'secondary'}">${status}</span>`;
}

function paymentModal(period) {
  return `
    <div class="modal fade" id="paymentModal" tabindex="-1" aria-labelledby="paymentModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="paymentForm">
            <div class="modal-header">
              <h2 class="modal-title h5" id="paymentModalLabel">Registrar pago</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body vstack gap-3">
              <input type="hidden" name="employeeId">
              <input type="hidden" name="period" value="${period}">
              <input type="hidden" name="totalPenaltyRaw">
              <div>
                <label class="form-label">Colaborador</label>
                <input class="form-control" name="employeeName" disabled>
              </div>
              <div class="row g-2">
                <div class="col">
                  <label class="form-label">Multa calculada</label>
                  <input class="form-control" name="totalPenalty" disabled>
                </div>
                <div class="col">
                  <label class="form-label">Abonado</label>
                  <input class="form-control" type="number" min="0" step="1" name="amountPaid">
                </div>
              </div>
              <div>
                <label class="form-label">Estado</label>
                <select class="form-select" name="status">
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="SIN MULTA">Sin multa</option>
                </select>
              </div>
              <div>
                <label class="form-label">Observacion</label>
                <textarea class="form-control" name="observation" rows="3"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancelar</button>
              <button class="btn btn-primary" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function bindPaymentEvents(app, period) {
  const modalElement = app.querySelector('#paymentModal');
  const form = app.querySelector('#paymentForm');
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

  app.querySelectorAll('[data-payment-button]').forEach((button) => {
    button.addEventListener('click', () => {
      form.employeeId.value = button.dataset.employeeId;
      form.totalPenaltyRaw.value = button.dataset.totalPenalty || 0;
      form.employeeName.value = button.dataset.employeeName;
      form.totalPenalty.value = `S/ ${button.dataset.totalPenalty}`;
      form.amountPaid.value = button.dataset.amountPaid || 0;
      form.status.value = button.dataset.status || 'PENDIENTE';
      form.observation.value = button.dataset.observation || '';
      modal.show();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const totalPenalty = Number(data.totalPenaltyRaw) || 0;
    const amountPaid = data.status === 'PAGADO'
      ? Math.max(Number(data.amountPaid) || 0, totalPenalty)
      : Number(data.amountPaid) || 0;
    await savePayment({
      employeeId: data.employeeId,
      period,
      amountPaid,
      status: data.status,
      observation: data.observation
    });
    modal.hide();
    notifyDataChanged({ source: 'payment', employeeId: data.employeeId, period });
    showToast('Pago actualizado');
  });
}
