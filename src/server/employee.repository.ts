import type { ChronoEmployee } from './employee.model';

export interface EmployeeRepository {
  read(): unknown;
  write(employees: ChronoEmployee[]): void;
}
