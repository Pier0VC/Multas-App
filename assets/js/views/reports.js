import { getClockRecordsByPeriod, getEmployees, getSettings } from '../database.js';
import { pageHeader, loadingState, metricCard } from '../components/layout.js';
import { getCurrentPeriod, formatDate } from '../utils/dates.js';
import { calculatePenalty, calculateTotalPenalty } from '../utils/penalties.js';

export async function renderReports(app) {
  const period = getCurrentPeriod();
  app.innerHTML = loadingState('Cargando reportes...');

  const [settings, employees, records] = await Promise.all([
    getSettings(),
    getEmployees(),
    getClockRecordsByPeriod(period)
  ]);
  const rules = settings?.penaltyRules;
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const totalPenalty = calculateTotalPenalty(records, rules);

  app.innerHTML = `
    ${pageHeader('Reportes')}
    <div class="row g-3 mb-3">
      <div class="col-sm-6 col-xl-3">${metricCard('Período', period, 'bi-calendar3', 'primary')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Marcaciones', records.length, 'bi-list-check', 'secondary')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Tardanzas', records.filter((record) => Number(record.minutesLate) > 0).length, 'bi-clock', 'warning')}</div>
      <div class="col-sm-6 col-xl-3">${metricCard('Total multas', `S/ ${totalPenalty}`, 'bi-cash', 'success')}</div>
    </div>
    <div class="card metric-card">
      <div class="card-body">
        <h2 class="h5 mb-3">Consolidado de multas</h2>
        ${records.length ? `
          <div class="table-responsive">
            <table class="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Fecha</th>
                  <th>Ingreso</th>
                  <th>Esperado</th>
                  <th>Minutos</th>
                  <th>Multa</th>
                </tr>
              </thead>
              <tbody>
                ${records.map((record) => `
                  <tr>
                    <td>${employeeById.get(record.employeeId)?.name || 'Sin colaborador'}</td>
                    <td>${formatDate(record.date)}</td>
                    <td>${record.checkIn || '-'}</td>
                    <td>${record.expectedTime || '-'}</td>
                    <td>${Number(record.minutesLate || 0)}</td>
                    <td>S/ ${calculatePenalty(record.minutesLate, rules)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="text-secondary">No hay marcaciones para el período actual.</div>'}
      </div>
    </div>
  `;
}
