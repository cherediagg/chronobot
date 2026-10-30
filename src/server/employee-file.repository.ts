import fs from 'node:fs';
import path from 'node:path';
import type { ChronoEmployee } from './employee.model';
import type { EmployeeRepository } from './employee.repository';

export const EMPLOYEES_FILE_PATH = path.resolve(process.cwd(), 'data', 'employees.json');

export class EmployeeFileRepository implements EmployeeRepository {
  read(): unknown {
    if (!fs.existsSync(EMPLOYEES_FILE_PATH)) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(EMPLOYEES_FILE_PATH, 'utf-8'));
    return parsed;
  }

  write(employees: ChronoEmployee[]) {
    const directory = path.dirname(EMPLOYEES_FILE_PATH);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(EMPLOYEES_FILE_PATH, JSON.stringify(employees, null, 2), 'utf-8');
  }
}
