const path = require('node:path');
const {
  buildAllowedNumbers,
  loadEmployees,
  normalizePhoneNumber,
  EMPLOYEES_FILE_PATH
} = require('./lib/contacts');

let employees = loadEmployees();
let allowedNumbers = buildAllowedNumbers(employees);

function log(level, message, details) {
  const timestamp = new Date().toLocaleString('es-ES');
  if (details !== undefined) {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, details);
  } else {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

/**
 * Reloads allowed numbers dynamically from the persistent data/employees.json file.
 */
function refreshAllowedNumbers() {
  employees = loadEmployees();
  allowedNumbers = buildAllowedNumbers(employees);
  log('log', `Contactos autorizados recargados desde ${EMPLOYEES_FILE_PATH}: ${Object.keys(allowedNumbers).length}`);
  return allowedNumbers;
}

function normalizeWhatsAppPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const withoutServer = value.trim().replace(/@(c\.us|s\.whatsapp\.net)$/i, '');
  if (value.includes('@lid') || value.includes('@g.us')) return null;
  const normalized = normalizePhoneNumber(withoutServer);
  return normalized || null;
}

module.exports = {
  loadEmployees,
  refreshAllowedNumbers,
  getEmployees: () => employees,
  getAllowedNumbers: () => allowedNumbers,
  normalizeWhatsAppPhone,
  log,
  EMPLOYEES_FILE_PATH
};
