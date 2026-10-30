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

module.exports = {
  EMPLOYEES_FILE_PATH,
  normalizePhoneNumber,
  buildAllowedNumbers,
  loadEmployees
};
