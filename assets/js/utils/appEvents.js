export const DATA_CHANGED_EVENT = 'attendance:data-changed';

export function notifyDataChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }));
}
