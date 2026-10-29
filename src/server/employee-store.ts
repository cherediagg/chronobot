import fs from 'node:fs';
import path from 'node:path';

export const EMPLOYEES_FILE_PATH = path.resolve(process.cwd(), 'data', 'employees.json');

export interface ChronoEmployee {
  id: string;
  nombre: string;
  name?: string;
  telefono: string;
  phone?: string;
  activo: boolean;
  authorized?: boolean;
  notes?: string;
  updatedAt?: string;
}

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

class EmployeeStore {
  /**
   * Reads employees from data/employees.json.
   * If the file does not exist, it seeds it with defaults.
   */
  public getEmployees(): ChronoEmployee[] {
    try {
      if (fs.existsSync(EMPLOYEES_FILE_PATH)) {
        const raw = fs.readFileSync(EMPLOYEES_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((e: Partial<ChronoEmployee>, idx: number) => {
            const nombre = e.nombre || e.name || `Empleado ${idx + 1}`;
            const telefono = e.telefono || e.phone || '';
            const activo = e.activo !== undefined ? Boolean(e.activo) : (e.authorized !== undefined ? Boolean(e.authorized) : true);
            return {
              id: e.id || `emp-${idx + 1}`,
              nombre,
              name: nombre,
              telefono,
              phone: telefono,
              activo,
              authorized: activo,
              notes: e.notes || '',
              updatedAt: e.updatedAt || new Date().toISOString()
            };
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[EmployeeStore API] Error al leer ${EMPLOYEES_FILE_PATH}: ${msg}`);
    }

    // Initialize with default employees if file missing or empty
    this.writeEmployeesToFile(DEFAULT_EMPLOYEES);
    return DEFAULT_EMPLOYEES;
  }

  /**
   * Persists an array of employees to data/employees.json.
   */
  private writeEmployeesToFile(employees: ChronoEmployee[]): boolean {
    try {
      const dir = path.dirname(EMPLOYEES_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(EMPLOYEES_FILE_PATH, JSON.stringify(employees, null, 2), 'utf-8');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[EmployeeStore API] Error al escribir en ${EMPLOYEES_FILE_PATH}: ${msg}`);
      return false;
    }
  }

  /**
   * Retrieves file metadata for inspection in the dashboard.
   */
  public getEmployeeFileDetails() {
    const exists = fs.existsSync(EMPLOYEES_FILE_PATH);
    let size = 0;
    let modifiedAt = new Date().toISOString();
    let rawContent = '[]';
    let employeesCount = 0;
    let allowedCount = 0;

    if (exists) {
      try {
        const stat = fs.statSync(EMPLOYEES_FILE_PATH);
        size = stat.size;
        modifiedAt = stat.mtime.toISOString();
        rawContent = fs.readFileSync(EMPLOYEES_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed)) {
          employeesCount = parsed.length;
          allowedCount = parsed.filter(e => e.activo !== false && e.authorized !== false).length;
        }
      } catch {
        // Fallback
      }
    }

    return {
      relativePath: 'data/employees.json',
      absolutePath: EMPLOYEES_FILE_PATH,
      exists,
      sizeBytes: size,
      modifiedAt,
      employeesCount,
      allowedCount,
      rawJson: rawContent
    };
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
    this.writeEmployeesToFile(current);
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

    this.writeEmployeesToFile(current);
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

    this.writeEmployeesToFile(current);
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
    this.writeEmployeesToFile(current);
    return removed;
  }

  /**
   * Overwrites data/employees.json with validated raw JSON.
   */
  public saveRawEmployeesFile(rawJson: string): { success: boolean; count?: number; error?: string } {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return { success: false, error: 'El contenido debe ser un array JSON' };
      }

      const formatted: ChronoEmployee[] = parsed.map((e: Partial<ChronoEmployee>, idx: number) => ({
        id: e.id || `emp-${idx + 1}`,
        nombre: e.nombre || e.name || `Empleado ${idx + 1}`,
        name: e.nombre || e.name || `Empleado ${idx + 1}`,
        telefono: e.telefono || e.phone || '',
        phone: e.telefono || e.phone || '',
        activo: e.activo !== undefined ? Boolean(e.activo) : (e.authorized !== undefined ? Boolean(e.authorized) : true),
        authorized: e.activo !== undefined ? Boolean(e.activo) : (e.authorized !== undefined ? Boolean(e.authorized) : true),
        notes: e.notes || '',
        updatedAt: new Date().toISOString()
      }));

      this.writeEmployeesToFile(formatted);
      return { success: true, count: formatted.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export const employeeStore = new EmployeeStore();
