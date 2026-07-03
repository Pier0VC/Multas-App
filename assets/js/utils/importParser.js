function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-PE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function excelDateToInputDate(serialDate) {
  const parsed = XLSX.SSF.parse_date_code(serialDate);
  if (!parsed) return '';
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

function toInputDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === 'number') {
    return excelDateToInputDate(value);
  }

  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${pad(isoMatch[2])}-${pad(isoMatch[3])}`;

  const localMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (localMatch) return `${localMatch[3]}-${pad(localMatch[2])}-${pad(localMatch[1])}`;

  return '';
}

function serialTimeToText(value) {
  const totalMinutes = Math.round((Number(value) % 1) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function toTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  if (typeof value === 'number') {
    return serialTimeToText(value);
  }

  const text = String(value || '').trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${pad(match[1])}:${match[2]}`;
}

function findField(row, candidates) {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => candidates.includes(normalizeHeader(key)));
  return match ? match[1] : '';
}

function textField(row, candidates) {
  return String(findField(row, candidates) || '').trim();
}

function normalizeRow(row) {
  const registerType = textField(row, ['deseasregistrar']);
  if (registerType && normalizeHeader(registerType) !== 'asistencia') {
    return { name: '', date: '', checkIn: '' };
  }

  const formsTimestamp = findField(row, ['completiontime', 'starttime', 'horadefinalizacion', 'horadeinicio']);
  const simpleDate = findField(row, ['fecha', 'date']);
  const simpleTime = findField(row, ['horademarcacion', 'marcacion', 'hora', 'checkin']);
  const dateValue = simpleDate || formsTimestamp;
  const timeValue = simpleTime || formsTimestamp;

  return {
    name: textField(row, ['nombre', 'name']),
    date: toInputDate(dateValue),
    checkIn: toTime(timeValue)
  };
}

export async function parseClockRowsFromFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  return rows.map(normalizeRow).filter((row) => row.name || row.date || row.checkIn);
}
