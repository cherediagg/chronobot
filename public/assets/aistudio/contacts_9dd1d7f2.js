const path = require('node:path');

function resolveBaseDatosPath() {
  return path.resolve(__dirname, '..', '..', 'fernetv2', 'public', 'basedatos');
}

function loadJsonArrayFromModule(modulePath) {
  try {
    const data = require(modulePath);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`No se pudo cargar ${modulePath}:`, error.message || error);
    return [];
  }
}

function normalizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildAllowedNumbers(empleados = []) {
  return (empleados || []).reduce((acc, empleado) => {
    const telefono = normalizePhoneNumber(empleado?.telefono);
    const nombre = empleado?.name || empleado?.nombre || telefono || 'Sin nombre';

    if (empleado?.activo && telefono) {
      acc[telefono] = nombre;
    }

    return acc;
  }, {});
}

function loadEmployees() {
  const baseDatosDir = resolveBaseDatosPath();
  return loadJsonArrayFromModule(path.join(baseDatosDir, 'empleados.js'));
}

function loadMessages() {
  const baseDatosDir = resolveBaseDatosPath();
  return loadJsonArrayFromModule(path.join(baseDatosDir, 'mensajes.js'));
}

module.exports = {
  normalizePhoneNumber,
  buildAllowedNumbers,
  loadEmployees,
  loadMessages,
};
