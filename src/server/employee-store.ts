import { EMPLOYEES_FILE_PATH, EmployeeFileRepository } from './employee-file.repository';
import { ChronoEmployee } from './employee.model';
import { EmployeeRepository } from './employee.repository';

export { EMPLOYEES_FILE_PATH } from './employee-file.repository';
export type { ChronoEmployee } from './employee.model';

const DEFAULT_EMPLOYEES: ChronoEmployee[] = [
  {
    id: 'emp-1',
    nombre: 'Ana Pérez',
    name: 'Ana Pérez',
    telefono: '+5215511234567',
    phone: '+5215511234567',
    activo: true,
    authorized: true,
    notes: 'Supervisora de operaciones y fotógrafa',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-2',
    nombre: 'Carlos López',
    name: 'Carlos López',
    telefono: '+5215587654321',
    phone: '+5215587654321',
    activo: true,
    authorized: true,
    notes: 'Equipo técnico de campo',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-3',
    nombre: 'Luis García',
    name: 'Luis García',
    telefono: '+5215544332211',
    phone: '+5215544332211',
    activo: true,
    authorized: true,
    notes: 'Inspector regional',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-4',
    nombre: 'María Torres',
    name: 'María Torres',
    telefono: '+5215599887766',
    phone: '+5215599887766',
    activo: true,
    authorized: true,
    notes: 'Coordinadora de expedición',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-5',
    nombre: 'Juan Rivera',
    name: 'Juan Rivera',
    telefono: '+5215533221100',
    phone: '+5215533221100',
    activo: true,
    authorized: true,
    notes: 'Logística de almacenamiento',
    updatedAt: new Date().toISOString()
  }
];

function normalizeEmployee(value: unknown, index: number): ChronoEmployee {
  const record = isRecord(value) ? value : {};
  const nombre = typeof record['nombre'] === 'string'
    ? record['nombre']
    : typeof record['name'] === 'string'
      ? record['name']
      : `Empleado ${index + 1}`;
  const telefono = typeof record['telefono'] === 'string'
    ? record['telefono']
    : typeof record['phone'] === 'string'
      ? record['phone']
      : '';
  const activo = record['activo'] !== undefined
    ? Boolean(record['activo'])
    : record['authorized'] !== undefined
      ? Boolean(record['authorized'])
      : true;
  const notes = typeof record['notes'] === 'string' ? record['notes'] : '';
  const updatedAt = typeof record['updatedAt'] === 'string' ? record['updatedAt'] : new Date().toISOString();

  return {
    id: typeof record['id'] === 'string' ? record['id'] : `emp-${index + 1}`,
    nombre,
    name: nombre,
    telefono,
    phone: telefono,
    activo,
    authorized: activo,
    notes,
    updatedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class EmployeeStore {
  constructor(private readonly repository: EmployeeRepository) {}

  /**
   * Reads employees from data/employees.json.
   * If the file does not exist, it seeds it with defaults.
   */
  public getEmployees(): ChronoEmployee[] {
    try {
      const parsed = this.repository.read();
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((employee, index) => normalizeEmployee(employee, index));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[EmployeeStore API] Error al leer ${EMPLOYEES_FILE_PATH}: ${msg}`);
    }

    // Initialize with default employees if file missing or empty
    this.repository.write(DEFAULT_EMPLOYEES);
    return DEFAULT_EMPLOYEES.map(employee => ({ ...employee }));
  }

  /**
   * Adds a new employee and saves directly to data/employees.json.
   */
  public addEmployee(emp: Partial<ChronoEmployee>): ChronoEmployee {
    const current = this.getEmployees();
    const id = 'emp-' + Date.now();
    const nombre = emp.nombre || emp.name || 'Nuevo Contacto';
    const telefono = emp.telefono || emp.phone || '';
    const activo = emp.activo !== undefined ? Boolean(emp.activo) : (emp.authorized !== undefined ? Boolean(emp.authorized) : true);

    const newEmp: ChronoEmployee = {
      id,
      nombre,
      name: nombre,
      telefono,
      phone: telefono,
      activo,
      authorized: activo,
      notes: emp.notes || '',
      updatedAt: new Date().toISOString()
    };

    current.push(newEmp);
    this.repository.write(current);
    return newEmp;
  }

  /**
   * Updates an existing employee and saves to data/employees.json.
   */
  public updateEmployee(id: string, updates: Partial<ChronoEmployee>): ChronoEmployee | null {
    const current = this.getEmployees();
    const emp = current.find(e => e.id === id);
    if (!emp) return null;

    if (updates.nombre !== undefined || updates.name !== undefined) {
      const val = updates.nombre || updates.name || emp.nombre;
      emp.nombre = val;
      emp.name = val;
    }
    if (updates.telefono !== undefined || updates.phone !== undefined) {
      const val = updates.telefono || updates.phone || emp.telefono;
      emp.telefono = val;
      emp.phone = val;
    }
    if (updates.notes !== undefined) {
      emp.notes = updates.notes;
    }
    if (updates.activo !== undefined || updates.authorized !== undefined) {
      const val = updates.activo !== undefined ? Boolean(updates.activo) : Boolean(updates.authorized);
      emp.activo = val;
      emp.authorized = val;
    }
    emp.updatedAt = new Date().toISOString();

    this.repository.write(current);
    return emp;
  }

  /**
   * Toggles the active/authorization status of an employee and saves to data/employees.json.
   */
  public toggleEmployeeActive(id: string): ChronoEmployee | null {
    const current = this.getEmployees();
    const emp = current.find(e => e.id === id);
    if (!emp) return null;

    emp.activo = !emp.activo;
    emp.authorized = emp.activo;
    emp.updatedAt = new Date().toISOString();

    this.repository.write(current);
    return emp;
  }

  /**
   * Deletes an employee from data/employees.json.
   */
  public deleteEmployee(id: string): ChronoEmployee | null {
    const current = this.getEmployees();
    const idx = current.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const [removed] = current.splice(idx, 1);
    this.repository.write(current);
    return removed;
  }

}

export const employeeStore = new EmployeeStore(new EmployeeFileRepository());
