import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestore } from './firebase.js';
import { DEFAULT_PENALTY_RULES, calculatePenalty } from './utils/penalties.js';

const SETTINGS_DOC_ID = 'rules';
const DEFAULT_WEEKLY_SCHEDULE = {
  monday: { active: true, entryTime: '09:00' },
  tuesday: { active: true, entryTime: '09:00' },
  wednesday: { active: true, entryTime: '09:00' },
  thursday: { active: true, entryTime: '09:00' },
  friday: { active: true, entryTime: '09:00' }
};

function withId(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function normalizeNameKey(name) {
  return normalizeName(name).toLocaleLowerCase('es-PE');
}

function collectionRef(name) {
  return collection(firestore, name);
}

function sortByFieldDesc(items, field) {
  return [...items].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
}

function getWeekdayKey(date) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday'
  }[day] || null;
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function calculateMinutesLate(checkIn, expectedTime) {
  const checkInMinutes = timeToMinutes(checkIn);
  const expectedMinutes = timeToMinutes(expectedTime);
  if (checkInMinutes === null || expectedMinutes === null) return 0;
  return Math.max(0, checkInMinutes - expectedMinutes);
}

function findExceptionForDate(exceptions, date) {
  return sortByFieldDesc(exceptions, 'startDate').find((item) => (
    item.startDate <= date && (item.endDate || item.startDate) >= date
  ));
}

async function resolveExpectedTime(employee, date) {
  const exceptions = await getExceptionsByEmployee(employee.id);
  const exception = findExceptionForDate(exceptions, date);
  if (exception) return exception.entryTime || null;

  const weekdayKey = getWeekdayKey(date);
  const schedule = weekdayKey ? employee.weeklySchedule?.[weekdayKey] : null;
  if (!schedule || schedule.active === false) return null;
  return schedule.entryTime || '08:00';
}

export async function initializeDatabase() {
  const settingsRef = doc(firestore, 'settings', SETTINGS_DOC_ID);
  const settingsSnap = await getDoc(settingsRef);

  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      penaltyRules: DEFAULT_PENALTY_RULES,
      defaultWeeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return getSettings();
}

export async function getSettings() {
  const settingsSnap = await getDoc(doc(firestore, 'settings', SETTINGS_DOC_ID));
  return settingsSnap.exists() ? withId(settingsSnap) : null;
}

