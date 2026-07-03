import { formatDate } from '../utils/dates.js';

export const weekdays = [
  ['monday', 'Lunes'],
  ['tuesday', 'Martes'],
  ['wednesday', 'Miercoles'],
  ['thursday', 'Jueves'],
  ['friday', 'Viernes']
];

export function employeeList(employees, selectedId) {
  if (!employees.length) {
    return '<div class="empty-state">No hay colaboradores registrados.</div>';
  }

  return `
    <div class="list-group list-group-flush employee-list">
      ${employees.map((employee) => `
        <button class="list-group-item list-group-item-action ${employee.id === selectedId ? 'active' : ''}" data-employee-id="${employee.id}">
          <div class="fw-semibold text-truncate">${employee.name}</div>
          <div class="small ${employee.id === selectedId ? '' : 'text-secondary'}">${employee.type || 'COLABORADOR'}</div>
        </button>
      `).join('')}
    </div>
  `;
}

export function employeeProfile(employee, details) {
  if (!employee) {
    return `
      <div class="empty-state">
        <i class="bi bi-person-lines-fill display-6 d-block mb-2"></i>
        Selecciona un colaborador para ver su perfil.
      </div>
    `;
  }

  return `
    <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">${employee.name}</h2>
        <div class="text-secondary">${employee.type || 'COLABORADOR'} - ${employee.active === false ? 'Inactivo' : 'Activo'}</div>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="modal" data-bs-target="#scheduleModal">
          <i class="bi bi-clock me-1"></i>Horario
        </button>
        <button class="btn btn-outline-primary btn-sm" data-bs-toggle="offcanvas" data-bs-target="#exceptionOffcanvas">
          <i class="bi bi-calendar-plus me-1"></i>Excepcion
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="offcanvas" data-bs-target="#incidentOffcanvas">
          <i class="bi bi-flag me-1"></i>Incidencia
        </button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-xl-6">
        <div class="section-title">Horario Base</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <tbody>
              ${renderSchedule(employee.weeklySchedule || {})}
            </tbody>
          </table>
        </div>
      </div>
      <div class="col-xl-6">
        <div class="section-title">Excepciones</div>
        ${renderExceptions(details.exceptions)}
      </div>
      <div class="col-xl-6">
        <div class="section-title">Incidencias</div>
        ${renderIncidents(details.incidents)}
      </div>
      <div class="col-xl-6">
        <div class="section-title">Ultimas Marcaciones</div>
        ${renderClockRecords(details.clockRecords)}
      </div>
    </div>
  `;
}

function renderSchedule(schedule) {
  return weekdays.map(([key, label]) => {
    const day = schedule[key] || {};
    return `
      <tr>
        <td class="fw-semibold">${label}</td>
        <td>${day.active === false ? '<span class="badge text-bg-light">Descanso</span>' : day.entryTime || '08:00'}</td>
      </tr>
    `;
  }).join('');
}

