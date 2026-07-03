import { getImports, processClockImport } from '../database.js';
import { pageHeader, loadingState } from '../components/layout.js';
import { getCurrentPeriod } from '../utils/dates.js';
import { parseClockRowsFromFile } from '../utils/importParser.js';
import { showToast } from '../components/toast.js';
import { notifyDataChanged } from '../utils/appEvents.js';

export async function renderImports(app) {
  app.innerHTML = loadingState('Cargando importaciones...');
  const imports = await getImports();

  app.innerHTML = `
    ${pageHeader('Importaciones', `
      <a class="btn btn-outline-secondary" href="./plantillas/plantilla-marcaciones.xlsx" download><i class="bi bi-file-earmark-spreadsheet me-1"></i>Plantilla vacia</a>
      <a class="btn btn-outline-primary" href="./plantillas/ejemplo-marcaciones.xlsx" download><i class="bi bi-download me-1"></i>Ejemplo con datos</a>
    `)}
    <div class="row g-3">
      <div class="col-lg-5">
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Nueva Importacion</h2>
            <div class="alert alert-info small">
              Puedes subir el Excel original de Microsoft Forms. Se leeran <strong>Name</strong>,
              <strong>Completion time</strong> y solo las filas donde <strong>Deseas registrar</strong> sea
              <strong>Asistencia</strong>. Tambien acepta la plantilla simple con <strong>Nombre</strong>,
              <strong>Fecha</strong> y <strong>Hora de marcacion</strong>.
              Cada importacion se guarda como historial nuevo. Por defecto, si ya existe una marcacion del mismo colaborador en la misma fecha, se omite para no sobrescribir.
            </div>
            <form id="importForm" class="vstack gap-3">
              <div>
                <label class="form-label">Archivo Microsoft Forms</label>
                <input class="form-control" type="file" accept=".xlsx,.xls" name="file" required>
                <div class="form-text" id="filePreview">Selecciona la plantilla o el archivo de Microsoft Forms.</div>
              </div>
              <div>
                <label class="form-label">Periodo</label>
                <input class="form-control" type="month" name="period" value="${getCurrentPeriod()}" required>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" value="1" id="updateExisting" name="updateExisting">
                <label class="form-check-label" for="updateExisting">
                  Actualizar marcaciones existentes del mismo colaborador y fecha
                </label>
              </div>
              <button class="btn btn-primary" type="submit"><i class="bi bi-upload me-1"></i>Procesar</button>
            </form>
          </div>
        </div>
      </div>
      <div class="col-lg-7">
        <div class="card metric-card">
          <div class="card-body">
            <h2 class="h5 mb-3">Historial</h2>
            ${renderImportsTable(imports)}
          </div>
        </div>
      </div>
    </div>
  `;

  bindImportEvents(app);
}

function bindImportEvents(app) {
  app.querySelector('input[name="file"]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    const preview = app.querySelector('#filePreview');
    if (!file) {
      preview.textContent = 'Selecciona la plantilla o el archivo de Microsoft Forms.';
      return;
    }

    try {
      const rows = await parseClockRowsFromFile(file);
      preview.textContent = `${rows.length} filas detectadas en ${file.name}.`;
    } catch {
      preview.textContent = 'No se pudo leer el archivo. Revisa que sea .xlsx o .xls.';
    }
  });

  app.querySelector('#importForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Procesando';

    const form = new FormData(event.currentTarget);
    const file = form.get('file');

    try {
      const rows = await parseClockRowsFromFile(file);
      const summary = await processClockImport({
        fileName: file?.name || 'archivo.xlsx',
        period: form.get('period'),
        rows,
        updateExisting: form.get('updateExisting') === '1'
      });
      notifyDataChanged({ source: 'import', period: form.get('period') });
      showToast(`Importacion lista: ${summary.insertedRecords} nuevas, ${summary.updatedRecords} actualizadas, ${summary.existingRecords} existentes omitidas.`, 'success');
      await renderImports(app);
    } catch (error) {
      console.error(error);
      showToast('No se pudo procesar el Excel. Revisa las columnas Nombre, Fecha y Hora de marcacion.', 'danger');
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="bi bi-upload me-1"></i>Procesar';
    }
  });
}

function renderImportsTable(imports) {
  if (!imports.length) return '<div class="text-secondary">Aun no hay importaciones registradas.</div>';
  return `
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Periodo</th>
            <th>Nuevas</th>
            <th>Actualizadas</th>
            <th>Existentes</th>
            <th>Omitidas</th>
          </tr>
        </thead>
        <tbody>
          ${imports.map((item) => `
            <tr>
              <td class="text-truncate">${item.fileName}</td>
              <td>${item.period || '-'}</td>
              <td>${item.insertedRecords ?? item.records ?? 0}</td>
              <td>${item.updatedRecords || 0}</td>
              <td>${item.existingRecords || 0}</td>
              <td>${item.skippedRows || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
