export function showToast(message, variant = 'primary') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${variant} border-0`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>
  `;
  container.appendChild(toast);

  const instance = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 });
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
  instance.show();
}
