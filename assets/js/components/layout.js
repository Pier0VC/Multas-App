export function pageHeader(title, actions = '') {
  return `
    <div class="page-title">
      <div>
        <h1 class="h3 mb-1">${title}</h1>
        <div class="text-secondary small">Gestión de asistencias, horarios y multas</div>
      </div>
      <div class="d-flex gap-2 flex-wrap">${actions}</div>
    </div>
  `;
}

export function loadingState(text = 'Cargando información...') {
  return `
    <div class="empty-state">
      <div class="spinner-border text-primary mb-3" role="status"></div>
      <div>${text}</div>
    </div>
  `;
}

export function emptyState(icon, title, text = '') {
  return `
    <div class="empty-state">
      <i class="bi ${icon} display-6 d-block mb-2"></i>
      <h2 class="h5">${title}</h2>
      <p class="mb-0">${text}</p>
    </div>
  `;
}

export function metricCard(label, value, icon, tone = 'primary') {
  return `
    <div class="card metric-card">
      <div class="card-body d-flex justify-content-between align-items-start">
        <div>
          <div class="text-secondary small mb-2">${label}</div>
          <div class="metric-value">${value}</div>
        </div>
        <span class="badge text-bg-${tone} fs-6"><i class="bi ${icon}"></i></span>
      </div>
    </div>
  `;
}
