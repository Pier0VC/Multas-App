import {
  createEmployee,
  createException,
  createIncident,
  getClockRecordsByEmployee,
  getEmployees,
  getExceptionsByEmployee,
  getIncidentsByEmployee,
  updateEmployeeSchedule
} from '../database.js';
import { pageHeader, loadingState } from '../components/layout.js';
import { employeeList, employeeProfile, employeeOffcanvases, employeeScheduleModal, weekdays } from '../components/employeeProfile.js';
import { showToast } from '../components/toast.js';
import { notifyDataChanged } from '../utils/appEvents.js';

let selectedEmployeeId = null;

export async function renderEmployees(app) {
  app.innerHTML = loadingState('Cargando colaboradores...');
  const employees = await getEmployees();
  selectedEmployeeId = selectedEmployeeId || employees[0]?.id || null;
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || employees[0] || null;
  selectedEmployeeId = selectedEmployee?.id || null;
  const details = selectedEmployee ? await loadEmployeeDetails(selectedEmployee.id) : { exceptions: [], incidents: [], clockRecords: [] };

  app.innerHTML = `
    ${pageHeader('Colaboradores', `
      <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#employeeModal"><i class="bi bi-person-plus me-1"></i>Nuevo</button>
    `)}
    <div class="outlook-layout">
      <aside class="employee-list-pane">
        <div class="p-3 border-bottom">
          <input class="form-control" id="employeeSearch" placeholder="Buscar colaborador">
        </div>
        ${employeeList(employees, selectedEmployeeId)}
      </aside>
      <section class="employee-profile-pane">
        ${employeeProfile(selectedEmployee, details)}
      </section>
    </div>
    ${employeeModal()}
    ${employeeScheduleModal(selectedEmployee)}
    ${employeeOffcanvases(selectedEmployee)}
  `;

  bindEmployeeEvents(app);
}

async function loadEmployeeDetails(employeeId) {
  const [exceptions, incidents, clockRecords] = await Promise.all([
    getExceptionsByEmployee(employeeId),
    getIncidentsByEmployee(employeeId),
    getClockRecordsByEmployee(employeeId)
  ]);
  return { exceptions, incidents, clockRecords };
}

function bindEmployeeEvents(app) {
  app.querySelectorAll('[data-employee-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      selectedEmployeeId = button.dataset.employeeId;
      await renderEmployees(app);
    });
  });

  app.querySelector('#employeeSearch')?.addEventListener('input', (event) => {
    const term = event.target.value.toLocaleLowerCase('es-PE');
    app.querySelectorAll('[data-employee-id]').forEach((item) => {
      item.classList.toggle('d-none', !item.textContent.toLocaleLowerCase('es-PE').includes(term));
    });
  });

  app.querySelector('#employeeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employee = await createEmployee({
      name: form.get('name'),
      type: form.get('type')
    });
    selectedEmployeeId = employee.id;
    bootstrap.Modal.getInstance(document.getElementById('employeeModal'))?.hide();
    notifyDataChanged({ source: 'employee-created', employeeId: employee.id });
    showToast('Colaborador creado');
    await renderEmployees(app);
  });

  app.querySelector('#scheduleForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const employeeId = formData.get('employeeId');
    const weeklySchedule = {};

    weekdays.forEach(([key]) => {
      weeklySchedule[key] = {
        active: formData.get(`${key}-active`) === 'on',
        entryTime: formData.get(`${key}-entryTime`) || '08:00'
      };
    });

    await updateEmployeeSchedule(employeeId, weeklySchedule);
    bootstrap.Modal.getInstance(document.getElementById('scheduleModal'))?.hide();
    notifyDataChanged({ source: 'employee-schedule', employeeId });
    showToast('Horario base actualizado y multas recalculadas');
    await renderEmployees(app);
  });

  app.querySelector('#exceptionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await createException(form);
    bootstrap.Offcanvas.getInstance(document.getElementById('exceptionOffcanvas'))?.hide();
    notifyDataChanged({ source: 'exception', employeeId: form.employeeId });
    showToast('Excepcion registrada y dashboard actualizado');
    await renderEmployees(app);
  });

  app.querySelector('#incidentForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    await createIncident(form);
    bootstrap.Offcanvas.getInstance(document.getElementById('incidentOffcanvas'))?.hide();
    notifyDataChanged({ source: 'incident', employeeId: form.employeeId });
    showToast('Incidencia registrada y dashboard actualizado');
    await renderEmployees(app);
  });
}

function employeeModal() {
  return `
    <div class="modal fade" id="employeeModal" tabindex="-1" aria-labelledby="employeeModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="employeeForm">
            <div class="modal-header">
              <h2 class="modal-title h5" id="employeeModalLabel">Nuevo colaborador</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body vstack gap-3">
              <div>
                <label class="form-label">Nombre</label>
                <input class="form-control" name="name" required>
              </div>
              <div>
                <label class="form-label">Tipo</label>
                <input class="form-control" name="type" value="COLABORADOR">
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