function renderExceptions(exceptions = []) {
  if (!exceptions.length) return '<div class="text-secondary small">Sin excepciones registradas.</div>';
  return `
    <div class="list-group list-group-flush">
      ${exceptions.map((item) => `
        <div class="list-group-item px-0">
          <div class="fw-semibold">${formatDate(item.startDate)}${item.endDate && item.endDate !== item.startDate ? ` - ${formatDate(item.endDate)}` : ''}</div>
          <div class="small text-secondary">${item.type} - ${item.entryTime || 'Sin hora'} ${item.observation ? `- ${item.observation}` : ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderIncidents(incidents = []) {
  if (!incidents.length) return '<div class="text-secondary small">Sin incidencias registradas.</div>';
  return `
    <div class="list-group list-group-flush">
      ${incidents.map((item) => `
        <div class="list-group-item px-0">
          <div class="fw-semibold">${formatDate(item.date)} - ${item.dayStatus}</div>
          <div class="small text-secondary">${item.penaltyStatus || 'APLICA'} ${item.observation ? `- ${item.observation}` : ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderClockRecords(records = []) {
  if (!records.length) return '<div class="text-secondary small">Sin marcaciones registradas.</div>';
  return `
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead><tr><th>Fecha</th><th>Ingreso</th><th>Tarde</th></tr></thead>
        <tbody>
          ${records.map((record) => `
            <tr>
              <td>${formatDate(record.date)}</td>
              <td>${record.checkIn || '-'}</td>
              <td>${Number(record.minutesLate || 0)} min</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function employeeScheduleModal(employee) {
  const schedule = employee?.weeklySchedule || {};
  const disabled = employee ? '' : 'disabled';

  return `
    <div class="modal fade" id="scheduleModal" tabindex="-1" aria-labelledby="scheduleModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="scheduleForm">
            <div class="modal-header">
              <h2 class="modal-title h5" id="scheduleModalLabel">Horario base</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" name="employeeId" value="${employee?.id || ''}">
              <div class="vstack gap-3">
                ${weekdays.map(([key, label]) => {
                  const day = schedule[key] || { active: true, entryTime: '08:00' };
                  return `
                    <div class="row g-2 align-items-center">
                      <div class="col-4 fw-semibold">${label}</div>
                      <div class="col-4">
                        <input class="form-control" type="time" name="${key}-entryTime" value="${day.entryTime || '08:00'}" ${disabled}>
                      </div>
                      <div class="col-4">
                        <div class="form-check form-switch">
                          <input class="form-check-input" type="checkbox" role="switch" id="${key}-active" name="${key}-active" ${day.active === false ? '' : 'checked'} ${disabled}>
                          <label class="form-check-label" for="${key}-active">Laborable</label>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancelar</button>
              <button class="btn btn-primary" type="submit" ${disabled}><i class="bi bi-save me-1"></i>Guardar horario</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function employeeOffcanvases(employee) {
  const disabled = employee ? '' : 'disabled';
  return `
    <div class="offcanvas offcanvas-end" tabindex="-1" id="exceptionOffcanvas" aria-labelledby="exceptionOffcanvasLabel">
      <div class="offcanvas-header">
        <h2 class="offcanvas-title h5" id="exceptionOffcanvasLabel">Nueva excepcion</h2>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <form id="exceptionForm" class="vstack gap-3">
          <input type="hidden" name="employeeId" value="${employee?.id || ''}">
          <div>
            <label class="form-label">Tipo</label>
            <select class="form-select" name="type" ${disabled}>
              <option value="TEMPORAL">Temporal</option>
              <option value="CAMBIO TURNO">Cambio de turno</option>
              <option value="DESCANSO">Descanso</option>
            </select>
          </div>
          <div class="row g-2">
            <div class="col">
              <label class="form-label">Inicio</label>
              <input class="form-control" type="date" name="startDate" required ${disabled}>
            </div>
            <div class="col">
              <label class="form-label">Fin</label>
              <input class="form-control" type="date" name="endDate" ${disabled}>
            </div>
          </div>
          <div>
            <label class="form-label">Hora de ingreso</label>
            <input class="form-control" type="time" name="entryTime" ${disabled}>
          </div>
          <div>
            <label class="form-label">Observacion</label>
            <textarea class="form-control" name="observation" rows="3" ${disabled}></textarea>
          </div>
          <button class="btn btn-primary" type="submit" ${disabled}><i class="bi bi-save me-1"></i>Guardar</button>
        </form>
      </div>
    </div>

    <div class="offcanvas offcanvas-end" tabindex="-1" id="incidentOffcanvas" aria-labelledby="incidentOffcanvasLabel">
      <div class="offcanvas-header">
        <h2 class="offcanvas-title h5" id="incidentOffcanvasLabel">Nueva incidencia</h2>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
      </div>
      <div class="offcanvas-body">
        <form id="incidentForm" class="vstack gap-3">
          <input type="hidden" name="employeeId" value="${employee?.id || ''}">
          <div>
            <label class="form-label">Fecha</label>
            <input class="form-control" type="date" name="date" required ${disabled}>
          </div>
          <div>
            <label class="form-label">Estado</label>
            <select class="form-select" name="dayStatus" ${disabled}>
              ${['NORMAL', 'JUSTIFICADO', 'REDENCION', 'FERIADO', 'VACACIONES', 'LICENCIA', 'DESCANSO', 'SIN MARCACION'].map((status) => `<option value="${status}">${status}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Multa</label>
            <select class="form-select" name="penaltyStatus" ${disabled}>
              <option value="APLICA">Aplica</option>
              <option value="NO APLICA">No aplica</option>
            </select>
          </div>
          <div>
            <label class="form-label">Observacion</label>
            <textarea class="form-control" name="observation" rows="3" ${disabled}></textarea>
          </div>
          <button class="btn btn-primary" type="submit" ${disabled}><i class="bi bi-save me-1"></i>Guardar</button>
        </form>
      </div>
    </div>
  `;
}
