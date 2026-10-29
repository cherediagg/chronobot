const fs = require('node:fs');
const path = require('node:path');

const EMPLOYEES_FILE_PATH = path.resolve(__dirname, '..', 'data', 'employees.json');

function normalizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildAllowedNumbers(empleados = []) {
  return (empleados || []).reduce((acc, empleado) => {
    const telefono = normalizePhoneNumber(empleado?.telefono || empleado?.phone);
    const nombre = empleado?.nombre || empleado?.name || telefono || 'Sin nombre';

    const isActivo = empleado?.activo !== undefined ? empleado.activo : empleado?.authorized;

    if (isActivo && telefono) {
      acc[telefono] = nombre;
    }

    return acc;
  }, {});
}

function loadEmployees() {
  try {
    if (!fs.existsSync(EMPLOYEES_FILE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(EMPLOYEES_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`[ChronoBot Contacts] Error al leer ${EMPLOYEES_FILE_PATH}:`, error.message || error);
    return [];
  }
}

function saveEmployees(empleados = []) {
  try {
    const dir = path.dirname(EMPLOYEES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(EMPLOYEES_FILE_PATH, JSON.stringify(empleados, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`[ChronoBot Contacts] Error al escribir en ${EMPLOYEES_FILE_PATH}:`, error.message || error);
    return false;
  }
}

module.exports = {
  EMPLOYEES_FILE_PATH,
  normalizePhoneNumber,
  buildAllowedNumbers,
  loadEmployees,
  saveEmployees
};