export async function updateSettings(data) {
  const settingsRef = doc(firestore, 'settings', SETTINGS_DOC_ID);
  await setDoc(settingsRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return getSettings();
}

export async function getEmployees({ includeInactive = false } = {}) {
  const employeesQuery = query(collectionRef('employees'), orderBy('name', 'asc'));
  const snapshot = await getDocs(employeesQuery);
  return snapshot.docs
    .map(withId)
    .filter((employee) => includeInactive || employee.active !== false);
}

export async function getEmployee(employeeId) {
  const snapshot = await getDoc(doc(firestore, 'employees', employeeId));
  return snapshot.exists() ? withId(snapshot) : null;
}

export async function createEmployee(data) {
  const name = normalizeName(data.name);
  const employee = {
    name,
    nameKey: normalizeNameKey(name),
    type: data.type || 'COLABORADOR',
    active: data.active ?? true,
    weeklySchedule: data.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collectionRef('employees'), employee);
  return { id: ref.id, ...employee };
}

export async function updateEmployee(employeeId, data) {
  await updateDoc(doc(firestore, 'employees', employeeId), {
    ...data,
    updatedAt: serverTimestamp()
  });
  return getEmployee(employeeId);
}

export async function updateEmployeeSchedule(employeeId, weeklySchedule) {
  const employee = await updateEmployee(employeeId, { weeklySchedule });
  await recalculateClockRecordsForEmployee(employeeId);
  return employee;
}

export async function findEmployeeByName(name) {
  const nameKey = normalizeNameKey(name);
  const employeesQuery = query(collectionRef('employees'), where('nameKey', '==', nameKey), limit(1));
  const snapshot = await getDocs(employeesQuery);
  return snapshot.empty ? null : withId(snapshot.docs[0]);
}

export async function getOrCreateEmployeeByName(name) {
  const existing = await findEmployeeByName(name);
  if (existing) return { employee: existing, created: false };

  const employee = await createEmployee({ name });
  return { employee, created: true };
}

export async function getExceptionsByEmployee(employeeId) {
  const exceptionsQuery = query(
    collectionRef('exceptions'),
    where('employeeId', '==', employeeId)
  );
  const snapshot = await getDocs(exceptionsQuery);
  return sortByFieldDesc(snapshot.docs.map(withId), 'startDate');
}

export async function createException(data) {
  const ref = await addDoc(collectionRef('exceptions'), {
    employeeId: data.employeeId,
    type: data.type || 'TEMPORAL',
    startDate: data.startDate,
    endDate: data.endDate || data.startDate,
    entryTime: data.entryTime,
    observation: data.observation || '',
    createdAt: serverTimestamp()
  });
  await recalculateClockRecordsForEmployee(data.employeeId);
  return { id: ref.id };
}

export async function getIncidentsByEmployee(employeeId) {
  const incidentsQuery = query(
    collectionRef('incidents'),
    where('employeeId', '==', employeeId)
  );
  const snapshot = await getDocs(incidentsQuery);
  return sortByFieldDesc(snapshot.docs.map(withId), 'date');
}

export async function getIncidentsByPeriod(period) {
  const startDate = `${period}-01`;
  const endDate = `${period}-31`;
  const incidentsQuery = query(
    collectionRef('incidents'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  const snapshot = await getDocs(incidentsQuery);
  return snapshot.docs.map(withId);
}

export async function createIncident(data) {
  const ref = await addDoc(collectionRef('incidents'), {
    employeeId: data.employeeId,
    date: data.date,
    dayStatus: data.dayStatus || 'NORMAL',
    penaltyStatus: data.penaltyStatus || 'APLICA',
    observation: data.observation || '',
    createdAt: serverTimestamp()
  });
  return { id: ref.id };
}

export async function getClockRecordsByEmployee(employeeId, recordLimit = 20) {
  const recordsQuery = query(
    collectionRef('clockRecords'),
    where('employeeId', '==', employeeId)
  );
  const snapshot = await getDocs(recordsQuery);
  return sortByFieldDesc(snapshot.docs.map(withId), 'date').slice(0, recordLimit);
}

export async function getClockRecordsByPeriod(period) {
  const startDate = `${period}-01`;
  const endDate = `${period}-31`;
  const recordsQuery = query(
    collectionRef('clockRecords'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(recordsQuery);
  return snapshot.docs.map(withId);
}

export async function findClockRecord(employeeId, date) {
  const recordsQuery = query(
    collectionRef('clockRecords'),
    where('employeeId', '==', employeeId),
    where('date', '==', date),
    limit(1)
  );
  const snapshot = await getDocs(recordsQuery);
  return snapshot.empty ? null : withId(snapshot.docs[0]);
}

export async function upsertClockRecord(data, { updateExisting = true } = {}) {
  const existing = await findClockRecord(data.employeeId, data.date);
  const payload = {
    employeeId: data.employeeId,
    date: data.date,
    checkIn: data.checkIn,
    expectedTime: data.expectedTime || null,
    minutesLate: Number(data.minutesLate) || 0,
    source: data.source || 'MANUAL',
    importId: data.importId || null,
    updatedAt: serverTimestamp()
  };

  if (existing) {
    if (!updateExisting) {
      return { id: existing.id, updated: false, skippedExisting: true };
    }

    await updateDoc(doc(firestore, 'clockRecords', existing.id), payload);
    return { id: existing.id, updated: true };
  }

  const ref = await addDoc(collectionRef('clockRecords'), {
    ...payload,
    createdAt: serverTimestamp()
  });
  return { id: ref.id, updated: false };
}

export async function recalculateClockRecordsForEmployee(employeeId) {
  const employee = await getEmployee(employeeId);
  if (!employee) return { updatedRecords: 0 };

  const recordsQuery = query(collectionRef('clockRecords'), where('employeeId', '==', employeeId));
  const snapshot = await getDocs(recordsQuery);
  let updatedRecords = 0;
  let batch = writeBatch(firestore);
  let batchSize = 0;

  for (const recordSnapshot of snapshot.docs) {
    const record = withId(recordSnapshot);
    const expectedTime = await resolveExpectedTime(employee, record.date);
    const minutesLate = calculateMinutesLate(record.checkIn, expectedTime);

    batch.update(doc(firestore, 'clockRecords', record.id), {
      expectedTime: expectedTime || null,
      minutesLate,
      updatedAt: serverTimestamp()
    });
    updatedRecords += 1;
    batchSize += 1;

    if (batchSize === 450) {
      await batch.commit();
      batch = writeBatch(firestore);
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  return { updatedRecords };
}

export async function createImport(data) {
  const ref = await addDoc(collectionRef('imports'), {
    fileName: data.fileName,
    period: data.period,
    processedAt: serverTimestamp(),
    records: Number(data.records) || 0,
    newEmployees: Number(data.newEmployees) || 0,
    updatedRecords: Number(data.updatedRecords) || 0
  });
  return { id: ref.id };
}

export async function updateImport(importId, data) {
  await updateDoc(doc(firestore, 'imports', importId), data);
}

export async function getImports(importLimit = 20) {
  const importsQuery = query(collectionRef('imports'), orderBy('processedAt', 'desc'), limit(importLimit));
  const snapshot = await getDocs(importsQuery);
  return snapshot.docs.map(withId);
}

export async function getPaymentsByPeriod(period) {
  const paymentsQuery = query(collectionRef('payments'), where('period', '==', period));
  try {
    const snapshot = await getDocs(paymentsQuery);
    return snapshot.docs.map(withId);
  } catch (error) {
    console.warn('No se pudieron leer pagos. Revisa reglas de Firestore para payments.', error);
    return [];
  }
}

export async function savePayment(data) {
  const paymentId = `${data.employeeId}_${data.period}`;
  const amountPaid = Number(data.amountPaid) || 0;
  const status = data.status || (amountPaid > 0 ? 'PARTIAL' : 'PENDING');

  await setDoc(doc(firestore, 'payments', paymentId), {
    employeeId: data.employeeId,
    period: data.period,
    amountPaid,
    status,
    observation: data.observation || '',
    updatedAt: serverTimestamp()
  }, { merge: true });

  return { id: paymentId };
}

export async function getPenaltySummaryByEmployee(period) {
  const [settings, employees, records, payments, incidents] = await Promise.all([
    getSettings(),
    getEmployees(),
    getClockRecordsByPeriod(period),
    getPaymentsByPeriod(period),
    getIncidentsByPeriod(period)
  ]);
  const rules = settings?.penaltyRules || DEFAULT_PENALTY_RULES;
  const paymentsByEmployee = new Map(payments.map((payment) => [payment.employeeId, payment]));
  const incidentByEmployeeDate = new Map(incidents.map((incident) => [`${incident.employeeId}_${incident.date}`, incident]));
  const rows = employees.map((employee) => {
    const employeeRecords = records.filter((record) => record.employeeId === employee.id);
    const lateRecords = employeeRecords.filter((record) => Number(record.minutesLate) > 0);
    const chargeableLateRecords = lateRecords.filter((record) => {
      const incident = incidentByEmployeeDate.get(`${employee.id}_${record.date}`);
      if (!incident) return true;
      if (incident.penaltyStatus === 'NO APLICA') return false;
      return ['NORMAL', ''].includes(incident.dayStatus || '');
    });
    const totalPenalty = chargeableLateRecords.reduce((sum, record) => sum + calculatePenalty(record.minutesLate, rules), 0);
    const payment = paymentsByEmployee.get(employee.id);
    const amountPaid = Number(payment?.amountPaid || 0);
    const balance = Math.max(0, totalPenalty - amountPaid);
    const derivedStatus = totalPenalty === 0 ? 'SIN MULTA' : balance <= 0 ? 'PAGADO' : amountPaid > 0 ? 'PARCIAL' : 'PENDIENTE';

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      records: employeeRecords.length,
      lateRecords: chargeableLateRecords.length,
      minutesLate: chargeableLateRecords.reduce((sum, record) => sum + Number(record.minutesLate || 0), 0),
      totalPenalty,
      amountPaid,
      balance,
      status: payment?.status || derivedStatus,
      observation: payment?.observation || ''
    };
  });

  return rows.sort((a, b) => b.totalPenalty - a.totalPenalty || a.employeeName.localeCompare(b.employeeName));
}

export async function processClockImport({ fileName, period, rows, updateExisting = false }) {
  const importRef = await createImport({
    fileName,
    period,
    records: 0,
    newEmployees: 0,
    updatedRecords: 0
  });
  const summary = {
    importId: importRef.id,
    records: 0,
    newEmployees: 0,
    updatedRecords: 0,
    insertedRecords: 0,
    existingRecords: 0,
    skippedRows: 0
  };

  for (const row of rows) {
    if (!row.name || !row.date || !row.checkIn) {
      summary.skippedRows += 1;
      continue;
    }

    const { employee, created } = await getOrCreateEmployeeByName(row.name);
    const expectedTime = await resolveExpectedTime(employee, row.date);
    const result = await upsertClockRecord({
      employeeId: employee.id,
      date: row.date,
      checkIn: row.checkIn,
      expectedTime,
      minutesLate: calculateMinutesLate(row.checkIn, expectedTime),
      source: 'MICROSOFT_FORMS',
      importId: importRef.id
    }, {
      updateExisting
    });

    if (result.skippedExisting) {
      summary.existingRecords += 1;
      continue;
    }

    summary.records += 1;
    summary.newEmployees += created ? 1 : 0;
    summary.updatedRecords += result.updated ? 1 : 0;
    summary.insertedRecords += result.updated ? 0 : 1;
  }

  await updateImport(importRef.id, {
    records: summary.records,
    newEmployees: summary.newEmployees,
    updatedRecords: summary.updatedRecords,
    insertedRecords: summary.insertedRecords,
    existingRecords: summary.existingRecords,
    skippedRows: summary.skippedRows
  });

  return summary;
}

export async function getDashboardData(period) {
  const [settings, employees, clockRecords, imports, penaltySummary] = await Promise.all([
    getSettings(),
    getEmployees(),
    getClockRecordsByPeriod(period),
    getImports(5),
    getPenaltySummaryByEmployee(period)
  ]);

  const lateRecords = clockRecords.filter((record) => Number(record.minutesLate) > 0);
  const totalPenalty = penaltySummary.reduce((sum, row) => sum + row.totalPenalty, 0);
  const totalPaid = penaltySummary.reduce((sum, row) => sum + row.amountPaid, 0);
  return {
    settings,
    employees,
    clockRecords,
    imports,
    penaltySummary,
    kpis: {
      activeEmployees: employees.length,
      importedRecords: clockRecords.length,
      lateRecords: lateRecords.length,
      totalMinutesLate: lateRecords.reduce((sum, record) => sum + Number(record.minutesLate || 0), 0),
      totalPenalty,
      totalPaid,
      totalBalance: Math.max(0, totalPenalty - totalPaid)
    }
  };
}

export async function seedDemoEmployees(names = []) {
  const batch = writeBatch(firestore);
  names.map(normalizeName).filter(Boolean).forEach((name) => {
    const employeeRef = doc(collectionRef('employees'));
    batch.set(employeeRef, {
      name,
      nameKey: normalizeNameKey(name),
      type: 'COLABORADOR',
      active: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
}
