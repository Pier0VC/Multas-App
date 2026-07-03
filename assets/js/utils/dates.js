export function toInputDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

export function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function getCurrentPeriod() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function compareDateDesc(a, b) {
  return String(b.date || b.startDate || '').localeCompare(String(a.date || a.startDate || ''));
}
